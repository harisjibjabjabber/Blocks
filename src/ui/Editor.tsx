import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { Palette } from "./theme";
import { ROLL_RULER_HEIGHT, type RollTool } from "./Roll";
import type { RollNote } from "./roll-notes";
import { beatTicks, musicalPosition, pitchLabel, type KnownGrid } from "./roll-time";
import { SNAP_PRESETS, type SnapDivision, type SnapMode } from "./snap";
import { SelectControl } from "./SelectControl";
import { LoopSettings, LoopLengthControl } from "./LoopSettings";
import { tempoForBars, type FixedBars } from "./loop-assist";
import { TempoControl } from "./TempoControl";

type ViewKind = "zoom-in" | "zoom-out" | "refocus" | "earlier" | "later" | "higher" | "lower" | "taller" | "shorter";
type ViewAction = { id: number; kind: ViewKind };
interface EditorProps {
  palette: Palette; layers: { id: string; looping: boolean; soundName: string }[]; soundName: string; onSound: () => void; selectedLayer: string;
  notes: readonly RollNote[]; selectedNote: string | null; selectedIds: readonly string[]; grid: KnownGrid | null;
  loopRange: { start: bigint; end: bigint };
  tool: RollTool; looping: boolean; canUndo: boolean; canRedo: boolean;
  snapDivision: SnapDivision; snapMode: SnapMode; previewing: boolean;
  onBack: () => void; onLayer: (id: string) => void; onTool: (tool: RollTool) => void;
  onUndo: () => void; onRedo: () => void; onPlay: () => void; onCapture: () => void;
  onGrid: (bpm: number, beats: number) => void; onSnap: (division: SnapDivision) => void; onSnapMode: (mode: SnapMode) => void;
  onVelocity: (velocity: number, scale?: boolean) => void; onPreview: () => void; onApply: () => void; onCancelPreview: () => void;
  onQuantiseNow: () => void;
  onCutRange: () => void;
  captureBpm: number | null; loopBars: FixedBars | null; onLoopBars: (bars: FixedBars | null) => void; onResetLoop: () => void; firstLayer: boolean;
  onShowFullTake: () => void;
  showOthers: boolean; onShowOthers: () => void; canPaste: boolean;
  onSelectionAction: (action: "all" | "delete" | "copy" | "paste" | "duplicate") => void;
  quantiseStrength: number; quantiseSwing: number; onQuantiseSettings: (strength: number, swing: number) => void;
  renderRoll: (height: number, action?: ViewAction) => React.ReactNode;
}

