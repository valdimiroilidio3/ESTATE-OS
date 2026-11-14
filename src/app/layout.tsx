import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "@fontsource/instrument-serif/400.css";
import "@fontsource/instrument-serif/400-italic.css";
import "./globals.css";
import { config } from "@/server/env";

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
  // Validates the environment. Throws in production when APP_SECRET is missing or
  // too short, because a predictable session secret would be a security failure.
  const cfg = config();

  // Without a database the application cannot do anything honest, so every route
  // gets one screen that says what is missing instead of a stack of 500s.
  if (!cfg.database.configured) {
    return (
      <html lang="pt-PT" className={`${GeistSans.variable} ${GeistMono.variable}`}>
        <body className="min-h-screen bg-porcelain antialiased">
          <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-champagne-deep">
              Instalação incompleta
            </p>
            <h1 className="mt-4 font-serif text-[clamp(1.9rem,4vw,2.8rem)] leading-[1.05] text-obsidian">
              Falta ligar a base de dados.
            </h1>
            <p className="mt-5 text-[14px] leading-relaxed text-graphite">
              Esta instância do ESTATE OS ainda não tem uma base de dados PostgreSQL configurada. Nenhuma página é
              servida com dados inventados: até a ligação existir, o produto não arranca.
            </p>
            <ol className="mt-8 space-y-4 border-t border-obsidian/10 pt-6 text-[13px] leading-relaxed text-graphite">
              <li>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-dim">01</span>{" "}
                Crie uma base PostgreSQL (Neon, Supabase, Vercel Postgres ou servidor próprio).
              </li>
              <li>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-dim">02</span>{" "}
                Defina <code className="bg-obsidian/5 px-1.5 py-0.5">DATABASE_URL</code>,{" "}
                <code className="bg-obsidian/5 px-1.5 py-0.5">APP_SECRET</code> (mínimo 32 caracteres) e{" "}
                <code className="bg-obsidian/5 px-1.5 py-0.5">NEXT_PUBLIC_APP_URL</code>.
              </li>
              <li>
                <span className="font-mono text-[10.5px] uppercase tracking-[0.14em] text-graphite-dim">03</span>{" "}
                Execute <code className="bg-obsidian/5 px-1.5 py-0.5">npm run db:init</code> e abra{" "}
                <code className="bg-obsidian/5 px-1.5 py-0.5">/signup</code> para criar a primeira organização.
              </li>
            </ol>
            <p className="mt-8 text-[11.5px] text-graphite-dim">
              Diagnóstico: <a className="underline decoration-obsidian/30 underline-offset-2" href="/api/health">/api/health</a>
            </p>
          </main>
        </body>
      </html>
    );
  }

  return (
    <html lang="pt-PT" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body className="min-h-screen bg-porcelain antialiased">{children}</body>
    </html>
  );
}
