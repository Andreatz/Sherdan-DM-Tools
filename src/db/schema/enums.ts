import { pgEnum } from "drizzle-orm/pg-core";

// Visibilita' applicabile a entita', link, identita', plot threads.
// Indipendente dai segreti stratificati: un'entita' puo' essere
// 'discovered' dal party ma avere segreti 'deep' ancora non rivelati.
export const visibility = pgEnum("visibility", [
  "dm_only",
  "discovered",
  "public",
]);

// Tipi di entita' supportati. Aggiunte future via migration additiva.
export const entityType = pgEnum("entity_type", [
  "npc",
  "pc",
  "location",
  "faction",
  "item",
  "monster",
  "deity",
  "organization",
]);

// Stratificazione segreti, pattern Sherdan #2.
export const secretLayer = pgEnum("secret_layer", [
  "surface",
  "intermediate",
  "deep",
]);

// Ciclo di vita di una briciola di verita' rispetto al party.
export const clueStatus = pgEnum("clue_status", [
  "planted",
  "noticed",
  "misinterpreted",
  "understood",
  "lost",
]);

// Stato di un plot thread, usato per la kanban "hot/warm/cold/...".
export const plotThreadStatus = pgEnum("plot_thread_status", [
  "hot",
  "warm",
  "cold",
  "resolved",
  "abandoned",
]);

// Ruolo di una entity dentro un plot thread.
export const plotRole = pgEnum("plot_role", [
  "instigator",
  "victim",
  "target",
  "mcguffin",
  "witness",
]);

// Difficolta' di un encounter (classificazione DMG).
export const encounterDifficulty = pgEnum("encounter_difficulty", [
  "easy",
  "medium",
  "hard",
  "deadly",
]);
