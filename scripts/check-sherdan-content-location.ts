import { existsSync } from "node:fs";
import path from "node:path";

const SHERDAN_SOURCE_FILES = [
  "NPC.md",
  "Fazioni.md",
  "Lore.md",
  "Campagna.md",
  "Background Personaggi.md",
  "Manuale del Giocatore.md",
] as const;

const root = process.cwd();
const privateDir = path.join(root, "content", "sherdan");
const publicDir = path.join(root, "public");

const args = new Set(process.argv.slice(2));
const strict = args.has("--strict") || process.env.SHERDAN_CONTENT_STRICT === "1";
const publicForbidden =
  strict || args.has("--public-forbidden") || process.env.SHERDAN_PUBLIC_FORBIDDEN === "1";
const requirePrivate =
  strict || args.has("--require-private") || process.env.SHERDAN_REQUIRE_PRIVATE === "1";

const privateFiles = SHERDAN_SOURCE_FILES.filter((file) =>
  existsSync(path.join(privateDir, file)),
);
const publicFiles = SHERDAN_SOURCE_FILES.filter((file) =>
  existsSync(path.join(publicDir, file)),
);
const missingPrivateFiles = SHERDAN_SOURCE_FILES.filter(
  (file) => !privateFiles.includes(file),
);

let failed = false;

if (privateFiles.length === SHERDAN_SOURCE_FILES.length) {
  console.log("[ok] Sherdan source markdown found in content/sherdan/.");
} else {
  const message =
    `[warn] content/sherdan/ is incomplete (${privateFiles.length}/${SHERDAN_SOURCE_FILES.length}).\n` +
    `       Missing: ${missingPrivateFiles.length > 0 ? missingPrivateFiles.join(", ") : "none"}`;
  if (requirePrivate) {
    console.error(message.replace("[warn]", "[fail]"));
    failed = true;
  } else {
    console.warn(message);
  }
}

if (publicFiles.length > 0) {
  const message =
    `[warn] ${publicFiles.length} Sherdan source markdown file(s) still exist in public/: ${publicFiles.join(", ")}.\n` +
    "       Raw campaign markdown contains GM-only secrets and must not be committed, deployed, or exposed to players.";
  if (publicForbidden) {
    console.error(message.replace("[warn]", "[fail]"));
    failed = true;
  } else {
    console.warn(
      `${message}\n       This fallback is tolerated only for temporary local single-user development.`,
    );
  }
} else {
  console.log("[ok] No Sherdan source markdown found in public/.");
}

if (privateFiles.length === 0 && publicFiles.length === 0) {
  const message =
    "[fail] No Sherdan source markdown found. Run `pnpm content:migrate:sherdan` after restoring public/*.md, or place files in content/sherdan/.";
  if (requirePrivate) {
    console.error(message);
    failed = true;
  } else {
    console.warn(message.replace("[fail]", "[warn]"));
  }
}

if (failed) process.exit(1);
