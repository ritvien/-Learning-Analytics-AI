"use client"

import * as React from "react"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  PieChart,
  Pie,
  Cell,
  Legend,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  LineChart,
  Line,
} from "recharts"

import { normalizeReportDeepDiveHref } from "@/lib/report-deep-dive"

// ── Shared tooltip style ──────────────────────────────────────────────────────

const TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: "var(--background)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
  borderRadius: "6px",
  fontSize: "12px",
}

const TARGET_DEFAULT = 75

// ── 1. ReportBarChart — Horizontal bar, dùng cho CLO/PLO/bottleneck ──────────

interface BarItem {
  name: string
  value: number
  fullName?: string
  href?: string
}

function openReportHref(href?: string) {
  const safeHref = normalizeReportDeepDiveHref(href)
  if (!safeHref) return
  window.location.assign(safeHref)
}

export function ReportBarChart({
  data,
  target = TARGET_DEFAULT,
  unit = "%",
  label = "Giá trị",
  height,
}: {
  data: BarItem[]
  target?: number
  unit?: string
  label?: string
  height?: number
}) {
  if (!data.length) return null
  const barHeight = Math.max(120, data.length * 44 + 48)
  const computedHeight = height ?? barHeight
  const isPercent = unit === "%"
  const linkedData = data.map((item) => ({ ...item, href: normalizeReportDeepDiveHref(item.href) ?? undefined }))
  const hasLinks = linkedData.some((item) => item.href)

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={computedHeight}>
      <BarChart
        data={linkedData}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          domain={[0, isPercent ? 100 : "dataMax"]}
          tickFormatter={(v) => `${v}${unit}`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, props: any) => [
            `${value}${unit}`,
            props.payload?.fullName ?? label,
          ]}
        />
        <ReferenceLine
          x={target}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 3"
          label={{ value: `Mục tiêu ${target}${unit}`, position: "right", fontSize: 10, fill: "hsl(var(--destructive))" }}
        />
        <Bar
          dataKey="value"
          radius={[0, 3, 3, 0]}
          maxBarSize={28}
          onClick={(payload: { href?: string; payload?: { href?: string } }) =>
            openReportHref(payload?.href ?? payload?.payload?.href)
          }
        >
          {linkedData.map((entry) => (
            <Cell
              key={entry.name}
              fill={isPercent ? (entry.value >= target ? "hsl(var(--primary))" : "hsl(var(--destructive))") : "hsl(var(--destructive))"}
              fillOpacity={0.85}
              cursor={entry.href ? "pointer" : "default"}
            />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      {hasLinks ? (
        <div className="flex flex-wrap gap-2 border-t pt-2">
          {linkedData
            .filter((item) => item.href)
            .map((item) => (
              <a
                key={`${item.name}-${item.href}`}
                href={item.href}
                className="rounded-md border px-2 py-1 text-[11px] font-medium text-primary underline-offset-2 hover:bg-muted hover:underline"
              >
                Xem {item.fullName ?? item.name}
              </a>
            ))}
        </div>
      ) : null}
    </div>
  )
}

// ── 2. ReportGroupedBarChart — So sánh pass_rate giữa các section ───────────

interface SectionItem {
  name: string
  pass_rate: number
  teacher?: string
  sample?: number
  href?: string
}

export function ReportSectionBarChart({
  data,
  target = 70,
}: {
  data: SectionItem[]
  target?: number
}) {
  if (!data.length) return null
  const chartData = data.map((item) => ({
    name: item.name,
    "Tỷ lệ đạt": item.pass_rate,
    fullLabel: item.teacher ? `${item.name} — ${item.teacher}` : item.name,
    sample: item.sample,
    href: normalizeReportDeepDiveHref(item.href) ?? undefined,
  }))
  const hasLinks = chartData.some((item) => item.href)

  return (
    <div className="space-y-2">
      <ResponsiveContainer width="100%" height={Math.max(140, data.length * 44 + 48)}>
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 4, right: 40, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border)" />
        <XAxis
          type="number"
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={72}
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, _name: any, props: any) => [
            `${value}%${props.payload?.sample ? ` (${props.payload.sample} SV)` : ""}`,
            props.payload?.fullLabel,
          ]}
        />
        <ReferenceLine
          x={target}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 3"
          label={{ value: `${target}%`, position: "right", fontSize: 10, fill: "hsl(var(--destructive))" }}
        />
        <Bar dataKey="Tỷ lệ đạt" radius={[0, 3, 3, 0]} maxBarSize={28}>
          {chartData.map((entry) => (
            <Cell
              key={entry.name}
              fill={entry["Tỷ lệ đạt"] >= target ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
              fillOpacity={0.85}
            />
          ))}
        </Bar>
      </BarChart>
      </ResponsiveContainer>
      {hasLinks ? (
        <div className="flex flex-wrap gap-2 border-t pt-2">
          {chartData
            .filter((item) => item.href)
            .map((item) => (
              <a
                key={`${item.name}-${item.href}`}
                href={item.href}
                className="rounded-md border px-2 py-1 text-[11px] font-medium text-primary underline-offset-2 hover:bg-muted hover:underline"
              >
                Xem {item.fullLabel}
              </a>
            ))}
        </div>
      ) : null}
    </div>
  )
}

