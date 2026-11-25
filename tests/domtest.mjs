// 用假的 DOM/Canvas 跑一遍真实入口（boot → 演示模式 → 300 帧渲染 + 物理）
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const gradient = { addColorStop() {} };
const ctxStub = {
  canvas: null,
  fillStyle: "", strokeStyle: "", lineWidth: 1, globalAlpha: 1,
  font: "", textAlign: "left", textBaseline: "alphabetic",
  shadowColor: "", shadowBlur: 0, lineCap: "butt", lineJoin: "miter",
  createLinearGradient: () => gradient, createRadialGradient: () => gradient,
  createPattern: () => null,
  save() {}, restore() {}, translate() {}, rotate() {}, scale() {},
  setTransform() {}, resetTransform() {}, clearRect() {}, fillRect() {},
  strokeRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
  arc() {}, arcTo() {}, rect() {}, fill() {}, stroke() {}, clip() {},
  fillText() {}, strokeText() {}, measureText: () => ({ width: 10 }),
  drawImage() {}, setLineDash() {}, ellipse() {}
};

const handlers = {};
function makeEl(id) {
  const el = {
    id, textContent: "", style: {}, dataset: {},
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    addEventListener(type, fn) { handlers[id + ":" + type] = fn; },
    removeEventListener() {},
    getContext() { return ctxStub; },
    setAttribute() {}, focus() {}, blur() {},
    width: 260, height: 195
  };
  return el;
}
const elements = {};
const documentStub = {
  readyState: "complete",
  getElementById(id) { if (!elements[id]) elements[id] = makeEl(id); return elements[id]; },
  createElement(tag) {
    if (tag === "video") {
      return { playsInline: false, muted: false, autoplay: false, srcObject: null, readyState: 4, play: async () => {} };
    }
    return makeEl(tag);
  },
  addEventListener(type, fn) { handlers["document:" + type] = fn; }
};

let rafCb = null;
const windowStub = {
  innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1,
  addEventListener(type, fn) { handlers["window:" + type] = fn; },
  localStorage: { _s: {}, getItem(k) { return this._s[k] ?? null; }, setItem(k, v) { this._s[k] = String(v); } },
  requestAnimationFrame(cb) { rafCb = cb; return 1; },
  AudioContext: undefined
};

let t = 0;
const sandbox = {
  window: windowStub,
  document: documentStub,
  performance: { now: () => t },
  requestAnimationFrame: (cb) => { rafCb = cb; return 1; },
  setTimeout: () => 0,
  clearTimeout: () => {},
  console
};
vm.createContext(sandbox);
try {
  vm.runInContext(code, sandbox, { filename: "index.html" });
} catch (e) {
  console.log("BOOT 失败:", e.stack);
  process.exit(1);
}

const G = windowStub.Game;
console.log("boot ok, version", G.version, "state", G.state);

// 点击"演示模式"
const demoBtn = handlers["btn-demo:click"];
if (!demoBtn) { console.log("找不到演示按钮"); process.exit(1); }
demoBtn();
console.log("开始演示后 state", G.state, "level", G.level && G.level.name);

// 跑 300 帧（每帧 16.7ms）
for (let i = 0; i < 300; i++) {
  t += 16.7;
  if (!rafCb) { console.log("没有 rAF 回调"); break; }
  const cb = rafCb; rafCb = null;
  try { cb(t); } catch (e) { console.log("第 " + i + " 帧抛错:", e.stack); process.exit(1); }
}
console.log("300 帧后 core", G.core.x.toFixed(0), G.core.y.toFixed(0), "state", G.state, "cam", G.cam.toFixed(0));

// 键盘：R / Esc / C / F / M / 1
for (const key of ["r", "escape", "escape", "c", "f", "m", "1"]) {
  const kd = handlers["window:keydown"];
  try { kd({ key, code: "", preventDefault() {} }); } catch (e) { console.log("按键", key, "抛错:", e.stack); process.exit(1); }
}
console.log("按键处理无异常, state", G.state);

// 鼠标事件
const mm = handlers["game:mousemove"] || handlers["canvas:mousemove"];
console.log("mousemove 绑定:", !!mm, " mousedown:", !!(handlers["game:mousedown"] || handlers["canvas:mousedown"]));

// 演示键位：X/M 切换抓握，I/J/K/L 移动手 2
const kd = handlers["window:keydown"];
const ku = handlers["window:keyup"];
const c1a = G.demo.c1;
kd({ key: "x", code: "", preventDefault() {} });
if (G.demo.c1 === c1a) { console.log("X 没有切换左手抓握"); process.exit(1); }
kd({ key: "x", code: "", preventDefault() {} });
const c2a = G.demo.c2;
kd({ key: "m", code: "", preventDefault() {} });
if (G.demo.c2 === c2a) { console.log("M 没有切换右手抓握"); process.exit(1); }
kd({ key: "m", code: "", preventDefault() {} });
const h2y = G.demo.h2.y;
kd({ key: "i", code: "", preventDefault() {} });
G.step(1 / 120);
ku({ key: "i", code: "" });
if (!(G.demo.h2.y < h2y)) { console.log("I 没有让手 2 上移"); process.exit(1); }
console.log("演示键位 X/M/IJKL 正常");

console.log("DOM 冒烟测试通过");
