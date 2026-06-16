"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, BarChart2, BookOpen, AlertTriangle } from "lucide-react"
import { chatStream, SSEEvent } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  intent?: string
  latencyMs?: number
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart2, text: "Môn nào có tỷ lệ trượt cao nhất học kỳ này?" },
  { icon: BookOpen, text: "Ngành Công nghệ thông tin có những môn nào bắt buộc?" },
  { icon: AlertTriangle, text: "Sinh viên nào đang có nguy cơ bị đình chỉ học?" },
  { icon: Sparkles, text: "GPA trung bình khóa 2022 so với khóa 2021 như thế nào?" },
]

const WELCOME_MESSAGE = `Xin chào! Tôi là **EPU AI Analytics Assistant** 🎓

Tôi có thể giúp bạn:
- 📊 **Phân tích điểm số** — Xem xu hướng GPA, tỷ lệ trượt theo khóa/ngành/môn
- 📚 **Tra cứu chương trình đào tạo** — Thông tin môn học, chuẩn đầu ra, tín chỉ
- ⚠️ **Cảnh báo sớm** — Danh sách sinh viên có nguy cơ học vụ
- 📄 **Sinh báo cáo** — Tóm tắt tình hình đào tạo cho ban quản lý

Hãy đặt câu hỏi bằng tiếng Việt tự nhiên!`

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
  const searchParams = useSearchParams()
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    }
  ])
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoSentRef = React.useRef(false)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Auto-send message from query param 'q'
  React.useEffect(() => {
    const q = searchParams.get("q")
    if (q && !autoSentRef.current) {
      autoSentRef.current = true
      // Small delay to let the component mount fully
      setTimeout(() => sendMessage(q), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

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

    const assistantMsgId = `a-${Date.now()}`

    // Add empty streaming placeholder
    setMessages(prev => [...prev, {
      id: assistantMsgId,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      isStreaming: true,
      statuses: ["🔍 Đang phân tích yêu cầu..."]
    }])

    try {
      let fullContent = ""
      let hasStartedAnswering = false

      for await (const event of chatStream({ message: text.trim() })) {
        switch (event.type) {
          case "router":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                intent: event.intent,
                statuses: [...(m.statuses || []), `🧠 Định tuyến xử lý: ${event.intent === 'core_agent' ? 'Suy luận phức tạp' : 'Suy luận đơn giản'}`]
              } : m
            ))
            break

          case "tool_call": {
            const toolNameMap: Record<string, string> = {
              "sql_query_tool": "Truy vấn Cơ sở dữ liệu học vụ",
            }
            const displayToolName = toolNameMap[event.tool] || event.tool
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                statuses: [...(m.statuses || []), `⚙️ Đang thao tác: ${displayToolName}`]
              } : m
            ))
            break
          }

          case "tool_result":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                statuses: [...(m.statuses || []), `💾 Đã nhận dữ liệu, đang xử lý...`]
              } : m
            ))
            break

          case "token":
            if (!hasStartedAnswering) {
              hasStartedAnswering = true
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { 
                  ...m, 
                  statuses: [...(m.statuses || []), `✍️ Đang tổng hợp câu trả lời...`]
                } : m
              ))
            }
            fullContent += event.content
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: fullContent } : m
            ))
            break

          case "done":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: fullContent, isStreaming: false, latencyMs: event.latency_ms }
                : m
            ))
            break

          case "error":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? { ...m, content: `**Lỗi hệ thống:** ${event.message}`, isStreaming: false }
                : m
            ))
            break
        }
      }

      // Ensure streaming flag is off
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, isStreaming: false } : m
      ))
    } catch (error: any) {
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? { ...m, content: `**Lỗi hệ thống:** Không thể kết nối với Agent.\n\nChi tiết: ${error.message}`, isStreaming: false }
          : m
      ))
    }
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
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1B3A5C] to-[#2A5280] text-white shadow-sm">
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
        <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 shadow-sm">Live Agent</Badge>
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
                  ? "bg-gradient-to-br from-[#1B3A5C] to-[#2A5280] text-white shadow-sm"
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
                    {/* Agent Statuses / State */}
                    {msg.statuses && msg.statuses.length > 0 && (
                      <div className="flex flex-col gap-1.5 mb-3 mt-1">
                        {msg.statuses.map((status, idx) => {
                          const isLast = idx === msg.statuses!.length - 1
                          const isActive = isLast && msg.isStreaming
                          return (
                            <div key={idx} className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-md py-1.5 px-2.5 border border-border/50 w-fit max-w-full">
                              {isActive ? (
                                <span className="relative flex h-2 w-2 shrink-0">
                                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                </span>
                              ) : (
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                              )}
                              <span className="truncate font-medium">{status}</span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                    
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
