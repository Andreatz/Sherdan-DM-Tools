"use client";

import { useEffect, useState } from "react";

import {
  parseRandomTableImport,
  type RandomTableImportFormat,
} from "@/lib/random-tables";

interface RandomTableRow {
  id: string;
  campaignId: string | null;
  name: string;
  description: string | null;
  entries: unknown;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

interface CampaignRow {
  id: string;
  name: string;
}

interface EntityRow {
  id: string;
  name: string;
}

interface RollResult {
  tableId: string;
  tableName: string | null;
  value: unknown;
  trace: RollTrace;
}

interface RollTrace {
  tableId: string;
  tableName: string | null;
  depth: number;
  entryIndex: number;
  entryLabel: string | null;
  entryValue: unknown;
  subTableId: string | null;
  nested: RollTrace | null;
  template: {
    template: string;
    result: string;
    variables: Array<{
      name: string;
      tableId: string;
      value: string;
      trace: RollTrace;
    }>;
  } | null;
}

interface DraftState {
  id: string | null;
  name: string;
  description: string;
  tags: string;
  entries: string;
}

type QuickEntityType = "npc" | "item" | "location";

const EMPTY_DRAFT: DraftState = {
  id: null,
  name: "Nuova tabella",
  description: "",
  tags: "",
  entries: JSON.stringify([{ value: "Risultato", weight: 1 }], null, 2),
};

export function RandomTablesWorkbench() {
  const [tables, setTables] = useState<RandomTableRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [search, setSearch] = useState("");
  const [tag, setTag] = useState("");
  const [sort, setSort] = useState<"name_asc" | "updated_desc">("name_asc");
  const [importFormat, setImportFormat] =
    useState<RandomTableImportFormat>("auto");
  const [importText, setImportText] = useState("");
  const [entityCampaignId, setEntityCampaignId] = useState("");
  const [quickEntityType, setQuickEntityType] =
    useState<QuickEntityType>("item");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rolling, setRolling] = useState(false);
  const [entitySavingKey, setEntitySavingKey] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rollHistory, setRollHistory] = useState<RollResult[]>([]);

  useEffect(() => {
    void loadTables();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, tag, sort]);

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setEntityCampaignId((current) => current || (rows[0]?.id ?? ""));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadTables(nextSelectedId?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sort, limit: "200" });
      if (search.trim()) params.set("search", search.trim());
      if (tag.trim()) params.set("tag", tag.trim());
      const rows = await apiFetch<RandomTableRow[]>(
        `/api/random-tables?${params.toString()}`,
      );
      setTables(rows);
      const desiredId = nextSelectedId ?? selectedId;
      const target =
        rows.find((row) => row.id === desiredId) ?? rows[0] ?? null;
      if (target) {
        setSelectedId(target.id);
        setDraft(rowToDraft(target));
      } else {
        setSelectedId(null);
        setDraft(EMPTY_DRAFT);
      }
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setLoading(false);
    }
  }

  function startNewTable() {
    setSelectedId(null);
    setDraft(EMPTY_DRAFT);
    setImportText("");
    setMessage(null);
    setError(null);
  }

  function selectTable(table: RandomTableRow) {
    setSelectedId(table.id);
    setDraft(rowToDraft(table));
    setImportText("");
    setMessage(null);
    setError(null);
  }

  async function saveDraft() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const entries = parseEntries(draft.entries);
      const body = {
        name: draft.name,
        description: draft.description.trim() || null,
        entries,
        tags: parseTags(draft.tags),
      };
      const saved = draft.id
        ? await apiFetch<RandomTableRow>(`/api/random-tables/${draft.id}`, {
            method: "PATCH",
            body: JSON.stringify(body),
          })
        : await apiFetch<RandomTableRow>("/api/random-tables", {
            method: "POST",
            body: JSON.stringify(body),
          });
      setMessage("Salvata");
      setDraft(rowToDraft(saved));
      await loadTables(saved.id);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelected() {
    if (!draft.id) return;
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      await apiFetch<void>(`/api/random-tables/${draft.id}`, {
        method: "DELETE",
      });
      setMessage("Eliminata");
      setRollHistory((history) =>
        history.filter((roll) => roll.tableId !== draft.id),
      );
      setSelectedId(null);
      setDraft(EMPTY_DRAFT);
      await loadTables();
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setSaving(false);
    }
  }

  async function rollSelected() {
    if (!draft.id) return;
    setRolling(true);
    setMessage(null);
    setError(null);
    try {
      const result = await apiFetch<RollResult>(
        `/api/random-tables/${draft.id}/roll`,
        {
          method: "POST",
          body: JSON.stringify({}),
        },
      );
      setRollHistory((history) => [result, ...history].slice(0, 12));
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setRolling(false);
    }
  }

  function importEntries() {
    setMessage(null);
    setError(null);
    try {
      const entries = parseRandomTableImport(importText, { format: importFormat });
      setDraft((current) => ({
        ...current,
        entries: JSON.stringify(entries, null, 2),
      }));
      setMessage(`Importate ${entries.length} entries`);
    } catch (err) {
      setError(messageForError(err));
    }
  }

  async function saveRollAsEntity(roll: RollResult, index: number) {
    const campaignId = entityCampaignId || campaigns[0]?.id;
    if (!campaignId) {
      setError("Nessuna campagna disponibile per salvare l'entity");
      return;
    }

    const key = `${roll.tableId}-${index}`;
    const rollValue = formatValue(roll.value);
    setEntitySavingKey(key);
    setMessage(null);
    setError(null);

    try {
      const entity = await apiFetch<EntityRow>("/api/entities", {
        method: "POST",
        body: JSON.stringify({
          campaignId,
          type: quickEntityType,
          name: entityNameFromRoll(rollValue),
          description: entityDescriptionFromRoll(roll, rollValue),
          properties: propertiesForQuickEntity(quickEntityType, roll, rollValue),
          tags: ["random-table", "generated", quickEntityType],
          visibility: "dm_only",
        }),
      });
      setMessage(`Entity salvata: ${entity.name}`);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setEntitySavingKey(null);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Random Tables
          </h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Fase 2
          </p>
        </div>
        <button
          type="button"
          onClick={startNewTable}
          className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Nuova tabella
        </button>
      </header>

      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <aside className="space-y-3">
          <div className="grid gap-2">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cerca"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <input
              value={tag}
              onChange={(event) => setTag(event.target.value)}
              placeholder="Tag"
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            />
            <select
              value={sort}
              onChange={(event) =>
                setSort(event.target.value as "name_asc" | "updated_desc")
              }
              className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="name_asc">Nome</option>
              <option value="updated_desc">Modificate</option>
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              Library
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {loading ? (
                <div className="px-3 py-4 text-sm text-zinc-500">Carico...</div>
              ) : tables.length === 0 ? (
                <div className="px-3 py-4 text-sm text-zinc-500">Nessuna tabella</div>
              ) : (
                tables.map((table) => (
                  <button
                    key={table.id}
                    type="button"
                    onClick={() => selectTable(table)}
                    className={`block w-full border-b border-zinc-100 px-3 py-3 text-left text-sm transition-colors last:border-b-0 dark:border-zinc-800 ${
                      selectedId === table.id
                        ? "bg-zinc-100 text-zinc-950 dark:bg-zinc-800 dark:text-zinc-50"
                        : "text-zinc-700 hover:bg-zinc-50 dark:text-zinc-200 dark:hover:bg-zinc-800/60"
                    }`}
                  >
                    <span className="block truncate font-medium">{table.name}</span>
                    <span className="mt-1 block truncate text-xs text-zinc-500 dark:text-zinc-400">
                      {table.tags.length > 0 ? table.tags.join(", ") : "no tags"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </aside>

        <section className="min-w-0 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid gap-4">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Nome
              </span>
              <input
                value={draft.name}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, name: event.target.value }))
                }
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Descrizione
              </span>
              <input
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tags
              </span>
              <input
                value={draft.tags}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, tags: event.target.value }))
                }
                placeholder="nomi, npc, sher dan"
                className="h-10 rounded-md border border-zinc-300 bg-white px-3 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>

            <div className="grid gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Import
                </span>
                <div className="flex gap-2">
                  <select
                    value={importFormat}
                    onChange={(event) =>
                      setImportFormat(
                        event.target.value as RandomTableImportFormat,
                      )
                    }
                    className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
                  >
                    <option value="auto">Auto</option>
                    <option value="json">JSON</option>
                    <option value="markdown">Markdown</option>
                    <option value="csv">CSV</option>
                  </select>
                  <button
                    type="button"
                    onClick={importEntries}
                    className="h-9 rounded-md border border-zinc-300 px-3 text-sm font-medium transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    Importa
                  </button>
                </div>
              </div>
              <textarea
                value={importText}
                onChange={(event) => setImportText(event.target.value)}
                placeholder="Incolla entries"
                spellCheck={false}
                className="min-h-28 resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </div>

            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Entries JSON
              </span>
              <textarea
                value={draft.entries}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    entries: event.target.value,
                  }))
                }
                spellCheck={false}
                className="min-h-[420px] resize-y rounded-md border border-zinc-300 bg-white p-3 font-mono text-sm leading-6 outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              />
            </label>
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <div className="min-h-5 text-sm">
              {error ? (
                <span className="text-red-600 dark:text-red-400">{error}</span>
              ) : message ? (
                <span className="text-emerald-700 dark:text-emerald-400">
                  {message}
                </span>
              ) : null}
            </div>
            <div className="flex gap-2">
              {draft.id && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={saving}
                  className="h-10 rounded-md border border-red-300 px-4 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950"
                >
                  Elimina
                </button>
              )}
              <button
                type="button"
                onClick={saveDraft}
                disabled={saving}
                className="h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              >
                {saving ? "Salvo..." : "Salva"}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-3 xl:sticky xl:top-8 xl:self-start">
          <div className="grid gap-2 rounded-lg border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Campagna
              </span>
              <select
                value={entityCampaignId}
                onChange={(event) => setEntityCampaignId(event.target.value)}
                className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                {campaigns.length === 0 ? (
                  <option value="">Nessuna campagna</option>
                ) : (
                  campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))
                )}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Tipo entity
              </span>
              <select
                value={quickEntityType}
                onChange={(event) =>
                  setQuickEntityType(event.target.value as QuickEntityType)
                }
                className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="item">Item</option>
                <option value="npc">NPC</option>
                <option value="location">Location</option>
              </select>
            </label>
          </div>

          <button
            type="button"
            onClick={rollSelected}
            disabled={!draft.id || rolling}
            className="h-11 w-full rounded-md bg-emerald-700 text-sm font-semibold text-white transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500"
          >
            {rolling ? "Tiro..." : "Roll"}
          </button>

          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-200 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              History
            </div>
            <div className="max-h-[680px] overflow-y-auto">
              {rollHistory.length === 0 ? (
                <div className="px-3 py-4 text-sm text-zinc-500">Nessun tiro</div>
              ) : (
                rollHistory.map((roll, index) => {
                  const key = `${roll.tableId}-${index}`;
                  return (
                    <div
                      key={key}
                      className="border-b border-zinc-100 px-3 py-3 last:border-b-0 dark:border-zinc-800"
                    >
                      <div className="break-words text-sm font-medium text-zinc-900 dark:text-zinc-50">
                        {formatValue(roll.value)}
                      </div>
                      <div className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
                        {traceSummary(roll.trace)}
                      </div>
                      <button
                        type="button"
                        onClick={() => saveRollAsEntity(roll, index)}
                        disabled={!entityCampaignId || entitySavingKey === key}
                        className="mt-3 h-8 rounded-md border border-zinc-300 px-3 text-xs font-medium transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                      >
                        {entitySavingKey === key ? "Salvo..." : "Salva entity"}
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function rowToDraft(row: RandomTableRow): DraftState {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    tags: row.tags.join(", "),
    entries: JSON.stringify(row.entries, null, 2),
  };
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function parseEntries(value: string): unknown {
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error("Entries JSON non valido");
  }
}

async function apiFetch<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
  });

  if (response.status === 204) return undefined as T;

  const data = (await response.json()) as unknown;
  if (!response.ok) {
    const message =
      typeof data === "object" &&
      data !== null &&
      "error" in data &&
      typeof data.error === "object" &&
      data.error !== null &&
      "message" in data.error &&
      typeof data.error.message === "string"
        ? data.error.message
        : "Richiesta fallita";
    throw new Error(message);
  }
  return data as T;
}

function messageForError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function formatValue(value: unknown): string {
  if (typeof value === "string") return value;
  return JSON.stringify(value);
}

function entityNameFromRoll(value: string): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= 90) return normalized || "Risultato random table";
  return `${normalized.slice(0, 87).trim()}...`;
}

