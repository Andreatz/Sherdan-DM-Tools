"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";

import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary";
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import {
  $createRangeSelection,
  $createParagraphNode,
  $createTextNode,
  $getSelection,
  $getRoot,
  $isRangeSelection,
  $setSelection,
  type ElementNode,
  type EditorConfig,
  type LexicalEditor,
  type LexicalNode,
  type NodeKey,
  type SerializedTextNode,
  type Spread,
  TextNode,
} from "lexical";

type MarkdownField = "description" | "publicDescription";
type EntityType =
  | "npc"
  | "pc"
  | "location"
  | "faction"
  | "item"
  | "monster"
  | "deity"
  | "organization";

interface WikiMarkdownEditorProps {
  campaignId: string;
  entityId: string;
  field: MarkdownField;
  label: string;
  initialMarkdown: string | null;
  entityPreviews: EntityPreview[];
}

interface EntitySuggestion {
  id: string;
  name: string;
  type: EntityType;
}

interface EntityPreview extends EntitySuggestion {
  publicDescription: string | null;
}

interface WikiLinkTrigger {
  query: string;
  anchorKey: string;
  startOffset: number;
  endOffset: number;
}

interface QuickCreateRequest {
  name: string;
  trigger: WikiLinkTrigger;
}

type SerializedWikiLinkNode = Spread<
  {
    type: "wiki-link";
    version: 1;
  },
  SerializedTextNode
>;

function createWikiLinkRegex() {
  return /\[\[([^\]\[\n]{1,200})\]\]/g;
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

const CREATE_TYPE_OPTIONS: EntityType[] = [
  "npc",
  "location",
  "faction",
  "organization",
  "item",
  "pc",
  "deity",
  "monster",
];

function getStubProperties(type: EntityType): Record<string, unknown> {
  switch (type) {
    case "npc":
      return { race: "Da definire", appearance_summary: "Da definire" };
    case "pc":
      return { race: "Da definire", class: "Da definire", level: 1 };
    case "location":
      return {
        kind: "settlement",
        atmosphere: {},
        notable_features: [],
        services: [],
      };
    case "faction":
      return { methods: [], goals: {}, territory_ids: [], member_ids: [] };
    case "item":
      return { kind: "trinket", attunement: false, effects: [], crafted_from: [] };
    case "monster":
      return {
        size: "medium",
        creature_type: "unknown",
        ac: 10,
        hp_average: 1,
        speed: { walk: 30 },
        abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
        damage_resistances: [],
        damage_immunities: [],
        damage_vulnerabilities: [],
        condition_immunities: [],
        senses: [],
        languages: [],
        challenge_rating: "0",
        traits: [],
        actions: [],
        environment: [],
      };
    case "deity":
      return { domains: [], holy_days: [] };
    case "organization":
      return {
        kind: "guild",
        methods: [],
        territory_ids: [],
        member_ids: [],
        benefits: [],
      };
  }
}

function isEntitySuggestion(value: unknown): value is EntitySuggestion {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.type === "string" &&
    CREATE_TYPE_OPTIONS.includes(candidate.type as EntityType)
  );
}

function parseSuggestions(value: unknown): EntitySuggestion[] {
  return Array.isArray(value) ? value.filter(isEntitySuggestion) : [];
}

function normalizeWikiName(name: string): string {
  return name.trim().toLocaleLowerCase("it-IT");
}

function buildEntityPreviewMap(entityPreviews: EntityPreview[]) {
  return new Map(
    entityPreviews.map((entity) => [normalizeWikiName(entity.name), entity]),
  );
}

export class WikiLinkNode extends TextNode {
  static getType(): string {
    return "wiki-link";
  }

  static clone(node: WikiLinkNode): WikiLinkNode {
    return new WikiLinkNode(node.__text, node.__key);
  }

  static importJSON(serializedNode: SerializedWikiLinkNode): WikiLinkNode {
    const node = $createWikiLinkNode(serializedNode.text);
    node.setFormat(serializedNode.format);
    node.setDetail(serializedNode.detail);
    node.setMode(serializedNode.mode);
    node.setStyle(serializedNode.style);
    return node;
  }

