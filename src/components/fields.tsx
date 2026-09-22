"use client"

import { cn } from "cn"
import type { ReactNode } from "react"

export type Option = { value: string; label: string }

/** A labeled native select: fast, accessible, and the phone's own picker on mobile. */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
  hint,
  disabled = false,
  className,
}: {
  id: string
  label: string
  value: string
  options: readonly Option[]
  onChange: (value: string) => void
  hint?: ReactNode
  disabled?: boolean
  className?: string
}) {
  const hintId = hint ? `${id}-hint` : undefined
  return (
    <div className={cn("grid content-start gap-1.5", className)}>
      <label htmlFor={id} className="field-label">
        {label}
      </label>
      <select
        id={id}
        className="field-select"
        value={value}
        disabled={disabled}
        aria-describedby={hintId}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {hint ? (
        <p id={hintId} className="text-xs leading-snug text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

/** A checkbox with a short label and an optional note. */
export function CheckField({
  id,
  label,
  note,
  checked,
  onChange,
  disabled = false,
}: {
  id: string
  label: string
  note?: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex min-h-10 cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1.5",
        disabled && "cursor-default opacity-55",
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 size-[1.05rem] shrink-0 accent-[var(--primary)]"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="grid gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {note ? <span className="text-xs leading-snug text-muted-foreground">{note}</span> : null}
      </span>
    </label>
  )
}

/** Two or three choices side by side, as a radio group. */
export function Segmented<T extends string>({
  name,
  legend,
  value,
  options,
  onChange,
  className,
}: {
  name: string
  legend: string
  value: T
  options: readonly { value: T; label: string }[]
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <fieldset className={cn("grid gap-1.5", className)}>
      <legend className="field-label mb-1.5">{legend}</legend>
      <div className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-muted p-1">
        {options.map((option) => {
          const checked = option.value === value
          return (
            <label
              key={option.value}
              className={cn(
                "flex min-h-9 cursor-pointer items-center justify-center rounded-full px-2 text-center text-sm font-medium whitespace-nowrap transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
                checked ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={checked}
                onChange={() => onChange(option.value)}
                className="sr-only"
              />
              {option.label}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
