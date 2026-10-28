import { z } from "zod";
import { many, one, run, uid, now, type Row } from "../db";
import { ApiError } from "../http";
import { buildKnowledge, mediaInventory, factsDigest } from "./knowledge";
import {
  generateListing,
  generateAudienceVersions,
  generateCampaign,
  generateMediaBrief,
  validateProperty,
  buildFaq,
  type GeneratedPiece,
} from "./engine";
import { generateText, providerInfo } from "./provider";
import { mapContent } from "../data/properties";
import { refreshCompletion } from "../data/properties";
import type { ContentRecord } from "@/lib/types";

const modelListingSchema = z.object({
  title: z.string().min(3),
  body: z.string().min(20),
  summary: z.string().min(10),
  features: z.array(z.string()).default([]),
  metaTitle: z.string().default(""),
  metaDescription: z.string().default(""),
  ctas: z.array(z.string()).default([]),
});

async function tryModelListing(kb: ReturnType<typeof buildKnowledge>, locale: "pt" | "en") {
  const info = providerInfo();
  if (info.mode !== "model" || !info.configured) return null;
  const system = `You are a senior real estate copywriter for a luxury property agency. Write in ${
    locale === "pt" ? "European Portuguese" : "English"
  }. Use ONLY the confirmed facts provided. Never invent features, views, materials, yields or distances. If a fact is absent, omit it. Tone: elegant, factual, sensory but restrained. Return a JSON object with keys: title, body (3 short paragraphs separated by \\n\\n), summary (max 240 chars), features (string array of confirmed facts only), metaTitle (max 60 chars), metaDescription (max 155 chars), ctas (array of 2-3 short calls to action).`;
  const user = `Confirmed facts for property ${kb.property.reference}:\n${factsDigest(kb)}`;
  const result = await generateText(
    [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    { json: true, temperature: 0.5, maxTokens: 1200 },
  );
  const parsed = modelListingSchema.parse(JSON.parse(result.text));
  return {
    piece: {
      kind: "listing",
      locale,
      variant: "default",
      title: parsed.title,
      body: parsed.body,
      payload: {
        summary: parsed.summary,
        features: parsed.features,
        metaTitle: parsed.metaTitle,
        metaDescription: parsed.metaDescription,
        ctas: parsed.ctas,
        sources: kb.facts.map((f) => `${f.label}: ${f.value} — ${f.source}`),
        model: result.provider,
      },
    } satisfies GeneratedPiece,
    provider: result.provider,
    usage: result.usage,
    latencyMs: result.latencyMs,
  };
}

export function saveContent(input: {
  orgId: string;
  propertyId: string;
  piece: GeneratedPiece;
  createdBy: string;
  provider: string;
}) {
  const { orgId, propertyId, piece, createdBy, provider } = input;
  // Previous drafts of the same kind/locale/variant move to archive (version history).
  run(
    `UPDATE property_content SET status = 'archived', updated_at = ?
     WHERE org_id = ? AND property_id = ? AND kind = ? AND locale = ? AND variant = ? AND status = 'draft'`,
    [now(), orgId, propertyId, piece.kind, piece.locale, piece.variant],
  );
  const id = uid();
  run(
    `INSERT INTO property_content (id, org_id, property_id, kind, locale, variant, title, body, payload, provider,
      status, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      orgId,
      propertyId,
      piece.kind,
      piece.locale,
      piece.variant,
      piece.title,
      piece.body,
      JSON.stringify(piece.payload),
      provider,
      "draft",
      createdBy,
      now(),
      now(),
    ],
  );
  refreshCompletion(propertyId, orgId);
  return mapContent(one<Row>(`SELECT * FROM property_content WHERE id = ?`, [id])!);
}

export async function produceListing(
  orgId: string,
  propertyId: string,
  createdBy: string,
  locale: "pt" | "en" = "pt",
) {
  const kb = buildKnowledge(orgId, propertyId);
  let provider = "local-rules";
  let piece: GeneratedPiece;
  try {
    const modelled = await tryModelListing(kb, locale);
    if (modelled) {
      piece = modelled.piece;
      provider = modelled.provider;
      run(
        `INSERT INTO ai_usage (id, org_id, property_id, provider, operation, prompt_tokens, completion_tokens, latency_ms, status, created_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)`,
        [
          uid(),
          orgId,
          propertyId,
          modelled.provider,
          "generate_listing",
          modelled.usage?.prompt_tokens ?? null,
          modelled.usage?.completion_tokens ?? null,
          modelled.latencyMs,
          "success",
          now(),
        ],
      );
    } else {
      piece = generateListing(kb, locale);
    }
  } catch (error) {
    // Provider failure must not block the pipeline: fall back to deterministic output.
    console.warn("[ai] model listing failed, using deterministic fallback", (error as Error).message);
    piece = generateListing(kb, locale);
    provider = "local-rules (fallback)";
  }
  return { content: saveContent({ orgId, propertyId, piece, createdBy, provider }), provider };
}

export function produceMultilingual(orgId: string, propertyId: string, createdBy: string) {
  const kb = buildKnowledge(orgId, propertyId);
  const created = (["pt", "en"] as const).map((locale) =>
    saveContent({
      orgId,
      propertyId,
      piece: generateListing(kb, locale),
      createdBy,
      provider: "local-rules",
    }),
  );
  return created;
}

export function produceAudience(orgId: string, propertyId: string, createdBy: string) {
  const kb = buildKnowledge(orgId, propertyId);
  return generateAudienceVersions(kb).map((piece) =>
    saveContent({ orgId, propertyId, piece, createdBy, provider: "local-rules" }),
  );
}

export function produceCampaign(orgId: string, propertyId: string, createdBy: string, locale: "pt" | "en" = "pt") {
  const kb = buildKnowledge(orgId, propertyId);
  return saveContent({
    orgId,
    propertyId,
    piece: generateCampaign(kb, locale),
    createdBy,
    provider: "local-rules",
  });
}

export function produceMediaBrief(orgId: string, propertyId: string, createdBy: string, locale: "pt" | "en" = "pt") {
  const kb = buildKnowledge(orgId, propertyId);
  return saveContent({
    orgId,
    propertyId,
    piece: generateMediaBrief(kb, locale),
    createdBy,
    provider: "local-rules",
  });
}

export function verificationReport(orgId: string, propertyId: string) {
  const kb = buildKnowledge(orgId, propertyId);
  const media = mediaInventory(orgId, propertyId);
  const report = validateProperty(kb, media);
  return {
    ...report,
    faq: buildFaq(kb),
    facts: kb.facts,
    sources: Array.from(new Set(kb.facts.map((f) => f.source))),
    approvedPhotos: kb.approvedPhotos,
  };
}

export function listContent(orgId: string, propertyId: string): ContentRecord[] {
  return many<Row>(
    `SELECT * FROM property_content WHERE org_id = ? AND property_id = ? ORDER BY updated_at DESC`,
    [orgId, propertyId],
  ).map(mapContent);
}

export function updateContent(
  orgId: string,
  id: string,
  patch: { title?: string | null; body?: string | null; payload?: Record<string, unknown>; status?: "draft" | "approved" | "archived" },
  actorId: string,
) {
  const row = one<Row>(`SELECT * FROM property_content WHERE id = ? AND org_id = ?`, [id, orgId]);
  if (!row) throw new ApiError("Conteúdo inexistente.", 404, "not_found");
  const set: Record<string, unknown> = { updated_at: now() };
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.body !== undefined) set.body = patch.body;
  if (patch.payload !== undefined) set.payload = JSON.stringify(patch.payload);
  if (patch.status !== undefined) {
    set.status = patch.status;
    if (patch.status === "approved") {
      set.approved_by = actorId;
      set.approved_at = now();
    }
    if (patch.status !== "approved") {
      set.approved_by = null;
      set.approved_at = null;
    }
  }
  const keys = Object.keys(set);
  run(
    `UPDATE property_content SET ${keys.map((k) => `${k} = ?`).join(", ")} WHERE id = ? AND org_id = ?`,
    [...keys.map((k) => set[k]), id, orgId],
  );
  refreshCompletion(row.property_id, orgId);
  return mapContent(one<Row>(`SELECT * FROM property_content WHERE id = ?`, [id])!);
}

export function deleteContent(orgId: string, id: string) {
  const row = one<Row>(`SELECT * FROM property_content WHERE id = ? AND org_id = ?`, [id, orgId]);
  if (!row) throw new ApiError("Conteúdo inexistente.", 404, "not_found");
  run(`DELETE FROM property_content WHERE id = ? AND org_id = ?`, [id, orgId]);
  refreshCompletion(row.property_id, orgId);
}

export function latestContent(orgId: string, propertyId: string, kind: string, locale = "pt") {
  return one<Row>(
    `SELECT * FROM property_content WHERE org_id = ? AND property_id = ? AND kind = ? AND locale = ?
     ORDER BY CASE status WHEN 'approved' THEN 0 WHEN 'draft' THEN 1 ELSE 2 END, updated_at DESC LIMIT 1`,
    [orgId, propertyId, kind, locale],
  );
}
