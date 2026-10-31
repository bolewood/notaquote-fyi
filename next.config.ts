import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // No floating dev badge over the page (it gets in the way of screenshots).
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        has: [{ type: "header", key: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
    ]
  },
}

export default nextConfig
