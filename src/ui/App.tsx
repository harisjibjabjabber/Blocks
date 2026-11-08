import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { RollingHistory, type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { inferPulse, type InferenceReport } from "../domain/inference";
import { capturePerformance, defaultOverlay, loopWindow, type Performance, type PhraseOverlay } from "../domain/phrase";
import { beatForCut, createProject, projectFromJson, projectToJson, proposeTempo, type Project } from "../domain/project";
import { eventsInSelection, recentPhraseCut, type RecentPhraseCut } from "../domain/recent-phrase";
import { routeLearnedControl, type ControlMap, type LearnTarget } from "../domain/learn";
import { RangeRibbon } from "./RangeRibbon";
import { ribbonMarks } from "./ribbon-scale";
import { notesInRecentWindow, ribbonGrid } from "./ribbon-view";
import { ReadinessStrip } from "./Readiness";
import { moveBound, undoRange, type RangeBounds } from "./range";
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
  const [themeChoice, setThemeChoice] = useState<ThemeChoice>("dark");
  const [systemDark, setSystemDark] = useState(true);
  const palette = resolveTheme(themeChoice, systemDark);
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
  const [boundsUndo, setBoundsUndo] = useState<{ id: string; bounds: RangeBounds } | null>(null);
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
      loopStart: cut.loop.start,
      loopEnd: cut.loop.end,
      quantiseStrength: 0,
      playback: { mode: "original" as const },
    };
    const selected = eventsInSelection(events, cut.selection);
    const report = inferPulse(selected.length > 0 ? selected : events, ticksPerSecond);
    const id = "layer-" + (takes.length + 1);
    const created: Take = { id, performance, overlay, report, cut, rangeCeiling: cut.loop.end };
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

  return (
    <View style={[styles.page, { backgroundColor: palette.bg }]}>
      <ScrollView style={styles.scroll} contentContainerStyle={[styles.content, { padding: chrome.pad }]}>
        <Text style={[styles.kicker, { color: palette.muted }]}>Blocks</Text>
        <Text style={[styles.meta, { color: palette.muted }]}>Early prototype. Hardware unverified.</Text>
        <Text style={[styles.title, { color: palette.ink }]}>Warm EP</Text>
        <View style={styles.row} accessibilityLabel="Appearance">
          {(["dark", "light", "system"] as const).map((choice) => {
            const on = themeChoice === choice;
            return (
              <Pressable
                key={choice}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                onPress={() => chooseTheme(choice)}
                style={[styles.secondary, { backgroundColor: on ? palette.accent : palette.card, borderWidth: 1, borderColor: palette.line, minHeight: chrome.handlePx }]}
              >
                <Text style={[styles.secondaryText, { color: on ? palette.accentInk : palette.ink }]}>{choice === "dark" ? "Dark" : choice === "light" ? "Light" : "System"}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.row}>
          <Pressable accessibilityRole="button" style={[styles.primary, { backgroundColor: palette.accent, minHeight: chrome.handlePx }]} onPress={enable} disabled={busy}>
            <Text style={[styles.primaryText, { color: palette.accentInk }]}>{busy ? "Starting…" : gate.kind === "idle" ? "Enable" : "Try MIDI"}</Text>
          </Pressable>
          <View style={styles.status}>
            <ReadinessStrip audioState={audioState} showContext={false} ink={palette.ink} />
            <Text style={[styles.meta, { color: palette.muted }]}>Input · {inputCopy(gate.kind, engine.ports().length)}</Text>
            <Text style={[styles.meta, { color: palette.muted }]}>Buffer · {seconds(age, domain)} kept · {ribbon.length} events</Text>
          </View>
        </View>
        {gate.kind === "idle" ? null : <Text style={[styles.body, { color: palette.ink }]}>{gate.detail}</Text>}
        {gate.kind === "no-device" ? (
          <Text style={[styles.empty, { color: palette.ink }]}>MIDI is allowed, and no input is connected. On-screen keys are not a MIDI device.</Text>
        ) : engine.ports().length === 0 ? null : (
          engine.ports().map((port) => (
            <Text key={port.id} style={[styles.port, { color: palette.ink }]}>
              {port.name} · {port.state}
            </Text>
          ))
        )}

        <View style={[styles.card, { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line }]}>
          <Text style={[styles.cardTitle, { color: palette.ink }]}>Take ribbon</Text>
          {take ? (
            <RangeRibbon
              events={take.performance.events}
              bounds={{ start: take.overlay.loopStart ?? take.overlay.selectionStart, end: take.overlay.loopEnd ?? take.overlay.selectionEnd }}
              ceiling={take.rangeCeiling}
              palette={palette}
              hitPx={chrome.handlePx}
              grid={ribbonGrid({
                tempoBpm: project.tempoBpm,
                proposedTempoBpm: project.proposedTempoBpm,
                gridLocked: project.gridLocked,
                phase: gridPhase(project.gridLocked ? takes[0] ?? take : take),
              })}
              ticksPerSecond={unitFor(domain)}
              onCommit={(next) => commitBounds(take, next)}
            />
          ) : (
            <TakeRibbon events={ribbon} palette={palette} ticksPerSecond={unitFor(domain)} />
          )}
          {notice.kind === "none" ? null : <Text style={[styles.meta, { color: palette.muted }]}>{evictionCopy(notice)}</Text>}
        </View>
        {learning ? <Text style={styles.meta}>Learning {learning === "capture" ? "Capture" : "Play/Stop"}. Not CC 64 and not a key.</Text> : null}
        {message ? <Text style={[styles.meta, { color: palette.muted }]}>{message}</Text> : null}

        {take ? (
          <Text style={[styles.meta, { color: palette.muted }]}>{take.id} · Warm EP · drag the ribbon handles to change the loop</Text>
        ) : (
          <Text style={[styles.empty, { color: palette.ink }]}>No layer yet. Capture writes a new one and does not overwrite an existing layer.</Text>
        )}

        <Text style={[styles.cardTitle, { color: palette.ink }]}>On-screen keys (this device)</Text>
        <Text style={[styles.meta, { color: palette.muted }]}>Touch. Not listed as a MIDI input.</Text>
        <View style={styles.wrap} dataSet={{ keys: "true" }}>
          {NOTES.map((note, index) => (
            <Pressable
              key={note + "-" + index}
              dataSet={{ key: String(note) }}
              style={[styles.pad, { backgroundColor: palette.card, borderWidth: 1, borderColor: palette.line, minHeight: chrome.handlePx, minWidth: chrome.handlePx }]}
              onPressIn={() => pressKey(note, "in")}
              onPress={() => pressKey(note, "press")}
              onPressOut={() => pressKey(note, "out")}
            >
              <Text style={[styles.padText, { color: palette.ink }]}>{NAMES[index]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={[styles.dock, { backgroundColor: palette.dock, borderTopWidth: 1, borderTopColor: palette.line }]}>
        <View style={styles.layerRow} accessibilityLabel="Layers">
          {takes.length === 0 ? <Text style={[styles.meta, { color: palette.muted }]}>No layer yet</Text> : takes.map((item, index) => (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={item.id + (loopingIds.includes(item.id) ? ", looping" : "")}
              style={[styles.layerChip, { backgroundColor: palette.card, minHeight: chrome.handlePx }, item.id === selected ? { borderWidth: 2, borderColor: palette.accent } : { borderWidth: 1, borderColor: palette.line }]}
              onPress={() => setSelected(item.id)}
            >
              <Text style={[styles.layerText, { color: palette.ink }]}>{index + 1}{loopingIds.includes(item.id) ? " · looping" : ""} · Warm EP</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Capture" style={[styles.capture, { backgroundColor: palette.accent, borderColor: palette.accent }]} onPress={capture}>
          <Text style={[styles.captureText, { color: palette.accentInk }]}>Capture</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]} onPress={undoCapture} disabled={!undo}>
            <Text style={[styles.secondaryText, { color: palette.ink }]}>Undo capture</Text>
          </Pressable>
          <Pressable style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]} onPress={undoBounds} disabled={!boundsUndo}>
            <Text style={[styles.secondaryText, { color: palette.ink }]}>Undo range</Text>
          </Pressable>
          <Pressable style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]} onPress={() => (looping ? stopLoop() : take ? playTake(take) : setMessage("Nothing to play yet."))}>
            <Text style={[styles.secondaryText, { color: palette.ink }]}>{looping ? "Stop" : "Play"}</Text>
          </Pressable>
          <Pressable style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]} onPress={() => engine.silence()}>
            <Text style={[styles.secondaryText, { color: palette.ink }]}>Silence notes</Text>
          </Pressable>
          <Pressable style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]} onPress={() => setAfterCapture(project.afterCapture === "loop" ? "silent" : "loop")}>
            <Text style={[styles.secondaryText, { color: palette.ink }]}>{project.afterCapture === "loop" ? "After capture: loop" : "After capture: stay silent"}</Text>
          </Pressable>
          <Pressable
            style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]}
            onPress={() => {
              learningRef.current = "capture";
              setLearning("capture");
            }}
          >
            <Text style={[styles.secondaryText, { color: palette.ink }]}>Learn Capture</Text>
          </Pressable>
          <Pressable
            style={[styles.secondary, { backgroundColor: palette.card, minHeight: chrome.handlePx }]}
            onPress={() => {
              learningRef.current = "transport";
              setLearning("transport");
            }}
          >
            <Text style={[styles.secondaryText, { color: palette.ink }]}>Learn Play/Stop</Text>
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

