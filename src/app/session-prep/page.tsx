import { SessionPrepWorkbench } from "@/components/session-prep-workbench";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default function SessionPrepPage() {
  return <SessionPrepWorkbench llmDisabled={env.LLM_PROVIDER === "none"} />;
}
