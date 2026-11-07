import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  // No floating dev badge over the page (it gets in the way of screenshots).
  devIndicators: false,
  // Car photos are pre-sized (160, 320, 640 and 1200 pixels) by `npm run photos:download`; the loader picks one.
  images: {
    loader: "custom",
    loaderFile: "./src/lib/car-photo-loader.ts",
    deviceSizes: [640, 1200],
    imageSizes: [160, 320],
  },
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
