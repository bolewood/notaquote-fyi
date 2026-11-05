"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"
import { Menu, X } from "lucide-react"
import { useState } from "react"

const MAIN = [
  { href: "/", label: "Try a change" },
  { href: "/compare", label: "Compare cars" },
]

/**
 * Who's behind the site and what we promise stay visible on every screen
 * size; the longer links join them on wider screens.
 */
const HELP: { href: string; label: string; show: string }[] = [
  { href: "/about", label: "Who made this", show: "" },
  { href: "/privacy", label: "Privacy", show: "" },
  { href: "/methodology", label: "How the math works", show: "hidden md:inline-flex" },
  { href: "/sources", label: "Where the numbers come from", show: "hidden xl:inline-flex" },
]

export function SiteHeader() {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPath, setMenuPath] = useState(pathname)
  // Close the phone menu after moving to another page.
  if (menuPath !== pathname) {
    setMenuPath(pathname)
    setMenuOpen(false)
  }

  const mainLink = (link: { href: string; label: string }) => {
    const current = pathname === link.href
    return (
      <Link
        key={link.href}
        href={link.href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "tap-target inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium whitespace-nowrap",
          current ? "bg-foreground text-background" : "text-foreground hover:bg-muted",
        )}
      >
        {link.label}
      </Link>
    )
  }

  return (
    <header className="border-b border-border/70 bg-background">
      <a
        href="#content"
        className="bg-background text-foreground border-border focus-visible:ring-ring absolute top-3 left-3 z-50 -translate-y-24 rounded-md border px-3 py-2 text-sm focus-visible:translate-y-0"
      >
        Skip to content
      </a>
      <div className="mx-auto flex w-full max-w-7xl items-center gap-x-5 px-4 py-2 sm:flex-wrap sm:gap-y-1 sm:py-3 lg:px-6">
        <Link href="/" aria-label="NotAQuote.FYI home" className="flex items-center gap-2 rounded-sm py-1 text-base font-semibold tracking-tight">
          <span aria-hidden="true" className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            N
          </span>
          <span>
            NotAQuote<span className="text-muted-foreground">.FYI</span>
          </span>
        </Link>
        <nav aria-label="Main" className="hidden gap-1 sm:flex">
          {MAIN.map(mainLink)}
        </nav>
        <nav aria-label="Help" className="hidden flex-wrap gap-x-4 gap-y-1 sm:ml-auto sm:flex">
          {HELP.map((link) => {
            const current = pathname === link.href
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "tap-target inline-flex items-center rounded-sm text-sm",
                  link.show,
                  current ? "font-medium text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                {link.label}
              </Link>
            )
          })}
        </nav>

        {/* Phones: one row. Privacy stays in view; everything else is in the menu. */}
        <div className="ml-auto flex items-center gap-1 sm:hidden">
          <Link
            href="/privacy"
            aria-current={pathname === "/privacy" ? "page" : undefined}
            className="tap-target inline-flex items-center rounded-sm px-2 text-sm text-muted-foreground hover:text-foreground"
          >
            Privacy
          </Link>
          <button
            type="button"
            className="btn btn-quiet min-h-10 px-3"
            aria-expanded={menuOpen}
            aria-controls="phone-menu"
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X className="size-4" aria-hidden="true" /> : <Menu className="size-4" aria-hidden="true" />}
            Menu
          </button>
        </div>
      </div>
      {menuOpen ? (
        <nav id="phone-menu" aria-label="Menu" className="border-t border-border/70 px-4 pb-3 sm:hidden">
          <ul className="grid">
            {[...MAIN, ...HELP.filter((link) => link.href !== "/privacy")].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={pathname === link.href ? "page" : undefined}
                  className="tap-target flex items-center border-b border-border/60 py-2 text-base"
                  onClick={() => setMenuOpen(false)}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}
    </header>
  )
}
