import psycopg2

DB_SRC = "postgresql://eduinsight:eduinsight_dev@localhost:5433/eduinsight"
DB_DEST = "postgresql://postgres:Hoang2004%40@localhost:5432/eduinsight"

def inject_clos():
    conn_src = psycopg2.connect(DB_SRC)
    conn_dest = psycopg2.connect(DB_DEST)
    conn_dest.autocommit = True
    
    cur_src = conn_src.cursor()
    cur_dest = conn_dest.cursor()
    
    # Get all CLOs from SRC with course name
    cur_src.execute("""
        SELECT c.name, clo.code, clo.name, clo.description, clo.bloom_level, clo.weight, clo.sort_order, clo.is_active
        FROM clos clo
        JOIN courses c ON clo.course_id = c.id
    """)
    src_clos = cur_src.fetchall()
    print(f"Found {len(src_clos)} CLOs in SRC DB.")
    
    # Get all courses from DEST
    cur_dest.execute("SELECT id, name FROM courses")
    dest_courses = {row[1].strip().lower(): row[0] for row in cur_dest.fetchall()}
    
    inserted = 0
    skipped = 0
    
    # We should delete old CLOs first or just insert? Let's clear clos table first for a clean state
    cur_dest.execute("TRUNCATE TABLE clos CASCADE")
    print("Truncated clos table in DEST DB.")
    
    insert_query = """
        INSERT INTO clos (course_id, code, name, description, bloom_level, weight, sort_order, is_active)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    for row in src_clos:
        c_name, code, name, description, bloom_level, weight, sort_order, is_active = row
        c_name_lower = c_name.strip().lower()
        
        dest_id = dest_courses.get(c_name_lower)
        if not dest_id:
            # try fuzzy matching
            for d_name, d_id in dest_courses.items():
                if c_name_lower in d_name or d_name in c_name_lower:
                    dest_id = d_id
                    break
                    
        if dest_id:
            cur_dest.execute(insert_query, (dest_id, code, name, description, bloom_level, weight, sort_order, is_active))
            inserted += 1
        else:
            skipped += 1
            
    print(f"Successfully injected {inserted} CLOs. Skipped {skipped} due to missing course match.")
    
    conn_src.close()
    conn_dest.close()

if __name__ == "__main__":
    inject_clos()
