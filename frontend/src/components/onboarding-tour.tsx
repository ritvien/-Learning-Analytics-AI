"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { driver } from "driver.js"
import type { DriveStep, Driver } from "driver.js"
import "driver.js/dist/driver.css"

import type { ApiUser } from "@/lib/api"

export const START_ONBOARDING_EVENT = "eduinsight:start-onboarding"
const TOUR_VERSION = "v3"
const PAGE_TOUR_VERSION = "v2"

function roleLabel(role: ApiUser["role"]) {
  if (role === "superadmin" || role === "admin") return "quản trị viên"
  if (role === "manager") return "quản lý khoa"
  if (role === "lecturer") return "giảng viên/cố vấn"
  return "người xem"
}

function roleSteps(user: ApiUser): DriveStep[] {
  const commonStart: DriveStep[] = [
    {
      popover: {
        title: `Chào ${user.full_name}`,
        description: `Đây là hướng dẫn nhanh dành cho ${roleLabel(user.role)}. Mỗi bước giải thích chức năng theo công việc thực tế, không thay thế việc kiểm tra số liệu nguồn.`,
      },
    },
    {
      element: "[data-tour='sidebar']",
      popover: {
        title: "Menu theo luồng làm việc",
        description: "Nhóm Ra quyết định dùng để phát hiện vấn đề, Danh mục & Điểm là dữ liệu nền, Báo cáo & Hệ thống dùng để tổng hợp, hỏi AI hoặc quản trị. Tài khoản chỉ thấy chức năng đúng quyền.",
        side: "right",
        align: "start",
      },
    },
  ]

  const management = ["superadmin", "admin", "manager"]
  const isManagement = management.includes(user.role)
  const isAdmin = user.role === "superadmin" || user.role === "admin"
  const isSuperadmin = user.role === "superadmin"
  const isLecturer = user.role === "lecturer"
  const isViewer = user.role === "viewer"
  const features: Array<{ selector: string; title: string; description: string; show: boolean }> = [
    { selector: "nav-overview", title: "Bắt đầu từ tổng quan", description: "Dùng KPI, xu hướng và bộ lọc học kỳ/khoa để nhận diện khu vực cần xem sâu. Đây là màn hình mở đầu cho quản lý, không phải nơi kết luận nguyên nhân.", show: isManagement },
    { selector: "nav-academic-tree", title: "Hiểu cấu trúc đào tạo", description: "Cây đào tạo giúp kiểm tra quan hệ khoa, ngành, môn trước khi so sánh số liệu. Viewer nên bắt đầu ở đây để đọc phạm vi dữ liệu.", show: true },
    { selector: "nav-outcomes", title: "Kiểm tra chuẩn đầu ra", description: "Phân tích CĐR dùng khi cần xem CLO/PLO, mức đạt chuẩn và môn đóng góp yếu. Chỉ đọc cùng cỡ mẫu và cảnh báo dữ liệu.", show: isManagement },
    { selector: "nav-course-analytics", title: "Phân tích theo môn", description: "Dùng khi câu hỏi xoay quanh một môn: tỷ lệ đạt, điểm trung bình, xu hướng nhiều kỳ, lớp lệch chuẩn và bằng chứng CLO.", show: !isViewer },
    { selector: "nav-section-analytics", title: "Phân tích lớp học phần", description: isLecturer ? "Đây là màn hình chính của giảng viên: xem các lớp mình phụ trách, phổ điểm, sinh viên cần hỗ trợ và mở chi tiết lớp." : "Dùng để tìm lớp có tỷ lệ đạt thấp, thiếu điểm hoặc lệch so với các lớp cùng môn rồi mở chi tiết để xem bằng chứng.", show: !isViewer },
    { selector: "nav-advisor", title: "Theo dõi lớp cố vấn", description: "Dùng danh sách này để ưu tiên sinh viên theo GPA, số môn chưa đạt, trạng thái học vụ và tín hiệu ML; mở hồ sơ trước khi tạo can thiệp.", show: !isViewer },
    { selector: "nav-tasks", title: "Đóng vòng can thiệp", description: "Việc cần xử lý là hàng đợi hành động: phân công người phụ trách, ghi nhận định, đặt lịch trao đổi và lưu kết quả hỗ trợ.", show: !isViewer },
    { selector: "nav-students", title: "Tra cứu hồ sơ sinh viên", description: "Danh mục sinh viên là dữ liệu định danh. Muốn đọc điểm, rủi ro hoặc can thiệp thì mở hồ sơ phân tích từ các màn hình analytics.", show: true },
    { selector: "nav-teachers", title: "Quản lý giảng viên và phân công", description: "Dùng để quản lý hồ sơ giảng viên, tài khoản, lớp học phần và lớp chủ nhiệm. Hai loại phân công này độc lập với nhau.", show: isManagement },
    { selector: "nav-courses", title: "Quản lý danh mục môn", description: "Dùng để kiểm tra mã môn, tín chỉ và liên kết CTĐT. Đây là dữ liệu nền, không phải màn hình đánh giá chất lượng môn.", show: true },
    { selector: "nav-sections", title: "Quản lý lớp học phần", description: "Dùng để kiểm tra lớp mở theo học kỳ, môn, lịch học và giảng viên phụ trách trước khi nhập điểm hoặc phân tích lớp.", show: true },
    { selector: "nav-grades", title: "Nhập và kiểm tra điểm", description: "Dùng để nhập/xem điểm, phát hiện dòng thiếu hoặc sai. Cần sửa lỗi dữ liệu trước khi dùng analytics hoặc dự báo ML.", show: true },
    { selector: "nav-departments", title: "Quản lý khoa và ngành", description: "Dùng khi cần cập nhật cấu trúc tổ chức và phạm vi dữ liệu. Thay đổi ở đây có thể ảnh hưởng bộ lọc và quyền manager.", show: isManagement },
    { selector: "nav-chat", title: "Hỏi trợ lý AI đúng cách", description: "Nêu rõ khoa, ngành, học kỳ, môn hoặc lớp cần hỏi. AI hỗ trợ tra cứu và diễn giải, còn số liệu quan trọng phải đối chiếu nguồn.", show: !isViewer },
    { selector: "nav-reports", title: "Tạo báo cáo có đối soát", description: "Trung tâm báo cáo dùng để tạo snapshot, rà soát cảnh báo dữ liệu, chỉnh nội dung và xuất bản báo cáo chính thức.", show: !isViewer },
    { selector: "nav-users", title: "Quản lý tài khoản và phân quyền", description: "Cấp role và phạm vi truy cập theo nguyên tắc quyền tối thiểu; kiểm tra lại bằng tài khoản demo sau khi thay đổi.", show: isAdmin },
    { selector: "nav-observability", title: "Theo dõi vận hành hệ thống", description: "Nhật ký hệ thống giúp superadmin xem phiên sử dụng, lỗi API và hoạt động agent để khoanh vùng sự cố.", show: isSuperadmin },
    { selector: "nav-programs", title: "Quản lý tài liệu CTĐT", description: "Tải và kiểm tra tài liệu chương trình đào tạo dùng cho tra cứu CTĐT/RAG. Sau khi cập nhật nên hỏi thử AI và đối chiếu trích dẫn.", show: isManagement },
  ]

  const visibleFeatures = features.filter((feature) => feature.show)
  return [
    ...commonStart,
    ...visibleFeatures.map<DriveStep>((feature) => ({
      element: `[data-tour='${feature.selector}']`,
      popover: {
        title: feature.title,
        description: feature.description,
        side: "right",
        align: "start",
      },
    })),
    {
      popover: {
        title: "Luồng dùng khuyến nghị",
        description: isLecturer
          ? "Giảng viên nên đi theo chuỗi: Phân tích lớp -> mở sinh viên cần hỗ trợ -> Việc cần xử lý -> Báo cáo hoặc AI khi cần diễn giải."
          : isViewer
            ? "Viewer nên dùng Cây đào tạo và các danh mục để tra cứu cấu trúc, môn, lớp, sinh viên; các thao tác can thiệp và quản trị sẽ không hiển thị."
            : "Quản lý nên đi theo chuỗi: Tổng quan -> phân tích môn/lớp/CĐR -> Việc cần xử lý -> Báo cáo. Quản trị hệ thống chỉ dùng khi cần sửa dữ liệu nền hoặc phân quyền.",
      },
    },
  ]
}

