"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Listener globale per `Cmd+Shift+R` / `Ctrl+Shift+R`: naviga a `/rules`.
// Componente "invisibile" montato in AppShell. Niente UI propria —
// l'esperienza Q&A vive nella pagina dedicata.
//
// Nota: nei browser desktop `Ctrl+Shift+R` e' bound a "hard reload" e
// non e' intercettabile da JS. `Cmd+Shift+R` (macOS) idem.
// Per essere effettivamente attivabile usiamo come alias `Cmd+/` (mac)
// e `Ctrl+/` (win/linux), oltre a tentare `Cmd+Shift+K` come fallback
// inutilizzato da Claude Code (Ctrl+K e' gia' usato da EntityQuickSwitch).
//
// Scelta dello shortcut documentata in `docs/decisions.md` (Fase 9 slice 3).
export function RulesShortcut() {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const isMac =
        typeof navigator !== "undefined" &&
        /Mac|iPhone|iPad/.test(navigator.platform);
      const meta = isMac ? event.metaKey : event.ctrlKey;
      if (!meta) return;
      const key = event.key.toLowerCase();
      // Primary: Cmd/Ctrl + /  (idiomatico per "help/search")
      const isSlash = key === "/" && !event.shiftKey;
      // Fallback: Cmd/Ctrl + Shift + K (Ctrl+K e' EntityQuickSwitch).
      const isShiftK = key === "k" && event.shiftKey;
      if (!isSlash && !isShiftK) return;
      event.preventDefault();
      router.push("/rules");
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [router]);

  return null;
}
