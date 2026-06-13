import os
import json
import sys
import asyncio

# Thêm đường dẫn backend vào sys.path để import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'backend')))

from app.database import engine, Base, AsyncSessionLocal
from app.models import Program, Department, Course, PLO, CoursePLOMapping
from sqlalchemy import select, text

async def sync_sequences(session):
    tables = ['universities', 'departments', 'programs', 'courses']
    for t in tables:
        await session.execute(text(f"SELECT setval('{t}_id_seq', (SELECT COALESCE(MAX(id), 1) FROM {t}));"))
    await session.commit()

async def get_or_create_default_dept(session):
    result = await session.execute(select(Department).where(Department.code == "DEFAULT"))
    dept = result.scalars().first()
    if not dept:
        # Lấy university
        from app.models import University
        uni_result = await session.execute(select(University).limit(1))
        uni = uni_result.scalars().first()
        if not uni:
            uni = University(code="EPU", name="Trường Đại học Điện Lực")
            session.add(uni)
            await session.flush()
            
        dept = Department(
            university_id=uni.id,
            code="DEFAULT",
            name="Chưa phân khoa"
        )
        session.add(dept)
        await session.flush()
    return dept

async def seed_plos_and_matrix():
    print("=== BẮT ĐẦU SEED DỮ LIỆU PLO & MATRIX ===")
    
    # 1. Tạo các bảng mới nếu chưa có (chạy đồng bộ cho DDL)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        print("Đã đảm bảo các bảng db (plos, course_plos) tồn tại.")

    plo_dir = r"c:\Users\Admin\Work\AI In Action\crawl\plo_data"
    json_files = [f for f in os.listdir(plo_dir) if f.endswith('.json')]
    
    async with AsyncSessionLocal() as session:
        await sync_sequences(session)
        default_dept = await get_or_create_default_dept(session)
        
        # Load all programs into memory for exact match
        prog_result = await session.execute(select(Program))
        existing_programs = {p.name.lower(): p for p in prog_result.scalars().all()}
        
        # Load all courses into memory
        course_result = await session.execute(select(Course))
        existing_courses = {c.code: c for c in course_result.scalars().all()}
        
        total_plos_inserted = 0
        total_mappings_inserted = 0
        total_courses_created = 0
        
        inserted_mappings = set() # (course_id, plo_id)
        
        for f_name in json_files:
            file_path = os.path.join(plo_dir, f_name)
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            program_name = data.get("program_name", "").strip()
            if not program_name:
                continue
                
            p_lower = program_name.lower()
            if p_lower.startswith("ngành "):
                p_lower = p_lower[6:].strip()
                
            prog = existing_programs.get(p_lower)
            if not prog:
                # Tìm lại với tên đầy đủ
                prog = existing_programs.get(program_name.lower())
                
            if not prog:
                # Tạo mới Program
                import uuid
                code_prefix = "PROG_" + uuid.uuid4().hex[:8].upper()
                # Ensure unique code
                prog = Program(
                    department_id=default_dept.id,
                    code=code_prefix,
                    name=program_name,
                    duration_years=4,
                    version="2024"
                )
                session.add(prog)
                await session.flush()
                existing_programs[p_lower] = prog
                print(f"[+] Tạo mới Ngành: {program_name}")
            
            # Xóa các PLO cũ của ngành này (nếu chạy lại)
            await session.execute(text("DELETE FROM course_plos WHERE plo_id IN (SELECT id FROM plos WHERE program_id = :pid)"), {"pid": prog.id})
            await session.execute(text("DELETE FROM plos WHERE program_id = :pid"), {"pid": prog.id})
            
            # Insert PLOs
            plo_map = {} # code -> PLO object
            for plo_data in data.get("plos", []):
                p_obj = PLO(
                    program_id=prog.id,
                    code=plo_data["code"],
                    name=plo_data["code"],
                    description=plo_data["description"]
                )
                session.add(p_obj)
                plo_map[plo_data["code"]] = p_obj
                total_plos_inserted += 1
            
            await session.flush() # Để PLO có id
            
            # Insert Matrix
            for row in data.get("matrix", []):
                course_code = row.get("course_code")
                course_name = row.get("course_name")
                
                if not course_code:
                    continue
                    
                course = existing_courses.get(course_code)
                if not course:
                    course = Course(
                        code=course_code,
                        name=course_name,
                        credits=3 # default
                    )
                    session.add(course)
                    await session.flush()
                    existing_courses[course_code] = course
                    total_courses_created += 1
                
                # Insert Mappings
                for plo_code, level in row.get("mapped_plos", {}).items():
                    plo_obj = plo_map.get(plo_code)
                    if plo_obj:
                        key = (course.id, plo_obj.id)
                        if key in inserted_mappings:
                            continue
                        inserted_mappings.add(key)
                        
                        if isinstance(level, str):
                            try:
                                level = int(level)
                            except ValueError:
                                level = 1
                        elif not isinstance(level, int):
                            level = 1
                            
                        # Ensure level is between 1 and 3
                        level = max(1, min(3, level))
                        
                        mapping = CoursePLOMapping(
                            course_id=course.id,
                            plo_id=plo_obj.id,
                            level=level
                        )
                        session.add(mapping)
                        total_mappings_inserted += 1
        
        await session.commit()
        print("\n=== HOÀN THÀNH ===")
        print(f"Tổng số PLO đã thêm: {total_plos_inserted}")
        print(f"Tổng số Môn học mới được tạo: {total_courses_created}")
        print(f"Tổng số Mapping (Course <-> PLO) đã thêm: {total_mappings_inserted}")

if __name__ == "__main__":
    # Fix for Windows Runtime Error
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed_plos_and_matrix())
