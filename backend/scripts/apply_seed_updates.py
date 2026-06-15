"""Apply mutable GPA fields and grade components from the generated SQL seed."""

import os
import re
import subprocess
import tempfile


def extract_blocks(sql: str, table: str) -> list[str]:
    """Extract idempotent insert blocks for a table from the seed SQL."""
    pattern = rf"(INSERT INTO {table}\b.*?\nON CONFLICT DO NOTHING;)"
    return re.findall(pattern, sql, flags=re.DOTALL)


def main() -> None:
    """Apply mutable seed fields and grade components to the Docker database."""
    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
    seed_path = os.path.join(repo_root, "backend", "db", "init-data.sql")

    with open(seed_path, encoding="utf-8") as seed_file:
        seed_sql = seed_file.read()

    student_block = extract_blocks(seed_sql, "students")[0].replace(
        "ON CONFLICT DO NOTHING;",
        "ON CONFLICT (student_code) DO UPDATE SET "
        "gpa_cumulative = EXCLUDED.gpa_cumulative, updated_at = NOW();",
    )
    enrollment_blocks = [
        block.replace(
            "ON CONFLICT DO NOTHING;",
            "ON CONFLICT (student_id, section_id, attempt_number) DO UPDATE SET "
            "grade_4 = EXCLUDED.grade_4, updated_at = NOW();",
        )
        for block in extract_blocks(seed_sql, "enrollments")
    ]
    component_blocks = extract_blocks(seed_sql, "grade_component_types") + extract_blocks(
        seed_sql, "grade_components"
    )

    update_sql = "\n".join(
        ["BEGIN;", student_block, *enrollment_blocks, *component_blocks, "COMMIT;"]
    )
    with tempfile.NamedTemporaryFile(
        mode="w", encoding="utf-8", suffix=".sql", delete=False
    ) as sql_file:
        sql_file.write(update_sql)
        update_path = sql_file.name

    try:
        with open(update_path, encoding="utf-8") as update_file:
            subprocess.run(
                [
                    "docker",
                    "compose",
                    "exec",
                    "-T",
                    "db",
                    "psql",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-U",
                    "eduinsight",
                    "-d",
                    "eduinsight",
                ],
                cwd=repo_root,
                stdin=update_file,
                check=True,
            )
    finally:
        os.unlink(update_path)


if __name__ == "__main__":
    main()
