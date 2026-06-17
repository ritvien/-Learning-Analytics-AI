import os
import sys
import json
import time
import psycopg2
from dotenv import load_dotenv
from google import genai
from google.genai import types

sys.stdout.reconfigure(encoding='utf-8')

# Ensure we load from the root .env
env_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path=env_path)

DB_URL = os.getenv("DATABASE_URL", "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight")

api_key = os.getenv("GEMINI_API_KEY")
if not api_key:
    print("❌ ERROR: GEMINI_API_KEY is missing in .env")
    sys.exit(1)

client = genai.Client(api_key=api_key)

FEW_SHOT_PROMPT = """
You are an expert academic curriculum designer at a university in Vietnam.
I will give you a list of Course Names. Your task is to generate 4 to 6 realistic "Course Learning Outcomes" (Chuẩn đầu ra môn học - CLO) for EACH course.

The wording should follow Vietnamese higher education standards. Use active verbs like: "Nắm vững", "Vận dụng được", "Phân tích", "Hiểu được", "Thực hành", "Sinh viên có khả năng...".
Also, randomly map each CLO to 1-3 Program Learning Outcomes (PLO), represented by strings like "1", "2", "3".

Here is an example of the quality and tone expected:
Course: "Công nghệ phần mềm"
CLOs:
- CLO1: Sinh viên có khả năng mô tả được các hoạt động của sản xuất phần mềm. (Mapped PLOs: ["2", "5"])
- CLO2: Hiểu được quy trình phát triển phần mềm, có kiến thức về lập trình, phân tích thiết kế. (Mapped PLOs: ["1", "2", "3"])
- CLO3: Sinh viên có khả năng viết, thuyết trình, sử dụng các công cụ biểu đồ trong các quy trình phát triển phần mềm. (Mapped PLOs: ["4", "8"])

CRITICAL RULES:
1. Respond ONLY with a valid JSON object. Do not include markdown blocks like ```json ... ```. 
2. The JSON keys MUST exactly match the course names I provide.
3. The schema must be:
{
  "Tên môn học 1": [
    { "code": "CLO1", "description": "...", "mapped_plos": ["1", "3"] },
    ...
  ],
  "Tên môn học 2": [
    ...
  ]
}

Now, generate the CLOs for the following courses:
"""

def generate_clos_for_batch(course_names: list[str]) -> dict:
    prompt = FEW_SHOT_PROMPT + "\n" + "\n".join([f"- {name}" for name in course_names])
    
    try:
        response = client.models.generate_content(
            model='gemini-3.5-flash',
            contents=prompt,
        )
        
        json_result = response.text.strip()
        if json_result.startswith("```json"):
            json_result = json_result[7:]
        if json_result.endswith("```"):
            json_result = json_result[:-3]
            
        return json.loads(json_result.strip())
    except json.JSONDecodeError as e:
        print("  JSON Decode Error:", e)
        print("  Raw Output:", json_result)
        return None
    except Exception as e:
        print(f"  API Error: {e}")
        return None


def run_synthetic_pipeline():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True

    with conn.cursor() as cur:
        # Fetch courses that don't have CLOs yet
        cur.execute('''
            SELECT c.id, c.name
            FROM courses c
            LEFT JOIN (SELECT DISTINCT course_id FROM clos) cl ON c.id = cl.course_id
            WHERE cl.course_id IS NULL
            ORDER BY c.id
        ''')
        rows = cur.fetchall()

    if not rows:
        print("🎉 No courses missing CLOs. Database is 100% full!")
        conn.close()
        return

    print(f"Found {len(rows)} courses without CLOs.")
    
    # Process in batches of 5 to save API calls and avoid hallucinations
    BATCH_SIZE = 5
    batches = [rows[i:i + BATCH_SIZE] for i in range(0, len(rows), BATCH_SIZE)]
    
    total_inserted = 0

    for batch_idx, batch in enumerate(batches, 1):
        course_dict = {row[1]: row[0] for row in batch}
        course_names = list(course_dict.keys())
        
        print(f"\n[Batch {batch_idx}/{len(batches)}] Synthesizing for: {', '.join(course_names)}")
        
        result_json = generate_clos_for_batch(course_names)
        
        if not result_json:
            print("  ❌ Failed to generate JSON. Waiting 10s and skipping batch...")
            time.sleep(10)
            continue
            
        # Insert into database
        with conn.cursor() as cur:
            for c_name, clos in result_json.items():
                c_id = course_dict.get(c_name)
                if not c_id:
                    # Fuzzy match fallback just in case LLM slightly altered the name
                    for orig_name, orig_id in course_dict.items():
                        if orig_name.lower() in c_name.lower() or c_name.lower() in orig_name.lower():
                            c_id = orig_id
                            break
                
                if not c_id:
                    print(f"  ❌ Could not match returned course '{c_name}' to DB.")
                    continue
                    
                cur.execute("DELETE FROM clos WHERE course_id = %s", (c_id,))
                
                insert_query = """
                    INSERT INTO clos (course_id, code, name, description, bloom_level, weight, sort_order, is_active)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """
                for sort_idx, clo in enumerate(clos):
                    code = clo.get("code", f"CLO{sort_idx+1}")[:20]
                    desc = clo.get("description", "")
                    name = desc[:255] if desc else code
                    
                    cur.execute(insert_query, (
                        c_id,
                        code,
                        name,
                        desc,
                        None,
                        1.0,
                        sort_idx,
                        True
                    ))
                print(f"  ✅ Inserted {len(clos)} CLOs for '{c_name}'")
                total_inserted += 1
                
        # Sleep to avoid rate limits on free tier API
        time.sleep(5)

    conn.close()
    print(f"\n🎉 Pipeline completed. Successfully generated and inserted CLOs for {total_inserted} courses.")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    run_synthetic_pipeline()
