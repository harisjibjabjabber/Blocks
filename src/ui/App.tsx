import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { RollingHistory, type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { inferPulse, type InferenceReport } from "../domain/inference";
import {
  capturePerformance,
  defaultOverlay,
  loopLonger,
  loopShorter,
  loopWindow,
  nudgeBoundary,
  recover,
  shiftBeat,
  withChoice,
  type Performance,
  type PhraseOverlay,
} from "../domain/phrase";
import { beatForCut, createProject, gridStatusCopy, projectFromJson, projectToJson, proposeTempo, type Project } from "../domain/project";
import { eventsInSelection, moveSelectionStart, recentPhraseCut, type RecentPhraseCut } from "../domain/recent-phrase";
import { routeLearnedControl, type ControlMap, type LearnTarget } from "../domain/learn";
import { ReadinessStrip } from "./Readiness";
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
  const narrow = width < 720;
  const domain = engine.kind === "android" ? "android-monotonic-ns" : "web-performance-us";
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
  const [learning, setLearning] = useState<LearnTarget | null>(null);
  const [audioState, setAudioState] = useState(engine.readAudioState());
  const [scheduled, setScheduled] = useState(0);
  const loopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Take | null>(null);
  const learningRef = useRef<LearnTarget | null>(null);
  const mapRef = useRef<ControlMap>({ capture: null, transport: null });
  const actions = useRef({ capture: () => {}, togglePlay: () => {} });
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

  function playTake(item: Take) {
    const bounds = loopWindow(item.overlay);
    const preface = item.cut.controllerSeed.map((seed) => {
      const source = item.performance.events.find((event) => event.id === seed.sourceId) ?? item.performance.events[0];
      return { ...source, id: seed.sourceId + ":seed", kind: "cc" as const, channel: seed.channel, controller: seed.controller, value: seed.value, note: 0, velocity: 0, scheduleElapsed: bounds.start };
    });
    const selectedEvents = [
      ...preface,
      ...item.performance.events.filter((event) => event.scheduleElapsed >= bounds.start && event.scheduleElapsed <= bounds.end && !event.id.endsWith(":seed") && !event.id.endsWith(":hold")),
    ];
    if (!selectedEvents.some((event) => event.kind === "note-on" && event.velocity > 0)) {
      setMessage("That loop contains no recorded notes.");
      return;
    }
    const span = bounds.end - bounds.start;
    const durationSec = Math.max(0.4, Number(span) / unitFor(domain));
    engine.loopLayer(item.id, selectedEvents, 1, durationSec);
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
      loopStart: cut.selection.start,
      loopEnd: cut.selection.end,
      quantiseStrength: 0,
      playback: { mode: "original" as const },
    };
    const selected = eventsInSelection(events, cut.selection);
    const report = inferPulse(selected.length > 0 ? selected : events, ticksPerSecond);
    const id = "layer-" + (takes.length + 1);
    const created: Take = { id, performance, overlay, report, cut };
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
    setMessage("Capture undone. The pinned layer is gone. The ribbon was left as it is, and other layers keep playing.");
  }

  function applyBounds(item: Take, bounds: { start: bigint; end: bigint }, note: string) {
    updateTake(
      item.id,
      (current) => ({
        ...current,
        overlay: { ...current.overlay, selectionStart: bounds.start, selectionEnd: bounds.end, loopStart: bounds.start, loopEnd: bounds.end },
      }),
      note,
    );
  }

  function updateTake(id: string, patch: (current: Take) => Take, note: string) {
    setTakes((current) => current.map((item) => (item.id === id ? patch(item) : item)));
    setMessage(note + " Your timing is unchanged — only the grid moves.");
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

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[styles.content, narrow ? styles.contentNarrow : null]}>
        <Text style={styles.kicker}>Blocks</Text>
        <Text style={styles.meta}>Early prototype. Hardware unverified.</Text>
        <Text style={styles.title}>Warm EP</Text>

        <View style={styles.row}>
          <Pressable accessibilityRole="button" style={styles.primary} onPress={enable} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "Starting…" : gate.kind === "idle" ? "Enable" : "Try MIDI"}</Text>
          </Pressable>
          <View style={styles.status}>
            <ReadinessStrip audioState={audioState} showContext={false} />
            <Text style={styles.meta}>Input · {inputCopy(gate.kind, engine.ports().length)}</Text>
            <Text style={styles.meta}>Buffer · {seconds(age, domain)} kept · {ribbon.length} events</Text>
          </View>
        </View>
        {gate.kind === "idle" ? null : <Text style={styles.body}>{gate.detail}</Text>}
        {gate.kind === "no-device" ? (
          <Text style={styles.empty}>MIDI is allowed, and no input is connected. On-screen keys are not a MIDI device.</Text>
        ) : engine.ports().length === 0 ? null : (
          engine.ports().map((port) => (
            <Text key={port.id} style={styles.port}>
              {port.name} · {port.state}
            </Text>
          ))
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Take ribbon</Text>
          <TakeRibbon events={ribbon} />
          {notice.kind === "none" ? null : <Text style={styles.meta}>{evictionCopy(notice)}</Text>}
        </View>
        {learning ? <Text style={styles.meta}>Learning {learning === "capture" ? "Capture" : "Play/Stop"}. Not CC 64 and not a key.</Text> : null}
        {message ? <Text style={styles.meta}>{message}</Text> : null}

        {take ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{take.id}</Text>
            <Text style={styles.meta}>{gridStatusCopy(project)}</Text>
            <Text style={styles.meta}>{take.report.pulse === "none" || take.report.bpm === null ? "No pulse reading." : take.report.bpm.toFixed(1) + " bpm · 4/4"} · Quantise off</Text>
            <Text style={styles.meta}>Your timing is unchanged — only the grid moves.</Text>
            <View style={styles.wrap}>
              <Small label="Half" onPress={() => updateTake(take.id, (current) => ({ ...current, overlay: withChoice(current.overlay, "half") }), "Half is a manual grid correction.")} />
              <Small label="Double" onPress={() => updateTake(take.id, (current) => ({ ...current, overlay: withChoice(current.overlay, "double") }), "Double is a manual grid correction.")} />
              <Small label="Phase" onPress={() => updateTake(take.id, (current) => ({ ...current, overlay: shiftBeat(current.overlay) }), "Beat one moved by one beat.")} />
              <Small
                label="Loop shorter"
                onPress={() => {
                  const result = loopShorter(take.overlay, take.report);
                  updateTake(take.id, (current) => ({ ...current, overlay: result.overlay }), result.note);
                }}
              />
              <Small
                label="Loop longer"
                onPress={() => {
                  const result = loopLonger(take.overlay, take.report, take.performance);
                  updateTake(take.id, (current) => ({ ...current, overlay: result.overlay }), result.note);
                }}
              />
              <Small
                label="Boundary"
                onPress={() => {
                  const result = nudgeBoundary(take.overlay, take.report, take.performance);
                  updateTake(take.id, (current) => ({ ...current, overlay: result.overlay }), result.note);
                }}
              />
              <Small label="Recover" onPress={() => updateTake(take.id, (current) => ({ ...current, overlay: recover(current.performance.events) }), "Grid overlay reset. Raw times were not edited.")} />
              {take.cut.priorPhrase ? <Small label="Prior phrase" onPress={() => applyBounds(take, take.cut.priorPhrase as { start: bigint; end: bigint }, "Prior phrase. A manual alternative, not a second confident reading. Raw times were not edited.")} /> : null}
              {take.cut.priorBar ? <Small label="Prior bar" onPress={() => applyBounds(take, take.cut.priorBar as { start: bigint; end: bigint }, "Prior bar of the locked grid. The grid was not changed. Raw times were not edited.")} /> : null}
              <Small label="Recent phrase" onPress={() => applyBounds(take, take.cut.selection, "Back to the basic recent-phrase cut.")} />
              <Small
                label="Start later"
                onPress={() => {
                  const moved = moveSelectionStart(take.performance.events, { start: take.overlay.selectionStart, end: take.overlay.selectionEnd }, "later", unitFor(domain));
                  applyBounds(take, moved.selection, moved.note);
                }}
              />
              <Small
                label="Start earlier"
                onPress={() => {
                  const moved = moveSelectionStart(take.performance.events, { start: take.overlay.selectionStart, end: take.overlay.selectionEnd }, "earlier", unitFor(domain));
                  applyBounds(take, moved.selection, moved.note);
                }}
              />
              <Small label={looping ? "Stop loop" : "Hear loop"} onPress={() => (looping ? stopLoop() : playTake(take))} />
            </View>
          </View>
        ) : (
          <Text style={styles.empty}>No layer yet. Capture writes a new one and does not overwrite an existing layer.</Text>
        )}

        <Text style={styles.cardTitle}>On-screen keys (this device)</Text>
        <Text style={styles.meta}>Touch. Not listed as a MIDI input.</Text>
        <View style={styles.wrap}>
          {NOTES.map((note, index) => (
            <Pressable
              key={note + "-" + index}
              style={styles.pad}
              onPressIn={() => pressKey(note, "in")}
              onPress={() => pressKey(note, "press")}
              onPressOut={() => pressKey(note, "out")}
            >
              <Text style={styles.padText}>{NAMES[index]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={styles.dock}>
        <View style={styles.layerRow} accessibilityLabel="Layers">
          {takes.length === 0 ? <Text style={styles.meta}>No layer yet</Text> : takes.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.id + (loopingIds.includes(item.id) ? ", looping" : "")}
              style={[styles.layerChip, item.id === selected ? styles.layerChipOn : null]}
              onPress={() => setSelected(item.id)}
            >
              <Text style={styles.layerText}>{index + 1}{loopingIds.includes(item.id) ? " · looping" : ""}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture" style={styles.capture} onPress={capture}>
          <Text style={styles.captureText}>Capture</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable style={styles.secondary} onPress={undoCapture} disabled={!undo}>
            <Text style={styles.secondaryText}>Undo capture</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => (looping ? stopLoop() : take ? playTake(take) : setMessage("Nothing to play yet."))}>
            <Text style={styles.secondaryText}>{looping ? "Stop" : "Play"}</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => engine.silence()}>
            <Text style={styles.secondaryText}>Silence notes</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setAfterCapture(project.afterCapture === "loop" ? "silent" : "loop")}>
            <Text style={styles.secondaryText}>{project.afterCapture === "loop" ? "After capture: loop" : "After capture: stay silent"}</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              learningRef.current = "capture";
              setLearning("capture");
            }}
          >
            <Text style={styles.secondaryText}>Learn Capture</Text>
          </Pressable>
          <Pressable
            style={styles.secondary}
            onPress={() => {
              learningRef.current = "transport";
              setLearning("transport");
            }}
          >
            <Text style={styles.secondaryText}>Learn Play/Stop</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
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