/** Frame 18: layer identity, settings, shared roll, velocity/context and three tools. */
export function Editor(p: EditorProps) {
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1100;
  const split = width >= 720;
  const c = p.palette;
  const [panel, setPanel] = useState<"grid" | "view" | "velocity" | "quantise" | "selection" | "loop" | null>(null);
  const [meter, setMeter] = useState(String(p.grid?.beatsPerBar ?? 4));
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(p.snapDivision.kind === "note" ? `${p.snapDivision.numerator}/${p.snapDivision.denominator}` : "1/12");
  const [customOpen, setCustomOpen] = useState(false);
  const [viewAction, setViewAction] = useState<ViewAction>();
  const [rollViewportHeight, setRollViewportHeight] = useState(0);
  const note = p.notes.find(n => n.id === p.selectedNote);
  const selection = p.notes.filter(n => p.selectedIds.includes(n.id));
  const averageVelocity = Math.round(selection.reduce((sum, n) => sum + n.velocity, 0) / Math.max(1, selection.length));
  const [velocityMode, setVelocityMode] = useState("set");
  const [velocity, setVelocity] = useState(String(note?.velocity ?? 100));
  useEffect(() => setVelocity(String(selection.length > 1 ? averageVelocity : note?.velocity ?? 100)), [note?.id, note?.velocity, averageVelocity, selection.length]);
  // Leaving the preview panel must never hide the only Apply/Cancel actions on phone.
  useEffect(() => { if (panel !== "quantise") p.onCancelPreview(); if (panel !== "grid") setCustomOpen(false); }, [panel]);
  useEffect(() => { if (!split) p.onCancelPreview(); }, [split]);
  useEffect(() => { setPanel(null); setCustomOpen(false); setError(""); setMeter(String(p.grid?.beatsPerBar ?? 4)); }, [p.selectedLayer]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setPanel(null); setCustomOpen(false); setError(""); p.onCancelPreview(); return; }
      if ((e.target as HTMLElement)?.closest("input,select,textarea,[contenteditable=true]")) return;
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey) {
        const action = ({ a: "all", c: "copy", v: "paste", d: "duplicate" } as const)[e.key.toLowerCase() as "a" | "c" | "v" | "d"];
        if (action) { e.preventDefault(); p.onSelectionAction(action); return; }
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tools: Record<string, RollTool> = { d: "draw", s: "select", e: "erase" };
      if (tools[e.key.toLowerCase()]) { e.preventDefault(); p.onTool(tools[e.key.toLowerCase()]); }
    };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }, [p.onTool, p.onSelectionAction]);
  const preset = SNAP_PRESETS.find(v => JSON.stringify(v.division) === JSON.stringify(p.snapDivision));
  const snapLabel = preset?.label ?? (p.snapDivision.kind === "note" ? `${p.snapDivision.numerator}/${p.snapDivision.denominator}` : "Bar");
  const count = selection.length || p.notes.length;
  const loopStart = p.grid ? musicalPosition(p.loopRange.start, p.grid) : "";
  const loopEnd = p.grid ? musicalPosition(p.loopRange.end, p.grid) : "";
  const loopBeats = p.grid ? Number((Number(p.loopRange.end - p.loopRange.start) / Number(beatTicks(p.grid.bpm))).toFixed(3)) : 0;
  const loopLabel = p.grid ? loopStart === loopEnd ? `Loop ${loopStart} · ${loopBeats} beat` : `Loop ${loopStart}–${loopEnd}` : `Loop ${(Number(p.loopRange.start) / 1_000_000).toFixed(1)}–${(Number(p.loopRange.end) / 1_000_000).toFixed(1)}s`;
  const text = (value: string, muted = false, extra: object = {}) => <Text style={[s.text, { color: muted ? c.muted : c.ink }, extra]}>{value}</Text>;
  const button = (label: string, action: () => void, opts: { aria?: string; active?: boolean; disabled?: boolean; capture?: boolean; flex?: boolean } = {}) => <Pressable accessibilityRole="button" accessibilityLabel={opts.aria ?? label} accessibilityState={{ disabled: !!opts.disabled, ...(opts.active === undefined ? {} : { selected: opts.active }) }} disabled={opts.disabled} onPress={action} style={[s.button, { borderColor: opts.capture ? c.accent : opts.active ? c.ink : c.line, backgroundColor: opts.active ? c.ink : c.card, opacity: opts.disabled ? .4 : 1 }, opts.flex && { flex: 1 }]}><Text style={[s.text, { color: opts.active ? c.bg : opts.capture ? c.accent : c.ink, fontWeight: "600" }]}>{label}</Text></Pressable>;
  const tools = <View style={[s.tools, desktop && { flexDirection: "column", alignItems: "stretch", marginTop: 28 }]}>{([ ["draw", "✎", "Draw"], ["select", "▧", "Select"], ["erase", "⌫", "Erase"] ] as const).map(([tool, icon, label]) => <Pressable key={tool} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: p.tool === tool }} onPress={() => p.onTool(tool)} style={[s.tool, { backgroundColor: p.tool === tool ? c.ink : c.card, borderColor: p.tool === tool ? c.ink : c.line }, desktop && { flexDirection: "row", flex: undefined, justifyContent: "flex-start", paddingHorizontal: 16, gap: 12 }]}><Text style={{ color: p.tool === tool ? c.bg : c.ink, fontSize: 21 }}>{icon}</Text><Text style={[s.text, { color: p.tool === tool ? c.bg : c.ink, fontWeight: "600" }]}>{label}{p.tool === tool ? " ✓" : ""}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Capture" onPress={p.onCapture} style={[s.tool, { flex: undefined, width: desktop ? undefined : 64, borderColor: c.accent, backgroundColor: c.card }]}><Text style={{ fontSize: 24, color: c.accent }}>↶</Text>{text("Capture", false, { fontSize: 12 })}</Pressable></View>;
  const layers = <View style={[s.layers, desktop && { flexDirection: "column", alignItems: "stretch" }]}>{p.layers.map((layer, index) => <Pressable key={layer.id} accessibilityRole="button" accessibilityLabel={`Layer ${index + 1}, ${layer.soundName}${layer.looping ? ", looping" : ""}`} accessibilityState={{ selected: layer.id === p.selectedLayer }} onPress={() => p.onLayer(layer.id)} style={[s.layer, { borderColor: layer.id === p.selectedLayer ? c.ink : c.line, borderWidth: layer.id === p.selectedLayer ? 2 : 1, backgroundColor: c.card }]}>{text(`◆  ${index + 1} ${layer.soundName}${layer.looping ? "  ↻" : ""}`, false, { fontWeight: "600", whiteSpace: "nowrap" })}</Pressable>)}</View>;
  const quantise = <View style={{ gap: 12 }}>
    {text("QUANTISE", true, s.label)}
    {text(`${selection.length ? "Selected" : "Whole layer"} · ${count} ${count === 1 ? "note" : "notes"}`)}
    {text(`Grid ${snapLabel}`, true)}
    <View style={s.row}><View style={{ flex: 1 }}>{text("Strength", true)}<SelectControl label="Quantise strength" value={String(p.quantiseStrength)} options={[0,25,50,75,100].map(n => ({ value: String(n), label: `${n}%` }))} onChange={value => p.onQuantiseSettings(Number(value), p.quantiseSwing)} palette={c} /></View><View style={{ flex: 1 }}>{text("Swing", true)}<SelectControl label="Quantise swing" value={String(p.quantiseSwing)} options={[0,10,25,33,50].map(n => ({ value: String(n), label: `${n}%` }))} onChange={value => p.onQuantiseSettings(p.quantiseStrength, Number(value))} palette={c} /></View></View>
    {!p.grid ? button("Set grid", () => { setPanel("grid"); setError(""); }) : <View style={s.row}>{button(p.previewing ? "Cancel" : "Preview", p.previewing ? p.onCancelPreview : p.onPreview, { disabled: p.snapDivision.kind === "off" || count === 0 })}{button("Apply ↵", () => { p.onApply(); setPanel(null); }, { aria: "Apply quantise", disabled: !p.previewing, capture: true })}</View>}
  </View>;
  const changeView = (kind: ViewKind) => setViewAction(a => ({ id: (a?.id ?? 0) + 1, kind }));
  const viewControls = <View style={{ gap: 12 }}>
    <View style={{ gap: 6 }}>{text("Time zoom", true)}<View style={s.row}>{button("−", () => changeView("zoom-out"), { aria: "Zoom out time", flex: true })}{button("+", () => changeView("zoom-in"), { aria: "Zoom in time", flex: true })}</View></View>
    <View style={{ gap: 6 }}>{text("Note height", true)}<View style={s.row}>{button("−", () => changeView("shorter"), { aria: "Smaller note height", flex: true })}{button("+", () => changeView("taller"), { aria: "Larger note height", flex: true })}</View></View>
    {button("Fit loop", () => changeView("refocus"), { aria: "Refocus" })}
    {button("Show full take", () => { p.onShowFullTake(); setPanel(null); })}
    <View style={s.row}>{button("← Earlier", () => changeView("earlier"), { flex: true })}{button("Later →", () => changeView("later"), { flex: true })}</View>
    <View style={s.row}>{button("↓ Pitches", () => changeView("lower"), { flex: true })}{button("↑ Pitches", () => changeView("higher"), { flex: true })}</View>
  </View>;
  const gridHeight = Math.max(80, rollViewportHeight > 0 ? rollViewportHeight - (ROLL_RULER_HEIGHT + 152) : height - (desktop ? 390 : 484));
  return <View dataSet={{ editor: "storyboard-18", captureBpm: p.captureBpm === null ? "" : String(p.captureBpm) }} style={[s.page, { backgroundColor: c.bg }]}>
    <View style={[s.header, { borderColor: c.line }]}>
      {button("‹ Play", p.onBack, { aria: "Back to Play" })}
      <Pressable accessibilityRole="button" accessibilityLabel="Sound for selected layer" onPress={p.onSound} style={{ flex: 1, minHeight: 48, justifyContent: "center", alignItems: desktop ? "flex-start" : "center", minWidth: 0 }}><Text numberOfLines={1} style={{ fontFamily: "Instrument Serif", fontSize: desktop ? 30 : 26, color: c.ink }}>Edit · Piano</Text>{text(`Layer ${p.layers.findIndex(l => l.id === p.selectedLayer) + 1} · ${p.soundName} ▾`, true, { fontSize: 12 })}</Pressable>
      {desktop && text(loopLabel, true)}
      <View style={[s.row, { gap: 4 }]}>{button("↶", p.onUndo, { aria: "Undo", disabled: !p.canUndo })}{button("↷", p.onRedo, { aria: "Redo", disabled: !p.canRedo })}</View>
    </View>
    <View style={[s.workspace, desktop && { padding: 20 }, !desktop && split && { padding: 12 }]}>
      {desktop && <ScrollView style={{ width: 200, flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 20, gap: 8 }}>{layers}{p.layers.length > 1 && button(p.showOthers ? "◐ Others shown" : "◐ Others hidden", p.onShowOthers, { aria: "Show other layers", active: p.showOthers })}{tools}</ScrollView>}
      <View style={[s.main, !desktop && split && { flex: undefined, width: Math.min(420, width * .5 - 18) }]}>
        {!desktop && <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, flexShrink: 1 }} contentContainerStyle={{ paddingVertical: 4, gap: 8 }}>{layers}{p.layers.length > 1 && button(p.showOthers ? "◐ Others shown" : "◐ Others hidden", p.onShowOthers, { aria: "Show other layers", active: p.showOthers })}</ScrollView><View style={{ maxWidth: 112 }}>{text(loopLabel, true, { fontSize: 10 })}</View>{button(p.looping ? "■" : "▶", p.onPlay, { aria: p.looping ? "Stop" : "Play" })}</View>}
        <View style={[s.settings, { borderColor: c.line }]}>
          {desktop && button(p.looping ? "■ Stop" : "▶ Play", p.onPlay, { aria: p.looping ? "Stop" : "Play" })}
          <TempoControl value={p.grid?.bpm ?? 120} palette={c} caption={`BPM · ${p.grid?.beatsPerBar ?? 4}/4`} onChange={bpm => { p.onCancelPreview(); p.onGrid(bpm, p.grid?.beatsPerBar ?? 4); }} onValuePress={() => { setPanel(panel === "grid" ? null : "grid"); setError(""); }} valueLabel={p.grid ? "Grid settings" : "Set grid"} />
          <View style={{ flex: 1, minWidth: 80, position: "relative" }}><Text style={{ position: "absolute", top: -7, left: 8, paddingHorizontal: 3, backgroundColor: c.card, color: c.muted, fontFamily: "Inter Tight", fontSize: 11, zIndex: 1 }}>Snap</Text><SelectControl label="Snap division" value={customOpen || !preset ? "custom" : preset.id} options={[...SNAP_PRESETS.map(v => ({ value: v.id, label: v.label })), { value: "custom", label: preset ? "Custom…" : snapLabel }]} onChange={id => { p.onCancelPreview(); if (id === "custom") { setCustomOpen(true); setPanel("grid"); } else { setCustomOpen(false); p.onSnap(SNAP_PRESETS.find(v => v.id === id)!.division); } }} palette={c} /></View>
          {button("⋯", () => setPanel(panel === "view" ? null : "view"), { aria: "View settings" })}
        </View>
        <View onLayout={event => { const next = event.nativeEvent.layout.height; setRollViewportHeight(current => Math.abs(current - next) > 1 ? next : current); }} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {p.renderRoll(gridHeight, viewAction)}
        </View>
        <View style={[s.context, { backgroundColor: c.card, borderColor: c.line }]}>
          {desktop && <View style={{ flex: 1, minWidth: 0 }}>{text(selection.length > 1 ? `${selection.length} selected` : note ? `${pitchLabel(note.pitch)} · 1` : `${p.notes.length} notes`, false, { fontWeight: "600", fontSize: 12 })}</View>}
          <LoopLengthControl bars={p.loopBars} onPress={() => setPanel(panel === "loop" ? null : "loop")} open={panel === "loop"} palette={c} />
          {desktop && button("Velocity", () => setPanel(panel === "velocity" ? null : "velocity"), { disabled: !note })}
          {panel !== "loop" && button("Cut range", () => { p.onCancelPreview(); p.onCutRange(); setPanel(null); })}
          {button("Quantise", () => { p.onCancelPreview(); p.onQuantiseNow(); setPanel(null); }, { disabled: !p.grid || p.snapDivision.kind === "off" || !p.notes.length })}
          {button("⋯", () => setPanel(panel === "selection" ? null : "selection"), { aria: "Selection actions" })}
        </View>
        {!desktop && <View style={s.bottom}>{tools}</View>}
      </View>
      {split && <ScrollView style={[s.inspector, { borderColor: c.line, flexBasis: desktop ? 230 : 0, flexGrow: desktop ? 0 : 1, flexShrink: desktop ? 0 : 1 }]} contentContainerStyle={{ gap: 28, paddingBottom: 24 }}><View style={[s.inspectorCard, { backgroundColor: c.card, borderColor: c.line }]}>{quantise}</View><View style={{ gap: 12 }}>{text("SELECTION", true, s.label)}{text(selection.length > 1 ? `${selection.length} selected · ${averageVelocity} avg` : note ? `${pitchLabel(note.pitch)} · Velocity ${note.velocity}` : "No selection", true)}{note && button("Velocity", () => setPanel("velocity"))}{button("Selection actions", () => setPanel("selection"))}</View><View style={{ gap: 8 }}>{text("KEYBOARD", true, s.label)}{text("B · Draw / Select", true)}{text("Double-click · draw / delete", true)}{text("Drag empty space · select notes", true)}{text("Shift-click · add to selection", true)}{text("D  S  E · Draw · Select · Erase", true)}{text("Space · Play / Stop", true)}{text("Ctrl/Cmd + Z · Undo", true)}{text("Shift + Ctrl/Cmd + Z · Redo", true)}{text("Alt + drag · no snap", true)}</View>{button("View…", () => setPanel("view"))}</ScrollView>}
    </View>
    {panel && <View dataSet={{ editorPanel: panel }} style={[s.overlay, { backgroundColor: c.card, borderColor: c.line, left: desktop ? 240 : 12, right: desktop ? 270 : split ? width / 2 : 12, maxHeight: height - 112 }]}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>{text(panel === "loop" ? "Loop" : panel === "grid" ? "Grid & snap" : panel === "velocity" ? "Velocity" : panel === "view" ? "View" : panel === "selection" ? "Selection" : "Quantise", false, { fontSize: 18, fontWeight: "600" })}{button("×", () => { setPanel(null); setError(""); if (panel === "quantise") p.onCancelPreview(); }, { aria: "Close settings" })}</View>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        {panel === "loop" && <LoopSettings bars={p.loopBars} onBars={p.onLoopBars} onReset={() => { p.onResetLoop(); setPanel(null); }} onCut={() => { p.onCancelPreview(); p.onCutRange(); setPanel(null); }} palette={c} tempoPreview={p.firstLayer && p.loopBars ? tempoForBars(p.loopRange, p.loopBars, p.grid?.beatsPerBar ?? 4) : null} />}
        {panel === "grid" && <>
          <View>{text("Beats / bar", true)}<SelectControl label="Meter" value={meter} options={[2,3,4,5,6,7,8,9,10,11,12].map(value => ({ value: String(value), label: `${value}/4` }))} onChange={setMeter} palette={c} /></View>
          {text("Editing grid · notes keep their played timing", true)}
          {customOpen && <View>{text("Custom note fraction", true)}<TextInput accessibilityLabel="Custom fraction" value={custom} onChangeText={setCustom} placeholder="1/12" placeholderTextColor={c.muted} style={[s.input, { color: c.ink, borderColor: c.line }]} /></View>}
          {text("Move snapping", true)}<SelectControl label="Snap mode" value={p.snapMode} options={[{ value: "grid", label: "Align to grid" }, { value: "offset", label: "Preserve timing offset" }]} onChange={mode => p.onSnapMode(mode as SnapMode)} palette={c} />
          {error ? text(error) : null}
          <View style={s.row}>{button("Confirm grid", () => {
            const bpm = p.grid?.bpm ?? 120, beats = Number(meter);
            if (!Number.isFinite(bpm) || bpm <= 0 || !Number.isInteger(beats) || beats < 2 || beats > 12) { setError("Use a positive BPM and 2–12 beats per bar."); return; }
            if (customOpen) { const match = custom.trim().match(/^(\d+)\s*\/\s*(\d+)$/); const numerator = Number(match?.[1]), denominator = Number(match?.[2]); if (!match || numerator < 1 || denominator < 1 || numerator > 128 || denominator > 1024) { setError("Enter a fraction, such as 3/8 or 1/12."); return; } p.onSnap({ kind: "note", numerator, denominator }); setCustomOpen(false); }
            p.onGrid(bpm, beats); p.onCancelPreview(); setPanel(null); setError("");
          }, { capture: true })}{button("Cancel", () => { setPanel(null); setCustomOpen(false); setError(""); })}</View>
        </>}
        {panel === "view" && <>{viewControls}{text("Drag bar ruler · set loop range", true)}{text("Double-click empty space to draw · double-click a note to delete. B toggles Draw.", true)}{text("Touch: double-tap empty space to draw; double-tap notes to select a chord. Two fingers pan / zoom.", true)}</>}
        {panel === "quantise" && quantise}
        {panel === "selection" && <>{button("Velocity", () => setPanel("velocity"), { disabled: !note })}{button("Quantise settings", () => { setPanel("quantise"); if (!p.previewing) p.onPreview(); }, { disabled: !p.grid || p.snapDivision.kind === "off" || !p.notes.length })}{([["all", "Select all in layer"], ["duplicate", "Duplicate after"], ["copy", "Copy"], ["paste", "Paste at playhead"], ["delete", "Delete notes"]] as const).map(([action, label]) => <React.Fragment key={action}>{button(label, () => { p.onSelectionAction(action); setPanel(null); }, { disabled: action === "paste" ? !p.canPaste : action === "all" ? !p.notes.length : !selection.length })}</React.Fragment>)}</>}
        {panel === "velocity" && <>{text(selection.length > 1 ? `${selection.length} selected · average ${averageVelocity}` : note ? `${pitchLabel(note.pitch)} · 1 note` : "Select a note", true)}{selection.length > 1 && <SelectControl label="Velocity action" value={velocityMode} options={[{ value: "set", label: "Set all" }, { value: "scale", label: "Scale proportionally" }]} onChange={setVelocityMode} palette={c} />}{text(velocityMode === "scale" && selection.length > 1 ? "Target average" : "Velocity")}<TextInput accessibilityLabel="Note velocity" value={velocity} onChangeText={setVelocity} keyboardType="number-pad" style={[s.input, { color: c.ink, borderColor: c.line }]} />{button("Apply velocity", () => { const v = Number(velocity); if (Number.isFinite(v) && v >= 1 && v <= 127) { p.onVelocity(v, velocityMode === "scale"); setPanel(null); } else setError("Velocity must be 1–127."); }, { disabled: !note })}{error ? text(error) : null}</>}
      </ScrollView>
    </View>}
  </View>;
}
const s = StyleSheet.create({
  page: { flex: 1, minHeight: 0 }, header: { minHeight: 76, flexDirection: "row", alignItems: "center", paddingHorizontal: 12, gap: 8, borderBottomWidth: 1 },
  text: { fontFamily: "Inter Tight", fontSize: 14 }, label: { fontSize: 11, letterSpacing: 1, fontWeight: "600" },
  row: { flexDirection: "row", alignItems: "center", gap: 8 }, button: { minHeight: 48, minWidth: 48, justifyContent: "center", alignItems: "center", paddingHorizontal: 12, borderRadius: 12, borderWidth: 1 },
  workspace: { flex: 1, flexDirection: "row", paddingHorizontal: 12, gap: 20, minHeight: 0 }, main: { flex: 1, minWidth: 0, minHeight: 0 },
  settings: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, marginBottom: 4 },
  layers: { flexDirection: "row", gap: 8, alignItems: "center" }, layer: { minHeight: 48, paddingHorizontal: 12, justifyContent: "center", borderRadius: 12 },
  tools: { flexDirection: "row", gap: 6, alignItems: "stretch" }, tool: { flex: 1, minHeight: 56, borderWidth: 1, borderRadius: 14, alignItems: "center", justifyContent: "center", gap: 2 },
  bottom: { paddingVertical: 10 }, context: { flexDirection: "row", alignItems: "center", gap: 4, borderWidth: 1, borderRadius: 12, paddingLeft: 10, minHeight: 52 },
  inspector: { flex: 1, flexGrow: 0, minWidth: 0 }, inspectorCard: { borderWidth: 1, borderRadius: 16, padding: 16 },
  overlay: { position: "absolute", top: 88, borderWidth: 1, borderRadius: 16, padding: 16, zIndex: 10, shadowColor: "#000", shadowOpacity: .3, shadowRadius: 20, shadowOffset: { width: 0, height: 8 } },
  input: { borderWidth: 1, borderRadius: 10, minHeight: 48, paddingHorizontal: 12, fontSize: 16, fontFamily: "Geist Mono", marginTop: 6 },
});
