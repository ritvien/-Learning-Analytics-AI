"use client"

import * as React from "react"
import { useEffect } from "react"
import { driver } from "driver.js"
import "driver.js/dist/driver.css"

export function OnboardingTour() {
  useEffect(() => {
    // Only run on client
    // const hasSeenTour = localStorage.getItem("hasSeenOnboardingTour")
    // if (hasSeenTour) return

    const timer = setTimeout(() => {
      const driverObj = driver({
        showProgress: true,
        steps: [
          {
            popover: {
              title: "Chào mừng đến với hệ thống EPUInsight!",
              description: "Hãy để chúng tôi hướng dẫn bạn làm quen với các tính năng chính của hệ thống.",
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
          },
          {
            element: "a[href='/manager/reports'], .app-sidebar", // Báo cáo link
            popover: {
              title: "4. Xem Báo Cáo Tự Động",
              description: "Toàn bộ báo cáo phân tích từ AI sẽ được tổng hợp ở đây để bạn theo dõi.",
              side: "right",
              align: "start"
            }
          }
        ],
        onDestroyStarted: () => {
          if (!driverObj.hasNextStep() || confirm("Bạn có chắc muốn thoát hướng dẫn?")) {
            driverObj.destroy()
            localStorage.setItem("hasSeenOnboardingTour", "true")
          }
        },
      })

      driverObj.drive()
    }, 1500) // wait for data to load

    return () => clearTimeout(timer)
  }, [])

  return null
}
