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
const strict =
  process.argv.includes("--strict") || process.env.SHERDAN_CONTENT_STRICT === "1";

const privateFiles = SHERDAN_SOURCE_FILES.filter((file) =>
  existsSync(path.join(privateDir, file)),
);
const publicFiles = SHERDAN_SOURCE_FILES.filter((file) =>
  existsSync(path.join(publicDir, file)),
);
const missingPrivateFiles = SHERDAN_SOURCE_FILES.filter(
  (file) => !privateFiles.includes(file),
);

if (privateFiles.length === SHERDAN_SOURCE_FILES.length) {
  console.log("[ok] Sherdan source markdown found in content/sherdan/.");
} else {
  console.warn(
    `[warn] content/sherdan/ is incomplete (${privateFiles.length}/${SHERDAN_SOURCE_FILES.length}).`,
  );
  console.warn(
    `       Missing: ${missingPrivateFiles.length > 0 ? missingPrivateFiles.join(", ") : "none"}`,
  );
}

if (publicFiles.length > 0) {
  const message =
    `[warn] ${publicFiles.length} Sherdan source markdown file(s) still exist in public/: ${publicFiles.join(", ")}.\n` +
    "       This is acceptable only for local single-user development. Move them before Player Dashboard or public/semi-public deployment.";
  if (strict) {
    console.error(message.replace("[warn]", "[fail]"));
    process.exit(1);
  }
  console.warn(message);
} else {
  console.log("[ok] No Sherdan source markdown found in public/.");
}

if (privateFiles.length === 0 && publicFiles.length === 0) {
  console.error(
    "[fail] No Sherdan source markdown found. Run `pnpm content:migrate:sherdan` after restoring public/*.md, or place files in content/sherdan/.",
  );
  process.exit(1);
}
