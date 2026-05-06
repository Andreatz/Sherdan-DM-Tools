import "dotenv/config";

import postgres from "postgres";

import { env } from "@/lib/env";

async function main() {
  const sql = postgres(env.DATABASE_URL, { max: 1 });
  try {
    const [row] = await sql<{ version: string }[]>`SELECT version()`;
    const exts = await sql<
      { extname: string; extversion: string }[]
    >`SELECT extname, extversion FROM pg_extension ORDER BY extname`;
    console.log("connected:", row?.version);
    console.log("extensions:");
    for (const e of exts) {
      console.log(`  - ${e.extname} ${e.extversion}`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