// ── 3. ReportDonutChart — Donut chart cho passed/failed ──────────────────────

interface DonutSlice {
  name: string
  value: number
  color: string
}

function CustomDonutLabel({
  cx,
  cy,
  centerText,
}: {
  cx: number
  cy: number
  centerText: string
}) {
  return (
    <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" style={{ fill: "var(--foreground)" }}>
      <tspan x={cx} dy="-0.4em" style={{ fontSize: 22, fontWeight: 700 }}>
        {centerText}
      </tspan>
      <tspan x={cx} dy="1.5em" style={{ fontSize: 11, fill: "var(--muted-foreground)" }}>
        tỷ lệ đạt
      </tspan>
    </text>
  )
}

export function ReportDonutChart({
  data,
  centerText,
}: {
  data: DonutSlice[]
  centerText?: string
}) {
  const validData = data.filter((d) => d.value > 0)
  if (!validData.length) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={validData}
          cx="50%"
          cy="50%"
          innerRadius={56}
          outerRadius={82}
          paddingAngle={2}
          dataKey="value"
          label={false}
        >
          {validData.map((entry) => (
            <Cell key={entry.name} fill={entry.color} />
          ))}
          {centerText ? (
            // @ts-expect-error recharts label prop
            <CustomDonutLabel centerText={centerText} />
          ) : null}
        </Pie>
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value} lượt`, name]}
        />
        <Legend
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 12 }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── 4. ReportRadarChart — Spider chart cho PLO attainment ────────────────────

interface RadarPoint {
  subject: string
  value: number
  fullName?: string
}

export function ReportRadarChart({
  data,
  target = TARGET_DEFAULT,
}: {
  data: RadarPoint[]
  target?: number
}) {
  if (data.length < 3) return null

  const chartData = data.map((item) => ({
    subject: item.subject,
    "Mức đạt": item.value,
    "Mục tiêu": target,
    fullName: item.fullName ?? item.subject,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
        <PolarGrid stroke="var(--border)" />
        <PolarAngleAxis
          dataKey="subject"
          tick={{ fontSize: 11, fill: "var(--foreground)" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fontSize: 9, fill: "var(--muted-foreground)" }}
          tickCount={4}
        />
        <Radar
          name="Mức đạt thực tế"
          dataKey="Mức đạt"
          stroke="hsl(var(--primary))"
          fill="hsl(var(--primary))"
          fillOpacity={0.25}
        />
        <Radar
          name={`Mục tiêu ${target}%`}
          dataKey="Mục tiêu"
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 3"
          fill="transparent"
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any, name: any) => [`${value}%`, name]}
        />
        <Legend
          iconSize={8}
          formatter={(value) => <span style={{ fontSize: 11 }}>{value}</span>}
        />
      </RadarChart>
    </ResponsiveContainer>
  )
}

// ── 5. ReportTrendLine — Trend theo kỳ (dùng Tier 2 khi có pass_rate_trend) ──

interface TrendPoint {
  semester: string
  value: number
  report_id?: string
}

export function ReportTrendLine({
  data,
  label = "Tỷ lệ đạt (%)",
  safeThreshold = 70,
  onDotClick,
}: {
  data: TrendPoint[]
  label?: string
  safeThreshold?: number
  onDotClick?: (reportId: string) => void
}) {
  if (data.length < 2) return null

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 8, right: 24, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="semester"
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
        />
        <YAxis
          domain={[0, 100]}
          tickFormatter={(v) => `${v}%`}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          width={36}
        />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          formatter={(value: any) => [`${value}%`, label]}
        />
        <ReferenceLine
          y={safeThreshold}
          stroke="hsl(var(--destructive))"
          strokeDasharray="4 3"
          label={{ value: `Ngưỡng ${safeThreshold}%`, position: "right", fontSize: 10, fill: "hsl(var(--destructive))" }}
        />
        <Line
          type="monotone"
          dataKey="value"
          name={label}
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          dot={(props) => {
            const { cx, cy, payload } = props
            const isBad = payload.value < safeThreshold
            return (
              <circle
                key={`dot-${payload.semester}`}
                cx={cx}
                cy={cy}
                r={5}
                fill={isBad ? "hsl(var(--destructive))" : "hsl(var(--primary))"}
                stroke="var(--background)"
                strokeWidth={2}
                style={{ cursor: payload.report_id && onDotClick ? "pointer" : "default" }}
                onClick={() => payload.report_id && onDotClick?.(payload.report_id)}
              />
            )
          }}
          activeDot={{ r: 7 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
