"use client"

import * as React from "react"
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

const RETRY_DELAY_SECONDS = 5

/**
 * H67d: retry affordance shown when the backend rejects a chat because all
 * agent slots are busy. The button unlocks after a short countdown so users
 * do not hammer an already saturated server; retries stay manual (no loop).
 */
export function ServerBusyRetry({
  onRetry,
  disabled,
}: {
  onRetry: () => void
  disabled?: boolean
}) {
  const [secondsLeft, setSecondsLeft] = React.useState(RETRY_DELAY_SECONDS)

  React.useEffect(() => {
    if (secondsLeft <= 0) return
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [secondsLeft])

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="mt-2 gap-1.5 rounded-lg"
      disabled={disabled || secondsLeft > 0}
      onClick={onRetry}
    >
      <RefreshCw className="h-3.5 w-3.5" />
      {secondsLeft > 0 ? `Thử lại sau ${secondsLeft}s` : "Thử lại"}
    </Button>
  )
}
