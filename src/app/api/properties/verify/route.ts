import { propertyInputSchema } from "@/lib/schemas";
import { authed, json, readJson } from "@/server/http";
import { knowledgeFromDraft, stagedMedia } from "@/server/ai/draft";
import { validateProperty, generateListing, buildFaq } from "@/server/ai/engine";
import { providerInfo } from "@/server/ai/provider";

export const runtime = "nodejs";

/**
 * Assisted verification preview. Nothing is written: the wizard payload and the
 * staged uploads are analysed in memory and returned as suggestions pending
 * confirmation.
 */
export const POST = authed(async (req, { session }) => {
  const input = await readJson(req, propertyInputSchema);
  const media = stagedMedia(session.org.id, input.mediaIds);
  const kb = knowledgeFromDraft(input, media);
  const report = validateProperty(kb, media);
  const preview = generateListing(kb, "pt");
  const previewEn = generateListing(kb, "en");
  return json({
    issues: report.issues,
    missing: report.missing,
    mediaSuggestions: report.mediaSuggestions,
    preview: {
      title: preview.title,
      summary: preview.payload.summary,
      body: preview.body,
      features: preview.payload.features,
      metaTitle: preview.payload.metaTitle,
      metaDescription: preview.payload.metaDescription,
      locales: ["pt", "en"],
      englishBody: previewEn.body,
    },
    faq: buildFaq(kb),
    provider: providerInfo(),
    disclaimer:
      "Pré-visualização gerada a partir dos campos que introduziu. Nada foi guardado. As sugestões de classificação de imagens requerem confirmação antes de serem aplicadas.",
  });
});
