/** Graphite for the room, Paper for daylight. Switching does not touch audio or MIDI. */

export type ThemeChoice = "dark" | "light" | "system";

export interface Palette {
  bg: string;
  card: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  note: string;
  noteDim: string;
  plot: string;
  handle: string;
  dock: string;
}

export const graphite: Palette = {
  bg: "#0A0C0F",
  card: "#14171C",
  ink: "#EEF0F3",
  muted: "#A0A8B3",
  line: "#272C35",
  accent: "#FF7442",
  accentInk: "#1A0D07",
  note: "#E7E1D6",
  noteDim: "#5C6570",
  plot: "#0E1014",
  handle: "#FF7442",
  dock: "#0A0C0F",
};

export const paper: Palette = {
  bg: "#F3EEE4",
  card: "#FBF8F2",
  ink: "#17150F",
  muted: "#625D52",
  line: "#D9D1C1",
  accent: "#B8321C",
  accentInk: "#FFFFFF",
  note: "#3A342C",
  noteDim: "#C4B8A8",
  plot: "#FFFDF8",
  handle: "#B8321C",
  dock: "#F3EEE4",
};

export function resolveTheme(choice: ThemeChoice, systemDark: boolean): Palette {
  if (choice === "light") {
    return paper;
  }
  if (choice === "system") {
    return systemDark ? graphite : paper;
  }
  return graphite;
}

export function playChrome(width: number): { narrow: boolean; handlePx: number; pad: number } {
  return {
    narrow: width < 720,
    handlePx: 44,
    pad: width < 400 ? 12 : width < 720 ? 16 : 24,
  };
}
