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

type HookStatus = "available" | "in_progress" | "resolved";

interface EntityName {
  id: string;
  type: EntityType;
  name: string;
  publicDescription: string | null;
}

interface PcHookRow {
  id: string;
  pcEntityId: string;
  targetEntityId: string;
  hookDescription: string;
  potentialArc: string | null;
  usedInSession: string | null;
  status: string;
}

interface SessionOption {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface PcHookMatrixProps {
  campaignId: string;
  hooks: PcHookRow[];
  entities: EntityName[];
  sessions: SessionOption[];
  selectedEntityId?: string;
}

const STATUS_LABELS: Record<HookStatus, string> = {
  available: "Disponibile",
  in_progress: "In corso",
  resolved: "Risolto",
};

const STATUS_CLASSES: Record<HookStatus, string> = {
  available:
    "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
  in_progress:
    "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  resolved:
    "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
};

const STATUS_OPTIONS: HookStatus[] = ["available", "in_progress", "resolved"];

function entityHref(campaignId: string, entityId: string) {
  return `/campaigns/${campaignId}?focus=${entityId}&detail_tab=pc-hooks#entity-detail`;
}

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSessionId(value: string): string | null {
  return value.length > 0 ? value : null;
}

function sessionLabel(session: SessionOption): string {
  const title = session.title ? ` - ${session.title}` : "";
  const date = session.date ? ` (${session.date})` : "";
  return `S${session.number}${title}${date}`;
}

function normalizeStatus(value: string): HookStatus {
  return STATUS_OPTIONS.includes(value as HookStatus)
    ? (value as HookStatus)
    : "available";
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Richiesta fallita (${response.status})`;
  } catch {
    return `Richiesta fallita (${response.status})`;
  }
}

export function PcHookMatrix({
  campaignId,
  hooks,
  entities,
  sessions,
  selectedEntityId,
}: PcHookMatrixProps) {
  const pcs = useMemo(
    () =>
      entities
        .filter((entity) => entity.type === "pc")
        .sort((a, b) => a.name.localeCompare(b.name, "it-IT")),
    [entities],
  );
  const npcs = useMemo(
    () =>
      entities
        .filter((entity) => entity.type === "npc")
        .sort((a, b) => a.name.localeCompare(b.name, "it-IT")),
    [entities],
  );
  const hooksByPair = useMemo(() => {
    const map = new Map<string, PcHookRow[]>();
    for (const hook of hooks) {
      const key = `${hook.pcEntityId}:${hook.targetEntityId}`;
      const group = map.get(key) ?? [];
      group.push(hook);
      map.set(key, group);
    }
    return map;
  }, [hooks]);

  if (pcs.length === 0 || npcs.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        Servono almeno un PG e un NPC nel wiki per mostrare la matrice hooks.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">Matrice hook narrativi</h4>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {pcs.length} PG x {npcs.length} NPC. Gli hook sono appunti DM, non
            fatti in-fiction.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map((status) => (
            <span
              key={status}
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[status]}`}
            >
              {STATUS_LABELS[status]}
            </span>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="min-w-[900px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950">
              <th className="sticky left-0 z-10 w-48 border-r border-zinc-200 bg-zinc-50 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
                PG
              </th>
              {npcs.map((npc) => (
                <th
                  key={npc.id}
                  className={`min-w-72 border-r border-zinc-200 px-3 py-3 text-left align-top dark:border-zinc-800 ${
                    selectedEntityId === npc.id ? "bg-zinc-100 dark:bg-zinc-800" : ""
                  }`}
                >
                  <EntityHeader campaignId={campaignId} entity={npc} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pcs.map((pc) => (
              <tr key={pc.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <th
                  className={`sticky left-0 z-10 w-48 border-r border-zinc-200 bg-white px-3 py-3 text-left align-top dark:border-zinc-800 dark:bg-zinc-900 ${
                    selectedEntityId === pc.id ? "bg-zinc-50 dark:bg-zinc-800" : ""
                  }`}
                >
                  <EntityHeader campaignId={campaignId} entity={pc} />
                </th>
                {npcs.map((npc) => {
                  const pairHooks =
                    hooksByPair.get(`${pc.id}:${npc.id}`) ?? [];
                  return (
                    <td
                      key={npc.id}
                      className={`min-w-72 border-r border-zinc-200 p-3 align-top dark:border-zinc-800 ${
                        selectedEntityId === pc.id || selectedEntityId === npc.id
                          ? "bg-zinc-50/60 dark:bg-zinc-950/60"
                          : ""
                      }`}
                    >
                      <HookCell
                        campaignId={campaignId}
                        pc={pc}
                        npc={npc}
                        hooks={pairHooks}
                        sessions={sessions}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function EntityHeader({
  campaignId,
  entity,
}: {
  campaignId: string;
  entity: EntityName;
}) {
  return (
    <div className="min-w-0">
      <Link
        href={entityHref(campaignId, entity.id)}
        className="font-medium text-zinc-900 hover:text-zinc-600 dark:text-zinc-50 dark:hover:text-zinc-300"
      >
        {entity.name}
      </Link>
      {entity.publicDescription && (
        <p className="mt-1 line-clamp-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {entity.publicDescription}
        </p>
      )}
    </div>
  );
}

function HookCell({
  campaignId,
  pc,
  npc,
  hooks,
  sessions,
}: {
  campaignId: string;
  pc: EntityName;
  npc: EntityName;
  hooks: PcHookRow[];
  sessions: SessionOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [potentialArc, setPotentialArc] = useState("");
  const [status, setStatus] = useState<HookStatus>("available");
  const [usedInSession, setUsedInSession] = useState("");

  async function createHook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/pc-hooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        pcEntityId: pc.id,
        targetEntityId: npc.id,
        hookDescription: description,
        potentialArc: normalizeOptional(potentialArc),
        usedInSession: normalizeSessionId(usedInSession),
        status,
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    setDescription("");
    setPotentialArc("");
    setStatus("available");
    setUsedInSession("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {hooks.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">Vuoto</p>
      ) : (
        <div className="space-y-2">
          {hooks.map((hook) => (
            <HookEditor
              key={hook.id}
              hook={hook}
              sessions={sessions}
              onChanged={() => startTransition(() => router.refresh())}
            />
          ))}
        </div>
      )}

      <details className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
        <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Aggiungi hook
        </summary>
        <form onSubmit={createHook} className="space-y-3 px-3 pb-3">
          <TextareaField
            label="Descrizione hook"
            value={description}
            onChange={setDescription}
            required
            placeholder={`${pc.name} potrebbe legarsi a ${npc.name} per...`}
          />
          <TextareaField
            label="Arco potenziale"
            value={potentialArc}
            onChange={setPotentialArc}
            placeholder="Se accade X, l'arco diventa Y"
          />
          <HookMetaControls
            status={status}
            onStatusChange={setStatus}
            usedInSession={usedInSession}
            onSessionChange={setUsedInSession}
            sessions={sessions}
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-9 w-full rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            Crea
          </button>
          {error && <ErrorBox>{error}</ErrorBox>}
        </form>
      </details>
    </div>
  );
}

function HookEditor({
  hook,
  sessions,
  onChanged,
}: {
  hook: PcHookRow;
  sessions: SessionOption[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [description, setDescription] = useState(hook.hookDescription);
  const [potentialArc, setPotentialArc] = useState(hook.potentialArc ?? "");
  const [status, setStatus] = useState<HookStatus>(normalizeStatus(hook.status));
  const [usedInSession, setUsedInSession] = useState(hook.usedInSession ?? "");

  async function saveHook(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch(`/api/pc-hooks/${hook.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hookDescription: description,
        potentialArc: normalizeOptional(potentialArc),
        usedInSession: normalizeSessionId(usedInSession),
        status,
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  async function deleteHook() {
    setError(null);
    const response = await fetch(`/api/pc-hooks/${hook.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  return (
    <details
      open
      className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <summary className="cursor-pointer list-none px-3 py-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="line-clamp-3 text-sm leading-6 text-zinc-800 dark:text-zinc-200">
              {hook.hookDescription}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_CLASSES[normalizeStatus(hook.status)]}`}
            >
              {STATUS_LABELS[normalizeStatus(hook.status)]}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              void deleteHook();
            }}
            disabled={isPending}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            Elimina
          </button>
        </div>
      </summary>
      <form onSubmit={saveHook} className="space-y-3 px-3 pb-3">
        <TextareaField
          label="Descrizione hook"
          value={description}
          onChange={setDescription}
          required
        />
        <TextareaField
          label="Arco potenziale"
          value={potentialArc}
          onChange={setPotentialArc}
        />
        <HookMetaControls
          status={status}
          onStatusChange={setStatus}
          usedInSession={usedInSession}
          onSessionChange={setUsedInSession}
          sessions={sessions}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-9 w-full rounded-md border border-zinc-200 px-3 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Salva
        </button>
        {error && <ErrorBox>{error}</ErrorBox>}
      </form>
    </details>
  );
}

function HookMetaControls({
  status,
  onStatusChange,
  usedInSession,
  onSessionChange,
  sessions,
}: {
  status: HookStatus;
  onStatusChange: (value: HookStatus) => void;
  usedInSession: string;
  onSessionChange: (value: string) => void;
  sessions: SessionOption[];
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Stato
        </span>
        <select
          value={status}
          onChange={(event) => onStatusChange(event.target.value as HookStatus)}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Usato in
        </span>
        <select
          value={usedInSession}
          onChange={(event) => onSessionChange(event.target.value)}
          disabled={sessions.length === 0}
          className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
        >
          <option value="">
            {sessions.length === 0 ? "Nessuna sessione" : "Non usato"}
          </option>
          {sessions.map((session) => (
            <option key={session.id} value={session.id}>
              {sessionLabel(session)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  required = false,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        required={required}
        placeholder={placeholder}
        rows={3}
        className="min-h-20 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
      />
    </label>
  );
}

function ErrorBox({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
      {children}
    </p>
  );
}
