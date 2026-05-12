"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

type Visibility = "dm_only" | "discovered" | "public";

interface EntityName {
  id: string;
  type: EntityType;
  name: string;
  publicDescription: string | null;
}

interface EntityLinkRow {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  relationType: string;
  publicRelationType: string | null;
  strength: number | null;
  description: string | null;
  visibility: Visibility;
}

interface EntityLinkEditorProps {
  campaignId: string;
  currentEntityId: string;
  links: EntityLinkRow[];
  entities: EntityName[];
}

const TYPE_LABELS: Record<EntityType, string> = {
  npc: "NPC",
  pc: "PG",
  location: "Luogo",
  faction: "Fazione",
  item: "Oggetto",
  monster: "Mostro",
  deity: "Divinita'",
  organization: "Organizzazione",
};

const VISIBILITY_LABELS: Record<Visibility, string> = {
  dm_only: "DM",
  discovered: "Scoperta",
  public: "Pubblica",
};

const VISIBILITY_CLASSES: Record<Visibility, string> = {
  dm_only:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  discovered:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  public:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const RELATION_OPTIONS = [
  { value: "ally", label: "Alleato" },
  { value: "enemy", label: "Nemico" },
  { value: "knows", label: "Conosce" },
  { value: "mentor_of", label: "Mentore di" },
  { value: "student_of", label: "Allievo di" },
  { value: "lieutenant_of", label: "Luogotenente di" },
  { value: "member_of", label: "Membro di" },
  { value: "serves", label: "Serve" },
  { value: "betrayed_by", label: "Tradito da" },
  { value: "rival_of", label: "Rivale di" },
  { value: "family_of", label: "Famiglia di" },
  { value: "controls", label: "Controlla" },
  { value: "hides_from", label: "Si nasconde da" },
  { value: "seeks", label: "Cerca" },
] as const;

function relationLabel(value: string): string {
  return RELATION_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

function isKnownRelation(value: string): boolean {
  return RELATION_OPTIONS.some((option) => option.value === value);
}

function entityHref(campaignId: string, entityId: string) {
  return `/campaigns/${campaignId}?focus=${entityId}&detail_tab=links#entity-detail`;
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as {
      error?: { message?: string };
    };
    return body.error?.message ?? `Richiesta fallita (${response.status})`;
  } catch {
    return `Richiesta fallita (${response.status})`;
  }
}

export function EntityLinkEditor({
  campaignId,
  currentEntityId,
  links,
  entities,
}: EntityLinkEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [targetQuery, setTargetQuery] = useState("");
  const [targetEntityId, setTargetEntityId] = useState("");
  const [relationType, setRelationType] = useState<string>(
    RELATION_OPTIONS[0].value,
  );
  const [publicRelationType, setPublicRelationType] = useState("");
  const [strength, setStrength] = useState(5);
  const [visibility, setVisibility] = useState<Visibility>("dm_only");
  const [description, setDescription] = useState("");

  const targetOptions = useMemo(() => {
    const query = targetQuery.trim().toLocaleLowerCase("it-IT");
    return entities
      .filter((entity) => entity.id !== currentEntityId)
      .filter((entity) => {
        if (!query) return true;
        return (
          entity.name.toLocaleLowerCase("it-IT").includes(query) ||
          TYPE_LABELS[entity.type].toLocaleLowerCase("it-IT").includes(query)
        );
      })
      .slice(0, 40);
  }, [currentEntityId, entities, targetQuery]);

  async function createLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!targetEntityId) {
      setError("Scegli una entity target prima di creare il link.");
      return;
    }

    const response = await fetch("/api/entity-links", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        sourceEntityId: currentEntityId,
        targetEntityId,
        relationType,
        publicRelationType: normalizeOptional(publicRelationType),
        strength,
        description: normalizeOptional(description),
        visibility,
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    setTargetEntityId("");
    setTargetQuery("");
    setRelationType(RELATION_OPTIONS[0].value);
    setPublicRelationType("");
    setStrength(5);
    setVisibility("dm_only");
    setDescription("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={createLink}
        className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Cerca target
            </span>
            <input
              value={targetQuery}
              onChange={(event) => setTargetQuery(event.target.value)}
              placeholder="Nome o tipo entity"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Target
            </span>
            <select
              value={targetEntityId}
              onChange={(event) => setTargetEntityId(event.target.value)}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
            >
              <option value="">Seleziona entity</option>
              {targetOptions.map((entity) => (
                <option key={entity.id} value={entity.id}>
                  {entity.name} - {TYPE_LABELS[entity.type]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
          <RelationSelect
            label="Relazione vera"
            value={relationType}
            onChange={setRelationType}
          />
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Relazione pubblica
            </span>
            <input
              value={publicRelationType}
              onChange={(event) => setPublicRelationType(event.target.value)}
              placeholder="Opzionale"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Visibilita&apos;
            </span>
            <VisibilitySelect value={visibility} onChange={setVisibility} />
          </label>
        </div>

        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Strength: {strength}/10
            </span>
            <input
              type="range"
              min="0"
              max="10"
              step="1"
              value={strength}
              onChange={(event) => setStrength(Number(event.target.value))}
              className="h-10 w-full accent-zinc-900 dark:accent-zinc-100"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Note
            </span>
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Dettagli DM sulla relazione"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 self-end rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            Crea link
          </button>
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>

      {links.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Nessun link in uscita.
        </div>
      ) : (
        <div className="grid gap-3">
          {links.map((link) => (
            <EditableLinkCard
              key={link.id}
              campaignId={campaignId}
              link={link}
              target={entities.find((entity) => entity.id === link.targetEntityId)}
              onChanged={() => startTransition(() => router.refresh())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EditableLinkCard({
  campaignId,
  link,
  target,
  onChanged,
}: {
  campaignId: string;
  link: EntityLinkRow;
  target: EntityName | undefined;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [relationType, setRelationType] = useState(link.relationType);
  const [publicRelationType, setPublicRelationType] = useState(
    link.publicRelationType ?? "",
  );
  const [strength, setStrength] = useState(link.strength ?? 5);
  const [visibility, setVisibility] = useState<Visibility>(link.visibility);
  const [description, setDescription] = useState(link.description ?? "");

  async function updateLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/entity-links/${link.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        relationType,
        publicRelationType: normalizeOptional(publicRelationType),
        strength,
        description: normalizeOptional(description),
        visibility,
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  async function deleteLink() {
    setError(null);
    const response = await fetch(`/api/entity-links/${link.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  return (
    <form
      onSubmit={updateLink}
      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={entityHref(campaignId, target?.id ?? link.targetEntityId)}
              className="font-medium text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
            >
              {target?.name ?? link.targetEntityId}
            </Link>
            {target && (
              <span className="rounded-md bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                {TYPE_LABELS[target.type]}
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[visibility]}`}
            >
              {VISIBILITY_LABELS[visibility]}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {relationLabel(relationType)} · strength {strength}/10
          </p>
        </div>
        <button
          type="button"
          onClick={() => void deleteLink()}
          disabled={isPending}
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
        >
          Elimina
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_160px]">
        <RelationSelect
          label="Relazione vera"
          value={relationType}
          onChange={setRelationType}
        />
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Relazione pubblica
          </span>
          <input
            value={publicRelationType}
            onChange={(event) => setPublicRelationType(event.target.value)}
            placeholder="Opzionale"
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Visibilita&apos;
          </span>
          <VisibilitySelect value={visibility} onChange={setVisibility} />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Strength: {strength}/10
          </span>
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            value={strength}
            onChange={(event) => setStrength(Number(event.target.value))}
            className="h-10 w-full accent-zinc-900 dark:accent-zinc-100"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Note
          </span>
          <input
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Dettagli DM sulla relazione"
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 self-end rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Salva
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </form>
  );
}

function RelationSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <select
        value={isKnownRelation(value) ? value : "custom"}
        onChange={(event) => {
          const nextValue = event.target.value;
          onChange(nextValue === "custom" ? value : nextValue);
        }}
        className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
      >
        {RELATION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {!isKnownRelation(value) && <option value="custom">{value}</option>}
      </select>
    </label>
  );
}

function VisibilitySelect({
  value,
  onChange,
}: {
  value: Visibility;
  onChange: (value: Visibility) => void;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as Visibility)}
      className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
    >
      <option value="dm_only">DM only</option>
      <option value="discovered">Scoperta</option>
      <option value="public">Pubblica</option>
    </select>
  );
}
