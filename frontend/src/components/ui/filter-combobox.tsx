"use client"

import * as React from "react"
import { ChevronDown, X } from "lucide-react"
import { cn } from "@/lib/utils"

export type FilterOption = {
  value: string
  label: string
  /** Optional secondary text (e.g. course code, student ID) shown below the label */
  description?: string
}

type FilterComboboxProps = {
  options: FilterOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  /** The sentinel value that means "nothing selected / show all". Defaults to "all". */
  clearValue?: string
  disabled?: boolean
  className?: string
}

/**
 * Searchable filter control: the user can either browse the dropdown list
 * OR type a code/name directly to narrow results.  Shows the selected item's
 * label in the trigger; never shows a raw numeric ID.
 */
export function FilterCombobox({
  options,
  value,
  onValueChange,
  placeholder = "Tìm kiếm…",
  clearValue = "all",
  disabled = false,
  className,
}: FilterComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)

  const selectedLabel = value !== clearValue
    ? options.find((o) => o.value === value)?.label ?? value
    : null

  const filtered = React.useMemo(() => {
    if (!search.trim()) return options
    const q = search.toLowerCase()
    return options.filter(
      (o) =>
        o.label.toLowerCase().includes(q) ||
        o.description?.toLowerCase().includes(q),
    )
  }, [options, search])

  function openDropdown() {
    if (disabled) return
    setSearch("")
    setOpen(true)
    requestAnimationFrame(() => inputRef.current?.focus())
  }

  function selectOption(val: string) {
    onValueChange(val)
    setSearch("")
    setOpen(false)
  }

  function clearSelection(e: React.MouseEvent) {
    e.stopPropagation()
    onValueChange(clearValue)
    setSearch("")
    setOpen(false)
  }

  // Close on outside click
  React.useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch("")
      }
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        type="button"
        disabled={disabled}
        onClick={openDropdown}
        className={cn(
          "flex h-8 w-full items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 text-sm transition-colors",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          "disabled:cursor-not-allowed disabled:opacity-50",
          open && "border-ring ring-3 ring-ring/50",
        )}
      >
        {open ? (
          <input
            ref={inputRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") { setOpen(false); setSearch("") }
              if (e.key === "Enter" && filtered.length === 1) selectOption(filtered[0].value)
            }}
            placeholder={placeholder}
            className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-muted-foreground"
            // prevent the outer button click from stealing focus
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className={cn("flex-1 min-w-0 truncate text-left", !selectedLabel && "text-muted-foreground")}>
            {selectedLabel ?? placeholder}
          </span>
        )}

        {selectedLabel && !open && (
          <span
            role="button"
            tabIndex={0}
            className="shrink-0 text-muted-foreground hover:text-foreground"
            onClick={clearSelection}
            onKeyDown={(e) => e.key === "Enter" && clearSelection(e as never)}
          >
            <X className="size-3.5" />
          </span>
        )}

        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-64 w-full min-w-max overflow-y-auto rounded-lg border bg-popover text-popover-foreground shadow-md">
          {/* "Show all" / clear option */}
          <button
            type="button"
            className={cn(
              "w-full px-3 py-2 text-left text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              value === clearValue && "bg-accent/40 font-medium",
            )}
            onMouseDown={() => selectOption(clearValue)}
          >
            {placeholder}
          </button>

          {filtered.length === 0 ? (
            <p className="px-3 py-2 text-center text-sm text-muted-foreground">
              Không tìm thấy kết quả
            </p>
          ) : (
            filtered.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                  value === opt.value && "bg-accent/40 font-medium",
                )}
                onMouseDown={() => selectOption(opt.value)}
              >
                <span>{opt.label}</span>
                {opt.description && (
                  <span className="text-xs text-muted-foreground">{opt.description}</span>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
