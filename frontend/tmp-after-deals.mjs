import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const port = 9341;
const profile = "D:\\zelvomart\\zelvomart\\frontend\\tmp-after-deals-profile";
mkdirSync(profile, { recursive: true });

const child = spawn(chrome, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-extensions",
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  "--window-size=1440,1100",
  "http://localhost:3000",
], { stdio: ["ignore", "pipe", "pipe"] });

async function waitForList() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((item) => item.type === "page" && item.webSocketDebuggerUrl);
      if (page) return page;
    } catch {}
    await delay(250);
  }
  throw new Error("Chrome debug endpoint did not start");
}

const pending = new Map();
let seq = 0;
function send(ws, method, params = {}) {
  const id = ++seq;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id);
        reject(new Error(`Timeout ${method}`));
      }
    }, 20000);
  });
}

const page = await waitForList();
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  ws.addEventListener("open", resolve);
  ws.addEventListener("error", reject);
});
ws.addEventListener("message", (event) => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    if (msg.error) reject(new Error(JSON.stringify(msg.error)));
    else resolve(msg.result);
  }
});

await send(ws, "Page.enable");
await send(ws, "Runtime.enable");

const probe = `(() => {
  const pick = (sel) => {
    const node = document.querySelector(sel);
    if (!node) return null;
    const box = node.getBoundingClientRect();
    const style = getComputedStyle(node);
    return {
      h: Math.round(box.height),
      w: Math.round(box.width),
      opacity: style.opacity,
      display: style.display,
      text: (node.innerText || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
    };
  };
  return {
    editorial: pick('.zm-editorial-reveal'),
    cards: document.querySelectorAll('.zm-editorial-reveal .mock-editorial').length,
    youtube: pick('.zm-youtube-shorts'),
    how: pick('.zm-how-it-works'),
    unbox: pick('.zm-unboxing-section'),
    wa: pick('.zm-whatsapp-banner'),
    faq: pick('.zm-faq-reveal-section'),
  };
})()`;

let last = null;
for (let i = 0; i < 24; i++) {
  const ready = await send(ws, "Runtime.evaluate", { expression: probe, returnByValue: true });
  last = ready.result?.value;
  if (last?.editorial && last?.youtube && last?.how && last?.faq) break;
  await delay(500);
}
console.log("PROBE", JSON.stringify(last, null, 2));

await send(ws, "Runtime.evaluate", {
  expression: `document.querySelector('.zm-editorial-reveal')?.scrollIntoView({ block: 'start' })`,
});
await delay(800);
const shot = await send(ws, "Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync("D:\\zelvomart\\zelvomart\\frontend\\tmp-after-deals.png", Buffer.from(shot.data, "base64"));

await send(ws, "Runtime.evaluate", {
  expression: `document.querySelector('.zm-youtube-shorts')?.scrollIntoView({ block: 'start' })`,
});
await delay(600);
const shot2 = await send(ws, "Page.captureScreenshot", { format: "png", fromSurface: true });
writeFileSync("D:\\zelvomart\\zelvomart\\frontend\\tmp-after-deals-youtube.png", Buffer.from(shot2.data, "base64"));

ws.close();
child.kill();
process.exit(0);
