import Image from "next/image";
import Link from "next/link";
import { Wordmark } from "@/components/ui/primitives";

export function AuthShell({
  children,
  title,
  subtitle,
  image = "/media/villa-kitchen.jpg",
  imageAlt,
  caption,
}: {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  image?: string;
  imageAlt: string;
  caption: string;
}) {
  return (
    <div className="grid min-h-svh lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden bg-obsidian lg:block">
        <Image src={image} alt={imageAlt} fill priority sizes="50vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-obsidian via-obsidian/25 to-obsidian/50" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link href="/" aria-label="Voltar à página inicial">
            <Wordmark tone="light" />
          </Link>
          <div>
            <p className="max-w-sm font-serif text-[26px] leading-tight text-porcelain">{caption}</p>
            <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em] text-porcelain/40">
              ESTATE OS · Propriedade e inteligência
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-sm">
          <div className="lg:hidden">
            <Link href="/"><Wordmark /></Link>
          </div>
          <h1 className="mt-10 text-[clamp(1.7rem,3vw,2.2rem)] font-light leading-tight lg:mt-0">{title}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-graphite-dim">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
