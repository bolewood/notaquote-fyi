import type { Metadata } from "next"
import Link from "next/link"
import { TrustArticle } from "@/components/trust-article"
import { longDate, PUBLISHER } from "@/lib/copy"
import { ABOUT_CONTENT_UPDATED, pageMetadata } from "@/lib/site-meta"
import { ISSUES_URL } from "@/lib/suggest-fix"

export const metadata: Metadata = pageMetadata({
  title: "Who made this, and why",
  description: "NotAQuote.FYI is a side project by one parent, published through a small company. No ads, no investors, no insurance partners, and nothing for sale.",
  path: "/about",
})

/**
 * First person, in Anthony's voice. Every promise here has to stay true; if
 * one changes, say so on this page first, with the date (and bump
 * ABOUT_CONTENT_UPDATED in src/lib/site-meta.ts).
 */
export default function AboutPage() {
  return (
    <TrustArticle
      title="Who made this, and why"
      lead="A short answer to the first question a careful reader asks: why would anyone build this?"
    >
      <h2>Is this a business? A nonprofit?</h2>
      <p>
        Neither, really. NotAQuote.FYI is a side project by one person: me, Anthony Showalter. I publish it through my small
        company, {PUBLISHER}, but it doesn&apos;t make money and isn&apos;t meant to. There are no ads, no investors, no
        insurance partners, and nothing for sale.
      </p>

      <h2>Why I built it</h2>
      <p>
        When my son was about to turn 16, I wanted a rough idea of what adding him to our policy would cost, and how
        different cars would change that. The only way I found was to send VINs to my agent one at a time and wait. Yet the
        numbers to estimate this are public: states publish insurance price surveys, and an insurance-industry research
        group publishes loss data for each car. I couldn&apos;t find a tool that answered my question the way I needed, so I built one.
      </p>

      <h2 id="promises" className="scroll-mt-4">
        What I promise
      </h2>
      <ul className="bullets">
        <li>No ads, no selling or sharing data, and no deals with insurers or agents.</li>
        <li>
          I&apos;ll keep the site online, at my own cost, through at least the end of 2027. If people find it useful,
          I&apos;ll keep the numbers updated after that.
        </li>
        <li>If anything on this list ever changes, I&apos;ll say so on this page first, with the date.</li>
        <li>
          If I ever stop, the code and our own data stay openly licensed, so anyone can keep it running. Outside datasets,
          like HLDI&apos;s, keep their own terms (see <Link href="/data-licenses">Data licenses</Link>).
        </li>
      </ul>
      <p>
        What leaves your device, and when, is on the <Link href="/privacy">Privacy</Link> page.
      </p>

      <h2>Questions, or a number that looks wrong?</h2>
      <p>
        Tell me <a href={ISSUES_URL}>on GitHub</a>. You&apos;ll need a GitHub account, and what you post there is public,
        so leave out what you pay and anything about you. There&apos;s also a{" "}
        <Link href="/corrections">step-by-step guide to suggesting a fix</Link>.
      </p>

      <p className="text-sm text-muted-foreground">Last updated {longDate(ABOUT_CONTENT_UPDATED)}.</p>
    </TrustArticle>
  )
}
