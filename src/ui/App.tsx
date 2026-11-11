import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { defaultEnvelope, clampEnvelope, type InstrumentId, type SynthEnvelope } from "../audio/instruments";
import { SynthControls } from "./SynthControls";
import { type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { LayerTape, type TapeCheckpoint } from "../domain/layer-tape";
import { inferPulse, type InferenceReport } from "../domain/inference";
import { capturePerformance, defaultOverlay, loopWindow, type Performance, type PhraseOverlay } from "../domain/phrase";
import { beatForCut, createProject, projectFromJson, projectToJson, type Project } from "../domain/project";
import { eventsInSelection, recentPhraseCut, withCaptureRange, type RecentPhraseCut } from "../domain/recent-phrase";
import { preferCaptureBars } from "../domain/capture-bars";
import { recordedTake } from "../domain/explicit-recording";
import { rangeForBars, tempoForBars, type FixedBars } from "./loop-assist";
import { routeLearnedControl, type ControlMap, type LearnTarget } from "../domain/learn";
import { loopEvents } from "../domain/loop-events";
import { Roll, type RollTool, type RollViewAction } from "./Roll";
import { Editor } from "./Editor";
import { TouchKeyboard } from "./TouchKeyboard";
import { SNAP_PRESETS, type SnapDivision, type SnapMode } from "./snap";
import { SelectControl } from "./SelectControl";
import { TempoControl } from "./TempoControl";
import { LoopSettings, LoopLengthControl } from "./LoopSettings";
import { LayerVolume } from "./LayerVolume";
import { ReadinessStrip } from "./Readiness";
import { moveBound, undoRange, type RangeBounds } from "./range";
import { applyPreview, notesFromEvents, quantisePreview, workingPlayback, setVelocity, type RollNote } from "./roll-notes";
import { beatTicks, editorFrame, zoomWindow, type KnownGrid, type TimeWindow } from "./roll-time";
import { playChrome, resolveTheme, type ThemeChoice } from "./theme";
import { touchFromPress, type PressPhase } from "./keys";

const engine = createEngine();
const NOTES = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72];
const NAMES = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E", "F", "G", "A", "B", "C"];
const EVENT_CAP = 4096;
const BYTE_CAP = 262144;

interface TempoSnapshot { project: Pick<Project, "tempoBpm" | "proposedTempoBpm" | "gridLocked">; settings: { bpm: number; beatsPerBar: number }; grids: Record<string, KnownGrid | null> }
interface EditSnapshot { mainExtent?: RangeBounds; notes: RollNote[]; bounds: RangeBounds; edited: boolean; grid: KnownGrid | null; tempo?: TempoSnapshot }
interface SoundSettings { instrumentId: InstrumentId; envelope: SynthEnvelope }
interface Take {
  id: string;
  sound: SoundSettings;
  volume?: number;
  mainExtent?: RangeBounds;
  performance: Performance;
  overlay: PhraseOverlay;
  report: InferenceReport;
  cut: RecentPhraseCut;
  /** Inferred period end. The end handle can move through the silence up to here. */
  rangeCeiling: bigint;
  rollNotes: RollNote[];
  rollPast: EditSnapshot[];
  rollFuture: EditSnapshot[];
  rollGrid: KnownGrid | null;
  rollEdited: boolean;
}

interface UndoCapture {
  takes: Take[];
  tape: TapeCheckpoint;
  livePhase: bigint | null;
  project: Project;
  gridSettings: { bpm: number; beatsPerBar: number };
}

function unitFor(domain: CapturedEvent["domain"]): number {
  return domain === "android-monotonic-ns" ? 1_000_000_000 : 1_000_000;
}

function seconds(elapsed: bigint, domain: CapturedEvent["domain"]): string {
  const value = Number(elapsed) / unitFor(domain);
  if (!Number.isFinite(value) || value < 0) {
    return "0s";
  }
  return value.toFixed(1) + "s";
}

