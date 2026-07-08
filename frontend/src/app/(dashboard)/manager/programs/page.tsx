"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Upload, FileText, Trash2, CheckCircle2, Clock, AlertCircle, BookOpen, Plus
} from "lucide-react"

interface PdfFile {
  id: string
  name: string
  size: string
  status: "indexed" | "processing" | "error"
  uploadedAt: string
  pages?: number
  department?: string
}

const INITIAL_FILES: PdfFile[] = [
  {
    id: "pdf-1",
    name: "CTDT_CNTT_2022.pdf",
    size: "2.3 MB",
    status: "indexed",
    uploadedAt: "01/06/2026",
    pages: 87,
    department: "Khoa Công nghệ Thông tin",
  },
  {
    id: "pdf-2",
    name: "CTDT_Dien_2022.pdf",
    size: "1.8 MB",
    status: "indexed",
    uploadedAt: "03/06/2026",
    pages: 74,
    department: "Khoa Điện",
  },
  {
    id: "pdf-3",
    name: "CTDT_CoKhi_2023.pdf",
    size: "3.1 MB",
    status: "processing",
    uploadedAt: "05/06/2026",
    department: "Khoa Cơ khí",
  },
]

const StatusBadge = ({ status }: { status: PdfFile["status"] }) => {
  if (status === "indexed") return (
    <Badge className="bg-green-500/10 text-green-600 border-green-200 gap-1">
      <CheckCircle2 className="h-3 w-3" /> Đã index
    </Badge>
  )
  if (status === "processing") return (
    <Badge className="bg-yellow-500/10 text-yellow-600 border-yellow-200 gap-1 animate-pulse">
      <Clock className="h-3 w-3" /> Đang xử lý
    </Badge>
  )
  return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" /> Lỗi
    </Badge>
  )
}

export default function ProgramsPage() {
  const [files, setFiles] = React.useState<PdfFile[]>(INITIAL_FILES)
  const [isDragging, setIsDragging] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = Array.from(e.dataTransfer.files).filter(f => f.name.endsWith(".pdf"))
    addFiles(droppedFiles)
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return
    const selected = Array.from(e.target.files)
    addFiles(selected)
    if (fileInputRef.current) fileInputRef.current.value = ""
  }

  const addFiles = (newFiles: File[]) => {
    const mapped: PdfFile[] = newFiles.map(f => ({
      id: `pdf-${Date.now()}-${Math.random()}`,
      name: f.name,
      size: `${(f.size / 1024 / 1024).toFixed(1)} MB`,
      status: "processing",
      uploadedAt: new Date().toLocaleDateString("vi-VN"),
    }))
    setFiles(prev => [...prev, ...mapped])

    // Simulate processing -> indexed after 3s
    mapped.forEach(file => {
      setTimeout(() => {
        setFiles(prev => prev.map(f =>
          f.id === file.id ? { ...f, status: "indexed", pages: Math.floor(Math.random() * 60) + 40 } : f
        ))
      }, 3000)
    })
  }

  const handleDelete = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const indexedCount = files.filter(f => f.status === "indexed").length

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Chương trình đào tạo (RAG)</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Tổng file đã upload</CardDescription>
            <CardTitle className="text-3xl">{files.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đã index (sẵn sàng RAG)</CardDescription>
            <CardTitle className="text-3xl text-green-600">{indexedCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Đang xử lý</CardDescription>
            <CardTitle className="text-3xl text-yellow-600">
              {files.filter(f => f.status === "processing").length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Drop zone */}
      <div
        data-tour="page-programs-upload"
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={() => setIsDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
          isDragging
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/50 hover:bg-accent/30"
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          className="hidden"
          onChange={handleFileInput}
          id="pdf-upload-input"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="font-semibold text-base">Kéo thả file PDF vào đây</p>
            <p className="text-sm text-muted-foreground mt-1">
              hoặc <span className="text-primary font-medium">click để chọn file</span>
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Hỗ trợ: PDF · Tối đa 50MB/file · Nhiều file cùng lúc
          </p>
          <Button variant="outline" size="sm" className="mt-1" onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click() }}>
            <Plus className="mr-2 h-4 w-4" /> Chọn file PDF
          </Button>
        </div>
      </div>

      {/* File list */}
      <Card data-tour="page-programs-results">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4" />
            File đã upload ({files.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Chưa có file nào được upload.
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {files.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3 hover:bg-accent/30 transition-colors"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-red-50 text-red-600 dark:bg-red-950">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm truncate">{file.name}</p>
                      <StatusBadge status={file.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {file.size}
                      {file.pages && ` · ${file.pages} trang`}
                      {file.department && ` · ${file.department}`}
                      {` · Upload: ${file.uploadedAt}`}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(file.id)}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    id={`delete-pdf-${file.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info note */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/30 dark:border-blue-900 p-4 text-sm text-blue-800 dark:text-blue-300">
        <p className="font-semibold mb-1">💡 Hướng dẫn</p>
        <ul className="list-disc list-inside space-y-1 text-blue-700 dark:text-blue-400">
          <li>Upload file PDF chương trình đào tạo (CTĐT) của từng ngành</li>
          <li>Hệ thống sẽ tự động đọc, phân tích và lưu vào cơ sở dữ liệu vector</li>
          <li>Sau khi index xong, AI có thể trả lời câu hỏi về ngành học, môn học, chuẩn đầu ra</li>
          <li>Nên upload 1 file PDF / 1 ngành để đảm bảo chất lượng</li>
        </ul>
      </div>
    </div>
  )
}
