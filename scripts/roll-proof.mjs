// Browser proof for the unfinished piano roll on wip/piano-roll.
// This script was not run against commit 19b6d456bc8277086ab366974e8a1c40aa13e685.
// It expects a dev server at http://127.0.0.1:41713/ and writes screenshots outside the repo.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const port = 9700 + Math.floor(Math.random() * 200);
const chrome = spawn("google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", `--remote-debugging-port=${port}`, `--user-data-dir=/tmp/roll-proof-${port}`, "about:blank"], { stdio: "ignore" });
await new Promise((r) => setTimeout(r, 700));
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const page = list.find((item) => item.type === "page");
const ws = new WebSocket(page.webSocketDebuggerUrl);
let seq = 0;
const pending = new Map();
const logs = [];
ws.addEventListener("message", (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.method === "Runtime.exceptionThrown") logs.push(String(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text).split("\n").slice(0, 6).join(" | "));
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg.result); pending.delete(msg.id); }
});
await new Promise((resolve) => ws.addEventListener("open", resolve));
const send = (method, params = {}) => new Promise((resolve) => { const id = ++seq; pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await send("Page.enable");
await send("Runtime.enable");
const evalJson = async (expression) => {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || "eval");
  return result.result.value;
};
const setSize = (width, height) => send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 720 });
const shot = async (file) => {
  const { data } = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(file, Buffer.from(data, "base64"));
  console.log("wrote", file);
};
async function clickLabel(text) {
  const box = await evalJson(`(() => {
    const el = [...document.querySelectorAll("button, [role='button']")].find((node) => (node.innerText || node.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim() === ${JSON.stringify(text)});
    if (!el) return { missing: true, buttons: [...document.querySelectorAll("button")].map((node) => node.innerText.replace(/\\s+/g, " ").trim()).filter(Boolean).slice(0, 30) };
    el.scrollIntoView({ block: "center" });
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  })()`);
  if (!box || box.missing) throw new Error("missing " + text + " " + JSON.stringify(box));
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await sleep(200);
}
async function drag(x1, y1, x2, y2) {
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button: "left", clickCount: 1 });
  await sleep(40);
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x2, y: y2, button: "left" });
  await sleep(40);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", clickCount: 1 });
  await sleep(200);
}
const notes = () => evalJson(`JSON.stringify([...document.querySelectorAll("[data-note]")].map(n => ({ id: n.getAttribute("data-note"), start: n.getAttribute("data-start"), end: n.getAttribute("data-end"), velocity: n.getAttribute("data-velocity"), x: Math.round(n.getBoundingClientRect().x), w: Math.round(n.querySelector("div")?.getBoundingClientRect().width || n.getBoundingClientRect().width) })))`);
const report = {};

