"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { clsx } from "clsx";
import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Globe2,
  Users,
  CalendarDays,
  Images,
  ChartNoAxesColumn,
  UsersRound,
  Settings,
  Menu,
  X,
  Plus,
  LogOut,
  Search,
  CircleDot,
} from "lucide-react";

const NAV = [
  { href: "/app", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/app/properties", label: "Properties", icon: Building2 },
  { href: "/app/ai-studio", label: "AI Studio", icon: Sparkles },
  { href: "/app/experiences", label: "Experiences", icon: Globe2 },
  { href: "/app/leads", label: "Leads & CRM", icon: Users },
  { href: "/app/visits", label: "Visits", icon: CalendarDays },
  { href: "/app/media", label: "Media Library", icon: Images },
  { href: "/app/analytics", label: "Analytics", icon: ChartNoAxesColumn },
  { href: "/app/team", label: "Team", icon: UsersRound },
  { href: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({
  children,
  orgName,
  planName,
  role,
  userName,
  userEmail,
  isDemo,
  newLeads,
  pendingReviews,
}: {
  children: React.ReactNode;
  orgName: string;
  planName: string;
  role: string;
  userName: string;
  userEmail: string;
  isDemo: boolean;
  newLeads: number;
  pendingReviews: number;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  const isActive = (item: (typeof NAV)[number]) =>
    item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);

  async function logout() {
    setLoggingOut(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  const badge = (href: string) => {
    if (href === "/app/leads" && newLeads > 0) return newLeads;
    if (href === "/app/ai-studio" && pendingReviews > 0) return pendingReviews;
    return null;
  };

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/app" className="inline-flex items-baseline gap-2 font-medium tracking-[0.22em]">
          <span className="text-[12.5px] uppercase">Estate</span>
          <span className="text-[12.5px] uppercase text-champagne-deep">OS</span>
        </Link>
        <button className="lg:hidden" onClick={() => setOpen(false)} aria-label="Fechar menu">
          <X size={18} />
        </button>
      </div>

      <div className="px-5 pb-4">
        <p className="truncate text-[12px] font-medium text-obsidian">{orgName}</p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] uppercase tracking-[0.12em] text-graphite-dim">
          Plano {planName}
          {isDemo ? <span className="rounded-full bg-champagne/20 px-1.5 py-px text-[8.5px] text-champagne-deep">demo</span> : null}
        </p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 pb-4">
        <ul className="space-y-0.5">
          {NAV.map((item) => {
            const active = isActive(item);
            const count = badge(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={clsx(
                    "group flex items-center gap-3 rounded-md px-2.5 py-2 text-[12.5px] transition-colors duration-200",
                    active ? "bg-obsidian text-porcelain" : "text-graphite hover:bg-obsidian/[0.05] hover:text-obsidian",
                  )}
                >
                  <item.icon size={15} strokeWidth={1.6} className={active ? "text-champagne" : ""} />
                  <span className="flex-1">{item.label}</span>
                  {count ? (
                    <span
                      className={clsx(
                        "rounded-full px-1.5 py-0.5 font-mono text-[9.5px]",
                        active ? "bg-porcelain/15 text-porcelain" : "bg-champagne/20 text-champagne-deep",
                      )}
                    >
                      {count}
                    </span>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="mt-6 border-t border-obsidian/10 pt-4">
          <Link
            href="/app/properties/new"
            className="flex items-center gap-2 rounded-md border border-dashed border-obsidian/20 px-2.5 py-2 text-[12px] text-graphite transition hover:border-obsidian/50 hover:text-obsidian"
          >
            <Plus size={14} /> Nova propriedade
          </Link>
        </div>
      </nav>

      <div className="border-t border-obsidian/10 p-3">
        <button
          onClick={() => setMenu((v) => !v)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition hover:bg-obsidian/[0.04]"
          aria-expanded={menu}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-forest text-[10px] font-medium text-porcelain">
            {userName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[11.5px] font-medium">{userName}</span>
            <span className="block truncate text-[10px] text-graphite-dim">{role}</span>
          </span>
        </button>
        {menu ? (
          <div className="mt-1 space-y-0.5 rounded-md border border-obsidian/10 bg-white p-1">
            <p className="truncate px-2 py-1.5 text-[10px] text-graphite-dim">{userEmail}</p>
            <Link href="/app/settings" className="block rounded px-2 py-1.5 text-[11.5px] hover:bg-obsidian/[0.04]">
              Definições
            </Link>
            <button
              onClick={logout}
              disabled={loggingOut}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[11.5px] text-graphite hover:bg-obsidian/[0.04]"
            >
              <LogOut size={12} /> {loggingOut ? "A sair…" : "Terminar sessão"}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return (
    <div className="min-h-svh bg-[#F3F1EC]">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[232px] border-r border-obsidian/10 bg-porcelain lg:block">
        {sidebar}
      </aside>

      {open ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-obsidian/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] border-r border-obsidian/10 bg-porcelain">{sidebar}</aside>
        </div>
      ) : null}

      <div className="lg:pl-[232px]">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-obsidian/10 bg-porcelain/90 px-4 backdrop-blur sm:px-6">
          <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
            <Menu size={19} />
          </button>
          <form action="/app/properties" className="hidden max-w-xs flex-1 sm:block">
            <label className="flex items-center gap-2 border-b border-transparent text-graphite-dim transition focus-within:border-obsidian/30">
              <Search size={14} />
              <input
                name="q"
                placeholder="Pesquisar imóveis, leads…"
                className="w-full bg-transparent py-1.5 text-[12px] text-obsidian placeholder:text-graphite-dim/70 focus:outline-none"
              />
            </label>
          </form>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[10.5px] text-graphite-dim sm:flex">
              <CircleDot size={10} className="text-forest" />
              Sistema operacional
            </span>
            <Link href="/app/properties/new" className="btn btn-sm btn-primary">
              <Plus size={13} /> Nova propriedade
            </Link>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 sm:py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}
