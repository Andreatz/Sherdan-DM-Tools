"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import type {
  DungeonContentResult,
  DungeonRoomContent,
} from "@/lib/dungeons/content-schema";
import type {
  DungeonMapData,
  DungeonRoom,
  DungeonRoomKind,
} from "@/lib/dungeons/schema";

interface CampaignSummary {
  id: string;
  name: string;
}

interface FormState {
  roomCount: number;
  gridWidth: number;
  gridHeight: number;
  minRoomSize: number;
  maxRoomSize: number;
  seed: number;
  theme: string;
}

const DEFAULT_FORM: FormState = {
  roomCount: 15,
  gridWidth: 64,
  gridHeight: 44,
  minRoomSize: 4,
  maxRoomSize: 10,
  seed: 1,
  theme: "fortezza Obsidium",
};

const ROOM_KIND_COLORS: Record<DungeonRoomKind, { fill: string; stroke: string; label: string }> = {
  entry: { fill: "#34d399", stroke: "#065f46", label: "Ingresso" },
  standard: { fill: "#a1a1aa", stroke: "#3f3f46", label: "Stanza" },
  boss: { fill: "#f87171", stroke: "#991b1b", label: "Boss" },
  treasure: { fill: "#fbbf24", stroke: "#92400e", label: "Tesoro" },
  trick: { fill: "#c084fc", stroke: "#6b21a8", label: "Trick/Puzzle" },
};

