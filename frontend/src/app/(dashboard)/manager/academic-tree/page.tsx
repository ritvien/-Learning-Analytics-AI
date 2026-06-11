"use client"

import * as React from "react"
import { AcademicTree, type TreeSelection } from "@/components/dashboard/academic-tree"
import { DetailPanel } from "@/components/dashboard/detail-panel"
import { mockCourses, mockDepartments, mockGrades, mockStudents } from "@/lib/mock-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function AcademicTreePage() {
  const [selection, setSelection] = React.useState<TreeSelection>(() => ({
    id: mockDepartments[0]?.id ?? "",
    type: "department",
  }))

  const studentCountByMajor = React.useMemo(() => {
    return mockDepartments.reduce<Record<string, number>>((acc, department) => {
      department.nganhs.forEach((major) => {
        acc[major.id] = mockStudents.filter((student) => student.nganh === major.tenNganh).length
      })
      return acc
    }, {})
  }, [])

  const courseCountByDepartment = React.useMemo(() => {
    return mockDepartments.reduce<Record<string, number>>((acc, department) => {
      acc[department.id] = mockCourses.filter((course) => course.khoaQuanLy === department.tenKhoa).length
      return acc
    }, {})
  }, [])

  const selectedDepartment = mockDepartments.find((item) => item.id === selection.id)
  const selectedMajor = mockDepartments.flatMap((item) => item.nganhs).find((major) => major.id === selection.id)

  const studentIds = React.useMemo(() => {
    if (selection.type === "major" && selectedMajor) {
      return mockStudents.filter((student) => student.nganh === selectedMajor.tenNganh).map((student) => student.id)
    }
    if (selection.type === "department" && selectedDepartment) {
      return mockStudents.filter((student) => student.khoaQuanLy === selectedDepartment.tenKhoa).map((student) => student.id)
    }
    return []
  }, [selection, selectedMajor, selectedDepartment])

  const averageGpa = React.useMemo(() => {
    const relevantStudents = mockStudents.filter((student) => studentIds.includes(student.id))
    if (relevantStudents.length === 0) return 0
    return (
      relevantStudents.reduce((sum, student) => sum + student.diemTBTichLuy, 0) / relevantStudents.length
    )
  }, [studentIds])

  const failRate = React.useMemo(() => {
    const relevantGrades = mockGrades.filter((grade) => studentIds.includes(grade.studentId))
    if (relevantGrades.length === 0) return 0
    const failed = relevantGrades.filter((grade) => {
      return grade.xepLoai === "F" || (grade.diemTongKet !== null && grade.diemTongKet < 5)
    }).length
    return (failed / relevantGrades.length) * 100
  }, [studentIds])

  const topInsights = React.useMemo(() => {
    if (selection.type === "major" && selectedMajor) {
      return [
        `Ngành ${selectedMajor.tenNganh} cần chú ý hỗ trợ thêm môn cốt lõi`,
        `Cần áp dụng mentoring cho ${studentCountByMajor[selectedMajor.id] ?? 0} SV`,
      ]
    }
    if (selection.type === "department" && selectedDepartment) {
      return [
        `Khoa ${selectedDepartment.tenKhoa} đang quản lý ${courseCountByDepartment[selectedDepartment.id] ?? 0} môn`,
        `Triển khai dashboard KPI cho ${mockStudents.filter((student) => student.khoaQuanLy === selectedDepartment.tenKhoa).length} SV`,
      ]
    }
    return ["Chưa có dữ liệu để hiển thị insight."]
  }, [selection, selectedDepartment, selectedMajor, courseCountByDepartment, studentCountByMajor])

  const courseCount = React.useMemo(() => {
    const selectedDepartmentForCourses =
      selectedMajor
        ? mockDepartments.find((department) => department.nganhs.some((major) => major.id === selectedMajor.id))
        : selectedDepartment

    if (!selectedDepartmentForCourses) return 0
    return mockCourses.filter((course) => course.khoaQuanLy === selectedDepartmentForCourses.tenKhoa).length
  }, [selection, selectedMajor, selectedDepartment])

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Card>
          <CardHeader>
            <CardTitle>Academic Tree</CardTitle>
            <p className="text-muted-foreground">Tạo góc nhìn học thuật cho khoa và ngành với dữ liệu mô phỏng.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Bạn có thể mở rộng/collapse từng khoa và chọn một ngành để xem điểm số, tỷ lệ trượt và KPI.</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr]">
        <AcademicTree
          departments={mockDepartments}
          studentCountByMajor={studentCountByMajor}
          courseCountByDepartment={courseCountByDepartment}
          selected={selection}
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
    </div>
  )
}
