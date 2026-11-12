// Isolated local application testing. Never attaches to a user's browser profile.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

export const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function browserSession() {
  const candidates = [process.env.CHROME, process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome",
    process.platform === "win32" ? "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe" : "chromium"];
  const chrome = candidates.find(path => path && (existsSync(path) || !path.includes("/")));
  if (!chrome) throw new Error("Chrome not found; set CHROME to its executable path.");
  const profile = mkdtempSync(join(tmpdir(), "blocks-browser-"));
  // GitHub's disposable Linux runner tests only this repository's local app.
  // Keep the normal browser sandbox for every local/non-GitHub session.
  const ciNoSandbox = process.platform === "linux" && process.env.GITHUB_ACTIONS === "true";
  const child = spawn(chrome, ["--headless=new", "--mute-audio", "--disable-gpu", "--no-first-run", "--no-default-browser-check",
    ...(ciNoSandbox ? ["--no-sandbox"] : []),
    "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--autoplay-policy=no-user-gesture-required", "about:blank"], { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
  let launchError, exitStatus, stderr = "", connected = false;
  child.stderr?.setEncoding("utf8");
  child.stderr?.on("data", chunk => { stderr = (stderr + chunk).slice(-16384); });
  child.on("error", error => { launchError = error; });
  child.once("exit", (code, signal) => { exitStatus = { code, signal }; });
  const launchFailure = error => new Error([
    `Chrome test launch failed: ${error.message || error}`,
    `Executable: ${chrome}; Linux GitHub CI no-sandbox: ${ciNoSandbox}`,
    `Exit code: ${exitStatus?.code ?? "not reported"}; signal: ${exitStatus?.signal ?? "none"}; spawn error: ${launchError?.code ?? "none"}`,
    `Chrome stderr (last 16384 characters):\n${stderr.trim() || "(empty)"}`
  ].join("\n"), { cause: error });
  let socket;
  const pending = new Map();
  let seq = 0;
  const exceptions = [];
  async function close() {
    try { if (socket?.readyState === WebSocket.OPEN) await send("Browser.close"); } catch {}
    socket?.close();
    child.kill();
    for (const { reject, timer } of pending.values()) { clearTimeout(timer); reject(new Error("Browser closed")); }
    pending.clear();
    await delay(200);
    // Only remove the freshly created, isolated profile under the system temp directory.
    if (resolve(profile).startsWith(resolve(tmpdir()) + sep) && profile.includes("blocks-browser-")) {
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {}
    }
  }
  function send(method, params = {}) {
    return new Promise((resolveResult, reject) => {
      const id = ++seq;
      const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
      pending.set(id, { resolve: resolveResult, reject, timer });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }
  try {
    const portFile = join(profile, "DevToolsActivePort");
    const endpointDeadline = Date.now() + 10000;
    let page, endpointError;
    // Chrome can create the port file before writing it or accepting requests.
    // Retry only startup discovery; application assertions are never retried.
    while (Date.now() < endpointDeadline) {
      if (launchError) throw launchError;
      if (exitStatus) throw new Error("Chrome exited during test endpoint startup");
      if (existsSync(portFile)) {
        try {
          const port = Number(readFileSync(portFile, "utf8").split("\n")[0]);
          if (Number.isInteger(port) && port > 0 && port <= 65535) {
            const response = await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(Math.max(1, Math.min(1000, endpointDeadline - Date.now()))) });
            if (response.ok) page = (await response.json()).find(target => target.type === "page" && target.webSocketDebuggerUrl);
            if (page) break;
          }
        } catch (error) { endpointError = error; }
      }
      await delay(100);
    }
    if (!page) throw new Error("Chrome did not expose a usable test endpoint", { cause: endpointError });
    socket = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolveOpen, reject) => { socket.addEventListener("open", resolveOpen, { once: true }); socket.addEventListener("error", reject, { once: true }); });
    socket.addEventListener("message", event => {
      const msg = JSON.parse(event.data);
      if (msg.method === "Runtime.exceptionThrown") exceptions.push(msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text);
      if (pending.has(msg.id)) { const request = pending.get(msg.id); pending.delete(msg.id); clearTimeout(request.timer); msg.error ? request.reject(new Error(JSON.stringify(msg.error))) : request.resolve(msg.result); }
    });
    await send("Page.enable"); await send("Runtime.enable");
    connected = true;
    const evaluate = async expression => {
      const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true, userGesture: true });
      if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
      return result.result?.value;
    };
    const navigate = async url => { await send("Page.navigate", { url }); for (let i = 0; i < 100; i++) { await delay(100); if (await evaluate("document.readyState === 'complete'")) break; } };
    const screenshot = async path => { const { data } = await send("Page.captureScreenshot", { format: "png" }); writeFileSync(path, Buffer.from(data, "base64")); };
    return { send, evaluate, navigate, screenshot, exceptions, close };
  } catch (error) { const failure = connected ? error : launchFailure(error); await close(); throw failure; }
}
