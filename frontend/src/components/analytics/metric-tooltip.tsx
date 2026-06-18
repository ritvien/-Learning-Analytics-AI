"use client"

import * as React from "react"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import type { MetricExplainPayload } from "./types"

interface MetricTooltipProps {
  payload: MetricExplainPayload
  children: React.ReactNode
}

export function MetricTooltip({ payload, children }: MetricTooltipProps) {
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent className="max-w-xs space-y-1 text-left" side="top">
          <p className="text-xs font-semibold">{payload.label}</p>
          <p className="text-xs text-muted-foreground">{payload.formula}</p>
          {payload.sampleSize != null && (
            <p className="text-xs text-muted-foreground">
              Mẫu: {payload.sampleSize.toLocaleString("vi-VN")} bản ghi
            </p>
          )}
          {payload.warnings && payload.warnings.length > 0 && (
            <p className="flex items-center gap-1 text-xs text-amber-600">
              <Info className="size-3 shrink-0" />
              {payload.warnings[0]}
            </p>
          )}
          <p className="text-xs text-muted-foreground/70">Click để xem chi tiết</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
