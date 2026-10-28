"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { clsx } from "clsx";
import { X, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";

/* ───────── toasts ───────── */

type ToastKind = "success" | "error" | "info";
type Toast = { id: number; kind: ToastKind; title: string; description?: string };

const ToastContext = createContext<{ push: (t: Omit<Toast, "id">) => void } | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((toast: Omit<Toast, "id">) => {
    counter.current += 1;
    const id = counter.current;
    setToasts((prev) => [...prev, { ...toast, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), toast.kind === "error" ? 7000 : 4500);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 bottom-4 z-[100] flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={clsx(
              "pointer-events-auto flex w-full max-w-sm animate-fade-up items-start gap-3 rounded-lg border px-4 py-3 shadow-[0_18px_50px_-24px_rgba(16,17,16,0.4)]",
              toast.kind === "error"
                ? "border-red-900/20 bg-white text-red-900"
                : "border-obsidian/10 bg-obsidian text-porcelain",
            )}
          >
            <span className="mt-0.5">
              {toast.kind === "success" ? (
                <CheckCircle2 size={16} className="text-champagne" />
              ) : toast.kind === "error" ? (
                <AlertTriangle size={16} />
              ) : (
                <Info size={16} className="text-champagne" />
              )}
            </span>
            <div className="flex-1">
              <p className="text-[13px] font-medium">{toast.title}</p>
              {toast.description ? (
                <p className={clsx("mt-1 text-[11.5px] leading-relaxed", toast.kind === "error" ? "text-red-900/70" : "text-porcelain/65")}>
                  {toast.description}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) return { push: () => undefined };
  return ctx;
}

/* ───────── modal ───────── */

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children?: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement as HTMLElement | null;
    const focusables = () =>
      Array.from(
        ref.current?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea, input:not([type="hidden"]), select, [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.offsetParent !== null);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const items = focusables();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    const target = focusables()[0] ?? ref.current;
    target?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      opener?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-obsidian/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-6">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={ref}
        className={clsx(
          "max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-obsidian/10 bg-porcelain p-6 shadow-2xl sm:rounded-xl sm:p-7",
          size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl",
        )}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[17px] font-medium">{title}</h2>
            {description ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-graphite-dim">{description}</p> : null}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="rounded-full p-1.5 text-graphite transition hover:bg-obsidian/5">
            <X size={16} />
          </button>
        </div>
        <div className="mt-5">{children}</div>
        {footer ? <div className="mt-6 flex flex-wrap justify-end gap-2">{footer}</div> : null}
      </div>
    </div>
  );
}

/* ───────── misc ───────── */

export function Spinner({ size = 14, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={clsx("animate-spin", className)} />;
}

export function SubmitButton({
  children,
  pending,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { pending?: boolean }) {
  return (
    <button {...props} disabled={pending || props.disabled} className={className}>
      {pending ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function CharacterCount({ value, max }: { value: string; max: number }) {
  const over = value.length > max;
  return (
    <span className={clsx("text-[10.5px] tabular-nums", over ? "text-red-800" : "text-graphite-dim")}>
      {value.length}/{max}
    </span>
  );
}

export function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1800);
        } catch {
          setCopied(false);
        }
      }}
      className="text-[11px] font-medium uppercase tracking-[0.12em] text-graphite-dim transition hover:text-obsidian"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
