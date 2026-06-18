"use client"

import * as React from "react"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { AlertTriangle, ChevronRight, ExternalLink } from "lucide-react"
import { AskAgentButton } from "./ask-agent-button"
import type { MetricExplainPayload } from "./types"

interface MetricExplainPanelProps {
  payload: MetricExplainPayload
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MetricExplainPanel({ payload, open, onOpenChange }: MetricExplainPanelProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[420px] sm:max-w-[420px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <SheetTitle className="text-base">{payload.label}</SheetTitle>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold">
              {typeof payload.value === "number"
                ? payload.value.toLocaleString("vi-VN")
                : payload.value}
            </span>
            {payload.unit && (
              <span className="text-sm text-muted-foreground">{payload.unit}</span>
            )}
          </div>
        </SheetHeader>

        <div className="space-y-4 text-sm">
          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Công thức</p>
            <p className="rounded-md bg-muted px-3 py-2 font-mono text-xs">{payload.formula}</p>
          </section>

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Nguồn dữ liệu</p>
            <p className="text-xs text-muted-foreground">{payload.source}</p>
          </section>

          {payload.interpretation && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Diễn giải</p>
              <p className="text-xs">{payload.interpretation}</p>
            </section>
          )}

          <section>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phạm vi áp dụng</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{payload.scope.level}</Badge>
              {payload.scope.label && <Badge variant="outline">{payload.scope.label}</Badge>}
              {payload.filters &&
                Object.entries(payload.filters)
                  .filter(([, v]) => v != null)
                  .map(([k, v]) => (
                    <Badge key={k} variant="outline">
                      {k}: {v}
                    </Badge>
                  ))}
            </div>
          </section>

          {payload.sampleSize != null && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Cỡ mẫu</p>
              <p className="text-xs">{payload.sampleSize.toLocaleString("vi-VN")} bản ghi</p>
            </section>
          )}

          {payload.warnings && payload.warnings.length > 0 && (
            <section>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground text-amber-600">
                Cảnh báo dữ liệu
              </p>
              <ul className="space-y-1">
                {payload.warnings.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-amber-700">
                    <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                    {w}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {payload.drilldowns && payload.drilldowns.length > 0 && (
            <>
              <Separator />
              <section>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Drill-down liên quan
                </p>
                <ul className="space-y-1">
                  {payload.drilldowns.map((d) => (
                    <li key={d.href}>
                      <a
                        href={d.href}
                        className="flex items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-accent"
                      >
                        <span>{d.label}</span>
                        <ChevronRight className="size-3 text-muted-foreground" />
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            </>
          )}

          <Separator />
          <div className="flex gap-2">
            <AskAgentButton payload={payload} size="sm" variant="outline" />
            <Button size="sm" variant="outline" className="gap-1">
              <ExternalLink className="size-3" />
              Tạo task
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
