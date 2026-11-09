import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import type { Palette } from "./theme";

export interface TouchKeyboardProps { palette: Palette; onNote: (note: number, down: boolean, velocity?: number) => void; onReleaseAll?: () => void }
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [{ note: 1, after: 1 }, { note: 3, after: 2 }, { note: 6, after: 4 }, { note: 8, after: 5 }, { note: 10, after: 6 }];
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

/** Native fallback. Browser scale/glissando acceptance does not certify native touch. */
export function TouchKeyboard({ palette: c, onNote, onReleaseAll }: TouchKeyboardProps) {
  const [octave, setOctave] = useState(4);
  const [width, setWidth] = useState(336);
  const [held, setHeld] = useState<Set<number>>(new Set());
  const active = useRef(new Set<number>());
  const callbacks = useRef({ onNote, onReleaseAll }); callbacks.current = { onNote, onReleaseAll };
  const release = () => { const notes = [...active.current]; active.current.clear(); notes.forEach(note => callbacks.current.onNote(note, false)); if (notes.length) callbacks.current.onReleaseAll?.(); setHeld(new Set()); };
  useEffect(() => { const subscription = AppState.addEventListener("change", state => { if (state !== "active") release(); }); return () => { subscription.remove(); release(); }; }, []);
  useEffect(release, [octave]);
  const press = (note: number, down: boolean) => { if (down === active.current.has(note)) return; if (down) active.current.add(note); else active.current.delete(note); callbacks.current.onNote(note, down, 96); setHeld(new Set(active.current)); };
  const base = (octave + 1) * 12;
  const key = (note: number, black: boolean, left?: number) => <Pressable key={note} accessibilityRole="button" accessibilityLabel={`Play ${NAMES[note % 12]}${octave}`} onPressIn={() => press(note, true)} onPressOut={() => press(note, false)} style={{ position: black ? "absolute" : "relative", flex: black ? undefined : 1, left, top: 0, width: black ? width / 7 * .62 : undefined, height: black ? 72 : 112, zIndex: black ? 1 : 0, borderWidth: 1, borderColor: black ? "#0A0C0F" : "#8C8C8C", borderBottomLeftRadius: 4, borderBottomRightRadius: 4, backgroundColor: held.has(note) ? c.accent : black ? "#252931" : "#E7E1D6", justifyContent: "flex-end", alignItems: "center", paddingBottom: 10 }}><Text style={{ color: black ? "#EEF0F3" : "#17150F", fontSize: 11 }}>{NAMES[note % 12]}{note % 12 === 0 ? octave : ""}</Text></Pressable>;
  return <View><View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 }}>{([-1, 1] as const).map(direction => <Pressable key={direction} accessibilityRole="button" accessibilityLabel={`Keyboard octave ${direction < 0 ? "down" : "up"}`} onPress={() => setOctave(o => Math.max(1, Math.min(7, o + direction)))} style={{ minWidth: 48, minHeight: 48, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: c.line, borderRadius: 10 }}><Text style={{ color: c.ink }}>{direction < 0 ? "−" : "+"}</Text></Pressable>)}<Text style={{ color: c.muted }}>C{octave} · Chromatic</Text></View><View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: 112, flexDirection: "row" }}>{WHITE.map(n => key(base + n, false))}{BLACK.map(({ note, after }) => key(base + note, true, width / 7 * (after - .31)))}</View></View>;
}
