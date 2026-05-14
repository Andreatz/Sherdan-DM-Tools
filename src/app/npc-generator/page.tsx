import { NpcGeneratorWorkbench } from "@/components/npc-generator-workbench";
import { env } from "@/lib/env";

export default function NpcGeneratorPage() {
  return <NpcGeneratorWorkbench llmDisabled={env.LLM_PROVIDER === "none"} />;
}
