import type { CapturedEvent } from "./capture";

export interface SwingReport {
  longTicks: bigint;
  shortTicks: bigint;
  ratio: number;
}

export interface GapReport {
  start: bigint;
  end: bigint;
  duration: bigint;
}

export interface InferenceReport {
  pulse: "none" | "estimated";
  reason: string;
  periodTicks: bigint | null;
  bpm: number | null;
  halfPeriodTicks: bigint | null;
  doublePeriodTicks: bigint | null;
  halfScore: number | null;
  doubleScore: number | null;
  primaryScore: number | null;
  ambiguity: "no-pulse" | "half-double" | "primary-stronger";
  ambiguityNote: string;
  swing: SwingReport | null;
  gaps: GapReport[];
  falseStart: boolean;
  staggeredChordCount: number;
  maxStaggerTicks: bigint;
  syncopationCount: number | null;
  pickupCandidate: boolean;
  missingSourceTimestamps: number;
  onsetCount: number;
}

const NONE: InferenceReport = {
  pulse: "none",
  reason: "No clear pulse.",
  periodTicks: null,
  bpm: null,
  halfPeriodTicks: null,
  doublePeriodTicks: null,
  halfScore: null,
  doubleScore: null,
  primaryScore: null,
  ambiguity: "no-pulse",
  ambiguityNote: "There is not a stable pulse to halve or double.",
  swing: null,
  gaps: [],
  falseStart: false,
  staggeredChordCount: 0,
  maxStaggerTicks: 0n,
  syncopationCount: null,
  pickupCandidate: false,
  missingSourceTimestamps: 0,
  onsetCount: 0,
};

function ticks(ms: number, ticksPerSecond: number): bigint {
  return BigInt(Math.round((ms / 1000) * ticksPerSecond));
}

function scoreLag(onsets: bigint[], lag: bigint, tolerance: bigint): number {
  let hits = 0;
  for (let i = 0; i < onsets.length; i += 1) {
    const target = onsets[i] + lag;
    for (let j = i + 1; j < onsets.length; j += 1) {
      const delta = onsets[j] > target ? onsets[j] - target : target - onsets[j];
      if (delta <= tolerance) {
        hits += 1;
        break;
      }
      if (onsets[j] > target + tolerance) {
        break;
      }
    }
  }
  return hits;
}

