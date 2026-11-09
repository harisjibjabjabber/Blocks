import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { RollingHistory, type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { inferPulse, type InferenceReport } from "../domain/inference";
import { capturePerformance, defaultOverlay, loopWindow, type Performance, type PhraseOverlay } from "../domain/phrase";
import { beatForCut, createProject, projectFromJson, projectToJson, proposeTempo, type Project } from "../domain/project";
import { eventsInSelection, recentPhraseCut, withCaptureRange, type RecentPhraseCut } from "../domain/recent-phrase";
import { routeLearnedControl, type ControlMap, type LearnTarget } from "../domain/learn";
import { loopEvents } from "../domain/loop-events";
import { Roll, type RollTool } from "./Roll";
import { Editor } from "./Editor";
import { TouchKeyboard } from "./TouchKeyboard";
import { DEFAULT_SNAP, SNAP_PRESETS, type SnapDivision, type SnapMode } from "./snap";
import { SelectControl } from "./SelectControl";
import { ReadinessStrip } from "./Readiness";
import { moveBound, undoRange, type RangeBounds } from "./range";
import { applyPreview, notesFromEvents, quantisePreview, workingPlayback, setVelocity, type RollNote } from "./roll-notes";
import { editorFrame, type KnownGrid, type TimeWindow } from "./roll-time";
import { playChrome, resolveTheme, type ThemeChoice } from "./theme";
import { touchFromPress, type PressPhase } from "./keys";

const engine = createEngine();
const NOTES = [48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72];
const NAMES = ["C", "D", "E", "F", "G", "A", "B", "C", "D", "E", "F", "G", "A", "B", "C"];
const EVENT_CAP = 4096;
const BYTE_CAP = 262144;

interface Take {
  id: string;
  performance: Performance;
  overlay: PhraseOverlay;
  report: InferenceReport;
  cut: RecentPhraseCut;
  /** Inferred period end. The end handle can move through the silence up to here. */
  rangeCeiling: bigint;
  rollNotes: RollNote[];
  rollPast: RollNote[][];
  rollFuture: RollNote[][];
  rollGrid: KnownGrid | null;
  rollEdited: boolean;
}

interface UndoCapture {
  takes: Take[];
  ribbon: CapturedEvent[];
  project: Project;
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
    () => new RollingHistory(domain, BigInt(unitFor(domain) * 120), EVENT_CAP, BYTE_CAP),
    [domain],
  );
  const [project, setProject] = useState<Project>(createProject());
  const [gate, setGate] = useState(engine.getGate());
  const [ribbon, setRibbon] = useState<CapturedEvent[]>([]);
  const livePhase = useRef<bigint | null>(null);
  const [notice, setNotice] = useState<RibbonNotice>({ kind: "none" });
  const [takes, setTakes] = useState<Take[]>([]);
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
  const [keyboardOpen, setKeyboardOpen] = useState(true);
  const compactPlay = keyboardOpen && width < 700;
  const historyHeight = keyboardOpen ? Math.max(56, Math.min(120, height - (compactPlay ? 660 : 780))) : width >= 1000 ? 240 : 180;
  const nextLayerId = useRef(1);
  const [boundsUndo, setBoundsUndo] = useState<{ id: string; bounds: RangeBounds } | null>(null);
  const [learning, setLearning] = useState<LearnTarget | null>(null);
  const [room, setRoom] = useState(false);
  const [rollTool, setRollTool] = useState<RollTool>("select");
  const [snapDivision, setSnapDivision] = useState<SnapDivision>(DEFAULT_SNAP);
  const [snapMode, setSnapMode] = useState<SnapMode>("grid");
  const [editorGridSettings, setEditorGridSettings] = useState({ bpm: 120, beatsPerBar: 4 });
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(true);
  const [quantiseStrength, setQuantiseStrength] = useState(50);
  const [quantiseSwing, setQuantiseSwing] = useState(0);
  const [noteClipboard, setNoteClipboard] = useState<RollNote[]>([]);
  const editSession = useRef<{ id: string; before: RollNote[]; pastLength: number } | null>(null);
  const [sessionUndo, setSessionUndo] = useState<{ id: string; notes: RollNote[] } | null>(null);
  const [ghosts, setGhosts] = useState<{ id: string; start: bigint; end: bigint }[]>([]);
  const [rollWindow, setRollWindow] = useState<TimeWindow | null>(null);
  const [bpmText, setBpmText] = useState("120");
  const [meterText, setMeterText] = useState("4");
  const [panel, setPanel] = useState<"settings" | "grid" | "quantise" | null>(null);
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
        mapRef.current = { capture: loaded.captureControl, transport: loaded.transportControl };
        engine.setSustain(loaded.sustainCc);
      }
    });
    const unsubscribe = engine.subscribe((event) => {
      history.push(event);
      if (livePhase.current === null) livePhase.current = history.snapshot()[0]?.scheduleElapsed ?? null;
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
  const newest = ribbon.length ? ribbon[ribbon.length - 1].scheduleElapsed : 0n;
  const age = ribbon.length ? newest - ribbon[0].scheduleElapsed : 0n;
  const automaticCut = useMemo(() => recentPhraseCut(ribbon, {
    ticksPerSecond: unitFor(domain),
    gridPeriodTicks: beatForCut(project) ? BigInt(Math.round(60 / beatForCut(project)! * unitFor(domain))) : null,
    gridOriginTicks: takes[0]?.overlay.selectionStart ?? null,
    historyMayBeTruncated: notice.kind !== "none",
  }), [ribbon, project, takes, notice.kind, domain]);
  const liveBounds = captureRange ?? automaticCut.loop;
  const liveGrid: KnownGrid = { ...editorGridSettings, phase: takes[0]?.rollGrid?.phase ?? livePhase.current ?? 0n };
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
    const scheduleLayer = updateAtSeam ? engine.updateLayer : engine.loopLayer;
    const bounds = loopWindow(item.overlay);
    const durationSec = Number(bounds.end - bounds.start) / unitFor(domain);
    if (!Number.isFinite(durationSec) || durationSec <= 0) { setMessage("Choose a positive loop range."); return; }
    const controllerSeed = withCaptureRange(item.performance.events, item.cut, bounds).controllerSeed;
    if (item.rollEdited) {
      const played = workingPlayback(item.performance.events, item.rollNotes, bounds);
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
    const events = history.snapshot();
    if (events.length === 0) {
      setMessage("Nothing to capture yet — play something");
      return;
    }
    const ticksPerSecond = unitFor(domain);
    const tempoForCut = beatForCut(project);
    const automatic = recentPhraseCut(events, {
      ticksPerSecond,
      gridPeriodTicks: tempoForCut ? BigInt(Math.round((60 / tempoForCut) * ticksPerSecond)) : null,
      gridOriginTicks: takes[0] ? takes[0].overlay.selectionStart : null,
      historyMayBeTruncated: notice.kind !== "none",
    });
    if (captureRange && captureRange.start < events[0].scheduleElapsed) {
      setCaptureRange(null); setCaptureView(null); setMessage("That range has left the live history. Choose a new range."); return;
    }
    const cut = captureRange ? withCaptureRange(events, automatic, captureRange) : automatic;
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
    const selected = eventsInSelection(events, cut.selection);
    const report = inferPulse(selected.length > 0 ? selected : events, ticksPerSecond);
    const id = "layer-" + nextLayerId.current++;
    const editingGrid: KnownGrid = { ...liveGrid, provisional: false };
    const created: Take = { id, performance, overlay, report, cut, rangeCeiling: cut.loop.end, rollNotes: notesFromEvents(events), rollPast: [], rollFuture: [], rollGrid: editingGrid, rollEdited: false };
    setUndo({ takes, ribbon: events, project });
    setDeletedTake(null); setSessionUndo(null); setLayerMenu(null); setRangeMode(false);
    setCaptureRange(null); setCaptureRangeUndo(null); setCaptureView(null);
    setTakes((current) => [...current, created]);
    setSelected(id);
    const proposal = cut.status === "recent" ? proposeTempo(project, report.bpm, takes.length) : proposeTempo(project, null, takes.length);
    setProject(proposal.project);
    engine.saveProject(projectToJson(proposal.project));
    const reading = report.pulse === "none" || report.bpm === null ? "No pulse reading. Quantise stays off." : report.bpm.toFixed(1) + " bpm · one reading, 4/4. Quantise stays off.";
    setMessage(captureRange ? "Captured · chosen range · Layer " + (takes.length + 1) : cut.status === "recent" ? "Captured · Layer " + (takes.length + 1) : "Captured · no clear rest; kept the available phrase.");
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
    setTakes(undo.takes);
    setProject(undo.project);
    engine.saveProject(projectToJson(undo.project));
    setSelected(undo.takes.length ? undo.takes[undo.takes.length - 1].id : null);
    setUndo(null);
    setBoundsUndo(null);
    setMessage("Capture undone.");
  }

  function enterEditor(item: Take) {
    const bounds = loopWindow(item.overlay);
    const grid = item.rollGrid ?? { ...editorGridSettings, phase: bounds.start, provisional: false };
    if (!item.rollGrid) setTakes(current => current.map(entry => entry.id === item.id ? { ...entry, rollGrid: grid } : entry));
    const historyStart = item.performance.events[0]?.scheduleElapsed ?? bounds.start;
    setRollWindow(editorFrame(historyStart, bounds.start, bounds.end, grid, width >= 1100 ? 4 : 2));
    editSession.current = { id: item.id, before: item.rollNotes, pastLength: item.rollPast.length };
    setSessionUndo(null);
    setRoom(true);
  }

  function leaveEditor() {
    const session = editSession.current;
    const item = takes.find(entry => entry.id === session?.id);
    if (session && item && !sameNotes(session.before, item.rollNotes)) {
      setSessionUndo({ id: item.id, notes: session.before });
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

  function commitBounds(item: Take, next: RangeBounds) {
    const previous: RangeBounds = { start: item.overlay.loopStart ?? item.overlay.selectionStart, end: item.overlay.loopEnd ?? item.overlay.selectionEnd };
    setBoundsUndo({ id: item.id, bounds: previous });
    const updated: Take = {
      ...item,
      overlay: { ...item.overlay, selectionStart: next.start, selectionEnd: next.end, loopStart: next.start, loopEnd: next.end },
    };
    setTakes((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    setMessage("Loop range updated.");
    playTake(updated);
  }

  function undoBounds() {
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
    playTake(updated);
  }

  function commitRoll(item: Take, notes: RollNote[]) {
    if (sameNotes(item.rollNotes, notes)) { setGhosts([]); return; }
    setTakes((current) => current.map((entry) => (entry.id === item.id ? { ...entry, rollEdited: true, rollPast: [...entry.rollPast, entry.rollNotes], rollFuture: [], rollNotes: notes } : entry)));
    setGhosts([]);
    if (loopingIds.includes(item.id)) playTake({ ...item, rollEdited: true, rollNotes: notes }, true);
    setMessage(loopingIds.includes(item.id) ? "Edit saved · next loop." : "Edit saved.");
  }

  function undoRoll() {
    if (!take || take.rollPast.length === 0) {
      return;
    }
    const previous = take.rollPast[take.rollPast.length - 1];
    if (loopingIds.includes(take.id)) playTake({ ...take, rollEdited: true, rollNotes: previous }, true);
    setTakes((current) => current.map((entry) => (entry.id === take.id ? { ...entry, rollNotes: previous, rollPast: entry.rollPast.slice(0, -1), rollFuture: [entry.rollNotes, ...entry.rollFuture], rollEdited: true } : entry)));
    setGhosts([]);
  }

  function redoRoll() {
    if (!take || take.rollFuture.length === 0) {
      return;
    }
    const next = take.rollFuture[0];
    if (loopingIds.includes(take.id)) playTake({ ...take, rollEdited: true, rollNotes: next }, true);
    setTakes((current) => current.map((entry) => (entry.id === take.id ? { ...entry, rollNotes: next, rollFuture: entry.rollFuture.slice(1), rollPast: [...entry.rollPast, entry.rollNotes], rollEdited: true } : entry)));
    setGhosts([]);
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
  const layerStrip = <View style={{ gap: 10 }} accessibilityLabel="Layers">
    {takes.map((item, index) => <View key={item.id} style={[styles.layerChip, { padding: 12, gap: 8, backgroundColor: palette.card, borderColor: item.id === selected ? palette.ink : palette.line, borderWidth: item.id === selected ? 2 : 1 }]}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`Layer ${index + 1}, Warm EP${loopingIds.includes(item.id) ? ", looping" : ""}`} accessibilityState={{ selected: item.id === selected }} onPress={() => { setSelected(item.id); setRangeMode(false); }} style={{ flex: 1, minHeight: 48, flexDirection: "row", gap: 12, alignItems: "center" }}>
          <Text style={{ color: palette.ink, fontFamily: "Geist Mono", fontSize: 18 }}>{index + 1}</Text><View><Text style={[styles.layerText, { color: palette.ink }]}>Piano</Text><Text style={[styles.meta, { color: palette.muted }]}>Warm EP · {loopingIds.includes(item.id) ? "looping" : "stopped"}</Text></View>
        </Pressable>
        {button("⋯", () => setLayerMenu(layerMenu === item.id ? null : item.id), { accessibilityLabel: `Layer ${index + 1} actions` })}
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={item.id === selected ? "Edit" : `Edit layer ${index + 1}`} onPress={() => { setSelected(item.id); enterEditor(item); }} style={{ minHeight: 48 }}><MiniRoll notes={item.rollNotes} palette={palette} /></Pressable>
      {layerMenu === item.id && <View style={{ gap: 6 }}>
        {button(loopingIds.includes(item.id) ? "Stop layer" : "Play layer", () => { if (loopingIds.includes(item.id)) { engine.stopLayer(item.id); setLoopingIds(ids => ids.filter(id => id !== item.id)); } else playTake(item); setLayerMenu(null); })}
        {button("Loop range", () => { setSelected(item.id); setRangeMode(true); setRollWindow(null); setLayerMenu(null); })}
        {button(`Delete Layer ${index + 1}`, () => deleteCapture(item.id))}
      </View>}
    </View>)}
    <View style={[styles.layerChip, { borderColor: palette.accent, borderWidth: 2, minHeight: 64, flexDirection: "row", alignItems: "center", gap: 16, justifyContent: "flex-start" }]}><Text style={{ color: palette.accent, fontFamily: "Geist Mono", fontSize: 20 }}>{takes.length + 1}</Text><View><Text style={[styles.layerText, { color: palette.ink }]}>Layer {takes.length + 1} · next capture</Text><Text style={[styles.meta, { color: palette.muted }]}>Warm EP</Text></View></View>
  </View>;

  if (room && take) return <Editor key={take.id}
    palette={palette} layers={takes.map(item => ({ id: item.id, looping: loopingIds.includes(item.id) }))} selectedLayer={take.id}
    notes={take.rollNotes} selectedNote={selectedNote} selectedIds={selectedIds} grid={take.rollGrid} tool={rollTool} looping={looping}
    canUndo={take.rollPast.length > 0} canRedo={take.rollFuture.length > 0}
    snapDivision={snapDivision} snapMode={snapMode} previewing={ghosts.length > 0}
    onBack={leaveEditor} onLayer={setSelected} onTool={setRollTool}
    onUndo={undoRoll} onRedo={redoRoll} onPlay={() => looping ? stopLoop() : playTake(take)} onCapture={capture}
    onGrid={(bpm, beatsPerBar) => { const phase = loopWindow(take.overlay).start; setEditorGridSettings({ bpm, beatsPerBar }); setTakes(current => current.map(entry => entry.id === take.id ? { ...entry, rollGrid: { bpm, beatsPerBar, phase, provisional: false } } : entry)); setGhosts([]); }}
    onSnap={division => { setSnapDivision(division); setGhosts([]); }} onSnapMode={setSnapMode}
    onVelocity={(velocity, scale) => { const chosen = take.rollNotes.filter(note => selectedIds.includes(note.id)); const average = chosen.reduce((sum, note) => sum + note.velocity, 0) / Math.max(1, chosen.length); commitRoll(take, take.rollNotes.map(note => selectedIds.includes(note.id) ? { ...note, velocity: Math.max(1, Math.min(127, Math.round(scale ? note.velocity * velocity / average : velocity))) } : note)); }}
    showOthers={showOthers} onShowOthers={() => setShowOthers(value => !value)}
    onSelectionAction={selectionAction} canPaste={noteClipboard.length > 0}
    quantiseStrength={quantiseStrength} quantiseSwing={quantiseSwing}
    onQuantiseSettings={(strength, swing) => { setQuantiseStrength(strength); setQuantiseSwing(swing); setGhosts(quantisePreview(take.rollNotes, selectedIds, take.rollGrid, snapDivision, strength, swing)); }}
    onPreview={() => setGhosts(quantisePreview(take.rollNotes, selectedIds, take.rollGrid, snapDivision, quantiseStrength, quantiseSwing))}
    onApply={() => commitRoll(take, applyPreview(take.rollNotes, ghosts))} onCancelPreview={() => setGhosts([])}
    renderRoll={(gridHeight, viewAction) => <Roll key={take.id}
      notes={take.rollNotes} timeWindow={rollWindow ?? (take.rollGrid ? editorFrame(take.performance.events[0]?.scheduleElapsed ?? 0n, loopWindow(take.overlay).start, loopWindow(take.overlay).end, take.rollGrid, width >= 1100 ? 4 : 2) : null)} bounds={loopWindow(take.overlay)} ceiling={take.rangeCeiling}
      historyStart={take.performance.events.reduce((min, event) => event.scheduleElapsed < min ? event.scheduleElapsed : min, take.performance.events[0].scheduleElapsed)}
      grid={take.rollGrid} palette={palette} mode="room" tool={rollTool} selectedId={selectedNote} selectedIds={selectedIds} onSelectMany={selectNotes} ghosts={ghosts} hitPx={48}
      backgroundLayers={showOthers ? takes.filter(item => item.id !== take.id).map((item, index) => { const offset = loopWindow(take.overlay).start - loopWindow(item.overlay).start; return { id: item.id, label: `Layer ${takes.indexOf(item) + 1}`, notes: item.rollNotes.map(note => ({ ...note, start: note.start + offset, end: note.end + offset })) }; }) : []}
      onWindow={setRollWindow} onBoundsCommit={next => commitBounds(take, next)} onSelect={id => selectNotes(id ? [id] : [])} onCommitNotes={notes => commitRoll(take, notes)}
      onTool={setRollTool} showChrome={false} showVelocityLane gridHeight={gridHeight} viewAction={viewAction}
      snapDivision={snapDivision} snapMode={snapMode} readTransport={() => engine.transport(take.id)}
      onAudition={engine.capabilities.audition ? (note, down) => engine.audition(note, down) : undefined} onStopAudition={() => engine.stopAudition()}
      readSoundingPitches={() => engine.capabilities.soundingPitches ? engine.soundingPitches(take.id) : null}
    />}
  />;

  return <View style={[styles.page, { backgroundColor: palette.bg }]}>
    <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll} contentContainerStyle={[styles.content, { padding: chrome.pad, maxWidth: 1200 }]}>
      {compactPlay ? <View style={{ flexDirection: "row", alignItems: "center", gap: 12, height: 48 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setPanel(panel === "settings" ? null : "settings")} style={{ minHeight: 48, justifyContent: "center" }}><Text style={[styles.kicker, { color: palette.muted }]}>BLOCKS ⌄</Text></Pressable>
        <Text numberOfLines={1} style={{ flex: 1, color: palette.ink, fontFamily: "Instrument Serif", fontSize: 30 }}>{project.name}</Text>
        {audioState === "closed" ? <Text accessibilityLiveRegion="polite" style={{ color: palette.ink, fontSize: 12 }}>Sound closed · reload</Text> : ribbon.length > 0 && audioState !== "running" ? button("Resume sound", enable, { disabled: busy }) : <Text style={{ color: palette.muted, fontFamily: "Geist Mono", fontSize: 13 }}>{liveGrid.bpm} BPM</Text>}
      </View> : <View style={styles.header}>
        <View><Pressable accessibilityRole="button" accessibilityLabel="Settings" onPress={() => setPanel(panel === "settings" ? null : "settings")} style={{ minHeight: 32, justifyContent: "center" }}><Text style={[styles.kicker, { color: palette.muted }]}>BLOCKS ⌄</Text></Pressable><Text style={[styles.title, { color: palette.ink, fontFamily: "Instrument Serif" }]}>{project.name}</Text></View>
        <View style={{ alignItems: "flex-end" }}><Text style={{ fontFamily: "Geist Mono", color: palette.ink, fontSize: 20 }}>{take?.rollGrid ? take.rollGrid.bpm : "— —"}</Text><Text style={[styles.meta, { color: palette.muted }]}>{take?.rollGrid ? `BPM · ${take.rollGrid.beatsPerBar}/4` : "free play"}</Text></View>
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
        <View style={[styles.card, { marginTop: 0, flex: width >= 1000 ? 1 : undefined, backgroundColor: palette.card, borderColor: palette.line, padding: 12 }]}>
          <View style={[styles.header, { marginTop: 0 }]}><Text style={[styles.kicker, { color: palette.muted }]}>{rangeMode && take ? `LOOP RANGE · LAYER ${takes.indexOf(take) + 1}` : "TAKE HISTORY"}</Text>{rangeMode ? button("Back to live", () => setRangeMode(false)) : <Text style={[styles.meta, { color: palette.muted }]}>{seconds(age, domain)} kept</Text>}</View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8, flexWrap: "wrap" }}>
            {button(`${rangeMode && take?.rollGrid ? take.rollGrid.bpm : liveGrid.bpm} BPM`, () => { setBpmText(String(rangeMode && take?.rollGrid ? take.rollGrid.bpm : liveGrid.bpm)); setMeterText(String(liveGrid.beatsPerBar)); setPanel(panel === "grid" ? null : "grid"); }, { accessibilityLabel: "Capture grid settings" })}
            <Text style={[styles.meta, { color: palette.muted }]}>{liveGrid.beatsPerBar}/4 · Bars</Text>
            <View style={{ flex: 1, minWidth: 100 }}><SelectControl label="Capture snap division" value={captureCustomSnap || !snapPreset ? "custom" : snapPreset.id} options={[...SNAP_PRESETS.map(item => ({ value: item.id, label: `Snap ${item.label}` })), { value: "custom", label: !snapPreset && snapDivision.kind === "note" ? `Snap ${snapDivision.numerator}/${snapDivision.denominator}` : "Custom…" }]} onChange={id => { setCaptureCustomSnap(id === "custom"); if (id !== "custom") setSnapDivision(SNAP_PRESETS.find(item => item.id === id)!.division); }} palette={palette} /></View>
          </View>
          {captureCustomSnap && <View style={styles.row}><TextInput accessibilityLabel="Capture custom snap fraction" value={captureFraction} onChangeText={setCaptureFraction} style={{ color: palette.ink, borderColor: palette.line, borderWidth: 1, minHeight: 48, padding: 10, minWidth: 90 }} />{button("Apply snap", () => { const match = captureFraction.trim().match(/^(\d+)\s*\/\s*(\d+)$/); const numerator = Number(match?.[1]), denominator = Number(match?.[2]); if (!match || numerator < 1 || numerator > 128 || denominator < 1 || denominator > 1024) { setMessage("Enter a fraction, such as 3/8 or 1/12."); return; } setSnapDivision({ kind: "note", numerator, denominator }); setCaptureCustomSnap(false); })}</View>}
          {panel === "grid" && <View style={{ gap: 8, marginBottom: 8 }}><Text style={[styles.meta, { color: palette.muted }]}>Editing grid · played timing stays unchanged</Text><View style={styles.row}><TextInput accessibilityLabel="Capture BPM" value={bpmText} onChangeText={setBpmText} keyboardType="numeric" style={{ color: palette.ink, borderColor: palette.line, borderWidth: 1, minHeight: 48, padding: 10, width: 90 }} /><SelectControl label="Capture beats per bar" value={meterText} options={[2,3,4,5,6,7,8].map(value => ({ value: String(value), label: `${value}/4` }))} onChange={setMeterText} palette={palette} />{button("Apply grid", () => { const bpm=Number(bpmText), beatsPerBar=Number(meterText); if (!Number.isFinite(bpm) || bpm < 20 || bpm > 400) { setMessage("BPM must be 20–400."); return; } setEditorGridSettings({ bpm, beatsPerBar }); setCaptureView(null); if (rangeMode && take) setTakes(items => items.map(item => item.id === take.id ? { ...item, rollGrid: { bpm, beatsPerBar, phase: item.rollGrid?.phase ?? item.overlay.loopStart ?? item.overlay.selectionStart } } : item)); setPanel(null); })}</View></View>}
          {rangeMode && take ? <Roll notes={take.rollNotes} timeWindow={rollWindow} bounds={loopWindow(take.overlay)} ceiling={take.rangeCeiling} historyStart={take.performance.events[0]?.scheduleElapsed ?? 0n} grid={take.rollGrid} palette={palette} mode="compact" tool="select" selectedId={null} ghosts={[]} hitPx={48} gridHeight={historyHeight} showChrome={false} onWindow={setRollWindow} onBoundsCommit={next => commitBounds(take,next)} onSelect={() => undefined} onCommitNotes={() => undefined} snapDivision={snapDivision} snapMode="grid" readTransport={() => engine.transport(take.id)} /> : <Roll notes={liveNotes} timeWindow={liveFrame} bounds={ribbon.length ? liveBounds : null} ceiling={liveFrame.end} historyStart={ribbon[0]?.scheduleElapsed ?? 0n} grid={liveGrid} palette={palette} mode="compact" tool="select" selectedId={null} ghosts={[]} hitPx={48} gridHeight={historyHeight} showChrome={false} onWindow={setCaptureView} onBoundsCommit={next => { setCaptureRangeUndo({ bounds: captureRange }); setCaptureRange(next); setCaptureView(liveFrame); }} onSelect={() => undefined} onCommitNotes={() => undefined} snapDivision={snapDivision} snapMode="grid" />}
          {!rangeMode && ribbon.length > 0 && <View style={{ flexDirection: "row", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 8 }}><Text style={[styles.meta, { color: palette.muted, flex: 1 }]}>{captureRange ? "Manual range · next capture" : "Auto range · next capture"}</Text>{captureRange && button("Auto range", () => { setCaptureRangeUndo({ bounds: captureRange }); setCaptureRange(null); setCaptureView(null); })}{captureRangeUndo && button("Undo range", () => { setCaptureRange(captureRangeUndo.bounds); setCaptureRangeUndo(null); })}</View>}
          {boundsUndo && rangeMode ? button("Undo range", undoBounds) : null}
        </View>
        <View style={{ width: width >= 1000 ? 300 : undefined }}>{layerStrip}</View>
      </View>
      {learning ? <Text style={[styles.meta, { color: palette.muted }]}>Learning {learning === "capture" ? "Capture" : "Play/Stop"}</Text> : null}
      {notice.kind !== "none" && <Text style={[styles.meta, { color: palette.muted }]}>{evictionCopy(notice)}</Text>}
    </ScrollView>
    <View style={[styles.dock, { backgroundColor: palette.dock, borderColor: palette.line }]}><View style={styles.dockInner}>
      {message ? <View style={{ flexDirection: "row", gap: 8, alignItems: "center", minHeight: 32, paddingBottom: 6 }}><Text accessibilityLiveRegion="polite" style={[styles.meta, { color: palette.muted, flex: 1 }]}>{message}</Text>{deletedTake ? button("Undo", undoCapture, { accessibilityLabel: "Undo delete capture" }) : sessionUndo ? button("Undo edits", () => { const item=takes.find(entry => entry.id===sessionUndo.id); if(item) commitRoll(item,sessionUndo.notes); setSessionUndo(null); }) : null}</View> : null}
      <View style={[styles.transportRow, { marginBottom: keyboardOpen ? 8 : 0 }]}>
        {button("↶", () => { if (sessionUndo) { const item=takes.find(entry => entry.id===sessionUndo.id); if(item) commitRoll(item,sessionUndo.notes); setSessionUndo(null); } else undoCapture(); }, { disabled: !undo && !deletedTake && !sessionUndo, accessibilityLabel: sessionUndo ? "Undo edits" : "Undo capture" })}
        <View style={{ flex: 1, alignItems: "center" }}><Text style={[styles.cardTitle, { color: palette.ink }]}>Warm EP</Text><Text style={[styles.meta, { color: palette.muted }]}>sound for Layer {takes.length + 1}</Text></View>
        {button(keyboardOpen ? "⌨ −" : "⌨ +", () => setKeyboardOpen(value => !value), { accessibilityLabel: keyboardOpen ? "Hide keyboard" : "Show keyboard" })}
        {button(looping ? "■" : "▶", () => looping ? stopLoop() : take ? playTake(take) : undefined, { disabled: !take, accessibilityLabel: looping ? "Stop" : "Play" })}
      </View>
      {keyboardOpen && <TouchKeyboard palette={palette} onNote={(note, down, velocity=96) => { if(down) heldTouch.current.add(note); else heldTouch.current.delete(note); engine.touch(note,down ? velocity : 0,down); }} onReleaseAll={() => { for(const note of heldTouch.current) engine.touch(note,0,false); heldTouch.current.clear(); }} />}
      <Pressable accessibilityRole="button" accessibilityLabel="Capture" onPress={capture} style={[styles.capture, { backgroundColor: palette.card, borderColor: palette.accent, borderWidth: 2, marginTop: 10, flex: undefined }]}><View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}><Text style={{ color: palette.accent, fontSize: 36 }}>↶</Text><View><Text style={[styles.captureText, { color: palette.ink }]}>Capture</Text><Text style={[styles.meta, { color: palette.muted }]}>{captureRange ? "keep this range" : "keep the last phrase"} → Layer {takes.length + 1}</Text></View></View></Pressable>
    </View></View>
  </View>;
}

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