function entityDescriptionFromRoll(roll: RollResult, value: string): string {
  return [
    `Generato da random table: ${roll.tableName ?? roll.tableId}.`,
    "",
    value,
    "",
    `Trace: ${traceSummary(roll.trace)}`,
  ].join("\n");
}

function propertiesForQuickEntity(
  type: QuickEntityType,
  roll: RollResult,
  value: string,
): Record<string, unknown> {
  const extra = {
    random_table_roll: {
      tableId: roll.tableId,
      tableName: roll.tableName,
      value: roll.value,
      trace: roll.trace,
    },
  };

  if (type === "npc") {
    return {
      race: "sconosciuta",
      appearance_summary: value,
      sensory_details: {},
      voice: { speech_patterns: [] },
      tics: [],
      mannerisms: [],
      motivations: [],
      goals: {},
      weaknesses: [],
      extra,
    };
  }

  if (type === "location") {
    return {
      kind: "settlement",
      atmosphere: {},
      notable_features: [value],
      services: [],
      extra,
    };
  }

  return {
    kind: "trinket",
    attunement: false,
    effects: [value],
    crafted_from: [],
    extra,
  };
}

function traceSummary(trace: RollTrace): string {
  const parts = [`${trace.tableName ?? trace.tableId} #${trace.entryIndex + 1}`];
  if (trace.template) {
    parts.push(
      trace.template.variables
        .map((variable) => `${variable.name}:${variable.value}`)
        .join(" | "),
    );
  }
  if (trace.nested) {
    parts.push(`nested -> ${traceSummary(trace.nested)}`);
  }
  return parts.filter(Boolean).join(" · ");
}
