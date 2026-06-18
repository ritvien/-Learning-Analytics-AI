"use client"

import * as React from "react"
import { MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { MetricExplainPayload } from "./types"

interface AskAgentButtonProps {
  payload: MetricExplainPayload
  size?: "sm" | "default"
  variant?: "ghost" | "outline" | "default"
}

export function AskAgentButton({
  payload,
  size = "sm",
  variant = "ghost",
}: AskAgentButtonProps) {
  const handleClick = () => {
    const scopeLabel = payload.scope.label ?? payload.scope.level
    const q = encodeURIComponent(
      `Giải thích chỉ số "${payload.label}" = ${payload.value}${payload.unit ?? ""} tại ${scopeLabel}. ${payload.formula}`
    )
    const ctx = encodeURIComponent(JSON.stringify({ metricKey: payload.metricKey, scope: payload.scope, filters: payload.filters }))
    window.location.href = `/chat?q=${q}&ctx=${ctx}`
  }

  return (
    <Button size={size} variant={variant} onClick={handleClick} className="gap-1">
      <MessageSquare className="size-3" />
      Hỏi AI
    </Button>
  )
}
