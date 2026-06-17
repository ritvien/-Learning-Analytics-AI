import { ApiStudent, ApiDepartment, ApiProgram, ApiCourse, ApiEnrollment } from "./api";
import { Student, Department, Course, GradeRecord } from "@/types";

export function mapApiStudentToFeStudent(apiStudent: ApiStudent, apiPrograms: ApiProgram[], apiDepartments: ApiDepartment[]): Student {
  let status: Student["trangThai"] = "Đang học";
  if (apiStudent.status === "graduated") status = "Đã tốt nghiệp";
  else if (apiStudent.status === "suspended") status = "Bảo lưu";
  else if (apiStudent.status === "dropped") status = "Thôi học";

  const program = apiPrograms.find(p => p.id === apiStudent.program_id);
  const department = program ? apiDepartments.find(d => d.id === program.department_id) : null;

  return {
    id: apiStudent.id.toString(),
    mssv: apiStudent.student_code,
    hoTen: apiStudent.full_name,
    gioiTinh: apiStudent.gender === "Female" ? "Nữ" : "Nam",
    ngayVaoTruong: "N/A",
    khoa: `K${apiStudent.cohort_id}`,
    bacDaoTao: "Đại học chính quy",
    loaiHinh: "Chính quy",
    nganh: program ? program.name : `Program ${apiStudent.program_id}`,
    chuyenNganh: "",
    khoaQuanLy: department ? department.name : "",
    lop: apiStudent.class_code || "",
    trangThai: status,
    coVanHocTap: "N/A",
    soDienThoaiCVHT: "",
    tongTCTichLuy: 0,
    diemTBTichLuy: apiStudent.gpa_cumulative || 0,
    tongTCNo: 0,
    soMonNo: 0,
  };
}

export function mapApiDeptToFeDept(apiDept: ApiDepartment, apiPrograms: ApiProgram[]): Department {
  const departmentPrograms = apiPrograms.filter(p => p.department_id === apiDept.id);
  return {
    id: apiDept.id.toString(),
    tenKhoa: apiDept.name,
    moTa: apiDept.description || "",
    nganhs: departmentPrograms.map(p => ({
      id: p.id.toString(),
      tenNganh: p.name,
      khoaId: apiDept.id.toString(),
      moTa: p.description || "",
    })),
  };
}

export function mapApiCourseToFeCourse(apiCourse: ApiCourse, apiPrograms: ApiProgram[], apiDepartments: ApiDepartment[]): Course {
  let khoaQuanLy = "";
  if (apiCourse.program_ids && apiCourse.program_ids.length > 0) {
    const program = apiPrograms.find(p => p.id === apiCourse.program_ids[0]);
    const department = program ? apiDepartments.find(d => d.id === program.department_id) : null;
    if (department) {
      khoaQuanLy = department.name;
    }
  }

  return {
    id: apiCourse.id.toString(),
    maHocPhan: apiCourse.code,
    tenMonHoc: apiCourse.name,
    tinChi: apiCourse.credits,
    khoaQuanLy,
    moTa: apiCourse.description || "",
    trangThai: apiCourse.is_active ? "Đang giảng dạy" : "Ngừng giảng dạy",
  };
}

export function mapApiEnrollmentToFeGrade(apiEnrollment: ApiEnrollment): GradeRecord {
  return {
    id: apiEnrollment.id.toString(),
    studentId: apiEnrollment.student_id.toString(),
    tenMonHoc: "", // Cannot get from Enrollment alone, mock or require mapping
    maLop: apiEnrollment.section_id.toString(),
    tinChi: 0,
    diemTX1: null,
    diemTX2: null,
    diemTX3: null,
    diemTX4: null,
    tbThuongKy: null,
    duocDuThi: true,
    diemThiLan1: null,
    diemThiLan2: null,
    diemTongKet: apiEnrollment.final_grade,
    xepLoai: apiEnrollment.grade_letter || "N/A",
    ghiChu: apiEnrollment.status,
    hocKy: "",
  };
}
