"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  CORRECTION_CATEGORIES,
  CORRECTION_PAGES,
} from "@/lib/correction-fields"
import { STATES } from "@/lib/scenario"
import { useState, type FormEvent } from "react"

export function CorrectionsForm({ live }: { live: boolean }) {
  const [notice, setNotice] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!live) {
      setNotice("The corrections queue is not live. Nothing was saved.")
      return
    }
    const data = new FormData(event.currentTarget)
    const payload = {
      state: String(data.get("state") ?? ""),
      page: String(data.get("page") ?? ""),
      sourceUrl: String(data.get("sourceUrl") ?? ""),
      category: String(data.get("category") ?? ""),
    }
    setPending(true)
    setNotice(null)
    try {
      const response = await fetch("/api/corrections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const body = (await response.json().catch(() => null)) as { saved?: boolean } | null
      if (response.ok && body?.saved === true) {
        setNotice("The queue accepted the row.")
      } else {
        setNotice("Nothing was saved.")
      }
    } catch {
      setNotice("Nothing was saved.")
    } finally {
      setPending(false)
    }
  }

  return (
    <form
      className="grid gap-4"
      autoComplete="off"
      onSubmit={(event) => {
        void onSubmit(event)
      }}
      data-testid="corrections-form"
      aria-describedby="corrections-status"
    >
      <p
        id="corrections-status"
        role="status"
        data-testid="corrections-queue-status"
        data-queue-live={live ? "true" : "false"}
        className="text-sm leading-6"
      >
        {live
          ? "The corrections queue is live. A row is recorded only after the queue accepts it."
          : "The corrections queue is not live. This form does not save a row."}
      </p>
      <fieldset className="grid gap-4">
        <legend className="sr-only">Structured correction</legend>
        <div className="grid gap-1.5">
          <Label htmlFor="correction-state">State</Label>
          <select
            id="correction-state"
            name="state"
            defaultValue=""
            required
            disabled={!live || pending}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50"
          >
            <option value="">Select a state</option>
            {STATES.map((state) => (
              <option key={state.code} value={state.code}>
                {state.name}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="correction-page">Page</Label>
          <select
            id="correction-page"
            name="page"
            defaultValue=""
            required
            disabled={!live || pending}
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:bg-input/50"
          >
            <option value="">Select a page</option>
            {CORRECTION_PAGES.map((page) => (
              <option key={page.id} value={page.id}>
                {page.label}
              </option>
            ))}
          </select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="correction-source-url">Source URL</Label>
          <Input
            id="correction-source-url"
            name="sourceUrl"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            maxLength={500}
            required
            disabled={!live || pending}
            placeholder="https://"
            aria-describedby="correction-source-hint"
          />
          <p id="correction-source-hint" className="text-muted-foreground text-xs leading-snug">
            One http or https address. A sentence is not accepted.
          </p>
        </div>
        <fieldset className="grid gap-2">
          <legend className="text-sm font-medium">Category</legend>
          {CORRECTION_CATEGORIES.map((category) => (
            <div key={category.id} className="flex items-center gap-2">
              <input
                id={`correction-category-${category.id}`}
                type="radio"
                name="category"
                value={category.id}
                required
                disabled={!live || pending}
                className="size-4 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              />
              <Label htmlFor={`correction-category-${category.id}`} className="font-normal">
                {category.label}
              </Label>
            </div>
          ))}
        </fieldset>
        <Button type="submit" disabled={!live || pending} data-testid="corrections-submit">
          {live ? "Add to the queue" : "Queue not live"}
        </Button>
      </fieldset>
      {notice ? (
        <p className="text-sm leading-6" role="status" data-testid="corrections-result">
          {notice}
        </p>
      ) : null}
    </form>
  )
}
