"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type GalleryItem = {
  id: string;
  src: string;
  caption: string | null;
  room: string | null;
  width?: number;
  height?: number;
};

export type GalleryMode = "masonry" | "grid" | "carousel";

export function Gallery({
  items,
  variant = "architectural",
  mode,
  showCaptions = true,
}: {
  items: GalleryItem[];
  variant?: "architectural" | "signature" | "investment";
  mode?: GalleryMode;
  showCaptions?: boolean;
}) {
  const [active, setActive] = useState<number | null>(null);

  const close = useCallback(() => setActive(null), []);
  const next = useCallback(() => setActive((i) => (i === null ? null : (i + 1) % items.length)), [items.length]);
  const prev = useCallback(
    () => setActive((i) => (i === null ? null : (i - 1 + items.length) % items.length)),
    [items.length],
  );

  useEffect(() => {
    if (active === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") next();
      if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [active, close, next, prev]);

  if (!items.length) return null;

  const track = async (event: string) => {
    try {
      await fetch(`${window.location.pathname}/track`.replace("/p/", "/api/public/"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event }),
      });
    } catch {
      /* analytics is best-effort */
    }
  };

  const layoutMode: GalleryMode = mode ?? (variant === "investment" ? "grid" : "masonry");

  return (
    <div>
      <ul
        className={clsx(
          layoutMode === "carousel"
            ? "flex snap-x snap-mandatory gap-2 overflow-x-auto pb-2 sm:gap-3 scrollbar-thin"
            : layoutMode === "grid"
              ? "grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3"
              : clsx("grid gap-2 sm:gap-3", variant === "signature" ? "grid-cols-2 lg:grid-cols-3" : "grid-cols-2 lg:grid-cols-12"),
        )}
      >
        {items.map((item, index) => (
          <li
            key={item.id}
            className={clsx(
              layoutMode === "carousel"
                ? "w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31%]"
                : layoutMode === "grid"
                  ? ""
                  : variant === "signature"
                    ? index === 0
                      ? "col-span-2 row-span-2 lg:col-span-2"
                      : ""
                    : index === 0
                      ? "col-span-2 lg:col-span-8 lg:row-span-2"
                      : index === 1
                        ? "lg:col-span-4"
                        : index === 2
                          ? "lg:col-span-4"
                          : "lg:col-span-3",
            )}
          >
            <button
              type="button"
              onClick={() => {
                setActive(index);
                void track("gallery_open");
              }}
              className={clsx(
                "group relative block w-full overflow-hidden bg-stone-soft",
                layoutMode !== "masonry"
                  ? "aspect-[4/3]"
                  : variant === "signature"
                    ? index === 0
                      ? "aspect-[4/3] lg:aspect-[5/4]"
                      : "aspect-[4/5]"
                    : index === 0
                      ? "aspect-[16/10]"
                      : "aspect-[4/3]",
              )}
              aria-label={`Abrir imagem ${index + 1}${item.caption ? `: ${item.caption}` : ""}`}
            >
              <Image
                src={item.src}
                alt={item.caption ?? item.room ?? "Fotografia do imóvel"}
                fill
                sizes={index === 0 ? "(max-width: 1024px) 100vw, 66vw" : "(max-width: 1024px) 50vw, 33vw"}
                className="object-cover transition duration-700 ease-editorial group-hover:scale-[1.02]"
              />
              {showCaptions && item.caption ? (
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-obsidian/70 to-transparent px-3 pb-2 pt-6 text-left text-[10px] text-porcelain/90 opacity-0 transition group-hover:opacity-100">
                  {item.caption}
                </span>
              ) : null}
            </button>
          </li>
        ))}
      </ul>

      {active !== null ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Galeria de fotografias"
          className="fixed inset-0 z-[80] flex flex-col bg-obsidian/97 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between px-4 py-3 text-porcelain/70">
            <span className="font-mono text-[10px] tracking-[0.16em]" aria-live="polite">
              {String(active + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
            </span>
            <button autoFocus onClick={close} aria-label="Fechar galeria" className="rounded-full p-2 transition hover:bg-porcelain/10 hover:text-porcelain">
              <X size={18} />
            </button>
          </div>
          <div className="relative flex-1">
            <Image
              key={items[active].id}
              src={items[active].src}
              alt={items[active].caption ?? "Fotografia do imóvel"}
              fill
              sizes="100vw"
              className="animate-fade-in object-contain"
              priority
            />
            <button
              onClick={prev}
              aria-label="Imagem anterior"
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full border border-porcelain/20 bg-obsidian/40 p-2.5 text-porcelain/80 transition hover:bg-obsidian/70 hover:text-porcelain"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={next}
              aria-label="Imagem seguinte"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full border border-porcelain/20 bg-obsidian/40 p-2.5 text-porcelain/80 transition hover:bg-obsidian/70 hover:text-porcelain"
            >
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="px-4 py-4 text-center">
            <p className="text-[11.5px] text-porcelain/70">
              {items[active].caption ?? items[active].room ?? ""}
            </p>
            <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.16em] text-porcelain/30">
              Use ← → para navegar · Esc para fechar
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
