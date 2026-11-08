export interface Project {
  name: string;
  tempoBpm: number | null;
  /** A first reading that loops, but is not accepted until a second layer is captured. */
  proposedTempoBpm: number | null;
  gridLocked: boolean;
  sustainCc: number;
  afterCapture: "loop" | "silent";
  captureControl: number | null;
  transportControl: number | null;
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

export const HISTORY_WINDOW_SECONDS = 120;

export function createProject(): Project {
  return {
    name: "Sketch",
    tempoBpm: null,
    proposedTempoBpm: null,
    gridLocked: false,
    sustainCc: 64,
    afterCapture: "loop",
    captureControl: null,
    transportControl: null,
    phrases: [],
  };
}

export function gridStatusCopy(project: Project): string {
  if (project.gridLocked && project.tempoBpm !== null) {
    return "Sketch tempo " + project.tempoBpm + " is accepted. A later reading does not change it.";
  }
  if (project.proposedTempoBpm !== null) {
    return "Tempo " + project.proposedTempoBpm + " is proposed, not accepted. A second layer keeps it. " + HISTORY_WINDOW_SECONDS + " seconds is the ribbon, not a tempo.";
  }
  return "No grid yet. The first reading can propose one. " + HISTORY_WINDOW_SECONDS + " seconds is the ribbon, not a tempo.";
}

export function proposeTempo(project: Project, bpm: number | null, layerCount: number): { project: Project; note: string } {
  if (project.gridLocked && project.tempoBpm !== null) {
    return { project, note: "Sketch tempo " + project.tempoBpm + " stays accepted." };
  }
  if (project.proposedTempoBpm !== null && layerCount >= 1) {
    return {
      project: { ...project, tempoBpm: project.proposedTempoBpm, gridLocked: true },
      note: "Tempo " + project.proposedTempoBpm + " kept. Undo restores the proposal.",
    };
  }
  if (bpm === null || !Number.isFinite(bpm)) {
    return { project, note: "No pulse reading, so no grid was proposed." };
  }
  const rounded = Math.max(40, Math.min(240, Math.round(bpm)));
  return {
    project: { ...project, proposedTempoBpm: rounded, tempoBpm: null, gridLocked: false },
    note: "Tempo " + rounded + " proposed. The loop is starting. A second layer accepts it.",
  };
}

export function proposeGrid(project: Project, bpm: number | null): { project: Project; proposed: boolean; note: string } {
  if (project.gridLocked && project.tempoBpm !== null) {
    return { project, proposed: false, note: "Sketch tempo " + project.tempoBpm + " stays locked." };
  }
  if (bpm === null || !Number.isFinite(bpm)) {
    return { project, proposed: false, note: "No pulse reading, so no grid was proposed." };
  }
  const next = setProjectTempo({ ...project, gridLocked: false, tempoBpm: null }, bpm);
  return {
    project: { ...next, gridLocked: true },
    proposed: true,
    note: "The first reading proposed " + next.tempoBpm + " bpm. The grid is now locked.",
  };
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
  if (!parsed || !Array.isArray(parsed.phrases)) {
    return null;
  }
  if (parsed.tempoBpm !== null && typeof parsed.tempoBpm !== "number") {
    return null;
  }
  if (typeof parsed.gridLocked !== "boolean") {
    parsed.gridLocked = parsed.phrases.length > 0 && typeof parsed.tempoBpm === "number";
  }
  if (typeof parsed.proposedTempoBpm !== "number") {
    parsed.proposedTempoBpm = null;
  }
  if (!parsed.gridLocked) {
    parsed.tempoBpm = null;
  }
  if (parsed.afterCapture !== "silent" && parsed.afterCapture !== "loop") {
    parsed.afterCapture = "loop";
  }
  if (typeof parsed.captureControl !== "number") {
    parsed.captureControl = null;
  }
  if (typeof parsed.transportControl !== "number") {
    parsed.transportControl = null;
  }
  return parsed;
}
