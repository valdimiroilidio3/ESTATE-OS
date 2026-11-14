/**
 * Drops every table in the public schema. Destructive: local development only.
 *
 *   npm run db:reset
 */
import { exec } from "../src/server/db";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("Recusado: db:reset apaga toda a base de dados e não corre em produção.");
    process.exit(1);
  }

  await exec(`DROP SCHEMA public CASCADE; CREATE SCHEMA public;`);
  console.log("✓ Base de dados limpa. Execute `npm run db:init` para recriar o esquema.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
