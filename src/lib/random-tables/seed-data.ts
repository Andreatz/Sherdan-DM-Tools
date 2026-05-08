import { parseRandomTableEntries, type RandomTableEntry } from "./roller";

export type RandomTableSeedScope = "global" | "sherdan";

export interface RandomTableSeedEntry {
  label?: string;
  value?: unknown;
  weight?: number;
  subTableKey?: string;
  templateVarKeys?: Record<string, string>;
}

export interface RandomTableSeedDefinition {
  key: string;
  scope: RandomTableSeedScope;
  name: string;
  description: string;
  tags: string[];
  entries: RandomTableSeedEntry[];
}

export const randomTableSeedDefinitions: RandomTableSeedDefinition[] = [
  {
    key: "public-human-names",
    scope: "global",
    name: "Public - Human Names",
    description: "Nomi fantasy generici per umani.",
    tags: ["seed", "public-domain", "names", "human"],
    entries: values([
      "Aldo",
      "Brenna",
      "Cedric",
      "Daria",
      "Elian",
      "Fiora",
      "Garran",
      "Livia",
      "Milo",
      "Nera",
      "Osric",
      "Seren",
    ]),
  },
  {
    key: "public-elven-names",
    scope: "global",
    name: "Public - Elven Names",
    description: "Nomi fantasy generici per elfi.",
    tags: ["seed", "public-domain", "names", "elf"],
    entries: values([
      "Aelar",
      "Calen",
      "Elyra",
      "Faelar",
      "Ilyana",
      "Laerith",
      "Nimriel",
      "Saelihn",
      "Thalan",
      "Vaelis",
    ]),
  },
  {
    key: "public-dwarven-names",
    scope: "global",
    name: "Public - Dwarven Names",
    description: "Nomi fantasy generici per nani.",
    tags: ["seed", "public-domain", "names", "dwarf"],
    entries: values([
      "Borin",
      "Dagna",
      "Fargrim",
      "Gilda",
      "Hrolf",
      "Kara",
      "Murn",
      "Orsik",
      "Ragna",
      "Torunn",
    ]),
  },
  {
    key: "public-halfling-names",
    scope: "global",
    name: "Public - Halfling Names",
    description: "Nomi fantasy generici per halfling.",
    tags: ["seed", "public-domain", "names", "halfling"],
    entries: values([
      "Benny",
      "Cora",
      "Dodd",
      "Ella",
      "Finn",
      "Lina",
      "Merric",
      "Nella",
      "Pippo",
      "Rosie",
    ]),
  },
  {
    key: "public-attitudes",
    scope: "global",
    name: "Public - NPC Attitudes",
    description: "Atteggiamenti rapidi per incontri sociali.",
    tags: ["seed", "public-domain", "npc", "attitude"],
    entries: weighted([
      ["curioso ma prudente", 2],
      ["apertamente ostile", 1],
      ["stanco e poco collaborativo", 2],
      ["cordiale per convenienza", 2],
      ["spaventato da qualcosa che non dice", 1],
      ["troppo disponibile", 1],
      ["ironico e disincantato", 1],
      ["devoto a un superiore assente", 1],
    ]),
  },
  {
    key: "public-tavern-adjectives",
    scope: "global",
    name: "Public - Tavern Adjectives",
    description: "Aggettivi per nomi di taverne.",
    tags: ["seed", "public-domain", "tavern"],
    entries: values([
      "Drago",
      "Gallo",
      "Mastino",
      "Viandante",
      "Martello",
      "Calice",
      "Ponte",
      "Cigno",
      "Sperone",
      "Lanterna",
    ]),
  },
  {
    key: "public-tavern-nouns",
    scope: "global",
    name: "Public - Tavern Nouns",
    description: "Sostantivi per nomi di taverne.",
    tags: ["seed", "public-domain", "tavern"],
    entries: values([
      "Dorato",
      "Rotto",
      "Stanco",
      "Rosso",
      "Nero",
      "Cantante",
      "Sommerso",
      "Fortunato",
      "Ubriaco",
      "Silenzioso",
    ]),
  },
  {
    key: "public-tavern-names",
    scope: "global",
    name: "Public - Tavern Names",
    description: "Nomi di taverne generati via template.",
    tags: ["seed", "public-domain", "tavern", "template"],
    entries: [
      {
        value: "Il {adjective} {noun}",
        templateVarKeys: {
          adjective: "public-tavern-adjectives",
          noun: "public-tavern-nouns",
        },
      },
      {
        value: "La Locanda del {adjective} {noun}",
        templateVarKeys: {
          adjective: "public-tavern-adjectives",
          noun: "public-tavern-nouns",
        },
      },
    ],
  },
  {
    key: "public-travel-events",
    scope: "global",
    name: "Public - Travel Events",
    description: "Eventi public-domain per viaggio fantasy.",
    tags: ["seed", "public-domain", "travel"],
    entries: values([
      "Una ruota si spezza sul tratto peggiore della strada.",
      "Un ponte e' stato chiuso da una pattuglia nervosa.",
      "Una carovana chiede scorta fino al prossimo bivio.",
      "Una tempesta costringe il gruppo a cercare riparo.",
      "Un mendicante offre una mappa in cambio di cibo.",
      "Tracce fresche tagliano la strada e spariscono nel bosco.",
      "Un mercante riconosce un simbolo portato dal party.",
      "Un animale da soma fugge con un carico importante.",
    ]),
  },
  {
    key: "public-urban-complications",
    scope: "global",
    name: "Public - Urban Complications",
    description: "Complicazioni urbane generiche.",
    tags: ["seed", "public-domain", "urban"],
    entries: values([
      "Una rissa blocca l'ingresso alla piazza.",
      "La guardia cerca un colpevole rapido, non quello giusto.",
      "Un borseggiatore prende l'oggetto sbagliato.",
      "Un testimone cambia versione appena vede il party.",
      "Un decreto improvviso chiude il quartiere.",
      "Una festa religiosa rende impossibile passare inosservati.",
      "Una gilda pretende un pedaggio informale.",
      "Una bottega esplode per un esperimento mal riuscito.",
    ]),
  },
  {
    key: "public-weather",
    scope: "global",
    name: "Public - Weather",
    description: "Meteo rapido per scena o viaggio.",
    tags: ["seed", "public-domain", "travel", "weather"],
    entries: weighted([
      ["cielo limpido e vento leggero", 2],
      ["pioggia sottile e persistente", 2],
      ["nebbia bassa", 1],
      ["afa immobile", 1],
      ["temporale improvviso", 1],
      ["freddo secco", 1],
      ["vento forte da nord", 1],
      ["aria carica di polvere", 1],
    ]),
  },
  {
    key: "public-race-names",
    scope: "global",
    name: "Public - Race Name Picker",
    description: "Sceglie una tabella nomi tramite sub-roll.",
    tags: ["seed", "public-domain", "names", "nested"],
    entries: [
      { label: "human", subTableKey: "public-human-names", weight: 4 },
      { label: "elf", subTableKey: "public-elven-names", weight: 2 },
      { label: "dwarf", subTableKey: "public-dwarven-names", weight: 2 },
      { label: "halfling", subTableKey: "public-halfling-names", weight: 1 },
    ],
  },
  {
    key: "sherdan-npc-tics",
    scope: "sherdan",
    name: "Sherdan - NPC Tics",
    description: "Tic e abitudini coerenti con il tono dei PNG Sherdan.",
    tags: ["seed", "sherdan", "npc", "tics"],
    entries: values([
      "conta le uscite della stanza prima di sedersi",
      "tocca un vecchio ingranaggio quando mente",
      "sorride solo quando la conversazione diventa pericolosa",
      "ripete l'ultima parola dell'interlocutore a voce bassa",
      "pulisce guanti gia' immacolati",
      "evita di nominare gli dei in modo diretto",
      "segna piccoli appunti in un codice personale",
      "fissa le ombre come se rispondessero",
    ]),
  },
  {
    key: "sherdan-sensory-sight",
    scope: "sherdan",
    name: "Sherdan - Sensory Sight",
    description: "Dettagli visivi per scene e PNG Sherdan.",
    tags: ["seed", "sherdan", "sensory", "sight"],
    entries: values([
      "riflessi azzurri di Obsidium sotto la pelle",
      "cicatrici sottili come mappe nautiche",
      "abiti troppo puliti per il quartiere",
      "occhi che non seguono mai la fonte della voce",
      "mani da artigiano con unghie rovinate dal metallo",
      "cenere scura accumulata sulle cuciture",
      "un simbolo cancellato male dal bavero",
      "piccoli frammenti di vetro cuciti nella cintura",
    ]),
  },
  {
    key: "sherdan-sensory-smell",
    scope: "sherdan",
    name: "Sherdan - Sensory Smell",
    description: "Odori per scene e PNG Sherdan.",
    tags: ["seed", "sherdan", "sensory", "smell"],
    entries: values([
      "ozono e metallo caldo",
      "sale, catrame e vino economico",
      "incenso freddo su stoffa bagnata",
      "olio industriale coperto da profumo floreale",
      "terra umida e linfa malata",
      "ferro, cenere e pelle bruciata",
      "carta antica conservata troppo bene",
      "muschio dolciastro e fumo spento",
    ]),
  },
  {
    key: "sherdan-sensory-sound",
    scope: "sherdan",
    name: "Sherdan - Sensory Sound",
    description: "Suoni per scene e PNG Sherdan.",
    tags: ["seed", "sherdan", "sensory", "sound"],
    entries: values([
      "un ronzio quasi musicale sotto il pavimento",
      "catene lontane mosse dal vento",
      "un motore che perde un battito ogni sette colpi",
      "preghiere sussurrate dietro una porta chiusa",
      "gabbiani e ferraglia al porto",
      "passi sincronizzati di una pattuglia",
      "legno vivo che scricchiola come se respirasse",
      "vetro che vibra senza rompersi",
    ]),
  },
  {
    key: "sherdan-accents",
    scope: "sherdan",
    name: "Sherdan - Regional Accents",
    description: "Inflessioni e parlato regionale per PNG Sherdan.",
    tags: ["seed", "sherdan", "npc", "voice"],
    entries: values([
      "tharrosiano preciso, pieno di termini tecnici",
      "portuale ruvido, con frasi tagliate",
      "arboreano lento, quasi cerimoniale",
      "nobile urbano, troppo controllato",
      "minatore di Mineralia, secco e superstizioso",
      "pirata della costa, musicale e provocatorio",
      "accademico della Loggia, didattico anche sotto minaccia",
      "forestiero che evita ogni proverbio locale",
    ]),
  },
  {
    key: "sherdan-surface-secrets",
    scope: "sherdan",
    name: "Sherdan - Surface Secrets",
    description: "Segreti superficiali pronti da innestare su PNG o luoghi.",
    tags: ["seed", "sherdan", "secrets", "surface"],
    entries: values([
      "ha un debito con una persona che finge di odiare",
      "sta nascondendo merci di Obsidium non dichiarate",
      "ha venduto un'informazione alla Loggia",
      "ha visto Dante in un posto dove non poteva essere",
      "conosce una via secondaria verso un magazzino chiuso",
      "protegge un parente dentro una fazione nemica",
      "usa un nome falso da anni",
      "sa che una pattuglia verra' spostata stanotte",
    ]),
  },
  {
    key: "sherdan-hooks",
    scope: "sherdan",
    name: "Sherdan - Narrative Hooks",
    description: "Agganci narrativi base nel tono della campagna.",
    tags: ["seed", "sherdan", "hooks"],
    entries: values([
      "una promessa fatta a un morto torna a chiedere pagamento",
      "un documento ufficiale contiene una verita' per sbaglio",
      "un alleato chiede di non fare la cosa giusta",
      "una vittima conosce un dettaglio che dovrebbe essere impossibile",
      "un simbolo dei sei appare dove tutti giurano non sia mai stato",
      "un sabotaggio sembra crudele finche' non si scopre cosa impediva",
      "un vecchio nemico offre una prova autentica contro un nemico peggiore",
      "una scelta salva una comunita' e condanna una persona specifica",
    ]),
  },
  {
    key: "sherdan-obsidium-omens",
    scope: "sherdan",
    name: "Sherdan - Obsidium Omens",
    description: "Presagi e anomalie legate all'Obsidium.",
    tags: ["seed", "sherdan", "obsidium", "omens"],
    entries: values([
      "una scheggia pulsa in risposta a una bugia",
      "la luce azzurra si spegne quando viene pronunciato un nome",
      "un motore riparte senza combustibile per sette secondi",
      "il metallo si scalda vicino a una reliquia antica",
      "una moneta nera lascia polvere sulle dita",
      "l'ombra di un oggetto punta nella direzione sbagliata",
      "un cristallo ripete una voce sentita anni fa",
      "la polvere di miniera forma un cerchio perfetto",
    ]),
  },
  {
    key: "sherdan-faction-pressure",
    scope: "sherdan",
    name: "Sherdan - Faction Pressure",
    description: "Pressioni di fazione da inserire in una scena.",
    tags: ["seed", "sherdan", "factions"],
    entries: values([
      "la Synapse compra silenzio con efficienza burocratica",
      "la Loggia chiede prove, non fiducia",
      "l'Eclissi usa una verita' reale per vendere una scelta terribile",
      "i Conservatori proteggono Arborea sacrificando qualcuno fuori dalle mura",
      "la marina di Tharros vuole chiudere la faccenda prima che diventi politica",
      "una cellula locale non sa di essere manipolata da una regia piu' alta",
      "un mercante neutrale sa troppo per restare neutrale",
      "un culto minore interpreta male un segno autentico",
    ]),
  },
  {
    key: "sherdan-tharros-tech-flaws",
    scope: "sherdan",
    name: "Sherdan - Tharros Tech Flaws",
    description: "Difetti, incidenti e compromessi tecnici tharrosiani.",
    tags: ["seed", "sherdan", "tharros", "technology"],
    entries: values([
      "la valvola scarica vapori nel vicolo invece che nel filtro",
      "il brevetto originale segnala un rischio cancellato dalle copie pubbliche",
      "un componente funziona solo perche' qualcuno lo riallinea ogni notte",
      "la protezione automatica e' stata disattivata per aumentare la produzione",
      "la lega metallica contiene Obsidium riciclato e instabile",
      "un contatore e' truccato per nascondere consumi anomali",
      "il manuale tecnico cita un modello che non dovrebbe esistere",
      "una riparazione improvvisata ha creato un punto debole evidente",
    ]),
  },
  {
    key: "sherdan-arborea-tensions",
    scope: "sherdan",
    name: "Sherdan - Arborea Tensions",
    description: "Tensioni sociali e politiche legate ad Arborea.",
    tags: ["seed", "sherdan", "arborea", "politics"],
    entries: values([
      "un conservatore accusa un esule di aver portato la corruzione",
      "un mercante nega traffici che tutti al porto conoscono",
      "una radice malata viene nascosta sotto fiori appena piantati",
      "una famiglia finge di non riconoscere un parente bandito",
      "una guardia sceglie la quiete pubblica al posto della verita'",
      "un custode anziano parla di visioni con troppa precisione",
      "un giovane vuole lasciare la citta' ma teme di tradire i propri morti",
      "un simbolo inciso nella corteccia viene raschiato via all'alba",
    ]),
  },
  {
    key: "sherdan-travel-complications",
    scope: "sherdan",
    name: "Sherdan - Travel Complications",
    description: "Complicazioni di viaggio calibrate su Sherdan.",
    tags: ["seed", "sherdan", "travel"],
    entries: values([
      "una nave da Tharros cambia bandiera prima di entrare in porto",
      "un posto di blocco cerca una persona con il nome sbagliato",
      "una zona di bosco e' silenziosa perche' gli animali sono fuggiti",
      "un carretto trasporta pezzi di macchina avvolti in coperte sacre",
      "un messaggero muore prima di consegnare la seconda meta' del messaggio",
      "un faro costiero lampeggia con un codice militare",
      "un profugo riconosce un dettaglio sul corpo di un PG",
      "una strada e' stata deviata per evitare una miniera mai dichiarata",
    ]),
  },
  {
    key: "sherdan-npc-sparks",
    scope: "sherdan",
    name: "Sherdan - NPC Spark",
    description: "Prompt rapido per PNG Sherdan con tic, voce e segreto.",
    tags: ["seed", "sherdan", "npc", "template"],
    entries: [
      {
        value: "{name}; parla con accento {accent}; {tic}; segreto: {secret}",
        templateVarKeys: {
          name: "public-race-names",
          accent: "sherdan-accents",
          tic: "sherdan-npc-tics",
          secret: "sherdan-surface-secrets",
        },
      },
    ],
  },
  {
    key: "sherdan-scene-sparks",
    scope: "sherdan",
    name: "Sherdan - Scene Spark",
    description: "Prompt rapido per scene Sherdan multi-sensoriali.",
    tags: ["seed", "sherdan", "scene", "template"],
    entries: [
      {
        value: "{sight}. Odore: {smell}. Suono: {sound}. Pressione: {pressure}",
        templateVarKeys: {
          sight: "sherdan-sensory-sight",
          smell: "sherdan-sensory-smell",
          sound: "sherdan-sensory-sound",
          pressure: "sherdan-faction-pressure",
        },
      },
    ],
  },
];

