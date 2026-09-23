import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // No floating dev badge over the page (it gets in the way of screenshots).
  devIndicators: false,
}

export default nextConfig
