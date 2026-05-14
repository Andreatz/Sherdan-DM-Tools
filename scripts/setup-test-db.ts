import "dotenv/config";

import postgres from "postgres";

import {
  deriveAdminDatabaseUrl,
  deriveTestDatabaseUrl,
  getDatabaseName,
  isSafeTestDatabaseName,
  quotePgIdentifier,
} from "./_test-db-url";

async function main() {
  const sourceUrl = process.env.DATABASE_URL;
  if (!sourceUrl) {
    throw new Error("DATABASE_URL is required to derive the local test DB URL.");
  }

  const testUrl = process.env.TEST_DATABASE_URL ?? deriveTestDatabaseUrl(sourceUrl);
  const adminUrl =
    process.env.TEST_DATABASE_ADMIN_URL ?? deriveAdminDatabaseUrl(sourceUrl);
  const testDbName = getDatabaseName(testUrl);

  if (!isSafeTestDatabaseName(testDbName)) {
    throw new Error(
      `Refusing to prepare a non-test database: "${testDbName}". Use a name containing "test" or "ci".`,
    );
  }

  const owner = new URL(testUrl).username;
  const adminSql = postgres(adminUrl, { max: 1, onnotice: () => undefined });

  try {
    const [row] = await adminSql<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${testDbName}) AS exists
    `;

    if (row?.exists) {
      console.log(`test database exists: ${testDbName}`);
    } else {
      const ownerClause = owner
        ? ` OWNER ${quotePgIdentifier(decodeURIComponent(owner))}`
        : "";
      await adminSql.unsafe(
        `CREATE DATABASE ${quotePgIdentifier(testDbName)}${ownerClause}`,
      );
      console.log(`created test database: ${testDbName}`);
    }
  } finally {
    await adminSql.end();
  }

  const testSql = postgres(testUrl, { max: 1, onnotice: () => undefined });
  try {
    await testSql`CREATE EXTENSION IF NOT EXISTS vector`;
    await testSql`CREATE EXTENSION IF NOT EXISTS pg_trgm`;
    console.log("test database extensions ready: vector, pg_trgm");
    console.log(`DATABASE_URL=${testUrl}`);
  } finally {
    await testSql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
