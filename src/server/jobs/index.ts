import { many, one, run, uid, now, type Row } from "../db";
import { ApiError } from "../http";
import type { Job, JobStatus } from "@/lib/types";
import { buildKnowledge, mediaInventory } from "../ai/knowledge";
import {
  produceListing,
  produceMultilingual,
  produceAudience,
  produceCampaign,
  produceMediaBrief,
  verificationReport,
} from "../ai/studio";
import { mediaRoomSuggestions } from "../ai/engine";
import { providerInfo } from "../ai/provider";
import { createExperience, defaultConfig } from "../data/experiences";
import { refreshCompletion, getProperty } from "../data/properties";
import { logAudit } from "../audit";

export const TASK_TYPES = {
  validate_fields: {
    label: "Validar campos obrigatórios",
    description: "Verifica dados em falta, contradições e fotografias por aprovar.",
    needsReview: false,
  },
  analyze_media: {
    label: "Analisar media carregada",
    description: "Sugere categorias e legendas por palavras-chave. Requer confirmação humana.",
    needsReview: true,
  },
  generate_listing: {
    label: "Gerar rascunho de listagem",
    description: "Título, descrição, resumo, características e metadados em português.",
    needsReview: true,
  },
  generate_multilingual: {
    label: "Gerar versões multilingues",
    description: "Versões PT e EN a partir dos factos confirmados.",
    needsReview: true,
  },
  generate_audience_versions: {
    label: "Adaptar por audiência",
    description: "Versões para comprador nacional, internacional, famílias e investidores.",
    needsReview: true,
  },
  generate_campaign: {
    label: "Gerar pacote de campanha",
    description: "Redes sociais, email, WhatsApp, anúncios, FAQ e guião de vídeo.",
    needsReview: true,
  },
  generate_media_brief: {
    label: "Preparar briefing cinematográfico",
    description: "Sequência de planos, câmara, luz e formatos de saída.",
    needsReview: true,
  },
  prepare_experience: {
    label: "Preparar experiência do imóvel",
    description: "Cria a experiência em rascunho com layout e configuração iniciais.",
    needsReview: false,
  },
} as const;

export type TaskType = keyof typeof TASK_TYPES;

export type JobRow = Job & { property_title?: string | null; property_reference?: string | null; created_by_name?: string | null };

export function listJobs(orgId: string, opts: { limit?: number; propertyId?: string; status?: string } = {}) {
  const where = ["j.org_id = ?"];
  const params: unknown[] = [orgId];
  if (opts.propertyId) {
    where.push("j.property_id = ?");
    params.push(opts.propertyId);
  }
  if (opts.status && opts.status !== "all") {
    where.push("j.status = ?");
    params.push(opts.status);
  }
  const rows = many<Row>(
    `SELECT j.*, p.title AS property_title, p.reference AS property_reference, pr.full_name AS created_by_name
     FROM ai_jobs j LEFT JOIN properties p ON p.id = j.property_id
     LEFT JOIN profiles pr ON pr.id = j.created_by
     WHERE ${where.join(" AND ")} ORDER BY j.created_at DESC LIMIT ?`,
    [...params, Math.min(opts.limit ?? 50, 200)],
  );
  return rows as unknown as JobRow[];
}

export function getJob(orgId: string, id: string) {
  return one<Row>(
    `SELECT j.*, p.title AS property_title FROM ai_jobs j LEFT JOIN properties p ON p.id = j.property_id
     WHERE j.id = ? AND j.org_id = ?`,
    [id, orgId],
  ) as (Job & { property_title?: string }) | undefined;
}

export function jobStats(orgId: string) {
  const rows = many<{ status: JobStatus; c: number }>(
    `SELECT status, count(*) AS c FROM ai_jobs WHERE org_id = ? GROUP BY status`,
    [orgId],
  );
  const stats: Record<JobStatus, number> = {
    queued: 0,
    processing: 0,
    needs_review: 0,
    completed: 0,
    failed: 0,
  };
  rows.forEach((r) => (stats[r.status] = r.c));
  return stats;
}

