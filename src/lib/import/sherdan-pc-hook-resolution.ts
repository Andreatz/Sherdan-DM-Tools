import {
  normalizedLabel,
  type BootstrapEntity,
  type SherdanBootstrapPlan,
} from "@/lib/import/sherdan-bootstrap-plan";

const GROUP_HOOK_LABELS = new Set([
  "gruppo",
  "party",
  "tutti",
  "tutti i pg",
  "tutto il party",
]);

export function resolvePcHookEntityKeys(
  entities: BootstrapEntity[],
  pcName: string,
): string[] {
  const pcEntities = entities.filter((entity) => entity.type === "pc");
  const aliasMap = buildPcAliasMap(pcEntities);
  const normalized = normalizedLabel(pcName);

  if (GROUP_HOOK_LABELS.has(normalized)) {
    return pcEntities.map((entity) => entity.key);
  }

  return unique(
    splitPcHookLabels(pcName)
      .flatMap((label) => aliasMap.get(normalizedLabel(label)) ?? [])
      .filter(Boolean),
  );
}

export function countResolvedPcHookAssignments(plan: SherdanBootstrapPlan): number {
  const entityKeys = new Set(plan.entities.map((entity) => entity.key));
  return plan.pcHooks.reduce((sum, hook) => {
    if (!entityKeys.has(hook.targetEntityKey)) return sum;
    return sum + resolvePcHookEntityKeys(plan.entities, hook.pcName).length;
  }, 0);
}

function buildPcAliasMap(pcEntities: BootstrapEntity[]): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const entity of pcEntities) {
    for (const label of pcLabelsFor(entity)) {
      addAlias(map, label, entity.key);
    }
  }

  const azazel = map.get("azazel")?.[0];
  if (azazel) addAlias(map, "Erevan", azazel);

  return map;
}

function pcLabelsFor(entity: BootstrapEntity): string[] {
  const labels = new Set([entity.name, ...entity.aliases]);
  for (const label of Array.from(labels)) {
    const firstToken = label.trim().split(/\s+/)[0];
    if (firstToken) labels.add(firstToken);
  }
  return Array.from(labels);
}

function splitPcHookLabels(label: string): string[] {
  return label
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean);
}

function addAlias(map: Map<string, string[]>, label: string, key: string) {
  const normalized = normalizedLabel(label);
  map.set(normalized, unique([...(map.get(normalized) ?? []), key]));
}

function unique<T>(items: T[]): T[] {
  return Array.from(new Set(items));
}