type TourStepConfig = {
  selector?: string
  title: string
  description: string
  side?: "top" | "right" | "bottom" | "left"
  align?: "start" | "center" | "end"
}

type PageGuide = {
  id: string
  title: string
  purpose: string
  steps: TourStepConfig[]
}

function pageGuideFor(pathname: string): PageGuide | null {
  const guides: Array<[boolean, PageGuide]> = [
    [pathname === "/manager/analytics", { id: "overview", title: "Tổng quan học vụ", purpose: "Màn hình này dùng để phát hiện khu vực cần xem sâu, không dùng để kết luận nguyên nhân ngay.", steps: [
      { selector: "[data-tour='page-overview-filters']", title: "Lọc đúng phạm vi trước", description: "Chọn học kỳ và khoa trước khi đọc số liệu. Khi đổi bộ lọc, toàn bộ KPI, biểu đồ và bảng phía dưới đổi theo." },
      { selector: "[data-tour='page-overview-kpis']", title: "Đọc KPI như tín hiệu mở đầu", description: "KPI cho biết quy mô, pass rate, GPA và mức rủi ro tổng. Đây là điểm khởi động để tìm bất thường, không phải bằng chứng cuối." },
      { selector: "[data-tour='page-overview-drilldown']", title: "Đi sâu bằng heatmap", description: "Heatmap ngành theo học kỳ giúp tìm ngành/kỳ có pass rate thấp. Từ đây chuyển sang phân tích môn hoặc lớp để tìm nguyên nhân." },
    ] }],
    [pathname === "/manager", { id: "academic-tree", title: "Cây đào tạo", purpose: "Màn hình này giúp hiểu cấu trúc khoa, ngành, môn trước khi phân tích số liệu.", steps: [
      { selector: "[data-tour='page-tree-structure']", title: "Duyệt cây theo cấp", description: "Mở từng nhánh để đi từ khoa xuống ngành và môn. Chỉ so sánh các node cùng cấp để tránh kết luận sai." },
      { selector: "[data-tour='page-tree-detail']", title: "Đọc panel chi tiết", description: "Panel chi tiết cho biết chỉ số tổng hợp của node đang chọn. Nếu thấy bất thường, mở analytics tương ứng thay vì xử lý ngay tại cây." },
      { selector: "[data-tour='page-tree-ai']", title: "Giữ ngữ cảnh khi hỏi AI", description: "Khi hỏi AI từ cây đào tạo, hãy hỏi theo node đang chọn để trợ lý không lẫn khoa/ngành/môn." },
    ] }],
    [pathname.startsWith("/manager/analytics/outcomes"), { id: "outcomes", title: "Phân tích chuẩn đầu ra", purpose: "Màn hình này dùng để xem CLO/PLO nào yếu và môn nào đang kéo chuẩn đầu ra xuống.", steps: [
      { selector: "[data-tour='page-outcomes-filters']", title: "Chọn chương trình và kỳ", description: "Lọc đúng khoa, ngành, học kỳ và ngưỡng bằng chứng trước khi so sánh CLO/PLO." },
      { selector: "[data-tour='page-outcomes-results']", title: "Đọc chuẩn cùng cỡ mẫu", description: "Tỷ lệ đạt CLO/PLO chỉ có ý nghĩa khi xem cùng cỡ mẫu và cảnh báo dữ liệu. Đừng đọc một phần trăm đơn lẻ." },
      { selector: "[data-tour='page-outcomes-actions']", title: "Mở môn/CLO kéo giảm", description: "Dùng danh sách môn hoặc CLO đóng góp yếu để chuyển sang phân tích môn và lập báo cáo cải tiến." },
    ] }],
    [pathname.startsWith("/manager/analytics/courses"), { id: "course-analytics", title: "Phân tích môn học", purpose: "Màn hình này trả lời câu hỏi một môn đang khỏe/yếu ở đâu qua tỷ lệ đạt, điểm, lớp lệch và CLO.", steps: [
      { selector: "[data-tour='page-course-filters']", title: "Chọn môn và kỳ dữ liệu", description: "Gõ mã/tên môn, sau đó chọn học kỳ và khoa/ngành. Nếu chưa chọn môn, hệ thống chỉ hiển thị danh sách ưu tiên." },
      { selector: "[data-tour='page-course-actions']", title: "Xem môn cần ưu tiên", description: "Danh sách này xếp các môn có tỷ lệ đạt thấp hoặc nhiều lớp lệch. Bấm một môn để chuyển sang phân tích chi tiết." },
      { selector: "[data-tour='page-course-results']", title: "Đọc từng lớp của môn", description: "Bảng lớp học phần cho biết lớp nào lệch, thiếu điểm hoặc có tỷ lệ trượt cao. Từ đây mở chi tiết lớp để xem sinh viên cụ thể." },
    ] }],
    [pathname.startsWith("/manager/analytics/sections/"), { id: "section-detail", title: "Chi tiết lớp học phần", purpose: "Màn hình này đi từ lớp cụ thể xuống bằng chứng sinh viên và hành động hỗ trợ.", steps: [
      { selector: "[data-tour='page-section-detail-summary']", title: "Xác nhận đúng lớp", description: "Kiểm tra mã lớp, môn, học kỳ, tỷ lệ đạt và số sinh viên trước khi đọc rủi ro." },
      { selector: "[data-tour='page-section-detail-results']", title: "Xem nhóm sinh viên cần ưu tiên", description: "Kế hoạch ưu tiên tách sinh viên theo điểm học phần. Đây là danh sách ngắn để giảng viên/cố vấn xem trước." },
      { selector: "[data-tour='page-section-detail-actions']", title: "Chọn hành động tiếp theo", description: "Tạo báo cáo, hỏi AI hoặc mở Việc cần xử lý. Với can thiệp thật, dùng nút Việc cần xử lý để lưu lịch sử." },
    ] }],
    [pathname.startsWith("/manager/analytics/sections"), { id: "section-analytics", title: "Phân tích lớp học phần", purpose: "Màn hình này giúp tìm lớp nào cần xem trước trong phạm vi đang phụ trách.", steps: [
      { selector: "[data-tour='page-section-filters']", title: "Lọc lớp cần xem", description: "Chọn học kỳ, khoa, môn, giảng viên và mức rủi ro. Với lecturer, phạm vi sẽ tự giới hạn về lớp của mình." },
      { selector: "[data-tour='page-section-hotspots']", title: "Top điểm nóng", description: "Ba lớp này có điểm ưu tiên cao nhất. Đây là nơi nên nhìn đầu tiên trước khi xuống bảng dài." },
      { selector: "[data-tour='page-section-actions']", title: "Mở lớp để xử lý", description: "Bảng xếp lớp theo mức rủi ro, số lượt trượt và thiếu điểm. Bấm một dòng để mở chi tiết lớp và tạo can thiệp." },
    ] }],
    [pathname.startsWith("/manager/analytics/students/"), { id: "student-detail", title: "Hồ sơ phân tích sinh viên", purpose: "Màn hình này gom lịch sử học tập, tín hiệu rủi ro và hồ sơ hỗ trợ của một sinh viên.", steps: [
      { selector: "[data-tour='page-student-summary']", title: "Phân biệt dự báo và kết quả", description: "Khối này cho biết tín chỉ có nguy cơ hoặc lý do ML không áp dụng. Luôn đối chiếu với điểm thật bên dưới." },
      { selector: "[data-tour='page-student-risk']", title: "Đọc nhận định cố vấn", description: "Nhận định cố vấn dựa trên GPA và học phần đã học, không phải dự đoán tự động. Đây là phần để hiểu vì sao cần theo dõi." },
      { selector: "[data-tour='page-student-support']", title: "Lưu lịch sử hỗ trợ", description: "Mọi trao đổi, lịch hẹn và follow-up nên đi qua hồ sơ hỗ trợ/Việc cần xử lý để có dấu vết sau này." },
    ] }],
    [pathname.startsWith("/manager/analytics/students"), { id: "advisor", title: "Lớp cố vấn", purpose: "Màn hình này giúp cố vấn ưu tiên sinh viên trong lớp hành chính được phân công.", steps: [
      { selector: "[data-tour='page-advisor-filters']", title: "Chọn lớp cố vấn", description: "Chọn lớp có sinh viên trong dropdown. Lớp trống được ẩn để không làm nhiễu phân tích." },
      { selector: "[data-tour='page-advisor-results']", title: "Đọc danh sách sinh viên", description: "Danh sách ưu tiên GPA, số môn trượt, trạng thái học vụ và tín hiệu ML. Bấm sinh viên để mở hồ sơ chi tiết." },
      { selector: "[data-tour='page-advisor-actions']", title: "Chuyển sang hub can thiệp", description: "Khi cần ghi nhận định, đặt lịch hoặc follow-up, mở Việc cần xử lý để lưu đúng quy trình." },
    ] }],
    [pathname.startsWith("/manager/tasks"), { id: "tasks", title: "Việc cần xử lý", purpose: "Đây là hub để biến cảnh báo thành hành động có người phụ trách và lịch sử.", steps: [
      { selector: "[data-tour='page-tasks-actions']", title: "Đồng bộ hoặc tạo việc", description: "Khu vực này gom việc từ cảnh báo lớp/sinh viên. Cập nhật danh sách trước khi giao việc hoặc gửi thông báo." },
      { selector: "[data-tour='page-tasks-filters']", title: "Tách việc theo trạng thái", description: "Dùng tab và bộ lọc để xem việc mới, đã giao, quá hạn, chờ follow-up hoặc đã đóng." },
      { selector: "[data-tour='page-tasks-results']", title: "Mở từng việc để chốt", description: "Trong từng việc, đọc bằng chứng, giao người phụ trách, thêm nhận định, đặt lịch và chỉ chốt khi muốn ghi vào lịch sử sinh viên." },
    ] }],
    [pathname.startsWith("/manager/students"), { id: "students", title: "Danh mục sinh viên", purpose: "Trang này là danh mục định danh, không phải trang phân tích rủi ro.", steps: [
      { selector: "[data-tour='page-students-filters']", title: "Tìm đúng hồ sơ", description: "Tìm theo mã/tên và lọc theo lớp, ngành, trạng thái để tránh sửa nhầm sinh viên." },
      { selector: "[data-tour='page-students-results']", title: "Đọc dữ liệu hồ sơ", description: "Bảng này phục vụ quản lý thông tin định danh. Điểm, rủi ro và can thiệp nằm ở các màn hình analytics." },
      { selector: "[data-tour='page-students-actions']", title: "Chỉ sửa khi có nguồn", description: "Chỉ cập nhật thông tin có nguồn xác nhận; không suy diễn ngành/chuyên ngành từ tên lớp." },
    ] }],
    [pathname.startsWith("/manager/teachers"), { id: "teachers", title: "Giảng viên và phân công", purpose: "Trang này quản lý hồ sơ giảng viên, tài khoản và hai loại phân công khác nhau.", steps: [
      { selector: "[data-tour='page-teachers-filters']", title: "Lọc hồ sơ giảng viên", description: "Lọc theo khoa và tình trạng dữ liệu để tìm người thiếu tài khoản, môn dạy hoặc lớp chủ nhiệm." },
      { selector: "[data-tour='page-teachers-results']", title: "Phân biệt hai loại phân công", description: "Lớp học phần là môn đang dạy; lớp chủ nhiệm/cố vấn là nhóm sinh viên hành chính. Hai quan hệ này độc lập." },
      { selector: "[data-tour='page-teachers-actions']", title: "Cấp tài khoản và phân lớp", description: "Dùng thao tác trên dòng hoặc panel phân công để cấp account, gán lớp học phần và gán lớp chủ nhiệm đúng khoa." },
    ] }],
    [pathname.startsWith("/manager/courses"), { id: "courses", title: "Danh mục môn học", purpose: "Trang này quản lý dữ liệu nền của môn học.", steps: [
      { selector: "[data-tour='page-courses-filters']", title: "Tìm môn cần sửa", description: "Tìm theo mã/tên và lọc theo khoa/ngành trước khi tạo hoặc sửa môn." },
      { selector: "[data-tour='page-courses-results']", title: "Đọc thông tin danh mục", description: "Bảng cho biết mã môn, tín chỉ và liên kết chương trình. Đây chưa phải phân tích chất lượng môn." },
      { selector: "[data-tour='page-courses-actions']", title: "Kiểm tra sau khi sửa", description: "Sau khi cập nhật danh mục, mở Phân tích môn để kiểm tra dữ liệu học tập liên quan." },
    ] }],
    [pathname.startsWith("/manager/sections"), { id: "sections", title: "Danh mục lớp học phần", purpose: "Trang này quản lý lớp mở theo môn, học kỳ, lịch học và giảng viên.", steps: [
      { selector: "[data-tour='page-sections-filters']", title: "Chọn đúng học kỳ/môn", description: "Lọc học kỳ và môn trước để tránh thao tác nhầm các lớp có mã gần giống nhau." },
      { selector: "[data-tour='page-sections-results']", title: "Kiểm tra lớp mở", description: "Bảng cho biết lớp, môn, học kỳ, giảng viên và quy mô. Đây là dữ liệu nền cho nhập điểm và phân tích lớp." },
      { selector: "[data-tour='page-sections-actions']", title: "Phân công đúng nơi", description: "Phân công giảng viên lớp học phần tại đây; phân công chủ nhiệm/cố vấn làm trong hồ sơ giảng viên." },
    ] }],
    [pathname.startsWith("/manager/grades"), { id: "grades", title: "Nhập và xem điểm", purpose: "Trang này dùng để đồng bộ điểm và kiểm tra dữ liệu thiếu/sai.", steps: [
      { selector: "[data-tour='page-grades-filters']", title: "Chọn lớp trước khi nhập", description: "Chọn đúng lớp học phần. File nhập điểm phải khớp mã sinh viên và mã lớp." },
      { selector: "[data-tour='page-grades-results']", title: "Kiểm tra điểm thành phần", description: "Đối chiếu điểm quá trình, giữa kỳ, thực hành, cuối kỳ và trạng thái thiếu điểm trước khi chạy phân tích." },
      { selector: "[data-tour='page-grades-actions']", title: "Sửa lỗi trước analytics", description: "Nếu import có dòng lỗi hoặc thiếu điểm, sửa tại đây trước khi dùng dashboard hoặc ML." },
    ] }],
    [pathname.startsWith("/manager/departments"), { id: "departments", title: "Khoa và ngành", purpose: "Trang này quản lý cấu trúc tổ chức dùng cho lọc dữ liệu và phân quyền.", steps: [
      { selector: "[data-tour='page-departments-results']", title: "Xem cấu trúc khoa/ngành", description: "Đọc danh sách khoa và ngành trực thuộc để kiểm tra phạm vi dữ liệu." },
      { selector: "[data-tour='page-departments-actions']", title: "Cẩn thận khi sửa cấu trúc", description: "Thay đổi quan hệ khoa/ngành có thể ảnh hưởng bộ lọc analytics và quyền manager." },
    ] }],
    [pathname.startsWith("/manager/reports"), { id: "reports", title: "Trung tâm báo cáo", purpose: "Màn hình này dùng để tạo snapshot báo cáo và đối soát nguồn trước khi xuất bản.", steps: [
      { selector: "[data-tour='page-reports-actions']", title: "Tạo hoặc lên lịch báo cáo", description: "Bấm Tạo báo cáo để chọn mẫu, phạm vi và kỳ dữ liệu. Lịch tự động dùng cho báo cáo định kỳ." },
      { selector: "[data-tour='page-reports-filters']", title: "Lọc thư viện báo cáo", description: "Tìm theo tiêu đề/tóm tắt, loại báo cáo và khoảng kỳ để mở đúng snapshot cần đối soát." },
      { selector: "[data-tour='page-reports-results']", title: "Mở snapshot để kiểm tra", description: "Chọn một báo cáo để xem KPI, cảnh báo chất lượng dữ liệu, nguồn bằng chứng và phần diễn giải AI." },
    ] }],
    [pathname.startsWith("/manager/users"), { id: "users", title: "Tài khoản và phân quyền", purpose: "Trang này dùng để cấp tài khoản, role và phạm vi khoa.", steps: [
      { selector: "[data-tour='page-users-filters']", title: "Tìm tài khoản", description: "Tìm theo email/tên trước khi cấp hoặc đổi quyền để tránh sửa nhầm người dùng." },
      { selector: "[data-tour='page-users-results']", title: "Đọc role và phạm vi", description: "Admin, manager, lecturer và viewer có bề mặt chức năng khác nhau. Kiểm tra cả role lẫn khoa được cấp." },
      { selector: "[data-tour='page-users-actions']", title: "Áp dụng quyền tối thiểu", description: "Chỉ cấp phạm vi cần thiết và kiểm thử lại bằng tài khoản demo sau khi thay đổi." },
    ] }],
    [pathname.startsWith("/manager/observability"), { id: "observability", title: "Nhật ký hệ thống", purpose: "Trang này phục vụ theo dõi phiên sử dụng, lỗi API và hoạt động agent.", steps: [
      { selector: "[data-tour='page-observability-filters']", title: "Khoanh vùng bằng bộ lọc", description: "Lọc theo user, session, route, trạng thái và thời gian để tìm đúng luồng lỗi." },
      { selector: "[data-tour='page-observability-results']", title: "Đọc theo session", description: "Dùng session/trace để nối các sự kiện cùng một luồng thay vì đọc từng dòng riêng lẻ." },
      { selector: "[data-tour='page-observability-actions']", title: "Tạo việc kỹ thuật khi lặp lại", description: "Nếu lỗi lặp lại, mở chi tiết và đối chiếu backend log trước khi tạo việc xử lý." },
    ] }],
    [pathname.startsWith("/manager/programs"), { id: "programs", title: "Quản lý chương trình đào tạo", purpose: "Trang này quản lý tài liệu CTĐT dùng cho tra cứu và RAG.", steps: [
      { selector: "[data-tour='page-programs-upload']", title: "Tải đúng tài liệu", description: "Chọn đúng ngành và phiên bản tài liệu. Tránh tải trùng hoặc tài liệu chưa được phê duyệt." },
      { selector: "[data-tour='page-programs-results']", title: "Kiểm tra trạng thái xử lý", description: "Sau khi upload, kiểm tra trạng thái trích xuất và nội dung trước khi đưa vào tra cứu." },
      { selector: "[data-tour='page-programs-actions']", title: "Đối chiếu bằng AI", description: "Hỏi thử trợ lý AI về CTĐT và kiểm tra trích dẫn sau mỗi lần cập nhật tài liệu." },
    ] }],
    [pathname.startsWith("/chat"), { id: "chat", title: "Trợ lý AI", purpose: "Chat dùng để hỏi dữ liệu và tài liệu theo ngữ cảnh, không thay thế quyết định chuyên môn.", steps: [
      { selector: "[data-tour='page-chat-history']", title: "Chọn hoặc tiếp tục phiên", description: "Mỗi phiên nên giữ một chủ đề để AI không lẫn ngữ cảnh khoa, môn, lớp hoặc sinh viên." },
      { selector: "[data-tour='page-chat-messages']", title: "Kiểm tra nguồn trả lời", description: "Đọc số liệu, công cụ đã dùng và trích dẫn trước khi dùng câu trả lời làm căn cứ." },
      { selector: "[data-tour='page-chat-input']", title: "Hỏi đủ phạm vi", description: "Nêu rõ khoa, ngành, học kỳ, môn, lớp hoặc sinh viên. Nếu cần báo cáo chính thức, chuyển sang Trung tâm báo cáo." },
    ] }],
  ]
  return guides.find(([matches]) => matches)?.[1] ?? null
}

