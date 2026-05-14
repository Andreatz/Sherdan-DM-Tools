import { LootGeneratorWorkbench } from "@/components/loot-generator-workbench";
import { env } from "@/lib/env";

export default function LootGeneratorPage() {
  return <LootGeneratorWorkbench llmDisabled={env.LLM_PROVIDER === "none"} />;
}
