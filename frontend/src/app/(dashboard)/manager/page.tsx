"use client"

import * as React from "react"
import { useState } from "react"
import { ChevronDown, ChevronUp, Network, School } from "lucide-react"
import { mockDepartments } from "@/lib/mock-data"

export default function ManagerDashboard() {
  const [expandedDepts, setExpandedDepts] = useState<Record<string, boolean>>({})

  const toggleDept = (id: string) => {
    setExpandedDepts((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  const toggleAll = (expand: boolean) => {
    const next: Record<string, boolean> = {}
    if (expand) mockDepartments.forEach((d) => { next[d.id] = true })
    setExpandedDepts(next)
  }

  return (
    <div className="flex flex-col w-full bg-background text-foreground transition-colors duration-300 rounded-xl border border-border/50 shadow-sm p-4">
      
      {/* ── Dashboard Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-3 shrink-0">
        <div>
          <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Network className="h-4.5 w-4.5 text-primary" />
            Cơ cấu tổ chức đào tạo
          </h1>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Sơ đồ hình cây phân cấp khoa và ngành học tại Trường Đại học Điện Lực
          </p>
        </div>

        {/* ── Toolbar ── */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          <button
            onClick={() => toggleAll(true)}
            className="px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all cursor-pointer"
          >
            Mở rộng tất cả
          </button>
          <button
            onClick={() => toggleAll(false)}
            className="px-2.5 py-1.5 text-[10px] font-semibold rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground border border-border shadow-sm transition-all cursor-pointer"
          >
            Thu gọn tất cả
          </button>
        </div>
      </div>

      {/* ── Tree View Area ── */}
      <div className="flex-1 flex flex-col items-center mt-4 w-full overflow-hidden">
        
        {/* ── EPU Root Node ── */}
        <div className="flex flex-col items-center select-none shrink-0">
          <div
            className="px-8 py-2 rounded-full font-black text-base tracking-[0.2em] text-white
                        bg-gradient-to-r from-red-600 via-orange-500 to-amber-500
                        shadow-[0_2px_10px_rgba(239,68,68,0.2)] border border-white/10 flex items-center gap-1.5"
          >
            <School className="h-4 w-4" />
            EPU
          </div>
          <div className="mt-1 text-center">
            <p className="text-[10px] font-bold text-foreground uppercase tracking-wider">
              Trường Đại học Điện Lực
            </p>
          </div>
        </div>

        {/* ── Vertical stem from EPU ── */}
        <div className="w-[1.5px] h-5 bg-gradient-to-b from-orange-500 to-primary/40 shrink-0" />

        {/* ── Columns Wrapper ── */}
        <div className="relative w-full flex pt-0">
          {mockDepartments.map((dept, index) => {
            const isExpanded = !!expandedDepts[dept.id]

            // Status score functions
            const getMajorValue = (name: string): number => {
              const lowName = name.toLowerCase();
              if (
                lowName === "công nghệ thông tin" ||
                lowName === "công nghệ kỹ thuật điều khiển và tự động hoá" ||
                lowName === "công nghệ kỹ thuật cơ điện tử"
              ) {
                return 85;
              }
              if (
                lowName === "trí tuệ nhân tạo" ||
                lowName === "công nghệ kỹ thuật cơ khí" ||
                lowName === "công nghệ kỹ thuật điện tử - viễn thông" ||
                lowName === "kiểm toán" ||
                lowName === "logistics và quản lý chuỗi cung ứng"
              ) {
                return 72;
              }
              return 58;
            }

            const getDeptStatus = (majorsList: typeof dept.nganhs) => {
              if (majorsList.length === 0) {
                return { percent: 0, colorClass: "bg-card border-border text-muted-foreground", activeColorClass: "bg-card border-primary text-primary", dotClass: "bg-muted" };
              }
              const sum = majorsList.reduce((acc, m) => acc + getMajorValue(m.tenNganh), 0);
              const avg = Math.round(sum / majorsList.length);

              if (avg >= 80) {
                return {
                  percent: avg,
                  colorClass: "bg-emerald-500/5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500/60",
                  activeColorClass: "bg-emerald-500/10 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-[0_0_8px_rgba(16,185,129,0.12)] scale-[1.02] font-semibold",
                  dotClass: "bg-emerald-500",
                }
              }
              if (avg >= 60) {
                return {
                  percent: avg,
                  colorClass: "bg-amber-500/5 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:border-amber-500/60",
                  activeColorClass: "bg-amber-500/10 border-amber-500 text-amber-700 dark:text-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.12)] scale-[1.02] font-semibold",
                  dotClass: "bg-amber-500",
                }
              }
              return {
                percent: avg,
                colorClass: "bg-rose-500/5 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:border-rose-500/60",
                activeColorClass: "bg-rose-500/10 border-rose-500 text-rose-700 dark:text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.12)] scale-[1.02] font-semibold",
                dotClass: "bg-rose-500",
              }
            }

            const deptStatus = getDeptStatus(dept.nganhs)

            return (
              <div key={dept.id} className="flex-1 flex flex-col items-center px-1 relative min-w-[70px] max-w-[160px]">
                
                {/* ── Edge-to-Edge Connecting Line (Zero Gap) ── */}
                <div className="absolute top-0 left-0 right-0 h-[1.5px] flex">
                  <div className={`flex-1 ${index === 0 ? "invisible" : "bg-primary/30"}`} />
                  <div className={`flex-1 ${index === mockDepartments.length - 1 ? "invisible" : "bg-primary/30"}`} />
                </div>

                {/* Vertical stem to card */}
                <div className="w-[1.5px] h-4 bg-primary/30 z-10 shrink-0" />

                {/* Department card (clickable) */}
                <button
                  onClick={() => toggleDept(dept.id)}
                  className={`w-full rounded-lg border p-1.5 text-center transition-all duration-200 cursor-pointer flex flex-col items-center justify-between min-h-[64px] z-10
                    ${isExpanded ? deptStatus.activeColorClass : deptStatus.colorClass}`}
                >
                  <p className="text-[10px] font-bold leading-tight tracking-wide line-clamp-2">
                    {dept.tenKhoa.replace("Khoa ", "")}
                  </p>
                  <div className="flex items-center gap-1 text-[8px] font-medium mt-1">
                    <span className={`w-1 h-1 rounded-full ${deptStatus.dotClass}`} />
                    <span>{deptStatus.percent}%</span>
                  </div>
                </button>

                {/* Stem to majors */}
                <div
                  className={`w-[1.5px] bg-primary/20 transition-all duration-200 shrink-0 ${
                    isExpanded ? "h-3 opacity-100" : "h-0 opacity-0"
                  }`}
                />

                {/* Majors list */}
                <div
                  className={`w-full flex flex-col gap-1 transition-all duration-200 origin-top z-10 ${
                    isExpanded
                      ? "max-h-[350px] opacity-100 scale-y-100 mt-0.5"
                      : "max-h-0 opacity-0 scale-y-95 overflow-hidden pointer-events-none"
                  }`}
                >
                  {dept.nganhs.map((major) => {
                    // Determine status based on the user's PRD color mapping rules
                    const getMajorStatus = (name: string) => {
                      const lowName = name.toLowerCase();
                      if (
                        lowName === "công nghệ thông tin" ||
                        lowName === "công nghệ kỹ thuật điều khiển và tự động hoá" ||
                        lowName === "công nghệ kỹ thuật cơ điện tử"
                      ) {
                        return {
                          colorClass: "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:border-emerald-500/50",
                          dotClass: "bg-emerald-500",
                          percent: "85%",
                        }
                      }
                      if (
                        lowName === "trí tuệ nhân tạo" ||
                        lowName === "công nghệ kỹ thuật cơ khí" ||
                        lowName === "công nghệ kỹ thuật điện tử - viễn thông" ||
                        lowName === "kiểm toán" ||
                        lowName === "logistics và quản lý chuỗi cung ứng"
                      ) {
                        return {
                          colorClass: "bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-400 hover:border-amber-500/50",
                          dotClass: "bg-amber-500",
                          percent: "72%",
                        }
                      }
                      // Đỏ: Xây dựng, Điện-điện tử, Tài chính - Ngân hàng, Quản trị kinh doanh
                      return {
                        colorClass: "bg-rose-500/5 dark:bg-rose-500/10 border-rose-500/30 text-rose-700 dark:text-rose-400 hover:border-rose-500/50",
                        dotClass: "bg-rose-500",
                        percent: "58%",
                      }
                    }

                    const status = getMajorStatus(major.tenNganh)

                    return (
                      <div
                        key={major.id}
                        className={`w-full px-1.5 py-1 rounded-md border flex flex-col gap-0.5 transition-all duration-150 ${status.colorClass}`}
                      >
                        <p className="text-[8.5px] leading-tight font-semibold text-center break-words">
                          {major.tenNganh}
                        </p>
                        <div className="flex items-center justify-center gap-1 text-[8px] opacity-90 font-medium">
                          <span className={`w-1 h-1 rounded-full ${status.dotClass}`} />
                          <span>{status.percent}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

              </div>
            )
          })}
        </div>

      </div>
    </div>
  )
}
