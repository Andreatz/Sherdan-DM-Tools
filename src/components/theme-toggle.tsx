"use client";

import { useEffect, useState } from "react";

type ThemeMode = "light" | "dark" | "system";

const STORAGE_KEY = "sherdan-theme";

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>("system");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      window.setTimeout(() => setMode(stored), 0);
      applyTheme(stored);
    } else {
      applyTheme("system");
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (!current || current === "system") applyTheme("system");
    };
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  function update(next: ThemeMode) {
    setMode(next);
    window.localStorage.setItem(STORAGE_KEY, next);
    applyTheme(next);
  }

  return (
    <div className="grid grid-cols-3 rounded-md border border-[var(--border)] bg-[var(--surface-muted)] p-0.5 text-[11px]">
      {(["light", "dark", "system"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => update(option)}
          className={`rounded px-2 py-1 capitalize transition-colors ${
            mode === option
              ? "bg-[var(--foreground)] text-[var(--background)] shadow-sm"
              : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          }`}
          aria-pressed={mode === option}
        >
          {option === "system" ? "Auto" : option}
        </button>
      ))}
    </div>
  );
}

function applyTheme(mode: ThemeMode) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const shouldDark = mode === "dark" || (mode === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", shouldDark);
  document.documentElement.dataset.theme = mode;
}
