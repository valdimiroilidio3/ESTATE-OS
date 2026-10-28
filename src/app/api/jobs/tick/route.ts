import { authed, json } from "@/server/http";
import { processQueue } from "@/server/jobs";

export const runtime = "nodejs";

export const POST = authed(async () => {
  const processed = await processQueue(3);
  return json({ processed });
});
