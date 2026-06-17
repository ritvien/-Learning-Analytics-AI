import json
import os
import sys
import requests
import psycopg2

try:
    import fitz  # PyMuPDF
    from google import genai
    from PIL import Image
except ImportError:
    print("Missing dependencies. Please install them:")
    print("pip install pymupdf requests google-genai pillow psycopg2")
    sys.exit(1)

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    from dotenv import load_dotenv
    root_env = os.path.join(os.path.dirname(__file__), "../../.env")
    load_dotenv(root_env)
    API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)

# Database connection
DB_URL = os.environ.get("AGENT_DB_URL", "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight")


def get_course_id(conn, course_name: str) -> int:
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM courses WHERE name ILIKE %s", (f"%{course_name}%",))
        result = cur.fetchone()
        if result:
            return result[0]
        return None


def download_pdf(url: str) -> bytes:
    print(f"  Downloading PDF from {url}...")
    requests.packages.urllib3.disable_warnings() 
    response = requests.get(url, verify=False, timeout=30)
    response.raise_for_status()
    return response.content


def extract_images_from_pdf(pdf_bytes: bytes, max_pages: int = 5) -> list[Image.Image]:
    print(f"  Converting first {max_pages} pages to images...")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    num_pages = min(max_pages, len(doc))
    for page_num in range(num_pages):
        page = doc.load_page(page_num)
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
    return images


def extract_clo_with_gemini(images: list[Image.Image]) -> dict:
    print("  Sending to Gemini 3.5 Flash for extraction...")
    prompt = """
    You are an expert academic data extractor. I am giving you images of a university syllabus.
    Your task is to find the "Course Name" (Tên học phần / Tên môn học) and the "Course Learning Outcomes" (CLO - Chuẩn đầu ra môn học) table and extract them.
    
    Rules:
    1. Extract the Course Name exactly as written (e.g., "Tin học đại cương", "Cấu trúc dữ liệu và giải thuật").
    2. Only extract the CLOs. Do not extract other unrelated tables.
    3. In many syllabuses, there is a column mapping the CLO to "Chuẩn đầu ra CTĐT" or "PLO". Extract these into an array of strings.
    4. Respond with ONLY a valid JSON object matching the exact schema below, without markdown formatting or code blocks.
    
    {
      "course_name": "string",
      "clos": [
        {
             "code": "CLO1",
             "description": "string (the content of the outcome)",
             "bloom_level": integer (extract if present, otherwise null),
             "mapped_plos": ["1", "2"] // Array of strings. Leave empty [] if not found.
        }
      ]
    }
    """
    contents = [prompt] + images
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=contents,
    )
    
    json_result = response.text.strip()
    if json_result.startswith("```json"):
        json_result = json_result[7:]
    if json_result.endswith("```"):
        json_result = json_result[:-3]
        
    try:
        return json.loads(json_result.strip())
    except json.JSONDecodeError as e:
        print("  JSON Decode Error:", e)
        print("  Raw Output:", json_result)
        return None


def process_and_insert():
    json_path = os.path.join(os.path.dirname(__file__), "../../crawl/clo_pdf_urls.json")
    if not os.path.exists(json_path):
        print(f"Input file not found: {json_path}")
        return

    with open(json_path, "r", encoding="utf-8") as f:
        urls_data = json.load(f)

    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True

    extracted_results = []

    for idx, item in enumerate(urls_data, 1):
        # Support both old format (dict) and new format (string URL)
        if isinstance(item, dict):
            pdf_url = item.get("pdf_url")
            expected_name = item.get("course_name")
        else:
            pdf_url = item
            expected_name = "Unknown (Will extract from PDF)"
            
        print(f"\n[{idx}/{len(urls_data)}] Processing URL: {pdf_url}")

        # 1. Extract Data
        try:
            pdf_bytes = download_pdf(pdf_url)
            images = extract_images_from_pdf(pdf_bytes)
            if not images:
                print("  ❌ No pages extracted.")
                continue
                
            extracted_data = extract_clo_with_gemini(images)
            if not extracted_data or not extracted_data.get("clos"):
                print("  ❌ No CLOs extracted.")
                continue
                
            course_name = extracted_data.get("course_name", expected_name)
            clos = extracted_data.get("clos", [])
            print(f"  ✅ Extracted Course Name: {course_name} | {len(clos)} CLOs")
            
            extracted_results.append({
                "course_name": course_name,
                "url": pdf_url,
                "clos": clos
            })
            
        except Exception as e:
            print(f"  ❌ Extraction failed: {e}")
            continue

        # 2. Lookup Course ID
        course_id = get_course_id(conn, course_name)
        if not course_id:
            # Try matching expected_name if course_name failed
            if expected_name != "Unknown (Will extract from PDF)":
                course_id = get_course_id(conn, expected_name)
            
            if not course_id:
                print(f"  ❌ WARNING: Course '{course_name}' not found in DB. Data extracted but NOT inserted into DB.")
                continue
            
        print(f"  ✅ Found Course ID: {course_id} in DB.")

        # 3. Insert into DB
        with conn.cursor() as cur:
            # Upsert logic: Delete old CLOs for this course first
            cur.execute("DELETE FROM clos WHERE course_id = %s", (course_id,))
            
            insert_query = """
                INSERT INTO clos (course_id, code, name, description, bloom_level, weight, sort_order, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """
            for sort_idx, clo in enumerate(clos):
                code = clo.get("code", f"CLO{sort_idx+1}")
                desc = clo.get("description", "")
                bloom = clo.get("bloom_level")
                code = code[:20]
                name = desc[:255] if desc else code
                
                cur.execute(insert_query, (
                    course_id,
                    code,
                    name,
                    desc,
                    bloom,
                    1.0,
                    sort_idx,
                    True
                ))
            print(f"  ✅ Successfully inserted {len(clos)} CLOs to database.")

    # Save backup of extracted data
    out_path = os.path.join(os.path.dirname(__file__), "../../crawl/extracted_clos_backup.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(extracted_results, f, ensure_ascii=False, indent=2)
    print(f"\n📁 Saved a backup of all extracted data to: crawl/extracted_clos_backup.json")

    conn.close()
    print("🎉 Pipeline completed.")

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding='utf-8')
    process_and_insert()
