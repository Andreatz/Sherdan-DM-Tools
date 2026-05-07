"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface EntityTagEditorProps {
  entityId: string;
  initialTags: string[];
  allTags: string[];
}

function normalizeTag(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function tagKey(value: string): string {
  return value.toLocaleLowerCase("it-IT");
}

function dedupeTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const tag of tags) {
    const normalized = normalizeTag(tag);
    if (!normalized) continue;
    const key = tagKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }
  return result;
}

function sameTags(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((tag, index) => tag === b[index]);
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: { message?: string } };
    return body.error?.message ?? `Richiesta fallita (${response.status})`;
  } catch {
    return `Richiesta fallita (${response.status})`;
  }
}

export function EntityTagEditor({
  entityId,
  initialTags,
  allTags,
}: EntityTagEditorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [savedTags, setSavedTags] = useState(() => dedupeTags(initialTags));
  const [tags, setTags] = useState(() => dedupeTags(initialTags));
  const [input, setInput] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(() => {
    const selected = new Set(tags.map(tagKey));
    const query = tagKey(input);
    return dedupeTags(allTags)
      .filter((tag) => !selected.has(tagKey(tag)))
      .filter((tag) => !query || tagKey(tag).includes(query))
      .slice(0, 8);
  }, [allTags, input, tags]);

  const dirty = !sameTags(tags, savedTags);

  function addTag(rawTag: string) {
    const nextTag = normalizeTag(rawTag);
    if (!nextTag) return;
    setTags((current) => dedupeTags([...current, nextTag]));
    setInput("");
    setError(null);
  }

  function removeTag(tagToRemove: string) {
    setTags((current) =>
      current.filter((tag) => tagKey(tag) !== tagKey(tagToRemove)),
    );
    setError(null);
  }

  async function saveTags() {
    setError(null);
    const response = await fetch(`/api/entities/${entityId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tags }),
    });

    if (!response.ok) {
      setError(await parseApiError(response));
      return;
    }

    setSavedTags(tags);
    startTransition(() => router.refresh());
  }

  return (
    <div className="w-full max-w-md space-y-2">
      <label className="block">
        <span className="mb-1 block text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          Tag
        </span>
        <div className="relative">
          <div
            className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1.5 transition-colors focus-within:border-zinc-400 focus-within:bg-white dark:border-zinc-800 dark:bg-zinc-950 dark:focus-within:border-zinc-600 dark:focus-within:bg-zinc-900"
          >
            {tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex max-w-full items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white dark:bg-zinc-100 dark:text-zinc-950"
              >
                <span className="max-w-36 truncate">{tag}</span>
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="rounded px-1 text-xs opacity-80 transition-opacity hover:opacity-100"
                  aria-label={`Rimuovi tag ${tag}`}
                >
                  x
                </button>
              </span>
            ))}
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                window.setTimeout(() => setIsFocused(false), 120);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === ",") {
                  event.preventDefault();
                  addTag(input);
                }
                if (event.key === "Backspace" && !input && tags.length > 0) {
                  removeTag(tags[tags.length - 1] ?? "");
                }
              }}
              placeholder={tags.length === 0 ? "Aggiungi tag" : ""}
              className="h-7 min-w-28 flex-1 bg-transparent px-1 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-100 dark:placeholder:text-zinc-500"
            />
          </div>

          {isFocused && (suggestions.length > 0 || normalizeTag(input)) && (
            <div className="absolute right-0 z-20 mt-1 w-full rounded-md border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
              {suggestions.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => addTag(tag)}
                  className="block w-full rounded px-2 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  {tag}
                </button>
              ))}
              {normalizeTag(input) &&
                !suggestions.some((tag) => tagKey(tag) === tagKey(input)) &&
                !tags.some((tag) => tagKey(tag) === tagKey(input)) && (
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => addTag(input)}
                    className="block w-full rounded px-2 py-1.5 text-left text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                  >
                    Crea &quot;{normalizeTag(input)}&quot;
                  </button>
                )}
            </div>
          )}
        </div>
      </label>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Enter o virgola per aggiungere.
        </p>
        <button
          type="button"
          onClick={() => void saveTags()}
          disabled={!dirty || isPending}
          className="h-8 rounded-md border border-zinc-200 px-3 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-800"
        >
          Salva tag
        </button>
      </div>
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
