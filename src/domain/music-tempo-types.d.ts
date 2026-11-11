declare module "music-tempo/dist/node/TempoInduction.js" {
  interface Clusters { clIntervals: number[]; clSizes: number[] }
  interface Scores { clScores: number[]; clScoresIdxs: number[] }
  export default class TempoInduction {
    static processRhythmicEvents(events: number[], params?: Record<string, number>): Clusters;
    static mergeClusters(clusters: Clusters, params?: Record<string, number>): Clusters;
    static calculateScore(clusters: Clusters, params?: Record<string, number>): Scores;
    static createTempoList(clusters: Clusters & Scores, params?: Record<string, number>): number[];
  }
}
declare module "music-tempo/dist/node/BeatTracking.js" {
  interface BeatAgent { beatInterval: number; initialBeatInterval: number; beatTime: number; events: number[]; score: number; totalBeatCount: number }
  export default class BeatTracking {
    static trackBeat(events: number[], saliences: number[], tempos: number[], params?: Record<string, number>): BeatAgent[];
  }
}
