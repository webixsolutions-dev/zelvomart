const pages = [
  ["http://127.0.0.1:9222/json/version", null],
];

const version = await fetch("http://127.0.0.1:9222/json/version").then((r) => r.json());
const browser = new WebSocket(version.webSocketDebuggerUrl);
let id = 0;
const pending = new Map();

function send(method, params = {}, sessionId) {
  const messageId = ++id;
  const payload = { id: messageId, method, params };
  if (sessionId) payload.sessionId = sessionId;
  browser.send(JSON.stringify(payload));
  return new Promise((resolve, reject) => {
    pending.set(messageId, { resolve, reject });
  });
}

await new Promise((resolve) => {
  browser.addEventListener("open", resolve);
});

browser.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  if (data.id && pending.has(data.id)) {
    const { resolve, reject } = pending.get(data.id);
    pending.delete(data.id);
    if (data.error) reject(new Error(JSON.stringify(data.error)));
    else resolve(data.result);
  }
});

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Runtime.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width: 1600,
  height: 1000,
  deviceScaleFactor: 1,
  mobile: false,
}, sessionId);

const urls = ["http://localhost:3000/", "http://localhost:3000/shop"];

const script = `(() => {
  const box = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { l: Math.round(r.left), r: Math.round(r.right), w: Math.round(r.width), t: Math.round(r.top) };
  };
  const text = document.querySelector(".zm-home-banner-inner");
  const chain = [];
  let node = text;
  while (node && node !== document.body) {
    const r = node.getBoundingClientRect();
    chain.push(node.className.toString().slice(0, 80) + " w=" + Math.round(r.width) + " l=" + Math.round(r.left));
    node = node.parentElement;
  }
  const links = [...document.querySelectorAll(".zm-category-nav a")];
  const last = links[links.length - 1];
  return {
    path: location.pathname,
    logo: box(document.querySelector(".zm-brand-wrap")),
    search: box(document.querySelector(".zm-header-search")),
    nav: box(document.querySelector(".zm-category-nav")),
    navFirst: box(document.querySelector(".zm-category-nav a")),
    navLast: box(last),
    linkCount: links.length,
    actions: box(document.querySelector(".zm-header-actions")),
    hero: box(text),
    heroSection: box(document.querySelector(".zm-storefront-hero, .zm-home-banner, .mock-about-hero, .mock-contact-hero")),
    chain,
    bannerCss: (() => {
      const home = document.querySelector(".mock-home");
      const s = home ? getComputedStyle(home) : null;
      return s ? { overflow: s.overflow, padding: s.padding, client: home.clientWidth, rect: Math.round(home.getBoundingClientRect().width) } : null;
    })(),
  };
})()`;

for (const url of urls) {
  await send("Page.navigate", { url }, sessionId);
  await new Promise((resolve) => setTimeout(resolve, 2500));
  const shot = await send("Page.captureScreenshot", { format: "png" }, sessionId);
  const fs = await import("node:fs");
  fs.writeFileSync("scripts/hero-check.png", Buffer.from(shot.data, "base64"));
  const result = await send("Runtime.evaluate", { expression: script, returnByValue: true }, sessionId);
  console.log(JSON.stringify(result.result.value));
}

await send("Target.closeTarget", { targetId });
browser.close();
process.exit(0);
