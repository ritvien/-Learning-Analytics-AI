"use client"

import * as React from "react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Send, Bot, User, Sparkles, BarChart2, BookOpen, AlertTriangle, MessageSquare, Plus, Trash2, ChevronDown } from "lucide-react"
import { api, chatStreamV2, ChatSessionSummary, getReportBuildContext, invalidateApiCacheByPrefix, type ApiReportBuildPlan } from "@/lib/api"
import { getDashboardAgentContext } from "@/lib/dashboard-agent-context"
import { ServerBusyRetry } from "@/components/chat/server-busy-retry"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  isStreaming?: boolean
  intent?: string
  latencyMs?: number
  statuses?: string[]
  reportPlan?: ApiReportBuildPlan
  reportUrl?: string
  retryText?: string
}

type ReportBrief = {
  report_type?: string
  report_label?: string
  scope?: {
    scope_type?: string
    scope_id?: string
    scope_label?: string
  }
  period_label?: string
  purpose?: string
  filters?: string[]
  filters_confirmed?: boolean
}

type ReportScopeOption = {
  id: string
  label: string
  scopeType: string
}

const SUGGESTED_PROMPTS = [
  { icon: BarChart2, text: "Môn nào có tỷ lệ trượt cao nhất học kỳ này?" },
  { icon: BookOpen, text: "Ngành Công nghệ thông tin có những môn nào bắt buộc?" },
  { icon: AlertTriangle, text: "Sinh viên nào đang có nguy cơ bị đình chỉ học?" },
  { icon: Sparkles, text: "GPA trung bình khóa 2022 so với khóa 2021 như thế nào?" },
]

const WELCOME_MESSAGE = `Xin chào, tôi là trợ lý phân tích học vụ VinUni.

Tôi có thể phân tích kết quả học tập, tra cứu chương trình đào tạo, tìm sinh viên cần hỗ trợ và cùng bạn xây dựng báo cáo. Khi cần báo cáo, tôi sẽ hỏi rõ phạm vi, thời gian và mục tiêu trước khi tạo link báo cáo.`

function cleanAssistantText(value: string) {
  return value
    .replace(/<\/?(?:strong|em|br)\s*\/?>/gi, "")
    .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "")
    .replace(/\*\*/g, "")
    .replace(/^\s*#{1,6}\s*/gm, "")
    .trim()
}

function renderContent(text: string) {
  return cleanAssistantText(text).split("\n").map((rawLine, index) => {
    const line = rawLine.trim()
    if (!line) return <div key={index} className="h-2" />
    if (line.startsWith("|")) {
      const cells = line.split("|").filter(Boolean).map((cell) => cell.trim())
      if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) return null
      return <div key={index} className="text-sm text-muted-foreground">{cells.join(" · ")}</div>
    }
    if (/^(?:[-*]|\d+\.)\s+/.test(line)) {
      return <div key={index} className="flex gap-2 text-sm"><span className="text-primary">•</span><span>{line.replace(/^(?:[-*]|\d+\.)\s+/, "")}</span></div>
    }
    return <p key={index} className="text-sm leading-6">{line}</p>
  })
}

function isReportRequest(value: string) {
  const normalized = value.toLocaleLowerCase("vi-VN")
  const ascii = normalizeText(value)
  return (
    normalized.includes("báo cáo")
    || ascii.includes("bao cao")
    || ascii.includes("report")
    || /\b(?:tao|lam|lap|sinh|viet)\s+bao\b/.test(ascii)
  )
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("vi-VN").normalize("NFD").replace(/[\u0300-\u036f]/g, "")
}

