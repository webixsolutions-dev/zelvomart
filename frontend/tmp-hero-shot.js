const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const chrome = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const dir = path.join(__dirname, "tmp-hero-shot");
fs.mkdirSync(dir, { recursive: true });

const shots = [
  ["home-desktop.png", "http://localhost:3000/", "1440,820"],
  ["shop-desktop.png", "http://localhost:3000/shop", "1440,820"],
  ["about-desktop.png", "http://localhost:3000/about-us", "1440,820"],
  ["home-mobile.png", "http://localhost:3000/", "390,844"],
];

function shot([name, url, size]) {
  const out = path.join(dir, name);
  const profile = path.join(dir, "profile-" + name.replace(".png", ""));
  return new Promise((resolve) => {
    const args = [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${profile}`,
      `--window-size=${size}`,
      "--virtual-time-budget=8000",
      "--timeout=15000",
      `--screenshot=${out}`,
      url,
    ];
    const child = spawn(chrome, args, { stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      console.log("TIMEOUT", name);
      resolve();
    }, 20000);
    child.on("exit", (code) => {
      clearTimeout(timer);
      const exists = fs.existsSync(out);
      console.log("EXIT", name, code, exists ? fs.statSync(out).size : "NO");
      resolve();
    });
  });
}

(async () => {
  for (const item of shots) await shot(item);
})();
