"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Visibility = "dm_only" | "discovered" | "public";

interface EntityIdentityRow {
  id: string;
  name: string;
  isTrueIdentity: boolean;
  appearance: string | null;
  voice: string | null;
  mannerisms: unknown;
  activeFromSession: string | null;
  activeUntilSession: string | null;
  visibility: Visibility;
  notes: string | null;
}

interface SessionOption {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface EntityIdentityManagerProps {
  entityId: string;
  identities: EntityIdentityRow[];
  sessions: SessionOption[];
}

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

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSessionId(value: string): string | null {
  return value.length > 0 ? value : null;
}

function parseMannerisms(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function formatMannerisms(value: unknown): string {
  return Array.isArray(value) ? value.map((item) => String(item)).join(", ") : "";
}

function sessionLabel(session: SessionOption): string {
  const title = session.title ? ` - ${session.title}` : "";
  const date = session.date ? ` (${session.date})` : "";
  return `S${session.number}${title}${date}`;
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Richiesta fallita (${response.status})`;
  } catch {
    return `Richiesta fallita (${response.status})`;
  }
}

export function EntityIdentityManager({
  entityId,
  identities,
  sessions,
}: EntityIdentityManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [isTrueIdentity, setIsTrueIdentity] = useState(false);
  const [appearance, setAppearance] = useState("");
  const [voice, setVoice] = useState("");
  const [mannerisms, setMannerisms] = useState("");
  const [activeFromSession, setActiveFromSession] = useState("");
  const [activeUntilSession, setActiveUntilSession] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("dm_only");
  const [notes, setNotes] = useState("");

  const sessionById = useMemo(
    () => new Map(sessions.map((session) => [session.id, session])),
    [sessions],
  );

  async function setSoleTrueIdentity(identityId: string) {
    const currentTrue = identities.filter(
      (identity) => identity.isTrueIdentity && identity.id !== identityId,
    );

    for (const identity of currentTrue) {
      const response = await fetch(`/api/entity-identities/${identity.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTrueIdentity: false }),
      });
      if (!response.ok) throw new Error(await parseApiError(response));
    }

    const response = await fetch(`/api/entity-identities/${identityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isTrueIdentity: true }),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
  }

  async function createIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const response = await fetch("/api/entity-identities", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        entityId,
        name,
        isTrueIdentity: false,
        appearance: normalizeOptional(appearance),
        voice: normalizeOptional(voice),
        mannerisms: parseMannerisms(mannerisms),
        activeFromSession: normalizeSessionId(activeFromSession),
        activeUntilSession: normalizeSessionId(activeUntilSession),
        visibility,
        notes: normalizeOptional(notes),
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    const created = (await response.json()) as EntityIdentityRow;

    try {
      if (isTrueIdentity) await setSoleTrueIdentity(created.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    setName("");
    setIsTrueIdentity(false);
    setAppearance("");
    setVoice("");
    setMannerisms("");
    setActiveFromSession("");
    setActiveUntilSession("");
    setVisibility("dm_only");
    setNotes("");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-5">
      <form
        onSubmit={createIdentity}
        className="grid gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Nome identita&apos;
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="Dante il Fortunato"
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

        <div className="grid gap-3 md:grid-cols-2">
          <SessionSelect
            label="Attiva da"
            value={activeFromSession}
            onChange={setActiveFromSession}
            sessions={sessions}
          />
          <SessionSelect
            label="Attiva fino a"
            value={activeUntilSession}
            onChange={setActiveUntilSession}
            sessions={sessions}
          />
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <TextareaField
            label="Aspetto"
            value={appearance}
            onChange={setAppearance}
            placeholder="Segni, postura, maschera pubblica"
          />
          <TextareaField
            label="Voce"
            value={voice}
            onChange={setVoice}
            placeholder="Tono, accento, ritmo"
          />
        </div>

        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Mannerisms
            </span>
            <input
              value={mannerisms}
              onChange={(event) => setMannerisms(event.target.value)}
              placeholder="separati da virgola"
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
            />
          </label>
          <TextareaField
            label="Note"
            value={notes}
            onChange={setNotes}
            placeholder="Uso al tavolo, limiti, contesto"
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
            <input
              type="checkbox"
              checked={isTrueIdentity}
              onChange={(event) => setIsTrueIdentity(event.target.checked)}
              className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
            />
            Vera identita&apos;
          </label>
          <button
            type="submit"
            disabled={isPending}
            className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            Crea identita&apos;
          </button>
        </div>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>

      {identities.length === 0 ? (
        <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
          Nessuna identita&apos; registrata.
        </div>
      ) : (
        <div className="grid gap-3">
          {identities.map((identity) => (
            <IdentityCard
              key={identity.id}
              identity={identity}
              identities={identities}
              sessions={sessions}
              sessionById={sessionById}
              onChanged={() => startTransition(() => router.refresh())}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function IdentityCard({
  identity,
  identities,
  sessions,
  sessionById,
  onChanged,
}: {
  identity: EntityIdentityRow;
  identities: EntityIdentityRow[];
  sessions: SessionOption[];
  sessionById: Map<string, SessionOption>;
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(identity.name);
  const [isTrueIdentity, setIsTrueIdentity] = useState(identity.isTrueIdentity);
  const [appearance, setAppearance] = useState(identity.appearance ?? "");
  const [voice, setVoice] = useState(identity.voice ?? "");
  const [mannerisms, setMannerisms] = useState(
    formatMannerisms(identity.mannerisms),
  );
  const [activeFromSession, setActiveFromSession] = useState(
    identity.activeFromSession ?? "",
  );
  const [activeUntilSession, setActiveUntilSession] = useState(
    identity.activeUntilSession ?? "",
  );
  const [visibility, setVisibility] = useState<Visibility>(identity.visibility);
  const [notes, setNotes] = useState(identity.notes ?? "");

  async function patchIdentity(id: string, body: Record<string, unknown>) {
    const response = await fetch(`/api/entity-identities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await parseApiError(response));
  }

  async function saveIdentity(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      if (isTrueIdentity) {
        for (const other of identities) {
          if (other.id !== identity.id && other.isTrueIdentity) {
            await patchIdentity(other.id, { isTrueIdentity: false });
          }
        }
      }

      await patchIdentity(identity.id, {
        name,
        isTrueIdentity,
        appearance: normalizeOptional(appearance),
        voice: normalizeOptional(voice),
        mannerisms: parseMannerisms(mannerisms),
        activeFromSession: normalizeSessionId(activeFromSession),
        activeUntilSession: normalizeSessionId(activeUntilSession),
        visibility,
        notes: normalizeOptional(notes),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      return;
    }

    startTransition(onChanged);
  }

  async function deleteIdentity() {
    setError(null);
    const response = await fetch(`/api/entity-identities/${identity.id}`, {
      method: "DELETE",
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  const from = identity.activeFromSession
    ? sessionById.get(identity.activeFromSession)
    : undefined;
  const until = identity.activeUntilSession
    ? sessionById.get(identity.activeUntilSession)
    : undefined;

  return (
    <form
      onSubmit={saveIdentity}
      className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-medium">{identity.name}</h4>
            {identity.isTrueIdentity && (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                vera identita&apos;
              </span>
            )}
            <span
              className={`rounded-full border px-2 py-0.5 text-xs font-medium ${VISIBILITY_CLASSES[identity.visibility]}`}
            >
              {VISIBILITY_LABELS[identity.visibility]}
            </span>
          </div>
          {(from || until) && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
              {from ? `Da ${sessionLabel(from)}` : "Da inizio campagna"}
              {" · "}
              {until ? `fino a ${sessionLabel(until)}` : "ancora attiva"}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void deleteIdentity()}
          disabled={isPending}
          className="rounded-md border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
        >
          Elimina
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Nome
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Visibilita&apos;
          </span>
          <VisibilitySelect value={visibility} onChange={setVisibility} />
        </label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <SessionSelect
          label="Attiva da"
          value={activeFromSession}
          onChange={setActiveFromSession}
          sessions={sessions}
        />
        <SessionSelect
          label="Attiva fino a"
          value={activeUntilSession}
          onChange={setActiveUntilSession}
          sessions={sessions}
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <TextareaField
          label="Aspetto"
          value={appearance}
          onChange={setAppearance}
          placeholder="Aspetto di questa maschera"
        />
        <TextareaField
          label="Voce"
          value={voice}
          onChange={setVoice}
          placeholder="Voce di questa identita'"
        />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Mannerisms
          </span>
          <input
            value={mannerisms}
            onChange={(event) => setMannerisms(event.target.value)}
            placeholder="separati da virgola"
            className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600 dark:focus:bg-zinc-900"
          />
        </label>
        <TextareaField
          label="Note"
          value={notes}
          onChange={setNotes}
          placeholder="Note DM"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={isTrueIdentity}
            onChange={(event) => setIsTrueIdentity(event.target.checked)}
            className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
          />
          Vera identita&apos;
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"
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

function SessionSelect({
  label,
  value,
  onChange,
  sessions,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  sessions: SessionOption[];
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={sessions.length === 0}
        className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
      >
        <option value="">
          {sessions.length === 0 ? "Nessuna sessione" : "Non impostata"}
        </option>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {sessionLabel(session)}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextareaField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
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
        placeholder={placeholder}
        rows={3}
        className="min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
      />
    </label>
  );
}
