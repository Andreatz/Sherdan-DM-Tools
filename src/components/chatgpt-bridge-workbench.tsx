"use client";

import { useEffect, useMemo, useState } from "react";

import type {
  ChatGptBridgeDensity,
  ChatGptBridgeTaskType,
  ReviewChange,
} from "@/lib/chatgpt-bridge";

interface CampaignRow {
  id: string;
  name: string;
}

interface LocationRow {
  id: string;
  name: string;
  type: string;
}

interface ExportDraft {
  campaignId: string;
  taskType: ChatGptBridgeTaskType;
  density: ChatGptBridgeDensity;
  audience: "gm" | "player";
  sessionNumber: string;
  focus: string;
  locationId: string;
  expectedDurationHours: string;
  constraints: string;
  includeSystemPrompt: boolean;
  includeCampaignSnapshot: boolean;
  includeRecentSessions: boolean;
  recentSessionsLimit: string;
  includePlotThreads: boolean;
  includeTruthClues: boolean;
  includeSecrets: boolean;
  includePcHooks: boolean;
  includeFactions: boolean;
  includePlayerFacingState: boolean;
  requestUpdatePack: boolean;
}

interface BridgePreset {
  label: string;
  description: string;
  patch: Partial<ExportDraft>;
}

interface ExportResponse {
  ok: true;
  filename: string;
  markdown: string;
  estimatedCharacters: number;
  warnings: string[];
}

interface AnalyzeResponse {
  ok: true;
  detectedTitle?: string;
  detectedSessionNumber?: number;
  hasUpdatePack: boolean;
  updatePack?: unknown;
  markdownWithoutUpdatePack: string;
  warnings: string[];
  canonDiff?: {
    comparedTo: string;
    sections: Array<{
      label: string;
      similarity: number;
      added: string[];
      removed: string[];
    }>;
  };
}

const TASK_TYPES: Array<{ value: ChatGptBridgeTaskType; label: string }> = [
  { value: "session_md", label: "Sessione MD" },
  { value: "session_brief", label: "Brief sessione" },
  { value: "session_audit", label: "Audit sessione" },
  { value: "session_patch", label: "Patch sessione" },
  { value: "dialogue", label: "Dialogo" },
  { value: "txc", label: "TXC" },
  { value: "player_recap", label: "Recap giocatori" },
  { value: "gm_recap", label: "Recap GM" },
  { value: "lore", label: "Lore" },
  { value: "npc", label: "NPC" },
  { value: "faction", label: "Fazione" },
  { value: "city", label: "Citta" },
  { value: "dungeon", label: "Dungeon" },
];

const DENSITIES: ChatGptBridgeDensity[] = [
  "Light",
  "Standard",
  "Full",
  "Table-Ready",
  "Design-Only",
];

const DEFAULT_DRAFT: ExportDraft = {
  campaignId: "",
  taskType: "session_md",
  density: "Standard",
  audience: "gm",
  sessionNumber: "",
  focus: "",
  locationId: "",
  expectedDurationHours: "",
  constraints: "",
  includeSystemPrompt: true,
  includeCampaignSnapshot: true,
  includeRecentSessions: true,
  recentSessionsLimit: "5",
  includePlotThreads: true,
  includeTruthClues: true,
  includeSecrets: true,
  includePcHooks: true,
  includeFactions: true,
  includePlayerFacingState: false,
  requestUpdatePack: true,
};

