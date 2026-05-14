import { DungeonGenerator } from "@/components/dungeon-generator";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function DungeonGeneratorPage() {
  return <DungeonGenerator llmDisabled={env.LLM_PROVIDER === "none"} />;
}
