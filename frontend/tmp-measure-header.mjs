import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

console.log("booting");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dir = `D:\\zelvomart\\zelvomart\\frontend\\tmp-chrome-measure-${Date.now()}`;
const port = 9555;
const child = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--hide-scrollbars",
  "--no-first-run",
  "--disable-extensions",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${dir}`,
  "--window-size=1440,900",
  "about:blank",
], { stdio: ["ignore", "pipe", "pipe"] });
child.stdout.on("data", (chunk) => console.log("OUT", chunk.toString()));
child.stderr.on("data", (chunk) => console.log("ERR", chunk.toString()));
child.on("exit", (code) => console.log("CHROME_EXIT", code));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  for (let i = 0; i < 40; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
      const page = list.find((item) => item.type === "page");
      if (page?.webSocketDebuggerUrl) return page;
    } catch {}
    await sleep(250);
  }
  throw new Error("devtools-unavailable");
}

function rpc(ws) {
  let id = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.id && pending.has(data.id)) {
      pending.get(data.id)(data);
      pending.delete(data.id);
    }
  });
  return (method, params = {}) => new Promise((resolve, reject) => {
    const msgId = ++id;
    const timer = setTimeout(() => {
      pending.delete(msgId);
      reject(new Error(`timeout ${method}`));
    }, 20000);
    pending.set(msgId, (data) => {
      clearTimeout(timer);
      resolve(data);
    });
    ws.send(JSON.stringify({ id: msgId, method, params }));
  });
}

try {
  const page = await pageTarget();
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  const send = rpc(ws);
  await send("Page.enable");
  await send("Runtime.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await send("Page.navigate", { url: "http://localhost:3000/" });
  await sleep(4000);
  const measured = await send("Runtime.evaluate", {
    expression: `(() => {
      const box = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), h: Math.round(r.height) };
      };
      const brand = document.querySelector(".zm-brand-wrap");
      const actions = document.querySelector(".zm-header-actions");
      const nav = document.querySelector(".zm-category-nav");
      const main = document.querySelector(".zm-header-main");
      const b = box(brand);
      const a = box(actions);
      const n = box(nav);
      return {
        brand: b,
        actions: a,
        nav: n,
        main: box(main),
        controls: b && a ? { l: b.l, r: a.r, w: a.r - b.l } : null,
        deltaLeft: n && b ? n.l - b.l : null,
        deltaRight: n && a ? n.r - a.r : null,
        labels: nav ? [...nav.querySelectorAll("span")].map((span) => ({
          text: span.textContent,
          clipped: span.scrollWidth > span.clientWidth + 1,
        })) : [],
      };
    })()`,
    returnByValue: true,
  });
  console.log(JSON.stringify(measured.result?.result?.value || measured, null, 2));
  const shot = await send("Page.captureScreenshot", { format: "png" });
  if (shot.result?.data) {
    writeFileSync("D:\\zelvomart\\zelvomart\\frontend\\tmp-header-align.png", Buffer.from(shot.result.data, "base64"));
    console.log("SHOT");
  }
  ws.close();
} catch (error) {
  console.error("FAIL", error.message);
} finally {
  child.kill();
  process.exit(0);
}
