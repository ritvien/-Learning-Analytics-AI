"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, BarChart2, BookOpen, AlertTriangle } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart2, text: "Môn nào có tỷ lệ trượt cao nhất học kỳ này?" },
  { icon: BookOpen, text: "Ngành Công nghệ thông tin có những môn nào bắt buộc?" },
  { icon: AlertTriangle, text: "Sinh viên nào đang có nguy cơ bị đình chỉ học?" },
  { icon: Sparkles, text: "GPA trung bình khóa 2022 so với khóa 2021 như thế nào?" },
]

const MOCK_RESPONSES: Record<string, string> = {
  default: `Xin chào! Tôi là **EPU AI Analytics Assistant** 🎓

Tôi có thể giúp bạn:
- 📊 **Phân tích điểm số** — Xem xu hướng GPA, tỷ lệ trượt theo khóa/ngành/môn
- 📚 **Tra cứu chương trình đào tạo** — Thông tin môn học, chuẩn đầu ra, tín chỉ
- ⚠️ **Cảnh báo sớm** — Danh sách sinh viên có nguy cơ học vụ
- 📄 **Sinh báo cáo** — Tóm tắt tình hình đào tạo cho ban quản lý

Hãy đặt câu hỏi bằng tiếng Việt tự nhiên!`,
  "môn nào có tỷ lệ trượt cao nhất": `Dựa trên dữ liệu học kỳ HK1 2023-2024, **top 5 môn có tỷ lệ trượt cao nhất** là:

| # | Môn học | Mã HP | Tỷ lệ trượt |
|---|---------|-------|-------------|
| 1 | Giải tích 1 | MATH101 | **28.5%** |
| 2 | Vật lý đại cương | PHY101 | **22.1%** |
| 3 | Mạng máy tính | CS301 | **18.4%** |
| 4 | Lập trình C | CS101 | **15.2%** |
| 5 | Mạch điện 1 | EE201 | **12.0%** |

> 💡 **Đề xuất:** Giải tích 1 và Vật lý đại cương cần xem xét điều chỉnh phương pháp giảng dạy hoặc bổ sung lớp học bổ trợ.`,
  "gpa trung bình": `Xu hướng GPA trung bình theo khóa học:

**Khóa 2022:** GPA = **2.85** ↗ (+0.05 so với HK trước)
**Khóa 2021:** GPA = **2.78** → (ổn định)
**Khóa 2020:** GPA = **2.91** ✅ (năm cuối, đã cải thiện)

Nhận xét: Sinh viên năm cuối (khóa 2020) có GPA cao hơn do đã qua các môn đại cương khó, tập trung vào chuyên ngành.`,
  "sinh viên nào đang có nguy cơ": `Danh sách **sinh viên có nguy cơ học vụ** (GPA < 2.0 hoặc tín chỉ nợ ≥ 12):

| MSSV | Họ tên | GPA TL | TC Nợ | Tình trạng |
|------|--------|--------|-------|------------|
| 23810340010 | Trần Quốc Bảo | 2.65 | 9 TC | ⚠️ Cảnh báo |
| 21810220015 | Lê Thị Mai | 3.05 | 6 TC | ⚠️ Theo dõi |

> 📌 **Khuyến nghị:** Liên hệ cố vấn học tập để tư vấn kế hoạch học tập cho 2 sinh viên trên.`,
  "ngành công nghệ thông tin": `**Ngành Công nghệ Thông tin** — Khoa CNTT, Trường ĐH Điện Lực

📋 **Thông tin chung:**
- Mã ngành: 7480201
- Thời gian đào tạo: 4 năm
- Tổng tín chỉ: 145 TC

📚 **Các môn học bắt buộc (trích):
- Giải tích 1 & 2 (6 TC)
- Vật lý đại cương (4 TC)
- Lập trình C (3 TC)
- Cơ sở dữ liệu (3 TC)
- Mạng máy tính (3 TC)
- Trí tuệ nhân tạo (3 TC)
- Đồ án tốt nghiệp (10 TC)

> 📄 Nguồn: CTĐT_CNTT_2022.pdf (đã index vào hệ thống RAG)`,
}

