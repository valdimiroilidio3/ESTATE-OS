import fs from "node:fs";
import path from "node:path";

const file = process.env.DATABASE_PATH
  ? path.resolve(process.cwd(), process.env.DATABASE_PATH)
  : path.join(process.cwd(), "data", "estate.db");
for (const suffix of ["", "-wal", "-shm"]) {
  const target = `${file}${suffix}`;
  if (fs.existsSync(target)) {
    fs.unlinkSync(target);
    console.log(`removido ${target}`);
  }
}
console.log("Base de dados removida. Execute `npm run db:seed` para recriar.");
