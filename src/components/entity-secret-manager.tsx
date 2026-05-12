"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { PlayerOverrideEditor } from "@/components/player-override-editor";

type SecretLayer = "surface" | "intermediate" | "deep";

interface EntitySecretRow {
  id: string;
  layer: SecretLayer;
  content: string;
  exploitHint: string | null;
  discoveredAtSession: string | null;
  discoveryNotes: string | null;
}

interface SessionOption {
  id: string;
  number: number;
  title: string | null;
  date: string | null;
}

interface EntitySecretManagerProps {
  campaignId: string;
  entityId: string;
  secrets: EntitySecretRow[];
  sessions: SessionOption[];
}

const LAYERS: SecretLayer[] = ["surface", "intermediate", "deep"];

const LAYER_LABELS: Record<SecretLayer, string> = {
  surface: "Surface",
  intermediate: "Intermediate",
  deep: "Deep",
};

const LAYER_HELP: Record<SecretLayer, string> = {
  surface: "Segreti immediati, intuibili o facili da esporre.",
  intermediate: "Verita' che cambiano lettura a scene e relazioni.",
  deep: "Nucleo nascosto, rivelazioni da trattare con cautela.",
};

function normalizeOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
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

export function EntitySecretManager({
  campaignId,
  entityId,
  secrets,
  sessions,
}: EntitySecretManagerProps) {
  const secretsByLayer = useMemo(
    () =>
      new Map(
        LAYERS.map((layer) => [
          layer,
          secrets.filter((secret) => secret.layer === layer),
        ]),
      ),
    [secrets],
  );

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {LAYERS.map((layer) => (
        <SecretLayerColumn
          key={layer}
          campaignId={campaignId}
          entityId={entityId}
          layer={layer}
          secrets={secretsByLayer.get(layer) ?? []}
          sessions={sessions}
        />
      ))}
    </div>
  );
}

