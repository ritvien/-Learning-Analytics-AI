import type { Student, Course, Teacher, Department, Major, GradeRecord } from "@/types"

// ===== MOCK: Departments =====
export const mockDepartments: Department[] = [
  {
    id: "dept-1",
    tenKhoa: "Khoa Công nghệ Thông tin",
    moTa: "Đào tạo CNTT, An toàn thông tin, TMĐT",
    nganhs: [
      { id: "major-1", tenNganh: "Công nghệ thông tin", khoaId: "dept-1", moTa: "Ngành CNTT cốt lõi" },
      { id: "major-2", tenNganh: "Hệ thống thương mại điện tử", khoaId: "dept-1", moTa: "CNTT ứng dụng TMĐT" },
      { id: "major-3", tenNganh: "An toàn thông tin", khoaId: "dept-1", moTa: "Bảo mật hệ thống" },
    ],
  },
  {
    id: "dept-2",
    tenKhoa: "Khoa Điện",
    moTa: "Đào tạo kỹ thuật điện, hệ thống điện",
    nganhs: [
      { id: "major-4", tenNganh: "Kỹ thuật điện", khoaId: "dept-2", moTa: "Điện công nghiệp" },
      { id: "major-5", tenNganh: "Hệ thống điện", khoaId: "dept-2", moTa: "Lưới điện" },
    ],
  },
  {
    id: "dept-3",
    tenKhoa: "Khoa Điện tử - Viễn thông",
    moTa: "Đào tạo điện tử, viễn thông",
    nganhs: [
      { id: "major-6", tenNganh: "Kỹ thuật điện tử - viễn thông", khoaId: "dept-3", moTa: "Viễn thông và mạng" },
    ],
  },
  {
    id: "dept-4",
    tenKhoa: "Khoa Cơ khí",
    moTa: "Đào tạo kỹ thuật cơ khí",
    nganhs: [
      { id: "major-7", tenNganh: "Kỹ thuật cơ khí", khoaId: "dept-4", moTa: "Cơ khí chế tạo" },
      { id: "major-8", tenNganh: "Kỹ thuật nhiệt", khoaId: "dept-4", moTa: "Nhiệt - Lạnh" },
    ],
  },
]

