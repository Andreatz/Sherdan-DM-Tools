import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { parseSherdanCampaignMarkdown } from "@/lib/parsers/sherdan-campaign";

const campaignMarkdown = readFileSync(
  path.join(process.cwd(), "public", "Campagna.md"),
  "utf8",
);

describe("parseSherdanCampaignMarkdown", () => {
  const plan = parseSherdanCampaignMarkdown(campaignMarkdown);

  it("parses Campagna.md into plot threads and sessions", () => {
    expect(plan.warnings).toEqual([]);
    expect(plan.plotThreads).toHaveLength(10);
    expect(plan.sessions).toHaveLength(6);
    expect(plan.plotThreads[0]).toMatchObject({
      title: "La Profezia",
      category: "prophecy",
      status: "hot",
      visibility: "dm_only",
    });
    expect(plan.sessions[0]).toMatchObject({
      number: 1,
      title: "Sessione 1",
      date: "2026-02-07",
    });
  });

  it("splits prophecy propaganda from GM truth", () => {
    const prophecy = plan.plotThreads.find(
      (thread) => thread.category === "prophecy",
    );

    expect(prophecy).toBeDefined();
    expect(prophecy?.publicDescription).toContain("La Radice Sanguina");
    expect(prophecy?.publicDescription).not.toContain("testo della Resistenza");
    expect(prophecy?.publicDescription).not.toContain("\u{1F512}");
    expect(prophecy?.description).toContain("testo della Resistenza");
    expect(prophecy?.description).toContain("Mitra non");
    expect(prophecy?.gmNoteCount).toBe(1);
  });

  it("keeps personal arcs as GM-only plot threads", () => {
    const azazel = plan.plotThreads.find((thread) =>
      thread.title.includes("Azazel"),
    );

    expect(azazel).toBeDefined();
    expect(azazel?.category).toBe("pc_arc");
    expect(azazel?.publicDescription).toBe("");
    expect(azazel?.description).toContain("Malakor");
    expect(azazel?.description).toContain("Sigillo di Mitra");
    expect(azazel?.relatedPcNames).toEqual(["Azazel", "Erevan"]);
  });

  it("imports the macro arc as one thread with chapter titles", () => {
    const macro = plan.plotThreads.find(
      (thread) => thread.category === "macro_arc",
    );

    expect(macro).toBeDefined();
    expect(macro?.chapterTitles).toEqual([
      "CAPITOLO 1: L'Arcipelago dei Dannati",
      "CAPITOLO 2: La Corsa ai Troni",
      "CAPITOLO 3: La Guerra dei Due Continenti",
      "CAPITOLO 4: La Verità nella Battaglia",
    ]);
    expect(macro?.description).toContain("tragedia preparata");
    expect(macro?.description).not.toContain("\u{1F512}");
    expect(macro?.publicDescription).toBe("");
  });

  it("extracts session recaps and prep notes from interleaved GM blocks", () => {
    const session2 = plan.sessions.find((session) => session.number === 2);
    const session5 = plan.sessions.find((session) => session.number === 5);

    expect(session2).toBeDefined();
    expect(session2?.recap).toContain("Sestante");
    expect(session2?.recap).not.toContain("versione propaganda");
    expect(session2?.prepNotes).toContain("versione propaganda");
    expect(session2?.prepNotes).toContain("Figlio mio");
    expect(session2?.gmNoteCount).toBe(4);

    expect(session5).toBeDefined();
    expect(session5?.recap).toContain("Magazzino 4");
    expect(session5?.prepNotes).toContain("casse nere");
    expect(session5?.gmNoteCount).toBe(3);
  });
});