function isVagueReportRequest(value: string) {
  const ascii = normalizeText(value)
  const hasSpecificScope = [
    "toan truong",
    "tong quan truong",
    "khoa",
    "nganh",
    "cntt",
    "cong nghe thong tin",
    "mon",
    "hoc phan",
    "lop",
    "sinh vien",
    "canh bao",
    "nguy co",
    "plo",
    "clo",
    "gpa",
    "ty le truot",
  ].some((term) => ascii.includes(term))
  return isReportRequest(value) && !hasSpecificScope
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

function emptyReportBrief(): ReportBrief {
  return {}
}

function extractReportBrief(value: string): ReportBrief {
  const text = normalizeText(value)
  const next: ReportBrief = {}

  if (text.includes("tong quan truong") || text.includes("toan truong") || text.includes("truong di") || text.includes("bao cao truong")) {
    next.report_type = "school_overview"
    next.report_label = "Tổng quan trường"
    next.scope = { scope_type: "school", scope_label: "Toàn trường" }
  } else if (text.includes("suc khoe khoa") || /\bkhoa\b/.test(text)) {
    next.report_type = "department_health"
    next.report_label = "Sức khỏe khoa"
    next.scope = { scope_type: "department", scope_label: "Khoa cần xác định" }
  } else if (text.includes("suc khoe nganh") || text.includes("nganh") || text.includes("cntt") || text.includes("cong nghe thong tin")) {
    next.report_type = "program_health"
    next.report_label = "Sức khỏe ngành"
    next.scope = {
      scope_type: "program",
      scope_label: text.includes("cntt") || text.includes("cong nghe thong tin") ? "Công nghệ thông tin" : "Ngành cần xác định",
    }
  } else if (
    text.includes("lop hoc phan")
    || text.includes("can thiep lop")
    || text.includes("lop toi day")
    || text.includes("lop minh day")
    || text.includes("cac lop toi day")
  ) {
    next.report_type = "section_intervention"
    next.report_label = "Can thiệp lớp học phần"
    next.scope = {
      scope_type: "section",
      scope_label: text.includes("toi day") || text.includes("minh day")
        ? "Các lớp tôi dạy"
        : "Lớp học phần cần xác định",
    }
  } else if (text.includes("suc khoe mon") || text.includes("mon hoc") || text.includes("hoc phan")) {
    next.report_type = "course_health"
    next.report_label = "Sức khỏe môn học"
    next.scope = { scope_type: "course", scope_label: "Môn học cần xác định" }
  } else if (text.includes("sinh vien nguy co") || text.includes("canh bao hoc vu")) {
    next.report_type = "student_risk_custom"
    next.report_label = "Sinh viên nguy cơ"
    next.scope = { scope_type: "school", scope_label: "Toàn trường" }
    next.filters = ["Sinh viên nguy cơ"]
  }

  if (text.includes("hoc ky hien tai") || text.includes("ky hien tai") || text.includes("ky nay")) {
    next.period_label = "Học kỳ hiện tại"
  } else {
    const semesterMatch = value.match(/(?:học kỳ|hoc ky|hk)\s*([0-9]{4}[-\s]?[12])|([0-9]{4}[-\s]?[12])/i)
    if (semesterMatch?.[1] || semesterMatch?.[2]) {
      next.period_label = `Học kỳ ${(semesterMatch[1] || semesterMatch[2]).replace(/\s+/g, "-")}`
    } else {
      const yearMatch = value.match(/(?:năm học|nam hoc)\s*([0-9]{4}\s*[-–]\s*[0-9]{4})/i)
      if (yearMatch?.[1]) {
        next.period_label = `Năm học ${yearMatch[1].replace(/\s+/g, "")}`
      } else {
        const singleYearMatch = text.match(/\b(?:nam\s*)?(20[0-9]{2})\b/)
        if (singleYearMatch?.[1]) next.period_label = `Năm ${singleYearMatch[1]}`
      }
    }
  }

  if (text.includes("hop") || text.includes("quan ly") || text.includes("tong quan")) {
    next.purpose = "Họp quản lý và theo dõi chất lượng đào tạo"
  } else if (text.includes("canh bao") || text.includes("nguy co") || text.includes("can thiep")) {
    next.purpose = "Cảnh báo học vụ và ưu tiên can thiệp"
  } else if (text.includes("kiem dinh") || text.includes("minh chung") || text.includes("plo") || text.includes("clo")) {
    next.purpose = "Minh chứng kiểm định/đảm bảo chất lượng"
  } else if (text.includes("cai thien") || text.includes("ty le truot") || text.includes("diem thap")) {
    next.purpose = "Cải thiện môn học và giảm rủi ro kết quả"
  } else if (text.includes("theo doi")) {
    next.purpose = "Theo dõi tiến độ và kết quả lớp học phần"
  }

  const filters: string[] = []
  if (text.includes("gpa")) filters.push("GPA")
  if (text.includes("ty le truot") || text.includes("truot cao")) filters.push("Tỷ lệ trượt")
  if (text.includes("sinh vien nguy co") || text.includes("sv nguy co")) filters.push("Sinh viên nguy cơ")
  if (text.includes("diem thieu") || text.includes("chua co diem")) filters.push("Điểm thiếu")
  if (text.includes("mon rui ro") || text.includes("mon yeu")) filters.push("Môn rủi ro")
  if (filters.length > 0) {
    next.filters = filters
    next.filters_confirmed = true
  }
  if (text.includes("khong loc") || text.includes("tat ca") || text.includes("mac dinh")) {
    next.filters = []
    next.filters_confirmed = true
  }

  return next
}

function mergeReportBrief(previous: ReportBrief, update: ReportBrief): ReportBrief {
  return {
    ...previous,
    ...update,
    scope: update.scope ? { ...(previous.scope ?? {}), ...update.scope } : previous.scope,
    filters: update.filters ?? previous.filters,
    filters_confirmed: update.filters_confirmed ?? previous.filters_confirmed,
  }
}

function reportBriefToContext(brief: ReportBrief) {
  return {
    report_type: brief.report_type === "student_risk_custom" ? "school_overview" : brief.report_type,
    scope: {
      scope_type: brief.scope?.scope_type,
      scope_id: brief.scope?.scope_id,
      scope_label: brief.scope?.scope_label,
    },
    period_label: brief.period_label,
    purpose: brief.purpose,
    output_format: "link",
    filters: {
      focus: brief.filters ?? [],
    },
    brief,
  }
}

function textValue(value: unknown, fallback = "Chưa xác định") {
  if (typeof value === "string" && value.trim()) return value.trim()
  if (typeof value === "number") return String(value)
  return fallback
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.map((item) => textValue(item, "")).filter(Boolean)
    : []
}

function reportScopeLabel(scopeType: string) {
  return {
    department: "khoa",
    program: "ngành",
    course: "môn học",
    section: "lớp học phần",
  }[scopeType] ?? "phạm vi"
}

function reportScopeOptions(value: unknown, fallbackScopeType: string): ReportScopeOption[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return []
    const option = item as Record<string, unknown>
    const id = textValue(option.id, "")
    const label = textValue(option.label, "")
    const scopeType = textValue(option.scope_type, fallbackScopeType)
    return id && label && scopeType ? [{ id, label, scopeType }] : []
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
  const [expandedStatuses, setExpandedStatuses] = React.useState<Record<string, boolean>>({})
  const [reportIntakeActive, setReportIntakeActive] = React.useState(false)
  const [reportRequest, setReportRequest] = React.useState("")
  const [reportBrief, setReportBrief] = React.useState<ReportBrief>(emptyReportBrief())
  const [reportBuildSessionId, setReportBuildSessionId] = React.useState<string | undefined>()
  
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const autoSentRef = React.useRef(false)

  // Fetch sessions on mount
  React.useEffect(() => {
    fetchSessions()
  }, [])

  async function fetchSessions() {
    try {
      // Chat mutations happen via a raw fetch stream that bypasses the GET
      // cache, so invalidate here to guarantee a fresh listing from the server.
      invalidateApiCacheByPrefix("/api/v1/chat/sessions")
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
    const threadId = searchParams.get("thread_id")
    if (threadId && !autoSentRef.current) {
      autoSentRef.current = true
      loadSession(threadId).then(() => {
        if (q) {
          setTimeout(() => sendMessage(q, threadId), 300)
        }
      })
    } else if (q && !autoSentRef.current) {
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
      setReportIntakeActive(false)
      setReportRequest("")
      setReportBrief(emptyReportBrief())
      setReportBuildSessionId(undefined)
      
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
    setReportIntakeActive(false)
    setReportRequest("")
    setReportBrief(emptyReportBrief())
    setReportBuildSessionId(undefined)
    setMessages([{
      id: "welcome",
      role: "assistant",
      content: WELCOME_MESSAGE,
      timestamp: new Date(),
    }])
  }

  async function sendMessage(
    text: string,
    threadIdOverride?: string,
    reportBriefUpdate?: ReportBrief,
  ) {
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
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: "assistant",
        content: "Tôi đang kiểm tra quyền báo cáo của tài khoản hiện tại.",
        timestamp: new Date(),
        isStreaming: true,
        statuses: ["Đang kiểm tra quyền báo cáo..."],
      }])
      try {
        const plan = await api.planReportBuild({
          message: text.trim(),
          session_id: reportBuildSessionId,
          context: {
            source: "full_chat",
            route: "/chat",
          },
        })
        setMessages(prev => prev.map((message) => message.id === assistantMsgId
          ? {
              ...message,
              content: plan.message,
              isStreaming: false,
              statuses: ["Đã kiểm tra quyền báo cáo"],
            }
          : message))
        setReportIntakeActive(false)
        setReportRequest("")
        setReportBrief(emptyReportBrief())
        setReportBuildSessionId(plan.session_id)
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Không kiểm tra được quyền báo cáo"
        setMessages(prev => prev.map((item) => item.id === assistantMsgId
          ? {
              ...item,
              content: `Không kiểm tra được quyền báo cáo lúc này. Chi tiết: ${message}`,
              isStreaming: false,
              statuses: ["Kiểm tra quyền thất bại"],
            }
          : item))
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
      }
      return
    }

    if (isReportRequest(text) || isVagueReportRequest(text) || reportIntakeActive) {
      const assistantMsgId = `report-plan-${Date.now()}`
      const extractedBrief = extractReportBrief(text)
      const nextBrief = mergeReportBrief(
        reportIntakeActive ? reportBrief : emptyReportBrief(),
        reportBriefUpdate ? mergeReportBrief(extractedBrief, reportBriefUpdate) : extractedBrief,
      )
      const planMessage = reportBuildSessionId
        ? text.trim()
        : reportIntakeActive
        ? `${reportRequest}\nThông tin bổ sung: ${text.trim()}`
        : text.trim()
      setMessages(prev => [...prev, {
        id: assistantMsgId,
        role: "assistant",
        content: reportIntakeActive
          ? "Tôi đang cập nhật brief báo cáo từ thông tin bạn vừa bổ sung."
          : "Tôi đang đọc yêu cầu báo cáo và kiểm tra xem brief đã đủ để tạo bản nháp chưa.",
        timestamp: new Date(),
        isStreaming: true,
        statuses: ["Đang kiểm tra ngữ cảnh báo cáo..."],
      }])

      try {
        const activeReportContext = getReportBuildContext("/chat")
        const plan = await api.planReportBuild({
          message: planMessage,
          session_id: reportBuildSessionId,
          context: {
            ...(activeReportContext ?? {}),
            ...reportBriefToContext(nextBrief),
            source: "full_chat",
            route: "/chat",
            custom_request: planMessage,
          },
        })
        setMessages(prev => prev.map((message) => message.id === assistantMsgId
          ? {
              ...message,
              content: plan.action_id
                ? "Tôi đã dựng bản nháp báo cáo. Bạn kiểm tra nhanh phạm vi, cấu trúc và biểu đồ dự kiến bên dưới; nếu đúng thì bấm tạo báo cáo để nhận đường link."
                : plan.message || "Tôi chưa tạo được bản nháp vì còn thiếu thông tin quan trọng. Bạn bổ sung thêm phạm vi hoặc thời gian cụ thể giúp tôi.",
              isStreaming: false,
              statuses: [
                plan.action_id
                  ? "Đã tạo bản nháp báo cáo"
                  : String(plan.data_quality?.status ?? "") === "blocked"
                    ? "Yêu cầu nằm ngoài quyền"
                    : String(plan.data_quality?.status ?? "") === "permission_info"
                      ? "Đã kiểm tra quyền báo cáo"
                      : "Cần bổ sung ngữ cảnh báo cáo",
              ],
              reportPlan: plan,
            }
          : message))
        setReportBuildSessionId(plan.session_id)
        if (plan.action_id) {
          setReportIntakeActive(false)
          setReportRequest("")
          setReportBrief(emptyReportBrief())
          setReportBuildSessionId(undefined)
        } else if (["blocked", "permission_info"].includes(String(plan.data_quality?.status ?? ""))) {
          setReportIntakeActive(false)
          setReportRequest("")
          setReportBrief(emptyReportBrief())
        } else {
          setReportIntakeActive(true)
          setReportRequest(planMessage)
          setReportBrief(nextBrief)
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Không thể chuẩn bị báo cáo"
        setMessages(prev => prev.map((item) => item.id === assistantMsgId
          ? {
              ...item,
              content: `Không thể chuẩn bị báo cáo lúc này. Chi tiết: ${message}`,
              isStreaming: false,
              statuses: ["Chuẩn bị báo cáo thất bại"],
            }
          : item))
      } finally {
        setIsLoading(false)
        inputRef.current?.focus()
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

    try {
      let fullContent = ""
      let hasStartedAnswering = false
      const targetThreadId = threadIdOverride !== undefined ? threadIdOverride : activeSessionId

      const treeContext = getDashboardAgentContext("/chat")
      for await (const event of chatStreamV2({
        message: text.trim(),
        thread_id: targetThreadId,
        context: treeContext ? {
          source: treeContext.source,
          dashboard_type: treeContext.dashboard_type,
          scope: treeContext.scope,
        } : undefined,
      })) {
        switch (event.type) {
          case "session_created":
            setActiveSessionId(event.thread_id)
            setSessions(prev => [{ id: event.thread_id, title: event.title, updated_at: new Date().toISOString() }, ...prev])
            // Backend just persisted a new ChatSession row; invalidate the
            // cached listing so any subsequent GET (e.g. on remount) is fresh.
            invalidateApiCacheByPrefix("/api/v1/chat/sessions")
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

          case "route_decision":
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId ? {
                ...m,
                statuses: [...(m.statuses || []), `📍 ${event.route_decision.mode === "full_chat" ? "Chế độ phân tích đầy đủ" : "Trả lời tại trang hiện tại"}: ${event.route_decision.reason}`],
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
            // Fallback: if `session_created` was missed (e.g. dropped SSE
            // chunk), still bind the session id to the UI from `done`.
            if (event.thread_id && !activeSessionId) {
              setActiveSessionId(event.thread_id)
            }
            // The backend has now persisted the merged history + short_summary.
            // Refresh the sidebar so titles/timestamps stay accurate.
            void fetchSessions()
            break

          case "error": {
            // H67d: server-busy/timeout rejections carry a friendly message
            // and (for busy) a retry affordance instead of a raw system error.
            const friendly = event.code === "server_busy" || event.code === "agent_timeout"
            setMessages(prev => prev.map(m =>
              m.id === assistantMsgId
                ? {
                    ...m,
                    content: friendly ? event.message : `**Lỗi hệ thống:** ${event.message}`,
                    isStreaming: false,
                    retryText: event.code === "server_busy" ? text.trim() : undefined,
                  }
                : m
            ))
            break
          }
        }
      }

      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId ? { ...m, isStreaming: false } : m
      ))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không rõ lỗi"
      const isBusy429 = message.startsWith("API 429")
      setMessages(prev => prev.map(m =>
        m.id === assistantMsgId
          ? {
              ...m,
              content: isBusy429
                ? "Server đang bận xử lý nhiều yêu cầu cùng lúc. Vui lòng thử lại sau ít phút."
                : `**Lỗi hệ thống:** Không thể kết nối với Agent.\n\nChi tiết: ${message}`,
              isStreaming: false,
              retryText: isBusy429 ? text.trim() : undefined,
            }
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

  async function confirmReportPlan(messageId: string, plan: ApiReportBuildPlan) {
    if (!plan.action_id || isLoading) return
    setIsLoading(true)
    try {
      const result = await api.confirmReportAgentAction(plan.action_id, { action: "confirm" })
      const reportUrl = typeof result.result.report_url === "string" ? result.result.report_url : undefined
      setMessages(prev => prev.map((message) => message.id === messageId
        ? {
            ...message,
            content: reportUrl
              ? "Đã tạo báo cáo. Bạn mở đường link bên dưới để xem chi tiết."
              : "Đã xác nhận tạo báo cáo, nhưng hệ thống chưa trả về đường link.",
            reportPlan: undefined,
            reportUrl,
          }
        : message))
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Không thể tạo báo cáo"
      setMessages(prev => prev.map((item) => item.id === messageId
        ? { ...item, content: `Không thể tạo báo cáo. Chi tiết: ${message}` }
        : item))
    } finally {
      setIsLoading(false)
      inputRef.current?.focus()
    }
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
            <h1 className="text-xl font-bold tracking-tight truncate">VinUni AI Analytics</h1>
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
            <div data-tour="page-chat-messages">
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
                        <div className="mb-3 mt-1 space-y-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {!expandedStatuses[msg.id] && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-background/50 rounded-md py-1.5 px-2.5 border border-border/50 w-fit max-w-full truncate">
                                {msg.isStreaming ? (
                                  <span className="relative flex h-2 w-2 shrink-0">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                  </span>
                                ) : (
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                )}
                                <span className="truncate font-medium">{msg.statuses[msg.statuses.length - 1]}</span>
                              </div>
                            )}

                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-[11px] font-semibold text-primary hover:bg-primary/5 px-2 flex items-center gap-1"
                              onClick={() => {
                                setExpandedStatuses(prev => ({
                                  ...prev,
                                  [msg.id]: !prev[msg.id]
                                }))
                              }}
                              aria-expanded={!!expandedStatuses[msg.id]}
                            >
                              {expandedStatuses[msg.id] ? (
                                <>
                                  <span>Thu gọn tiến trình</span>
                                  <ChevronDown className="h-3 w-3 rotate-180 transition-transform duration-200" />
                                </>
                              ) : (
                                <>
                                  <span>Xem tiến trình ({msg.statuses.length})</span>
                                  <ChevronDown className="h-3 w-3 transition-transform duration-200" />
                                </>
                              )}
                            </Button>
                          </div>

                          {expandedStatuses[msg.id] && (
                            <div className="flex flex-col gap-1.5 p-2 bg-muted/40 rounded-xl border border-border/40 max-h-48 overflow-y-auto transition-all motion-reduce:transition-none duration-250">
                              {msg.statuses.map((status, idx) => {
                                const isLast = idx === msg.statuses!.length - 1
                                const isActive = isLast && msg.isStreaming
                                return (
                                  <div
                                    key={idx}
                                    className="flex items-center gap-2 text-xs text-muted-foreground py-1 px-1.5 rounded w-fit max-w-full"
                                  >
                                    {isActive ? (
                                      <span className="relative flex h-2 w-2 shrink-0">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                                      </span>
                                    ) : (
                                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                                    )}
                                    <span className="font-medium">{status}</span>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )}
                      
                      {renderContent(msg.content)}
                      {msg.reportPlan && (() => {
                        const definition = msg.reportPlan.definition
                        const outline = textList(definition.outline)
                        const visuals = textList(definition.visuals)
                        const missingFields = msg.reportPlan.missing_fields
                        const isReady = Boolean(msg.reportPlan.action_id)
                        const dataStatus = String(msg.reportPlan.data_quality?.status ?? "")
                        const scopeType = textValue(definition.scope_type, "")
                        const scopeLabel = reportScopeLabel(scopeType)
                        const scopeOptions = reportScopeOptions(definition.scope_options, scopeType)
                        if (dataStatus === "blocked" || dataStatus === "permission_info") return null
                        if (!isReady && scopeOptions.length > 0) {
                          return (
                            <div className="mt-3 rounded-lg border border-border bg-background/70 p-3 text-sm">
                              <p className="font-semibold">Chọn {scopeLabel}</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">
                                Chỉ hiển thị lựa chọn thuộc phạm vi được cấp cho tài khoản này.
                              </p>
                              <div className="mt-2 grid gap-2">
                                {scopeOptions.map((option) => (
                                  <Button
                                    key={option.id}
                                    type="button"
                                    variant="outline"
                                    className="h-auto min-h-9 justify-start whitespace-normal px-3 py-2 text-left"
                                    disabled={isLoading}
                                    onClick={() => void sendMessage(
                                      `Chọn ${reportScopeLabel(option.scopeType)} ${option.label}`,
                                      undefined,
                                      {
                                        scope: {
                                          scope_type: option.scopeType,
                                          scope_id: option.id,
                                          scope_label: option.label,
                                        },
                                      },
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
                          <div className="mt-3 rounded-lg border border-border bg-background/70 p-3 text-sm">
                            <div className="mb-2 flex items-center justify-between gap-2">
                              <div>
                                <p className="font-semibold">{isReady ? "Bản nháp báo cáo" : "Ngữ cảnh báo cáo đang hiểu"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {isReady
                                    ? "Chưa ghi snapshot cho đến khi bạn xác nhận."
                                    : "Bạn chỉ cần trả lời phần còn thiếu trong câu hỏi phía trên."}
                                </p>
                              </div>
                              <Badge variant={isReady ? "secondary" : "outline"}>
                                {isReady ? "Sẵn sàng tạo" : textValue(definition.intent_source, "Đang hiểu")}
                              </Badge>
                            </div>

                            {isReady ? (
                              <div className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                                <div><span className="font-medium text-foreground">Loại:</span> {textValue(definition.template_label ?? definition.report_type, "Báo cáo tùy chỉnh")}</div>
                                <div><span className="font-medium text-foreground">Phạm vi:</span> {textValue(definition.scope_type)}{definition.scope_id ? ` #${textValue(definition.scope_id, "")}` : ""}</div>
                                <div><span className="font-medium text-foreground">Thời gian:</span> {textValue(definition.semester_label ?? definition.semester_id ?? definition.period, "Theo dữ liệu hiện có")}</div>
                              </div>
                            ) : (
                              <div className="rounded-md bg-muted/30 p-2 text-xs text-muted-foreground">
                                <div><span className="font-medium text-foreground">Loại:</span> {textValue(definition.template_label ?? definition.report_type, "Chưa chọn")}</div>
                                <div><span className="font-medium text-foreground">Phạm vi:</span> {textValue(definition.scope_hint ?? definition.scope_type, "Chưa chọn")}</div>
                                <div><span className="font-medium text-foreground">Thời gian:</span> {textValue(definition.period_label ?? definition.period, "Chưa chốt")}</div>
                                <div><span className="font-medium text-foreground">Mục tiêu:</span> {textValue(definition.purpose, "Chưa chốt")}</div>
                                {definition.comparison ? <div><span className="font-medium text-foreground">So sánh:</span> {textValue(definition.comparison)}</div> : null}
                                {definition.intent_rationale ? <div><span className="font-medium text-foreground">Lý do hiểu:</span> {textValue(definition.intent_rationale)}</div> : null}
                              </div>
                            )}

                            {isReady && outline.length > 0 && (
                              <div className="mt-3">
                                <p className="mb-1 text-xs font-semibold text-foreground">Cấu trúc dự kiến</p>
                                <div className="space-y-1">
                                  {outline.slice(0, 6).map((item) => (
                                    <p key={item} className="text-xs text-muted-foreground">• {item}</p>
                                  ))}
                                </div>
                              </div>
                            )}

                            {isReady && visuals.length > 0 && (
                              <div className="mt-3">
                                <p className="mb-1 text-xs font-semibold text-foreground">Biểu đồ/bảng sẽ dùng</p>
                                <div className="flex flex-wrap gap-1.5">
                                  {visuals.slice(0, 6).map((item) => (
                                    <Badge key={item} variant="outline" className="rounded-md text-[11px]">
                                      {item}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            )}

                            {missingFields.length > 0 ? (
                              <p className="mt-2 text-xs text-muted-foreground">Còn thiếu: {missingFields.join(", ")}</p>
                            ) : null}

                            {isReady ? (
                              <div className="mt-3 flex flex-wrap gap-2">
                                <Button
                                  size="sm"
                                  className="rounded-lg"
                                  disabled={isLoading}
                                  onClick={() => confirmReportPlan(msg.id, msg.reportPlan!)}
                                >
                                  Tạo báo cáo
                                </Button>
                              </div>
                            ) : (
                              null
                            )}
                          </div>
                        )
                      })()}
                      {msg.reportUrl && (
                        <a
                          href={msg.reportUrl}
                          className="mt-3 inline-flex rounded-lg border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary hover:bg-primary/15"
                        >
                          Mở báo cáo đã tạo
                        </a>
                      )}
                      {msg.retryText && !msg.isStreaming && (
                        <ServerBusyRetry
                          disabled={isLoading}
                          onRetry={() => {
                            const retryText = msg.retryText!
                            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, retryText: undefined } : m))
                            void sendMessage(retryText)
                          }}
                        />
                      )}
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
            </div>

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
              data-tour="page-chat-input"
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

