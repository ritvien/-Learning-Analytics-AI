"use client"

import * as React from "react"
import { AcademicTree, type TreeSelection } from "@/components/dashboard/academic-tree"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { api } from "@/lib/api"
import type { Course, Department, GradeRecord, Student } from "@/types"

export default function AcademicTreePage() {
  const [departments, setDepartments] = React.useState<Department[]>([])
  const [students, setStudents] = React.useState<Student[]>([])
  const [courses, setCourses] = React.useState<Course[]>([])
  const [grades, setGrades] = React.useState<GradeRecord[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [selection, setSelection] = React.useState<TreeSelection | null>(null)

  React.useEffect(() => {
    let active = true
    async function loadData() {
      try {
        setIsLoading(true)
        const [deptsRes, programsRes, studentsRes, coursesRes, gradesRes] = await Promise.all([
          api.getDepartments(),
          api.getPrograms({ limit: 500 }),
          api.getStudents(),
          api.getCourses(),
          api.getGrades(),
        ])
        if (active) {
          const departmentNameById = new Map(deptsRes.map((department) => [department.id, department.name]))
          const programNameById = new Map(programsRes.map((program) => [program.id, program.name]))
          const departmentByProgramId = new Map(
            programsRes.map((program) => [program.id, departmentNameById.get(program.department_id) ?? "Chưa rõ khoa"]),
          )
          setDepartments(
            deptsRes.map((department) => ({
              id: String(department.id),
              tenKhoa: department.name,
              moTa: department.description ?? "",
              nganhs: programsRes
                .filter((program) => program.department_id === department.id)
                .map((program) => ({
                  id: String(program.id),
                  tenNganh: program.name,
                  khoaId: String(department.id),
                  moTa: program.description ?? program.code,
                })),
            })),
          )
          setStudents(
            studentsRes.map((student) => ({
              id: String(student.id),
              mssv: student.student_code,
              hoTen: student.full_name,
              gioiTinh: student.gender === "Nữ" ? "Nữ" : "Nam",
              ngayVaoTruong: "",
              khoa: String(student.cohort_id),
              bacDaoTao: "",
              loaiHinh: "",
              nganh: programNameById.get(student.program_id) ?? "Chưa rõ ngành",
              chuyenNganh: "",
              khoaQuanLy: departmentByProgramId.get(student.program_id) ?? "Chưa rõ khoa",
              lop: student.class_code ?? "",
              trangThai: student.status === "active" ? "Đang học" : "Thôi học",
              coVanHocTap: "",
              soDienThoaiCVHT: "",
              tongTCTichLuy: 0,
              diemTBTichLuy: student.gpa_cumulative ?? 0,
              tongTCNo: 0,
              soMonNo: 0,
            })),
          )
          setCourses(
            coursesRes.map((course) => {
              const programId = course.program_ids[0]
              return {
                id: String(course.id),
                maHocPhan: course.code,
                tenMonHoc: course.name,
                tinChi: course.credits,
                khoaQuanLy: programId ? departmentByProgramId.get(programId) ?? "Chưa rõ khoa" : "Chưa rõ khoa",
                moTa: course.description ?? "",
                trangThai: course.is_active ? "Đang giảng dạy" : "Ngừng giảng dạy",
              }
            }),
          )
          setGrades(gradesRes)
          if (deptsRes.length > 0) {
            setSelection({
              id: String(deptsRes[0].id),
              type: "department",
            })
          }
          setIsLoading(false)
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || "Không thể tải dữ liệu từ API")
          setIsLoading(false)
        }
      }
    }
    loadData()
    return () => {
      active = false
    }
  }, [])

  const studentCountByMajor = React.useMemo(() => {
    return departments.reduce<Record<string, number>>((acc, department) => {
      department.nganhs.forEach((major) => {
        acc[major.id] = students.filter((student) => student.nganh === major.tenNganh).length
      })
      return acc
    }, {})
  }, [departments, students])

  const courseCountByDepartment = React.useMemo(() => {
    return departments.reduce<Record<string, number>>((acc, department) => {
      acc[department.id] = courses.filter((course) => course.khoaQuanLy === department.tenKhoa).length
      return acc
    }, {})
  }, [departments, courses])

  const selectedDepartment = React.useMemo(() => {
    if (!selection) return undefined
    return departments.find((item) => item.id === selection.id)
  }, [selection, departments])

  const selectedMajor = React.useMemo(() => {
    if (!selection) return undefined
    return departments.flatMap((item) => item.nganhs).find((major) => major.id === selection.id)
  }, [selection, departments])

  const studentIds = React.useMemo(() => {
    if (!selection) return []
    if (selection.type === "major" && selectedMajor) {
      return students.filter((student) => student.nganh === selectedMajor.tenNganh).map((student) => student.id)
    }
    if (selection.type === "department" && selectedDepartment) {
      return students.filter((student) => student.khoaQuanLy === selectedDepartment.tenKhoa).map((student) => student.id)
    }
    return []
  }, [selection, selectedMajor, selectedDepartment, students])

  const averageGpa = React.useMemo(() => {
    const relevantStudents = students.filter((student) => studentIds.includes(student.id))
    if (relevantStudents.length === 0) return 0
    return (
      relevantStudents.reduce((sum, student) => sum + student.diemTBTichLuy, 0) / relevantStudents.length
    )
  }, [studentIds, students])

  const failRate = React.useMemo(() => {
    const relevantGrades = grades.filter((grade) => studentIds.includes(grade.studentId))
    if (relevantGrades.length === 0) return 0
    const failed = relevantGrades.filter((grade) => {
      return grade.xepLoai === "F" || (grade.diemTongKet !== null && grade.diemTongKet < 5)
    }).length
    return (failed / relevantGrades.length) * 100
  }, [studentIds, grades])

  const topInsights = React.useMemo(() => {
    if (!selection) return ["Chưa có dữ liệu để hiển thị insight."]
    if (selection.type === "major" && selectedMajor) {
      return [
        `Ngành ${selectedMajor.tenNganh} cần chú ý hỗ trợ thêm môn cốt lõi`,
        `Cần áp dụng mentoring cho ${studentCountByMajor[selectedMajor.id] ?? 0} SV`,
      ]
    }
    if (selection.type === "department" && selectedDepartment) {
      return [
        `Khoa ${selectedDepartment.tenKhoa} đang quản lý ${courseCountByDepartment[selectedDepartment.id] ?? 0} môn`,
        `Triển khai dashboard KPI cho ${students.filter((student) => student.khoaQuanLy === selectedDepartment.tenKhoa).length} SV`,
      ]
    }
    return ["Chưa có dữ liệu để hiển thị insight."]
  }, [selection, selectedDepartment, selectedMajor, courseCountByDepartment, studentCountByMajor, students])

  const courseCount = React.useMemo(() => {
    if (!selection) return 0
    const selectedDepartmentForCourses =
      selectedMajor
        ? departments.find((department) => department.nganhs.some((major) => major.id === selectedMajor.id))
        : selectedDepartment

    if (!selectedDepartmentForCourses) return 0
    return courses.filter((course) => course.khoaQuanLy === selectedDepartmentForCourses.tenKhoa).length
  }, [selection, selectedMajor, selectedDepartment, departments, courses])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic Tree</CardTitle>
            <p className="text-muted-foreground">Tạo góc nhìn học thuật cho khoa và ngành với dữ liệu thực tế từ API.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Bạn có thể mở rộng/collapse từng khoa và chọn một ngành để xem điểm số, tỷ lệ trượt và KPI.</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-border bg-muted/20">
          <div className="text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mx-auto"></div>
            <p className="mt-2 text-sm text-muted-foreground">Đang tải dữ liệu học thuật...</p>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-destructive">
          <p className="font-semibold">Đã xảy ra lỗi khi tải dữ liệu</p>
          <p className="text-sm mt-1">{error}</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
          <AcademicTree
            departments={departments}
            studentCountByMajor={studentCountByMajor}
            courseCountByDepartment={courseCountByDepartment}
            selected={selection || { id: "", type: "department" }}
            onSelect={setSelection}
          />

          <DetailPanel
            title={selectedMajor ? selectedMajor.tenNganh : selectedDepartment?.tenKhoa ?? "Chưa chọn"}
            subtitle={selectedMajor ? selectedMajor.moTa : selectedDepartment?.moTa ?? "Chọn một khoa hoặc ngành để xem chi tiết."}
            studentCount={studentIds.length}
            averageGpa={averageGpa}
            failRate={failRate}
            courseCount={courseCount}
            topInsights={topInsights}
          />
        </div>
      )}
    </div>
  )
}

