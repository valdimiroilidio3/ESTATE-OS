/**
 * Production initialisation: creates the schema and the plan catalogue.
 *
 *   npm run db:init
 *
 * Idempotent — safe to run on every deploy. It never inserts properties, people
 * or organisations. The first organisation is created by the first real signup.
 */
import { db, one } from "../src/server/db";
import { ensurePlans } from "../src/server/plans";

ensurePlans();

const tables = db
  .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  .all() as { name: string }[];

const profiles = one<{ n: number }>(`SELECT count(*) AS n FROM profiles`)?.n ?? 0;
const orgs = one<{ n: number }>(`SELECT count(*) AS n FROM organizations`)?.n ?? 0;

console.log(`✓ Schema pronto — ${tables.length} tabelas.`);
console.log(`  Organizações: ${orgs} · Utilizadores: ${profiles}`);
if (orgs === 0) {
  console.log("  Instância vazia. Crie a primeira conta em /signup — essa conta define a primeira organização.");
}
