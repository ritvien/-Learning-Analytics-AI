"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { MessageSquare, X, Send, Bot, User, Maximize2, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { api, chatStreamV2, getReportBuildContext, resolveChatHandoffRoute, type ApiReportBuildPlan } from "@/lib/api"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  statuses?: string[]
  isStreaming?: boolean
  reportPlan?: ApiReportBuildPlan & { reportUrl?: string }
  reportUrl?: string
  reportChoices?: boolean
}

type ReportScopeSelection = {
  id: string
  label: string
  scopeType: string
}

function reportScopeLabel(scopeType: string) {
  return {
    department: "khoa",
    program: "ngành",
    course: "môn học",
    section: "lớp học phần",
  }[scopeType] ?? "phạm vi"
}

function reportScopeOptions(value: unknown, fallbackScopeType: string): ReportScopeSelection[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const option = item as Record<string, unknown>
    const id = typeof option.id === "string" ? option.id : ""
    const label = typeof option.label === "string" ? option.label : ""
    const scopeType = typeof option.scope_type === "string" ? option.scope_type : fallbackScopeType
    return id && label && scopeType ? [{ id, label, scopeType }] : []
  })
}

function cleanAssistantText(value: string) {
  return value
    .replace(/<\/?strong>/gi, "")
    .replace(/<\/?em>/gi, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim()
}

function InlineMarkdown({ value }: { value: string }) {
  const parts = cleanAssistantText(value).split(/(\*\*[^*]+\*\*)/g)
  return <>{parts.map((part, index) => part.startsWith("**") && part.endsWith("**")
    ? <strong key={index}>{part.slice(2, -2)}</strong>
    : <React.Fragment key={index}>{part}</React.Fragment>)}</>
}

function AssistantMessageContent({ content }: { content: string }) {
  const lines = content.split("\n")
  const blocks: React.ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index].trim()
    if (!line || /^---+$/.test(line)) {
      index += 1
      continue
    }
    if (line.startsWith("|")) {
      const tableLines: string[] = []
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index].trim())
        index += 1
      }
      const rows = tableLines
        .filter((row) => !/^\|?\s*:?-{2,}/.test(row.replace(/\|/g, "|")))
        .map((row) => row.split("|").slice(1, -1).map((cell) => cleanAssistantText(cell.trim())))
      if (rows.length) {
        const [head, ...body] = rows
        blocks.push(
          <div key={`table-${index}`} className="overflow-x-auto rounded border bg-background">
            <table className="w-full min-w-max text-[11px]">
              <thead className="bg-muted/60"><tr>{head.map((cell, cellIndex) => <th key={cellIndex} className="px-2 py-1.5 text-left font-semibold"><InlineMarkdown value={cell} /></th>)}</tr></thead>
              <tbody className="divide-y">{body.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} className="px-2 py-1.5 align-top"><InlineMarkdown value={cell} /></td>)}</tr>)}</tbody>
            </table>
          </div>,
        )
      }
      continue
    }
    if (/^#{1,6}\s/.test(line)) {
      blocks.push(<p key={index} className="pt-1 text-xs font-semibold"><InlineMarkdown value={line.replace(/^#{1,6}\s*/, "")} /></p>)
      index += 1
      continue
    }
    if (/^[-*]\s+/.test(line)) {
      blocks.push(<div key={index} className="flex gap-1.5"><span className="text-muted-foreground">-</span><span><InlineMarkdown value={line.replace(/^[-*]\s+/, "")} /></span></div>)
      index += 1
      continue
    }
    blocks.push(<p key={index}><InlineMarkdown value={line} /></p>)
    index += 1
  }

  return <div className="space-y-1.5 leading-relaxed">{blocks}</div>
}

function mentionsReport(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes("báo cáo") || normalized.includes("bao cao") || normalized.includes("report")
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function isReportPermissionQuestion(value: string) {
  const ascii = normalizeText(value)
  return [
    "toi co quyen gi",
    "quyen cua toi",
    "quyen bao cao",
    "duoc tao bao cao nao",
    "duoc xem bao cao nao",
    "toi tao duoc bao cao nao",
    "tai khoan nay co quyen gi",
  ].some((term) => ascii.includes(term))
}

function isReportBuildRequest(message: string) {
  const normalized = message.toLowerCase()
  const report = mentionsReport(message)
  const build = ["tạo", "tao", "làm", "lam", "lập", "lap", "sinh", "build"].some((word) => normalized.includes(word))
  return report && build
}

function isReportCustomizationRequest(message: string) {
  const normalized = message.toLowerCase()
  return mentionsReport(message) && ["tùy chỉnh", "tuy chinh", "theo yêu cầu", "theo yeu cau", "custom"].some((word) => normalized.includes(word))
}

function reportBuildContext(pathname: string) {
  const published = getReportBuildContext(pathname)
  if (published) return published
  const params = new URLSearchParams(window.location.search)
  const scopeType = pathname.includes("/analytics/sections")
    ? "section"
    : pathname.includes("/analytics/courses")
      ? "course"
      : pathname.includes("/analytics/programs")
        ? "program"
        : pathname.includes("/analytics/departments")
          ? "department"
          : undefined
  const scopeId = params.get("section_id") ?? params.get("section") ?? params.get("course_id") ?? params.get("course") ?? params.get("program_id") ?? params.get("program") ?? params.get("department_id") ?? params.get("department")
  return {
    source: "global_chat",
    route: pathname,
    scope: {
      scope_type: scopeType,
      scope_id: scopeId ?? undefined,
      semester_id: params.get("semester_id") ?? undefined,
    },
  }
}

const WELCOME_MESSAGE = `Xin chào! Tôi là **VinUni AI Assistant** 🎓
Tôi có thể hỗ trợ phân tích dữ liệu, đi sâu vào dashboard và chuẩn bị báo cáo theo phạm vi bạn được phép xem. Hãy nói cho tôi mục tiêu bạn đang cần.`

export function GlobalChatShell() {
  const router = useRouter()
  const pathname = usePathname()
  
  // Hide chat shell on the main chat page
  if (pathname === "/chat" || pathname === "/chatbot") {
    return null
  }

  return <GlobalChatWindow router={router} pathname={pathname} />
}

function GlobalChatWindow({
  router,
  pathname,
}: {
  router: ReturnType<typeof useRouter>
  pathname: string
}) {
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
  const [reportIntakeActive, setReportIntakeActive] = React.useState(false)
  const [reportIntakeMode, setReportIntakeMode] = React.useState<"template" | "custom">("template")
  const [reportRequest, setReportRequest] = React.useState("")
  const [reportBuildSessionId, setReportBuildSessionId] = React.useState<string | undefined>()
  
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const abortControllerRef = React.useRef<AbortController | null>(null)
  const wrapperRef = React.useRef<HTMLDivElement>(null)

  // ── Drag state ────────────────────────────────────────────────────
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const dragRef = React.useRef<{
    startX: number
    startY: number
    elemX: number
    elemY: number
    moved: boolean
  } | null>(null)

  // Initialize to bottom-right corner (client-side only)
  React.useEffect(() => {
    setPos({
      x: window.innerWidth - 80,
      y: window.innerHeight - 80,
    })
  }, [])

  const handleFabPointerDown = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    // Only primary button (left click / touch)
    if (e.button !== 0 && e.pointerType === "mouse") return
    e.currentTarget.setPointerCapture(e.pointerId)
    const rect = wrapperRef.current?.getBoundingClientRect()
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      elemX: rect?.left ?? 0,
      elemY: rect?.top ?? 0,
      moved: false,
    }
  }, [])

  const handleFabPointerMove = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const dy = e.clientY - dragRef.current.startY
    // Threshold: 4px before we consider it a drag
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      if (!dragRef.current.moved) {
        dragRef.current.moved = true
        setIsDragging(true)
      }
    }
    if (dragRef.current.moved) {
      const FAB_SIZE = 56
      const newX = dragRef.current.elemX + dx
      const newY = dragRef.current.elemY + dy
      setPos({
        x: Math.max(0, Math.min(newX, window.innerWidth - FAB_SIZE)),
        y: Math.max(0, Math.min(newY, window.innerHeight - FAB_SIZE)),
      })
    }
  }, [])

  const handleFabPointerUp = React.useCallback((e: React.PointerEvent<HTMLButtonElement>) => {
    e.currentTarget.releasePointerCapture(e.pointerId)
    setIsDragging(false)
    if (!dragRef.current?.moved) {
      // Treat as a click — toggle chat
      setIsOpen((prev) => !prev)
    }
    dragRef.current = null
  }, [setIsOpen])
  // ─────────────────────────────────────────────────────────────────

  React.useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, isOpen])

  async function sendMessage(text: string, scopeSelection?: ReportScopeSelection) {
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

    if (isReportPermissionQuestion(text)) {
      const assistantMsgId = `report-permission-${Date.now()}`
      try {
        const plan = await api.planReportBuild({
          message: text.trim(),
          context: {
            ...reportBuildContext(pathname),
            source: "global_chat",
          },
        })
        setMessages(prev => [...prev, {
          id: assistantMsgId,
          role: "assistant",
          content: plan.message,
          timestamp: new Date(),
        }])
        setReportIntakeActive(false)
        setReportIntakeMode("template")
        setReportRequest("")
        setReportBuildSessionId(undefined)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Không kiểm tra được quyền báo cáo"
        setMessages(prev => [...prev, {
          id: assistantMsgId,
          role: "assistant",
          content: `Không kiểm tra được quyền báo cáo lúc này. Chi tiết: ${message}`,
          timestamp: new Date(),
        }])
      } finally {
        setIsLoading(false)
      }
      return
    }

    if (isReportCustomizationRequest(text) && !reportIntakeActive) {
      setMessages(prev => [...prev, {
        id: `report-custom-${Date.now()}`,
        role: "assistant",
        content: "Tôi sẽ thiết kế báo cáo theo yêu cầu của bạn. Trước khi tạo, hãy cho tôi brief theo 6 ý: (1) người đọc và quyết định cần đưa ra, (2) phạm vi dữ liệu, (3) học kỳ/khoảng thời gian, (4) câu hỏi hoặc chỉ số cần trả lời, (5) cần so sánh với gì, (6) visual hoặc bảng bạn muốn thấy. Sau khi tạo xong tôi sẽ trả link trang báo cáo.",
        timestamp: new Date(),
      }])
      setReportIntakeActive(true)
      setReportRequest(text.trim())
      setReportIntakeMode("custom")
      setIsLoading(false)
      return
    }

    if (mentionsReport(text) && !reportIntakeActive) {
      setMessages(prev => [...prev, {
        id: `report-intake-${Date.now()}`,
        role: "assistant",
        content: "Được. Tôi đã nhận yêu cầu tạo báo cáo. Trước khi gọi tool, hãy chốt giúp tôi: (1) phạm vi cần báo cáo, (2) học kỳ hoặc khoảng thời gian, (3) mục tiêu/câu hỏi chính. Tạo xong tôi sẽ gửi link mở trang báo cáo.",
        timestamp: new Date(),
        reportChoices: true,
      }])
      setReportIntakeActive(true)
      setReportRequest(text.trim())
      setReportIntakeMode("template")
      setIsLoading(false)
      return
    }

    if (isReportBuildRequest(text) || reportIntakeActive) {
      const assistantMsgId = `report-plan-${Date.now()}`
      const planMessage = reportBuildSessionId
        ? text.trim()
        : reportIntakeActive
        ? `${reportRequest}\nThông tin bổ sung: ${text.trim()}`
        : text.trim()
      try {
        const plan = await api.planReportBuild({
          message: planMessage,
          session_id: reportBuildSessionId,
          context: {
            ...reportBuildContext(pathname),
            ...(scopeSelection
              ? {
                  scope: {
                    scope_type: scopeSelection.scopeType,
                    scope_id: scopeSelection.id,
                    scope_label: scopeSelection.label,
                  },
                }
              : {}),
            ...(reportIntakeMode === "custom" ? { custom_request: planMessage } : {}),
          },
        })
        setMessages(prev => [...prev, {
          id: assistantMsgId,
          role: "assistant",
          content: plan.message,
          timestamp: new Date(),
          reportPlan: plan,
        }])
        setReportBuildSessionId(plan.session_id)
        const status = String(plan.data_quality?.status ?? "")
        if (plan.action_id || status === "blocked" || status === "permission_info") {
          setReportIntakeActive(false)
          setReportIntakeMode("template")
          setReportRequest("")
          if (plan.action_id) setReportBuildSessionId(undefined)
        } else {
          setReportIntakeActive(true)
          setReportRequest(reportRequest || planMessage)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Không thể chuẩn bị báo cáo"
        setMessages(prev => [...prev, {
          id: assistantMsgId,
          role: "assistant",
          content: `**Lỗi khi chuẩn bị báo cáo:** ${message}`,
          timestamp: new Date(),
        }])
      } finally {
        setIsLoading(false)
      }
      return
    }

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

      let handoffHandled = false

      for await (const event of chatStreamV2(
        { message: text.trim(), thread_id: currentSessionId },
        controller.signal,
      )) {
        switch (event.type) {
          case "session_created":
            currentSessionId = event.thread_id
            setActiveSessionId(event.thread_id)
            break
            
          case "router": {
            const routingLabel =
              event.intent === "core_agent" ? "Suy luận phức tạp" : "Suy luận đơn giản"
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                statuses: [...(m.statuses || []), `🧠 Định tuyến: ${routingLabel}`]
              } : m
            ))
            break
          }

          case "route_decision":
            if (event.route_decision.mode === "full_chat") {
              handoffHandled = true
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { 
                  ...m, 
                  statuses: [...(m.statuses || []), "🚀 Phát hiện câu hỏi phức tạp. Đang chuyển hướng sang trang phân tích chuyên sâu..."]
                } : m
              ))

              controller.abort()

              const target = resolveChatHandoffRoute(event.route_decision.target_route)
              const query = new URLSearchParams({
                q: text.trim(),
                ...(currentSessionId ? { thread_id: currentSessionId } : {}),
              })
              setTimeout(() => {
                setIsOpen(false)
                setIsLoading(false)
                router.push(`${target}?${query.toString()}`)
              }, 1200)
              return
            }

            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? { 
                ...m, 
                statuses: [...(m.statuses || []), `💬 Trả lời tại ${pathname} (${event.route_decision.reason})`]
              } : m
            ))
            break

          case "tool_call":
            if (handoffHandled) break
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
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === "AbortError") {
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

  async function confirmReportPlan(messageId: string, plan: ApiReportBuildPlan) {
    if (!plan.action_id || isLoading) return
    setIsLoading(true)
    try {
      const result = await api.confirmReportAgentAction(plan.action_id, { action: "confirm" })
      const reportUrl = typeof result.result.report_url === "string" ? result.result.report_url : undefined
      setMessages(prev => prev.map((message) => message.id === messageId
        ? {
            ...message,
            content: reportUrl ? "Đã tạo báo cáo." : "Đã xác nhận tạo báo cáo.",
            reportPlan: undefined,
            reportUrl,
          }
        : message))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể tạo báo cáo"
      setMessages(prev => prev.map((item) => item.id === messageId ? { ...item, content: `**Lỗi khi tạo báo cáo:** ${message}` } : item))
    } finally {
      setIsLoading(false)
    }
  }

  // Determine panel open direction based on FAB position
  const panelAbove = !pos || pos.y > window.innerHeight * 0.45
  const panelLeft  = !pos || pos.x > window.innerWidth  * 0.50

  return (
    <div
      ref={wrapperRef}
      style={pos
        ? { position: "fixed", left: pos.x, top: pos.y, zIndex: 50 }
        : { position: "fixed", bottom: 24, right: 24, zIndex: 50 }
      }
    >
      {isOpen && (
        <div
          style={{
            position: "absolute",
            ...(panelAbove ? { bottom: 60 } : { top: 60 }),
            ...(panelLeft  ? { right: 0   } : { left:  0   }),
          }}
          className="flex h-[500px] w-[380px] flex-col rounded-2xl border bg-card text-card-foreground shadow-2xl overflow-hidden animate-in slide-in-from-bottom-5 duration-250"
        >
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
                        <AssistantMessageContent content={msg.content || (msg.isStreaming ? "Đang trả lời..." : "")} />
                        {msg.reportPlan && !["blocked", "permission_info"].includes(String(msg.reportPlan.data_quality?.status ?? "")) ? (() => {
                          const scopeType = typeof msg.reportPlan.definition.scope_type === "string"
                            ? msg.reportPlan.definition.scope_type
                            : ""
                          const scopeLabel = reportScopeLabel(scopeType)
                          const scopeOptions = reportScopeOptions(msg.reportPlan.definition.scope_options, scopeType)
                          if (scopeOptions.length > 0) {
                            return (
                              <div className="mt-3 space-y-2 rounded-md border bg-background/70 p-2 text-[11px] text-foreground">
                                <p className="font-semibold">Chọn {scopeLabel}</p>
                                <div className="grid gap-1.5">
                                  {scopeOptions.map((option) => (
                                    <Button
                                      key={option.id}
                                      variant="outline"
                                      size="sm"
                                      className="h-auto min-h-8 justify-start whitespace-normal px-2 py-1.5 text-left text-[11px]"
                                      disabled={isLoading}
                                      onClick={() => void sendMessage(
                                        `Chọn ${reportScopeLabel(option.scopeType)} ${option.label}`,
                                        option,
                                      )}
                                    >
                                      {option.label}
                                    </Button>
                                  ))}
                                </div>
                              </div>
                            )
                          }
                          return (
                          <div className="mt-3 space-y-2 rounded-md border bg-background/70 p-2 text-[11px] text-foreground">
                            <div className="font-semibold">Bản nháp báo cáo</div>
                            <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-muted-foreground">
                              <span>Mẫu</span><span className="text-right font-medium text-foreground">{String(msg.reportPlan.definition.template_label ?? msg.reportPlan.definition.report_type ?? "—")}</span>
                              <span>Phạm vi</span><span className="text-right font-medium text-foreground">{String(msg.reportPlan.definition.scope_type ?? "—")}</span>
                              <span>Trạng thái dữ liệu</span><span className="text-right font-medium text-foreground">{String(msg.reportPlan.data_quality.status ?? "—")}</span>
                            </div>
                            {Array.isArray(msg.reportPlan.definition.outline) ? <div><p className="mt-2 font-medium">Nội dung dự kiến</p><p className="mt-1 text-muted-foreground">{(msg.reportPlan.definition.outline as string[]).join(" · ")}</p></div> : null}
                            {Array.isArray(msg.reportPlan.definition.visuals) ? <div><p className="mt-2 font-medium">Visual dự kiến</p><p className="mt-1 text-muted-foreground">{(msg.reportPlan.definition.visuals as string[]).join(" · ")}</p></div> : null}
                            {msg.reportPlan.missing_fields.length ? (
                              <p className="text-amber-700">Cần bổ sung: {msg.reportPlan.missing_fields.join(", ")}</p>
                            ) : msg.reportPlan.reportUrl ? (
                              <Button size="sm" className="w-full" onClick={() => router.push(msg.reportPlan?.reportUrl ?? "/manager/reports")}>Mở báo cáo</Button>
                            ) : msg.reportPlan.action_id ? (
                              <Button size="sm" className="w-full" onClick={() => void confirmReportPlan(msg.id, msg.reportPlan!)} disabled={isLoading}>Xác nhận tạo snapshot</Button>
                            ) : null}
                          </div>
                          )
                        })() : null}
                        {msg.reportUrl ? <a href={msg.reportUrl} className="mt-2 block font-medium text-primary underline underline-offset-2">Mở báo cáo vừa tạo</a> : null}
                        {msg.reportChoices ? (
                          <div className="mt-3 grid gap-2">
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tạo báo cáo lớp đang xem, dùng điểm giữa kỳ")}>Báo cáo lớp / can thiệp</Button>
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tạo báo cáo sức khỏe môn học đang xem")}>Báo cáo môn học</Button>
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tạo báo cáo sức khỏe ngành đang xem cho học kỳ hiện tại")}>Báo cáo ngành</Button>
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tạo báo cáo sức khỏe khoa đang xem")}>Báo cáo khoa</Button>
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tạo báo cáo toàn trường cho học kỳ hiện tại")}>Tóm tắt toàn trường</Button>
                            <Button variant="outline" size="sm" onClick={() => void sendMessage("Tôi muốn báo cáo tùy chỉnh theo yêu cầu")}>Báo cáo tùy chỉnh</Button>
                          </div>
                        ) : null}
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

      {/* Floating Action Button — draggable */}
      <Button
        onPointerDown={handleFabPointerDown}
        onPointerMove={handleFabPointerMove}
        onPointerUp={handleFabPointerUp}
        size="icon"
        title={isOpen ? "Đóng chat" : "Mở trợ lý AI"}
        style={{ cursor: isDragging ? "grabbing" : "grab", touchAction: "none" }}
        className="h-12 w-12 rounded-full shadow-lg transition-transform duration-200 hover:scale-105 active:scale-95 bg-primary text-primary-foreground select-none"
      >
        {isOpen ? <X className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
      </Button>
    </div>
  )
}