// ===== MOCK: Students (based on real PTH sample) =====
export const mockStudents: Student[] = [
  {
    id: "sv-1", mssv: "22810340001", hoTen: "Phạm Tiến Hưng", gioiTinh: "Nam",
    ngayVaoTruong: "28/09/2022", khoa: "2022", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Công nghệ thông tin", chuyenNganh: "Hệ thống thương mại điện tử",
    khoaQuanLy: "Khoa Công nghệ Thông tin", lop: "D17HTTMDT", trangThai: "Đang học",
    coVanHocTap: "Đào Nam Anh", soDienThoaiCVHT: "0915123418",
    tongTCTichLuy: 105, diemTBTichLuy: 3.15, tongTCNo: 0, soMonNo: 0,
  },
  {
    id: "sv-2", mssv: "22810340002", hoTen: "Nguyễn Việt Hoàng", gioiTinh: "Nam",
    ngayVaoTruong: "28/09/2022", khoa: "2022", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Công nghệ thông tin", chuyenNganh: "Công nghệ thông tin",
    khoaQuanLy: "Khoa Công nghệ Thông tin", lop: "D17CNTT1", trangThai: "Đang học",
    coVanHocTap: "Nguyễn Văn B", soDienThoaiCVHT: "0912345678",
    tongTCTichLuy: 98, diemTBTichLuy: 2.85, tongTCNo: 3, soMonNo: 1,
  },
  {
    id: "sv-3", mssv: "22810340003", hoTen: "Phạm Minh Hiếu", gioiTinh: "Nam",
    ngayVaoTruong: "28/09/2022", khoa: "2022", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Công nghệ thông tin", chuyenNganh: "An toàn thông tin",
    khoaQuanLy: "Khoa Công nghệ Thông tin", lop: "D17ATTT", trangThai: "Đang học",
    coVanHocTap: "Trần Văn C", soDienThoaiCVHT: "0987654321",
    tongTCTichLuy: 110, diemTBTichLuy: 3.42, tongTCNo: 0, soMonNo: 0,
  },
  {
    id: "sv-4", mssv: "21810220015", hoTen: "Lê Thị Mai", gioiTinh: "Nữ",
    ngayVaoTruong: "15/09/2021", khoa: "2021", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Kỹ thuật điện", chuyenNganh: "Hệ thống điện",
    khoaQuanLy: "Khoa Điện", lop: "D16HTD", trangThai: "Đang học",
    coVanHocTap: "Phạm Văn D", soDienThoaiCVHT: "0901234567",
    tongTCTichLuy: 125, diemTBTichLuy: 3.05, tongTCNo: 6, soMonNo: 2,
  },
  {
    id: "sv-5", mssv: "23810340010", hoTen: "Trần Quốc Bảo", gioiTinh: "Nam",
    ngayVaoTruong: "20/09/2023", khoa: "2023", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Công nghệ thông tin", chuyenNganh: "Công nghệ thông tin",
    khoaQuanLy: "Khoa Công nghệ Thông tin", lop: "D18CNTT2", trangThai: "Đang học",
    coVanHocTap: "Đào Nam Anh", soDienThoaiCVHT: "0915123418",
    tongTCTichLuy: 45, diemTBTichLuy: 2.65, tongTCNo: 9, soMonNo: 3,
  },
  {
    id: "sv-6", mssv: "20810220005", hoTen: "Nguyễn Thị Hồng", gioiTinh: "Nữ",
    ngayVaoTruong: "10/09/2020", khoa: "2020", bacDaoTao: "Đại học - Tín chỉ",
    loaiHinh: "Chính quy", nganh: "Kỹ thuật cơ khí", chuyenNganh: "Kỹ thuật cơ khí",
    khoaQuanLy: "Khoa Cơ khí", lop: "D15CK", trangThai: "Đã tốt nghiệp",
    coVanHocTap: "Lê Văn E", soDienThoaiCVHT: "0945678901",
    tongTCTichLuy: 150, diemTBTichLuy: 3.55, tongTCNo: 0, soMonNo: 0,
  },
]

// ===== MOCK: Courses =====
export const mockCourses: Course[] = [
  { id: "c-1", maHocPhan: "CS101", tenMonHoc: "Lập trình C", tinChi: 3, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "Lập trình cơ bản C", trangThai: "Đang giảng dạy" },
  { id: "c-2", maHocPhan: "CS201", tenMonHoc: "Cơ sở dữ liệu", tinChi: 3, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "SQL, thiết kế CSDL", trangThai: "Đang giảng dạy" },
  { id: "c-3", maHocPhan: "CS301", tenMonHoc: "Mạng máy tính", tinChi: 3, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "TCP/IP, mạng LAN/WAN", trangThai: "Đang giảng dạy" },
  { id: "c-4", maHocPhan: "MATH101", tenMonHoc: "Giải tích 1", tinChi: 3, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "Đạo hàm, tích phân", trangThai: "Đang giảng dạy" },
  { id: "c-5", maHocPhan: "MATH201", tenMonHoc: "Giải tích 2", tinChi: 3, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "Tích phân bội, chuỗi", trangThai: "Đang giảng dạy" },
  { id: "c-6", maHocPhan: "PHY101", tenMonHoc: "Vật lý đại cương", tinChi: 4, khoaQuanLy: "Khoa Điện", moTa: "Cơ học, nhiệt, điện", trangThai: "Đang giảng dạy" },
  { id: "c-7", maHocPhan: "EE201", tenMonHoc: "Mạch điện 1", tinChi: 3, khoaQuanLy: "Khoa Điện", moTa: "Phân tích mạch điện DC/AC", trangThai: "Đang giảng dạy" },
  { id: "c-8", maHocPhan: "PE101", tenMonHoc: "Giáo dục thể chất 1", tinChi: 1, khoaQuanLy: "Khoa Công nghệ Thông tin", moTa: "Thể dục cơ bản", trangThai: "Đang giảng dạy" },
]

