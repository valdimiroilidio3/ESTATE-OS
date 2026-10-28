import { redirect } from "next/navigation";
import { getSession } from "./auth";
import type { Session } from "@/lib/types";

/** Server-component guard. Redirects to the login screen when there is no session. */
export async function requireSessionPage(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}
