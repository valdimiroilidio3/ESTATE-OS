import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";

export function Wordmark({ tone = "dark", className }: { tone?: "dark" | "light"; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-baseline gap-2 font-medium tracking-[0.22em]",
        tone === "light" ? "text-porcelain" : "text-obsidian",
        className,
      )}
    >
      <span className="text-[13px] uppercase">Estate</span>
      <span className="text-[13px] uppercase text-champagne">OS</span>
    </span>
  );
}

export function Eyebrow({ children, tone = "dark" }: { children: ReactNode; tone?: "dark" | "light" }) {
  return (
    <p
      className={clsx(
        "text-[10.5px] font-medium uppercase tracking-eyebrow",
        tone === "light" ? "text-porcelain/60" : "text-graphite-dim",
      )}
    >
      {children}
    </p>
  );
}

export function StatusPill({
  label,
  tone,
  className,
}: {
  label: string;
  tone: string;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[10.5px] font-medium tracking-[0.02em]",
        tone,
        className,
      )}
    >
      {label}
    </span>
  );
}

export function Metric({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
}) {
  const content = (
    <>
      <span className="eyebrow">{label}</span>
      <span className="mt-3 block font-mono text-[30px] leading-none tracking-tight text-obsidian">{value}</span>
      {hint ? <span className="mt-3 block text-[11.5px] leading-snug text-graphite-dim">{hint}</span> : null}
    </>
  );
  return href ? (
    <Link href={href} className="group block border-t border-obsidian/10 py-6 transition-colors hover:border-obsidian/40">
      {content}
    </Link>
  ) : (
    <div className="border-t border-obsidian/10 py-6">{content}</div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  tone = "light",
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
  tone?: "light" | "dark";
}) {
  return (
    <div
      className={clsx(
        "flex flex-col items-start gap-3 border px-6 py-10",
        tone === "dark" ? "border-porcelain/15 bg-obsidian text-porcelain" : "border-dashed border-obsidian/15 bg-white/40",
      )}
    >
      {icon ? <div className={tone === "dark" ? "text-champagne" : "text-graphite-dim"}>{icon}</div> : null}
      <h3 className={clsx("text-[15px] font-medium", tone === "dark" ? "text-porcelain" : "text-obsidian")}>{title}</h3>
      <p className={clsx("max-w-md text-[13px] leading-relaxed", tone === "dark" ? "text-porcelain/60" : "text-graphite-dim")}>
        {description}
      </p>
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-obsidian/10 pb-5">
      <div>
        {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
        <h2 className="mt-2 text-[22px] font-medium leading-tight">{title}</h2>
        {description ? <p className="mt-2 max-w-2xl text-[13px] leading-relaxed text-graphite-dim">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Progress({ value, tone = "dark" }: { value: number; tone?: "dark" | "light" }) {
  return (
    <div className={clsx("h-[3px] w-full overflow-hidden rounded-full", tone === "light" ? "bg-porcelain/20" : "bg-obsidian/10")}>
      <div
        className={clsx("h-full rounded-full transition-all duration-700 ease-editorial", tone === "light" ? "bg-champagne" : "bg-forest")}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-6 border-b border-obsidian/[0.07] py-2.5">
      <dt className="text-[11.5px] uppercase tracking-[0.1em] text-graphite-dim">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-obsidian">{value}</dd>
    </div>
  );
}

export function SourceNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-graphite-dim/90">
      <span className="mt-[3px] inline-block h-1 w-1 shrink-0 rounded-full bg-champagne" />
      {children}
    </p>
  );
}
