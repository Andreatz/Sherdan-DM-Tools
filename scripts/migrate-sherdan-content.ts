import { copyFileSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import path from "node:path";

const SHERDAN_SOURCE_FILES = [
  "NPC.md",
  "Fazioni.md",
  "Lore.md",
  "Campagna.md",
  "Background Personaggi.md",
  "Manuale del Giocatore.md",
  "La Forgia di Sherdan - Sistema di Crafting.md",
  "Agente AI Worldbuilding.md",
] as const;

const root = process.cwd();
const publicDir = path.join(root, "public");
const privateDir = path.join(root, "content", "sherdan");
const deletePublic = process.argv.includes("--delete-public");
const moveInsteadOfCopy = process.argv.includes("--move");

mkdirSync(privateDir, { recursive: true });

let copied = 0;
let alreadyPrivate = 0;
let missingPublic = 0;
let deleted = 0;
const missing: string[] = [];

for (const file of SHERDAN_SOURCE_FILES) {
  const publicPath = path.join(publicDir, file);
  const privatePath = path.join(privateDir, file);
  const hasPrivate = existsSync(privatePath);
  const hasPublic = existsSync(publicPath);

  if (hasPrivate) {
    alreadyPrivate += 1;
  }

  if (!hasPrivate && hasPublic) {
    if (moveInsteadOfCopy || deletePublic) {
      renameSync(publicPath, privatePath);
      copied += 1;
    } else {
      copyFileSync(publicPath, privatePath);
      copied += 1;
    }
  } else if (!hasPublic && !hasPrivate) {
    missingPublic += 1;
    missing.push(file);
  }

  if (deletePublic && existsSync(publicPath)) {
    rmSync(publicPath, { force: true });
    deleted += 1;
  }
}

console.log("[ok] Migrazione sorgenti Sherdan completata");
console.log(
  JSON.stringify(
    {
      target: "content/sherdan",
      copiedOrMoved: copied,
      alreadyPrivate,
      missingPublic,
      deletedPublicCopies: deleted,
      mode: deletePublic ? "move+delete-public" : moveInsteadOfCopy ? "move" : "copy",
      missing,
    },
    null,
    2,
  ),
);

if (missing.length > 0) {
  console.warn(
    `[warn] Mancano ${missing.length} file sorgente: ${missing.join(", ")}`,
  );
}

if (!deletePublic) {
  console.warn(
    "[warn] Le copie in public/ non sono state eliminate. Dopo verifica esegui: pnpm content:migrate:sherdan:delete-public",
  );
}
