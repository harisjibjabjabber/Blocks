import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import type { Palette } from "./theme";
import type { RollTool } from "./Roll";
import type { RollNote } from "./roll-notes";
import { pitchLabel, type KnownGrid } from "./roll-time";
import { SNAP_PRESETS, type SnapDivision, type SnapMode } from "./snap";
import { SelectControl } from "./SelectControl";

type ViewKind = "zoom-in" | "zoom-out" | "refocus" | "earlier" | "later" | "higher" | "lower" | "taller" | "shorter";
type ViewAction = { id: number; kind: ViewKind };
interface EditorProps {
  palette: Palette; layers: { id: string; looping: boolean }[]; selectedLayer: string;
  notes: readonly RollNote[]; selectedNote: string | null; grid: KnownGrid | null;
  tool: RollTool; looping: boolean; canUndo: boolean; canRedo: boolean;
  snapDivision: SnapDivision; snapMode: SnapMode; previewing: boolean;
  onBack: () => void; onLayer: (id: string) => void; onTool: (tool: RollTool) => void;
  onUndo: () => void; onRedo: () => void; onPlay: () => void; onCapture: () => void;
  onGrid: (bpm: number, beats: number) => void; onSnap: (division: SnapDivision) => void; onSnapMode: (mode: SnapMode) => void;
  onVelocity: (velocity: number) => void; onPreview: () => void; onApply: () => void; onCancelPreview: () => void;
  renderRoll: (height: number, action?: ViewAction) => React.ReactNode;
}

