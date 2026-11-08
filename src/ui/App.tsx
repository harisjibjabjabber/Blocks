import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { createEngine } from "../adapters/engine";
import { RollingHistory, type CapturedEvent, type RibbonNotice } from "../domain/capture";
import { inferPulse, type InferenceReport } from "../domain/inference";
import {
  capturePerformance,
  chosenBpm,
  defaultOverlay,
  loopLonger,
  loopShorter,
  nudgeBoundary,
  recover,
  shiftBeat,
  withChoice,
  type Performance,
  type PhraseOverlay,
} from "../domain/phrase";
import { createProject, projectFromJson, projectToJson, type Project } from "../domain/project";

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
}

interface UndoCapture {
  takes: Take[];
  ribbon: CapturedEvent[];
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
  const [looping, setLooping] = useState(false);
  const [undo, setUndo] = useState<UndoCapture | null>(null);
  const loopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<Take | null>(null);

  useEffect(() => {
    let stop = false;
    engine.loadProject().then((text) => {
      if (stop) {
        return;
      }
      const loaded = projectFromJson(text);
      if (loaded) {
        setProject(loaded);
        engine.setSustain(loaded.sustainCc);
      }
    });
    const unsubscribe = engine.subscribe((event) => {
      history.push(event);
      setRibbon(history.snapshot());
      setNotice(history.ribbonNotice());
    });
    const timer = setInterval(() => setGate(engine.getGate()), 400);
    return () => {
      stop = true;
      unsubscribe();
      clearInterval(timer);
      if (loopTimer.current) {
        clearTimeout(loopTimer.current);
      }
    };
  }, [history]);

  const take = takes.find((item) => item.id === selected) ?? null;
  const newest = ribbon.length ? ribbon[ribbon.length - 1].scheduleElapsed : 0n;
  const age = ribbon.length ? newest - ribbon[0].scheduleElapsed : 0n;

  function stopLoop() {
    if (loopTimer.current) {
      clearTimeout(loopTimer.current);
      loopTimer.current = null;
    }
    pending.current = null;
    engine.stopReplay();
    setLooping(false);
  }

  function playTake(item: Take, continueLoop: boolean) {
    const selectedEvents = item.performance.events.filter(
      (event) => event.scheduleElapsed >= item.overlay.selectionStart && event.scheduleElapsed <= item.overlay.selectionEnd,
    );
    if (selectedEvents.length === 0) {
      setMessage("That loop contains no recorded events.");
      return;
    }
    engine.replay(selectedEvents, 1);
    setLooping(true);
    const span = selectedEvents[selectedEvents.length - 1].scheduleElapsed - selectedEvents[0].scheduleElapsed;
    const ms = Math.min(120000, Math.max(400, Number(span) / (unitFor(domain) / 1000)));
    if (loopTimer.current) {
      clearTimeout(loopTimer.current);
    }
    loopTimer.current = setTimeout(() => {
      const next = pending.current;
      pending.current = null;
      if (next) {
        setSelected(next.id);
        playTake(next, project.afterCapture === "loop");
        return;
      }
      if (continueLoop && project.afterCapture === "loop") {
        playTake(item, true);
      } else {
        setLooping(false);
      }
    }, ms);
  }

