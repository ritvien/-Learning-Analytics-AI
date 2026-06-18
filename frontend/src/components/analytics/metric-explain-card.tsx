"use client"

import * as React from "react"
import { Card, CardContent } from "@/components/ui/card"
import { MetricTooltip } from "./metric-tooltip"
import { MetricExplainPanel } from "./metric-explain-panel"
import { AskAgentButton } from "./ask-agent-button"
import type { MetricExplainPayload } from "./types"

interface MetricExplainCardProps {
  payload: MetricExplainPayload
  /** Optional additional className for the card */
  className?: string
  /** Show the Ask AI button inline */
  showAskAgent?: boolean
}

export function MetricExplainCard({
  payload,
  className,
  showAskAgent = false,
}: MetricExplainCardProps) {
  const [panelOpen, setPanelOpen] = React.useState(false)

  return (
    <>
      <MetricTooltip payload={payload}>
        <Card
          className={`cursor-pointer transition-shadow hover:shadow-md ${className ?? ""}`}
          onClick={() => setPanelOpen(true)}
        >
          <CardContent className="p-4">
            <p className="text-xs font-medium text-muted-foreground">{payload.label}</p>
            <p className="mt-1 text-2xl font-bold">
              {typeof payload.value === "number"
                ? payload.value.toLocaleString("vi-VN")
                : payload.value}
              {payload.unit && (
                <span className="ml-1 text-sm font-normal text-muted-foreground">
                  {payload.unit}
                </span>
              )}
            </p>
            {showAskAgent && (
              <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                <AskAgentButton payload={payload} size="sm" variant="ghost" />
              </div>
            )}
          </CardContent>
        </Card>
      </MetricTooltip>

      <MetricExplainPanel
        payload={payload}
        open={panelOpen}
        onOpenChange={setPanelOpen}
      />
    </>
  )
}