function pageSteps(guide: PageGuide): DriveStep[] {
  return [
    { popover: { title: guide.title, description: guide.purpose } },
    ...guide.steps.map<DriveStep>((step) => ({
      ...(step.selector ? { element: step.selector } : {}),
      popover: {
        title: step.title,
        description: step.description,
        side: step.side ?? (step.selector ? "bottom" : undefined),
        align: step.align ?? (step.selector ? "start" : undefined),
      },
    })),
  ]
}

function stepHasAvailableElement(step: DriveStep) {
  const element = (step as { element?: string | Element }).element
  if (!element || typeof element !== "string") return true
  return Boolean(document.querySelector(element))
}

function fallbackPageStep(guide: PageGuide): DriveStep {
  return {
    popover: {
      title: guide.title,
      description: `${guide.purpose} Trang này chưa có đủ mốc hướng dẫn ổn định, nên hệ thống chỉ hiển thị phần giải thích tổng quan.`,
    },
  }
}

export function OnboardingTour({ user }: { user: ApiUser }) {
  const pathname = usePathname()

  useEffect(() => {
    const globalTourKey = `eduinsight_onboarding_${TOUR_VERSION}_${user.id}`
    const pageGuide = pageGuideFor(pathname)
    const pageTourKey = pageGuide
      ? `eduinsight_page_tour_${PAGE_TOUR_VERSION}_${user.id}_${pageGuide.id}`
      : null
    let activeDriver: Driver | null = null
    let timer: number | null = null
    let activeTourKey = globalTourKey
    const markCompleted = () => localStorage.setItem(activeTourKey, "completed")

    const startTour = (steps: DriveStep[], tourKey: string, force = false) => {
      if (!force && localStorage.getItem(tourKey) === "completed") return
      const visibleSteps = steps.filter(stepHasAvailableElement)
      if (visibleSteps.length === 0) return
      activeDriver?.destroy()
      activeTourKey = tourKey
      activeDriver = driver({
        animate: true,
        smoothScroll: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        overlayClickBehavior: "close",
        showProgress: true,
        progressText: "Bước {{current}}/{{total}}",
        nextBtnText: "Tiếp theo",
        prevBtnText: "Quay lại",
        doneBtnText: "Hoàn tất",
        popoverClass: "eduinsight-onboarding",
        steps: visibleSteps,
        onHighlightStarted: (element) => {
          element?.scrollIntoView({ behavior: "auto", block: "center", inline: "nearest" })
        },
        onPopoverRender: (popover) => {
          popover.closeButton.textContent = "Bỏ qua"
          popover.closeButton.setAttribute("aria-label", "Bỏ qua hướng dẫn")
          popover.closeButton.setAttribute("title", "Bỏ qua hướng dẫn")
        },
        onNextClick: (_element, _step, { driver: tourDriver }) => {
          if (tourDriver.hasNextStep()) {
            tourDriver.moveNext()
            return
          }
          markCompleted()
          tourDriver.destroy()
        },
        onCloseClick: (_element, _step, { driver: tourDriver }) => {
          markCompleted()
          tourDriver.destroy()
        },
        onDestroyed: () => {
          markCompleted()
          activeDriver = null
        },
      })
      activeDriver.drive()
    }

    const restart = () => startTour(roleSteps(user), globalTourKey, true)
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeDriver?.isActive()) return
      markCompleted()
      activeDriver.destroy()
    }
    window.addEventListener(START_ONBOARDING_EVENT, restart)
    window.addEventListener("keydown", handleEscape, true)
    timer = window.setTimeout(() => {
      if (localStorage.getItem(globalTourKey) !== "completed") {
        startTour(roleSteps(user), globalTourKey)
        return
      }
      if (pageGuide && pageTourKey) {
        const steps = pageSteps(pageGuide)
        const visibleSteps = steps.filter(stepHasAvailableElement)
        startTour(visibleSteps.length > 1 ? steps : [fallbackPageStep(pageGuide)], pageTourKey)
      }
    }, 700)

    return () => {
      if (timer !== null) window.clearTimeout(timer)
      window.removeEventListener(START_ONBOARDING_EVENT, restart)
      window.removeEventListener("keydown", handleEscape, true)
      activeDriver?.destroy()
    }
  }, [pathname, user])

  return null
}