function SecretLayerColumn({
  campaignId,
  entityId,
  layer,
  secrets,
  sessions,
}: {
  campaignId: string;
  entityId: string;
  layer: SecretLayer;
  secrets: EntitySecretRow[];
  sessions: SessionOption[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [exploitHint, setExploitHint] = useState("");
  const [isDiscovered, setIsDiscovered] = useState(false);
  const [discoveredAtSession, setDiscoveredAtSession] = useState("");
  const [discoveryNotes, setDiscoveryNotes] = useState("");

  const defaultDiscoverySessionId = sessions.at(-1)?.id ?? "";

  async function createSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const resolvedSessionId =
      discoveredAtSession || (isDiscovered ? defaultDiscoverySessionId : "");

    if (isDiscovered && !resolvedSessionId) {
      setError("Per segnare un segreto come scoperto serve una sessione.");
      return;
    }

    const response = await fetch("/api/entity-secrets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        campaignId,
        entityId,
        plotThreadId: null,
        layer,
        content,
        exploitHint: normalizeOptional(exploitHint),
        discoveredAtSession: isDiscovered ? resolvedSessionId : null,
        discoveryNotes: normalizeOptional(discoveryNotes),
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    setContent("");
    setExploitHint("");
    setIsDiscovered(false);
    setDiscoveredAtSession("");
    setDiscoveryNotes("");
    startTransition(() => router.refresh());
  }

  return (
    <details
      open
      className="rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
    >
      <summary className="cursor-pointer list-none border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-zinc-600 dark:text-zinc-300">
              {LAYER_LABELS[layer]}
            </h4>
            <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              {LAYER_HELP[layer]}
            </p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
            {secrets.length}
          </span>
        </div>
      </summary>

      <div className="space-y-4 p-4">
        <form
          onSubmit={createSecret}
          className="space-y-3 rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <TextareaField
            label="Nuovo segreto"
            value={content}
            onChange={setContent}
            required
            placeholder="Cosa e' vero sotto la superficie?"
          />
          <TextareaField
            label="Come sfruttarlo"
            value={exploitHint}
            onChange={setExploitHint}
            placeholder="Chi puo' usarlo e in che modo"
          />
          <DiscoveryControls
            isDiscovered={isDiscovered}
            onDiscoveredChange={setIsDiscovered}
            discoveredAtSession={discoveredAtSession}
            onSessionChange={setDiscoveredAtSession}
            discoveryNotes={discoveryNotes}
            onNotesChange={setDiscoveryNotes}
            sessions={sessions}
          />
          <button
            type="submit"
            disabled={isPending}
            className="h-10 w-full rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300"
          >
            Crea segreto
          </button>
          {error && (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
              {error}
            </p>
          )}
        </form>

        {secrets.length === 0 ? (
          <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
            Nessun segreto in questo layer.
          </div>
        ) : (
          <div className="space-y-3">
            {secrets.map((secret) => (
              <SecretCard
                key={secret.id}
                campaignId={campaignId}
                secret={secret}
                sessions={sessions}
                onChanged={() => startTransition(() => router.refresh())}
              />
            ))}
          </div>
        )}
      </div>
    </details>
  );
}

function SecretCard({
  campaignId,
  secret,
  sessions,
  onChanged,
}: {
  campaignId: string;
  secret: EntitySecretRow;
  sessions: SessionOption[];
  onChanged: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState(secret.content);
  const [exploitHint, setExploitHint] = useState(secret.exploitHint ?? "");
  const [isDiscovered, setIsDiscovered] = useState(
    secret.discoveredAtSession !== null,
  );
  const [discoveredAtSession, setDiscoveredAtSession] = useState(
    secret.discoveredAtSession ?? "",
  );
  const [discoveryNotes, setDiscoveryNotes] = useState(
    secret.discoveryNotes ?? "",
  );

  const defaultDiscoverySessionId = sessions.at(-1)?.id ?? "";

  async function saveSecret(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const resolvedSessionId =
      discoveredAtSession || (isDiscovered ? defaultDiscoverySessionId : "");

    if (isDiscovered && !resolvedSessionId) {
      setError("Per segnare un segreto come scoperto serve una sessione.");
      return;
    }

    const response = await fetch(`/api/entity-secrets/${secret.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content,
        exploitHint: normalizeOptional(exploitHint),
        discoveredAtSession: isDiscovered ? resolvedSessionId : null,
        discoveryNotes: normalizeOptional(discoveryNotes),
      }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    startTransition(onChanged);
  }

  async function deleteSecret() {
    setError(null);
    const response = await fetch(`/api/entity-secrets/${secret.id}`, {
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
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="line-clamp-2 text-sm font-medium leading-6 text-zinc-900 dark:text-zinc-100">
              {secret.content}
            </p>
            <span
              className={`mt-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${
                secret.discoveredAtSession
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                  : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              }`}
            >
              {secret.discoveredAtSession ? "Scoperto" : "Nascosto"}
            </span>
          </div>
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              void deleteSecret();
            }}
            disabled={isPending}
            className="rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-900 dark:text-red-200 dark:hover:bg-red-950/40"
          >
            Elimina
          </button>
        </div>
      </summary>

      <form onSubmit={saveSecret} className="space-y-3 px-3 pb-3">
        <TextareaField
          label="Segreto"
          value={content}
          onChange={setContent}
          required
        />
        <TextareaField
          label="Come sfruttarlo"
          value={exploitHint}
          onChange={setExploitHint}
        />
        <DiscoveryControls
          isDiscovered={isDiscovered}
          onDiscoveredChange={setIsDiscovered}
          discoveredAtSession={discoveredAtSession}
          onSessionChange={setDiscoveredAtSession}
          discoveryNotes={discoveryNotes}
          onNotesChange={setDiscoveryNotes}
          sessions={sessions}
        />
        <button
          type="submit"
          disabled={isPending}
          className="h-10 w-full rounded-md border border-zinc-200 px-4 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-800"
        >
          Salva
        </button>
        {error && (
          <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        )}
      </form>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs uppercase tracking-wide text-zinc-500 hover:text-zinc-800 dark:text-zinc-400 dark:hover:text-zinc-100">
          Visibilita&apos; per giocatore
        </summary>
        <div className="mt-2">
          <PlayerOverrideEditor
            campaignId={campaignId}
            targetType="entity_secret"
            targetId={secret.id}
            targetLabel={`Segreto ${secret.layer}`}
            baseVisibility="dm_only"
          />
        </div>
      </details>
    </details>
  );
}

function DiscoveryControls({
  isDiscovered,
  onDiscoveredChange,
  discoveredAtSession,
  onSessionChange,
  discoveryNotes,
  onNotesChange,
  sessions,
}: {
  isDiscovered: boolean;
  onDiscoveredChange: (value: boolean) => void;
  discoveredAtSession: string;
  onSessionChange: (value: string) => void;
  discoveryNotes: string;
  onNotesChange: (value: string) => void;
  sessions: SessionOption[];
}) {
  return (
    <div className="space-y-3">
      <label className="inline-flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
        <input
          type="checkbox"
          checked={isDiscovered}
          onChange={(event) => onDiscoveredChange(event.target.checked)}
          className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
        />
        Scoperto dal party
      </label>

      {isDiscovered && (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Sessione scoperta
            </span>
            <select
              value={discoveredAtSession}
              onChange={(event) => onSessionChange(event.target.value)}
              disabled={sessions.length === 0}
              className="h-10 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
            >
              <option value="">
                {sessions.length === 0 ? "Nessuna sessione" : "Ultima sessione"}
              </option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {sessionLabel(session)}
                </option>
              ))}
            </select>
          </label>
          <TextareaField
            label="Note scoperta"
            value={discoveryNotes}
            onChange={onNotesChange}
            placeholder="Come lo hanno scoperto o interpretato"
          />
        </>
      )}
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
        className="min-h-24 w-full resize-y rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm leading-6 text-zinc-900 outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-600"
      />
    </label>
  );
}
