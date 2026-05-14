import { MonsterBrowser } from "@/components/monster-browser";
import { env } from "@/lib/env";

export default function EncounterBuilderPage() {
  return <MonsterBrowser llmDisabled={env.LLM_PROVIDER === "none"} />;
}
