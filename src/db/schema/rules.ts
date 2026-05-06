import { sql } from "drizzle-orm";
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

export const ruleDocuments = pgTable(
  "rule_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // 'srd' | 'sherdan-custom' | ... vocabolario aperto, validato lato app.
    source: text("source").notNull(),
    title: text("title"),
    section: text("section"),
    content: text("content").notNull(),
    // Posizione del chunk all'interno del documento sorgente, per ordinare.
    chunkIndex: integer("chunk_index"),
    embedding: vector("embedding", { dimensions: 1024 }),
    metadata: jsonb("metadata").default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("idx_rule_documents_source").on(t.source),
    // Trigram index per fuzzy match su content (BM25-ish via similarity()).
    index("idx_rule_documents_content_trgm").using(
      "gin",
      sql`${t.content} gin_trgm_ops`,
    ),
  ],
);
