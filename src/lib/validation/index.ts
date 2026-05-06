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

type SchemaByType = typeof propertiesSchemaByType;

/** Tipo delle properties per uno specifico `entity_type`. */
export type PropertiesFor<T extends EntityTypeName> = z.infer<SchemaByType[T]>;

export function getPropertiesSchema<T extends EntityTypeName>(
  type: T,
): SchemaByType[T] {
  return propertiesSchemaByType[type];
}

// Throws ZodError se il payload non valida. Usare a livello API, dopo aver
// determinato il `type` dalla request. Il tipo di ritorno e' narrato dal
// generic in modo che `validateEntityProperties("npc", x).race` typechecki.
export function validateEntityProperties<T extends EntityTypeName>(
  type: T,
  properties: unknown,
): PropertiesFor<T> {
  return propertiesSchemaByType[type].parse(properties) as PropertiesFor<T>;
}

// In Zod 4 il tipo del risultato di safeParse non e' esposto col nome
// `SafeParseReturnType` come in v3. Lo riformuliamo localmente per
// mantenere il narrowing del generic `T`.
export type SafeValidateResult<T extends EntityTypeName> =
  | { success: true; data: PropertiesFor<T> }
  | { success: false; error: z.ZodError };

export function safeValidateEntityProperties<T extends EntityTypeName>(
  type: T,
  properties: unknown,
): SafeValidateResult<T> {
  return propertiesSchemaByType[type].safeParse(
    properties,
  ) as SafeValidateResult<T>;
}
