import { describe, expect, it } from "vitest";

import { targetLabel } from "@/components/chatgpt-bridge/review-utils";
import type { ReviewChange } from "@/lib/chatgpt-bridge";

function change(
  kind: ReviewChange["kind"],
  applyPayload: unknown,
): ReviewChange {
  return {
    id: "c1",
    kind,
    label: "Cambio",
    risk: "low",
    summary: "summary",
    warnings: [],
    applyPayload,
  } as ReviewChange;
}

describe("chatgpt bridge review utils", () => {
  it("produce label compatte per sessioni e briciole", () => {
    expect(targetLabel(change("session_update", { number: 12 }))).toBe(
      "sessione 12",
    );
    expect(
      targetLabel(
        change("truth_clue_create", {
          description: "Una lanterna nera brucia senza consumarsi.",
        }),
      ),
    ).toBe("Una lanterna nera brucia senza consumarsi.");
  });

  it("usa fallback leggibili quando il payload e incompleto", () => {
    expect(targetLabel(change("entity_update", null))).toBe("entity");
    expect(targetLabel(change("entity_secret_create", {}))).toBe("segreto");
    expect(targetLabel(change("entity_link_create", {}))).toBe("link");
  });
});
