import type { GeneratorPrompt } from "@/lib/generators";

import {
  ROOM_KIND_PROMPT_LABELS,
  type DungeonContentInput,
  type DungeonRoomContent,
} from "./content-schema";
import type { DungeonMapData } from "./schema";

export interface BuildDungeonContentPromptInput {
  dungeon: DungeonMapData;
  targetedRoomIds: string[];
  existingContent: DungeonRoomContent[];
  styleCalibrationMarkdown: string | null;
}

export function buildDungeonContentPrompt(
  input: BuildDungeonContentPromptInput,
): GeneratorPrompt {
  const { dungeon, targetedRoomIds, existingContent, styleCalibrationMarkdown } = input;
  const targetSet = new Set(targetedRoomIds);

  const userPrompt = [
    "# Procedural Dungeon — Content Generation",
    "",
    "## Tema dungeon",
    dungeon.params.theme,
    "",
    "## Stanze da popolare",
    "Restituisci `description`, `encounterHook`, `trap`, `treasure`, `lore`, `gmNotes` SOLO per le room marcate `[TARGET]`. Lascia invariate le altre.",
    "",
    renderRoomList(dungeon, targetSet),
    "",
    "## Connessioni",
    renderConnections(dungeon),
    "",
  ];

  if (existingContent.length > 0) {
    userPrompt.push(
      "## Contenuto gia' esistente (NON rigenerare, usa solo per coerenza)",
      renderExistingContent(existingContent, targetSet),
      "",
    );
  }

  if (styleCalibrationMarkdown) {
    userPrompt.push("## Style Calibration (campagna)", styleCalibrationMarkdown, "");
  }

  userPrompt.push(
    "## Output Contract",
    "Ritorna ESATTAMENTE un oggetto JSON con la chiave `rooms`, array di oggetti:",
    "{",
    '  "rooms": [',
    "    {",
    '      "roomId": "<id esatto dalla lista target>",',
    '      "title": "string (max 160 char)",',
    '      "description": "markdown breve da leggere ai PG entrando (max ~1200 char). NIENTE meta GM qui.",',
    '      "encounterHook": "string|null - tag-line di cosa potrebbe accadere in combattimento (max 400 char). null se non c\'e\' encounter.",',
    '      "trap": "string|null - trappola: cosa fa, DC suggerito, contromisure (max 400 char). null se non c\'e\'.",',
    '      "treasure": "string|null - tesoro materiale o informativo (max 400 char). null se non c\'e\'.",',
    '      "lore": "string|null - briciola di mondo o storia del sito (max 600 char). null se non emerge nulla.",',
    '      "gmNotes": "string|null - note solo per il DM: leve, rivelazioni stratificate, ganci (max 600 char). null se non serve."',
    "    }",
    "  ]",
    "}",
    "",
    "## Quality Bar",
    "- Tutte le stanze target devono apparire in `rooms`, una sola volta ciascuna.",
    "- `roomId` deve essere uno degli ID target sopra. Non inventare ID.",
    "- `description` e' player-facing: parla in seconda persona plurale o impersonale, descrivi sensorialmente (vista, suono, odore), evita meta-info e statblock.",
    "- `encounterHook` non e' uno statblock: solo tag-line narrativa (es. 'tre fanatici stanno celebrando un rito, distratti'). I mostri veri li scegliera' l'Encounter Builder.",
    "- Coerenza tematica: tutte le stanze devono sembrare parte dello stesso luogo. Tema = lente attiva.",
    "- Coerenza topologica: l'ingresso e' la prima impressione, il boss e' il climax piu' profondo, i tesori sono dead-end che premiano la profondita', i trick sono junction puzzle.",
    "- Niente prosa generica fantasy: ogni dettaglio deve dire qualcosa di specifico del tema.",
    "- Italiano. Markdown leggero ammesso nelle descrizioni.",
  );

  return {
    input: [
      {
        role: "system",
        content: [
          "Sei un dungeon designer per una campagna D&D 5e con tono coerente.",
          "Lavori su un dungeon gia' generato a livello topologico (stanze + corridoi).",
          "Il tuo compito e' SOLO il contenuto narrativo per le stanze indicate: descrizione player-facing, hook combattimento, trappole, tesori, lore, note GM.",
          "Non scegli mostri specifici, non calcoli CR, non disegni mappe.",
          "Output: JSON valido, niente markdown wrapper esterno.",
        ].join("\n"),
      },
      { role: "user", content: userPrompt.join("\n") },
    ],
    options: {
      temperature: 0.6,
      maxTokens: 4000,
      thinking: false,
    },
  };
}

function renderRoomList(dungeon: DungeonMapData, targetSet: Set<string>): string {
  return dungeon.rooms
    .map((room) => {
      const target = targetSet.has(room.id) ? " [TARGET]" : "";
      const kindLabel = ROOM_KIND_PROMPT_LABELS[room.kind];
      return `- ${room.id}${target}: kind=\`${room.kind}\` (${kindLabel}), posizione (${Math.round(room.centerX)},${Math.round(room.centerY)}), dimensione ${room.w}x${room.h}`;
    })
    .join("\n");
}

function renderConnections(dungeon: DungeonMapData): string {
  if (dungeon.edges.length === 0) return "_Nessun corridoio._";
  return dungeon.edges
    .map((edge) => `- ${edge.fromRoomId} <-> ${edge.toRoomId}`)
    .join("\n");
}

function renderExistingContent(
  rooms: DungeonRoomContent[],
  targetSet: Set<string>,
): string {
  const nonTargeted = rooms.filter((room) => !targetSet.has(room.roomId));
  if (nonTargeted.length === 0) return "_Nessuna stanza con contenuto fissato._";
  return nonTargeted
    .map((room) =>
      [
        `### ${room.roomId} — ${room.title}`,
        room.description,
        room.lore ? `- lore: ${room.lore}` : null,
        room.encounterHook ? `- encounter: ${room.encounterHook}` : null,
      ]
        .filter((line): line is string => line !== null)
        .join("\n"),
    )
    .join("\n\n");
}

export function resolveTargetedRoomIds(input: DungeonContentInput): string[] {
  const allIds = input.dungeon.rooms.map((room) => room.id);
  if (!input.targetRoomIds || input.targetRoomIds.length === 0) return allIds;
  const validSet = new Set(allIds);
  const targeted = input.targetRoomIds.filter((id) => validSet.has(id));
  if (targeted.length === 0) return allIds;
  return targeted;
}