export function DungeonGenerator({
  llmDisabled = false,
}: {
  llmDisabled?: boolean;
}) {
  const [form, setForm] = useState<FormState>(DEFAULT_FORM);
  const [dungeon, setDungeon] = useState<DungeonMapData | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignId, setCampaignId] = useState<string>("");
  const [content, setContent] = useState<DungeonRoomContent[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [rerollingRoomId, setRerollingRoomId] = useState<string | null>(null);
  const [styleEntitiesAnalyzed, setStyleEntitiesAnalyzed] = useState<number>(0);

  const [dungeonName, setDungeonName] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedRootId, setSavedRootId] = useState<string | null>(null);
  const [savedEncounterCount, setSavedEncounterCount] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/campaigns")
      .then((response) => (response.ok ? response.json() : []))
      .then((rows: unknown) => {
        if (cancelled || !Array.isArray(rows)) return;
        const summaries: CampaignSummary[] = rows
          .map((row) => {
            if (
              row &&
              typeof row === "object" &&
              "id" in row &&
              "name" in row &&
              typeof (row as { id: unknown }).id === "string" &&
              typeof (row as { name: unknown }).name === "string"
            ) {
              return {
                id: (row as { id: string }).id,
                name: (row as { name: string }).name,
              };
            }
            return null;
          })
          .filter((value): value is CampaignSummary => value !== null);
        setCampaigns(summaries);
      })
      .catch(() => {
        // Ignora: il selector campagna e' opzionale, non bloccare lo strumento.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/dungeons/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = (await response.json()) as
        | { dungeon: DungeonMapData }
        | { error: { message: string } };
      if (!response.ok) {
        const message = "error" in body ? body.error.message : "Errore generazione";
        throw new Error(message);
      }
      if ("dungeon" in body) {
        setDungeon(body.dungeon);
        setSelectedRoomId(null);
        // Layout nuovo -> content invalidato + save reset.
        setContent([]);
        setContentError(null);
        setStyleEntitiesAnalyzed(0);
        setSavedRootId(null);
        setSavedEncounterCount(0);
        setSaveError(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Errore generazione");
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateContent(targetRoomIds?: string[]) {
    if (!dungeon) return;
    if (llmDisabled) {
      setContentError("LLM server-side disabilitato. Usa ChatGPT Bridge.");
      return;
    }
    const isReroll = Boolean(targetRoomIds && targetRoomIds.length > 0);
    if (isReroll && targetRoomIds) {
      setRerollingRoomId(targetRoomIds[0] ?? null);
    } else {
      setContentLoading(true);
    }
    setContentError(null);
    try {
      const response = await fetch("/api/dungeons/content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dungeon,
          campaignId: campaignId || undefined,
          targetRoomIds,
          existingContent: isReroll ? content : undefined,
        }),
      });
      const body = (await response.json()) as
        | DungeonContentResult
        | { error: { message: string } };
      if (!response.ok) {
        const message =
          "error" in body ? body.error.message : "Errore generazione contenuto";
        throw new Error(message);
      }
      if ("rooms" in body) {
        setContent(body.rooms);
        setStyleEntitiesAnalyzed(body.metadata.styleEntitiesAnalyzed);
      }
    } catch (err) {
      setContentError(
        err instanceof Error ? err.message : "Errore generazione contenuto",
      );
    } finally {
      setContentLoading(false);
      setRerollingRoomId(null);
    }
  }

  async function handleSaveToWiki() {
    if (!dungeon || !campaignId || content.length === 0) return;
    setSaving(true);
    setSaveError(null);
    try {
      const response = await fetch("/api/dungeons/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          name: dungeonName.trim() || `Dungeon ${dungeon.params.theme}`,
          dungeon,
          content,
        }),
      });
      const body = (await response.json()) as
        | {
            rootEntityId: string;
            roomEntityIds: Array<{ roomId: string; entityId: string }>;
            encounterIds: Array<{ roomId: string; encounterId: string }>;
          }
        | { error: { message: string } };
      if (!response.ok) {
        const message =
          "error" in body ? body.error.message : "Errore salvataggio";
        throw new Error(message);
      }
      if ("rootEntityId" in body) {
        setSavedRootId(body.rootEntityId);
        setSavedEncounterCount(body.encounterIds.length);
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Errore salvataggio");
    } finally {
      setSaving(false);
    }
  }

  function handleRoll() {
    const next = Math.floor(Math.random() * 1_000_000);
    setForm((prev) => ({ ...prev, seed: next }));
  }

  const selectedRoom =
    dungeon?.rooms.find((room) => room.id === selectedRoomId) ?? null;
  const selectedRoomContent =
    content.find((entry) => entry.roomId === selectedRoomId) ?? null;

  return (
    <div className="flex h-full flex-col gap-4 p-6">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight">
          Procedural Dungeon Generator
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Layout BSP deterministico, contenuto LLM per stanza con
          StyleCalibrator opzionale, e salvataggio come grafo di entity
          (root location + room children + encounter draft) nel Wiki.
        </p>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[260px_1fr_320px]">
        <ParametersPanel
          form={form}
          loading={loading}
          campaigns={campaigns}
          campaignId={campaignId}
          onCampaignChange={setCampaignId}
          contentLoading={contentLoading}
          canGenerateContent={Boolean(dungeon)}
          hasContent={content.length > 0}
          styleEntitiesAnalyzed={styleEntitiesAnalyzed}
          dungeonName={dungeonName}
          onDungeonNameChange={setDungeonName}
          saving={saving}
          saveError={saveError}
          savedRootId={savedRootId}
          savedEncounterCount={savedEncounterCount}
          canSave={
            Boolean(dungeon) && content.length > 0 && campaignId !== ""
          }
          onChange={(patch) => setForm((prev) => ({ ...prev, ...patch }))}
          onGenerate={handleGenerate}
          onRollSeed={handleRoll}
          onGenerateContent={() => handleGenerateContent()}
          llmDisabled={llmDisabled}
          onSaveToWiki={handleSaveToWiki}
        />

        <MapPanel
          dungeon={dungeon}
          error={error}
          selectedRoomId={selectedRoomId}
          onSelectRoom={setSelectedRoomId}
          contentByRoomId={content}
        />

        <RoomDetailPanel
          dungeon={dungeon}
          room={selectedRoom}
          roomContent={selectedRoomContent}
          contentError={contentError}
          rerolling={rerollingRoomId === selectedRoomId}
          canReroll={Boolean(dungeon && content.length > 0 && selectedRoom)}
          llmDisabled={llmDisabled}
          onReroll={() =>
            selectedRoom && handleGenerateContent([selectedRoom.id])
          }
        />
      </div>
    </div>
  );
}

interface ParametersPanelProps {
  form: FormState;
  loading: boolean;
  campaigns: CampaignSummary[];
  campaignId: string;
  contentLoading: boolean;
  canGenerateContent: boolean;
  hasContent: boolean;
  styleEntitiesAnalyzed: number;
  dungeonName: string;
  saving: boolean;
  saveError: string | null;
  savedRootId: string | null;
  savedEncounterCount: number;
  canSave: boolean;
  onCampaignChange: (id: string) => void;
  onDungeonNameChange: (value: string) => void;
  onChange: (patch: Partial<FormState>) => void;
  onGenerate: () => void;
  onRollSeed: () => void;
  onGenerateContent: () => void;
  llmDisabled: boolean;
  onSaveToWiki: () => void;
}

