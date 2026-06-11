import os
import sys
import psycopg2
from urllib.parse import urlparse

# Add the backend directory to sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend'))
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

from dotenv import load_dotenv

load_dotenv(os.path.join(backend_dir, '.env'))

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/eduinsight")

def init_db():
    schema_path = os.path.abspath(os.path.join(os.path.dirname(__file__), '../backend/db/schema.sql'))
    if not os.path.exists(schema_path):
        print(f"Error: Schema file not found at {schema_path}")
        return

    with open(schema_path, 'r', encoding='utf-8') as f:
        sql = f.read()

    print(f"Connecting to database at {DATABASE_URL}...")
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        cur = conn.cursor()
        
        print("Executing schema.sql...")
        cur.execute(sql)
        print("Database initialized successfully!")
        
        cur.close()
        conn.close()
    except Exception as e:
        print(f"Error initializing database: {e}")

if __name__ == "__main__":
    init_db()
