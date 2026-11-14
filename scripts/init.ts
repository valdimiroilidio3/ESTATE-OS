/**
 * Production initialisation: creates the schema and the plan catalogue.
 *
 *   npm run db:init
 *
 * Idempotent — safe to run on every deploy. It never inserts properties, people
 * or organisations. The first organisation is created by the first real signup.
 */
import { ensureSchema, many, one } from "../src/server/db";
import { ensurePlans } from "../src/server/plans";

async function main() {
  await ensureSchema();
  await ensurePlans();

  const tables = await many<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name`,
  );
  const profiles = (await one<{ n: number }>(`SELECT count(*) AS n FROM profiles`))?.n ?? 0;
  const orgs = (await one<{ n: number }>(`SELECT count(*) AS n FROM organizations`))?.n ?? 0;

  console.log(`✓ Schema pronto — ${tables.length} tabelas.`);
  console.log(`  Organizações: ${orgs} · Utilizadores: ${profiles}`);
  if (orgs === 0) {
    console.log("  Instância vazia. Crie a primeira conta em /signup — essa conta define a primeira organização.");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
