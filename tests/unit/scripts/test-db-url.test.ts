import { describe, expect, it } from "vitest";

import {
  deriveAdminDatabaseUrl,
  deriveTestDatabaseUrl,
  getDatabaseName,
  isSafeTestDatabaseName,
  quotePgIdentifier,
} from "../../../scripts/_test-db-url";

describe("test database URL helpers", () => {
  it("derives a sibling _test database URL", () => {
    const url =
      "postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm?sslmode=disable";

    expect(deriveTestDatabaseUrl(url)).toBe(
      "postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test?sslmode=disable",
    );
  });

  it("keeps an already safe test database name unchanged", () => {
    const url = "postgres://sherdan:sherdan_dev@localhost:5432/sherdan_dm_test";

    expect(deriveTestDatabaseUrl(url)).toBe(url);
  });

  it("derives an admin connection URL on the same server", () => {
    const url = "postgresql://user:pass@db.internal:5432/app";

    expect(deriveAdminDatabaseUrl(url)).toBe(
      "postgresql://user:pass@db.internal:5432/postgres",
    );
  });

  it("validates safe test database names", () => {
    expect(isSafeTestDatabaseName("sherdan_dm_test")).toBe(true);
    expect(isSafeTestDatabaseName("ci")).toBe(true);
    expect(isSafeTestDatabaseName("sherdan_dm")).toBe(false);
  });

  it("quotes Postgres identifiers safely", () => {
    expect(quotePgIdentifier('weird"name')).toBe('"weird""name"');
    expect(() => quotePgIdentifier("bad\0name")).toThrow(/NUL/);
  });

  it("requires a database name", () => {
    expect(() => getDatabaseName("postgres://localhost")).toThrow(
      /database name/i,
    );
  });
});
