import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "ESTATE OS — Every property deserves its own digital world",
    template: "%s · ESTATE OS",
  },
  description:
    "Transforme dados imobiliários em experiências de venda extraordinárias, com inteligência artificial. Apresentação, página exclusiva, materiais e assistente fundamentado nos dados do imóvel.",
  applicationName: "ESTATE OS",
  openGraph: {
    title: "ESTATE OS",
    description:
      "One property in. An entire selling experience out. Apresentação, página exclusiva, campanha e assistente para cada imóvel.",
    type: "website",
    locale: "pt_PT",
    siteName: "ESTATE OS",
    images: [{ url: "/media/hero.jpg", width: 1536, height: 1024, alt: "Moradia contemporânea junto ao oceano" }],
  },
  twitter: { card: "summary_large_image" },
  icons: { icon: "/favicon.svg" },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#F7F6F2",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-porcelain antialiased">{children}</body>
    </html>
  );
}