function ParametersPanel({
  form,
  loading,
  campaigns,
  campaignId,
  contentLoading,
  canGenerateContent,
  hasContent,
  styleEntitiesAnalyzed,
  dungeonName,
  saving,
  saveError,
  savedRootId,
  savedEncounterCount,
  canSave,
  onCampaignChange,
  onDungeonNameChange,
  onChange,
  onGenerate,
  onRollSeed,
  onGenerateContent,
  llmDisabled,
  onSaveToWiki,
}: ParametersPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Parametri
      </h2>
      <div className="mt-3 space-y-3">
        <NumberField
          label="Numero stanze (target)"
          min={4}
          max={40}
          value={form.roomCount}
          onChange={(roomCount) => onChange({ roomCount })}
        />
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Larghezza griglia"
            min={20}
            max={200}
            value={form.gridWidth}
            onChange={(gridWidth) => onChange({ gridWidth })}
          />
          <NumberField
            label="Altezza griglia"
            min={20}
            max={200}
            value={form.gridHeight}
            onChange={(gridHeight) => onChange({ gridHeight })}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <NumberField
            label="Stanza min"
            min={3}
            max={20}
            value={form.minRoomSize}
            onChange={(minRoomSize) => onChange({ minRoomSize })}
          />
          <NumberField
            label="Stanza max"
            min={4}
            max={40}
            value={form.maxRoomSize}
            onChange={(maxRoomSize) => onChange({ maxRoomSize })}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Seed
          </label>
          <div className="mt-1 flex gap-2">
            <input
              type="number"
              min={0}
              value={form.seed}
              onChange={(event) =>
                onChange({ seed: Number(event.target.value) || 0 })
              }
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
            />
            <button
              type="button"
              onClick={onRollSeed}
              className="rounded border border-zinc-300 px-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
              title="Seed random"
            >
              &#x21bb;
            </button>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Tema (sara&apos; usato dallo slice 2)
          </label>
          <input
            type="text"
            value={form.theme}
            onChange={(event) => onChange({ theme: event.target.value })}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>
        <button
          type="button"
          onClick={onGenerate}
          disabled={loading}
          className="w-full rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {loading ? "Generazione..." : "Genera layout"}
        </button>

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Campagna (per StyleCalibrator, opzionale)
          </label>
          <select
            value={campaignId}
            onChange={(event) => onCampaignChange(event.target.value)}
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          >
            <option value="">— Nessuna (tema solo) —</option>
            {campaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>
          {hasContent && campaignId && (
            <p className="mt-1 text-[10px] text-zinc-500 dark:text-zinc-400">
              {styleEntitiesAnalyzed} entita&apos; analizzate per lo style profile.
            </p>
          )}
        </div>

        {llmDisabled ? (
          <Link
            href="/chatgpt-bridge"
            className="block w-full rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-center text-sm font-medium text-emerald-800 transition-colors hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            Prepara pacchetto ChatGPT
          </Link>
        ) : (
          <button
            type="button"
            onClick={onGenerateContent}
            disabled={!canGenerateContent || contentLoading}
            className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            {contentLoading
              ? "LLM..."
              : hasContent
                ? "Rigenera tutto"
                : "Genera contenuti LLM"}
          </button>
        )}

        <hr className="border-zinc-200 dark:border-zinc-800" />

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
            Nome dungeon (per il Wiki)
          </label>
          <input
            type="text"
            value={dungeonName}
            onChange={(event) => onDungeonNameChange(event.target.value)}
            placeholder="Es. Cripta sotto Tharros"
            className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
          />
        </div>

        {saveError && (
          <p className="rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
            {saveError}
          </p>
        )}

        {savedRootId && campaignId && (
          <div className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            Salvato. {savedEncounterCount > 0 && `${savedEncounterCount} encounter draft creati. `}
            <a
              className="underline"
              href={`/campaigns/${campaignId}?focus=${savedRootId}#entity-detail`}
            >
              Apri nel Wiki
            </a>
          </div>
        )}

        <button
          type="button"
          onClick={onSaveToWiki}
          disabled={!canSave || saving}
          className="w-full rounded-md bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-emerald-700 dark:hover:bg-emerald-600"
          title={
            !canSave
              ? "Seleziona una campagna e genera i contenuti LLM per abilitare il salvataggio"
              : undefined
          }
        >
          {saving
            ? "Salvataggio..."
            : savedRootId
              ? "Salva di nuovo"
              : "Salva nel Wiki"}
        </button>
      </div>
    </section>
  );
}

interface NumberFieldProps {
  label: string;
  min: number;
  max: number;
  value: number;
  onChange: (value: number) => void;
}

