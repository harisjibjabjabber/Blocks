import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { RollingHistory, type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { inferPulse, type InferenceReport } from "../domain/inference";
import { capturePerformance, defaultOverlay, loopWindow, type Performance, type PhraseOverlay } from "../domain/phrase";
import { beatForCut, createProject, projectFromJson, projectToJson, proposeTempo, type Project } from "../domain/project";
import { eventsInSelection, recentPhraseCut, type RecentPhraseCut } from "../domain/recent-phrase";
import { routeLearnedControl, type ControlMap, type LearnTarget } from "../domain/learn";
import { loopEvents } from "../domain/loop-events";
import { Roll, type RollTool } from "./Roll";
import { notesInRecentWindow } from "./ribbon-view";
import { ReadinessStrip } from "./Readiness";
import { moveBound, undoRange, type RangeBounds } from "./range";
import { applyPreview, notesFromEvents, quantisePreview, workingPlayback, type RollNote } from "./roll-notes";
import type { KnownGrid, TimeWindow } from "./roll-time";
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
  const { width } = useWindowDimensions();
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
  const [notice, setNotice] = useState<RibbonNotice>({ kind: "none" });
  const [takes, setTakes] = useState<Take[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [message, setMessage] = useState("Play, then capture. The ribbon keeps about 120 seconds.");
  const [busy, setBusy] = useState(false);
  const [loopingIds, setLoopingIds] = useState<string[]>([]);
  const [undo, setUndo] = useState<UndoCapture | null>(null);
  const [boundsUndo, setBoundsUndo] = useState<{ id: string; bounds: RangeBounds } | null>(null);
  const [learning, setLearning] = useState<LearnTarget | null>(null);
  const [room, setRoom] = useState(false);
  const [rollTool, setRollTool] = useState<RollTool>("select");
  const [selectedNote, setSelectedNote] = useState<string | null>(null);
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
    if (item.rollEdited) {
      const played = workingPlayback(item.performance.events, item.rollNotes, bounds);
      const preface = item.cut.controllerSeed.map((seed) => {
        const source = item.performance.events.find((event) => event.id === seed.sourceId) ?? item.performance.events[0];
        return { ...source, id: seed.sourceId + ":seed", kind: "cc" as const, channel: seed.channel, controller: seed.controller, value: seed.value, note: 0, velocity: 0, scheduleElapsed: bounds.start };
      });
      const selectedEvents = [...preface, ...played].sort((a, b) => (a.scheduleElapsed < b.scheduleElapsed ? -1 : a.scheduleElapsed > b.scheduleElapsed ? 1 : 0));
      if (!updateAtSeam && !selectedEvents.some((event) => event.kind === "note-on" && event.velocity > 0)) {
        setMessage("That loop contains no recorded notes.");
        return;
      }
      const span = bounds.end - bounds.start;
      scheduleLayer(item.id, selectedEvents, 1, Math.max(0.4, Number(span) / unitFor(domain)), bounds.start);
      setLoopingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
      return;
    }
    const preface = item.cut.controllerSeed.map((seed) => {
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
    const span = bounds.end - bounds.start;
    const durationSec = Math.max(0.4, Number(span) / unitFor(domain));
    scheduleLayer(item.id, selectedEvents, 1, durationSec, bounds.start);
    setLoopingIds((current) => (current.includes(item.id) ? current : [...current, item.id]));
  }

  async function enable() {
    setBusy(true);
    try {
      const next = await engine.enable();
      setGate(engine.getGate());
      setAudioState(engine.readAudioState());
      setMessage(next.kind === "site-addon" ? "Firefox needs its site-permission add-on before MIDI. On-screen keys still play." : "Sound follows the audio state above.");
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
    const cut = recentPhraseCut(events, {
      ticksPerSecond,
      gridPeriodTicks: tempoForCut ? BigInt(Math.round((60 / tempoForCut) * ticksPerSecond)) : null,
      gridOriginTicks: takes[0] ? takes[0].overlay.selectionStart : null,
      historyMayBeTruncated: notice.kind !== "none",
    });
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
    const id = "layer-" + (takes.length + 1);
    const created: Take = { id, performance, overlay, report, cut, rangeCeiling: cut.loop.end, rollNotes: notesFromEvents(events), rollPast: [], rollFuture: [], rollGrid: null, rollEdited: false };
    setUndo({ takes, ribbon: events, project });
    setTakes((current) => [...current, created]);
    setSelected(id);
    const proposal = cut.status === "recent" ? proposeTempo(project, report.bpm, takes.length) : proposeTempo(project, null, takes.length);
    setProject(proposal.project);
    engine.saveProject(projectToJson(proposal.project));
    const reading = report.pulse === "none" || report.bpm === null ? "No pulse reading. Quantise stays off." : report.bpm.toFixed(1) + " bpm · one reading, 4/4. Quantise stays off.";
    setMessage((cut.status === "recent" ? "Captured a recent phrase into " + id + ". " : "No clear rest, so the window may be the whole ribbon. ") + proposal.note + " Raw notes were not moved.");
    if (project.afterCapture === "silent") {
      return;
    }
    playTake(created);
  }

  function undoCapture() {
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
    setMessage("Capture undone. The pinned layer is gone. The ribbon was left as it is, and other layers keep playing.");
  }

  function commitBounds(item: Take, next: RangeBounds) {
    const previous: RangeBounds = { start: item.overlay.loopStart ?? item.overlay.selectionStart, end: item.overlay.loopEnd ?? item.overlay.selectionEnd };
    setBoundsUndo({ id: item.id, bounds: previous });
    const updated: Take = {
      ...item,
      overlay: { ...item.overlay, selectionStart: next.start, selectionEnd: next.end, loopStart: next.start, loopEnd: next.end },
    };
    setTakes((current) => current.map((entry) => (entry.id === item.id ? updated : entry)));
    setMessage("Loop bounds updated. The notes and the pedal were not moved.");
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
    setMessage("Range undone. The ribbon was left as it is.");
    playTake(updated);
  }

  function commitRoll(item: Take, notes: RollNote[]) {
    if (sameNotes(item.rollNotes, notes)) { setGhosts([]); return; }
    setTakes((current) => current.map((entry) => (entry.id === item.id ? { ...entry, rollEdited: true, rollPast: [...entry.rollPast, entry.rollNotes], rollFuture: [], rollNotes: notes } : entry)));
    setGhosts([]);
    if (loopingIds.includes(item.id)) playTake({ ...item, rollEdited: true, rollNotes: notes }, true);
    setMessage(loopingIds.includes(item.id) ? "Edit saved. Hear it on the next loop." : "Edit saved. Your original take is preserved.");
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
  }, [selectedNote]);

  historyActions.current = { undo: undoRoll, redo: redoRoll, room };
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!historyActions.current.room) return;
      if ((event.target as HTMLElement)?.closest("input, textarea, [contenteditable=true]")) return;
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
  const selectedCount = selectedNote ? 1 : take?.rollNotes.length ?? 0;
  const layerStrip = takes.length > 0 ? (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow} accessibilityLabel="Layers">
      {takes.map((item, index) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Layer ${index + 1}, Warm EP${loopingIds.includes(item.id) ? ", looping" : ""}`}
        accessibilityState={{ selected: item.id === selected }} onPress={() => setSelected(item.id)}
        style={[styles.layerChip, { backgroundColor: palette.card, borderColor: item.id === selected ? palette.accent : palette.line, borderWidth: item.id === selected ? 2 : 1 }]}>
        <Text style={[styles.layerText, { color: palette.ink }]}>{index + 1} · Warm EP {loopingIds.includes(item.id) ? "↻" : ""}</Text>
      </Pressable>)}
    </ScrollView>
  ) : null;

  return (
    <View style={[styles.page, { backgroundColor: palette.bg }]}>
      {room ? <View style={[styles.editorHeader, { backgroundColor: palette.bg, borderColor: palette.line }]}>
        <View style={[styles.header, { marginVertical: 0 }]}>
          {button("‹ Play", () => { setRoom(false); setPanel(null); }, { accessibilityLabel: "Back to Play" })}
          <View style={{ flex: 1 }}><Text style={[styles.kicker, { color: palette.muted }]}>EDIT</Text><Text style={{ color: palette.ink, fontFamily: "Georgia, serif", fontSize: width < 600 ? 21 : 26 }}>Warm EP</Text></View>
          <View style={styles.inline}>{button("↶", undoRoll, { disabled: !take?.rollPast.length, accessibilityLabel: "Undo" })}{button("↷", redoRoll, { disabled: !take?.rollFuture.length, accessibilityLabel: "Redo" })}</View>
        </View>
        {layerStrip}
      </View> : null}
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { padding: chrome.pad, maxWidth: room ? 1240 : 1000 }]}>
        {!room ? <View style={styles.header}>
          <View style={{ flexShrink: 1 }}>
            <Text style={[styles.kicker, { color: palette.muted }]}>BLOCKS / {room ? "EDIT" : "SKETCHBOOK"}</Text>
            <Text style={[styles.title, { color: palette.ink, fontFamily: "Georgia, serif" }]}>{room ? "Edit · Warm EP" : "A little room to play."}</Text>
          </View>
          {room ? button("‹ Play", () => { setRoom(false); setPanel(null); }, { accessibilityLabel: "Back to Play" }) : button("Settings", () => setPanel(panel === "settings" ? null : "settings"), { active: panel === "settings" })}
        </View> : null}

        {!room ? <View style={styles.statusRow}>
          {button(busy ? "Starting…" : gate.kind === "idle" ? "Enable sound" : "Reconnect MIDI", enable, { disabled: busy, primary: gate.kind === "idle", accessibilityLabel: "Enable" })}
          <View style={{ flex: 1 }}>
            <ReadinessStrip audioState={audioState} showContext={false} ink={palette.ink} />
            <Text style={[styles.meta, { color: palette.muted }]}>{inputCopy(gate.kind, engine.ports().length)} · {seconds(age, domain)} retained</Text>
          </View>
        </View> : null}

        {panel === "settings" && !room ? <View style={[styles.panel, { backgroundColor: palette.card, borderColor: palette.line }]}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>Appearance</Text>
          <View style={styles.row}>{(["system", "light", "dark"] as const).map(choice => <React.Fragment key={choice}>{button(choice[0].toUpperCase() + choice.slice(1), () => chooseTheme(choice), { active: themeChoice === choice })}</React.Fragment>)}</View>
          <Text style={[styles.meta, { color: palette.muted }]}>{gate.detail}</Text>
          <View style={styles.row}>
            {button(project.afterCapture === "loop" ? "After capture: loop" : "After capture: stay silent", () => setAfterCapture(project.afterCapture === "loop" ? "silent" : "loop"))}
            {button("Learn Capture", () => { learningRef.current = "capture"; setLearning("capture"); })}
            {button("Learn Play/Stop", () => { learningRef.current = "transport"; setLearning("transport"); })}
            {button("Stop all sound", () => { engine.stopAudition(); engine.stopReplay(); engine.silence(); setLoopingIds([]); })}
          </View>
          <Text style={[styles.meta, { color: palette.muted }]}>Warm EP · procedural electric piano. Hardware and latency unverified.</Text>
        </View> : null}

        <View style={[styles.card, { backgroundColor: palette.card, borderColor: palette.line, padding: room && width < 600 ? 8 : 16, marginTop: room ? 0 : 16 }]}>
          <View style={styles.header}>
            <View style={{ flexShrink: 1 }}>
              <Text style={[styles.cardTitle, { color: palette.ink }]}>{room ? "Piano roll" : "Your take"}</Text>
              <Text style={[styles.meta, { color: palette.muted }]}>{take ? `${take.rollNotes.length} notes · ${take.rollGrid ? `${take.rollGrid.bpm} BPM · ${take.rollGrid.beatsPerBar}/4` : "Free time · seconds"}` : "Play freely. Keep the phrase when it arrives."}</Text>
              {room ? <Text style={[styles.meta, { color: palette.muted }]}>{looping ? "↻ Looping" : "Stopped"} · 🔒 Loop range · adjust on Play</Text> : null}
            </View>
          </View>
          {take ? <Roll
            key={take.id}
            notes={take.rollNotes} timeWindow={rollWindow}
            bounds={{ start: take.overlay.loopStart ?? take.overlay.selectionStart, end: take.overlay.loopEnd ?? take.overlay.selectionEnd }}
            ceiling={take.rangeCeiling}
            historyStart={take.performance.events.reduce((min, event) => event.scheduleElapsed < min ? event.scheduleElapsed : min, take.performance.events[0].scheduleElapsed)}
            grid={take.rollGrid} palette={palette} mode={room ? "room" : "compact"} tool={rollTool} selectedId={selectedNote}
            ghosts={ghosts} hitPx={48} onWindow={setRollWindow} onBoundsCommit={next => commitBounds(take, next)}
            onSelect={setSelectedNote} onCommitNotes={notes => commitRoll(take, notes)}
            onEdit={() => setRoom(true)} onTool={setRollTool} showPan={!room}
            readTransport={() => engine.transport(take.id)}
            onAudition={engine.capabilities.audition ? (note, down) => engine.audition(note, down) : undefined}
            onStopAudition={() => engine.stopAudition()}
            readSoundingPitches={() => engine.capabilities.soundingPitches ? engine.soundingPitches(take.id) : null}
          /> : <View style={styles.emptyRoll}><LiveRoll events={ribbon} palette={palette} hitPx={48} /></View>}

          {take && room ? <View style={styles.contextRow}>
            <Text style={[styles.meta, { color: palette.muted, flexGrow: 1 }]}>{selectedNote ? "1 note selected" : "Select a note to edit"}</Text>
            {button(take.rollGrid ? "Grid" : "Set grid", () => { setGhosts([]); setPanel(panel === "grid" ? null : "grid"); }, { active: panel === "grid" })}
            {take.rollGrid ? button("Quantise…", () => { setPanel(panel === "quantise" ? null : "quantise"); setGhosts(panel === "quantise" ? [] : quantisePreview(take.rollNotes, selectedNote ? [selectedNote] : [], take.rollGrid)); }, { active: panel === "quantise" }) : null}
          </View> : null}
          {panel === "grid" && room && take ? <View style={[styles.panel, { borderColor: palette.line }]}>
            <Text style={[styles.cardTitle, { color: palette.ink }]}>Set a visual grid</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>Bar 1 starts at your loop start. Notes keep their original timing.</Text>
            <View style={styles.row}>
              <View><Text style={{ color: palette.muted }}>BPM</Text><TextInput value={bpmText} onChangeText={setBpmText} keyboardType="numeric" accessibilityLabel="Tempo" style={[styles.field, { color: palette.ink, borderColor: palette.line }]} /></View>
              <View><Text style={{ color: palette.muted }}>Beats / bar</Text><TextInput value={meterText} onChangeText={setMeterText} keyboardType="numeric" accessibilityLabel="Meter" style={[styles.field, { color: palette.ink, borderColor: palette.line }]} /></View>
              {button("Confirm grid", confirmGrid, { primary: true })}
              {button("Cancel", () => setPanel(null))}
            </View>
          </View> : null}
          {panel === "quantise" && room && take ? <View style={[styles.panel, { borderColor: palette.line }]}>
            <Text style={[styles.cardTitle, { color: palette.ink }]}>Quantise · {selectedCount} {selectedCount === 1 ? "note" : "notes"}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>1/16 grid · 50% strength. Preview only until you apply.</Text>
            <View style={styles.row}>{button(`Apply to ${selectedCount} ${selectedCount === 1 ? "note" : "notes"}`, () => { commitRoll(take, applyPreview(take.rollNotes, ghosts)); setPanel(null); }, { primary: true, accessibilityLabel: "Apply quantise" })}{button("Cancel", () => { setGhosts([]); setPanel(null); })}</View>
          </View> : null}
        </View>

        <Text accessibilityLiveRegion="polite" style={[styles.message, { color: palette.muted }]}>{message}</Text>
        {learning ? <Text style={[styles.meta, { color: palette.muted }]}>Learning {learning === "capture" ? "Capture" : "Play/Stop"}. Use a controller other than sustain or a playing key.</Text> : null}
        {!room ? <>
          {notice.kind === "none" ? null : <Text style={[styles.meta, { color: palette.muted }]}>{evictionCopy(notice)}</Text>}
          <View style={styles.header}><Text style={[styles.cardTitle, { color: palette.ink }]}>Try a few notes</Text><Text style={[styles.meta, { color: palette.muted }]}>Touch keyboard</Text></View>
          <View style={styles.keys} dataSet={{ keys: "true" }}>
            {NOTES.map((note, index) => <Pressable key={note} dataSet={{ key: String(note) }} accessibilityRole="button" accessibilityLabel={`Play ${NAMES[index]}${Math.floor(note / 12) - 1}`}
              style={[styles.pad, { backgroundColor: palette.card, borderColor: palette.line }]} onPressIn={() => pressKey(note, "in")} onPress={() => pressKey(note, "press")} onPressOut={() => pressKey(note, "out")}>
              <Text style={[styles.padText, { color: palette.ink }]}>{NAMES[index]}{note % 12 === 0 ? Math.floor(note / 12) - 1 : ""}</Text>
            </Pressable>)}
          </View>
        </> : null}
      </ScrollView>
      <View style={[styles.dock, { backgroundColor: palette.dock, borderColor: palette.line }]}>
        <View style={styles.dockInner}>
          {!room ? layerStrip : null}
          <View style={styles.transportRow}>
            {button(looping ? "■ Stop" : "▶ Play", () => looping ? stopLoop() : take ? playTake(take) : undefined, { disabled: !take, accessibilityLabel: looping ? "Stop" : "Play" })}
            <Pressable accessibilityRole="button" accessibilityLabel="Capture" onPress={capture} style={[styles.capture, { backgroundColor: palette.accent }]}>
              <Text style={[styles.captureText, { color: palette.accentInk }]}>Capture</Text>
            </Pressable>
            {!room ? button("↶", undoCapture, { disabled: !undo, accessibilityLabel: "Undo capture" }) : null}
            {!room && boundsUndo ? button("Undo range", undoBounds) : null}
          </View>
        </View>
      </View>
    </View>
  );
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

function LiveRoll({ events, palette, hitPx }: { events: CapturedEvent[]; palette: ReturnType<typeof resolveTheme>; hitPx: number }) {
  const recent = notesInRecentWindow(events, 12_000_000n);
  const notes = notesFromEvents(recent);
  const historyStart = recent.length ? recent.reduce((min, event) => (event.scheduleElapsed < min ? event.scheduleElapsed : min), recent[0].scheduleElapsed) : 0n;
  if (notes.length === 0) {
    return <Text style={{ color: palette.muted, marginTop: 8 }}>Nothing played yet</Text>;
  }
  return (
    <Roll
      notes={notes}
      timeWindow={null}
      bounds={null}
      ceiling={notes.reduce((max, note) => (note.end > max ? note.end : max), notes[0].end)}
      historyStart={historyStart}
      grid={null}
      palette={palette}
      mode="compact"
      tool="select"
      selectedId={null}
      ghosts={[]}
      hitPx={hitPx}
      onWindow={() => undefined}
      onBoundsCommit={() => undefined}
      onSelect={() => undefined}
      onCommitNotes={() => undefined}
      showPan={false}
    />
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, height: "100%", maxHeight: "100%", overflow: "hidden" },
  scroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  content: { padding: 24, paddingBottom: 24, width: "100%", alignSelf: "center" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, marginVertical: 8 },
  editorHeader: { flexShrink: 0, paddingHorizontal: 16, paddingTop: 10, borderBottomWidth: 1 },
  kicker: { letterSpacing: 2, fontSize: 11, fontWeight: "600" },
  title: { fontSize: 32, marginTop: 6, letterSpacing: -0.7 },
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
  capture: { borderRadius: 12, minHeight: 52, flex: 1, alignItems: "center", justifyContent: "center" },
  captureText: { fontSize: 18, fontWeight: "700" },
  secondary: { borderRadius: 8, minHeight: 48, minWidth: 48, paddingVertical: 10, paddingHorizontal: 12, justifyContent: "center", alignItems: "center" },
  secondaryText: { fontSize: 13, fontWeight: "500" },
  field: { borderWidth: 1, borderRadius: 8, minHeight: 48, width: 90, paddingHorizontal: 10, fontSize: 16, marginTop: 6 },
  keys: { flexDirection: "row", gap: 4, marginTop: 12, flexWrap: "wrap" },
  pad: { borderWidth: 1, borderRadius: 6, minWidth: 44, minHeight: 68, flexGrow: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 10 },
  padText: { fontSize: 12, fontWeight: "500" },
});
