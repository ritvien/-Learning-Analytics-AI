param(
    [switch]$Yes
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot

if (-not $Yes) {
    Write-Host "This will remove the local Docker Postgres volume and rebuild seed data."
    Write-Host "Re-run with: powershell -ExecutionPolicy Bypass -File scripts\reset_local_db.ps1 -Yes"
    exit 1
}

Push-Location $root
try {
    docker compose down -v
    docker compose up -d --build db backend

    $deadline = (Get-Date).AddMinutes(3)
    do {
        Start-Sleep -Seconds 3
        $health = docker inspect --format='{{.State.Health.Status}}' c2-app-056-backend-1 2>$null
        if ($health -eq "healthy") { break }
    } while ((Get-Date) -lt $deadline)

    docker compose ps
    docker compose exec -T backend alembic current
    docker compose exec -T backend python -m app.analytics.etl
    docker compose exec -T db psql -U eduinsight -d eduinsight -c "
        SELECT 'departments' AS table_name, COUNT(*) FROM departments
        UNION ALL SELECT 'programs', COUNT(*) FROM programs
        UNION ALL SELECT 'courses', COUNT(*) FROM courses
        UNION ALL SELECT 'students', COUNT(*) FROM students
        UNION ALL SELECT 'enrollments', COUNT(*) FROM enrollments
        UNION ALL SELECT 'grade_components', COUNT(*) FROM grade_components
        UNION ALL SELECT 'student_clo_achievements', COUNT(*) FROM student_clo_achievements
        UNION ALL SELECT 'dwh.fact_enrollment_outcome', COUNT(*) FROM dwh.fact_enrollment_outcome
        UNION ALL SELECT 'dwh.fact_grade_component', COUNT(*) FROM dwh.fact_grade_component
        UNION ALL SELECT 'dwh.fact_clo_achievement', COUNT(*) FROM dwh.fact_clo_achievement
        ORDER BY table_name;
    "
}
finally {
    Pop-Location
}
