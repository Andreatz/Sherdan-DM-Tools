import type { z } from "zod";

import { entityType } from "@/db/schema";

import { deityPropertiesSchema } from "./deity";
import { factionPropertiesSchema } from "./faction";
import { itemPropertiesSchema } from "./item";
import { locationPropertiesSchema } from "./location";
import { monsterPropertiesSchema } from "./monster";
import { npcPropertiesSchema } from "./npc";
import { organizationPropertiesSchema } from "./organization";
import { pcPropertiesSchema } from "./pc";

export * from "./_shared";
export * from "./deity";
export * from "./faction";
export * from "./item";
export * from "./location";
export * from "./monster";
export * from "./npc";
export * from "./organization";
export * from "./pc";

// Tipo derivato dalla pgEnum di Drizzle: aggiungere un valore all'enum
// fa rompere il typecheck di `propertiesSchemaByType` finche' non
// aggiungiamo qui lo schema corrispondente. Vincolo intenzionale.
export type EntityTypeName = (typeof entityType.enumValues)[number];

const propertiesSchemaByType = {
  npc: npcPropertiesSchema,
  pc: pcPropertiesSchema,
  location: locationPropertiesSchema,
  faction: factionPropertiesSchema,
  item: itemPropertiesSchema,
  monster: monsterPropertiesSchema,
  deity: deityPropertiesSchema,
  organization: organizationPropertiesSchema,
} as const satisfies Record<EntityTypeName, z.ZodTypeAny>;

export function getPropertiesSchema(type: EntityTypeName) {
  return propertiesSchemaByType[type];
}

// Throws ZodError se il payload non valida. Usare a livello API, dopo aver
// determinato il `type` dalla request.
export function validateEntityProperties(
  type: EntityTypeName,
  properties: unknown,
) {
  return propertiesSchemaByType[type].parse(properties);
}

export function safeValidateEntityProperties(
  type: EntityTypeName,
  properties: unknown,
) {
  return propertiesSchemaByType[type].safeParse(properties);
}