  constructor(text: string, key?: NodeKey) {
    super(text, key);
  }

  exportJSON(): SerializedWikiLinkNode {
    return {
      ...super.exportJSON(),
      type: "wiki-link",
      version: 1,
    };
  }

  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.className =
      "rounded bg-sky-50 px-1 font-medium text-sky-800 ring-1 ring-inset ring-sky-200 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900";
    return dom;
  }

  canInsertTextBefore(): boolean {
    return false;
  }

  canInsertTextAfter(): boolean {
    return false;
  }

  isTextEntity(): true {
    return true;
  }
}

function $createWikiLinkNode(text: string): WikiLinkNode {
  return new WikiLinkNode(text).setMode("token");
}

function $isWikiLinkNode(node: LexicalNode | null | undefined): node is WikiLinkNode {
  return node instanceof WikiLinkNode;
}

function appendMarkdownText(parent: ElementNode, text: string) {
  const wikilinkRe = createWikiLinkRegex();
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = wikilinkRe.exec(text)) !== null) {
    if (match.index > cursor) {
      parent.append($createTextNode(text.slice(cursor, match.index)));
    }
    parent.append($createWikiLinkNode(match[0]));
    cursor = match.index + match[0].length;
  }

  if (cursor < text.length) {
    parent.append($createTextNode(text.slice(cursor)));
  }
}

function loadMarkdown(markdown: string) {
  const root = $getRoot();
  root.clear();

  const lines = markdown.split(/\r?\n/);
  if (lines.length === 0) {
    root.append($createParagraphNode());
    return;
  }

  for (const line of lines) {
    const paragraph = $createParagraphNode();
    appendMarkdownText(paragraph, line);
    root.append(paragraph);
  }
}

function serializeMarkdown(editor: LexicalEditor): string {
  return editor.getEditorState().read(() =>
    $getRoot()
      .getChildren()
      .map((child) => child.getTextContent())
      .join("\n"),
  );
}

function WikiLinkTransformPlugin() {
  const [editor] = useLexicalComposerContext();

  useEffect(
    () =>
      editor.registerNodeTransform(TextNode, (node) => {
        if ($isWikiLinkNode(node)) return;

        const text = node.getTextContent();
        const testRe = createWikiLinkRegex();
        if (!testRe.test(text)) return;

        const wikilinkRe = createWikiLinkRegex();
        const replacement: LexicalNode[] = [];
        let cursor = 0;
        let match: RegExpExecArray | null;

        while ((match = wikilinkRe.exec(text)) !== null) {
          if (match.index > cursor) {
            replacement.push($createTextNode(text.slice(cursor, match.index)));
          }
          replacement.push($createWikiLinkNode(match[0]));
          cursor = match.index + match[0].length;
        }

        if (cursor < text.length) {
          replacement.push($createTextNode(text.slice(cursor)));
        }

        const firstNode = replacement[0];
        if (!firstNode) return;

        node.replace(firstNode);
        for (const nextNode of replacement.slice(1)) {
          firstNode.insertAfter(nextNode);
        }
      }),
    [editor],
  );

  return null;
}

function findWikiLinkTrigger(text: string, offset: number): Omit<
  WikiLinkTrigger,
  "anchorKey"
> | null {
  const beforeCursor = text.slice(0, offset);
  const openIndex = beforeCursor.lastIndexOf("[[");
  if (openIndex === -1) return null;

  const closeIndex = beforeCursor.lastIndexOf("]]");
  if (closeIndex > openIndex) return null;

  const query = beforeCursor.slice(openIndex + 2);
  if (query.includes("\n") || query.includes("[") || query.includes("]")) {
    return null;
  }

  return {
    query,
    startOffset: openIndex,
    endOffset: offset,
  };
}

