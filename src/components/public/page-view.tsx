"use client";

import { useEffect } from "react";

export function PageView({ slug, referrer }: { slug: string; referrer?: string }) {
  useEffect(() => {
    const key = `estate-view:${slug}`;
    const last = sessionStorage.getItem(key);
    const now = Date.now();
    if (last && now - Number(last) < 1000 * 60 * 30) return;
    sessionStorage.setItem(key, String(now));
    void fetch(`/api/public/${slug}/track`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ event: "page_view", referrer: referrer ?? document.referrer ?? undefined }),
    }).catch(() => undefined);
  }, [slug, referrer]);
  return null;
}
