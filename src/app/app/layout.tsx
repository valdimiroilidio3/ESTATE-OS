import { redirect } from "next/navigation";
import { getSession } from "@/server/auth";
import { AppShell } from "@/components/app/app-shell";
import { ToastProvider } from "@/components/ui/client";
import { one, type Row } from "@/server/db";
import { getPlan } from "@/server/plans";
import { ensureWorker } from "@/server/jobs";
import { ROLE_LABELS } from "@/lib/labels";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  ensureWorker();

  const newLeads =
    one<{ c: number }>(`SELECT count(*) AS c FROM leads WHERE org_id = ? AND status = 'new'`, [session.org.id])?.c ?? 0;
  const pendingReviews =
    one<{ c: number }>(
      `SELECT count(*) AS c FROM ai_jobs WHERE org_id = ? AND status = 'needs_review'`,
      [session.org.id],
    )?.c ?? 0;
  const plan = getPlan(session.org.plan_code);
  const demo = Boolean((session.org.settings as Record<string, unknown>).demo);

  return (
    <ToastProvider>
      <AppShell
        orgName={session.org.name}
        planName={plan?.name ?? session.org.plan_code}
        role={ROLE_LABELS[session.role] ?? session.role}
        userName={session.profile.full_name}
        userEmail={session.profile.email}
        isDemo={demo}
        newLeads={newLeads}
        pendingReviews={pendingReviews}
      >
        {children}
      </AppShell>
    </ToastProvider>
  );
}
