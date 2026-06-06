"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from "recharts"

const data = [
  { semester: "HK1 2021", gpa: 2.75 },
  { semester: "HK2 2021", gpa: 2.80 },
  { semester: "HK1 2022", gpa: 2.78 },
  { semester: "HK2 2022", gpa: 2.82 },
  { semester: "HK1 2023", gpa: 2.85 },
  { semester: "HK2 2023", gpa: 2.81 },
  { semester: "HK1 2024", gpa: 2.88 },
]

export function GpaTrendChart() {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="semester" 
            className="text-xs font-medium text-muted-foreground" 
            tick={{ fill: "currentColor" }}
          />
          <YAxis 
            domain={[2.0, 4.0]} 
            className="text-xs font-medium text-muted-foreground"
            tick={{ fill: "currentColor" }}
          />
          <Tooltip 
            contentStyle={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--foreground)", borderRadius: "6px" }}
          />
          <Legend />
          <Line 
            type="monotone" 
            dataKey="gpa" 
            name="GPA Trung bình" 
            stroke="hsl(var(--primary))" 
            strokeWidth={3}
            dot={{ r: 4, fill: "hsl(var(--primary))" }}
            activeDot={{ r: 6 }} 
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
