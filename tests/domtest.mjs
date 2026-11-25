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
G.startLevel(0);          // 演示模式现在保留选关，测试里手动开始第 1 关
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
// 新控制：A/D 转动手臂，W/S 伸缩，转角度不应卡住
const angOf = () => Math.atan2(G.demo.h1.y, G.demo.h1.x);
const lenOf = () => Math.hypot(G.demo.h1.x, G.demo.h1.y);
kd({ key: "d", code: "", preventDefault() {} });
for (let i = 0; i < 60; i++) G.step(1 / 120);
ku({ key: "d", code: "" });
const a1 = angOf();
kd({ key: "d", code: "", preventDefault() {} });
for (let i = 0; i < 60; i++) G.step(1 / 120);
ku({ key: "d", code: "" });
const a2 = angOf();
if (Math.abs(a2 - a1) < 0.5) { console.log("按住 D 转不动: " + (a2 - a1).toFixed(2)); process.exit(1); }
if (lenOf() > 305) { console.log("手长度超出臂展"); process.exit(1); }
const l0 = lenOf();
kd({ key: "s", code: "", preventDefault() {} });
for (let i = 0; i < 40; i++) G.step(1 / 120);
ku({ key: "s", code: "" });
if (!(lenOf() < l0 - 40)) { console.log("按住 S 没有缩短手臂"); process.exit(1); }
console.log("转动与伸缩正常（角度连续变化，长度不超臂展）");

console.log("演示键位 X/M/IJKL 正常");

// 移动端模式：切模式后仍留在标题页，进关卡后摇杆输入生效
const mobBtn = handlers["btn-mobile:click"];
if (mobBtn) {
  mobBtn();
  if (G.mode !== "mobile") { console.log("移动端模式没有切换"); process.exit(1); }
  G.startLevel(0);
  if (G.state !== "play" || G.mode !== "mobile") { console.log("移动端进关卡失败"); process.exit(1); }
  G.Mobile.pads[0].vec = { x: 0.6, y: -0.3 };
  G.Mobile.pads[0].grip = true;
  const s1 = G.Input.sample(1 / 120);
  if (!(Math.hypot(s1.hands[0].dx, s1.hands[0].dy) > 40 && s1.hands[0].closed)) {
    console.log("移动端摇杆输入异常"); process.exit(1);
  }
  console.log("移动端模式正常（摇杆输入 + 抓握）");
}

console.log("DOM 冒烟测试通过");
