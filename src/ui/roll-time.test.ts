import { describe, expect, it } from "vitest";
import { planFromElapsed } from "../audio/web/schedule";
import { alignmentPx, beatTicks, musicalPosition, framePhrase, noteBox, panWindow, pitchToY, rulerMarks, timeToX, xToTime, zoomWindow, type KnownGrid, type TimeWindow } from "./roll-time";

const US = 1_000_000n;

function us(ms: number): bigint {
  return BigInt(Math.round(ms * 1000));
}

/** The rejected ruler: a proposed BPM, phased at 0, pretending to be the grid. */
function proposedBeat(bpm: number, index: number): bigint {
  return beatTicks(bpm) * BigInt(index);
}

function views(): { width: number; window: TimeWindow; name: string }[] {
  const phrase = framePhrase(0n, 0n, 4n * US);
  return [
    { name: "phone", width: 390, window: phrase },
    { name: "desktop", width: 1280, window: phrase },
    { name: "zoomed", width: 800, window: zoomWindow(phrase, 0.25, 1n * US, us(50), 40n * US) },
    { name: "panned", width: 800, window: panWindow(phrase, us(800), 0n) },
  ];
}

function expectAligned(time: bigint, window: TimeWindow, width: number) {
  const inside = time >= window.start && time <= window.end;
  if (!inside) {
    return;
  }
  const x = timeToX(time, window, width);
  const recovered = xToTime(x, window, width);
  expect(alignmentPx(time, window, width)).toBeLessThan(0.51);
  const scheduled = planFromElapsed({ audioStartSec: 0, elapsedUs: time, anchorElapsedUs: 0n, stretch: 1 });
  expect(scheduled * 1_000_000).toBeCloseTo(Number(time), 0);
  const recoveredAudio = planFromElapsed({ audioStartSec: 0, elapsedUs: recovered, anchorElapsedUs: 0n, stretch: 1 });
  const pixel = Math.abs(timeToX(recovered, window, width) - x);
  expect(pixel).toBeLessThan(0.51);
  expect(Math.abs(recoveredAudio - scheduled)).toBeLessThan(width > 0 ? Number(window.end - window.start) / width / 1_000_000 + 1e-6 : 1);
}

