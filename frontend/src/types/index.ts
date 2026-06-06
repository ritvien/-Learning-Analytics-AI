// ===== Student Types =====
export interface Student {
  id: string;
  mssv: string;
  hoTen: string;
  gioiTinh: "Nam" | "Nữ";
  ngayVaoTruong: string;
  khoa: string; // Khóa học (e.g., 2022)
  bacDaoTao: string;
  loaiHinh: string;
  nganh: string;
  chuyenNganh: string;
  khoaQuanLy: string; // Khoa quản lý (Faculty/Department)
  lop: string;
  trangThai: "Đang học" | "Đã tốt nghiệp" | "Bảo lưu" | "Thôi học";
  coVanHocTap: string;
  soDienThoaiCVHT: string;
  tongTCTichLuy: number;
  diemTBTichLuy: number;
  tongTCNo: number;
  soMonNo: number;
}

// ===== Grade Types =====
export interface GradeRecord {
  id: string;
  studentId: string;
  tenMonHoc: string;
  maLop: string;
  tinChi: number;
  diemTX1: number | null;
  diemTX2: number | null;
  diemTX3: number | null;
  diemTX4: number | null;
  tbThuongKy: number | null;
  duocDuThi: boolean;
  diemThiLan1: number | null;
  diemThiLan2: number | null;
  diemTongKet: number | null;
  xepLoai: string; // A+, A, B+, B, C+, C, D+, D, F
  ghiChu: string;
  hocKy: string; // e.g., "HK1 (2022-2023)"
}

// ===== Course Types =====
export interface Course {
  id: string;
  maHocPhan: string;
  tenMonHoc: string;
  tinChi: number;
  khoaQuanLy: string;
  moTa: string;
  trangThai: "Đang giảng dạy" | "Ngừng giảng dạy";
}

// ===== Department Types =====
export interface Department {
  id: string;
  tenKhoa: string;
  moTa: string;
  nganhs: Major[];
}

export interface Major {
  id: string;
  tenNganh: string;
  khoaId: string;
  moTa: string;
}

// ===== Teacher Types =====
export interface Teacher {
  id: string;
  maGV: string;
  hoTen: string;
  email: string;
  soDienThoai: string;
  khoaQuanLy: string;
  chucVu: string;
  trangThai: "Đang công tác" | "Nghỉ phép" | "Đã nghỉ";
}

// ===== User Types =====
export type UserRole = "student" | "teacher" | "manager";

export interface User {
  id: string;
  email: string;
  hoTen: string;
  role: UserRole;
  avatar?: string;
}
