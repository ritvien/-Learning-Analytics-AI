"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, BarChart2, BookOpen, AlertTriangle, MessageSquare, Plus, Trash2 } from "lucide-react"
import { api, chatStreamV2, ChatSessionSummary } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  intent?: string
  latencyMs?: number
  statuses?: string[]
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

function renderContent(text: string) {
  const lines = text.split("\n")
  return lines.map((line, i) => {
    line = line.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    if (line.startsWith("|")) {
      return <div key={i} className="font-mono text-xs my-0.5 text-muted-foreground">{line}</div>
    }
    if (line.startsWith(">")) {
      return (
        <div key={i} className="border-l-2 border-primary pl-3 text-muted-foreground text-sm my-1 italic">
          <span dangerouslySetInnerHTML={{ __html: line.slice(1).trim() }} />
        </div>
      )
    }
    if (line.startsWith("- ")) {
      return (
        <div key={i} className="flex gap-2 text-sm my-0.5">
          <span className="text-primary mt-0.5">•</span>
          <span dangerouslySetInnerHTML={{ __html: line.slice(2) }} />
        </div>
      )
    }
    if (!line.trim()) return <div key={i} className="my-1" />
    return <div key={i} className="text-sm" dangerouslySetInnerHTML={{ __html: line }} />
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
  const [sessions, setSessions] = React.useState<ChatSessionSummary[]>([])
  const [activeSessionId, setActiveSessionId] = React.useState<string | undefined>()
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoSentRef = React.useRef(false)

  // Fetch sessions on mount
  React.useEffect(() => {
    fetchSessions()
  }, [])

  const fetchSessions = async () => {
    try {
      const data = await api.getChatSessions()
      setSessions(data)
    } catch (e) {
      console.error("Failed to load sessions", e)
    }
  }

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  React.useEffect(() => {
    const q = searchParams.get("q")
    if (q && !autoSentRef.current) {
      autoSentRef.current = true
      setTimeout(() => sendMessage(q), 300)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const loadSession = async (thread_id: string) => {
    if (isLoading) return
    try {
      setActiveSessionId(thread_id)
      const detail = await api.getChatSessionById(thread_id)
      
      if (!detail.messages || detail.messages.length === 0) {
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: WELCOME_MESSAGE,
          timestamp: new Date(),
        }])
        return
      }

      // Parse LangChain format
      const parsedMsgs: Message[] = []
      let lastId = 0
      for (const m of detail.messages) {
        const content = m.data?.content || m.content
        if (m.type === "human" && content) {
          parsedMsgs.push({
            id: `msg-${lastId++}`,
            role: "user",
            content: typeof content === "string" ? content : JSON.stringify(content),
            timestamp: new Date(), // We don't have accurate timestamps in Langchain state by default
          })
        } else if (m.type === "ai" && content) {
          parsedMsgs.push({
            id: `msg-${lastId++}`,
            role: "assistant",
            content: typeof content === "string" ? content : JSON.stringify(content),
            timestamp: new Date(),
          })
        }
      }

      if (parsedMsgs.length === 0) {
        setMessages([{
          id: "welcome",
          role: "assistant",
          content: WELCOME_MESSAGE,
          timestamp: new Date(),
        }])
      } else {
        setMessages(parsedMsgs)
      }
    } catch (e) {
      console.error("Failed to load session history", e)
    }
  }

  const deleteSession = async (thread_id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm("Bạn có chắc chắn muốn xoá cuộc trò chuyện này?")) return
    try {
      await api.deleteChatSession(thread_id)
      setSessions(prev => prev.filter(s => s.id !== thread_id))
      if (activeSessionId === thread_id) {
        handleNewChat()
      }
    } catch (error) {
      console.error("Failed to delete session", error)
    }
  }

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    }])
  }

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

      for await (const event of chatStreamV2({ message: text.trim(), thread_id: activeSessionId })) {
        switch (event.type) {
          case "session_created":
            setActiveSessionId(event.thread_id)
            setSessions(prev => [{ id: event.thread_id, title: event.title, updated_at: new Date().toISOString() }, ...prev])
            break
            
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
    <div className="flex flex-row h-[calc(100vh-5rem)] w-full max-w-6xl mx-auto border rounded-xl overflow-hidden bg-card/50 shadow-sm mt-4">
      {/* Left Column: Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        <div className="flex items-center gap-3 px-6 py-4 border-b">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-[#1B3A5C] to-[#2A5280] text-white shadow-sm shrink-0">
            <Bot className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold tracking-tight truncate">EPU AI Analytics</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              Online · Powered by LLM + RAG (CTĐT)
            </p>
          </div>
          <Badge variant="secondary" className="ml-auto bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 shadow-sm shrink-0">Live Agent</Badge>
        </div>

        <div className="flex-1 overflow-y-auto py-4 px-6" ref={scrollRef}>
          <div className="flex flex-col gap-4 w-full">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                  msg.role === "assistant"
                    ? "bg-gradient-to-br from-[#1B3A5C] to-[#2A5280] text-white shadow-sm"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
                </div>

                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-tr-sm"
                    : "bg-muted rounded-tl-sm"
                }`}>
                  {msg.role === "user" ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <div className="space-y-1">
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

            {messages.length === 1 && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-3 text-center">Gợi ý câu hỏi:</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt.text}
                      onClick={() => sendMessage(prompt.text)}
                      className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left text-sm hover:bg-accent hover:text-accent-foreground transition-colors group"
                    >
                      <prompt.icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary mt-0.5 transition-colors" />
                      <span className="leading-snug">{prompt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 px-6 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex gap-2 relative">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi bất cứ điều gì về dữ liệu học tập..."
              disabled={isLoading}
              className="flex-1 rounded-xl pr-12 shadow-sm"
              id="chat-input"
            />
            <Button type="submit" disabled={isLoading || !input.trim()} size="icon" className="absolute right-1 top-1 bottom-1 h-auto rounded-lg shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
          <p className="text-[11px] text-muted-foreground text-center mt-2.5">
            AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
          </p>
        </div>
      </div>

      {/* Right Column: Sessions Sidebar */}
      <div className="w-72 flex flex-col border-l bg-muted/20 shrink-0">
        <div className="p-4 border-b">
          <Button onClick={handleNewChat} className="w-full gap-2 rounded-xl shadow-sm" variant="default">
            <Plus className="h-4 w-4" /> Cuộc trò chuyện mới
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-muted-foreground px-2 py-1 uppercase tracking-wider mb-1">
              Lịch sử trò chuyện
            </p>
            {sessions.length === 0 ? (
              <div className="px-2 py-6 text-center">
                <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-xs text-muted-foreground">Chưa có lịch sử</p>
              </div>
            ) : (
              sessions.map((session) => (
                <div
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`group flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition-colors ${
                    activeSessionId === session.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground/80"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <MessageSquare className={`h-4 w-4 shrink-0 ${activeSessionId === session.id ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="truncate leading-tight">{session.title}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive transition-opacity"
                    onClick={(e) => deleteSession(session.id, e)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}

