import * as esbuild from "esbuild";
import { browserSession, delay } from "./browser-session.mjs";

const bundled = await esbuild.build({
  entryPoints: ["src/audio/web/instrument.ts"],
  bundle: true,
  format: "iife",
  globalName: "WarmEp",
  write: false,
  platform: "browser",
});
const js = bundled.outputFiles[0].text;
const html = `<!doctype html><meta charset="utf-8"><pre id="out">waiting</pre><script>window.onerror=function(m){document.getElementById("out").textContent="ERR "+m;}</script><script>${js}</script><script>
const Piano = WarmEp.WebElectricPiano;
function play(piano, time, kind, note, velocity, controller, value) {
  piano.play(time, { kind, channel: 0, note, velocity, controller, value, source: "touch" });
}
function rms(data, rate, start, end) {
  let sum = 0, count = 0;
  const a = Math.max(0, Math.floor(start * rate));
  const b = Math.min(data.length, Math.floor(end * rate));
  for (let i = a; i < b; i++) { sum += data[i] * data[i]; count++; }
  return Math.sqrt(sum / Math.max(1, count));
}
async function render(seconds, schedule) {
  const rate = 48000;
  const context = new OfflineAudioContext(1, Math.floor(rate * seconds), rate);
  const piano = new Piano(context);
  schedule(piano);
  const data = (await context.startRendering()).getChannelData(0);
  return { data, rate };
}
(async () => {
const released = await render(5, (piano) => {
  for (const note of [60, 64, 67]) play(piano, 0.1, "note-on", note, 100, 0, 0);
  for (const note of [60, 64, 67]) play(piano, 0.45, "note-off", note, 0, 0, 0);
  for (const note of [62, 65, 69]) play(piano, 1.6, "note-on", note, 100, 0, 0);
  for (const note of [62, 65, 69]) play(piano, 1.9, "note-off", note, 0, 0, 0);
});
const pedal = await render(4, (piano) => {
  play(piano, 0.05, "cc", 0, 0, 64, 127);
  play(piano, 0.1, "note-on", 60, 100, 0, 0);
  play(piano, 0.3, "note-off", 60, 0, 0, 0);
  play(piano, 1.2, "cc", 0, 0, 64, 0);
});
const stopped = await render(2, (piano) => {
  play(piano, 0.2, "note-on", 64, 110, 0, 0);
  piano.silenceAll();
});
const out = {
  releaseAttack: rms(released.data, released.rate, 0.12, 0.22),
  afterRelease: rms(released.data, released.rate, 1.05, 1.35),
  secondAttack: rms(released.data, released.rate, 1.62, 1.75),
  afterSecond: rms(released.data, released.rate, 2.55, 2.9),
  pedalStillOn: rms(pedal.data, pedal.rate, 0.5, 0.8),
  afterPedalUp: rms(pedal.data, pedal.rate, 2.5, 3.2),
  afterStop: rms(stopped.data, stopped.rate, 0.3, 1.6),
};
document.getElementById("out").textContent = JSON.stringify(out);
})().catch((error) => { document.getElementById("out").textContent = "ERR " + error; });
</script>`;
const browser = await browserSession();
let text = "waiting";
try {
  await browser.navigate("data:text/html;charset=utf-8," + encodeURIComponent(html));
  for (let i = 0; i < 80 && (text === "waiting" || text === ""); i += 1) {
    await delay(100);
    text = await browser.evaluate("document.getElementById('out').textContent");
  }
} finally { await browser.close(); }
const measured = JSON.parse(text);
console.log(JSON.stringify(measured, null, 2));
const faults = [];
if (!(measured.releaseAttack > 0.005)) faults.push("attack was silent");
if (!(measured.afterRelease < 0.0005)) faults.push("note-off release did not reach silence");
if (!(measured.secondAttack > 0.005)) faults.push("repeated chord did not sound");
if (!(measured.afterSecond < 0.0005)) faults.push("second release did not reach silence");
if (!(measured.pedalStillOn > 0.002)) faults.push("sustain pedal did not hold the note");
if (!(measured.afterPedalUp < 0.0005)) faults.push("pedal-up release did not reach silence");
if (!(measured.afterStop < 0.0005)) faults.push("stop cleanup left sound");
if (faults.length) {
  console.error(faults.join("; "));
  process.exit(1);
}
