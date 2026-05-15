import type { ReviewChange } from "@/lib/chatgpt-bridge";

export function targetLabel(change: ReviewChange): string {
  const payload = asRecord(change.applyPayload);
  switch (change.kind) {
    case "session_update":
      return payload.number ? `sessione ${String(payload.number)}` : "sessione";
    case "plot_thread_event_create":
      return payload.plotThreadId ? `plot ${String(payload.plotThreadId)}` : "plot";
    case "truth_clue_create":
      return payload.description
        ? String(payload.description).slice(0, 80)
        : "briciola";
    case "entity_update":
      return payload.entityId ? `entity ${String(payload.entityId)}` : "entity";
    case "pc_hook_create":
      return payload.targetEntityId
        ? `hook verso ${String(payload.targetEntityId)}`
        : "hook";
    case "entity_identity_create":
      return payload.entityId ? `entity ${String(payload.entityId)}` : "identita";
    case "entity_secret_create":
      return String(
        payload.entityId ?? payload.plotThreadId ?? payload.content ?? "segreto",
      ).slice(0, 80);
    case "entity_link_create":
      return payload.targetEntityId
        ? `link verso ${String(payload.targetEntityId)}`
        : "link";
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null
    ? (value as Record<string, unknown>)
    : {};
}
