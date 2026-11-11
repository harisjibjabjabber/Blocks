import React, { useCallback, useEffect, useRef, useState } from "react";
import type { Palette } from "./theme";

export interface TouchKeyboardProps {
  palette: Palette;
  onNote: (note: number, down: boolean, velocity?: number) => void;
  onReleaseAll?: () => void;
}
type Scale = "chromatic" | "major" | "minor-pentatonic";
const NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
const BLACK = [{ semitone: 1, after: 1 }, { semitone: 3, after: 2 }, { semitone: 6, after: 4 }, { semitone: 8, after: 5 }, { semitone: 10, after: 6 }];
const label = (note: number) => `${NAMES[note % 12]}${Math.floor(note / 12) - 1}`;

/** A performance keyboard. Each physical pointer owns a note; shared pitches
 * are released only when their final pointer/key is released. */
export function TouchKeyboard({ palette: c, onNote, onReleaseAll }: TouchKeyboardProps) {
  const host = useRef<HTMLDivElement>(null);
  const owners = useRef(new Map<string, number>());
  const pointers = useRef(new Set<number>());
  const accessTimers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const callbacks = useRef({ onNote, onReleaseAll });
  callbacks.current = { onNote, onReleaseAll };
  const [held, setHeld] = useState<Set<number>>(new Set());
  const [octave, setOctave] = useState(4);
  const [scale, setScale] = useState<Scale>("chromatic");
  const [root, setRoot] = useState(0);
  const [wide, setWide] = useState(false);
  const base = (octave + 1) * 12;
  const octaves = wide ? 2 : 1;
  const publish = useCallback(() => setHeld(new Set(owners.current.values())), []);
  const releaseAll = useCallback(() => {
    const pitches = new Set(owners.current.values());
    owners.current.clear();
    pointers.current.clear();
    for (const timer of accessTimers.current.values()) clearTimeout(timer);
    accessTimers.current.clear();
    for (const note of pitches) callbacks.current.onNote(note, false);
    if (pitches.size) callbacks.current.onReleaseAll?.();
    publish();
  }, [publish]);
  const route = useCallback((owner: string, next: number | null, velocity = 96) => {
    const previous = owners.current.get(owner);
    if (previous === next || (previous === undefined && next === null)) return;
    if (previous !== undefined) {
      owners.current.delete(owner);
      if (![...owners.current.values()].includes(previous)) callbacks.current.onNote(previous, false);
    }
    if (next !== null) {
      const alreadyHeld = [...owners.current.values()].includes(next);
      owners.current.set(owner, next);
      if (!alreadyHeld) callbacks.current.onNote(next, true, velocity);
    }
    publish();
  }, [publish]);
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const resize = new ResizeObserver(entries => setWide(entries[0].contentRect.width >= 680));
    resize.observe(element);
    const hit = (event: PointerEvent) => {
      const key = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-key]");
      if (!key || !element.contains(key)) return null;
      const bounds = key.getBoundingClientRect();
      return { note: Number(key.dataset.key), velocity: Math.round(48 + Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height)) * 79) };
    };
    const down = (event: PointerEvent) => {
      if (event.pointerType !== "touch" && event.button !== 0) return;
      const key = hit(event); if (!key) return;
      event.preventDefault();
      pointers.current.add(event.pointerId);
      try { element.setPointerCapture(event.pointerId); } catch { /* Window release listeners remain active. */ }
      route(`pointer-${event.pointerId}`, key.note, key.velocity);
    };
    const move = (event: PointerEvent) => {
      if (!pointers.current.has(event.pointerId)) return;
      event.preventDefault();
      const key = hit(event); route(`pointer-${event.pointerId}`, key?.note ?? null, key?.velocity);
    };
    const up = (event: PointerEvent) => { pointers.current.delete(event.pointerId); route(`pointer-${event.pointerId}`, null); };
    const hidden = () => { if (document.hidden) releaseAll(); };
    element.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    element.addEventListener("lostpointercapture", up);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      resize.disconnect();
      element.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      element.removeEventListener("lostpointercapture", up);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", hidden);
      releaseAll();
    };
  }, [releaseAll, route]);
  useEffect(() => { releaseAll(); }, [octave, scale, root, wide, releaseAll]);
  useEffect(() => { if (wide) setOctave(o => Math.min(6, o)); }, [wide]);
  const control: React.CSSProperties = { minHeight: 48, minWidth: 48, borderRadius: 10, border: `1px solid ${c.line}`, background: c.card, color: c.ink, colorScheme: c.bg === "#0A0C0F" ? "dark" : "light", fontFamily: "Inter Tight, sans-serif", fontSize: 13, padding: "0 10px" };
  const whiteNotes = Array.from({ length: octaves }, (_, oct) => WHITE.map(n => base + oct * 12 + n)).flat();
  const scaleSteps = scale === "minor-pentatonic" ? [0, 3, 5, 7, 10] : WHITE;
  const scaleNotes = Array.from({ length: octaves }, (_, oct) => scaleSteps.map(n => base + root + oct * 12 + n)).flat();
  const key = (note: number, black: boolean, style: React.CSSProperties = {}) => <button key={note} type="button" data-key={note} aria-label={`Play ${label(note)}`} aria-pressed={held.has(note)}
    onClick={event => { if (event.detail !== 0) return; event.stopPropagation(); clearTimeout(accessTimers.current.get(note)); route(`access-${note}`, note); accessTimers.current.set(note, setTimeout(() => { route(`access-${note}`, null); accessTimers.current.delete(note); }, 160)); }}
    onKeyDown={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); if (!event.repeat) route(`key-${note}`, note); } }}
    onKeyUp={event => { if (event.key === " " || event.key === "Enter") { event.preventDefault(); event.stopPropagation(); route(`key-${note}`, null); } }}
    onBlur={() => route(`key-${note}`, null)}
    style={{ position: "relative", flex: 1, minWidth: 0, height: 112, border: "1px solid #8C8C8C", borderRadius: "0 0 5px 5px", background: held.has(note) ? (black ? "#4A4D53" : "#CEC6B7") : black ? "#252931" : "#E7E1D6", color: black ? "#EEF0F3" : "#17150F", boxShadow: held.has(note) ? `inset 0 -5px 0 ${c.accent}` : black ? "0 3px 3px #0005" : "inset 0 -4px 0 #0001", padding: "0 0 12px", display: "flex", alignItems: "flex-end", justifyContent: "center", fontFamily: "Geist Mono, monospace", fontSize: 11, touchAction: "none", userSelect: "none", cursor: "pointer", ...style }}>
    {black ? NAMES[note % 12] : note % 12 === 0 || scale !== "chromatic" ? label(note) : NAMES[note % 12]}
  </button>;
  return <div data-touch-keyboard="true" style={{ width: "100%", minWidth: 0 }}>
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
      <button type="button" aria-label="Keyboard octave down" disabled={octave <= 1} onClick={() => setOctave(o => Math.max(1, o - 1))} style={{ ...control, opacity: octave <= 1 ? .4 : 1 }}>−</button>
      {scale === "chromatic" && <span aria-live="polite" style={{ color: c.muted, fontFamily: "Geist Mono, monospace", fontSize: 12 }}>{label(base)}</span>}
      <button type="button" aria-label="Keyboard octave up" disabled={octave >= (wide ? 6 : 7)} onClick={() => setOctave(o => Math.min(wide ? 6 : 7, o + 1))} style={{ ...control, opacity: octave >= (wide ? 6 : 7) ? .4 : 1 }}>+</button>
      <select aria-label="Keyboard scale" value={scale} onChange={event => setScale(event.target.value as Scale)} style={{ ...control, boxSizing: "border-box", marginLeft: "auto", width: 114, minWidth: 100, padding: "0 6px", maxWidth: "100%" }}>
        <option value="chromatic">Chromatic</option><option value="major">Major</option><option value="minor-pentatonic">Minor pent.</option>
      </select>
      {scale !== "chromatic" && <select aria-label="Scale root" value={root} onChange={event => setRoot(Number(event.target.value))} style={{ ...control, boxSizing: "border-box", width: 60, minWidth: 60, padding: "0 6px" }}>{NAMES.map((name, value) => <option key={name} value={value}>{name}{octave}</option>)}</select>}
    </div>
    <div ref={host} role="group" aria-label={scale === "chromatic" ? "Piano keyboard" : `${NAMES[root]} ${scale === "major" ? "major" : "minor pentatonic"} keyboard`} style={{ position: "relative", display: "flex", height: 112, isolation: "isolate", touchAction: "none", borderRadius: "0 0 6px 6px", overflow: "hidden" }}>
      {scale === "chromatic" ? <>{whiteNotes.map(note => key(note, false))}{Array.from({ length: octaves }, (_, oct) => BLACK.map(({ semitone, after }) => key(base + oct * 12 + semitone, true, { position: "absolute", zIndex: 1, top: 0, left: `${(oct * 7 + after) / whiteNotes.length * 100}%`, transform: "translateX(-50%)", width: `${.62 / whiteNotes.length * 100}%`, height: 72, borderColor: "#0A0C0F", paddingBottom: 10 })))}</> : scaleNotes.map(note => key(note, false))}
    </div>
  </div>;
}
