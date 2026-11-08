export interface Project {
  name: string;
  tempoBpm: number;
  sustainCc: number;
  afterCapture: "loop" | "silent";
  phrases: StoredPhrase[];
}

export interface StoredPhrase {
  id: string;
  createdAt: string;
  domain: "android-monotonic-ns" | "web-performance-us";
  events: StoredEvent[];
}

export interface StoredEvent {
  sequence: string;
  portId: string;
  sessionId: string;
  channel: number;
  kind: "note-on" | "note-off" | "cc" | "pitch" | "other";
  note: number;
  velocity: number;
  controller: number;
  value: number;
  scheduleElapsed: string;
  sourceTimestamp: string | null;
  receiptTimestamp: string;
  missingSourceTimestamp: boolean;
  raw: number[] | null;
  origin: string;
}

export function createProject(): Project {
  return { name: "Sketch", tempoBpm: 120, sustainCc: 64, afterCapture: "loop", phrases: [] };
}

export function setProjectTempo(project: Project, tempoBpm: number): Project {
  const next = Math.max(40, Math.min(240, Math.round(tempoBpm)));
  return { ...project, tempoBpm: next };
}

export function setSustainCc(project: Project, cc: number): Project {
  return { ...project, sustainCc: Math.max(0, Math.min(127, Math.round(cc))) };
}

export function projectToJson(project: Project): string {
  return JSON.stringify(project);
}

export function projectFromJson(text: string): Project | null {
  if (!text) {
    return null;
  }
  const parsed = JSON.parse(text) as Project;
  if (!parsed || typeof parsed.tempoBpm !== "number" || !Array.isArray(parsed.phrases)) {
    return null;
  }
  if (parsed.afterCapture !== "silent" && parsed.afterCapture !== "loop") {
    parsed.afterCapture = "loop";
  }
  return parsed;
}
