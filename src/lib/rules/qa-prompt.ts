import type { GeneratorPrompt } from "@/lib/generators";

import type { RuleSearchHit } from "./search";

// Costruisce il prompt Q&A. I chunk arrivano gia' ordinati per rrfScore
// desc. Li indicizziamo 1..N e diciamo al modello di citare con `[N]`.
export function buildRulesQaPrompt(args: {
  query: string;
  chunks: RuleSearchHit[];
}): GeneratorPrompt {
  const { query, chunks } = args;
  const userPrompt = [
    "# Domanda regole",
    "",
    query,
    "",
    "# Contesto disponibile",
    chunks.length > 0
      ? chunks
          .map((chunk, idx) => renderChunk(chunk, idx + 1))
          .join("\n\n---\n\n")
      : "_Nessun chunk rilevante trovato nel corpus._",
    "",
    "# Output Contract",
    "Ritorna JSON valido con la forma:",
    "{",
    '  "answer": "string markdown — la risposta. Usa riferimenti come [1], [2] per citare i chunk.",',
    '  "citations": [',
    "    {",
    '      "index": 1,                     // l\'indice che appare in answer come [1]',
    '      "chunkId": "<id esatto dal contesto>",',
    '      "snippet": "estratto pertinente, max 280 char, citato testualmente dal chunk"',
    "    }",
    "  ],",
    '  "noAnswer": false',
    "}",
    "",
    "# Quality Bar",
    "- Rispondi SOLO usando il contesto fornito. Niente conoscenza esterna.",
    "- Cita ogni affermazione di regola con `[N]` indicando il chunk usato; il numero deve corrispondere a una entry in `citations` con lo stesso `index` e il `chunkId` esatto.",
    "- `snippet` deve essere un estratto pertinente del chunk N, non parafrasato. Max 280 char.",
    "- Se il corpus non contiene la risposta: imposta `noAnswer: true`, `answer` spiega che la regola non e' nel corpus indicizzato, `citations: []`.",
    "- Italiano (corpus e' italiano). Markdown leggero ammesso nella risposta.",
  ].join("\n");

  return {
    input: [
      {
        role: "system",
        content: [
          "Sei un assistente che risponde a domande sulle regole homebrew della campagna Sherdan.",
          "Il tuo compito: rispondere SOLO con cio' che e' presente nei chunk forniti come contesto, citando esplicitamente da quale chunk arriva ogni regola.",
          "Niente invenzioni: se la regola non e' nel contesto, dichiaralo invece di inventare.",
          "Output: JSON valido, niente markdown wrapper esterno.",
        ].join("\n"),
      },
      { role: "user", content: userPrompt },
    ],
    options: {
      temperature: 0.2,
      maxTokens: 2200,
      thinking: false,
    },
  };
}

function renderChunk(chunk: RuleSearchHit, displayIndex: number): string {
  const headerParts = [
    `### [${displayIndex}] chunk ${chunk.id}`,
    `- source: \`${chunk.source}\``,
    chunk.title ? `- title: ${chunk.title}` : null,
    chunk.section ? `- section: ${chunk.section}` : null,
  ].filter((line): line is string => line !== null);

  return [
    ...headerParts,
    "",
    chunk.content,
  ].join("\n");
}