describe("roll time matches the scheduler", () => {
  const grid: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 0n };

  it("measures the rejected beat ruler against beat-spaced notes", () => {
    const notes = [0, 500, 1000, 1500].map(us);
    const window = { start: 0n, end: 2n * US };
    const width = 800;
    const proposed = proposedBeat(162, 1);
    const gapPx = Math.abs(timeToX(notes[1], window, width) - timeToX(proposed, window, width));
    expect(gapPx).toBeGreaterThan(40);
    expect(timeToX(notes[1], window, width)).toBeCloseTo(200, 4);
    for (const note of notes) {
      expectAligned(note, window, width);
    }
  });

  it("keeps beat-spaced notes on a known phase at several zooms", () => {
    const notes = [0, 500, 1000, 1500].map(us);
    for (const view of views()) {
      for (const note of notes) {
        expectAligned(note, view.window, view.width);
      }
      const marks = rulerMarks(view.window, grid);
      const beat = marks.find((mark) => mark.time === us(500));
      if (beat && us(500) >= view.window.start && us(500) <= view.window.end) {
        expect(timeToX(beat.time, view.window, view.width)).toBeCloseTo(timeToX(notes[1], view.window, view.width), 4);
      }
    }
    const bars = rulerMarks({ start: 0n, end: 2n * US }, grid).filter((mark) => mark.kind === "bar");
    expect(bars.map((mark) => mark.label)).toEqual(["1", "2"]);
  });

  it("leaves a rolled chord at its own onsets", () => {
    const roll = [0, 18, 41, 73].map(us);
    const window = { start: 0n, end: US };
    const xs = roll.map((time) => timeToX(time, window, 1000));
    expect(xs[1] - xs[0]).toBeGreaterThan(10);
    expect(xs[3] - xs[2]).toBeGreaterThan(20);
    for (const time of roll) {
      expectAligned(time, window, 390);
      expectAligned(time, window, 1280);
    }
    const beat = rulerMarks(window, grid).find((mark) => mark.time === 0n);
    expect(beat).toBeTruthy();
    expect(timeToX(roll[2], window, 1000)).not.toBeCloseTo(timeToX(0n, window, 1000), 0);
  });

  it("keeps a pickup before bar 1 and does not renumber it as bar 1", () => {
    const phase = US;
    const pickup = us(750);
    const known: KnownGrid = { bpm: 120, beatsPerBar: 4, phase };
    const marks = rulerMarks({ start: 0n, end: 2n * US }, known);
    expect(marks.find((mark) => mark.kind === "bar" && mark.label === "1")?.time).toBe(phase);
    expect(pickup < phase).toBe(true);
    expect(timeToX(pickup, { start: 0n, end: 2n * US }, 800)).toBeLessThan(timeToX(phase, { start: 0n, end: 2n * US }, 800));
    expectAligned(pickup, { start: 0n, end: 2n * US }, 800);
    expectAligned(pickup, zoomWindow({ start: 0n, end: 2n * US }, 0.5, pickup, us(100), 8n * US), 800);
  });

  it("does not pull rubato notes onto the grid", () => {
    const rubato = [0, 420, 980, 1410].map(us);
    const known: KnownGrid = { bpm: 120, beatsPerBar: 4, phase: 0n };
    const window = { start: 0n, end: 2n * US };
    for (const time of rubato) {
      expectAligned(time, window, 1280);
      const box = noteBox(time, time + us(180), 64, window, 1280, 72, 16);
      expect(box.x).toBeCloseTo(timeToX(time, window, 1280), 4);
    }
    expect(timeToX(rubato[1], window, 1280)).not.toBeCloseTo(timeToX(us(500), window, 1280), 0);
    expect(rulerMarks(window, null).every((mark) => mark.kind === "second")).toBe(true);
    expect(rulerMarks(window, known).some((mark) => mark.kind === "bar")).toBe(true);
  });

  it("keeps the silent tail inside the loop end with no note stretched over it", () => {
    const noteStart = us(1600);
    const noteEnd = us(1900);
    const loopEnd = us(2500);
    const window = framePhrase(0n, 0n, loopEnd);
    expect(window.end).toBe(loopEnd);
    const box = noteBox(noteStart, noteEnd, 60, window, 1000, 72, 16);
    const tail = timeToX(loopEnd, window, 1000) - timeToX(noteEnd, window, 1000);
    expect(tail).toBeGreaterThan(box.width);
    expect(box.x + box.width).toBeCloseTo(timeToX(noteEnd, window, 1000), 4);
    expectAligned(noteEnd, window, 1000);
    expectAligned(loopEnd, window, 390);
  });

  it("uses seconds when phase is missing, including when a BPM exists", () => {
    const window = { start: 0n, end: 4n * US };
    expect(rulerMarks(window, null).every((mark) => mark.kind === "second")).toBe(true);
    expect(rulerMarks(window, null).some((mark) => mark.label === "1")).toBe(false);
  });

  it("pans and zooms without moving the timestamp", () => {
    const note = us(1234);
    const framed = framePhrase(0n, 0n, 4n * US);
    const zoomed = zoomWindow(framed, 0.5, note, us(80), 20n * US);
    const panned = panWindow(zoomed, us(200), 0n);
    expect(pitchToY(60, 72, 18)).toBe(12 * 18);
    for (const window of [framed, zoomed, panned]) {
      expectAligned(note, window, 390);
      expectAligned(note, window, 1280);
    }
  });
});

it("labels an inferred four-bar endpoint on the exact snap lattice", () => {
  const duration = 12_151_899n;
  const grid = { bpm: 960_000_000 / Number(duration), beatsPerBar: 4, phase: 6_890_000n };
  expect(musicalPosition(grid.phase + duration, grid)).toBe("5.1");
  expect(musicalPosition(grid.phase + duration - 1n, grid)).toBe("4.4");
  expect(musicalPosition(grid.phase, grid)).toBe("1.1");
});
