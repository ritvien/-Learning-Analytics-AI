"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MessageSquare, X, Send, Bot, User, ChevronDown, Sparkles, Maximize2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { api, chatStreamV2 } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  statuses?: string[]
  isStreaming?: boolean
}

const WELCOME_MESSAGE = `Xin chào! Tôi là **VinUni AI Assistant** 🎓
Tôi có thể giúp bạn trả lời nhanh các câu hỏi giao tiếp hoặc tự động chuyển hướng bạn sang trang phân tích chuyên sâu nếu câu hỏi phức tạp. Hãy nhập câu hỏi của bạn!`

export function GlobalChatShell() {
  const router = useRouter()
  const pathname = usePathname()
  
  // Hide chat shell on the main chat page
  if (pathname === "/chat" || pathname === "/chatbot") {
    return null
  }

  return <GlobalChatWindow router={router} />
}

function GlobalChatWindow({ router }: { router: ReturnType<typeof useRouter> }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    }
  ])
  const [activeSessionId, setActiveSessionId] = React.useState<string | undefined>()
  const [input, setInput] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [expandedStatuses, setExpandedStatuses] = React.useState<Record<string, boolean>>({})
  
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  const handleNewChat = () => {
    setActiveSessionId(undefined)
    setMessages([
      {
        id: "welcome",
        role: "assistant",
        content: WELCOME_MESSAGE,
        timestamp: new Date(),
      }
    ])
  }

  async function sendMessage(text: string) {
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

    const controller = new AbortController()
    abortControllerRef.current = controller

    try {
      let fullContent = ""
      let hasStartedAnswering = false
      let currentSessionId = activeSessionId

      for await (const event of chatStreamV2({ message: text.trim(), thread_id: currentSessionId }, controller.signal)) {
        switch (event.type) {
          case "session_created":
            currentSessionId = event.thread_id
            setActiveSessionId(event.thread_id)
            break
            
          case "router":
            // Route decision handoff!
            if (event.intent === "core_agent") {
              // complex query -> full_chat handoff
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { 
                  ...m, 
                  statuses: [...(m.statuses || []), "🚀 Phát hiện câu hỏi phức tạp. Đang chuyển hướng sang trang phân tích chuyên sâu..."]
                } : m
              ))
              
              // Abort stream first
              controller.abort()
              
              // Redirect to full chat page with query and thread ID
              setTimeout(() => {
                setIsOpen(false)
                setIsLoading(false)
                router.push(`/chat?q=${encodeURIComponent(text)}&thread_id=${currentSessionId}`)
              }, 1200)
              return
            } else {
              // simple query -> inline response
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { 
                  ...m, 
                  statuses: [...(m.statuses || []), "💬 Câu hỏi đơn giản, trả lời trực tiếp tại đây."]
                } : m
              ))
            }
            break

          case "tool_call":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                statuses: [...(m.statuses || []), `⚙️ Đang sử dụng công cụ: ${event.tool}`]
              } : m
            ))
            break

          case "token":
            if (!hasStartedAnswering) {
              hasStartedAnswering = true
            }
            fullContent += event.content
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: fullContent } : m
            ))
            break

          case "done":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: fullContent, isStreaming: false } : m
            ))
            break

          case "error":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { ...m, content: `**Lỗi:** ${event.message}`, isStreaming: false } : m
            ))
            break
        }
      }
    } catch (error: any) {
      if (error.name === "AbortError") {
        return // Ignored since we intentionally aborted for redirection
      }
      const msg = error instanceof Error ? error.message : "Lỗi kết nối"
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, content: `**Lỗi:** ${msg}`, isStreaming: false } : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[380px] flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-250">
          {/* Header */}
          <div className="flex items-center justify-between border-b bg-primary px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              <div>
                <h3 className="text-sm font-semibold leading-none">VinUni Trợ lý AI</h3>
                <span className="text-[10px] text-primary-foreground/75">Trực tuyến</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/15 rounded-md"
                onClick={() => {
                  setIsOpen(false)
                  router.push("/chat")
                }}
                title="Mở toàn màn hình"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/15 rounded-md"
                onClick={() => setIsOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 bg-muted/10" ref={scrollRef}>
            <div className="flex flex-col gap-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-2 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    msg.role === "assistant"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {msg.role === "assistant" ? <Bot className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-tr-none"
                      : "bg-muted text-foreground rounded-tl-none"
                  }`}>
                    {/* Render content */}
                    {msg.role === "user" ? (
                      <p>{msg.content}</p>
                    ) : (
                      <div className="space-y-1">
                        {msg.statuses && msg.statuses.length > 0 && (
                          <div className="mb-2 space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                              <span className="text-[10px] text-muted-foreground font-medium truncate max-w-[200px]">
                                {msg.statuses[msg.statuses.length - 1]}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-4 text-[9px] hover:bg-muted p-1 px-1.5 font-semibold text-primary"
                                onClick={() => setExpandedStatuses(prev => ({ ...prev, [msg.id]: !prev[msg.id] }))}
                              >
                                {expandedStatuses[msg.id] ? "Thu gọn" : `Chi tiết (${msg.statuses.length})`}
                              </Button>
                            </div>
                            {expandedStatuses[msg.id] && (
                              <div className="flex flex-col gap-1 p-1.5 bg-muted/40 rounded-lg border text-[10px] text-muted-foreground max-h-24 overflow-y-auto">
                                {msg.statuses.map((status, idx) => (
                                  <div key={idx} className="flex items-center gap-1.5">
                                    <span className="h-1 w-1 rounded-full bg-emerald-500" />
                                    <span>{status}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <p className="whitespace-pre-line leading-relaxed">
                          {msg.content || (msg.isStreaming ? "Đang trả lời..." : "")}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Input Area */}
          <div className="border-t p-3 bg-background">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Hỏi trợ lý AI..."
                disabled={isLoading}
                className="h-9 rounded-lg text-xs"
              />
              <Button type="submit" size="icon" disabled={isLoading || !input.trim()} className="h-9 w-9 rounded-lg">
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </Button>
            </form>
          </div>
        </div>
      )}

      {/* Floating Action Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        size="icon"
        className="h-12 w-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </Button>
    </div>
  )
}
