import json
import os
from openai import OpenAI
from dotenv import load_dotenv

def main():
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    env_path = os.path.join(repo_root, ".env")
    load_dotenv(env_path)

    client = OpenAI()
    candidates = [
        os.path.join(repo_root, "..", "crawl", "epu_data_batch.json"),
        os.path.join(repo_root, "crawl", "epu_data_batch.json"),
        os.path.join(repo_root, "epu_data.json"),
    ]
    json_path = next((path for path in candidates if os.path.exists(path)), candidates[0])

    if not os.path.exists(json_path):
        print(f"File not found: {json_path}")
        return

    with open(json_path, encoding="utf-8") as f:
        data = json.load(f)

    departments = set()
    courses = set()

    for item in data:
        khoa = item.get("student_info", {}).get("Khoa")
        if khoa:
            departments.add(khoa)
        
        for g in item.get("grades", []):
            course_name = g.get("Tên môn học")
            if course_name:
                courses.add(course_name)

    # Add foundational departments
    base_departments = {
        "Khoa Khoa học Cơ bản", 
        "Khoa Ngoại ngữ", 
        "Khoa Lý luận chính trị", 
        "Khoa GDTC & QP"
    }
    all_depts = list(departments | base_departments)

    course_list = list(courses)
    print(f"Found {len(course_list)} unique courses and {len(all_depts)} departments.")

    prompt = f"""
I have a list of university courses and a list of departments.
Please map each course to the most logical department.
If a course is generic IT, map it to "Khoa Công nghệ thông tin".
If a course is math/physics/chemistry, map to "Khoa Khoa học Cơ bản".
If a course is English/language, map to "Khoa Ngoại ngữ".
If a course is political theory/Marxism/history, map to "Khoa Lý luận chính trị".
If physical education/defense, map to "Khoa GDTC & QP".

Available Departments:
{", ".join(all_depts)}

Courses to map:
{json.dumps(course_list, ensure_ascii=False)}

Output format: Return ONLY a valid JSON dictionary where keys are course names and values are department names. Do not include markdown formatting or backticks, just the raw JSON.
"""

    print("Calling OpenAI to classify...")
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "You are a helpful university administration assistant."},
            {"role": "user", "content": prompt}
        ],
        temperature=0.0
    )

    result_text = response.choices[0].message.content.strip()
    if result_text.startswith("```json"):
        result_text = result_text[7:-3]
    elif result_text.startswith("```"):
        result_text = result_text[3:-3]
    
    mapping = json.loads(result_text.strip())

    output_path = os.path.join(os.path.dirname(__file__), "course_departments.json")
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)

    print(f"Successfully wrote mapping to {output_path}")

if __name__ == "__main__":
    main()
