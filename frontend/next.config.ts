import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";
import { monitoringEnabled } from "@zelvomart/monitoring";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SENTRY_RELEASE: process.env.VERCEL_GIT_COMMIT_SHA || "",
    NEXT_PUBLIC_SENTRY_ENVIRONMENT:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "development",
  },
  // Keep a one-off production check separate from the user's running dev server.
  distDir:
    process.env.NEXT_BUILD_DIR === ".next-launch" ? ".next-launch" : ".next",
  // WooCommerce URLs end with a slash; let the migration proxy return one 301.
  skipTrailingSlashRedirect: true,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      { protocol: "https", hostname: "zelvomart.com" },
      { protocol: "https", hostname: "www.zelvomart.com" },
      { protocol: "https", hostname: "*.r2.dev" },
      {
        protocol: "https",
        hostname: "pub-6861daa0380241a2acc38cd5ca85b301.r2.dev",
      },
      { protocol: "https", hostname: "*.cloudflarestorage.com" },
      { protocol: "https", hostname: "*.supabase.co" },
      // Product video thumbnails (the player itself only loads after a click).
      { protocol: "https", hostname: "i.ytimg.com", pathname: "/vi/**" },
      { protocol: "https", hostname: "i.vimeocdn.com" },
      {
        protocol: "http",
        hostname: "localhost",
        port: "4000",
        pathname: "/uploads/**",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "4000",
        pathname: "/uploads/**",
      },
      ...(process.env.NEXT_PUBLIC_IMAGE_HOSTS || "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean)
        .map((hostname) => ({ protocol: "https" as const, hostname })),
    ],
  },
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [
      { source: "/(.*)", headers: securityHeaders },
      {
        source: "/(.*)",
        missing: [{ type: "host", value: "(www\\.)?zelvomart\\.com" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex" }],
      },
      {
        source: "/images/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      ...["zelvomart-frontend.vercel.app", "zelvomart.vercel.app", "zelvomart.com"].map((host) => ({
        source: "/:path*",
        has: [{ type: "host" as const, value: host }],
        destination: "https://www.zelvomart.com/:path*",
        permanent: true,
      })),
    ];
  },
  async rewrites() {
    const api = (
      process.env.BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:4000"
    ).replace(/\/$/, "");
    return [
      // Product sitemaps past the first 1,000 products (Yoast names: product-sitemap2.xml, 3 …).
      { source: "/product-sitemap:page(\\d+).xml", destination: "/sitemaps/products/:page" },
      {
        source: "/feeds/:platform(meta|tiktok|google).xml",
        destination: `${api}/api/feed/:platform.xml`,
      },
      { source: "/uploads/:path*", destination: `${api}/uploads/:path*` },
    ];
  },
};

const uploadSourcemaps = !!(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT &&
  process.env.VERCEL_GIT_COMMIT_SHA
);
export default monitoringEnabled(process.env.SENTRY_DSN) ||
monitoringEnabled(process.env.NEXT_PUBLIC_SENTRY_DSN) ||
uploadSourcemaps
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      silent: true,
      sourcemaps: {
        disable: !uploadSourcemaps,
        deleteSourcemapsAfterUpload: true,
      },
      release: {
        name: process.env.VERCEL_GIT_COMMIT_SHA,
        create: uploadSourcemaps,
        finalize: uploadSourcemaps,
      },
    })
  : nextConfig;
