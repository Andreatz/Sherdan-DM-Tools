"use client";

import { useState } from "react";

export function CopyForChatGptButton({
  text,
  label = "Copia per ChatGPT",
  className = "",
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={
        className ||
        "h-9 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      }
    >
      {copied ? "Copiato" : label}
    </button>
  );
}
