import { createHash, randomUUID } from "node:crypto";

import { BadRequestError } from "@/lib/api/errors";

const WEBSOCKET_GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";
const OPCODE_TEXT = 0x1;
const OPCODE_CLOSE = 0x8;
const OPCODE_PING = 0x9;
const OPCODE_PONG = 0xa;
const FIN_BIT = 0x80;
const MASK_BIT = 0x80;
const LENGTH_16 = 126;
const LENGTH_64 = 127;
const MAX_TEXT_MESSAGE_BYTES = 64 * 1024;

export interface DecodedWebSocketFrames {
  messages: string[];
  pongs: Buffer[];
  pings: Buffer[];
  closeRequested: boolean;
  remaining: Buffer;
}

export function createWebSocketAcceptKey(clientKey: string): string {
  return createHash("sha1")
    .update(`${clientKey}${WEBSOCKET_GUID}`)
    .digest("base64");
}

export function createConnectionId(): string {
  return randomUUID();
}

export function encodeTextFrame(payload: string): Buffer {
  return encodeServerFrame(OPCODE_TEXT, Buffer.from(payload, "utf8"));
}

export function encodePongFrame(payload: Buffer = Buffer.alloc(0)): Buffer {
  return encodeServerFrame(OPCODE_PONG, payload);
}

export function encodeCloseFrame(): Buffer {
  return encodeServerFrame(OPCODE_CLOSE, Buffer.alloc(0));
}

export function decodeClientFrames(buffer: Buffer): DecodedWebSocketFrames {
  const messages: string[] = [];
  const pongs: Buffer[] = [];
  const pings: Buffer[] = [];
  let closeRequested = false;
  let offset = 0;

  while (offset + 2 <= buffer.length) {
    const first = buffer[offset];
    const second = buffer[offset + 1];
    if (first === undefined || second === undefined) break;

    const isFinal = Boolean(first & FIN_BIT);
    const opcode = first & 0x0f;
    const isMasked = Boolean(second & MASK_BIT);
    let payloadLength = second & 0x7f;
    let headerLength = 2;

    if (!isFinal) {
      throw new BadRequestError("WebSocket fragmented frames non supportati.");
    }
    if (!isMasked) {
      throw new BadRequestError("I frame WebSocket client devono essere masked.");
    }

    if (payloadLength === LENGTH_16) {
      if (offset + headerLength + 2 > buffer.length) break;
      payloadLength = buffer.readUInt16BE(offset + headerLength);
      headerLength += 2;
    } else if (payloadLength === LENGTH_64) {
      if (offset + headerLength + 8 > buffer.length) break;
      const length64 = buffer.readBigUInt64BE(offset + headerLength);
      if (length64 > BigInt(MAX_TEXT_MESSAGE_BYTES)) {
        throw new BadRequestError("Messaggio WebSocket troppo grande.");
      }
      payloadLength = Number(length64);
      headerLength += 8;
    }

    if (payloadLength > MAX_TEXT_MESSAGE_BYTES) {
      throw new BadRequestError("Messaggio WebSocket troppo grande.");
    }

    const maskOffset = offset + headerLength;
    const payloadOffset = maskOffset + 4;
    const frameEnd = payloadOffset + payloadLength;
    if (frameEnd > buffer.length) break;

    const mask = buffer.subarray(maskOffset, payloadOffset);
    const payload = Buffer.alloc(payloadLength);
    for (let i = 0; i < payloadLength; i += 1) {
      const rawByte = buffer[payloadOffset + i];
      const maskByte = mask[i % 4];
      if (rawByte === undefined || maskByte === undefined) {
        throw new BadRequestError("Frame WebSocket incompleto.");
      }
      payload[i] = rawByte ^ maskByte;
    }

    if (opcode === OPCODE_TEXT) {
      messages.push(payload.toString("utf8"));
    } else if (opcode === OPCODE_CLOSE) {
      closeRequested = true;
    } else if (opcode === OPCODE_PING) {
      pings.push(payload);
    } else if (opcode === OPCODE_PONG) {
      pongs.push(payload);
    }

    offset = frameEnd;
  }

  return {
    messages,
    pongs,
    pings,
    closeRequested,
    remaining: buffer.subarray(offset),
  };
}

function encodeServerFrame(opcode: number, payload: Buffer): Buffer {
  const length = payload.length;
  const header =
    length < LENGTH_16
      ? Buffer.alloc(2)
      : length <= 0xffff
        ? Buffer.alloc(4)
        : Buffer.alloc(10);

  header[0] = FIN_BIT | opcode;
  if (length < LENGTH_16) {
    header[1] = length;
  } else if (length <= 0xffff) {
    header[1] = LENGTH_16;
    header.writeUInt16BE(length, 2);
  } else {
    header[1] = LENGTH_64;
    header.writeBigUInt64BE(BigInt(length), 2);
  }

  return Buffer.concat([header, payload]);
}
