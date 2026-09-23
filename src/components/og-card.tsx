import { ImageResponse } from "next/og"

/**
 * The social preview images (Open Graph and Twitter), drawn at build time.
 * Calm and on-brand: the site's cream background, navy ink, and the warm
 * "sun" accent, in the site's typeface (Geist, which next/og ships). The
 * colors are the site's oklch values from globals.css, converted to hex,
 * since the image renderer doesn't read oklch.
 */
export const OG_SIZE = { width: 1200, height: 630 }
export const OG_CONTENT_TYPE = "image/png"

const COLORS = {
  background: "#fcf9f3",
  foreground: "#17202b",
  muted: "#4e5661",
  primary: "#164781",
  sunSoft: "#fff1da",
  sunInk: "#883c00",
  border: "#dfdad2",
}

export type OgLine = { label: string; value: string }

export function ogImage(input: {
  /** Small line above the title: "Car insurance by state". */
  eyebrow: string
  title: string
  /** Up to two figures, each a short label and a value. */
  lines?: readonly OgLine[]
  /** One plain sentence under the title, when there are no figures. */
  subtitle?: string
}): ImageResponse {
  const lines = input.lines ?? []
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: COLORS.background,
          color: COLORS.foreground,
          padding: "64px 72px",
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: COLORS.primary,
              color: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
            }}
          >
            N
          </div>
          <div style={{ display: "flex", fontSize: 32, letterSpacing: -0.5 }}>
            <span>NotAQuote</span>
            <span style={{ color: COLORS.muted }}>.FYI</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", fontSize: 26, color: COLORS.sunInk, textTransform: "uppercase", letterSpacing: 2 }}>
            {input.eyebrow}
          </div>
          <div style={{ display: "flex", fontSize: input.title.length > 40 ? 58 : 68, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1050 }}>
            {input.title}
          </div>
          {input.subtitle ? (
            <div style={{ display: "flex", fontSize: 30, lineHeight: 1.35, color: COLORS.muted, maxWidth: 980 }}>{input.subtitle}</div>
          ) : null}
          {lines.length > 0 ? (
            <div style={{ display: "flex", gap: 24, marginTop: 8 }}>
              {lines.slice(0, 2).map((line) => (
                <div
                  key={line.label}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    padding: "20px 26px",
                    borderRadius: 22,
                    background: COLORS.sunSoft,
                    minWidth: 420,
                  }}
                >
                  <div style={{ display: "flex", fontSize: 24, color: COLORS.sunInk }}>{line.label}</div>
                  <div style={{ display: "flex", fontSize: 44, letterSpacing: -1 }}>{line.value}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div style={{ display: "flex", fontSize: 24, color: COLORS.muted, borderTop: `2px solid ${COLORS.border}`, paddingTop: 22 }}>
          Free planning estimates from public data. Not a quote.
        </div>
      </div>
    ),
    OG_SIZE,
  )
}
