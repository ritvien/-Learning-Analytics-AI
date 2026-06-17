import os
import random
import psycopg2
from dotenv import load_dotenv

env_path = os.path.join(os.path.dirname(__file__), '../../.env')
load_dotenv(dotenv_path=env_path)

DB_URL = os.getenv("DATABASE_URL", "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight")

def seed_mappings():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cur = conn.cursor()

    # Get courses that have CLOs
    cur.execute("SELECT DISTINCT course_id FROM clos")
    courses_with_clos = [r[0] for r in cur.fetchall()]
    
    if not courses_with_clos:
        print("No CLOs found in database. Run CLO extraction first.")
        return

    # Clear old mappings
    cur.execute("TRUNCATE grade_component_clo_mappings")

    total_mappings = 0

    # For each course with CLOs
    for course_id in courses_with_clos:
        # Get its CLOs
        cur.execute("SELECT id, code, description FROM clos WHERE course_id = %s", (course_id,))
        clos = cur.fetchall()
        clo_ids = [c[0] for c in clos]
        if not clo_ids:
            continue

        # Get its sections and their component types
        cur.execute("""
            SELECT gct.id, gct.name
            FROM grade_component_types gct
            JOIN sections s ON gct.section_id = s.id
            WHERE s.course_id = %s
        """, (course_id,))
        components = cur.fetchall()
        if not components:
            continue

        # Randomly assign CLOs to each component type
        for comp_id, comp_name in components:
            name_lower = comp_name.lower()
            
            # Decide which CLOs this component measures
            mapped_clos = []
            if "chuyên cần" in name_lower or "thái độ" in name_lower:
                # Attendance usually measures 1 CLO (often the last one, ethics)
                mapped_clos = [clos[-1][0]]
            elif "giữa kỳ" in name_lower or "thực hành" in name_lower:
                # Midterm measures first half of CLOs
                num = max(1, len(clos) // 2)
                mapped_clos = [c[0] for c in clos[:num]]
            elif "cuối kỳ" in name_lower:
                # Final usually measures most CLOs
                num = max(1, len(clos) - 1)
                mapped_clos = random.sample([c[0] for c in clos], num)
            else:
                # Other components, just pick 1 or 2 random CLOs
                num = min(2, len(clos))
                mapped_clos = random.sample([c[0] for c in clos], num)
                
            # If mapping is empty, pick a random one
            if not mapped_clos:
                mapped_clos = [random.choice(clo_ids)]
                
            # Create weights for the mapped CLOs (must sum to 1.0 or 100%)
            # We'll use fractions that sum to 1.0
            weights = []
            for i in range(len(mapped_clos)):
                if i == len(mapped_clos) - 1:
                    weights.append(1.0 - sum(weights))
                else:
                    w = round(random.uniform(0.1, 0.9 / len(mapped_clos)), 2)
                    weights.append(w)
                    
            # Insert mappings
            for clo_id, weight in zip(mapped_clos, weights):
                cur.execute("""
                    INSERT INTO grade_component_clo_mappings (component_type_id, clo_id, weight)
                    VALUES (%s, %s, %s)
                """, (comp_id, clo_id, weight))
                total_mappings += 1

    print(f"🎉 Successfully created {total_mappings} grade component -> CLO mappings.")
    conn.close()

if __name__ == "__main__":
    seed_mappings()