// ===== MOCK: Teachers =====
export const mockTeachers: Teacher[] = [
  { id: "gv-1", maGV: "GV001", hoTen: "Đào Nam Anh", email: "dna@epu.edu.vn", soDienThoai: "0915123418", khoaQuanLy: "Khoa Công nghệ Thông tin", chucVu: "Giảng viên", trangThai: "Đang công tác" },
  { id: "gv-2", maGV: "GV002", hoTen: "Nguyễn Văn Bình", email: "nvb@epu.edu.vn", soDienThoai: "0912345678", khoaQuanLy: "Khoa Công nghệ Thông tin", chucVu: "Phó khoa", trangThai: "Đang công tác" },
  { id: "gv-3", maGV: "GV003", hoTen: "Trần Thị Cúc", email: "ttc@epu.edu.vn", soDienThoai: "0987654321", khoaQuanLy: "Khoa Điện", chucVu: "Trưởng khoa", trangThai: "Đang công tác" },
  { id: "gv-4", maGV: "GV004", hoTen: "Phạm Văn Dũng", email: "pvd@epu.edu.vn", soDienThoai: "0901234567", khoaQuanLy: "Khoa Cơ khí", chucVu: "Giảng viên", trangThai: "Đang công tác" },
]

// ===== MOCK: Grades =====
export const mockGrades: GradeRecord[] = [
  {
    id: "g-1", studentId: "sv-1", tenMonHoc: "Lập trình C", maLop: "CS101-01",
    tinChi: 3, diemTX1: 8, diemTX2: 9, diemTX3: null, diemTX4: null,
    tbThuongKy: 8.5, duocDuThi: true, diemThiLan1: 8.0, diemThiLan2: null,
    diemTongKet: 8.2, xepLoai: "B+", ghiChu: "", hocKy: "HK1 (2022-2023)"
  },
  {
    id: "g-2", studentId: "sv-1", tenMonHoc: "Cơ sở dữ liệu", maLop: "CS201-02",
    tinChi: 3, diemTX1: 7, diemTX2: 7, diemTX3: 8, diemTX4: null,
    tbThuongKy: 7.3, duocDuThi: true, diemThiLan1: 6.5, diemThiLan2: null,
    diemTongKet: 6.8, xepLoai: "C+", ghiChu: "", hocKy: "HK2 (2022-2023)"
  },
  {
    id: "g-3", studentId: "sv-2", tenMonHoc: "Giải tích 1", maLop: "MATH101-01",
    tinChi: 3, diemTX1: 5, diemTX2: 6, diemTX3: null, diemTX4: null,
    tbThuongKy: 5.5, duocDuThi: true, diemThiLan1: 3.0, diemThiLan2: 4.5,
    diemTongKet: 4.8, xepLoai: "D", ghiChu: "Thi lại", hocKy: "HK1 (2022-2023)"
  },
  {
    id: "g-4", studentId: "sv-2", tenMonHoc: "Mạng máy tính", maLop: "CS301-01",
    tinChi: 3, diemTX1: 0, diemTX2: 0, diemTX3: null, diemTX4: null,
    tbThuongKy: 0, duocDuThi: false, diemThiLan1: null, diemThiLan2: null,
    diemTongKet: 0, xepLoai: "F", ghiChu: "Cấm thi do vắng", hocKy: "HK2 (2022-2023)"
  },
  {
    id: "g-5", studentId: "sv-3", tenMonHoc: "Vật lý đại cương", maLop: "PHY101-03",
    tinChi: 4, diemTX1: 9, diemTX2: 9, diemTX3: 10, diemTX4: null,
    tbThuongKy: 9.3, duocDuThi: true, diemThiLan1: 9.5, diemThiLan2: null,
    diemTongKet: 9.4, xepLoai: "A+", ghiChu: "", hocKy: "HK1 (2022-2023)"
  }
]