  async function enable() {
    setBusy(true);
    try {
      const next = await engine.enable();
      setGate(next);
      setMessage(next.detail);
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
    const performance = capturePerformance(events);
    const report = inferPulse(events, unitFor(domain));
    const overlay = defaultOverlay(events);
    const id = "layer-" + (takes.length + 1);
    const created: Take = { id, performance, overlay, report };
    setUndo({ takes, ribbon: events });
    setTakes((current) => [...current, created]);
    setSelected(id);
    history.clear();
    setRibbon([]);
    setNotice({ kind: "none" });
    const reading = report.pulse === "none" || report.bpm === null ? "No pulse reading." : report.bpm.toFixed(1) + " bpm · 4/4. One reading, not a set of candidates.";
    setMessage("Captured " + events.length + " events into " + id + ". " + reading + " Your timing is unchanged — only the grid moves.");
    if (project.afterCapture === "silent") {
      return;
    }
    if (looping) {
      pending.current = created;
      setMessage("Captured " + id + ". It joins at the next loop boundary. " + reading);
      return;
    }
    playTake(created, true);
  }

  function undoCapture() {
    if (!undo) {
      return;
    }
    stopLoop();
    setTakes(undo.takes);
    setSelected(undo.takes.length ? undo.takes[undo.takes.length - 1].id : null);
    history.replace(undo.ribbon);
    setRibbon(history.snapshot());
    setNotice(history.ribbonNotice());
    setUndo(null);
    setMessage("Capture undone. The ribbon has the events again.");
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

  return (
    <View style={styles.page}>
      <ScrollView contentContainerStyle={[styles.content, narrow ? styles.contentNarrow : null]}>
        <Text style={styles.kicker}>Blocks</Text>
        <Text style={styles.title}>Warm EP</Text>
        <Text style={styles.preset}>{engine.presetId}</Text>
        <Text style={styles.body}>Procedural FM electric piano. Velocity and sustain. Not a sampled piano, and not a brand name.</Text>

        <View style={styles.row}>
          <Pressable style={styles.primary} onPress={enable} disabled={busy}>
            <Text style={styles.primaryText}>{busy ? "Starting…" : "Enable"}</Text>
          </Pressable>
          <View style={styles.status}>
            <Text style={styles.statusTitle}>Sound · {gate.audioRunning ? "running" : "tap Enable"}</Text>
            <Text style={styles.meta}>Input · {inputCopy(gate.kind, engine.ports().length)}</Text>
            <Text style={styles.meta}>Buffer · {seconds(age, domain)} kept · {ribbon.length} events</Text>
          </View>
        </View>
        <Text style={styles.body}>{gate.detail}</Text>
        {engine.ports().length === 0 ? (
          <Text style={styles.empty}>No MIDI input is listed. On-screen keys are not a MIDI device.</Text>
        ) : (
          engine.ports().map((port) => (
            <Text key={port.id} style={styles.port}>
              {port.name} · {port.state}
            </Text>
          ))
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Take ribbon</Text>
          <Text style={styles.meta}>Newest at the right. Drag is not editing. Target about 120 seconds.</Text>
          <View style={styles.ribbon}>
            {ribbon.length === 0 ? <Text style={styles.meta}>Empty</Text> : null}
            {ribbon.slice(-24).map((event) => (
              <Text key={event.id} style={styles.tick}>
                {event.kind === "note-on" ? NAMES[NOTES.indexOf(event.note)] || event.note : event.kind === "cc" ? "CC" + event.controller : "·"}
              </Text>
            ))}
          </View>
          <Text style={styles.meta}>{evictionCopy(notice)}</Text>
        </View>

        <Text style={styles.meta}>Layer · {takes.length === 0 ? "empty" : takes.length + " captured, newest is the review"}</Text>
        <Text style={styles.meta}>Sketch tempo {project.tempoBpm} is locked. A reading does not change it.</Text>
        <Text style={styles.meta}>Sustain stays CC {project.sustainCc}. It is not the Capture control.</Text>
        <Text style={styles.body}>{message}</Text>

        {take ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{take.id} · review</Text>
            <Text style={styles.body}>{take.report.pulse === "none" || take.report.bpm === null ? "No pulse reading." : take.report.bpm.toFixed(1) + " bpm · 4/4"}</Text>
            <Text style={styles.meta}>{take.report.reason}</Text>
            <Text style={styles.body}>Your timing is unchanged — only the grid moves.</Text>
            <Text style={styles.meta}>Manual grid: {chosenBpm(take.report, take.overlay.tempoChoice)?.toFixed(1) ?? "no bpm"} · phase {take.overlay.phaseBeats} · 4/4</Text>
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
              <Small label="Recover" onPress={() => updateTake(take.id, (current) => ({ ...current, overlay: recover(current.performance.events) }), "Grid overlay reset.")} />
              <Small label={looping ? "Stop loop" : "Hear loop"} onPress={() => (looping ? stopLoop() : playTake(take, true))} />
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
              onPressIn={() => engine.touch(note, 100, true)}
              onPressOut={() => engine.touch(note, 0, false)}
            >
              <Text style={styles.padText}>{NAMES[index]}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
      <View style={styles.dock}>
        <Pressable style={styles.capture} onPress={capture}>
          <Text style={styles.captureText}>Capture</Text>
        </Pressable>
        <View style={styles.row}>
          <Pressable style={styles.secondary} onPress={undoCapture} disabled={!undo}>
            <Text style={styles.secondaryText}>Undo capture</Text>
          </Pressable>
          <Pressable style={styles.secondary} onPress={() => setAfterCapture(project.afterCapture === "loop" ? "silent" : "loop")}>
            <Text style={styles.secondaryText}>{project.afterCapture === "loop" ? "After capture: loop" : "After capture: stay silent"}</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function inputCopy(kind: string, ports: number): string {
  if (kind === "unsupported") {
    return "this browser has no Web MIDI";
  }
  if (kind === "denied") {
    return "permission denied";
  }
  if (kind === "disconnected") {
    return "disconnected";
  }
  if (kind === "no-device" || ports === 0) {
    return "no keyboard";
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

function Small({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.secondary} onPress={onPress}>
      <Text style={styles.secondaryText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#111418" },
  content: { padding: 24, paddingBottom: 180, maxWidth: 880, width: "100%", alignSelf: "center" },
  contentNarrow: { padding: 16, paddingBottom: 180 },
  kicker: { color: "#6C9BFF", letterSpacing: 2, fontSize: 12, fontWeight: "700" },
  title: { color: "#E8EAED", fontSize: 36, fontWeight: "700", marginTop: 6 },
  preset: { color: "#A0A7B1", fontFamily: "monospace", marginTop: 4 },
  body: { color: "#E8EAED", fontSize: 16, lineHeight: 22, marginTop: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" },
  wrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  primary: { backgroundColor: "#6C9BFF", borderRadius: 12, minHeight: 48, paddingVertical: 14, paddingHorizontal: 18 },
  primaryText: { color: "#0B1020", fontSize: 18, fontWeight: "700" },
  status: { flex: 1, minWidth: 220 },
  statusTitle: { color: "#E8EAED", fontSize: 16 },
  meta: { color: "#A0A7B1", marginTop: 4, fontSize: 14 },
  empty: { color: "#E8EAED", marginTop: 14, fontSize: 15 },
  port: { color: "#E8EAED", marginTop: 6 },
  card: { backgroundColor: "#1B1F24", borderRadius: 16, padding: 16, marginTop: 16 },
  cardTitle: { color: "#E8EAED", fontSize: 18, fontWeight: "700", marginTop: 16 },
  ribbon: { flexDirection: "row", flexWrap: "wrap", gap: 6, minHeight: 48, marginTop: 8 },
  tick: { color: "#E8EAED", backgroundColor: "#2A2F36", borderRadius: 8, paddingHorizontal: 8, paddingVertical: 8, overflow: "hidden" },
  dock: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, backgroundColor: "#111418", borderTopWidth: 1, borderTopColor: "#2A2F36" },
  capture: { backgroundColor: "#FFC93C", borderRadius: 16, minHeight: 96, alignItems: "center", justifyContent: "center" },
  captureText: { color: "#111418", fontSize: 32, fontWeight: "800" },
  secondary: { backgroundColor: "#2A2F36", borderRadius: 12, minHeight: 48, paddingVertical: 12, paddingHorizontal: 12, justifyContent: "center" },
  secondaryText: { color: "#E8EAED", fontSize: 14 },
  pad: { backgroundColor: "#2A2F36", borderRadius: 10, minWidth: 48, minHeight: 48, paddingVertical: 16, paddingHorizontal: 8, alignItems: "center" },
  padText: { color: "#E8EAED", fontWeight: "700" },
});
