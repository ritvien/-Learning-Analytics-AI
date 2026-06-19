"use client"

import { useEffect } from "react"
import { driver } from "driver.js"
import type { DriveStep } from "driver.js"
import "driver.js/dist/driver.css"

import { usePathname } from "next/navigation"

export function OnboardingTour() {
  const pathname = usePathname()

  useEffect(() => {
    // Only run on client
    // const hasSeenTour = localStorage.getItem(`hasSeenTour_${pathname}`)
    // if (hasSeenTour) return

    let steps: DriveStep[] = []

    if (pathname === "/manager") {
      steps = [
        {
          popover: {
            title: "Chào mừng đến với hệ thống EPUInsight!",
            description: "Hãy để chúng tôi hướng dẫn bạn làm quen với trang Tổng quan (Cơ cấu đào tạo).",
            side: "left",
            align: "start"
          }
        },
        {
          element: "#kpi-widgets", // KpiWidgets
          popover: {
            title: "1. Tổng quan các chỉ số (KPI)",
            description: "Theo dõi tình trạng sức khoẻ đào tạo, GPA trung bình và tỷ lệ qua môn ở mức toàn trường ngay tại đây.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "#academic-tree-view", // Tree View
          popover: {
            title: "2. Cây Học Thuật (Academic Tree)",
            description: "Duyệt qua các Khoa và Ngành. Click vào Khoa/Ngành để xem chi tiết Health Score.",
            side: "top",
            align: "start"
          }
        },
        {
          element: ".major-node-item", // A major node
          popover: {
            title: "3. Nhắn tin cùng Chatbot AI",
            description: "Rê chuột vào một Ngành hoặc click chọn để hiển thị biểu tượng Chat AI. Bấm vào để lấy gợi ý phân tích.",
            side: "right",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/analytics/courses")) {
      steps = [
        {
          popover: {
            title: "Phân tích Môn học",
            description: "Trang này giúp bạn đánh giá chi tiết tình hình học tập theo từng môn học.",
            side: "top",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Bảng dữ liệu môn học",
            description: "Bảng này thống kê tỷ lệ trượt môn, mức độ đạt chuẩn đầu ra (CLO) và các điểm mù kiến thức của sinh viên.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/analytics/students")) {
      steps = [
        {
          popover: {
            title: "Quản lý Sinh viên",
            description: "Tra cứu và theo dõi tiến độ của từng sinh viên tại đây.",
            side: "top",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Danh sách Sinh viên",
            description: "Bạn có thể xem GPA, số tín chỉ tích luỹ và dự đoán nguy cơ thôi học của các em.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname === "/manager/analytics") {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Tổng quan toàn trường",
            description: "Bảng phân tích (Dashboard) toàn diện về chất lượng đào tạo của toàn bộ nhà trường.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: ".grid-cols-5, .grid-cols-4",
          popover: {
            title: "Các chỉ số cốt lõi",
            description: "Số lượng sinh viên, Pass rate, GPA trung bình, và lượng sinh viên rơi vào nhóm rủi ro (nguy cơ cảnh báo học vụ).",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: ".recharts-responsive-container",
          popover: {
            title: "Biểu đồ phân tích chuyên sâu",
            description: "Theo dõi xu hướng điểm số qua các học kỳ, phân bố học lực và tỷ lệ sinh viên qua/trượt để đưa ra quyết định.",
            side: "top",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Heatmap & So sánh",
            description: "Bảng dữ liệu Heatmap cho phép bạn so sánh tỷ lệ đạt/trượt chéo giữa các Ngành và Học kỳ một cách trực quan.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/analytics/programs")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Phân tích Ngành đào tạo",
            description: "Đánh giá hiệu quả giảng dạy và chuẩn đầu ra của từng Ngành cụ thể.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: ".recharts-wrapper, .recharts-responsive-container",
          popover: {
            title: "Biểu đồ xu hướng điểm số Ngành",
            description: "Theo dõi sự thay đổi của điểm GPA và Pass rate của Ngành này qua từng năm học.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Chi tiết môn học trong Ngành",
            description: "Tìm ra những môn học đang 'kéo' điểm trung bình của toàn Ngành đi xuống (Điểm mù kiến thức).",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/analytics/sections")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Phân tích Lớp học phần",
            description: "So sánh chất lượng giảng dạy giữa các lớp học phần khác nhau của cùng một môn học.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Bảng điểm lớp học phần",
            description: "Quan sát phổ điểm chi tiết, tỷ lệ sinh viên rớt môn của từng giảng viên phụ trách lớp.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/students")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Hồ sơ Sinh viên",
            description: "Xem và quản lý thông tin lý lịch, tình trạng học tập của toàn bộ sinh viên.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Danh sách hồ sơ",
            description: "Sử dụng tính năng phân trang, bộ lọc để tìm kiếm sinh viên và xem thông tin cá nhân của các em.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/teachers")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Hồ sơ Giảng viên",
            description: "Quản lý danh sách giảng viên, chức danh học thuật và phòng ban/khoa mà họ trực thuộc.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Thông tin Giảng viên",
            description: "Theo dõi số lượng lớp học phần mà giảng viên đang phụ trách.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname === "/manager/courses") {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Danh mục Môn học",
            description: "Quản lý thông tin cấu trúc của các môn học đang được đào tạo.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Bảng môn học",
            description: "Xem số tín chỉ, phân bổ tỷ trọng lý thuyết/thực hành và ma trận Chuẩn đầu ra (CLO) của từng môn.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/grades")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Quản lý Điểm số",
            description: "Tra cứu kết quả học tập chi tiết của từng sinh viên theo môn học.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Bảng điểm thành phần",
            description: "Hiển thị chi tiết điểm Chuyên cần (TX1), Thường xuyên (TX2), Giữa kỳ, Thực hành và Điểm thi Cuối kỳ.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname === "/manager/departments") {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Quản lý Khoa & Ngành",
            description: "Xem và cấu hình danh sách các Khoa và Ngành trong nhà trường.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table, .grid",
          popover: {
            title: "Danh sách Khoa/Ngành",
            description: "Cấu trúc phân cấp quản lý từ cấp Khoa xuống cấp Ngành và Chuyên ngành.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/reports")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Trung tâm Báo cáo",
            description: "Nơi lưu trữ các báo cáo tự động do AI sinh ra.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: ".grid-cols-1, .grid-cols-2, .grid-cols-3, table",
          popover: {
            title: "Danh sách Báo cáo",
            description: "Bạn có thể đọc lại các kết luận, tư vấn can thiệp sư phạm mà AI đã gửi trước đó.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/chat")) {
      steps = [
        {
          popover: {
            title: "Trợ lý AI",
            description: "Trò chuyện với AI để truy vấn dữ liệu, vẽ biểu đồ hoặc yêu cầu đưa ra giải pháp can thiệp sư phạm.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname.includes("/manager/users")) {
      steps = [
        {
          element: "h1",
          popover: {
            title: "Tài khoản & Phân quyền",
            description: "Trang dành cho Quản trị viên hệ thống để cấp quyền truy cập.",
            side: "bottom",
            align: "start"
          }
        },
        {
          element: "table",
          popover: {
            title: "Bảng người dùng",
            description: "Phân quyền Quản lý (Manager), Giảng viên (Lecturer), và Viewer cho các cá nhân phù hợp.",
            side: "top",
            align: "start"
          }
        }
      ]
    } else if (pathname === "/manager/programs") {
      steps = [
        {
          popover: {
            title: "Upload Chương trình đào tạo (CTĐT)",
            description: "Tải lên tài liệu CTĐT để AI tự động trích xuất thông tin, ma trận chuẩn đầu ra và môn học.",
            side: "top",
            align: "start"
          }
        }
      ]
    }

    if (steps.length === 0) return

    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        steps: steps,
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || confirm("Bạn có chắc muốn thoát hướng dẫn?")) {
            driverObj.destroy()
            // localStorage.setItem(`hasSeenTour_${pathname}`, "true")
          }
        },
      })

      driverObj.drive()
    }, 1500) // wait for data to load

    return () => clearTimeout(timer)
  }, [pathname])

  return null
}