export function inferPulse(events: readonly CapturedEvent[], ticksPerSecond: number): InferenceReport {
  const missingSourceTimestamps = events.filter((event) => event.missingSourceTimestamp).length;
  const noteOns = events
    .filter((event) => event.kind === "note-on" && event.velocity > 0 && event.origin !== "synthetic-overflow")
    .slice()
    .sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : a.sequence < b.sequence ? -1 : 1));
  const chordWindow = ticks(40, ticksPerSecond);
  const clusters: bigint[][] = [];
  for (const event of noteOns) {
    const last = clusters[clusters.length - 1];
    if (last && event.scheduleElapsed - last[0] <= chordWindow) {
      last.push(event.scheduleElapsed);
    } else {
      clusters.push([event.scheduleElapsed]);
    }
  }
  const staggered = clusters.filter((cluster) => cluster.length > 1);
  const maxStagger = staggered.reduce((max, cluster) => {
    const span = cluster[cluster.length - 1] - cluster[0];
    return span > max ? span : max;
  }, 0n);
  const onsets = clusters.map((cluster) => cluster[0]);
  const base = {
    ...NONE,
    missingSourceTimestamps,
    onsetCount: onsets.length,
    staggeredChordCount: staggered.length,
    maxStaggerTicks: maxStagger,
  };
  if (onsets.length < 4) {
    return { ...base, reason: "Too few attacks to estimate a pulse." };
  }
  const iois: bigint[] = [];
  for (let i = 1; i < onsets.length; i += 1) {
    iois.push(onsets[i] - onsets[i - 1]);
  }
  const sorted = iois.slice().sort((a, b) => (a < b ? -1 : 1));
  const median = sorted[Math.floor(sorted.length / 2)];
  const gapLimit = median * 4n > ticks(2000, ticksPerSecond) ? median * 4n : ticks(2000, ticksPerSecond);
  const gaps: GapReport[] = [];
  const segments: bigint[][] = [[]];
  segments[0].push(onsets[0]);
  for (let i = 1; i < onsets.length; i += 1) {
    const gap = onsets[i] - onsets[i - 1];
    if (gap > gapLimit) {
      gaps.push({ start: onsets[i - 1], end: onsets[i], duration: gap });
      segments.push([onsets[i]]);
    } else {
      segments[segments.length - 1].push(onsets[i]);
    }
  }
  let chosen = segments[0];
  let falseStart = false;
  if (segments.length > 1 && segments[0].length < 4) {
    falseStart = true;
    chosen = segments.reduce((best, segment) => (segment.length > best.length ? segment : best));
  }
  if (chosen.length < 4) {
    return { ...base, gaps, falseStart, reason: "The attacks do not settle into a pulse." };
  }
  const chosenIois: bigint[] = [];
  for (let i = 1; i < chosen.length; i += 1) {
    chosenIois.push(chosen[i] - chosen[i - 1]);
  }
  let swing: SwingReport | null = null;
  if (chosenIois.length >= 4) {
    const longs: bigint[] = [];
    const shorts: bigint[] = [];
    for (let i = 0; i + 1 < chosenIois.length; i += 2) {
      const a = chosenIois[i];
      const b = chosenIois[i + 1];
      if (a >= b) {
        longs.push(a);
        shorts.push(b);
      } else {
        longs.push(b);
        shorts.push(a);
      }
    }
    const longAvg = longs.reduce((sum, value) => sum + value, 0n) / BigInt(longs.length);
    const shortAvg = shorts.reduce((sum, value) => sum + value, 0n) / BigInt(shorts.length);
    if (shortAvg > 0n) {
      const ratio = Number(longAvg) / Number(shortAvg);
      const sums = longs.map((value, index) => value + shorts[index]);
      const sumAvg = sums.reduce((sum, value) => sum + value, 0n) / BigInt(sums.length);
      const stable = sums.every((value) => {
        const delta = value > sumAvg ? value - sumAvg : sumAvg - value;
        return delta * 100n <= sumAvg * 12n;
      });
      if (stable && ratio >= 1.3 && ratio <= 2.2) {
        swing = { longTicks: longAvg, shortTicks: shortAvg, ratio };
      }
    }
  }
  const minLag = ticks(60, ticksPerSecond);
  const maxLag = ticks(2000, ticksPerSecond);
  let bestLag = 0n;
  let bestScore = 0;
  const step = ticks(5, ticksPerSecond);
  for (let lag = minLag; lag <= maxLag; lag += step < 1n ? 1n : step) {
    const tolerance = lag / 12n > ticks(15, ticksPerSecond) ? lag / 12n : ticks(15, ticksPerSecond);
    const score = scoreLag(chosen, lag, tolerance);
    if (score > bestScore || (score === bestScore && (bestLag === 0n || lag < bestLag))) {
      bestScore = score;
      bestLag = lag;
    }
  }
  if (swing) {
    const beat = swing.longTicks + swing.shortTicks;
    const tolerance = beat / 12n > ticks(15, ticksPerSecond) ? beat / 12n : ticks(15, ticksPerSecond);
    const swingScore = scoreLag(chosen, beat, tolerance);
    if (swingScore >= bestScore) {
      bestLag = beat;
      bestScore = swingScore;
    }
  }
  if (bestScore < chosen.length * 0.45) {
    return {
      ...base,
      gaps,
      falseStart,
      swing,
      reason: "No lag explains enough of the attacks.",
    };
  }
  const half = bestLag / 2n;
  const double = bestLag * 2n;
  const halfScore = half >= minLag ? scoreLag(chosen, half, half / 8n > ticks(15, ticksPerSecond) ? half / 8n : ticks(15, ticksPerSecond)) : 0;
  const doubleScore = double <= maxLag * 2n ? scoreLag(chosen, double, double / 8n) : 0;
  const ambiguous = doubleScore >= bestScore * 0.85 || (halfScore >= bestScore * 0.85 && half >= minLag);
  const bpm = (ticksPerSecond * 60) / Number(bestLag);
  let syncopation = 0;
  const gridTolerance = bestLag / 8n > ticks(20, ticksPerSecond) ? ticks(20, ticksPerSecond) : bestLag / 8n;
  for (const onset of chosen) {
    const phase = (onset - chosen[0]) % bestLag;
    const distance = phase < bestLag - phase ? phase : bestLag - phase;
    if (distance > gridTolerance) {
      syncopation += 1;
    }
  }
  const pickupCandidate = chosenIois.length > 0 && chosenIois[0] * 10n < bestLag * 6n;
  return {
    pulse: "estimated",
    reason: "A repeating attack interval is present. It does not prove the bar.",
    periodTicks: bestLag,
    bpm,
    halfPeriodTicks: half >= minLag ? half : null,
    doublePeriodTicks: double,
    halfScore,
    doubleScore,
    primaryScore: bestScore,
    ambiguity: ambiguous ? "half-double" : "primary-stronger",
    ambiguityNote: ambiguous
      ? "Half-time or double-time also lands on many of these attacks. The recording is unchanged."
      : "One interval fits better than its half or double. Both remain available. The recording is unchanged.",
    swing,
    gaps,
    falseStart,
    staggeredChordCount: staggered.length,
    maxStaggerTicks: maxStagger,
    syncopationCount: syncopation,
    pickupCandidate,
    missingSourceTimestamps,
    onsetCount: onsets.length,
  };
}
