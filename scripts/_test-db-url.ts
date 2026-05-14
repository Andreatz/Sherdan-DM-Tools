const TEST_DB_SUFFIX = "_test";

export function getDatabaseName(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const name = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!name) {
    throw new Error("DATABASE_URL must include a database name.");
  }
  return name;
}

export function deriveTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  const currentName = getDatabaseName(databaseUrl);
  const testName = isSafeTestDatabaseName(currentName)
    ? currentName
    : `${currentName}${TEST_DB_SUFFIX}`;

  url.pathname = `/${encodeURIComponent(testName)}`;
  return url.toString();
}

export function deriveAdminDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
}

export function isSafeTestDatabaseName(databaseName: string): boolean {
  return databaseName === "ci" || /test/i.test(databaseName);
}

export function quotePgIdentifier(identifier: string): string {
  if (identifier.includes("\0")) {
    throw new Error("Postgres identifiers cannot contain NUL bytes.");
  }
  return `"${identifier.replace(/"/g, '""')}"`;
}