function gridPhase(take: Take): bigint {
  if (take.cut.phaseOriginTicks !== null) {
    return take.cut.phaseOriginTicks;
  }
  const onset = take.performance.events.find((event) => event.kind === "note-on" && event.velocity > 0 && event.scheduleElapsed >= take.overlay.selectionStart);
  return onset?.scheduleElapsed ?? take.overlay.selectionStart;
}

function TakeRibbon({ events, palette, ticksPerSecond }: { events: CapturedEvent[]; palette: { muted: string; plot: string; line: string; note: string }; ticksPerSecond: number }) {
  const notes = notesInRecentWindow(
    events.filter((event) => event.kind === "note-on" && event.velocity > 0),
    BigInt(ticksPerSecond) * 12n,
  ).slice(-64);
  if (notes.length === 0) {
    return <Text style={{ color: palette.muted, marginTop: 8 }}>Nothing played yet</Text>;
  }
  const marks = ribbonMarks(notes);
  return (
    <View style={[styles.ribbonPlot, { backgroundColor: palette.plot, borderWidth: 1, borderColor: palette.line }]} accessibilityLabel="Take ribbon">
      {marks.map((mark) => (
        <View key={mark.id} style={[styles.ribbonMark, { backgroundColor: palette.note, left: `${Math.min(97, Math.max(0, mark.xPercent))}%`, top: mark.y }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, height: "100%", maxHeight: "100%", overflow: "hidden", backgroundColor: "#0D0F13" },
  scroll: { flexGrow: 1, flexShrink: 1, minHeight: 0 },
  content: { padding: 24, paddingBottom: 12, maxWidth: 880, width: "100%", alignSelf: "center" },
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
  dock: { flexShrink: 0, padding: 12, paddingBottom: 16, backgroundColor: "#0D0F13" },
  capture: { backgroundColor: "#FF6A3D", borderRadius: 16, minHeight: 84, width: "100%", alignItems: "center", justifyContent: "center" },
  captureText: { color: "#120C0A", fontSize: 32, fontWeight: "700" },
  secondary: { backgroundColor: "#20252C", borderRadius: 12, minHeight: 48, minWidth: 48, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "center" },
  secondaryText: { color: "#ECEEF2", fontSize: 14 },
  pad: { backgroundColor: "#20252C", borderRadius: 12, minWidth: 48, minHeight: 48, paddingVertical: 14, paddingHorizontal: 8, alignItems: "center", justifyContent: "center" },
  padText: { color: "#ECEEF2", fontWeight: "700", fontSize: 16 },
});
