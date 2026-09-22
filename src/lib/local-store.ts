"use client"

/**
 * A tiny hook for one value kept in this browser's local storage, shared by
 * every component (and every open tab) that reads the same key. Nothing here
 * talks to a server.
 */
import { useCallback, useMemo, useState, useSyncExternalStore } from "react"

const SERVER = "\u0000server"
const FAILED = "\u0000failed"

function subscribeTo(event: string) {
  return (onChange: () => void) => {
    window.addEventListener("storage", onChange)
    window.addEventListener(event, onChange)
    return () => {
      window.removeEventListener("storage", onChange)
      window.removeEventListener(event, onChange)
    }
  }
}

export type StoredValue<T> = {
  /** The stored value, or null when nothing (readable) is stored yet. */
  value: T | null
  /** False during the server render and the first paint, before storage is read. */
  ready: boolean
  /** Plain-words problem, if the browser wouldn't read or keep it. */
  error: string | null
  write: (next: T) => void
}

export function useStoredValue<T>(input: {
  key: string
  event: string
  parse: (raw: string) => T | null
  serialize: (value: T) => string
}): StoredValue<T> {
  const { key, event, parse, serialize } = input
  const subscribe = useMemo(() => subscribeTo(event), [event])
  const raw = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(key) ?? ""
      } catch {
        return FAILED
      }
    },
    () => SERVER,
  )
  const [writeError, setWriteError] = useState<string | null>(null)
  // If the browser won't keep it (private mode, full storage), hold it in memory instead.
  const [fallback, setFallback] = useState<T | null>(null)
  const stored = useMemo(() => (raw === SERVER || raw === FAILED ? null : parse(raw)), [raw, parse])
  const value = fallback ?? stored
  const write = useCallback(
    (next: T) => {
      try {
        window.localStorage.setItem(key, serialize(next))
        window.dispatchEvent(new Event(event))
        setWriteError(null)
        setFallback(null)
      } catch {
        setFallback(next)
        setWriteError("This browser didn't let us save your choices, so they'll reset when you leave the page.")
      }
    },
    [key, event, serialize],
  )
  return {
    value,
    ready: raw !== SERVER,
    error: writeError ?? (raw === FAILED ? "This browser didn't let us read your saved choices." : null),
    write,
  }
}
