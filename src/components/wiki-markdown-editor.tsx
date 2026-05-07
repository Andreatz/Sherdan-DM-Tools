"use client";

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
}

interface EntitySuggestion {
  id: string;
  name: string;
  type: EntityType;
}

interface WikiLinkTrigger {
  query: string;
  anchorKey: string;
  startOffset: number;
  endOffset: number;
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
  const [editor] = useLexicalComposerContext();
  const [trigger, setTrigger] = useState<WikiLinkTrigger | null>(null);
  const [suggestions, setSuggestions] = useState<EntitySuggestion[]>([]);
  const [createType, setCreateType] = useState<EntityType>("npc");
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

  function replaceTrigger(name: string) {
    if (!trigger) return;

    editor.update(() => {
      const selection = $createRangeSelection();
      selection.anchor.set(trigger.anchorKey, trigger.startOffset, "text");
      selection.focus.set(trigger.anchorKey, trigger.endOffset, "text");
      $setSelection(selection);
      selection.insertText(`[[${name}]]`);
    });
    setTrigger(null);
  }

  function createAndInsert() {
    if (!trigger) return;

    const name = trigger.query.trim();
    if (!name) return;

    onStatus(null);
    startCreateTransition(async () => {
      const response = await fetch("/api/entities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId,
          type: createType,
          name,
          properties: getStubProperties(createType),
          tags: [],
          visibility: "dm_only",
        }),
      });

      if (!response.ok) {
        onStatus(`Creazione fallita: HTTP ${response.status}`);
        return;
      }

      replaceTrigger(name);
      onStatus(`Creata entita' "${name}"`);
    });
  }

  if (!trigger) return null;

  const query = trigger.query.trim();
  const exactMatch = suggestions.some(
    (suggestion) =>
      suggestion.name.toLocaleLowerCase("it-IT") ===
      query.toLocaleLowerCase("it-IT"),
  );

  return (
    <div className="border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
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
              onClick={() => replaceTrigger(suggestion.name)}
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
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={createType}
            onChange={(event) => setCreateType(event.target.value as EntityType)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2 text-sm text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100"
          >
            {CREATE_TYPE_OPTIONS.map((type) => (
              <option key={type} value={type}>
                {TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createAndInsert}
            disabled={isCreating}
            className="h-9 rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:bg-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:text-zinc-400"
          >
            {isCreating ? "Creo..." : `Crea "${query}"`}
          </button>
        </div>
      )}
    </div>
  );
}

function $isTextNodeLike(node: LexicalNode): node is TextNode {
  return node instanceof TextNode;
}

export function WikiMarkdownEditor({
  campaignId,
  entityId,
  field,
  label,
  initialMarkdown,
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

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>{isDirty ? "Modifiche non salvate" : "Allineato al DB"}</span>
        {status && <span>{status}</span>}
      </div>
    </div>
  );
}
