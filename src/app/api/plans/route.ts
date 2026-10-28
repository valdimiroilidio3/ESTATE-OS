import { getPlans } from "@/server/plans";
import { json } from "@/server/http";

export const runtime = "nodejs";

export async function GET() {
  return json({ items: getPlans() });
}
