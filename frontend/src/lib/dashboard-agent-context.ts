"use client"

export const DASHBOARD_AGENT_CONTEXT_KEY = "eduinsight_dashboard_agent_context_v1"
export const DASHBOARD_AGENT_CONTEXT_EVENT = "dashboard-agent-context"
export const DASHBOARD_AGENT_PROMPT_EVENT = "dashboard-agent-prompt"
const DASHBOARD_AGENT_PENDING_PROMPT_KEY = "eduinsight_dashboard_agent_pending_prompt_v1"

export type DashboardAgentContext = {
  source: string
  route: string
  dashboard_type: string
  scope?: Record<string, unknown>
  filters?: Record<string, unknown>
  visible_metrics?: Record<string, unknown>
  alerts?: string[]
  selected_entities?: Record<string, unknown>
  chart_summaries?: Record<string, unknown>
  rows_preview?: unknown[]
  updated_at?: string
}

export function setDashboardAgentContext(context: DashboardAgentContext) {
  if (typeof window === "undefined") return
  const next = { ...context, updated_at: new Date().toISOString() }
  sessionStorage.setItem(DASHBOARD_AGENT_CONTEXT_KEY, JSON.stringify(next))
  window.dispatchEvent(new CustomEvent(DASHBOARD_AGENT_CONTEXT_EVENT, { detail: next }))
}

export function getDashboardAgentContext(route?: string): DashboardAgentContext | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(DASHBOARD_AGENT_CONTEXT_KEY)
    if (!raw) return null
    const context = JSON.parse(raw) as DashboardAgentContext
    if (!route || context.route === route || route.startsWith(`${context.route}/`) || context.route.startsWith(`${route}/`)) {
      return context
    }
    return null
  } catch {
    return null
  }
}

export function requestDashboardAgent(prompt: string) {
  if (typeof window === "undefined") return
  window.dispatchEvent(new CustomEvent(DASHBOARD_AGENT_PROMPT_EVENT, { detail: { prompt } }))
}

export function queueDashboardAgentPrompt(prompt: string, route: string) {
  if (typeof window === "undefined") return
  sessionStorage.setItem(DASHBOARD_AGENT_PENDING_PROMPT_KEY, JSON.stringify({ prompt, route }))
}

export function consumeDashboardAgentPrompt(route: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(DASHBOARD_AGENT_PENDING_PROMPT_KEY)
    if (!raw) return null
    const pending = JSON.parse(raw) as { prompt?: string; route?: string }
    if (!pending.prompt || pending.route !== route) return null
    sessionStorage.removeItem(DASHBOARD_AGENT_PENDING_PROMPT_KEY)
    return pending.prompt
  } catch {
    sessionStorage.removeItem(DASHBOARD_AGENT_PENDING_PROMPT_KEY)
    return null
  }
}