const BRIDGE_PRESETS: BridgePreset[] = [
  {
    label: "Sessione politica",
    description: "Intrighi, fazioni, leve sociali e conseguenze.",
    patch: {
      taskType: "session_md",
      density: "Full",
      audience: "gm",
      includeSecrets: true,
      includePcHooks: true,
      includeFactions: true,
      includePlayerFacingState: false,
      focus: "Sessione politica con fazioni, obiettivi divergenti e scene negoziali.",
      constraints:
        "Evidenzia leve sociali, posta in gioco, informazioni asimmetriche e conseguenze delle scelte. Non forzare decisioni dei PG.",
    },
  },
  {
    label: "Dungeon",
    description: "Struttura esplorativa table-ready.",
    patch: {
      taskType: "dungeon",
      density: "Table-Ready",
      audience: "gm",
      includeSecrets: true,
      includePcHooks: false,
      includeFactions: true,
      focus: "Dungeon giocabile al tavolo con stanze, scoperte, ritmo e payoff.",
      constraints:
        "Ogni area deve avere funzione, scelta interessante, rischio o informazione. Evita stanze riempitive.",
    },
  },
  {
    label: "Heist",
    description: "Obiettivo, sicurezza, complicazioni e timer.",
    patch: {
      taskType: "session_md",
      density: "Table-Ready",
      audience: "gm",
      includeSecrets: true,
      includePcHooks: true,
      includeFactions: true,
      focus: "Heist con bersaglio, sorveglianza, punti di ingresso, allarmi e complicazioni.",
      constraints:
        "Prepara clock, vie alternative, fail-forward e reazioni dinamiche. Non assumere un piano specifico dei PG.",
    },
  },
  {
    label: "Recap giocatori",
    description: "Player-facing, senza segreti GM.",
    patch: {
      taskType: "player_recap",
      density: "Light",
      audience: "player",
      includeSecrets: false,
      includePcHooks: false,
      includeFactions: true,
      includePlayerFacingState: true,
      requestUpdatePack: false,
      focus: "Recap breve per i giocatori, chiaro e senza spoiler.",
      constraints:
        "Usa solo informazioni player-facing. Mantieni tono evocativo ma operativo.",
    },
  },
  {
    label: "Audit anti-railroad",
    description: "Controllo agency, alternative e pressioni.",
    patch: {
      taskType: "session_audit",
      density: "Design-Only",
      audience: "gm",
      includeSecrets: true,
      includePcHooks: true,
      includeFactions: true,
      focus: "Audit anti-railroad: agency dei PG, scelte reali, alternative e conseguenze.",
      constraints:
        "Individua colli di bottiglia, scene troppo obbligate, PNG onniscienti e reveal non guadagnati. Proponi correzioni pratiche.",
    },
  },
];