export function materializeRandomTableSeedEntries(
  definition: RandomTableSeedDefinition,
  idByKey: Map<string, string>,
): RandomTableEntry[] {
  const rawEntries = definition.entries.map((entry) => {
    const raw: Record<string, unknown> = {};
    if (entry.label !== undefined) raw.label = entry.label;
    if (entry.value !== undefined) raw.value = entry.value;
    if (entry.weight !== undefined) raw.weight = entry.weight;
    if (entry.subTableKey) raw.subTableId = resolveSeedKey(entry.subTableKey, idByKey);
    if (entry.templateVarKeys) {
      raw.templateVars = Object.fromEntries(
        Object.entries(entry.templateVarKeys).map(([name, key]) => [
          name,
          resolveSeedKey(key, idByKey),
        ]),
      );
    }
    return raw;
  });

  return parseRandomTableEntries(rawEntries);
}

function values(items: string[]): RandomTableSeedEntry[] {
  return items.map((value) => ({ value }));
}

function weighted(items: Array<[value: string, weight: number]>): RandomTableSeedEntry[] {
  return items.map(([value, weight]) => ({ value, weight }));
}

function resolveSeedKey(key: string, idByKey: Map<string, string>): string {
  const id = idByKey.get(key);
  if (!id) {
    throw new Error(`Random table seed key not found: ${key}`);
  }
  return id;
}
