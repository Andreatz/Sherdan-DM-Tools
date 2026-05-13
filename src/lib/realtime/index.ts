import { RealtimeHub } from "./hub";

export type { RealtimeServerMessage } from "./hub";
export { attachRealtimeServer } from "./server";

// Singleton in-process condiviso tra custom server e futuri route handler DM.
// Finche' il deploy e' localhost/Tailscale con una sola istanza, questo e'
// abbastanza e mantiene i broadcast campaign-scoped senza infrastruttura extra.
export const realtimeHub = new RealtimeHub();