function TakeRibbon({ events }: { events: CapturedEvent[] }) {
  const notes = events.filter((event) => event.kind === "note-on" && event.velocity > 0).slice(-64);
  if (notes.length === 0) {
    return <Text style={styles.meta}>Nothing played yet</Text>;
  }
  const start = notes[0].scheduleElapsed;
  const end = notes[notes.length - 1].scheduleElapsed;
  const span = end > start ? end - start : 1n;
  const lowest = notes.reduce((min, event) => Math.min(min, event.note), notes[0].note);
  const highest = notes.reduce((max, event) => Math.max(max, event.note), notes[0].note);
  const pitch = Math.max(1, highest - lowest);
  return (
    <View style={styles.ribbonPlot} accessibilityLabel="Take ribbon">
      {notes.map((event) => {
        const x = Number(((event.scheduleElapsed - start) * 100n) / span);
        const y = ((highest - event.note) / pitch) * 116;
        return <View key={event.id} style={[styles.ribbonMark, { left: `${Math.min(97, Math.max(0, x))}%`, top: y }]} />;
      })}
    </View>
  );
}

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondary} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#0D0F13" },
  content: { padding: 24, paddingBottom: 280, maxWidth: 880, width: "100%", alignSelf: "center" },
  contentNarrow: { padding: 16, paddingBottom: 320 },
  kicker: { color: "#9AA3AF", letterSpacing: 1.6, fontSize: 12, fontWeight: "600" },
  title: { color: "#ECEEF2", fontSize: 32, fontWeight: "700", marginTop: 4, letterSpacing: -0.4 },
  preset: { color: "#9AA3AF", marginTop: 4, fontSize: 14 },
  body: { color: "#ECEEF2", fontSize: 16, lineHeight: 22, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, flexWrap: "wrap" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  primary: { backgroundColor: "#FF6A3D", borderRadius: 12, minHeight: 48, minWidth: 48, paddingVertical: 14, paddingHorizontal: 18 },
  primaryText: { color: "#120C0A", fontSize: 16, fontWeight: "700" },
  status: { flexGrow: 1, flexShrink: 1, minWidth: 160 },
  statusTitle: { color: "#ECEEF2", fontSize: 16 },
  meta: { color: "#9AA3AF", marginTop: 4, fontSize: 14, lineHeight: 20 },
  empty: { color: "#ECEEF2", marginTop: 14, fontSize: 16 },
  port: { color: "#ECEEF2", marginTop: 6, fontSize: 16 },
  card: { backgroundColor: "#14171C", borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { color: "#ECEEF2", fontSize: 18, fontWeight: "700", marginTop: 16 },
  ribbonPlot: { position: "relative", height: 140, marginTop: 8, backgroundColor: "#0D0F13", borderRadius: 12, overflow: "hidden" },
  ribbonMark: { position: "absolute", width: 10, height: 18, borderRadius: 3, backgroundColor: "#C9D1DC" },
  layerRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 16 },
  layerChip: { backgroundColor: "#20252C", borderRadius: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "center" },
  layerChipOn: { borderWidth: 2, borderColor: "#FFFFFF" },
  layerText: { color: "#ECEEF2", fontSize: 14, fontWeight: "600" },
  dock: { position: "fixed", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: "#0D0F13" },
  capture: { backgroundColor: "#FF6A3D", borderRadius: 16, minHeight: 112, width: "100%", alignItems: "center", justifyContent: "center" },
  captureText: { color: "#120C0A", fontSize: 32, fontWeight: "700" },
  secondary: { backgroundColor: "#20252C", borderRadius: 12, minHeight: 48, minWidth: 48, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "center" },
  secondaryText: { color: "#ECEEF2", fontSize: 14 },
  pad: { backgroundColor: "#20252C", borderRadius: 12, minWidth: 48, minHeight: 48, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  padText: { color: "#ECEEF2", fontWeight: "700", fontSize: 16 },
});