function NumberField({ label, min, max, value, onChange }: NumberFieldProps) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-zinc-600 dark:text-zinc-300">
        {label}
      </span>
      <input
        type="number"
        min={min}
        max={max}
        value={value}
        onChange={(event) => onChange(Number(event.target.value) || min)}
        className="mt-1 w-full rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-950"
      />
    </label>
  );
}

interface MapPanelProps {
  dungeon: DungeonMapData | null;
  error: string | null;
  selectedRoomId: string | null;
  onSelectRoom: (id: string | null) => void;
  contentByRoomId: DungeonRoomContent[];
}

function MapPanel({
  dungeon,
  error,
  selectedRoomId,
  onSelectRoom,
  contentByRoomId,
}: MapPanelProps) {
  const contentSet = new Set(contentByRoomId.map((entry) => entry.roomId));
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Mappa
        </h2>
        {dungeon && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {dungeon.rooms.length} stanze, {dungeon.edges.length} corridoi · griglia{" "}
            {dungeon.grid.width}×{dungeon.grid.height} · tema:{" "}
            <span className="font-medium text-zinc-700 dark:text-zinc-200">
              {dungeon.params.theme}
            </span>
          </p>
        )}
      </header>

      {error && (
        <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!dungeon ? (
        <div className="mt-4 flex h-[480px] items-center justify-center rounded border border-dashed border-zinc-300 text-sm text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
          Configura i parametri e premi &quot;Genera layout&quot;.
        </div>
      ) : (
        <DungeonSvg
          dungeon={dungeon}
          selectedRoomId={selectedRoomId}
          onSelectRoom={onSelectRoom}
          contentSet={contentSet}
        />
      )}

      <Legend />
    </section>
  );
}

interface DungeonSvgProps {
  dungeon: DungeonMapData;
  selectedRoomId: string | null;
  onSelectRoom: (id: string | null) => void;
  contentSet: Set<string>;
}

function DungeonSvg({
  dungeon,
  selectedRoomId,
  onSelectRoom,
  contentSet,
}: DungeonSvgProps) {
  const { grid, rooms, edges } = dungeon;
  return (
    <div className="mt-3 overflow-hidden rounded border border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-950">
      <svg
        viewBox={`0 0 ${grid.width} ${grid.height}`}
        className="h-auto w-full"
        role="img"
        aria-label="Mappa dungeon generata"
      >
        {/* Background grid lines, leggera */}
        <defs>
          <pattern
            id="dungeon-grid"
            width={1}
            height={1}
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 1 0 L 0 0 0 1"
              fill="none"
              stroke="#e4e4e7"
              strokeWidth={0.04}
            />
          </pattern>
        </defs>
        <rect width={grid.width} height={grid.height} fill="url(#dungeon-grid)" />

        {/* Corridoi sotto le stanze cosi' il bordo della stanza copre i raccordi */}
        <g>
          {edges.map((edge) => (
            <polyline
              key={edge.id}
              points={edge.path.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke="#52525b"
              strokeWidth={0.6}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.7}
            />
          ))}
        </g>

        <g>
          {rooms.map((room) => (
            <RoomShape
              key={room.id}
              room={room}
              selected={room.id === selectedRoomId}
              hasContent={contentSet.has(room.id)}
              onClick={() =>
                onSelectRoom(room.id === selectedRoomId ? null : room.id)
              }
            />
          ))}
        </g>
      </svg>
    </div>
  );
}

interface RoomShapeProps {
  room: DungeonRoom;
  selected: boolean;
  hasContent: boolean;
  onClick: () => void;
}

function RoomShape({ room, selected, hasContent, onClick }: RoomShapeProps) {
  const colors = ROOM_KIND_COLORS[room.kind];
  return (
    <g onClick={onClick} className="cursor-pointer">
      <rect
        x={room.x}
        y={room.y}
        width={room.w}
        height={room.h}
        fill={colors.fill}
        stroke={selected ? "#0f172a" : colors.stroke}
        strokeWidth={selected ? 0.4 : 0.2}
        opacity={selected ? 1 : 0.92}
      />
      <text
        x={room.centerX}
        y={room.centerY}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={1.4}
        className="pointer-events-none fill-zinc-900 font-semibold"
      >
        {labelFor(room)}
      </text>
      {hasContent && (
        // Indicatore "stanza con contenuto LLM": piccolo dot nell'angolo
        // in alto a destra del bounding box.
        <circle
          cx={room.x + room.w - 0.6}
          cy={room.y + 0.6}
          r={0.45}
          fill="#0ea5e9"
          stroke="#0c4a6e"
          strokeWidth={0.1}
          className="pointer-events-none"
        />
      )}
    </g>
  );
}

