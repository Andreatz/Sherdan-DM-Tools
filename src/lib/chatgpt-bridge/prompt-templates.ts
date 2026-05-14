export type ChatGptBridgeTaskType =
  | "session_md"
  | "session_brief"
  | "session_audit"
  | "session_patch"
  | "dialogue"
  | "txc"
  | "player_recap"
  | "gm_recap"
  | "lore"
  | "npc"
  | "faction"
  | "city"
  | "dungeon";

export type ChatGptBridgeDensity =
  | "Light"
  | "Standard"
  | "Full"
  | "Table-Ready"
  | "Design-Only";

export type ChatGptBridgeAudience = "gm" | "player";

export const densityDescriptions: Record<ChatGptBridgeDensity, string> = {
  Light: "idee rapide, scene secondarie, brainstorming",
  Standard: "sessione normale, PNG importanti, archi medi",
  Full: "finali d'arco, dungeon complessi, eventi politici centrali",
  "Table-Ready": "materiale pronto da usare al tavolo",
  "Design-Only": "progettazione per il Master, non testo player-facing",
};

export function commandForTask(
  taskType: ChatGptBridgeTaskType,
  sessionNumber?: number,
  focus?: string,
): string {
  const n = sessionNumber ? String(sessionNumber) : "[numero]";
  const f = focus?.trim() || "";
  const target = f || "[argomento]";
  switch (taskType) {
    case "session_md":
      return `/sessione --md ${n}`;
    case "session_brief":
      return `/sessione ${n}`;
    case "session_audit":
      return "/sessione --audit [file/testo]";
    case "session_patch":
      return `/sessione --patch ${f || "[scena/problema]"}`;
    case "dialogue":
      return `/dialogo [PNG] ${f || "[situazione]"}`;
    case "txc":
      return `/txc ${f || "[scena]"}`;
    case "player_recap":
      return "/recap giocatori";
    case "gm_recap":
      return "/recap gm";
    case "lore":
      return `/lore ${target}`;
    case "npc":
      return `/npc ${f || "[nome/ruolo]"}`;
    case "faction":
      return `/fazione ${f || "[nome]"}`;
    case "city":
      return `/citta ${f || "[nome]"}`;
    case "dungeon":
      return `/dungeon ${f || "[tema]"}`;
  }
}

export const architectPromptSummary = [
  "Architetto di Mondi: usa la canonica della campagna come fonte primaria.",
  "Mantieni separati fatti canonici, inferenze e proposte.",
  "Marca ogni contenuto inventato come `Lore non definita`.",
  "Non decidere azioni, pensieri o emozioni dei PG.",
  "Non rendere PNG onniscienti e rispetta segreti, timing dei reveal e player-facing safety.",
].join("\n");

export const architectPromptFull = [
  "# Architetto di Mondi",
  "",
  "Agisci come assistente di worldbuilding e session design per una campagna D&D.",
  "Gerarchia delle fonti: database canonico Sherdan-DM-Tools, prompt del Master, poi proposta creativa.",
  "Quando mancano dati, proponi opzioni e marca esplicitamente `Lore non definita`.",
  "Proteggi segreti GM, identita vere non scoperte, verita non rivelate e twist futuri.",
  "Non scrivere azioni, pensieri o emozioni dei PG. Puoi proporre pressioni, scelte e conseguenze.",
  "Non rendere PNG onniscienti: ogni PNG conosce solo cio che ha senso sapere.",
  "Produci output in italiano, con markdown leggibile e pronto da usare.",
].join("\n");