export default function App() {
  const { width, height } = useWindowDimensions();
  const chrome = playChrome(width);
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("system");
  const [systemDark, setSystemDark] = useState(true);
  const palette = resolveTheme(themeChoice, systemDark);
  const domain = engine.domain;
  const history = useMemo(
    () => new LayerTape(domain, BigInt(unitFor(domain) * 120), EVENT_CAP, BYTE_CAP),
    [domain],
  );
  const [project, setProject] = useState<Project>(createProject());
  const [gate, setGate] = useState(engine.getGate());
  const [ribbon, setRibbon] = useState<CapturedEvent[]>([]);
  const livePhase = useRef<bigint | null>(null);
  const [notice, setNotice] = useState<RibbonNotice>({ kind: "none" });
  const [takes, setTakes] = useState<Take[]>([]);
  const [nextSound, setNextSound] = useState<SoundSettings>({ instrumentId: "blocks.ep.fm.v1", envelope: defaultEnvelope("blocks.ep.fm.v1") });
  const [soundTarget, setSoundTarget] = useState<string | null | undefined>(undefined);
  const [soundPreview, setSoundPreview] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loopingIds, setLoopingIds] = useState<string[]>([]);
  const [undo, setUndo] = useState<UndoCapture | null>(null);
  const [deletedTake, setDeletedTake] = useState<{ item: Take; index: number; playing: boolean } | null>(null);
  const [layerMenu, setLayerMenu] = useState<string | null>(null);
  const [rangeMode, setRangeMode] = useState(false);
  const [captureRange, setCaptureRange] = useState<RangeBounds | null>(null);
  const [captureRangeUndo, setCaptureRangeUndo] = useState<{ bounds: RangeBounds | null } | null>(null);
  const [captureView, setCaptureView] = useState<TimeWindow | null>(null);
  const [captureCustomSnap, setCaptureCustomSnap] = useState(false);
  const [captureFraction, setCaptureFraction] = useState("1/12");
  const [historyViewAction, setHistoryViewAction] = useState<RollViewAction>();
  const recording = useRef<{ start: bigint; events: CapturedEvent[] } | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(true);
  const compactPlay = keyboardOpen && width < 700;
  const compactTimeline = compactPlay && height < 800;
  const historyHeight = keyboardOpen ? Math.max(104, Math.min(168, height - (compactPlay ? 684 : 824))) : width >= 1000 ? 240 : 180;
  const nextLayerId = useRef(1);
  const [boundsUndo, setBoundsUndo] = useState<{ id: string; bounds: RangeBounds } | null>(null);
  const [learning, setLearning] = useState<LearnTarget | null>(null);
  const [room, setRoom] = useState(false);
  const [rollTool, setRollTool] = useState<RollTool>("select");
  const [snapDivision, setSnapDivision] = useState<SnapDivision>({ kind: "note", numerator: 1, denominator: 4 });
  const [snapMode, setSnapMode] = useState<SnapMode>("grid");
  const [editorGridSettings, setEditorGridSettings] = useState({ bpm: 120, beatsPerBar: 4 });
  const [loopBars, setLoopBars] = useState<FixedBars | null>(4);
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(true);
  const [quantiseStrength, setQuantiseStrength] = useState(100);
  const [quantiseSwing, setQuantiseSwing] = useState(0);
  const [noteClipboard, setNoteClipboard] = useState<RollNote[]>([]);
  const editSession = useRef<{ id: string; before: EditSnapshot; pastLength: number } | null>(null);
  const [sessionUndo, setSessionUndo] = useState<{ id: string; before: EditSnapshot } | null>(null);
  const [ghosts, setGhosts] = useState<{ id: string; start: bigint; end: bigint }[]>([]);
  const [rollWindow, setRollWindow] = useState<TimeWindow | null>(null);
  const [bpmText, setBpmText] = useState("120");
  const [meterText, setMeterText] = useState("4");
  const [panel, setPanel] = useState<"settings" | "grid" | "quantise" | "loop" | null>(null);
  const [audioState, setAudioState] = useState(engine.readAudioState());
  const [scheduled, setScheduled] = useState(0);
  const loopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Take | null>(null);
  const learningRef = useRef<LearnTarget | null>(null);
  const mapRef = useRef<ControlMap>({ capture: null, transport: null });
  const actions = useRef({ capture: () => {}, togglePlay: () => {} });
  const historyActions = useRef({ undo: () => {}, redo: () => {}, room: false });
  const heldTouch = useRef(new Set<number>());

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 6000);
    return () => clearTimeout(timer);
  }, [message]);

  function pressKey(note: number, phase: PressPhase) {
    const action = touchFromPress(phase);
    if (action === "on") {
      heldTouch.current.add(note);
      engine.touch(note, 100, true);
    } else if (action === "off") {
      if (heldTouch.current.has(note)) {
        heldTouch.current.delete(note);
        engine.touch(note, 0, false);
      }
    }
  }

  useEffect(() => {
    const saved = window.localStorage.getItem("blocks.appearance");
    if (saved === "light" || saved === "dark" || saved === "system") {
      setThemeChoice(saved);
    }
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemDark(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    let stop = false;
    engine.loadProject().then((text) => {
      if (stop) {
        return;
      }
      const loaded = projectFromJson(text);
      if (loaded) {
        setProject(loaded);
        if (loaded.gridLocked && loaded.tempoBpm) setEditorGridSettings(settings => ({ ...settings, bpm: loaded.tempoBpm! }));
        mapRef.current = { capture: loaded.captureControl, transport: loaded.transportControl };
        engine.setSustain(loaded.sustainCc);
      }
    });
    const unsubscribe = engine.subscribe((event) => {
      const captured = history.push(event);
      if (recording.current) recording.current.events.push(captured);
      if (event.kind === "note-on" || event.kind === "note-off") {
        setCaptureRange(null); setCaptureRangeUndo(null); setCaptureView(null);
      }
      if (event.kind === "note-on" && event.velocity > 0) {
        if (livePhase.current === null) livePhase.current = captured.scheduleElapsed;
        if (!historyActions.current.room) setRangeMode(false);
      }
      setRibbon(history.snapshot());
      setNotice(history.ribbonNotice());
      const routed = routeLearnedControl(event, learningRef.current, mapRef.current);
      if (routed.decision) {
        if (routed.decision.accept) {
          const nextMap = { ...mapRef.current, [learningRef.current === "transport" ? "transport" : "capture"]: routed.decision.controller };
          mapRef.current = nextMap;
          learningRef.current = null;
          setLearning(null);
          setProject((current) => {
            const next = { ...current, captureControl: nextMap.capture, transportControl: nextMap.transport };
            engine.saveProject(projectToJson(next));
            return next;
          });
        }
        setMessage(routed.decision.message);
        return;
      }
      if (routed.fire === "capture") {
        actions.current.capture();
      } else if (routed.fire === "transport") {
        actions.current.togglePlay();
      }
    });
    const timer = setInterval(() => {
      setGate(engine.getGate());
      setAudioState(engine.readAudioState());
      engine.stats().then((text) => {
        try {
          const parsed = JSON.parse(text) as { scheduled?: number };
          if (typeof parsed.scheduled === "number") {
            setScheduled(parsed.scheduled);
          }
        } catch {
          // stats stay on the previous reading
        }
      });
    }, 400);
    const releaseTouch = () => {
      for (const note of heldTouch.current) {
        engine.touch(note, 0, false);
      }
      heldTouch.current.clear();
    };
    window.addEventListener("blur", releaseTouch);
    return () => {
      stop = true;
      unsubscribe();
      clearInterval(timer);
      window.removeEventListener("blur", releaseTouch);
      if (loopTimer.current) {
        clearTimeout(loopTimer.current);
      }
    };
  }, [history]);

  const take = takes.find((item) => item.id === selected) ?? null;
  const looping = take ? loopingIds.includes(take.id) : false;
  useEffect(() => {
    if (!take || (!room && !rangeMode)) return;
    engine.setLiveInstrument(take.sound.instrumentId, take.sound.envelope);
    setNextSound({ ...take.sound, envelope: { ...take.sound.envelope } });
    if (room) engine.setAuditionInstrument(take.sound.instrumentId, take.sound.envelope);
  }, [room, rangeMode, take?.id, take?.sound]);
  const newest = ribbon.length ? ribbon[ribbon.length - 1].scheduleElapsed : 0n;
  const age = ribbon.length ? newest - ribbon[0].scheduleElapsed : 0n;
  const automaticCut = useMemo(() => recentPhraseCut(ribbon, {
    ticksPerSecond: unitFor(domain),
    gridPeriodTicks: takes.length && beatForCut(project) ? BigInt(Math.round(60 / beatForCut(project)! * unitFor(domain))) : null,
    gridOriginTicks: livePhase.current,
    historyMayBeTruncated: notice.kind !== "none",
  }), [ribbon, project, takes, notice.kind, domain]);
  const liveBounds = captureRange ?? automaticCut.loop;
  const liveGrid: KnownGrid = { ...editorGridSettings, phase: livePhase.current ?? 0n };
  const liveFrame = captureView ?? editorFrame(ribbon[0]?.scheduleElapsed ?? 0n, liveBounds.start, liveBounds.end, liveGrid, 2);
  const liveNotes = useMemo(() => notesFromEvents(ribbon), [ribbon]);
  const snapPreset = SNAP_PRESETS.find(item => JSON.stringify(item.division) === JSON.stringify(snapDivision));

  useEffect(() => {
    if (captureRange && ribbon.length && captureRange.start < ribbon[0].scheduleElapsed) {
      setCaptureRange(null); setCaptureRangeUndo(null); setCaptureView(null);
      setMessage("That range has left the live history. Auto range restored.");
    }
  }, [ribbon, captureRange]);

  function stopLoop() {
    if (!take) {
      return;
    }
    engine.stopLayer(take.id);
    setLoopingIds((current) => current.filter((id) => id !== take.id));
  }

  function playTake(item: Take, updateAtSeam = false) {
    engine.setLayerInstrument(item.id, item.sound.instrumentId, item.sound.envelope);
    const scheduleLayer = updateAtSeam ? engine.updateLayer : engine.loopLayer;
    const bounds = loopWindow(item.overlay);
    const durationSec = Number(bounds.end - bounds.start) / unitFor(domain);
    if (!Number.isFinite(durationSec) || durationSec <= 0) { setMessage("Choose a positive loop range."); return; }
    const controllerSeed = withCaptureRange(item.performance.events, item.cut, bounds).controllerSeed;
    if (item.rollEdited) {
      const played = workingPlayback(item.performance.events, item.rollNotes, bounds, item.performance.domain);
      const preface = controllerSeed.map((seed) => {
        const source = item.performance.events.find((event) => event.id === seed.sourceId) ?? item.performance.events[0];
        return { ...source, id: seed.sourceId + ":seed", kind: "cc" as const, channel: seed.channel, controller: seed.controller, value: seed.value, note: 0, velocity: 0, scheduleElapsed: bounds.start };
      });
      const selectedEvents = [...preface, ...played].sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
      if (!updateAtSeam && !selectedEvents.some((event) => event.kind === "note-on" && event.velocity > 0)) {
        setMessage("That loop contains no recorded notes.");
        return;
      }
      scheduleLayer(item.id, selectedEvents, 1, durationSec, bounds.start);
      setLoopingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
      return;
    }
    const preface = controllerSeed.map((seed) => {
      const source = item.performance.events.find((event) => event.id === seed.sourceId) ?? item.performance.events[0];
      return { ...source, id: seed.sourceId + ":seed", kind: "cc" as const, channel: seed.channel, controller: seed.controller, value: seed.value, note: 0, velocity: 0, scheduleElapsed: bounds.start };
    });
    const selectedEvents = [
      ...preface,
      ...loopEvents(item.performance.events, bounds),
    ];
    if (!selectedEvents.some((event) => event.kind === "note-on" && event.velocity > 0)) {
      setMessage("That loop contains no recorded notes.");
      return;
    }
    scheduleLayer(item.id, selectedEvents, 1, durationSec, bounds.start);
    setLoopingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
  }

  async function enable() {
    setBusy(true);
    try {
      const next = await engine.enable();
      setGate(engine.getGate());
      setAudioState(engine.readAudioState());
      setMessage(next.kind === "site-addon" ? "Firefox needs its site-permission add-on before MIDI. On-screen keys still play." : "");
    } finally {
      setBusy(false);
    }
  }

  function capture() {
    if (recording.current) return;
    saveCapture(history.snapshot(), captureRange ?? undefined);
  }

  function toggleRecord() {
    const now = BigInt(Math.round(performance.now() * unitFor(domain) / 1000));
    if (!recording.current) {
      recording.current = { start: now, events: [] }; setIsRecording(true); setRangeMode(false);
      setMessage("Recording"); return;
    }
    const session = recording.current;
    recording.current = null; setIsRecording(false);
    const recorded = recordedTake(session.events, session.start, now > session.start ? now : session.start + 1n, domain);
    if (!recorded.events.some(event => event.kind === "note-on" && event.velocity > 0)) { setMessage("No notes recorded."); return; }
    saveCapture(recorded.events, recorded.bounds, true);
  }

  function saveCapture(events: CapturedEvent[], chosenRange?: RangeBounds, explicitRecording = false) {
    if (!events.some(event => event.kind === "note-on" && event.velocity > 0)) {
      setMessage("Nothing to capture yet — play something");
      return;
    }
    const ticksPerSecond = unitFor(domain);
    const tempoForCut = takes.length ? beatForCut(project) : null;
    const automatic = recentPhraseCut(events, {
      ticksPerSecond,
      gridPeriodTicks: tempoForCut ? BigInt(Math.round((60 / tempoForCut) * ticksPerSecond)) : null,
      gridOriginTicks: explicitRecording ? chosenRange?.start ?? null : livePhase.current,
      historyMayBeTruncated: notice.kind !== "none",
    });
    if (!explicitRecording && chosenRange && chosenRange.start < events[0].scheduleElapsed) {
      setCaptureRange(null); setCaptureView(null); setMessage("That range has left the live history. Choose a new range."); return;
    }
    let cut = chosenRange ? withCaptureRange(events, automatic, chosenRange) : automatic;
    let report = inferPulse(eventsInSelection(events, cut.selection), ticksPerSecond);
    if (!chosenRange && !explicitRecording) {
      cut = preferCaptureBars(events, cut, takes.length ? liveGrid.bpm : report.bpm, loopBars, editorGridSettings.beatsPerBar, ticksPerSecond);
      report = inferPulse(eventsInSelection(events, cut.selection), ticksPerSecond);
    }
    const performance = capturePerformance(events);
    const overlay = {
      ...defaultOverlay(events),
      selectionStart: cut.selection.start,
      selectionEnd: cut.selection.end,
      loopStart: cut.loop.start,
      loopEnd: cut.loop.end,
      quantiseStrength: 0,
      playback: { mode: "original" as const },
    };
    // The first performance establishes the sketch tempo. An older saved sketch's
    // tempo must not suppress this reading; later layers follow the first layer.
    const predictedBpm = report.pulse === "estimated" && report.bpm !== null && Number.isFinite(report.bpm) && report.bpm > 0 ? report.bpm : null;
    const captureBpm = takes.length === 0 && predictedBpm !== null ? predictedBpm : liveGrid.bpm;
    const capturedProject = takes.length === 0 ? { ...project, tempoBpm: captureBpm, proposedTempoBpm: predictedBpm, gridLocked: true } : project;
    const id = "layer-" + nextLayerId.current++;
    const editingGrid: KnownGrid = { ...liveGrid, bpm: captureBpm, phase: cut.loop.start, provisional: takes.length === 0 && predictedBpm !== null };
    const created: Take = { id, sound: { ...nextSound, envelope: { ...nextSound.envelope } }, performance, overlay, report, cut, rangeCeiling: cut.loop.end, rollNotes: notesFromEvents(events), rollPast: [], rollFuture: [], rollGrid: editingGrid, rollEdited: false };
    setUndo({ takes, tape: history.checkpoint(), livePhase: livePhase.current, project, gridSettings: editorGridSettings });
    history.advance(); livePhase.current = null; setRibbon([]); setNotice({ kind: "none" });
    setDeletedTake(null); setSessionUndo(null); setLayerMenu(null); setRangeMode(true);
    setCaptureRange(null); setCaptureRangeUndo(null); setCaptureView(null);
    setTakes((current) => [...current, created]);
    setSelected(id);
    setProject(capturedProject);
    setEditorGridSettings(settings => ({ ...settings, bpm: captureBpm }));
    engine.saveProject(projectToJson(capturedProject));
    setMessage(takes.length === 0 && predictedBpm !== null ? `${explicitRecording ? "Recorded" : "Captured"} · ${Number(predictedBpm.toFixed(2))} BPM estimate` : explicitRecording ? "Recorded · Layer " + (takes.length + 1) : chosenRange ? "Captured · chosen range · Layer " + (takes.length + 1) : cut.status === "recent" ? "Captured · Layer " + (takes.length + 1) : "Captured · no clear rest; kept the available phrase.");
    if (project.afterCapture === "silent") {
      return;
    }
    playTake(created);
  }

  function undoCapture() {
    if (deletedTake) {
      const restored = deletedTake;
      setTakes(current => { const next = [...current]; next.splice(Math.min(restored.index, next.length), 0, restored.item); return next; });
      setSelected(restored.item.id); setDeletedTake(null); setMessage("Layer restored.");
      if (restored.playing) playTake(restored.item);
      return;
    }
    if (!undo) {
      return;
    }
    const removed = takes.find((item) => !undo.takes.some((kept) => kept.id === item.id));
    if (removed) {
      engine.stopLayer(removed.id);
      setLoopingIds((current) => current.filter((id) => id !== removed.id));
    }
    history.restore(undo.tape); livePhase.current = undo.livePhase;
    setRibbon(history.snapshot()); setNotice(history.ribbonNotice());
    setCaptureRange(null); setCaptureRangeUndo(null); setCaptureView(null); setRangeMode(false);
    setTakes(undo.takes);
    setProject(undo.project);
    setEditorGridSettings(undo.gridSettings);
    engine.saveProject(projectToJson(undo.project));
    setSelected(undo.takes.length ? undo.takes[undo.takes.length - 1].id : null);
    setUndo(null);
    setBoundsUndo(null);
    setMessage("Capture undone.");
  }

  function enterEditor(item: Take) {
    engine.setAuditionInstrument(item.sound.instrumentId, item.sound.envelope);
    const bounds = loopWindow(item.overlay);
    const grid = item.rollGrid ?? { ...editorGridSettings, phase: bounds.start, provisional: false };
    if (!item.rollGrid) setTakes(current => current.map(entry => entry.id === item.id ? { ...entry, rollGrid: grid } : entry));
    const historyStart = takeStart(item);
    setRollWindow(editorFrame(historyStart, bounds.start, bounds.end, grid, width >= 1100 ? 4 : 2));
    editSession.current = { id: item.id, before: { ...editSnapshot(item), tempo: tempoSnapshot() }, pastLength: item.rollPast.length };
    setSessionUndo(null);
    setRoom(true);
  }

  function drawMidi() {
    const grid: KnownGrid = { ...editorGridSettings, phase: 0n, provisional: false };
    const bounds = rangeForBars(0n, grid, loopBars ?? 4)!;
    const cut = withCaptureRange([], recentPhraseCut([], { ticksPerSecond: unitFor(domain), gridPeriodTicks: null, gridOriginTicks: null, historyMayBeTruncated: false }), bounds);
    const created: Take = { id: "layer-" + nextLayerId.current++, sound: { ...nextSound, envelope: { ...nextSound.envelope } }, performance: { domain, events: [] }, overlay: { selectionStart: bounds.start, selectionEnd: bounds.end, loopStart: bounds.start, loopEnd: bounds.end, tempoChoice: "estimated", phaseBeats: 0, quantiseStrength: 0, playback: { mode: "original" } }, report: inferPulse([], unitFor(domain)), cut, rangeCeiling: bounds.end, rollNotes: [], rollPast: [], rollFuture: [], rollGrid: grid, rollEdited: true };
    setUndo({ takes, tape: history.checkpoint(), livePhase: livePhase.current, project, gridSettings: editorGridSettings }); setDeletedTake(null);
    setTakes(items => [...items, created]); setSelected(created.id); setRangeMode(true); setRollTool("draw");
    enterEditor(created);
    void engine.resumeAudio().then(() => setAudioState(engine.readAudioState())).catch(() => setMessage("Sound could not start. Try Play again."));
  }

  function leaveEditor() {
    const session = editSession.current;
    const item = takes.find(entry => entry.id === session?.id);
    if (session && item && (!sameNotes(session.before.notes, item.rollNotes) || session.before.bounds.start !== loopWindow(item.overlay).start || session.before.bounds.end !== loopWindow(item.overlay).end)) {
      setSessionUndo({ id: item.id, before: session.before });
      setMessage(`Piano · ${Math.max(1, item.rollPast.length - session.pastLength)} edits`);
    }
    editSession.current = null; setRoom(false); setPanel(null);
  }

  function deleteCapture(id: string) {
    const index = takes.findIndex(item => item.id === id);
    if (index < 0) return;
    setDeletedTake({ item: takes[index], index, playing: loopingIds.includes(id) });
    engine.stopLayer(id); setLoopingIds(current => current.filter(value => value !== id));
    const remaining = takes.filter(item => item.id !== id);
    setTakes(remaining); setUndo(null); setSessionUndo(null); setBoundsUndo(null); setLayerMenu(null);
    if (selected === id) setSelected(remaining[Math.min(index, remaining.length - 1)]?.id ?? null);
    if (!remaining.length) { setRoom(false); setRangeMode(false); }
    setMessage(`Layer ${index + 1} deleted.`);
  }

  function selectNotes(ids: string[]) { setSelectedIds(ids); setSelectedNote(ids.at(-1) ?? null); }
  function selectionAction(action: "all" | "delete" | "copy" | "paste" | "duplicate") {
    if (!take || ghosts.length) return;
    const chosen = take.rollNotes.filter(note => selectedIds.includes(note.id));
    if (action === "all") { selectNotes(take.rollNotes.map(note => note.id)); return; }
    if (action === "copy") { setNoteClipboard(chosen.map(note => ({ ...note }))); return; }
    if (action === "delete") { commitRoll(take, take.rollNotes.filter(note => !selectedIds.includes(note.id))); selectNotes([]); return; }
    const source = action === "paste" ? noteClipboard : chosen;
    if (!source.length) return;
    const start = source.reduce((value, note) => note.start < value ? note.start : value, source[0].start);
    const end = source.reduce((value, note) => note.end > value ? note.end : value, source[0].end);
    const transport = engine.transport(take.id);
    const insertion = action === "duplicate" ? end : transport.availability === "available" && transport.positionSeconds !== null ? BigInt(Math.round(transport.positionSeconds * 1_000_000)) : loopWindow(take.overlay).start;
    const idPrefix = `copy-${Date.now()}-${take.rollPast.length}`;
    const added = source.map((note, index) => ({ ...note, id: `${idPrefix}-${index}`, start: note.start - start + insertion, end: note.end - start + insertion, sourceOnId: null, sourceOffId: null }));
    commitRoll(take, [...take.rollNotes, ...added]); selectNotes(added.map(note => note.id));
  }

  function commitBounds(item: Take, next: RangeBounds, resync = false) {
    const previous: RangeBounds = { start: item.overlay.loopStart ?? item.overlay.selectionStart, end: item.overlay.loopEnd ?? item.overlay.selectionEnd };
    if (next.end <= next.start || (previous.start === next.start && previous.end === next.end)) return;
    setBoundsUndo({ id: item.id, bounds: previous });
    const updated: Take = {
      ...item,
      overlay: { ...item.overlay, selectionStart: next.start, selectionEnd: next.end, loopStart: next.start, loopEnd: next.end },
      rangeCeiling: next.end > item.rangeCeiling ? next.end : item.rangeCeiling,
      rollPast: [...item.rollPast, editSnapshot(item)], rollFuture: [],
    };
    setTakes((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    setMessage("Loop range updated.");
    if (resync && takes[0]?.id === item.id) refreshEditedPlayback(updated, true);
    else if (loopingIds.includes(item.id)) playTake(updated, !resync);
  }

  function undoBounds() {
    if (take && boundsUndo?.id === take.id) { undoRoll(); return; }
    if (!boundsUndo) {
      return;
    }
    const item = takes.find((entry) => entry.id === boundsUndo.id);
    if (!item) {
      setBoundsUndo(null);
      return;
    }
    const restored = undoRange(boundsUndo.bounds, { start: item.overlay.loopStart ?? item.overlay.selectionStart, end: item.overlay.loopEnd ?? item.overlay.selectionEnd });
    const updated: Take = {
      ...item,
      overlay: { ...item.overlay, selectionStart: restored.start, selectionEnd: restored.end, loopStart: restored.start, loopEnd: restored.end },
    };
    setTakes((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    setBoundsUndo(null);
    setMessage("Range undone.");
    if (loopingIds.includes(item.id)) playTake(updated, true);
  }

  function commitRoll(item: Take, notes: RollNote[]) {
    if (sameNotes(item.rollNotes, notes)) { setGhosts([]); return; }
    setTakes((current) => current.map((entry) => (entry.id === item.id ? { ...entry, rollEdited: true, rollPast: [...entry.rollPast, editSnapshot(entry)], rollFuture: [], rollNotes: notes } : entry)));
    setGhosts([]);
    if (loopingIds.includes(item.id)) playTake({ ...item, rollEdited: true, rollNotes: notes }, true);
    setMessage(loopingIds.includes(item.id) ? "Edit saved · next loop." : "Edit saved.");
  }

  function undoRoll() {
    if (!take || take.rollPast.length === 0) {
      return;
    }
    const previous = take.rollPast[take.rollPast.length - 1];
    const reverse = { ...editSnapshot(take), ...(previous.tempo ? { tempo: tempoSnapshot() } : {}) };
    if (previous.tempo) restoreTempo(previous.tempo);
    const updated = restoreSnapshot(take, previous);
    refreshEditedPlayback(updated, !!previous.tempo || previous.bounds.start !== loopWindow(take.overlay).start || previous.bounds.end !== loopWindow(take.overlay).end);
    setTakes((current) => current.map((entry) => (entry.id === take.id ? { ...updated, rollPast: entry.rollPast.slice(0, -1), rollFuture: [reverse, ...entry.rollFuture] } : entry)));
    setBoundsUndo(null);
    setGhosts([]);
  }

  function redoRoll() {
    if (!take || take.rollFuture.length === 0) {
      return;
    }
    const next = take.rollFuture[0];
    const reverse = { ...editSnapshot(take), ...(next.tempo ? { tempo: tempoSnapshot() } : {}) };
    if (next.tempo) restoreTempo(next.tempo);
    const updated = restoreSnapshot(take, next);
    refreshEditedPlayback(updated, !!next.tempo || next.bounds.start !== loopWindow(take.overlay).start || next.bounds.end !== loopWindow(take.overlay).end);
    setTakes((current) => current.map((entry) => (entry.id === take.id ? { ...updated, rollFuture: entry.rollFuture.slice(1), rollPast: [...entry.rollPast, reverse] } : entry)));
    setBoundsUndo(null);
    setGhosts([]);
  }

  function undoSession() {
    if (!sessionUndo) return;
    const item = takes.find(entry => entry.id === sessionUndo.id);
    if (item) {
      if (sessionUndo.before.tempo) restoreTempo(sessionUndo.before.tempo);
      const updated = { ...restoreSnapshot(item, sessionUndo.before), rollPast: [...item.rollPast, { ...editSnapshot(item), ...(sessionUndo.before.tempo ? { tempo: tempoSnapshot() } : {}) }], rollFuture: [] };
      setTakes(items => items.map(entry => entry.id === item.id ? updated : entry));
      refreshEditedPlayback(updated, !!sessionUndo.before.tempo);
    }
    setSessionUndo(null);
  }

  function tempoSnapshot(): TempoSnapshot {
    return { project: { tempoBpm: project.tempoBpm, proposedTempoBpm: project.proposedTempoBpm, gridLocked: project.gridLocked }, settings: editorGridSettings, grids: Object.fromEntries(takes.map(item => [item.id, item.rollGrid])) };
  }

  function refreshEditedPlayback(item: Take, rebaseMaster = false) {
    if (!loopingIds.includes(item.id)) return;
    if (rebaseMaster && takes[0]?.id === item.id) {
      loopingIds.forEach(id => engine.stopLayer(id));
      playTake(item);
      takes.filter(entry => entry.id !== item.id && loopingIds.includes(entry.id)).forEach(entry => playTake(entry));
    } else playTake(item, true);
  }

  function restoreTempo(snapshot: TempoSnapshot) {
    setEditorGridSettings(snapshot.settings);
    setProject(current => { const next = { ...current, ...snapshot.project }; engine.saveProject(projectToJson(next)); return next; });
    setTakes(items => items.map(item => ({ ...item, rollGrid: item.id in snapshot.grids ? snapshot.grids[item.id] : item.rollGrid ? { ...item.rollGrid, ...snapshot.settings } : null })));
  }

  function resetLoop(item: Take) {
    if (!loopBars) return;
    const bounds = loopWindow(item.overlay);
    const next = rangeForBars(bounds.start, item.rollGrid ?? liveGrid, loopBars);
    if (!next) return;
    commitBounds(item, next, true);
    setRollWindow(editorFrame(takeStart(item), next.start, next.end, item.rollGrid ?? liveGrid, 4));
    setPanel(null);
    setMessage(`Loop reset to ${loopBars} bars. Notes are preserved.`);
  }

  function cutRange(item: Take) {
    const first = takes[0]?.id === item.id;
    const currentGrid = item.rollGrid ?? liveGrid;
    const selectedBounds = loopWindow(item.overlay);
    const bounds = !first && loopBars ? rangeForBars(selectedBounds.start, currentGrid, loopBars) : selectedBounds;
    if (!bounds) return;
    const bpm = first && loopBars ? tempoForBars(bounds, loopBars, currentGrid.beatsPerBar) : null;
    const grid = { ...currentGrid, ...(bpm ? { bpm, provisional: false } : {}), phase: bounds.start };
    const notes = item.rollNotes.filter(note => note.end > bounds.start && note.start < bounds.end).map(note => ({ ...note, start: note.start < bounds.start ? bounds.start : note.start, end: note.end > bounds.end ? bounds.end : note.end }));
    const before = { ...editSnapshot(item), ...(bpm ? { tempo: tempoSnapshot() } : {}) };
    const updated: Take = { ...item, mainExtent: bounds, overlay: { ...item.overlay, loopStart: bounds.start, loopEnd: bounds.end, selectionStart: bounds.start, selectionEnd: bounds.end }, rangeCeiling: bounds.end > item.rangeCeiling ? bounds.end : item.rangeCeiling, rollNotes: notes, rollEdited: true, rollGrid: grid, rollPast: [...item.rollPast, before], rollFuture: [] };
    if (bpm) changeCaptureTempo(bpm);
    setTakes(items => items.map(entry => entry.id === item.id ? updated : entry));
    setRollWindow(editorFrame(bounds.start, bounds.start, bounds.end, updated.rollGrid!, width >= 1100 ? 4 : 2));
    setBoundsUndo(null); setGhosts([]);
    if (bpm) refreshEditedPlayback(updated, true);
    else if (loopingIds.includes(item.id)) playTake(updated);
    setMessage(bpm ? `${loopBars} bars · ${Number(bpm.toFixed(2))} BPM. Undo restores the take and tempo.` : "Range cut. Layer starts at Bar 1. Undo restores the take.");
  }

  function showFullTake(explicitTake?: Take) {
    const item = explicitTake ?? (rangeMode ? take : null);
    const notes = item ? item.rollNotes : liveNotes;
    const events = item ? item.performance.events : ribbon;
    const grid = item?.rollGrid ?? liveGrid;
    const start = item ? takeStart(item) : events[0]?.scheduleElapsed ?? 0n;
    const recordedEnd = item ? (item.cut.loop.end > loopWindow(item.overlay).end ? item.cut.loop.end : loopWindow(item.overlay).end) : events[events.length - 1]?.scheduleElapsed ?? start + 1n;
    const end = notes.reduce((latest, note) => note.end > latest ? note.end : latest, recordedEnd);
    const frame = editorFrame(start, start, end, grid, 2);
    if (item) setRollWindow(frame); else setCaptureView(frame);
    setHistoryViewAction({ id: Date.now(), kind: "fit-pitches" });
  }

  function changeCaptureTempo(bpm: number) {
    setEditorGridSettings(settings => ({ ...settings, bpm }));
    setTakes(items => items.map(item => ({ ...item, rollGrid: { ...(item.rollGrid ?? liveGrid), bpm } })));
    setProject(current => { const next = { ...current, tempoBpm: bpm, proposedTempoBpm: bpm, gridLocked: true }; engine.saveProject(projectToJson(next)); return next; });
  }

  function confirmGrid() {
    if (!take) {
      return;
    }
    const bpm = Number(bpmText);
    const beats = Number(meterText);
    if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240 || !Number.isFinite(beats) || beats < 2 || beats > 12) {
      setMessage("Tempo and meter were not set.");
      return;
    }
    const phase = loopWindow(take.overlay).start;
    setPanel(null);
    setGhosts([]);
    setTakes((current) => current.map((entry) => (entry.id === take.id ? { ...entry, rollGrid: { bpm: Math.round(bpm), beatsPerBar: Math.round(beats), phase, provisional: false } } : entry)));
    setMessage("Grid set: bar 1 starts at the loop start. Your notes stay as played.");
  }

  function setAfterCapture(mode: "loop" | "silent") {
    const next = { ...project, afterCapture: mode };
    setProject(next);
    engine.saveProject(projectToJson(next));
    if (mode === "silent") {
      stopLoop();
    }
    setMessage(mode === "silent" ? "After Capture: stay silent. This stays until you change it." : "After Capture: loop. This stays until you change it.");
  }

  actions.current.capture = capture;
  actions.current.togglePlay = () => {
    if (looping) {
      stopLoop();
    } else if (take) {
      playTake(take);
    } else {
      setMessage("Nothing to play yet.");
    }
  };

  function chooseTheme(choice: ThemeChoice) {
    setThemeChoice(choice);
    window.localStorage.setItem("blocks.appearance", choice);
  }

  useEffect(() => {
    setSelectedNote(null);
    setSelectedIds([]);
    setRollWindow(null);
  }, [selected]);

  useEffect(() => {
    setGhosts([]);
    setPanel(null);
    engine.stopAudition();
  }, [selected, room]);

  useEffect(() => {
    setGhosts([]);
    setPanel(current => current === "quantise" ? null : current);
  }, [selectedIds]);

  historyActions.current = { undo: undoRoll, redo: redoRoll, room };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!historyActions.current.room) return;
      if ((event.target as HTMLElement)?.closest("input, select, textarea, [contenteditable=true]")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        event.shiftKey ? historyActions.current.redo() : historyActions.current.undo();
      } else if (event.code === "Space") {
        if ((event.target as HTMLElement)?.closest("button, [role=button], [role=radio], [role=slider]")) return;
        event.preventDefault(); actions.current.togglePlay();
      } else if (event.key === "Escape") {
        setGhosts([]); setPanel(null); engine.stopAudition();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const button = (label: string, action: () => void, options: { active?: boolean; disabled?: boolean; primary?: boolean; accessibilityLabel?: string } = {}) => (
    <Pressable accessibilityRole="button" accessibilityLabel={options.accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!options.disabled, ...(options.active === undefined ? {} : { selected: options.active }) }}
      disabled={options.disabled} onPress={action}
      style={[styles.secondary, { backgroundColor: options.primary || options.active ? palette.accent : palette.card, borderColor: palette.line, borderWidth: 1, opacity: options.disabled ? 0.45 : 1 }]}>
      <Text style={[styles.secondaryText, { color: options.primary || options.active ? palette.accentInk : palette.ink }]}>{label}</Text>
    </Pressable>
  );
  const soundName = (sound: SoundSettings) => engine.instruments.find(item => item.id === sound.instrumentId)?.name ?? "Warm EP";
  const targetTake = takes.find(item => item.id === soundTarget);
  const shownSound = targetTake?.sound ?? nextSound;
  const closeSound = () => { engine.stopAudition(); setSoundPreview(false); setSoundTarget(undefined); };
  const openSound = (id: string | null) => { const sound = takes.find(item => item.id === id)?.sound ?? nextSound; engine.setLiveInstrument(sound.instrumentId, sound.envelope); setNextSound({ ...sound, envelope: { ...sound.envelope } }); setSoundTarget(id); setSoundPreview(false); engine.stopAudition(); setLayerMenu(null); };
  const changeSound = (sound: SoundSettings) => {
    const resolved = engine.setLiveInstrument(sound.instrumentId, sound.envelope);
    if (targetTake) engine.setLayerInstrument(targetTake.id, resolved, sound.envelope);
    const next = { instrumentId: resolved, envelope: clampEnvelope(sound.envelope, resolved) };
    setNextSound(next);
    engine.setAuditionInstrument(next.instrumentId, next.envelope);
    if (soundPreview && shownSound.instrumentId !== next.instrumentId) [60, 64, 67].forEach(note => engine.audition(note, true));
    if (targetTake) {
      setTakes(items => items.map(item => item.id === targetTake.id ? { ...item, sound: next } : item));
    }
  };
  const soundModal = <Modal visible={soundTarget !== undefined} transparent animationType="none" onRequestClose={closeSound}>
    <View style={{ flex: 1, backgroundColor: "#0009", alignItems: "center", justifyContent: "center", padding: 12 }}>
      <View accessibilityLabel="Sound settings" style={{ width: "100%", maxWidth: 480, backgroundColor: palette.card, borderColor: palette.line, borderWidth: 1, borderRadius: 16, padding: 16, gap: 16 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ flex: 1, color: palette.ink, fontFamily: "Instrument Serif", fontSize: 26 }}>Synth</Text><Text style={[styles.meta, { color: palette.muted }]}>{targetTake ? `Layer ${takes.indexOf(targetTake) + 1}` : "Next capture"}</Text>{button("Done", closeSound, { accessibilityLabel: "Close sound settings" })}</View>
        <SelectControl label="Synth preset" value={shownSound.instrumentId} options={engine.instruments.map(item => ({ value: item.id, label: item.name }))} onChange={id => changeSound({ instrumentId: id as InstrumentId, envelope: defaultEnvelope(id) })} palette={palette} />
        {engine.capabilities.synthEnvelope && <SynthControls palette={palette} envelope={shownSound.envelope} onChange={envelope => changeSound({ ...shownSound, envelope })} />}
        {button(soundPreview ? "Stop preview" : "Preview sound", () => { if (soundPreview) [60, 64, 67].forEach(note => engine.audition(note, false)); else { engine.setAuditionInstrument(shownSound.instrumentId, shownSound.envelope); [60, 64, 67].forEach(note => engine.audition(note, true)); } setSoundPreview(!soundPreview); })}
      </View>
    </View>
  </Modal>;
  const layerStrip = <View style={{ gap: 10 }} accessibilityLabel="Layers">
    {takes.map((item, index) => <View key={item.id} style={[styles.layerChip, { padding: 12, gap: 8, backgroundColor: palette.card, borderColor: item.id === selected ? palette.ink : palette.line, borderWidth: item.id === selected ? 2 : 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Layer ${index + 1}, ${soundName(item.sound)}${loopingIds.includes(item.id) ? ", looping" : ""}`} accessibilityState={{ selected: item.id === selected }} onPress={() => { setSelected(item.id); setRangeMode(true); setRollWindow(null); }} style={{ flex: 1, minHeight: 48, flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Text style={{ color: palette.ink, fontFamily: "Geist Mono", fontSize: 18 }}>{index + 1}</Text><View><Text style={[styles.layerText, { color: palette.ink }]}>Synth</Text><Text style={[styles.meta, { color: palette.muted }]}>{soundName(item.sound)} · {loopingIds.includes(item.id) ? "looping" : "stopped"}</Text></View>
        </Pressable>
        {button("⋯", () => setLayerMenu(layerMenu === item.id ? null : item.id), { accessibilityLabel: `Layer ${index + 1} actions` })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={item.id === selected ? "Edit MIDI" : `Edit MIDI layer ${index + 1}`} onPress={() => { setSelected(item.id); enterEditor(item); }} style={{ minHeight: 48 }}><MiniRoll notes={item.rollNotes} palette={palette} /></Pressable><View style={{ flexDirection: "row", gap: 8 }}>{button("Edit MIDI", () => { setSelected(item.id); enterEditor(item); }, { accessibilityLabel: `Open editor layer ${index + 1}` })}{button(`${soundName(item.sound)} ▾`, () => openSound(item.id), { accessibilityLabel: `Sound for layer ${index + 1}` })}</View>
      {layerMenu === item.id && <View style={{ gap: 6 }}>
        {engine.kind === "web" && <LayerVolume label={`Layer ${index + 1} volume`} value={item.volume ?? 100} palette={palette} onChange={volume => { engine.setLayerVolume(item.id, volume / 100); setTakes(items => items.map(entry => entry.id === item.id ? { ...entry, volume } : entry)); }} />}
        {button(loopingIds.includes(item.id) ? "Stop layer" : "Play layer", () => { if (loopingIds.includes(item.id)) { engine.stopLayer(item.id); setLoopingIds(ids => ids.filter(id => id !== item.id)); } else playTake(item); setLayerMenu(null); })}
        {button("Loop range", () => { setSelected(item.id); setRangeMode(true); setRollWindow(null); setLayerMenu(null); })}
        {button(`Delete Layer ${index + 1}`, () => deleteCapture(item.id))}
      </View>}
    </View>)}
    <View style={[styles.layerChip, { borderColor: palette.accent, borderWidth: 2, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "flex-start" }]}><Text style={{ color: palette.accent, fontFamily: "Geist Mono", fontSize: 20 }}>{takes.length + 1}</Text><View><Text style={[styles.layerText, { color: palette.ink }]}>Layer {takes.length + 1} · next capture</Text><Pressable accessibilityRole="button" accessibilityLabel="Sound for next capture" onPress={() => openSound(null)} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[styles.meta, { color: palette.muted }]}>{soundName(nextSound)} ▾</Text></Pressable></View></View>
  </View>;

  if (room && take) return <><Editor key={take.id}
    soundName={soundName(take.sound)} onSound={() => openSound(take.id)}
    palette={palette} layers={takes.map(item => ({ id: item.id, soundName: soundName(item.sound), looping: loopingIds.includes(item.id) }))} selectedLayer={take.id}
    captureBpm={take.report.bpm} loopBars={loopBars} onLoopBars={setLoopBars} onResetLoop={() => resetLoop(take)} firstLayer={takes[0]?.id === take.id} onShowFullTake={() => showFullTake(take)} loopRange={loopWindow(take.overlay)} onCutRange={() => cutRange(take)} onQuantiseNow={() => commitRoll(take, applyPreview(take.rollNotes, quantisePreview(take.rollNotes, selectedIds, take.rollGrid, snapDivision, 100, 0)))} notes={take.rollNotes} selectedNote={selectedNote} selectedIds={selectedIds} grid={take.rollGrid} tool={rollTool} looping={looping}
    canUndo={take.rollPast.length > 0} canRedo={take.rollFuture.length > 0}
    snapDivision={snapDivision} snapMode={snapMode} previewing={ghosts.length > 0}
    onBack={leaveEditor} onLayer={setSelected} onTool={setRollTool}
    onUndo={undoRoll} onRedo={redoRoll} onPlay={() => looping ? stopLoop() : playTake(take)} onCapture={capture}
    onGrid={(bpm, beatsPerBar) => { const phase = take.rollGrid?.phase ?? loopWindow(take.overlay).start; changeCaptureTempo(bpm); setEditorGridSettings({ bpm, beatsPerBar }); setTakes(current => current.map(entry => entry.id === take.id ? { ...entry, rollGrid: { bpm, beatsPerBar, phase, provisional: false } } : entry)); setGhosts([]); }}
    onSnap={division => { setSnapDivision(division); setGhosts([]); }} onSnapMode={setSnapMode}
    onVelocity={(velocity, scale) => { const chosen = take.rollNotes.filter(note => selectedIds.includes(note.id)); const average = chosen.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, chosen.length); commitRoll(take, take.rollNotes.map(note => selectedIds.includes(note.id) ? { ...note, velocity: Math.max(1, Math.min(127, Math.round(scale ? note.velocity * velocity / average : velocity))) } : note)); }}
    showOthers={showOthers} onShowOthers={() => setShowOthers(value => !value)}
    onSelectionAction={selectionAction} canPaste={noteClipboard.length > 0}
    quantiseStrength={quantiseStrength} quantiseSwing={quantiseSwing}
    onQuantiseSettings={(strength, swing) => { setQuantiseStrength(strength); setQuantiseSwing(swing); setGhosts(quantisePreview(take.rollNotes, selectedIds, take.rollGrid, snapDivision, strength, swing)); }}
    onPreview={() => setGhosts(quantisePreview(take.rollNotes, selectedIds, take.rollGrid, snapDivision, quantiseStrength, quantiseSwing))}
    onApply={() => commitRoll(take, applyPreview(take.rollNotes, ghosts))} onCancelPreview={() => setGhosts([])}
    renderRoll={(gridHeight, viewAction) => <Roll key={take.id}
      notes={take.rollNotes} timeWindow={rollWindow ?? (take.rollGrid ? editorFrame(takeStart(take), loopWindow(take.overlay).start, loopWindow(take.overlay).end, take.rollGrid, width >= 1100 ? 4 : 2) : null)} bounds={loopWindow(take.overlay)} ceiling={take.rangeCeiling}
      historyStart={takeStart(take)}
      grid={take.rollGrid} palette={palette} mode="room" tool={rollTool} selectedId={selectedNote} selectedIds={selectedIds} onSelectMany={selectNotes} ghosts={ghosts} hitPx={48}
      backgroundLayers={showOthers ? takes.filter(item => item.id !== take.id).map((item, index) => { const offset = loopWindow(take.overlay).start - loopWindow(item.overlay).start; return { id: item.id, label: `Layer ${takes.indexOf(item) + 1}`, notes: item.rollNotes.map(note => ({ ...note, start: note.start + offset, end: note.end + offset })) }; }) : []}
      onWindow={setRollWindow} onBoundsCommit={next => commitBounds(take, next)} onSelect={id => selectNotes(id ? [id] : [])} onCommitNotes={notes => commitRoll(take, notes)}
      onTool={setRollTool} showChrome={false} showVelocityLane gridHeight={gridHeight} viewAction={viewAction}
      snapDivision={snapDivision} snapMode={snapMode} readTransport={() => engine.transport(take.id)}
      onAudition={engine.capabilities.audition ? (note, down) => engine.audition(note, down) : undefined} onStopAudition={() => engine.stopAudition()}
      readSoundingPitches={() => engine.capabilities.soundingPitches ? engine.soundingPitches(take.id) : null}
    />}
  />{soundModal}</>;

  const emptyTapeFrame = rangeForBars(0n, liveGrid, loopBars ?? 4) ?? { start: 0n, end: 8_000_000n };
  const historyItem = rangeMode ? take : null;
  const historyGrid = historyItem?.rollGrid ?? liveGrid;
  const historyFloor = historyItem ? (historyItem.mainExtent ? historyItem.mainExtent.start : takeStart(historyItem)) : ribbon[0]?.scheduleElapsed ?? 0n;
  const historyBounds = historyItem ? loopWindow(historyItem.overlay) : liveBounds;
  const requestedHistoryFrame = historyItem ? rollWindow ?? editorFrame(historyFloor, historyBounds.start, historyBounds.end, historyGrid, 2) : ribbon.length ? liveFrame : captureView && captureView.end > captureView.start ? captureView : emptyTapeFrame;
  const allHistoryEnd = historyItem ? historyItem.rollNotes.reduce((end, note) => note.end > end ? note.end : end, historyItem.cut.loop.end > historyBounds.end ? historyItem.cut.loop.end : historyBounds.end) : newest > historyBounds.end ? newest : historyBounds.end;
  const historyEnd = historyItem?.mainExtent ? historyItem.mainExtent.end : !historyItem && !ribbon.length ? emptyTapeFrame.end : allHistoryEnd;
  const clampHistory = (next: TimeWindow): TimeWindow => {
    if (!historyItem && ribbon.length) return next;
    const available = historyEnd > historyFloor ? historyEnd - historyFloor : 1n;
    const span = next.end - next.start < available ? next.end - next.start : available;
    const start = next.start < historyFloor ? historyFloor : next.start + span > historyEnd ? historyEnd - span : next.start;
    return { start, end: start + span };
  };
  const historyFrame = clampHistory(requestedHistoryFrame);
  const setHistoryWindow = (next: TimeWindow) => historyItem ? setRollWindow(clampHistory(next)) : setCaptureView(clampHistory(next));
  const zoomMax = Math.max(1, Number(historyEnd - historyFloor));
  const zoomMin = Math.min(125_000, zoomMax);
  const zoomDetail = Math.max(0, Math.min(100, 100 * Math.log(zoomMax / Math.max(1, Number(historyFrame.end - historyFrame.start))) / (Math.log(zoomMax / zoomMin) || 1)));
  const changeHistoryZoom = (value: number) => {
    const span = Math.round(zoomMax * Math.pow(zoomMin / zoomMax, value / 100));
    const next = zoomWindow(historyFrame, span / Number(historyFrame.end - historyFrame.start), historyFrame.start + (historyFrame.end - historyFrame.start) / 2n, BigInt(zoomMin), BigInt(Math.ceil(zoomMax)));
    setHistoryWindow(next);
  };

  return <View style={[styles.page, { backgroundColor: palette.bg }]}>
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={[styles.content, { padding: chrome.pad, maxWidth: 1200 }]}>
      {compactPlay ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12, height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setPanel(panel === "settings" ? null : "settings")} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[styles.kicker, { color: palette.muted }]}>BLOCKS ⌄</Text></Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: palette.ink, fontFamily: "Instrument Serif", fontSize: 30 }}>{project.name}</Text>
        {audioState === "closed" ? <Text accessibilityLiveRegion="polite" style={{ color: palette.ink, fontSize: 12 }}>Sound closed · reload</Text> : ribbon.length > 0 && audioState !== "running" ? button("Resume sound", enable, { disabled: busy }) : <Text style={{ color: palette.muted, fontFamily: "Geist Mono", fontSize: 13 }}>{Number(liveGrid.bpm.toFixed(2))} BPM</Text>}
      </View> : <View style={styles.header}>
        <View><Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setPanel(panel === "settings" ? null : "settings")} style={{ minHeight: 32, justifyContent: "center" }}><Text style={[styles.kicker, { color: palette.muted }]}>BLOCKS ⌄</Text></Pressable><Text style={[styles.title, { color: palette.ink, fontFamily: "Instrument Serif" }]}>{project.name}</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text style={{ fontFamily: "Geist Mono", color: palette.ink, fontSize: 20 }}>{take?.rollGrid ? Number(take.rollGrid.bpm.toFixed(2)) : "— —"}</Text><Text style={[styles.meta, { color: palette.muted }]}>{take?.rollGrid ? `BPM · ${take.rollGrid.beatsPerBar}/4` : "free play"}</Text></View>
      </View>}
      {!compactPlay && <View style={styles.statusRow}>
        {button(busy ? "Starting…" : audioState === "running" ? "MIDI" : "Enable sound", enable, { disabled: busy, accessibilityLabel: "Enable" })}
        <View style={{ flex: 1 }}><ReadinessStrip audioState={audioState} showContext={false} ink={palette.ink} /><Text style={[styles.meta, { color: palette.muted }]}>{inputCopy(gate.kind, engine.ports().length)} · {seconds(age, domain)} kept</Text></View>
      </View>}
      {panel === "settings" && <View style={[styles.panel, { backgroundColor: palette.card, borderColor: palette.line }]}>
        {compactPlay && <View style={styles.row}>{button(busy ? "Starting…" : audioState === "running" ? "MIDI" : "Enable sound", enable, { disabled: busy, accessibilityLabel: "Enable" })}<View style={{ flex: 1 }}><ReadinessStrip audioState={audioState} showContext={false} ink={palette.ink} /><Text style={[styles.meta, { color: palette.muted }]}>{inputCopy(gate.kind, engine.ports().length)}</Text></View></View>}
        <Text style={[styles.cardTitle, { color: palette.ink }]}>Appearance</Text><View style={styles.row}>{(["system", "light", "dark"] as const).map(choice => <React.Fragment key={choice}>{button(choice[0].toUpperCase() + choice.slice(1), () => chooseTheme(choice), { active: themeChoice === choice })}</React.Fragment>)}</View>
        <View style={styles.row}>{button(project.afterCapture === "loop" ? "After capture: loop" : "After capture: stay silent", () => setAfterCapture(project.afterCapture === "loop" ? "silent" : "loop"))}{button("Learn Capture", () => { learningRef.current = "capture"; setLearning("capture"); })}{button("Learn Play/Stop", () => { learningRef.current = "transport"; setLearning("transport"); })}{button("Stop all sound", () => { engine.stopAudition(); engine.stopReplay(); engine.silence(); setLoopingIds([]); })}</View>
      </View>}
      <View style={{ flexDirection: width >= 1000 ? "row" : "column", gap: 16, marginTop: 16 }}>
        <View dataSet={{ captureBpm: rangeMode && take?.report.bpm ? String(take.report.bpm) : "" }} style={[styles.card, { marginTop: 0, flex: width >= 1000 ? 1 : undefined, backgroundColor: palette.card, borderColor: palette.line, padding: 8 }]}>
          <View style={{ flexDirection: "row", gap: width < 360 ? 4 : 8, alignItems: "center", marginBottom: 8 }}><View style={{ flex: 1, flexDirection: "row", gap: 4 }}>{button("Live", () => setRangeMode(false), { active: !rangeMode || !take, accessibilityLabel: "Next capture" })}{take && button(`Layer ${takes.indexOf(take) + 1}`, () => setRangeMode(true), { active: rangeMode })}</View><LoopLengthControl bars={loopBars} onPress={() => setPanel(panel === "loop" ? null : "loop")} open={panel === "loop"} palette={palette} />{button(rangeMode && take ? "Edit MIDI" : "Draw MIDI", () => rangeMode && take ? enterEditor(take) : drawMidi())}</View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8, flexWrap: "wrap" }}>
            <TempoControl value={rangeMode && take?.rollGrid ? Number(take.rollGrid.bpm.toFixed(2)) : liveGrid.bpm} onChange={changeCaptureTempo} palette={palette} caption={`BPM · ${rangeMode && take?.rollGrid ? take.rollGrid.beatsPerBar : liveGrid.beatsPerBar}/4`} valueLabel="Capture grid settings" onValuePress={() => { setMeterText(String(rangeMode && take?.rollGrid ? take.rollGrid.beatsPerBar : liveGrid.beatsPerBar)); setPanel(panel === "grid" ? null : "grid"); }} />
            <View style={{ flex: 1, minWidth: 100 }}><SelectControl label="Capture snap division" value={captureCustomSnap || !snapPreset ? "custom" : snapPreset.id} options={[...SNAP_PRESETS.map(item => ({ value: item.id, label: `Snap ${item.label}` })), { value: "custom", label: !snapPreset && snapDivision.kind === "note" ? `Snap ${snapDivision.numerator}/${snapDivision.denominator}` : "Custom…" }]} onChange={id => { setCaptureCustomSnap(id === "custom"); if (id !== "custom") setSnapDivision(SNAP_PRESETS.find(item => item.id === id)!.division); }} palette={palette} /></View>
          </View>
          {captureCustomSnap && <View style={styles.row}><TextInput accessibilityLabel="Capture custom snap fraction" value={captureFraction} onChangeText={setCaptureFraction} style={{ color: palette.ink, borderColor: palette.line, borderWidth: 1, minHeight: 48, padding: 10, minWidth: 90 }} />{button("Apply snap", () => { const match = captureFraction.trim().match(/^(\d+)\s*\/\s*(\d+)$/); const numerator = Number(match?.[1]), denominator = Number(match?.[2]); if (!match || numerator < 1 || numerator > 128 || denominator < 1 || denominator > 1024) { setMessage("Enter a fraction, such as 3/8 or 1/12."); return; } setSnapDivision({ kind: "note", numerator, denominator }); setCaptureCustomSnap(false); })}</View>}
          {panel === "grid" && <View style={{ gap: 8, marginBottom: 8 }}><SelectControl label="Capture beats per bar" value={meterText} options={[2,3,4,5,6,7,8].map(value => ({ value: String(value), label: `${value}/4` }))} onChange={value => { setMeterText(value); const beatsPerBar=Number(value); setEditorGridSettings(settings => ({ ...settings, beatsPerBar })); if (rangeMode && take) setTakes(items => items.map(item => item.id === take.id ? { ...item, rollGrid: { ...(item.rollGrid ?? liveGrid), beatsPerBar } } : item)); }} palette={palette} />{button("Done", () => setPanel(null))}</View>}
          {rangeMode && take ? <Roll notes={take.rollNotes} timeWindow={historyFrame} bounds={loopWindow(take.overlay)} viewExtent={{ start: historyFloor, end: historyEnd }} ceiling={historyEnd} historyStart={historyFloor} grid={take.rollGrid} palette={palette} mode="compact" tool="select" selectedId={null} ghosts={[]} hitPx={48} gridHeight={historyHeight} viewAction={historyViewAction} showChrome={false} onWindow={setHistoryWindow} onBoundsCommit={next => commitBounds(take,next)} onSelect={() => undefined} onCommitNotes={() => undefined} snapDivision={snapDivision} snapMode="grid" readTransport={() => engine.transport(take.id)} /> : <Roll notes={liveNotes} viewExtent={ribbon.length ? undefined : emptyTapeFrame} timeWindow={historyFrame} bounds={ribbon.length ? liveBounds : emptyTapeFrame} ceiling={historyEnd} historyStart={ribbon[0]?.scheduleElapsed ?? 0n} grid={liveGrid} palette={palette} mode="compact" tool="select" selectedId={null} ghosts={[]} hitPx={48} gridHeight={historyHeight} viewAction={historyViewAction} showChrome={false} onWindow={setHistoryWindow} onBoundsCommit={next => { setCaptureRangeUndo({ bounds: captureRange }); setCaptureRange(next); setCaptureView(liveFrame); }} onSelect={() => undefined} onCommitNotes={() => undefined} snapDivision={snapDivision} snapMode="grid" />}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, height: 48 }}>
            {rangeMode && take && button("Cut range", () => cutRange(take))}
            <View style={{ flex: 1 }} />
            {button("\u2212", () => changeHistoryZoom(Math.max(0, zoomDetail - 12)), { accessibilityLabel: "Zoom out time", disabled: historyFrame.end - historyFrame.start >= BigInt(Math.floor(zoomMax)) })}
            {button("+", () => changeHistoryZoom(Math.min(100, zoomDetail + 12)), { accessibilityLabel: "Zoom in time" })}
            {button("Fit", () => setHistoryWindow({ start: historyFloor, end: historyEnd }), { accessibilityLabel: "Fit clip" })}
          </View>
          {!rangeMode && ribbon.length > 0 && <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}><Text style={[styles.meta, { color: palette.muted, flex: 1 }]}>{captureRange ? "Manual range · next capture" : "Auto range · next capture"}</Text>{captureRange && button("Auto range", () => { setCaptureRangeUndo({ bounds: captureRange }); setCaptureRange(null); setCaptureView(null); })}{captureRangeUndo && button("Undo range", () => { setCaptureRange(captureRangeUndo.bounds); setCaptureRangeUndo(null); })}</View>}
          {panel === "loop" && <View style={{ position: "absolute", zIndex: 20, top: 64, left: 8, right: 8, padding: 12, gap: 8, borderRadius: 10, borderWidth: 1, borderColor: palette.line, backgroundColor: palette.card }}>

            {rangeMode && take ? <><LoopSettings onUndo={boundsUndo ? () => { undoBounds(); setPanel(null); } : undefined} bars={loopBars} onBars={setLoopBars} onReset={() => resetLoop(take)} onCut={() => { cutRange(take); setPanel(null); }} palette={palette} tempoPreview={takes[0]?.id === take.id && loopBars ? tempoForBars(loopWindow(take.overlay), loopBars, take.rollGrid?.beatsPerBar ?? 4) : null} /></> : <LoopSettings bars={loopBars} onBars={setLoopBars} onReset={() => undefined} onCut={() => undefined} palette={palette} canEdit={false} />}
          </View>}
          {boundsUndo && rangeMode && take && panel !== "loop" ? button("Undo range", undoBounds) : null}
        </View>
        <View style={{ width: width >= 1000 ? 300 : undefined }}>{layerStrip}</View>
      </View>
      {learning ? <Text style={[styles.meta, { color: palette.muted }]}>Learning {learning === "capture" ? "Capture" : "Play/Stop"}</Text> : null}
      {notice.kind !== "none" && <Text style={[styles.meta, { color: palette.muted }]}>{evictionCopy(notice)}</Text>}
    </ScrollView>
    <View style={[styles.dock, { backgroundColor: palette.dock, borderColor: palette.line }]}><View style={styles.dockInner}>
      {message ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 32, paddingBottom: 6 }}><Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.muted, flex: 1 }]}>{message}</Text>{deletedTake ? button("Undo", undoCapture, { accessibilityLabel: "Undo delete capture" }) : sessionUndo ? button("Undo edits", () => { const item=takes.find(entry => entry.id===sessionUndo.id); if(item) undoSession(); }) : null}</View> : null}
      <View style={[styles.transportRow, { marginBottom: keyboardOpen ? 8 : 0 }]}>
        {button("↶", () => { if (sessionUndo) { const item=takes.find(entry => entry.id===sessionUndo.id); if(item) undoSession(); } else undoCapture(); }, { disabled: !undo && !deletedTake && !sessionUndo, accessibilityLabel: sessionUndo ? "Undo edits" : "Undo capture" })}
        {take ? <Pressable accessibilityRole="button" accessibilityLabel="Edit MIDI" dataSet={{ editorEntry: "dock" }} onPress={() => enterEditor(take)} style={{ flex: 1, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: palette.line, borderRadius: 8, backgroundColor: palette.card }}><Text style={{ color: palette.ink, fontFamily: "Inter Tight", fontSize: 14, fontWeight: "600" }}>Edit MIDI →</Text><Text style={{ color: palette.muted, fontFamily: "Inter Tight", fontSize: 11 }}>Layer {takes.indexOf(take) + 1} · {soundName(take.sound)}</Text></Pressable> : <Pressable accessibilityRole="button" accessibilityLabel="Choose sound" onPress={() => openSound(null)} style={{ flex: 1, alignItems: "center", justifyContent: "center", minHeight: 48 }}><Text style={[styles.cardTitle, { color: palette.ink }]}>{soundName(nextSound)} ▾</Text><Text style={[styles.meta, { color: palette.muted }]}>sound for Layer {takes.length + 1}</Text></Pressable>}
        {button(keyboardOpen ? "⌨ −" : "⌨ +", () => setKeyboardOpen(value => !value), { accessibilityLabel: keyboardOpen ? "Hide keyboard" : "Show keyboard" })}
        {button(looping ? "■" : "▶", () => looping ? stopLoop() : take ? playTake(take) : undefined, { disabled: !take, accessibilityLabel: looping ? "Stop" : "Play" })}
      </View>
      {keyboardOpen && <TouchKeyboard palette={palette} onNote={(note, down, velocity=96) => { if(down) heldTouch.current.add(note); else heldTouch.current.delete(note); engine.touch(note,down ? velocity : 0,down); }} onReleaseAll={() => { for(const note of heldTouch.current) engine.touch(note,0,false); heldTouch.current.clear(); }} />}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={isRecording ? "Stop recording" : "Record"} accessibilityState={{ selected: isRecording }} onPress={toggleRecord} style={{ width: 104, minHeight: 80, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: isRecording ? "#E45C64" : palette.line, borderRadius: 16, backgroundColor: palette.card }}><Text style={{ color: "#E45C64", fontSize: 22 }}>{isRecording ? "■" : "●"}</Text><Text style={{ color: palette.ink, fontSize: 12, fontWeight: "600" }}>{isRecording ? "Stop recording" : "Record"}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture" accessibilityState={{ disabled: isRecording }} disabled={isRecording} onPress={capture} style={[styles.capture, { backgroundColor: palette.card, borderColor: palette.accent, borderWidth: 2, opacity: isRecording ? .45 : 1 }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><Text style={{ color: palette.accent, fontSize: 28 }}>↶</Text><View><Text style={[styles.captureText, { color: palette.ink }]}>Capture</Text><Text style={[styles.meta, { color: palette.muted }]}>{captureRange ? "Selected range" : "Last phrase"} · Layer {takes.length + 1}</Text></View></View></Pressable>
      </View>
    </View></View>
    {soundModal}
  </View>;
}

function takeStart(item: Take): bigint { const first = item.performance.events[0]?.scheduleElapsed ?? 0n; const start = loopWindow(item.overlay).start; return first < start ? first : start; }
function editSnapshot(item: Take): EditSnapshot { return { mainExtent: item.mainExtent, notes: item.rollNotes, bounds: loopWindow(item.overlay), edited: item.rollEdited, grid: item.rollGrid }; }
function restoreSnapshot(item: Take, snapshot: EditSnapshot): Take { return { ...item, mainExtent: snapshot.mainExtent, rollNotes: snapshot.notes, rollEdited: snapshot.edited, rollGrid: snapshot.grid, overlay: { ...item.overlay, selectionStart: snapshot.bounds.start, selectionEnd: snapshot.bounds.end, loopStart: snapshot.bounds.start, loopEnd: snapshot.bounds.end } }; }

function sameNotes(a: readonly RollNote[], b: readonly RollNote[]) {
  return a.length === b.length && a.every((note, index) => {
    const next = b[index];
    return note.id === next.id && note.pitch === next.pitch && note.start === next.start && note.end === next.end && note.velocity === next.velocity && note.channel === next.channel;
  });
}

function inputCopy(kind: string, ports: number): string {
  if (kind === "site-addon") {
    return "Firefox site-permission add-on";
  }
  if (kind === "unsupported") {
    return "MIDI API not exposed";
  }
  if (kind === "policy-blocked") {
    return "blocked by permission policy";
  }
  if (kind === "settings-blocked") {
    return "blocked in site settings";
  }
  if (kind === "denied") {
    return "MIDI request was not granted";
  }
  if (kind === "failed") {
    return "MIDI request failed";
  }
  if (kind === "disconnected") {
    return "disconnected";
  }
  if (kind === "no-device") {
    return "no input connected";
  }
  if (kind === "idle") {
    return "not asked";
  }
  if (ports === 0 && kind !== "ready" && kind !== "suspended") {
    return "not asked";
  }
  if (kind === "suspended") {
    return "MIDI open, sound paused";
  }
  if (kind === "ready") {
    return "connected";
  }
  return "not enabled";
}

function evictionCopy(notice: RibbonNotice): string {
  if (notice.kind === "age") {
    return "Older than 120s left the ribbon (" + notice.dropped + "). That is age, not a full buffer.";
  }
  if (notice.kind === "overload") {
    return "The ribbon hit its " + notice.reason + " cap and dropped " + notice.dropped + " oldest events. Overflow does not mean nothing was lost.";
  }
  return "No eviction.";
}

function MiniRoll({ notes, palette }: { notes: readonly RollNote[]; palette: ReturnType<typeof resolveTheme> }) {
  const start=notes.reduce((v,n)=>n.start<v?n.start:v,notes[0]?.start??0n), end=notes.reduce((v,n)=>n.end>v?n.end:v,start+1n);
  const high=notes.length?Math.max(...notes.map(n=>n.pitch))+1:72, low=notes.length?Math.min(...notes.map(n=>n.pitch))-1:48;
  return <View style={{ height: 48, backgroundColor: palette.plot, overflow: "hidden", borderRadius: 6 }}>{notes.map(note=><View key={note.id} style={{ position:"absolute",left:`${Number(note.start-start)/Number(end-start)*100}%`,width:`${Math.max(.5,Number(note.end-note.start)/Number(end-start)*100)}%`,top:(high-note.pitch)/Math.max(1,high-low)*40+2,height:3,backgroundColor:palette.note,borderRadius:1 }} />)}</View>;
}

const styles = StyleSheet.create({
  page: { flex: 1, height: "100%", maxHeight: "100%", overflow: "hidden" },
  scroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  content: { padding: 24, paddingBottom: 24, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginVertical: 8 },
  editorHeader: { flexShrink: 0, paddingHorizontal: 16, paddingTop: 10, borderBottomWidth: 1 },
  kicker: { letterSpacing: 2, fontSize: 11, fontWeight: "600" },
  title: { fontSize: 36, marginTop: 6, letterSpacing: -0.7 },
  meta: { fontSize: 12, lineHeight: 18, marginTop: 3 },
  message: { fontSize: 12, lineHeight: 18, marginTop: 12, marginBottom: 16 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  statusRow: { flexDirection: "row", alignItems: "center", gap: 14, marginTop: 18, marginBottom: 6 },
  card: { borderRadius: 16, borderWidth: 1, padding: 16, marginTop: 16 },
  cardTitle: { fontSize: 17, fontWeight: "600" },
  panel: { borderWidth: 1, borderRadius: 12, padding: 16, marginTop: 12 },
  emptyRoll: { minHeight: 160, justifyContent: "center" },
  contextRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 10 },
  layerRow: { flexDirection: "row", gap: 8, paddingVertical: 8 },
  layerChip: { borderRadius: 8, minHeight: 48, paddingHorizontal: 14, justifyContent: "center" },
  layerText: { fontSize: 13, fontWeight: "500" },
  dock: { flexShrink: 0, paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1 },
  dockInner: { width: "100%", maxWidth: 1200, alignSelf: "center" },
  transportRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  capture: { borderRadius: 40, minHeight: 80, flex: 1, alignItems: "center", justifyContent: "center" },
  captureText: { fontSize: 18, fontWeight: "700" },
  secondary: { borderRadius: 8, minHeight: 48, minWidth: 48, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  secondaryText: { fontSize: 13, fontWeight: "500" },
  field: { borderWidth: 1, borderRadius: 8, minHeight: 48, width: 90, paddingHorizontal: 10, fontSize: 16, marginTop: 6 },
  keys: { flexDirection: "row", gap: 4, marginTop: 12, flexWrap: "wrap" },
  pad: { borderWidth: 1, borderRadius: 6, minWidth: 44, minHeight: 68, flexGrow: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 10 },
  padText: { fontSize: 12, fontWeight: "500" },
});