await setSize(1280, 1100);
await send("Page.navigate", { url: "http://127.0.0.1:41713/" });
await sleep(900);
await clickLabel("Enable");
await sleep(300);
const melody = [60, 64, 67, 72, 67, 64, 60];
for (const note of melody) {
  const box = await evalJson(`(() => { const el = document.querySelector('[data-key="${note}"]'); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await sleep(160);
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: box.x, y: box.y, button: "left", clickCount: 1 });
  await sleep(140);
}
await clickLabel("Capture");
await sleep(500);
await clickLabel("Edit");
await sleep(400);
const out = "/cursor/stores/bc-cda16613-24d8-5558-8bb3-7f3eeac46b26/media";
await evalJson(`document.querySelector('[data-roll="true"]')?.scrollIntoView({ block: "center" })`);
await shot(out + "/roll-desktop.png");
const before = JSON.parse(await notes());
report.populated = before.length;
report.seconds = await evalJson(`document.body.innerText.includes("Seconds")`);

const roll = await evalJson(`(() => { const el = document.querySelector('[data-roll="true"]'); const r = el.getBoundingClientRect(); return { x: r.x + 80, y: r.y + 80, right: r.right - 40, bottom: r.bottom - 30 }; })()`);
const countBefore = before.length;
await clickLabel("Draw");
await evalJson(`document.querySelector('[data-roll="true"]').addEventListener("mousedown", () => { window.__downs = (window.__downs || 0) + 1; });`);
await drag(roll.x + 30, roll.bottom - 36, roll.x + 110, roll.bottom - 36);
const drawn = JSON.parse(await notes());
report.draw = drawn.length === countBefore + 1;
report.downs = await evalJson(`window.__downs || 0`);
report.noteCount = drawn.length;

const target = drawn[drawn.length - 1];
const box = await evalJson(`(() => { const el = document.querySelector('[data-note="${target.id}"]'); const r = el.getBoundingClientRect(); return { x: r.x + 8, y: r.y + r.height / 2, right: r.right - 2, y2: r.y + r.height / 2 }; })()`);
await clickLabel("Select");
await drag(box.x, box.y, box.x + 50, box.y - 24);
const moved = JSON.parse(await notes()).find((note) => note.id === target.id);
report.move = Boolean(moved && moved.start !== target.start);
const movedBox = await evalJson(`(() => { const el = document.querySelector('[data-note="${target.id}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width - 3, y: r.y + r.height / 2 }; })()`);
if (movedBox) await drag(movedBox.x, movedBox.y, movedBox.x + 40, movedBox.y);
const resized = JSON.parse(await notes()).find((note) => note.id === target.id);
report.resize = Boolean(resized && moved && resized.end !== moved.end && resized.start === moved.start);
await clickLabel("Velocity");
const velocityBox = await evalJson(`(() => { const el = document.querySelector('[data-note="${target.id}"]'); if (!el) return null; el.scrollIntoView({ block: "center" }); const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
if (velocityBox) await drag(velocityBox.x, velocityBox.y, velocityBox.x, velocityBox.y - 40);
const louder = JSON.parse(await notes()).find((note) => note.id === target.id);
report.velocity = louder && louder.velocity !== resized.velocity;

await clickLabel("Erase");
const eraseBox = await evalJson(`(() => { const el = document.querySelector('[data-note="${target.id}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; })()`);
if (eraseBox) await drag(eraseBox.x, eraseBox.y, eraseBox.x + 8, eraseBox.y);
const erased = JSON.parse(await notes());
report.erase = !erased.some((note) => note.id === target.id);
await clickLabel("Undo");
await sleep(150);
const undone = JSON.parse(await notes());
report.undo = undone.some((note) => note.id === target.id);
await clickLabel("Redo");
await sleep(150);
report.redo = !JSON.parse(await notes()).some((note) => note.id === target.id);
await clickLabel("Undo");

const starts = JSON.parse(await notes()).map((note) => note.start).join(",");
await clickLabel("Set grid");
await sleep(200);
const afterGrid = JSON.parse(await notes()).map((note) => note.start).join(",");
report.gridKeepsNotes = starts === afterGrid;
report.gridLabel = await evalJson(`document.body.innerText.includes("Tempo 120") && !document.body.innerText.includes("Trim")`);
await clickLabel("Preview quantise");
await sleep(150);
report.previewKeepsBytes = JSON.parse(await notes()).map((note) => note.start).join(",") === afterGrid;
await clickLabel("Cancel");
await sleep(150);
report.cancelKeepsBytes = JSON.parse(await notes()).map((note) => note.start).join(",") === afterGrid;
await clickLabel("Preview quantise");
await sleep(100);
await clickLabel("Apply quantise");
await sleep(150);
report.applyChangesCopy = JSON.parse(await notes()).map((note) => note.start).join(",") !== afterGrid;
await clickLabel("Undo");
await sleep(100);
report.undoQuantise = JSON.parse(await notes()).map((note) => note.start).join(",") === afterGrid;

const widthBefore = JSON.parse(await notes())[0]?.w;
await clickLabel("Zoom in");
await sleep(200);
const widthAfter = JSON.parse(await notes())[0]?.w;
report.zoom = widthAfter > widthBefore;

await clickLabel("Light");
await sleep(200);
report.light = await evalJson(`getComputedStyle(document.body).backgroundColor !== "rgb(10, 12, 15)" || document.body.innerText.includes("Light")`);
await setSize(390, 900);
await sleep(250);
await evalJson(`document.querySelector('[data-roll="true"]')?.scrollIntoView({ block: "center" })`);
await shot(out + "/roll-phone.png");
await clickLabel("Dark");

const heads = [];
for (let i = 0; i < 8; i += 1) {
  heads.push(await evalJson(`document.querySelector("[data-playhead]")?.getAttribute("data-playhead") || ""`));
  await sleep(180);
}
report.playheadSamples = heads.filter(Boolean);
report.playheadMoves = new Set(report.playheadSamples).size > 1;
report.errors = logs;
console.log(JSON.stringify(report, null, 2));
ws.close();
chrome.kill();