function labelFor(room: DungeonRoom): string {
  if (room.kind === "entry") return "IN";
  if (room.kind === "boss") return "BOSS";
  if (room.kind === "treasure") return "T";
  if (room.kind === "trick") return "?";
  // Standard: id finale numerico se disponibile.
  const match = /room-(\d+)/.exec(room.id);
  return match ? match[1] ?? "" : "";
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-300">
      {(Object.keys(ROOM_KIND_COLORS) as DungeonRoomKind[]).map((kind) => {
        const colors = ROOM_KIND_COLORS[kind];
        return (
          <span key={kind} className="inline-flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="size-3 rounded-sm"
              style={{ backgroundColor: colors.fill, border: `1px solid ${colors.stroke}` }}
            />
            {colors.label}
          </span>
        );
      })}
    </div>
  );
}

interface RoomDetailPanelProps {
  dungeon: DungeonMapData | null;
  room: DungeonRoom | null;
  roomContent: DungeonRoomContent | null;
  contentError: string | null;
  rerolling: boolean;
  canReroll: boolean;
  llmDisabled: boolean;
  onReroll: () => void;
}

function RoomDetailPanel({
  dungeon,
  room,
  roomContent,
  contentError,
  rerolling,
  canReroll,
  llmDisabled,
  onReroll,
}: RoomDetailPanelProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Dettaglio stanza
      </h2>

      {contentError && (
        <p className="mt-2 rounded border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
          {contentError}
        </p>
      )}

      {!dungeon ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Genera un layout per esplorare le stanze.
        </p>
      ) : !room ? (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Clicca su una stanza nella mappa per vedere i dettagli.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm">
          <dl className="space-y-1">
            <Field label="ID" value={room.id} />
            <Field label="Tipo" value={ROOM_KIND_COLORS[room.kind].label} />
            <Field
              label="Dimensione"
              value={`${room.w} × ${room.h} celle (${room.x},${room.y})`}
            />
          </dl>

          {roomContent ? (
            <RoomContentView
              content={roomContent}
              rerolling={rerolling}
              canReroll={canReroll}
              llmDisabled={llmDisabled}
              onReroll={onReroll}
            />
          ) : (
            <p className="rounded border border-dashed border-zinc-300 px-3 py-2 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              Nessun contenuto LLM ancora. Premi &quot;Genera contenuti LLM&quot;
              nei parametri per popolare tutte le stanze, oppure rigenera
              questa singola dopo la prima generazione.
            </p>
          )}
        </div>
      )}
    </section>
  );
}

interface RoomContentViewProps {
  content: DungeonRoomContent;
  rerolling: boolean;
  canReroll: boolean;
  llmDisabled: boolean;
  onReroll: () => void;
}

function RoomContentView({
  content,
  rerolling,
  canReroll,
  llmDisabled,
  onReroll,
}: RoomContentViewProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {content.title}
        </h3>
        {llmDisabled ? (
          <Link
            href="/chatgpt-bridge"
            className="rounded border border-emerald-300 px-2 py-0.5 text-[11px] text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950/40"
          >
            ChatGPT Bridge
          </Link>
        ) : (
          <button
            type="button"
            onClick={onReroll}
            disabled={!canReroll || rerolling}
            className="rounded border border-zinc-300 px-2 py-0.5 text-[11px] text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {rerolling ? "..." : "Rigenera"}
          </button>
        )}
      </div>
      <ContentSection label="Descrizione (player-facing)" body={content.description} />
      <ContentSection label="Encounter" body={content.encounterHook} />
      <ContentSection label="Trappola" body={content.trap} />
      <ContentSection label="Tesoro" body={content.treasure} />
      <ContentSection label="Lore" body={content.lore} />
      <ContentSection label="Note GM" body={content.gmNotes} highlight />
    </div>
  );
}

function ContentSection({
  label,
  body,
  highlight = false,
}: {
  label: string;
  body: string | null;
  highlight?: boolean;
}) {
  if (!body) return null;
  return (
    <div
      className={`rounded border px-3 py-2 text-xs ${
        highlight
          ? "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200"
          : "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <p className="mt-1 whitespace-pre-wrap leading-relaxed">{body}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </dt>
      <dd className="text-right text-zinc-700 dark:text-zinc-200">{value}</dd>
    </div>
  );
}
