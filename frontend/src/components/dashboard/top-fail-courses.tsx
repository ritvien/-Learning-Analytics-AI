"use client"

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

const failData = [
  { maHP: "MATH101", tenMon: "Giải tích 1", tinChi: 3, failRate: 28.5 },
  { maHP: "PHY101", tenMon: "Vật lý đại cương", tinChi: 4, failRate: 22.1 },
  { maHP: "CS301", tenMon: "Mạng máy tính", tinChi: 3, failRate: 18.4 },
  { maHP: "CS101", tenMon: "Lập trình C", tinChi: 3, failRate: 15.2 },
  { maHP: "EE201", tenMon: "Mạch điện 1", tinChi: 3, failRate: 12.0 },
]

export function TopFailCoursesTable() {
  return (
    <div className="w-full h-[300px] overflow-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Mã HP</TableHead>
            <TableHead>Tên môn</TableHead>
            <TableHead className="text-right">Tỷ lệ trượt</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {failData.map((course) => (
            <TableRow key={course.maHP}>
              <TableCell className="font-medium">{course.maHP}</TableCell>
              <TableCell>{course.tenMon}</TableCell>
              <TableCell className="text-right">
                <Badge variant={course.failRate > 20 ? "destructive" : "secondary"}>
                  {course.failRate.toFixed(1)}%
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