function WikiLinkAutocompletePlugin({
  campaignId,
  onStatus,
}: {
  campaignId: string;
  onStatus: (status: string | null) => void;
}) {
  const router = useRouter();
  const [editor] = useLexicalComposerContext();
  const [trigger, setTrigger] = useState<WikiLinkTrigger | null>(null);
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [createType, setCreateType] = useState<EntityType>("npc");
  const [quickCreate, setQuickCreate] = useState<QuickCreateRequest | null>(
    null,
  );
  const [isCreating, startCreateTransition] = useTransition();

  useEffect(
    () =>
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
            setTrigger(null);
            return;
          }

          const anchor = selection.anchor;
          const node = anchor.getNode();
          if (!$isTextNodeLike(node)) {
            setTrigger(null);
            return;
          }

          const found = findWikiLinkTrigger(node.getTextContent(), anchor.offset);
          setTrigger(
            found
              ? {
                  ...found,
                  anchorKey: node.getKey(),
                }
              : null,
          );
        });
      }),
    [editor],
  );

  useEffect(() => {
    if (!trigger) {
      return;
    }

    const activeTrigger = trigger;
    const controller = new AbortController();

    async function loadSuggestions() {
      const params = new URLSearchParams({
        campaign_id: campaignId,
        limit: "8",
      });
      if (activeTrigger.query.trim()) {
        params.set("search", activeTrigger.query.trim());
      }

      try {
        const response = await fetch(`/api/entities?${params}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          setSuggestions([]);
          return;
        }
        const data = (await response.json()) as unknown;
        setSuggestions(parseSuggestions(data));
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setSuggestions([]);
      }
    }

    void loadSuggestions();
    return () => controller.abort();
  }, [campaignId, trigger]);

  function replaceTrigger(target: WikiLinkTrigger, name: string) {
    editor.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(target.anchorKey, target.startOffset, "text");
      selection.focus.set(target.anchorKey, target.endOffset, "text");
      $setSelection(selection);
      selection.insertText(`[[${name}]]`);
    });
    setTrigger(null);
  }

  function openQuickCreate() {
    if (!trigger) return;

    const name = trigger.query.trim();
    if (!name) return;

    setQuickCreate({ name, trigger });
  }

  function createAndInsert() {
    if (!quickCreate) return;

    onStatus(null);
    startCreateTransition(async () => {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          type: createType,
          name: quickCreate.name,
          properties: getStubProperties(createType),
          tags: [],
          visibility: "dm_only",
        }),
      });

      if (!response.ok) {
        onStatus(`Creazione fallita: HTTP ${response.status}`);
        return;
      }

      replaceTrigger(quickCreate.trigger, quickCreate.name);
      setQuickCreate(null);
      router.refresh();
      onStatus(`Creata entita' "${quickCreate.name}"`);
    });
  }

  if (!trigger && !quickCreate) return null;

  const query = trigger?.query.trim() ?? "";
  const exactMatch = trigger
    ? suggestions.some(
        (suggestion) =>
          suggestion.name.toLocaleLowerCase("it-IT") ===
          query.toLocaleLowerCase("it-IT"),
      )
    : false;

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
      {trigger && (
        <>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Wikilink
            </p>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {query ? `[[${query}]]` : "digita un nome"}
            </span>
          </div>

          {suggestions.length > 0 && (
            <div className="mb-3 grid gap-1">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion.id}
                  type="button"
                  onClick={() => replaceTrigger(trigger, suggestion.name)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-left text-sm text-zinc-800 transition-colors hover:bg-white dark:text-zinc-100 dark:hover:bg-zinc-800"
                >
                  <span className="font-medium">{suggestion.name}</span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {TYPE_LABELS[suggestion.type]}
                  </span>
                </button>
              ))}
            </div>
          )}

          {query && !exactMatch && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm text-zinc-600 dark:text-zinc-300">
                Nessuna entita&apos; esatta.
              </span>
              <button
                type="button"
                onClick={openQuickCreate}
                className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
              >
                Crea &quot;{query}&quot;
              </button>
            </div>
          )}
        </>
      )}

      {quickCreate && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="quick-create-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4"
        >
          <div className="w-full max-w-md rounded-lg border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="border-b border-zinc-200 p-4 dark:border-zinc-800">
              <h3
                id="quick-create-title"
                className="text-base font-semibold text-zinc-950 dark:text-zinc-50"
              >
                Che tipo e&apos;?
              </h3>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {quickCreate.name}
              </p>
            </div>

            <div className="space-y-3 p-4">
              <label className="block">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                  Tipo
                </span>
                <select
                  value={createType}
                  onChange={(event) =>
                    setCreateType(event.target.value as EntityType)
                  }
                  className="h-10 w-full rounded-md border border-zinc-200 bg-zinc-50 px-3 text-sm text-zinc-900 outline-none transition-colors focus:border-zinc-400 focus:bg-white dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-100 dark:focus:border-zinc-600"
                >
                  {CREATE_TYPE_OPTIONS.map((type) => (
                    <option key={type} value={type}>
                      {TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-200 p-4 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setQuickCreate(null)}
                disabled={isCreating}
                className="h-10 rounded-md border border-zinc-200 px-3 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={createAndInsert}
                disabled={isCreating}
                className="h-10 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
              >
                {isCreating ? "Creo..." : "Crea stub"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function $isTextNodeLike(node: LexicalNode): node is TextNode {
  return node instanceof TextNode;
}

function renderInlineMarkdown({
  campaignId,
  text,
  entityPreviewByName,
}: {
  campaignId: string;
  text: string;
  entityPreviewByName: Map<string, EntityPreview>;
}): ReactNode[] {
  const nodes: ReactNode[] = [];
  const tokenRe = /(`[^`]+`|\[\[[^\]\[\n]{1,200}\]\]|\*\*[^*]+\*\*|\*[^*\n]+\*)/g;
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }

    const token = match[0];
    const key = `${match.index}-${token}`;

    if (token.startsWith("[[")) {
      const name = token.slice(2, -2).trim();
      const preview = entityPreviewByName.get(normalizeWikiName(name));
      nodes.push(
        <WikiLinkPreview
          key={key}
          campaignId={campaignId}
          name={name}
          preview={preview}
        />,
      );
    } else if (token.startsWith("`")) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-zinc-100 px-1 py-0.5 text-[0.92em] text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else if (token.startsWith("*")) {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }

    cursor = match.index + token.length;
  }

  if (cursor < text.length) {
    nodes.push(text.slice(cursor));
  }

  return nodes;
}

function WikiLinkPreview({
  campaignId,
  name,
  preview,
}: {
  campaignId: string;
  name: string;
  preview: EntityPreview | undefined;
}) {
  if (!preview) {
    return (
      <span className="rounded bg-rose-50 px-1 font-medium text-rose-800 ring-1 ring-inset ring-rose-200 dark:bg-rose-950/50 dark:text-rose-200 dark:ring-rose-900">
        [[{name}]]
      </span>
    );
  }

  return (
    <span className="group relative inline-block">
      <Link
        href={`/campaigns/${campaignId}?focus=${preview.id}`}
        className="rounded bg-sky-50 px-1 font-medium text-sky-800 ring-1 ring-inset ring-sky-200 hover:bg-sky-100 dark:bg-sky-950/50 dark:text-sky-200 dark:ring-sky-900 dark:hover:bg-sky-900/70"
      >
        {name}
      </Link>
      <span className="pointer-events-none absolute left-0 top-full z-20 mt-2 hidden w-72 rounded-md border border-zinc-200 bg-white p-3 text-left text-xs leading-5 text-zinc-700 shadow-lg group-hover:block dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200">
        <span className="mb-1 flex items-center justify-between gap-2">
          <span className="font-semibold text-zinc-900 dark:text-zinc-50">
            {preview.name}
          </span>
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] uppercase text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            {TYPE_LABELS[preview.type]}
          </span>
        </span>
        <span className="block text-zinc-500 dark:text-zinc-400">
          {preview.publicDescription || "Nessuna versione pubblica."}
        </span>
      </span>
    </span>
  );
}

function WikiMarkdownPreview({
  campaignId,
  markdown,
  entityPreviews,
}: {
  campaignId: string;
  markdown: string;
  entityPreviews: EntityPreview[];
}) {
  const entityPreviewByName = useMemo(
    () => buildEntityPreviewMap(entityPreviews),
    [entityPreviews],
  );
  const lines = markdown.split(/\r?\n/);
  const blocks: ReactNode[] = [];
  let listItems: string[] = [];

  function flushList() {
    if (listItems.length === 0) return;
    const items = listItems;
    listItems = [];
    blocks.push(
      <ul key={`list-${blocks.length}`} className="my-3 list-disc space-y-1 pl-5">
        {items.map((item, index) => (
          <li key={`${index}-${item}`}>
            {renderInlineMarkdown({
              campaignId,
              text: item,
              entityPreviewByName,
            })}
          </li>
        ))}
      </ul>,
    );
  }

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    const listMatch = /^[-*]\s+(.+)$/.exec(trimmed);
    if (listMatch) {
      listItems.push(listMatch[1] ?? "");
      return;
    }

    flushList();

    const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
    if (headingMatch) {
      const level = headingMatch[1]?.length ?? 1;
      const content = headingMatch[2] ?? "";
      const className =
        level === 1
          ? "mt-5 mb-2 text-lg font-semibold"
          : level === 2
            ? "mt-4 mb-2 text-base font-semibold"
            : "mt-3 mb-1 text-sm font-semibold";
      blocks.push(
        <h4 key={`heading-${index}`} className={className}>
          {renderInlineMarkdown({
            campaignId,
            text: content,
            entityPreviewByName,
          })}
        </h4>,
      );
      return;
    }

    blocks.push(
      <p key={`paragraph-${index}`} className="my-2">
        {renderInlineMarkdown({
          campaignId,
          text: trimmed,
          entityPreviewByName,
        })}
      </p>,
    );
  });

  flushList();

  if (blocks.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400">
        Nessun markdown da renderizzare.
      </div>
    );
  }

  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm leading-7 text-zinc-800 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {blocks}
    </div>
  );
}

