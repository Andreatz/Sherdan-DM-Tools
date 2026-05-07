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
  $createParagraphNode,
  $createTextNode,
  $getRoot,
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

interface WikiMarkdownEditorProps {
  entityId: string;
  field: MarkdownField;
  label: string;
  initialMarkdown: string | null;
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

export function WikiMarkdownEditor({
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
