"use client";

import { useState } from "react";
import { Link2, Share2 } from "lucide-react";

export function ShareButton({ slug, title, tone = "light" }: { slug: string; title: string; tone?: "light" | "dark" }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/p/${slug}`;
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
      } else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
      await fetch(`/api/public/${slug}/track`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "share" }),
      });
    } catch {
      /* user cancelled */
    }
  }

  return (
    <button
      onClick={share}
      className={`inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.12em] transition ${
        tone === "dark" ? "text-porcelain/50 hover:text-porcelain" : "text-graphite-dim hover:text-obsidian"
      }`}
    >
      {copied ? <Link2 size={11} /> : <Share2 size={11} />}
      {copied ? "Link copiado" : "Partilhar"}
    </button>
  );
}
