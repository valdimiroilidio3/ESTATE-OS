import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";

/**
 * Security headers applied to every response.
 * The public experience is framed by the builder preview (same origin), so
 * framing is restricted to SAMEORIGIN rather than blocked entirely.
 */
/**
 * Content-Security-Policy.
 *
 * Next.js hydrates with inline bootstrap scripts, so `'unsafe-inline'` is
 * required for scripts until a nonce-based policy is wired through middleware.
 * Even so, this blocks the realistic attack paths: third-party script loading,
 * framing by another site, form hijacking and `<base>` rewriting.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isProduction ? "" : " 'unsafe-eval'"}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "media-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
  ...(isProduction ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  // The public experience is framed by the builder preview on the same origin.
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  ...(isProduction
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
];

// `output: "standalone"` is opt-in: `next start` does not support it, and
// platforms that build their own bundle (Vercel) must not set it.
//   BUILD_STANDALONE=1 npm run build && node .next/standalone/server.js
const standalone = process.env.BUILD_STANDALONE === "1";

const nextConfig: NextConfig = {
  ...(standalone ? { output: "standalone" as const } : {}),
  // schema.sql is read at runtime; make sure the server bundle ships it.
  outputFileTracingIncludes: { "/**/*": ["./src/server/schema.sql"] },
  allowedDevOrigins: ["*.e2b.app", "localhost", "127.0.0.1"],
  experimental: {
    serverActions: { bodySizeLimit: "12mb" },
  },
  images: { unoptimized: true },
  poweredByHeader: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // Uploaded bytes are inert files, not pages: they get a stricter policy
      // than the app shell, and must never be framed.
      {
        source: "/api/(media|documents)/:id/file",
        headers: [
          {
            key: "Content-Security-Policy",
            value: "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; sandbox",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