/** Frame 18: layer identity, settings, shared roll, velocity/context and three tools. */
export function Editor(p: EditorProps) {
  const { width, height } = useWindowDimensions();
  const desktop = width >= 1100;
  const split = width >= 720;
  const c = p.palette;
  const [panel, setPanel] = useState<"grid" | "view" | "velocity" | "quantise" | null>(null);
  const [tempo, setTempo] = useState(String(p.grid?.bpm ?? 120));
  const [meter, setMeter] = useState(String(p.grid?.beatsPerBar ?? 4));
  const [error, setError] = useState("");
  const [custom, setCustom] = useState(p.snapDivision.kind === "note" ? `${p.snapDivision.numerator}/${p.snapDivision.denominator}` : "1/12");
  const [customOpen, setCustomOpen] = useState(false);
  const [viewAction, setViewAction] = useState<ViewAction>();
  const [rollViewportHeight, setRollViewportHeight] = useState(0);
  const note = p.notes.find(n => n.id === p.selectedNote);
  const [velocity, setVelocity] = useState(String(note?.velocity ?? 100));
  useEffect(() => setVelocity(String(note?.velocity ?? 100)), [note?.id, note?.velocity]);
  // Leaving the preview panel must never hide the only Apply/Cancel actions on phone.
  useEffect(() => { if (panel !== "quantise") p.onCancelPreview(); if (panel !== "grid") setCustomOpen(false); }, [panel]);
  useEffect(() => { if (!split) p.onCancelPreview(); }, [split]);
  useEffect(() => { setPanel(null); setCustomOpen(false); setError(""); setTempo(String(p.grid?.bpm ?? 120)); setMeter(String(p.grid?.beatsPerBar ?? 4)); }, [p.selectedLayer]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); setPanel(null); setCustomOpen(false); setError(""); p.onCancelPreview(); return; }
      if ((e.target as HTMLElement)?.closest("input,select,textarea,[contenteditable=true]")) return;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const tools: Record<string, RollTool> = { d: "draw", s: "select", e: "erase" };
      if (tools[e.key.toLowerCase()]) { e.preventDefault(); p.onTool(tools[e.key.toLowerCase()]); }
    };
    window.addEventListener("keydown", key, true); return () => window.removeEventListener("keydown", key, true);
  }, [p.onTool]);
  const preset = SNAP_PRESETS.find(v => JSON.stringify(v.division) === JSON.stringify(p.snapDivision));
  const snapLabel = preset?.label ?? (p.snapDivision.kind === "note" ? `${p.snapDivision.numerator}/${p.snapDivision.denominator}` : "Bar");
  const count = note ? 1 : p.notes.length;
  const text = (value: string, muted = false, extra: object = {}) => <Text style={[s.text, { color: muted ? c.muted : c.ink }, extra]}>{value}</Text>;
  const button = (label: string, action: () => void, opts: { aria?: string; active?: boolean; disabled?: boolean; capture?: boolean; flex?: boolean } = {}) => <Pressable accessibilityRole="button" accessibilityLabel={opts.aria ?? label} accessibilityState={{ disabled: !!opts.disabled, ...(opts.active === undefined ? {} : { selected: opts.active }) }} disabled={opts.disabled} onPress={action} style={[s.button, { borderColor: opts.capture ? c.accent : opts.active ? c.ink : c.line, backgroundColor: opts.active ? c.ink : c.card, opacity: opts.disabled ? .4 : 1 }, opts.flex && { flex: 1 }]}><Text style={[s.text, { color: opts.active ? c.bg : opts.capture ? c.accent : c.ink, fontWeight: "600" }]}>{label}</Text></Pressable>;
  const tools = <View style={[s.tools, desktop && { flexDirection: "column", alignItems: "stretch", marginTop: 28 }]}>{([ ["draw", "✎", "Draw"], ["select", "▧", "Select"], ["erase", "⌫", "Erase"] ] as const).map(([tool, icon, label]) => <Pressable key={tool} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ selected: p.tool === tool }} onPress={() => p.onTool(tool)} style={[s.tool, { backgroundColor: p.tool === tool ? c.ink : c.card, borderColor: p.tool === tool ? c.ink : c.line }, desktop && { flexDirection: "row", flex: undefined, justifyContent: "flex-start", paddingHorizontal: 16, gap: 12 }]}><Text style={{ color: p.tool === tool ? c.bg : c.ink, fontSize: 21 }}>{icon}</Text><Text style={[s.text, { color: p.tool === tool ? c.bg : c.ink, fontWeight: "600" }]}>{label}{p.tool === tool ? " ✓" : ""}</Text></Pressable>)}<Pressable accessibilityRole="button" accessibilityLabel="Capture" onPress={p.onCapture} style={[s.tool, { flex: undefined, width: desktop ? undefined : 64, borderColor: c.accent, backgroundColor: c.card }]}><Text style={{ fontSize: 24, color: c.accent }}>↶</Text>{text("Capture", false, { fontSize: 12 })}</Pressable></View>;
  const layers = <View style={[s.layers, desktop && { flexDirection: "column", alignItems: "stretch" }]}>{p.layers.map((layer, index) => <Pressable key={layer.id} accessibilityRole="button" accessibilityLabel={`Layer ${index + 1}, Warm EP${layer.looping ? ", looping" : ""}`} accessibilityState={{ selected: layer.id === p.selectedLayer }} onPress={() => p.onLayer(layer.id)} style={[s.layer, { borderColor: layer.id === p.selectedLayer ? c.ink : c.line, borderWidth: layer.id === p.selectedLayer ? 2 : 1, backgroundColor: c.card }]}>{text(`◆  ${index + 1} Piano${layer.looping ? "  ↻" : ""}`, false, { fontWeight: "600", whiteSpace: "nowrap" })}</Pressable>)}</View>;
  const quantise = <View style={{ gap: 12 }}>
    {text("QUANTISE", true, s.label)}
    {text(`${note ? "Selected" : "Whole layer"} · ${count} ${count === 1 ? "note" : "notes"}`)}
    {text(`Grid ${snapLabel} · Strength 50%`, true)}
    {!p.grid ? button("Set grid", () => { setPanel("grid"); setError(""); }) : <View style={s.row}>{button(p.previewing ? "Cancel" : "Preview", p.previewing ? p.onCancelPreview : p.onPreview, { disabled: p.snapDivision.kind === "off" || count === 0 })}{button("Apply ↵", () => { p.onApply(); setPanel(null); }, { aria: "Apply quantise", disabled: !p.previewing, capture: true })}</View>}
  </View>;
  const viewControls = <View style={{ gap: 8 }}>{text("VIEW", true, s.label)}{([["zoom-out", "− Zoom"], ["zoom-in", "+ Zoom"], ["refocus", "Refocus"], ["earlier", "← Earlier"], ["later", "Later →"], ["higher", "↑ Pitches"], ["lower", "↓ Pitches"], ["taller", "Taller rows"], ["shorter", "Smaller rows"]] as [ViewKind,string][]).map(([kind,label]) => <React.Fragment key={kind}>{button(label, () => setViewAction(a => ({ id: (a?.id ?? 0) + 1, kind })))}</React.Fragment>)}</View>;
  const gridHeight = Math.max(80, rollViewportHeight > 0 ? rollViewportHeight - 132 : height - (desktop ? 370 : 464));
  return <View dataSet={{ editor: "storyboard-18" }} style={[s.page, { backgroundColor: c.bg }]}>
    <View style={[s.header, { borderColor: c.line }]}>
      {button("‹ Play", p.onBack, { aria: "Back to Play" })}
      <View style={{ flex: 1, alignItems: desktop ? "flex-start" : "center", minWidth: 0 }}><Text numberOfLines={1} style={{ fontFamily: "Instrument Serif", fontSize: desktop ? 30 : 26, color: c.ink }}>Edit · Piano</Text>{text(`Layer ${p.layers.findIndex(l => l.id === p.selectedLayer) + 1} · Warm EP`, true, { fontSize: 12 })}</View>
      {desktop && text("▣ Loop · on Play", true)}
      <View style={[s.row, { gap: 4 }]}>{button("↶", p.onUndo, { aria: "Undo", disabled: !p.canUndo })}{button("↷", p.onRedo, { aria: "Redo", disabled: !p.canRedo })}</View>
    </View>
    <View style={[s.workspace, desktop && { padding: 20 }, !desktop && split && { padding: 12 }]}>
      {desktop && <ScrollView style={{ width: 200, flexGrow: 0 }} contentContainerStyle={{ paddingBottom: 20 }}>{layers}{tools}</ScrollView>}
      <View style={[s.main, !desktop && split && { flex: undefined, width: Math.min(420, width * .5 - 18) }]}>
        {!desktop && <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1, flexShrink: 1 }} contentContainerStyle={{ paddingVertical: 4 }}>{layers}</ScrollView>{text("▣ Loop · on Play", true, { fontSize: 11 })}</View>}
        <View style={[s.settings, { borderColor: c.line }]}>
          {button(p.looping ? "■ Stop" : "▶ Play", p.onPlay, { aria: p.looping ? "Stop" : "Play" })}
          {button(p.grid ? `${p.grid.bpm} · ${p.grid.beatsPerBar}/4` : "Set grid", () => { setPanel(panel === "grid" ? null : "grid"); setError(""); }, { aria: p.grid ? "Grid settings" : "Set grid" })}
          <View style={{ flex: 1, minWidth: 80, position: "relative" }}><Text style={{ position: "absolute", top: -7, left: 8, paddingHorizontal: 3, backgroundColor: c.card, color: c.muted, fontFamily: "Inter Tight", fontSize: 11, zIndex: 1 }}>Snap</Text><SelectControl label="Snap division" value={customOpen || !preset ? "custom" : preset.id} options={[...SNAP_PRESETS.map(v => ({ value: v.id, label: v.label })), { value: "custom", label: preset ? "Custom…" : snapLabel }]} onChange={id => { p.onCancelPreview(); if (id === "custom") { setCustomOpen(true); setPanel("grid"); } else { setCustomOpen(false); p.onSnap(SNAP_PRESETS.find(v => v.id === id)!.division); } }} palette={c} /></View>
          {button("⋯", () => setPanel(panel === "view" ? null : "view"), { aria: "View settings" })}
        </View>
        <View onLayout={event => { const next = event.nativeEvent.layout.height; setRollViewportHeight(current => Math.abs(current - next) > 1 ? next : current); }} style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
          {p.renderRoll(gridHeight, viewAction)}
        </View>
        <View style={[s.context, { backgroundColor: c.card, borderColor: c.line }]}>
          <View style={{ flex: 1, minWidth: 0 }}>{text(note ? `${pitchLabel(note.pitch)} · 1 note` : `${p.notes.length} notes`, false, { fontWeight: "600", fontSize: 12 })}</View>
          {button("Velocity", () => setPanel(panel === "velocity" ? null : "velocity"), { disabled: !note })}
          {button("Quantise…", () => { if (panel === "quantise") { setPanel(null); p.onCancelPreview(); } else { setPanel("quantise"); if (!p.previewing) p.onPreview(); } }, { disabled: !p.grid || p.snapDivision.kind === "off" })}
        </View>
        {!desktop && <View style={s.bottom}>{tools}</View>}
      </View>
      {split && <ScrollView style={[s.inspector, { borderColor: c.line, flexBasis: desktop ? 230 : 0, flexGrow: desktop ? 0 : 1, flexShrink: desktop ? 0 : 1 }]} contentContainerStyle={{ gap: 28, paddingBottom: 24 }}><View style={[s.inspectorCard, { backgroundColor: c.card, borderColor: c.line }]}>{quantise}</View><View style={{ gap: 12 }}>{text("SELECTION", true, s.label)}{text(note ? `${pitchLabel(note.pitch)} · Velocity ${note.velocity}` : "No selection", true)}{note && button("Velocity", () => setPanel("velocity"))}</View><View style={{ gap: 8 }}>{text("KEYBOARD", true, s.label)}{text("D  S  E · Draw · Select · Erase", true)}{text("Space · Play / Stop", true)}{text("Ctrl/Cmd + Z · Undo", true)}{text("Shift + Ctrl/Cmd + Z · Redo", true)}{text("Alt + drag · no snap", true)}</View>{button("View…", () => setPanel("view"))}</ScrollView>}
    </View>
    {panel && <View dataSet={{ editorPanel: panel }} style={[s.overlay, { backgroundColor: c.card, borderColor: c.line, left: desktop ? 240 : 12, right: desktop ? 270 : split ? width / 2 : 12, maxHeight: height - 112 }]}>
      <View style={[s.row, { justifyContent: "space-between", marginBottom: 12 }]}>{text(panel === "grid" ? "Grid & snap" : panel === "velocity" ? "Velocity" : panel === "view" ? "View" : "Quantise", false, { fontSize: 18, fontWeight: "600" })}{button("×", () => { setPanel(null); setError(""); if (panel === "quantise") p.onCancelPreview(); }, { aria: "Close settings" })}</View>
      <ScrollView contentContainerStyle={{ gap: 12 }}>
        {panel === "grid" && <>
          <View style={s.row}><View style={{ flex: 1 }}>{text("BPM", true)}<TextInput accessibilityLabel="Tempo" value={tempo} onChangeText={setTempo} keyboardType="decimal-pad" style={[s.input, { color: c.ink, borderColor: c.line }]} /></View><View style={{ flex: 1 }}>{text("Beats / bar", true)}<TextInput accessibilityLabel="Meter" value={meter} onChangeText={setMeter} keyboardType="number-pad" style={[s.input, { color: c.ink, borderColor: c.line }]} /></View></View>
          {text("Bar 1 · loop start", true)}
          {customOpen && <View>{text("Custom note fraction", true)}<TextInput accessibilityLabel="Custom fraction" value={custom} onChangeText={setCustom} placeholder="1/12" placeholderTextColor={c.muted} style={[s.input, { color: c.ink, borderColor: c.line }]} /></View>}
          {text("Move snapping", true)}<SelectControl label="Snap mode" value={p.snapMode} options={[{ value: "grid", label: "Align to grid" }, { value: "offset", label: "Preserve timing offset" }]} onChange={mode => p.onSnapMode(mode as SnapMode)} palette={c} />
          {error ? text(error) : null}
          <View style={s.row}>{button("Confirm grid", () => {
            const bpm = Number(tempo), beats = Number(meter);
            if (!Number.isFinite(bpm) || bpm < 40 || bpm > 240 || !Number.isInteger(beats) || beats < 2 || beats > 12) { setError("Use 40–240 BPM and 2–12 beats per bar."); return; }
            if (customOpen) { const match = custom.trim().match(/^(\d+)\s*\/\s*(\d+)$/); const numerator = Number(match?.[1]), denominator = Number(match?.[2]); if (!match || numerator < 1 || denominator < 1 || numerator > 128 || denominator > 1024) { setError("Enter a fraction, such as 3/8 or 1/12."); return; } p.onSnap({ kind: "note", numerator, denominator }); setCustomOpen(false); }
            p.onGrid(bpm, beats); p.onCancelPreview(); setPanel(null); setError("");
          }, { capture: true })}{button("Cancel", () => { setPanel(null); setCustomOpen(false); setError(""); })}</View>
        </>}
        {panel === "view" && viewControls}
        {panel === "quantise" && quantise}
        {panel === "velocity" && <>{text(note ? `${pitchLabel(note.pitch)} · 1 note` : "Select a note", true)}<TextInput accessibilityLabel="Note velocity" value={velocity} onChangeText={setVelocity} keyboardType="number-pad" style={[s.input, { color: c.ink, borderColor: c.line }]} />{button("Apply velocity", () => { const v = Number(velocity); if (Number.isFinite(v) && v >= 1 && v <= 127) { p.onVelocity(v); setPanel(null); } else setError("Velocity must be 1–127."); }, { disabled: !note })}{error ? text(error) : null}</>}
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