function getResponse(input: string): string {
  const lower = input.toLowerCase()
  if (lower.includes("trượt") || lower.includes("rớt")) return MOCK_RESPONSES["môn nào có tỷ lệ trượt cao nhất"]
  if (lower.includes("gpa") || lower.includes("điểm trung bình")) return MOCK_RESPONSES["gpa trung bình"]
  if (lower.includes("nguy cơ") || lower.includes("đình chỉ") || lower.includes("cảnh báo")) return MOCK_RESPONSES["sinh viên nào đang có nguy cơ"]
  if (lower.includes("công nghệ thông tin") || lower.includes("cntt")) return MOCK_RESPONSES["ngành công nghệ thông tin"]
  return `Cảm ơn bạn đã hỏi! 

Tôi đang phân tích câu hỏi: *"${input}"*

_(Đây là bản demo UI — backend AI sẽ được tích hợp ở bước tiếp theo)_

Hiện tại bạn có thể thử các câu hỏi mẫu như:
- "Môn nào có tỷ lệ trượt cao nhất?"
- "GPA trung bình khóa 2022 là bao nhiêu?"
- "Ngành Công nghệ thông tin có những môn gì?"`
}

// Simple markdown-like renderer
function renderContent(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    // Bold
    line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    // Table rows
    if (line.startsWith("|")) {
      return <div key={i} className="font-mono text-xs my-0.5 text-muted-foreground">{line}</div>
    }
    // Blockquote
    if (line.startsWith(">")) {
      return (
        <div key={i} className="border-l-2 border-primary pl-3 text-muted-foreground text-sm my-1 italic">
          <span dangerouslySetInnerHTML={{ __html: line.slice(1).trim() }} />
        </div>
      )
    }
    // List items
    if (line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-2 text-sm my-0.5">
          <span className="text-primary mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
        </div>
      )
    }
    // Empty
    if (!line.trim()) return <div key={i} className="my-1" />
    // Normal
    return (
      <div key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: line }} />
    )
  })
}

export default function ChatPage() {
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: MOCK_RESPONSES.default,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content: text.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsLoading(true)

    // Simulate streaming delay
    const assistantMsgId = `a-${Date.now()}`
    const fullResponse = getResponse(text)

    // Add empty streaming message
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
    }])

    // Simulate token-by-token streaming
    let currentText = ""
    const words = fullResponse.split(" ")
    for (let i = 0; i < words.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 30))
      currentText += (i === 0 ? "" : " ") + words[i]
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: currentText } : m
      ))
    }

    setMessages(prev => prev.map(m =>
      m.id === assistantMsgId ? { ...m, isStreaming: false } : m
    ))
    setIsLoading(false)
    inputRef.current?.focus()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-5rem)] max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 pb-4 border-b">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Bot className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">EPU AI Analytics</h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            Online · Powered by LLM + RAG (CTĐT)
          </p>
        </div>
        <Badge variant="secondary" className="ml-auto">Demo UI</Badge>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 py-4" ref={scrollRef as any}>
        <div className="flex flex-col gap-4 pr-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
            >
              {/* Avatar */}
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                msg.role === "assistant"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}>
                {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>

              {/* Bubble */}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-tr-sm"
                  : "bg-muted rounded-tl-sm"
              }`}>
                {msg.role === "user" ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <div className="space-y-1">
                    {renderContent(msg.content)}
                    {msg.isStreaming && (
                      <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1 rounded" />
                    )}
                  </div>
                )}
                <p className={`text-xs mt-1 ${msg.role === "user" ? "text-primary-foreground/70 text-right" : "text-muted-foreground"}`}>
                  {msg.timestamp.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          ))}

          {/* Suggested prompts — only show when no user messages yet */}
          {messages.length === 1 && (
            <div className="mt-2">
              <p className="text-xs text-muted-foreground mb-2 text-center">Gợi ý câu hỏi:</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() => sendMessage(prompt.text)}
                    className="flex items-start gap-2 rounded-xl border border-border bg-card p-3 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
                  >
                    <prompt.icon className="h-4 w-4 shrink-0 text-primary mt-0.5" />
                    <span>{prompt.text}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="pt-4 border-t">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Hỏi bất cứ điều gì về dữ liệu học tập..."
            disabled={isLoading}
            className="flex-1 rounded-xl"
            id="chat-input"
          />
          <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="rounded-xl shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </form>
        <p className="text-xs text-muted-foreground text-center mt-2">
          AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
        </p>
      </div>
    </div>
  )
}
