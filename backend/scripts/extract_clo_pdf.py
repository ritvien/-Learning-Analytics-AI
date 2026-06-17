import argparse
import json
import os
import sys
import tempfile
from io import BytesIO
from typing import Optional

try:
    import fitz  # PyMuPDF
    import requests
    from google import genai
    from PIL import Image
except ImportError:
    print("Missing dependencies. Please install them:")
    print("pip install pymupdf requests google-genai pillow")
    sys.exit(1)

# Configure Gemini API
API_KEY = os.environ.get("GEMINI_API_KEY")
if not API_KEY:
    # Try loading from the root .env file
    from dotenv import load_dotenv
    root_env = os.path.join(os.path.dirname(__file__), "../../.env")
    load_dotenv(root_env)
    API_KEY = os.environ.get("GEMINI_API_KEY")

if not API_KEY:
    print("Error: GEMINI_API_KEY environment variable not set.")
    sys.exit(1)

client = genai.Client(api_key=API_KEY)


def download_pdf(url: str) -> bytes:
    """Download PDF from a URL."""
    print(f"Downloading PDF from {url}...")
    # Skip SSL verification for some university portals
    response = requests.get(url, verify=False, timeout=30)
    response.raise_for_status()
    return response.content


def extract_images_from_pdf(pdf_bytes: bytes, max_pages: int = 5) -> list[Image.Image]:
    """Convert the first N pages of a PDF to PIL Images."""
    print(f"Converting first {max_pages} pages to images...")
    doc = fitz.open(stream=pdf_bytes, filetype="pdf")
    images = []
    
    # We only care about the first few pages where CLO tables usually are
    num_pages = min(max_pages, len(doc))
    for page_num in range(num_pages):
        page = doc.load_page(page_num)
        # 150 DPI is usually enough for OCR
        pix = page.get_pixmap(dpi=150)
        img = Image.frombytes("RGB", [pix.width, pix.height], pix.samples)
        images.append(img)
        
    return images


def extract_clo_with_gemini(images: list[Image.Image]) -> str:
    """Use Gemini 3.5 Flash to extract CLO table to JSON."""
    print("Sending images to Gemini 3.5 Flash for extraction...")
    
    prompt = """
    You are an expert academic data extractor. I am giving you images of a university syllabus.
    Your task is to find the "Course Learning Outcomes" (CLO - Chuẩn đầu ra môn học) table and extract it into a structured JSON array.
    
    Rules:
    1. Only extract the CLOs. Do not extract other unrelated tables.
    2. Respond with ONLY a valid JSON array, without markdown formatting or code blocks.
    3. In many syllabuses, there is a column mapping the CLO to "Chuẩn đầu ra CTĐT" or "PLO" (which usually contains numbers like 1, 2, 3... or PLO1, PLO2...). Extract these into an array of strings.
    4. Use the following exact JSON schema for each object:
       [
         {
             "code": "CLO1",
             "description": "string (the content of the outcome)",
             "bloom_level": integer (extract if present, otherwise null),
             "mapped_plos": ["1", "2", "3"] // Array of strings representing the mapped PLOs. Leave empty [] if not found.
         }
       ]
    """
    
    # Combine prompt with all images
    contents = [prompt] + images
    
    response = client.models.generate_content(
        model='gemini-3.5-flash',
        contents=contents,
    )
    return response.text.strip()


def main():
    parser = argparse.ArgumentParser(description="Extract CLO from scanned PDF Syllabi using Gemini.")
    parser.add_argument("--url", type=str, required=True, help="URL of the PDF to parse")
    parser.add_argument("--pages", type=int, default=5, help="Number of pages to scan (default: 5)")
    args = parser.parse_args()

    # Disable InsecureRequestWarning for university sites
    requests.packages.urllib3.disable_warnings() 

    try:
        pdf_bytes = download_pdf(args.url)
        images = extract_images_from_pdf(pdf_bytes, max_pages=args.pages)
        if not images:
            print("No pages found in PDF.")
            return

        json_result = extract_clo_with_gemini(images)
        
        # Clean up markdown if Gemini accidentally added it
        if json_result.startswith("```json"):
            json_result = json_result[7:]
        if json_result.endswith("```"):
            json_result = json_result[:-3]
            
        print("\n--- EXTRACTION RESULT ---\n")
        
        # Pretty print JSON if valid
        try:
            parsed = json.loads(json_result.strip())
            # Force UTF-8 stdout for Windows
            sys.stdout.reconfigure(encoding='utf-8')
            print(json.dumps(parsed, indent=2, ensure_ascii=False))
        except json.JSONDecodeError:
            sys.stdout.reconfigure(encoding='utf-8')
            print("Could not parse JSON. Raw output:")
            print(json_result)
            
    except Exception as e:
        print(f"Extraction failed: {e}", file=sys.stderr)


if __name__ == "__main__":
    main()
