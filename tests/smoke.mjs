// What's Up? 逻辑冒烟测试（新演示输入：WASD/方向键直接控制手的偏移）
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const sandbox = {
  window: {
    localStorage: {
      _s: {},
      getItem(k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; },
      setItem(k, v) { this._s[k] = String(v); }
    }
  },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  clearTimeout: () => {},
  console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox, { filename: "index.html<script>" });

const G = sandbox.window.Game;
const DT = 1 / 120;
let failures = 0;
function check(name, cond, extra) {
  if (cond) console.log("  PASS  " + name);
  else { failures++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}
function steps(n) { for (let i = 0; i < n; i++) G.step(DT); }
const setOff = (i, ox, oy) => { if (i === 0) G.demo.h1 = { x: ox, y: oy }; else G.demo.h2 = { x: ox, y: oy }; };
const setGrip = (i, v) => { if (i === 0) G.demo.c1 = !!v; else G.demo.c2 = !!v; };
const setHand = (i, wx, wy) => setOff(i, wx - G.core.x, wy - G.core.y);
function grab(wx, wy, i = 1) {
  setHand(i, wx, wy);
  steps(6);
  setGrip(i, true);
  for (let k = 0; k < 40; k++) {
    setHand(i, wx, wy);
    G.step(DT);
    if (G.hands[i].fixed) return true;
  }
  setGrip(i, false);
  return false;
}
function pull(n) {
  setOff(1, 0, 160);          // 手在黄点下方 → 身体被往上拉
  steps(n);
}

// ---------- 1. 启动 ----------
console.log("\n[1] 启动 / 落地");
G.mode = "demo";
G.startLevel(0);
check("startLevel 进入 play", G.state === "play");
steps(120);
check("静置后核心停在出发点平台", Math.abs(G.core.y - G.level.start.y) < 3, "y=" + G.core.y.toFixed(1));
check("起点检查点自动激活", G.cpIndex === 0 && G.level.checkpoints[0].activated);
check("核心在画面中心", Math.abs((G.core.y - G.cam) - 450) < 1);

// ---------- 2. 抓取 ----------
console.log("\n[2] 抓取");
const L1 = G.level.platforms[2];
const okGrab = grab(L1.x + L1.w - 6, L1.y + 4, 1);
check("手抓住 L1 边缘", okGrab);
check("抓的是 L1 平台", G.hands[1].attached && G.hands[1].attached.ref === L1);

// ---------- 3. 拉起 ----------
console.log("\n[3] 收手拉起");
const y0 = G.core.y;
pull(120);
check("核心上升 ≥80px", G.core.y < y0 - 80, "Δy=" + (G.core.y - y0).toFixed(1));
check("臂长不超过臂展", Math.hypot(G.core.x - G.hands[1].anchorX, G.core.y - G.hands[1].anchorY) <= 301);

// ---------- 4. 松手 ----------
console.log("\n[4] 松手");
setGrip(1, false);
steps(3);
check("手松开", G.hands[1].fixed === false);

// ---------- 5. 绕过边缘上台 ----------
console.log("\n[5] 绕过边缘上台（无瞬移）");
G.startLevel(0);
steps(60);
const ok5 = grab(L1.x + L1.w - 6, L1.y + 6, 1);
const a5 = G.hands[1].anchorX, b5 = G.hands[1].anchorY;
const outX = L1.x + L1.w + 70;
const topY = L1.y - 90;
for (let k = 0; k < 80; k++) { setOff(1, a5 - outX, b5 - topY); G.step(DT); }
for (let k = 0; k < 80; k++) { setOff(1, a5 - (L1.x + L1.w / 2), b5 - topY); G.step(DT); }
setGrip(1, false);
steps(90);
check("最终站上 L1 顶面", ok5 && G.core.y < L1.y - 10, "y=" + G.core.y.toFixed(0));

// ---------- 6. 精确映射 / 松手下落 ----------
console.log("\n[6] 精确映射");
G.startLevel(0);
G.core.x = 1700; G.core.y = 2850;
G.cam = G.core.y - 450; G.camX = G.core.x - 800;
const rock = G.level.rocks.find((r) => r.x === 1800 && r.y === 2800);
const ok6 = grab(rock.x, rock.y, 1);
setOff(1, 80, -60);
steps(4);
const h6 = G.hands[1];
const ex = h6.anchorX - 80, ey = h6.anchorY + 60;
check("核心 = 抓点 − 手相对黄点的偏移", ok6 && Math.hypot(G.core.x - ex, G.core.y - ey) < 3);
const yRel = G.core.y;
setGrip(1, false);
steps(60);
check("松手后核心会下落", G.core.y > yRel + 5, "Δy=" + (G.core.y - yRel).toFixed(1));

// ---------- 7. 检查点 ----------
console.log("\n[7] 检查点");
G.startLevel(0);
const cp1pos = G.level.checkpoints[1].trigger;
G.core.x = cp1pos.x; G.core.y = cp1pos.y + 30; G.core.vx = 0; G.core.vy = 0;
steps(6);
check("中段检查点激活", G.level.checkpoints[1].activated === true);
check("cpIndex 指向中段", G.cpIndex === 1);

// ---------- 8. R 复位 ----------
console.log("\n[8] R 复位");
G.respawn();
const cp1 = G.level.checkpoints[1];
check("复位到检查点平台上方", Math.abs(G.core.x - cp1.spawn.x) < 0.01 && Math.abs(G.core.y - cp1.spawn.y) < 0.01);
check("双手松开", G.hands.every((h) => !h.fixed));
check("复位计数 +1", G.respawns === 1);

// ---------- 9. 乱输入 ----------
console.log("\n[9] 边界与稳定性");
G.startLevel(0);
let bad = null;
for (let i = 0; i < 1200; i++) {
  setOff(0, -200 + ((i * 37) % 400), -200 + ((i * 53) % 400));
  setOff(1, -200 + ((i * 71) % 400), -200 + ((i * 29) % 400));
  G.demo.c1 = i % 20 < 6;
  G.demo.c2 = i % 7 < 3;
  G.step(DT);
  if (!Number.isFinite(G.core.x) || !Number.isFinite(G.core.y)) { bad = "NaN"; break; }
  if (G.core.x < -1 || G.core.x > 3201 || G.core.y < -1 || G.core.y > 4401) { bad = "越界"; break; }
  if (G.state === "result") G.startLevel(0);
}
check("10 秒乱输入无 NaN / 无越界", bad === null, bad);

// ---------- 10. 登顶 ----------
console.log("\n[10] 登顶");
G.startLevel(0);
const summit = G.level.summit;
G.core.x = summit.x; G.core.y = summit.y;
G.core.vx = 0; G.core.vy = 0;
steps(2);
check("触碰登顶石 → 结算", G.state === "result");

// ---------- 11. 检查点都在平台上 ----------
console.log("\n[11] 检查点位置");
let onPlat = true;
for (const cp of G.level.checkpoints) {
  if (!G.level.platforms.some((q) => cp.x >= q.x && cp.x <= q.x + q.w && Math.abs(cp.y - q.y) < 0.01)) onPlat = false;
}
check("所有检查点都绑定在平台顶面", onPlat);

// ---------- 12. 贴检查点不瞬移 ----------
console.log("\n[12] 检查点附近不瞬移");
G.startLevel(0);
const L4 = G.level.platforms[5];
G.core.x = L4.x - 30; G.core.y = L4.y + 70;
G.cam = G.core.y - 450; G.camX = G.core.x - 800;
steps(6);
const okGrab12 = grab(L4.x, L4.y + 12, 1);
const yHold = G.core.y;
steps(120);
check("贴平台静止时核心不会被吸上台面", okGrab12 && Math.abs(G.core.y - yHold) < 6, "Δy=" + (G.core.y - yHold).toFixed(1));
setGrip(1, false);

// ---------- 13. 大位移不穿模 ----------
console.log("\n[13] 大位移不穿模");
G.startLevel(0);
G.core.x = 820; G.core.y = 3366;
G.cam = G.core.y - 450; G.camX = G.core.x - 800;
steps(20);
const L2 = G.level.platforms[3];
const okGrab13 = grab(L2.x + 4, L2.y + 10, 1);
setOff(1, 0, -295);
steps(40);
check("大位移被平台挡住", okGrab13 && G.core.y > L2.y, "core=" + G.core.x.toFixed(0) + "," + G.core.y.toFixed(0));
setGrip(1, false);

// ---------- 14. 松手惯性 ----------
console.log("\n[14] 松手惯性");
G.startLevel(0);
steps(60);
const okGrab14 = grab(L1.x + L1.w - 6, L1.y + 6, 1);
setOff(1, 0, 300);
G.step(DT);            // 一步拉到目标，速度最大
const vBefore = Math.hypot(G.core.vx, G.core.vy);
setGrip(1, false);
G.step(DT);
const vRelease = Math.hypot(G.core.vx, G.core.vy);
const yRelease = G.core.y;
steps(30);
check("松手时保留速度", okGrab14 && vRelease > vBefore * 0.9, "v=" + vRelease.toFixed(0) + " before=" + vBefore.toFixed(0));
check("松手后会向上飞出一段", yRelease - G.core.y > 60);

console.log("\n" + (failures === 0 ? "ALL PASS" : failures + " FAILURE(S)"));
process.exit(failures === 0 ? 0 : 1);
