"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

export function BeforeAfter() {
  const [pos, setPos] = useState(48);
  const frame = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const update = useCallback((clientX: number) => {
    const rect = frame.current?.getBoundingClientRect();
    if (!rect) return;
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPos(Math.min(96, Math.max(4, pct)));
  }, []);

  return (
    <div className="select-none">
      <div
        ref={frame}
        className="relative aspect-[16/10] w-full overflow-hidden bg-stone-soft"
        onPointerDown={(e) => {
          dragging.current = true;
          update(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) update(e.clientX);
        }}
        onPointerUp={() => (dragging.current = false)}
        onPointerLeave={() => (dragging.current = false)}
      >
        <Image
          src="/media/villa-living.jpg"
          alt="Sala de estar apresentada profissionalmente, após produção fotográfica"
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          className="object-cover"
        />
        <div className="absolute inset-0 overflow-hidden" style={{ width: `${pos}%` }}>
          <div className="absolute inset-0" style={{ width: `${(100 / pos) * 100}%` }}>
            <Image
              src="/media/before.jpg"
              alt="Fotografia original do imóvel antes da produção"
              fill
              sizes="(max-width: 1024px) 100vw, 60vw"
              className="object-cover"
            />
          </div>
        </div>
        <div
          className="absolute inset-y-0 w-px bg-porcelain/90"
          style={{ left: `${pos}%` }}
          aria-hidden
        >
          <div className="absolute top-1/2 left-1/2 flex h-10 w-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-porcelain/70 bg-obsidian/60 backdrop-blur-sm">
            <span className="text-[10px] tracking-[0.2em] text-porcelain">↔</span>
          </div>
        </div>
        <span className="absolute top-4 left-4 rounded-full bg-obsidian/60 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-porcelain backdrop-blur-sm">
          Antes
        </span>
        <span className="absolute top-4 right-4 rounded-full bg-porcelain/85 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-obsidian backdrop-blur-sm">
          Depois
        </span>
        <input
          type="range"
          min={4}
          max={96}
          value={pos}
          aria-label="Comparar antes e depois"
          onChange={(e) => setPos(Number(e.target.value))}
          className="absolute inset-x-0 bottom-3 mx-auto w-[70%] cursor-ew-resize accent-champagne"
        />
      </div>
      <p className="mt-3 text-[10.5px] leading-relaxed text-graphite-dim">
        As duas imagens são fotografias. A imagem “depois” representa produção fotográfica profissional de um
        espaço real — não é uma alteração gerada por IA. Melhoramentos por IA são sempre identificados como
        visualização ilustrativa.
      </p>
    </div>
  );
}
