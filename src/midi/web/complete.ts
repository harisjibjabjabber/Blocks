export interface ParsedComplete {
  ok: true;
  status: number;
  channel: number;
  data1: number;
  data2: number;
  kind: "note-on" | "note-off" | "cc" | "pitch" | "other";
  velocityZero: boolean;
  raw: number[];
}

export interface RejectedComplete {
  ok: false;
  reason: string;
}

export function parseCompleteMidi(bytes: Uint8Array | number[]): ParsedComplete | RejectedComplete {
  const data = Array.from(bytes);
  if (data.length === 0) {
    return { ok: false, reason: "empty" };
  }
  const status = data[0];
  if ((status & 0x80) === 0) {
    return { ok: false, reason: "incomplete or running status" };
  }
  if (status === 0xf0 || status === 0xf7) {
    return { ok: false, reason: "sysex is not accepted" };
  }
  const expected = expectedLength(status);
  if (expected < 0) {
    return { ok: false, reason: "unsupported status" };
  }
  if (data.length !== expected + 1) {
    return { ok: false, reason: "incomplete" };
  }
  const data1 = expected > 0 ? data[1] : 0;
  const data2 = expected > 1 ? data[2] : 0;
  const high = status & 0xf0;
  let kind: ParsedComplete["kind"] = "other";
  if (high === 0x90) {
    kind = "note-on";
  } else if (high === 0x80) {
    kind = "note-off";
  } else if (high === 0xb0) {
    kind = "cc";
  } else if (high === 0xe0) {
    kind = "pitch";
  }
  return {
    ok: true,
    status,
    channel: status >= 0xf0 ? 0 : status & 0x0f,
    data1,
    data2,
    kind,
    velocityZero: high === 0x90 && data2 === 0,
    raw: data,
  };
}

function expectedLength(status: number): number {
  if (status >= 0xf8) {
    return 0;
  }
  switch (status & 0xf0) {
    case 0xc0:
    case 0xd0:
      return 1;
    case 0x80:
    case 0x90:
    case 0xa0:
    case 0xb0:
    case 0xe0:
      return 2;
    default:
      break;
  }
  if (status === 0xf1 || status === 0xf3) {
    return 1;
  }
  if (status === 0xf2) {
    return 2;
  }
  if (status === 0xf6) {
    return 0;
  }
  return -1;
}