export function enqueueJob(input: {
  orgId: string;
  propertyId: string | null;
  taskType: TaskType;
  createdBy: string;
  payload?: Record<string, unknown>;
  maxAttempts?: number;
}) {
  const id = uid();
  run(
    `INSERT INTO ai_jobs (id, org_id, property_id, task_type, status, provider, attempts, max_attempts, input, created_by, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      input.orgId,
      input.propertyId,
      input.taskType,
      "queued",
      providerInfo().id,
      0,
      input.maxAttempts ?? 2,
      JSON.stringify(input.payload ?? {}),
      input.createdBy,
      now(),
    ],
  );
  kick();
  return id;
}

async function executeJob(job: Row): Promise<{
  status: JobStatus;
  output?: Record<string, unknown>;
  error?: string;
}> {
  const { org_id: orgId, property_id: propertyId, task_type: taskType, created_by: createdBy } = job;
  let jobInput: { locale?: string } = {};
  try {
    jobInput = JSON.parse(job.input ?? "{}");
  } catch {
    jobInput = {};
  }
  const locale = jobInput.locale === "en" ? "en" : "pt";
  if (!propertyId) return { status: "failed", error: "Tarefa sem imóvel associado." };
  const property = getProperty(orgId, propertyId);
  if (!property) return { status: "failed", error: "Imóvel não encontrado para esta organização." };

  switch (taskType as TaskType) {
    case "validate_fields": {
      const report = verificationReport(orgId, propertyId);
      const errors = report.issues.filter((i) => i.level === "error");
      return {
        status: "completed",
        output: {
          summary:
            errors.length === 0
              ? `${report.issues.length} observações registadas, sem erros bloqueantes.`
              : `${errors.length} erro(s) bloqueantes e ${report.issues.length - errors.length} avisos.`,
          issues: report.issues,
          completion: property.completion,
          sources: report.sources,
        },
      };
    }
    case "analyze_media": {
      const media = mediaInventory(orgId, propertyId);
      if (!media.length) {
        return { status: "completed", output: { summary: "Sem ficheiros carregados para analisar.", suggestions: [] } };
      }
      const suggestions = mediaRoomSuggestions(media);
      return {
        status: "needs_review",
        output: {
          summary: `${suggestions.length} ficheiros analisados por heurística local. Nenhuma classificação foi aplicada automaticamente.`,
          provider: "local-heuristic",
          suggestions,
          media: media.map((m) => ({ id: m.id, file_name: m.file_name, kind: m.kind, room: m.room })),
          disclaimer:
            "Sugestões baseadas no nome do ficheiro e legendas. Não houve análise visual por modelo configurado.",
        },
      };
    }
    case "generate_listing": {
      const result = await produceListing(orgId, propertyId, createdBy, locale);
      return {
        status: "needs_review",
        output: {
          summary: "Rascunho de listagem gerado. Aguarda revisão humana antes de publicação.",
          contentId: result.content.id,
          provider: result.provider,
        },
      };
    }
    case "generate_multilingual": {
      const created = produceMultilingual(orgId, propertyId, createdBy);
      return {
        status: "needs_review",
        output: {
          summary: `${created.length} versões geradas (PT, EN).`,
          contentIds: created.map((c) => c.id),
          provider: "local-rules",
        },
      };
    }
    case "generate_audience_versions": {
      const created = produceAudience(orgId, propertyId, createdBy);
      return {
        status: "needs_review",
        output: {
          summary: `${created.length} versões por audiência geradas.`,
          contentIds: created.map((c) => c.id),
          provider: "local-rules",
        },
      };
    }
    case "generate_campaign": {
      const content = produceCampaign(orgId, propertyId, createdBy, locale);
      return {
        status: "needs_review",
        output: { summary: "Pacote de campanha gerado.", contentId: content.id, provider: "local-rules" },
      };
    }
    case "generate_media_brief": {
      const content = produceMediaBrief(orgId, propertyId, createdBy, locale);
      return {
        status: "needs_review",
        output: {
          summary: "Briefing cinematográfico pronto para produção externa.",
          contentId: content.id,
          provider: "local-rules",
        },
      };
    }
    case "prepare_experience": {
      const existing = one<Row>(`SELECT id, slug FROM property_experiences WHERE property_id = ? AND org_id = ?`, [
        propertyId,
        orgId,
      ]);
      if (existing) {
        return { status: "completed", output: { summary: "Experiência já existente.", slug: existing.slug, existing: true } };
      }
      const experience = createExperience(orgId, createdBy, propertyId, "architectural");
      void defaultConfig;
      return {
        status: "completed",
        output: { summary: "Experiência criada em rascunho.", slug: experience.slug, layout: experience.layout },
      };
    }
    default:
      return { status: "failed", error: `Tipo de tarefa desconhecido: ${taskType}` };
  }
}

export async function runJob(jobId: string) {
  const job = one<Row>(`SELECT * FROM ai_jobs WHERE id = ?`, [jobId]);
  if (!job) throw new ApiError("Tarefa inexistente.", 404, "not_found");
  if (job.status === "processing") return;
  run(`UPDATE ai_jobs SET status = 'processing', started_at = ?, attempts = attempts + 1 WHERE id = ?`, [
    now(),
    jobId,
  ]);
  try {
    const result = await executeJob(job);
    run(
      `UPDATE ai_jobs SET status = ?, output = ?, error = ?, completed_at = ?, provider = ? WHERE id = ?`,
      [
        result.status,
        result.output ? JSON.stringify(result.output) : null,
        result.error ?? null,
        result.status === "needs_review" || result.status === "completed" ? now() : null,
        job.provider ?? providerInfo().id,
        jobId,
      ],
    );
    if (job.property_id) {
      run(
        `UPDATE properties SET status = CASE WHEN status = 'draft' THEN 'in_preparation' ELSE status END, updated_at = ? WHERE id = ? AND org_id = ?`,
        [now(), job.property_id, job.org_id],
      );
      refreshCompletion(job.property_id, job.org_id);
    }
    logAudit({
      orgId: job.org_id,
      actorId: job.created_by,
      action: `ai.job.${result.status}`,
      entity: "ai_job",
      entityId: jobId,
      meta: { task_type: job.task_type, property_id: job.property_id },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const attempts = Number(job.attempts) + 1;
    const maxAttempts = Number(job.max_attempts) || 2;
    const willRetry = attempts < maxAttempts && !(error instanceof ApiError && error.status < 500 && error.code !== "provider_unreachable");
    run(
      `UPDATE ai_jobs SET status = ?, error = ?, completed_at = ?, attempts = ? WHERE id = ?`,
      [willRetry ? "queued" : "failed", message, willRetry ? null : now(), attempts, jobId],
    );
    logAudit({
      orgId: job.org_id,
      actorId: job.created_by,
      action: "ai.job.failed",
      entity: "ai_job",
      entityId: jobId,
      meta: { task_type: job.task_type, error: message, retry: willRetry },
    });
  }
}

export function retryJob(orgId: string, jobId: string) {
  const job = getJob(orgId, jobId);
  if (!job) throw new ApiError("Tarefa inexistente.", 404, "not_found");
  if (job.status !== "failed") throw new ApiError("Apenas tarefas com falha podem ser repetidas.", 409, "invalid_state");
  run(
    `UPDATE ai_jobs SET status = 'queued', error = NULL, attempts = 0, max_attempts = max_attempts + 1, completed_at = NULL WHERE id = ?`,
    [jobId],
  );
  kick();
  return true;
}

/* ─────────── in-process scheduler ─────────── */

const workerState = ((globalThis as any).__estateWorker = (globalThis as any).__estateWorker ?? {
  running: false,
  timer: null as NodeJS.Timeout | null,
}) as { running: boolean; timer: NodeJS.Timeout | null };

export async function processQueue(limit = 3) {
  if (workerState.running) return 0;
  workerState.running = true;
  let processed = 0;
  try {
    for (let i = 0; i < limit; i += 1) {
      const job = one<Row>(
        `SELECT * FROM ai_jobs WHERE status = 'queued' ORDER BY created_at ASC LIMIT 1`,
      );
      if (!job) break;
      await runJob(job.id);
      processed += 1;
    }
  } finally {
    workerState.running = false;
  }
  return processed;
}

function kick() {
  setTimeout(() => {
    void processQueue(2).catch((error) => console.error("[worker] queue error", error));
  }, 50);
}

export function startWorker() {
  if (workerState.timer) return;
  const globalFlag = globalThis as any;
  if (globalFlag.__estateWorkerStarted) return;
  globalFlag.__estateWorkerStarted = true;
  workerState.timer = setInterval(() => {
    void processQueue(2).catch((error) => console.error("[worker] tick error", error));
  }, 4000);
  workerState.timer.unref?.();
  console.log("[worker] ESTATE OS job scheduler started");
}

let bootstrapped = false;

/** Starts the in-process scheduler once per server instance. Called from server components. */
export function ensureWorker() {
  if (bootstrapped) return;
  bootstrapped = true;
  const globalFlag = globalThis as any;
  if (globalFlag.__estateWorkerBootstrapped) return;
  globalFlag.__estateWorkerBootstrapped = true;
  try {
    resetStaleJobs();
  } catch (error) {
    console.error("[worker] failed to reset stale jobs", error);
  }
  startWorker();
}

export function resetStaleJobs() {
  run(
    `UPDATE ai_jobs SET status = 'queued', error = 'Reprocessado após reinício do serviço.' WHERE status = 'processing'`,
  );
}
