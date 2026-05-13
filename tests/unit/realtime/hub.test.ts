import { EventEmitter } from "node:events";

import { describe, expect, it } from "vitest";

import { RealtimeHub } from "@/lib/realtime/hub";

const campaignA = "aaaaaaaa-aaaa-4aaa-aaaa-aaaaaaaaaaaa";
const campaignB = "bbbbbbbb-bbbb-4bbb-bbbb-bbbbbbbbbbbb";

describe("RealtimeHub campaign channels", () => {
  it("tracks connections by campaign and removes empty channels", () => {
    const hub = new RealtimeHub();
    const socket = new FakeSocket();
    const id = hub.add(socket.asSocket(), {
      campaignId: campaignA,
      playerId: "player-a",
    });

    expect(hub.connectionCount).toBe(1);
    expect(hub.campaignConnectionCount(campaignA)).toBe(1);

    socket.emit("close");

    expect(hub.connectionCount).toBe(0);
    expect(hub.campaignConnectionCount(campaignA)).toBe(0);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("broadcasts only to the selected campaign channel", () => {
    const hub = new RealtimeHub();
    const socketA = new FakeSocket();
    const socketB = new FakeSocket();
    hub.add(socketA.asSocket(), { campaignId: campaignA, playerId: "player-a" });
    hub.add(socketB.asSocket(), { campaignId: campaignB, playerId: "player-b" });
    socketA.clearWrites();
    socketB.clearWrites();

    const sent = hub.broadcastCampaign(campaignA, "scene.updated", { title: "Sala" });

    expect(sent).toBe(1);
    expect(socketA.writesAsText()).toContain("scene.updated");
    expect(socketA.writesAsText()).toContain(campaignA);
    expect(socketB.writesAsText()).toBe("");
  });
});

class FakeSocket extends EventEmitter {
  destroyed = false;
  private readonly writes: Buffer[] = [];

  setNoDelay(): void {
    // no-op
  }

  write(chunk: Buffer | string): boolean {
    this.writes.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return true;
  }

  end(): void {
    this.destroyed = true;
  }

  clearWrites(): void {
    this.writes.length = 0;
  }

  writesAsText(): string {
    return Buffer.concat(this.writes).toString("utf8");
  }

  asSocket(): Parameters<RealtimeHub["add"]>[0] {
    return this as unknown as Parameters<RealtimeHub["add"]>[0];
  }
}
