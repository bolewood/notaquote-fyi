import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { SiteFooter } from "@/components/site-footer"
import { SiteHeader } from "@/components/site-header"
import { PUBLISHER, SITE_ORIGIN } from "@/lib/copy"
import { SITE_NAME } from "@/lib/site-meta"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  // Canonical addresses and social images resolve against the live site.
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: SITE_NAME,
    template: `%s · ${SITE_NAME}`,
  },
  description:
    "What would your car insurance cost with a different car, a new teen driver, or a move? A free, open-source estimate to help you plan. Not a quote.",
  applicationName: SITE_NAME,
  publisher: PUBLISHER,
  // AI assistants that read the page's head find their guide here. Pages that set
  // their own canonical address keep this link (see pageMetadata in src/lib/site-meta.ts).
  alternates: {
    types: {
      "text/plain": [{ url: "/llms.txt", title: "For AI assistants" }],
    },
  },
  openGraph: { type: "website", siteName: SITE_NAME, locale: "en_US" },
  twitter: { card: "summary_large_image" },
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <SiteHeader />
        <main id="content" tabIndex={-1} className="flex-1 outline-none">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  )
}