export function ChatGptBridgeWorkbench({
  mode = "full",
}: {
  mode?: "full" | "import-only";
}) {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [draft, setDraft] = useState<ExportDraft>(DEFAULT_DRAFT);
  const [exportResult, setExportResult] = useState<ExportResponse | null>(null);
  const [importContent, setImportContent] = useState("");
  const [appendToPrepNotes, setAppendToPrepNotes] = useState(false);
  const [appendToDmNotes, setAppendToDmNotes] = useState(false);
  const [createSessionIfMissing, setCreateSessionIfMissing] = useState(false);
  const [savedImportId, setSavedImportId] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<AnalyzeResponse | null>(null);
  const [reviewChanges, setReviewChanges] = useState<ReviewChange[]>([]);
  const [reviewWarnings, setReviewWarnings] = useState<string[]>([]);
  const [selectedChanges, setSelectedChanges] = useState<Set<number>>(new Set());
  const [confirmHighRisk, setConfirmHighRisk] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadCampaigns() {
      try {
        const rows = await apiFetch<CampaignRow[]>("/api/campaigns");
        if (cancelled) return;
        setCampaigns(rows);
        setDraft((current) => ({
          ...current,
          campaignId: current.campaignId || (rows[0]?.id ?? ""),
        }));
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function loadLocations() {
      if (!draft.campaignId) {
        setLocations([]);
        return;
      }
      try {
        const rows = await apiFetch<LocationRow[]>(
          `/api/entities?campaign_id=${encodeURIComponent(draft.campaignId)}&type=location&sort=name_asc&limit=200`,
        );
        if (!cancelled) setLocations(rows);
      } catch (err) {
        if (!cancelled) setError(messageForError(err));
      }
    }
    void loadLocations();
    return () => {
      cancelled = true;
    };
  }, [draft.campaignId]);

  const selectedCampaignName = useMemo(
    () => campaigns.find((campaign) => campaign.id === draft.campaignId)?.name ?? "Nessuna campagna",
    [campaigns, draft.campaignId],
  );

  const selectedHighRiskCount = useMemo(
    () =>
      reviewChanges.filter(
        (change, index) => selectedChanges.has(index) && isHighRiskChange(change),
      ).length,
    [reviewChanges, selectedChanges],
  );

  function updateDraft<K extends keyof ExportDraft>(key: K, value: ExportDraft[K]) {
    setDraft((current) => {
      const next = { ...current, [key]: value };
      if (key === "audience" && value === "player") next.includeSecrets = false;
      if (key === "taskType" && value === "player_recap") {
        next.audience = "player";
        next.includeSecrets = false;
      }
      return next;
    });
    setMessage(null);
    setError(null);
  }

  function applyPreset(preset: BridgePreset) {
    setDraft((current) => ({
      ...current,
      ...preset.patch,
      campaignId: current.campaignId,
      sessionNumber: current.sessionNumber,
      locationId: current.locationId,
      expectedDurationHours: current.expectedDurationHours,
      recentSessionsLimit: current.recentSessionsLimit,
    }));
    setMessage(`Preset applicato: ${preset.label}.`);
    setError(null);
  }

  async function generateExport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.campaignId) return;
    setBusy("export");
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<ExportResponse>("/api/chatgpt-bridge/export", {
        method: "POST",
        body: JSON.stringify(exportPayload(draft)),
      });
      setExportResult(response);
      setMessage(`Pacchetto generato: ${response.estimatedCharacters.toLocaleString("it-IT")} caratteri.`);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(null);
    }
  }

  async function copyMarkdown() {
    if (!exportResult) return;
    await navigator.clipboard.writeText(exportResult.markdown);
    setMessage("Pacchetto copiato negli appunti.");
  }

  function downloadMarkdown() {
    if (!exportResult) return;
    const blob = new Blob([exportResult.markdown], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = exportResult.filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  async function analyzeImport() {
    if (!draft.campaignId || !importContent.trim()) return;
    setBusy("analyze");
    setError(null);
    setMessage(null);
    setReviewChanges([]);
    setSelectedChanges(new Set());
    setConfirmHighRisk(false);
    setSavedImportId(null);
    try {
      const analyzed = await apiFetch<AnalyzeResponse>(
        "/api/chatgpt-bridge/import/analyze",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId: draft.campaignId,
            taskType: draft.taskType,
            sessionNumber: numberOrUndefined(draft.sessionNumber),
            content: importContent,
          }),
        },
      );
      setAnalyzeResult(analyzed);
      setMessage(analyzed.hasUpdatePack ? "Output analizzato: UPDATE PACK rilevato." : "Output analizzato.");
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveImport() {
    if (!draft.campaignId || !importContent.trim()) return;
    setBusy("save");
    setError(null);
    try {
      const response = await apiFetch<{ ok: true; import: { id: string }; appendedToSession: { number: number } | null }>(
        "/api/chatgpt-bridge/import/save-session",
        {
        method: "POST",
        body: JSON.stringify({
          campaignId: draft.campaignId,
          taskType: draft.taskType,
          sessionNumber: numberOrUndefined(draft.sessionNumber),
          content: importContent,
          updatePack: analyzeResult?.updatePack,
          detectedTitle: analyzeResult?.detectedTitle,
          confirmAppendToPrepNotes: appendToPrepNotes,
          confirmAppendToDmNotes: appendToDmNotes,
          createSessionIfMissing,
        }),
        },
      );
      setSavedImportId(response.import.id);
      setMessage(
        response.appendedToSession
          ? `Import salvato e appeso alle prep_notes della sessione ${response.appendedToSession.number}.`
          : "Import salvato nel registro ChatGPT Bridge.",
      );
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(null);
    }
  }

  async function reviewUpdatePack() {
    if (!analyzeResult?.updatePack || !draft.campaignId) return;
    setBusy("review");
    setError(null);
    try {
      const response = await apiFetch<{ ok: true; changes: ReviewChange[]; warnings: string[] }>(
        "/api/chatgpt-bridge/import/review-update-pack",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId: draft.campaignId,
            sessionNumber: analyzeResult.detectedSessionNumber ?? numberOrUndefined(draft.sessionNumber),
            updatePack: analyzeResult.updatePack,
          }),
        },
      );
      setReviewChanges(response.changes);
      setReviewWarnings(response.warnings);
      setSelectedChanges(new Set(response.changes.map((_, index) => index)));
      setConfirmHighRisk(false);
      setMessage(`Review pronta: ${response.changes.length} modifiche candidate.`);
      setError(null);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(null);
    }
  }

  async function applySelected() {
    if (!draft.campaignId || selectedChanges.size === 0) return;
    if (selectedHighRiskCount > 0 && !confirmHighRisk) {
      setError("Conferma le modifiche ad alto rischio prima dell'apply.");
      return;
    }
    setBusy("apply");
    setError(null);
    try {
      const selected = reviewChanges.filter((_, index) => selectedChanges.has(index));
      const response = await apiFetch<{ ok: true; applied: Array<{ label: string }> }>(
        "/api/chatgpt-bridge/import/apply",
        {
          method: "POST",
          body: JSON.stringify({
            campaignId: draft.campaignId,
            importId: savedImportId ?? undefined,
            selectedChanges: selected,
          }),
        },
      );
      setMessage(`Applicate ${response.applied.length} modifiche selezionate.`);
    } catch (err) {
      setError(messageForError(err));
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setDraft((current) => ({ ...DEFAULT_DRAFT, campaignId: current.campaignId }));
    setExportResult(null);
    setImportContent("");
    setAppendToPrepNotes(false);
    setAppendToDmNotes(false);
    setCreateSessionIfMissing(false);
    setSavedImportId(null);
    setAnalyzeResult(null);
    setReviewChanges([]);
    setSelectedChanges(new Set());
    setConfirmHighRisk(false);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">ChatGPT Web Bridge</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Esporta contesto canonico, usa ChatGPT web manualmente, importa solo cio che approvi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 font-semibold text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
            Nessuna API chiamata
          </span>
          <span className="rounded-md border border-zinc-200 px-3 py-2 text-zinc-600 dark:border-zinc-800 dark:text-zinc-300">
            {selectedCampaignName}
          </span>
        </div>
      </header>

      {error && (
        <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          {error}
        </div>
      )}
      {message && (
        <div className="rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200">
          {message}
        </div>
      )}

      {mode === "full" ? (
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <form
          onSubmit={generateExport}
          className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
        >
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Preset Bridge</h2>
            <div className="grid gap-2">
              {BRIDGE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-md border border-zinc-200 px-3 py-2 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800"
                  title={preset.description}
                >
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {preset.label}
                  </span>
                  <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </section>

          <Field label="Campagna">
            <select value={draft.campaignId} onChange={(e) => updateDraft("campaignId", e.target.value)} className={controlClass}>
              {campaigns.length === 0 ? <option value="">Nessuna campagna</option> : campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo">
              <select value={draft.taskType} onChange={(e) => updateDraft("taskType", e.target.value as ChatGptBridgeTaskType)} className={controlClass}>
                {TASK_TYPES.map((task) => <option key={task.value} value={task.value}>{task.label}</option>)}
              </select>
            </Field>
            <Field label="Densita">
              <select value={draft.density} onChange={(e) => updateDraft("density", e.target.value as ChatGptBridgeDensity)} className={controlClass}>
                {DENSITIES.map((density) => <option key={density} value={density}>{density}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Audience">
              <select value={draft.audience} onChange={(e) => updateDraft("audience", e.target.value as "gm" | "player")} className={controlClass}>
                <option value="gm">GM</option>
                <option value="player">Player-facing</option>
              </select>
            </Field>
            <Field label="Sessione">
              <input type="number" min={1} value={draft.sessionNumber} onChange={(e) => updateDraft("sessionNumber", e.target.value)} className={controlClass} />
            </Field>
          </div>
          <Field label="Focus">
            <input value={draft.focus} onChange={(e) => updateDraft("focus", e.target.value)} className={controlClass} placeholder="PNG, scena, fazione, problema..." />
          </Field>
          <Field label="Location">
            <select value={draft.locationId} onChange={(e) => updateDraft("locationId", e.target.value)} className={controlClass}>
              <option value="">Nessuna location specifica</option>
              {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
            </select>
          </Field>
          <Field label="Durata prevista">
            <input type="number" min={0.5} step={0.5} value={draft.expectedDurationHours} onChange={(e) => updateDraft("expectedDurationHours", e.target.value)} className={controlClass} placeholder="ore" />
          </Field>
          <Field label="Vincoli">
            <textarea rows={3} value={draft.constraints} onChange={(e) => updateDraft("constraints", e.target.value)} className={textareaClass} />
          </Field>

          <section className="space-y-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <h2 className="text-sm font-semibold">Sezioni incluse</h2>
            <Checkbox label="Prompt Architetto completo" checked={draft.includeSystemPrompt} onChange={(value) => updateDraft("includeSystemPrompt", value)} />
            <Checkbox label="Snapshot campagna" checked={draft.includeCampaignSnapshot} onChange={(value) => updateDraft("includeCampaignSnapshot", value)} />
            <Checkbox label="Ultime sessioni" checked={draft.includeRecentSessions} onChange={(value) => updateDraft("includeRecentSessions", value)} />
            <Field label="Limite sessioni">
              <input type="number" min={1} max={10} value={draft.recentSessionsLimit} onChange={(e) => updateDraft("recentSessionsLimit", e.target.value)} className={controlClass} />
            </Field>
            <Checkbox label="Plot thread" checked={draft.includePlotThreads} onChange={(value) => updateDraft("includePlotThreads", value)} />
            <Checkbox label="Truth clues" checked={draft.includeTruthClues} onChange={(value) => updateDraft("includeTruthClues", value)} />
            <Checkbox label="Segreti GM rilevanti" checked={draft.includeSecrets} disabled={draft.audience === "player"} onChange={(value) => updateDraft("includeSecrets", value)} />
            <Checkbox label="PC hooks" checked={draft.includePcHooks} onChange={(value) => updateDraft("includePcHooks", value)} />
            <Checkbox label="Registro fazioni" checked={draft.includeFactions} onChange={(value) => updateDraft("includeFactions", value)} />
            <Checkbox label="Player-facing state" checked={draft.includePlayerFacingState} onChange={(value) => updateDraft("includePlayerFacingState", value)} />
            <Checkbox label="Richiedi UPDATE PACK JSON" checked={draft.requestUpdatePack} onChange={(value) => updateDraft("requestUpdatePack", value)} />
          </section>

          <div className="flex flex-wrap gap-2 border-t border-zinc-200 pt-4 dark:border-zinc-800">
            <button type="submit" disabled={busy === "export" || !draft.campaignId} className={primaryButtonClass}>
              {busy === "export" ? "Genero..." : "Genera pacchetto"}
            </button>
            <button type="button" onClick={reset} className={secondaryButtonClass}>Pulisci</button>
          </div>
        </form>

        <section className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold">Anteprima markdown</h2>
              <p className="text-xs text-zinc-500">
                {exportResult ? `${exportResult.estimatedCharacters.toLocaleString("it-IT")} caratteri - ${exportResult.filename}` : "Genera un pacchetto per vedere l'anteprima."}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={copyMarkdown} disabled={!exportResult} className={secondaryButtonClass}>Copia</button>
              <button type="button" onClick={downloadMarkdown} disabled={!exportResult} className={secondaryButtonClass}>Scarica .md</button>
            </div>
          </header>
          {exportResult?.warnings.length ? (
            <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              {exportResult.warnings.join(" ")}
            </div>
          ) : null}
          <pre className="min-h-[520px] overflow-auto whitespace-pre-wrap p-4 text-xs leading-5 text-zinc-700 dark:text-zinc-200">
            {exportResult?.markdown ?? "Nessun pacchetto generato."}
          </pre>
        </section>
      </div>
      ) : null}

      <section id="import" className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <header>
          <h2 className="text-lg font-semibold">Import risposta ChatGPT</h2>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Incolla l&apos;output prodotto via web, analizza l&apos;UPDATE PACK e applica solo le modifiche selezionate.
          </p>
        </header>
        {mode === "import-only" ? (
          <Field label="Campagna">
            <select
              value={draft.campaignId}
              onChange={(e) => updateDraft("campaignId", e.target.value)}
              className={controlClass}
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
          </Field>
        ) : null}
        <textarea
          rows={10}
          value={importContent}
          onChange={(event) => setImportContent(event.target.value)}
          className={textareaClass}
          placeholder="Incolla qui l'output ChatGPT..."
        />
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={appendToPrepNotes}
            onChange={(event) => setAppendToPrepNotes(event.target.checked)}
          />
          <span>Appendi anche alle prep_notes della sessione rilevata/selezionata</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
          checked={createSessionIfMissing}
            disabled={!appendToPrepNotes && !appendToDmNotes}
            onChange={(event) => setCreateSessionIfMissing(event.target.checked)}
          />
          <span>Crea la sessione se manca</span>
        </label>
        <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
          <input
            type="checkbox"
            checked={appendToDmNotes}
            onChange={(event) => setAppendToDmNotes(event.target.checked)}
          />
          <span>Appendi alle dm_notes come debrief post-sessione</span>
        </label>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={analyzeImport} disabled={busy === "analyze" || !importContent.trim()} className={primaryButtonClass}>Analizza output</button>
          <button type="button" onClick={saveImport} disabled={busy === "save" || !importContent.trim()} className={secondaryButtonClass}>Salva come documento</button>
          <button type="button" onClick={reviewUpdatePack} disabled={!analyzeResult?.updatePack || busy === "review"} className={secondaryButtonClass}>Review & Apply</button>
          <button type="button" onClick={() => setImportContent("")} className={secondaryButtonClass}>Annulla</button>
        </div>

        {analyzeResult && (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
              <h3 className="font-semibold">Analisi</h3>
              <dl className="mt-2 space-y-1 text-xs text-zinc-600 dark:text-zinc-300">
                <div>Titolo: {analyzeResult.detectedTitle ?? "non rilevato"}</div>
                <div>Sessione: {analyzeResult.detectedSessionNumber ?? "non rilevata"}</div>
                <div>UPDATE PACK: {analyzeResult.hasUpdatePack ? "presente" : "assente"}</div>
                {analyzeResult.warnings.map((warning) => <div key={warning}>Warning: {warning}</div>)}
              </dl>
            </div>
            <pre className="max-h-56 overflow-auto rounded-md border border-zinc-200 p-3 text-xs dark:border-zinc-800">
              {JSON.stringify(analyzeResult.updatePack ?? {}, null, 2)}
            </pre>
          </div>
        )}

        {analyzeResult?.canonDiff ? (
          <CanonDiffPanel diff={analyzeResult.canonDiff} />
        ) : null}

        {reviewChanges.length > 0 && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Modifiche candidate</h3>
                <p className="text-xs text-zinc-500">
                  {selectedChanges.size} selezionate su {reviewChanges.length}.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedChanges(new Set(reviewChanges.map((_, index) => index)))}
                  className={secondaryButtonClass}
                >
                  Seleziona tutto
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedChanges(new Set())}
                  className={secondaryButtonClass}
                >
                  Deseleziona
                </button>
              </div>
            </div>
            {reviewWarnings.length > 0 ? (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
                <div className="font-semibold">Warning review</div>
                <ul className="mt-1 list-disc space-y-1 pl-4">
                  {reviewWarnings.map((warning) => (
                    <li key={warning} className="flex flex-wrap items-center gap-2">
                      <ReviewWarningBadge warning={warning} />
                      <span>{warning}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
              {reviewChanges.map((change, index) => (
                <li key={`${change.kind}-${index}`} className="flex gap-3 p-3 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedChanges.has(index)}
                    onChange={() => toggleSelected(index, setSelectedChanges)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{change.label}</span>
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        {kindLabel(change.kind)}
                      </span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskClass(change.kind)}`}>
                        {riskLabel(change.kind)}
                      </span>
                      {change.match ? <MatchBadge match={change.match} /> : null}
                      {isHighRiskChange(change) ? (
                        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 ring-1 ring-red-600/20 dark:bg-red-950 dark:text-red-300">
                          alto rischio
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      Target: {targetLabel(change)}
                    </div>
                    <details className="mt-2 rounded-md border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-950">
                      <summary className="cursor-pointer text-xs font-medium text-zinc-600 dark:text-zinc-300">
                        Diff / payload
                      </summary>
                      <div className="mt-2 grid gap-2 lg:grid-cols-3">
                        {"before" in change ? (
                          <ReviewJson title="Prima" value={change.before} />
                        ) : null}
                        {"after" in change ? (
                          <ReviewJson title="Dopo" value={change.after} />
                        ) : null}
                        <ReviewJson title="Apply payload" value={change.applyPayload} />
                      </div>
                    </details>
                  </div>
                </li>
              ))}
            </ul>
            {selectedHighRiskCount > 0 ? (
              <label className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100">
                <input
                  type="checkbox"
                  checked={confirmHighRisk}
                  onChange={(event) => setConfirmHighRisk(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  Confermo l&apos;apply di {selectedHighRiskCount} modifiche ad alto rischio:
                  update di canon esistente, segreti, identita o link GM-sensitive.
                </span>
              </label>
            ) : null}
            <button
              type="button"
              onClick={applySelected}
              disabled={
                busy === "apply" ||
                selectedChanges.size === 0 ||
                (selectedHighRiskCount > 0 && !confirmHighRisk)
              }
              className={primaryButtonClass}
            >
              Applica selezionate
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

function exportPayload(draft: ExportDraft) {
  return {
    campaignId: draft.campaignId,
    taskType: draft.taskType,
    density: draft.density,
    audience: draft.audience,
    sessionNumber: numberOrUndefined(draft.sessionNumber),
    focus: optionalText(draft.focus),
    locationId: optionalText(draft.locationId),
    expectedDurationHours: numberOrUndefined(draft.expectedDurationHours),
    constraints: optionalText(draft.constraints),
    includeSystemPrompt: draft.includeSystemPrompt,
    includeCampaignSnapshot: draft.includeCampaignSnapshot,
    includeRecentSessions: draft.includeRecentSessions,
    recentSessionsLimit: Number(draft.recentSessionsLimit || 5),
    includePlotThreads: draft.includePlotThreads,
    includeTruthClues: draft.includeTruthClues,
    includeSecrets: draft.audience === "player" ? false : draft.includeSecrets,
    includePcHooks: draft.includePcHooks,
    includeFactions: draft.includeFactions,
    includePlayerFacingState: draft.includePlayerFacingState,
    requestUpdatePack: draft.requestUpdatePack,
  };
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1">
      <span className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">{label}</span>
      {children}
    </label>
  );
}

function Checkbox({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-200">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function ReviewJson({ title, value }: { title: string; value: unknown }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      <pre className="max-h-48 overflow-auto rounded border border-zinc-200 bg-white p-2 text-[11px] leading-4 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function CanonDiffPanel({
  diff,
}: {
  diff: NonNullable<AnalyzeResponse["canonDiff"]>;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Canon Diff</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Confronto con {diff.comparedTo}
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        {diff.sections.map((section) => (
          <div
            key={section.label}
            className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between gap-2">
              <h4 className="text-xs font-semibold uppercase tracking-wide">
                {section.label}
              </h4>
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                {Math.round(section.similarity * 100)}%
              </span>
            </div>
            <DiffList title="Nuovo import" rows={section.added} tone="plus" />
            <DiffList title="Solo canon attuale" rows={section.removed} tone="minus" />
          </div>
        ))}
      </div>
    </div>
  );
}

function DiffList({
  title,
  rows,
  tone,
}: {
  title: string;
  rows: string[];
  tone: "plus" | "minus";
}) {
  return (
    <div className="mt-3">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
        {title}
      </div>
      {rows.length === 0 ? (
        <p className="mt-1 text-xs italic text-zinc-400">Nessuna differenza.</p>
      ) : (
        <ul className="mt-1 max-h-40 space-y-1 overflow-auto text-xs">
          {rows.map((row, index) => (
            <li
              key={`${tone}-${index}-${row}`}
              className={
                tone === "plus"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-amber-700 dark:text-amber-300"
              }
            >
              {tone === "plus" ? "+ " : "- "}
              {row}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function MatchBadge({ match }: { match: NonNullable<ReviewChange["match"]> }) {
  const title = [
    `${match.subject}: ${match.requested}`,
    match.matched ? `-> ${match.matched}` : null,
    match.matchedBy && match.matchedBy !== match.matched
      ? `(via ${match.matchedBy})`
      : null,
    typeof match.score === "number" ? `score ${match.score}` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      title={title}
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${matchClass(match.status)}`}
    >
      {matchLabel(match.status)}
    </span>
  );
}

function ReviewWarningBadge({ warning }: { warning: string }) {
  const status = warning.includes("ambiguo")
    ? "ambiguous"
    : warning.includes("match fuzzy")
      ? "fuzzy"
      : warning.includes("non trovato")
        ? "none"
        : null;
  return status ? (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ring-inset ${matchClass(status)}`}
    >
      {matchLabel(status)}
    </span>
  ) : null;
}

function toggleSelected(index: number, setter: React.Dispatch<React.SetStateAction<Set<number>>>) {
  setter((current) => {
    const next = new Set(current);
    if (next.has(index)) next.delete(index);
    else next.add(index);
    return next;
  });
}

function numberOrUndefined(value: string) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function optionalText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

function kindLabel(kind: ReviewChange["kind"]) {
  switch (kind) {
    case "session_update":
      return "Sessione";
    case "plot_thread_event_create":
      return "Plot";
    case "truth_clue_create":
      return "Briciola";
    case "entity_update":
      return "Entity";
    case "pc_hook_create":
      return "Hook";
    case "entity_identity_create":
      return "Identita";
    case "entity_secret_create":
      return "Segreto";
    case "entity_link_create":
      return "Link";
  }
}

function riskLabel(kind: ReviewChange["kind"]) {
  return kind === "entity_update" || kind === "session_update"
    ? "modifica"
    : "creazione";
}

function riskClass(kind: ReviewChange["kind"]) {
  return kind === "entity_update" || kind === "session_update"
    ? "bg-amber-50 text-amber-700 ring-1 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300"
    : "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300";
}

function isHighRiskChange(change: ReviewChange) {
  return (
    change.kind === "session_update" ||
    change.kind === "entity_update" ||
    change.kind === "entity_identity_create" ||
    change.kind === "entity_secret_create" ||
    change.kind === "entity_link_create"
  );
}

function matchLabel(status: NonNullable<ReviewChange["match"]>["status"]) {
  switch (status) {
    case "exact":
      return "match esatto";
    case "fuzzy":
      return "match fuzzy";
    case "ambiguous":
      return "ambiguo";
    case "none":
      return "non trovato";
  }
}

function matchClass(status: NonNullable<ReviewChange["match"]>["status"]) {
  switch (status) {
    case "exact":
      return "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-950 dark:text-emerald-300";
    case "fuzzy":
      return "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-950 dark:text-sky-300";
    case "ambiguous":
      return "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-950 dark:text-amber-300";
    case "none":
      return "bg-zinc-100 text-zinc-700 ring-zinc-600/20 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function targetLabel(change: ReviewChange) {
  const payload = asRecord(change.applyPayload);
  switch (change.kind) {
    case "session_update":
      return payload.number ? `sessione ${String(payload.number)}` : "sessione";
    case "plot_thread_event_create":
      return payload.plotThreadId ? `plot ${String(payload.plotThreadId)}` : "plot";
    case "truth_clue_create":
      return payload.description ? String(payload.description).slice(0, 80) : "briciola";
    case "entity_update":
      return payload.entityId ? `entity ${String(payload.entityId)}` : "entity";
    case "pc_hook_create":
      return payload.targetEntityId
        ? `hook verso ${String(payload.targetEntityId)}`
        : "hook";
    case "entity_identity_create":
      return payload.entityId ? `entity ${String(payload.entityId)}` : "identita";
    case "entity_secret_create":
      return (
        String(payload.entityId ?? payload.plotThreadId ?? payload.content ?? "segreto").slice(
          0,
          80,
        )
      );
    case "entity_link_create":
      return payload.targetEntityId
        ? `link verso ${String(payload.targetEntityId)}`
        : "link";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      message = body.error?.message ?? message;
    } catch {
      // not JSON
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

function messageForError(err: unknown) {
  return err instanceof Error ? err.message : String(err);
}

const controlClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const textareaClass =
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950";
const primaryButtonClass =
  "h-10 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white";
const secondaryButtonClass =
  "h-10 rounded-md border border-zinc-300 px-4 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-800";
