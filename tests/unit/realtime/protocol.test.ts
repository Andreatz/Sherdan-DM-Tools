import { describe, expect, it } from "vitest";

import {
  createWebSocketAcceptKey,
  decodeClientFrames,
  encodeTextFrame,
} from "@/lib/realtime/protocol";

describe("websocket protocol helpers", () => {
  it("creates the RFC6455 accept key", () => {
    expect(createWebSocketAcceptKey("dGhlIHNhbXBsZSBub25jZQ==")).toBe(
      "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=",
    );
  });

  it("encodes a server text frame", () => {
    const frame = encodeTextFrame("ciao");
    expect([...frame]).toEqual([0x81, 0x04, 0x63, 0x69, 0x61, 0x6f]);
  });

  it("decodes masked client text frames", () => {
    const frame = maskedTextFrame("ping", [0x11, 0x22, 0x33, 0x44]);
    const decoded = decodeClientFrames(frame);
    expect(decoded.messages).toEqual(["ping"]);
    expect(decoded.closeRequested).toBe(false);
    expect(decoded.remaining.length).toBe(0);
  });

  it("keeps partial frames for the next socket chunk", () => {
    const frame = maskedTextFrame("hello", [0x01, 0x02, 0x03, 0x04]);
    const first = decodeClientFrames(frame.subarray(0, 4));
    expect(first.messages).toEqual([]);
    expect(first.remaining.length).toBe(4);

    const second = decodeClientFrames(Buffer.concat([first.remaining, frame.subarray(4)]));
    expect(second.messages).toEqual(["hello"]);
    expect(second.remaining.length).toBe(0);
  });
});

function maskedTextFrame(text: string, maskBytes: [number, number, number, number]): Buffer {
  const payload = Buffer.from(text, "utf8");
  const frame = Buffer.alloc(2 + 4 + payload.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | payload.length;
  for (let i = 0; i < maskBytes.length; i += 1) {
    frame[2 + i] = maskBytes[i] ?? 0;
  }
  for (let i = 0; i < payload.length; i += 1) {
    const byte = payload[i];
    const mask = maskBytes[i % 4];
    if (byte === undefined || mask === undefined) {
      throw new Error("test frame build failed");
    }
    frame[6 + i] = byte ^ mask;
  }
  return frame;
}