export function WikiMarkdownEditor({
  campaignId,
  entityId,
  field,
  label,
  initialMarkdown,
  entityPreviews,
}: WikiMarkdownEditorProps) {
  const [markdown, setMarkdown] = useState(initialMarkdown ?? "");
  const [savedMarkdown, setSavedMarkdown] = useState(initialMarkdown ?? "");
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const initialConfig = useMemo(
    () => ({
      namespace: `wiki-markdown-${entityId}-${field}`,
      nodes: [WikiLinkNode],
      onError(error: Error) {
        throw error;
      },
      editorState() {
        loadMarkdown(initialMarkdown ?? "");
      },
      theme: {
        paragraph: "mb-2 last:mb-0",
      },
    }),
    [entityId, field, initialMarkdown],
  );

  const isDirty = markdown !== savedMarkdown;

  function save() {
    setStatus(null);
    startTransition(async () => {
      const response = await fetch(`/api/entities/${entityId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: markdown }),
      });

      if (!response.ok) {
        setStatus(`Errore salvataggio: HTTP ${response.status}`);
        return;
      }

      setSavedMarkdown(markdown);
      setStatus("Salvato");
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold">{label}</h4>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            I wikilink nel formato [[Nome Entita&apos;]] diventano token nel
            testo.
          </p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!isDirty || isPending}
          className="rounded-md bg-zinc-900 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
        >
          {isPending ? "Salvo..." : "Salva"}
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <LexicalComposer initialConfig={initialConfig}>
          <div className="relative rounded-md border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-64 px-4 py-3 text-sm leading-7 text-zinc-900 outline-none dark:text-zinc-100" />
              }
              placeholder={
                <div className="pointer-events-none absolute px-4 py-3 text-sm text-zinc-400 dark:text-zinc-500">
                  Scrivi markdown...
                </div>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <WikiLinkTransformPlugin />
            <WikiLinkAutocompletePlugin
              campaignId={campaignId}
              onStatus={setStatus}
            />
            <OnChangePlugin
              onChange={(_, editor) => {
                setStatus(null);
                setMarkdown(serializeMarkdown(editor));
              }}
            />
          </div>
        </LexicalComposer>

        <div className="space-y-2">
          <p className="text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
            Preview
          </p>
          <WikiMarkdownPreview
            campaignId={campaignId}
            markdown={markdown}
            entityPreviews={entityPreviews}
          />
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{isDirty ? "Modifiche non salvate" : "Allineato al DB"}</span>
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
