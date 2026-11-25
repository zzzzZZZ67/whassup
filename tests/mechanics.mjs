// 特殊机制：绳索可抓、气流弹射、移动平台带人
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const sandbox = {
  window: { localStorage: { getItem: () => null, setItem: () => {} } },
  performance: { now: () => 0 },
  requestAnimationFrame: () => 0,
  setTimeout: () => 0,
  clearTimeout: () => {},
  console
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);
const G = sandbox.window.Game;
const DT = 1 / 120;
const steps = (n) => { for (let i = 0; i < n; i++) G.step(DT); };
const aim = (wx, wy) => { G.demo.h2 = { x: wx - G.core.x, y: wy - G.core.y }; };
const grip = (v) => { G.demo.c2 = !!v; };

function grab(wx, wy) {
  aim(wx, wy);
  steps(6);
  grip(true);
  for (let k = 0; k < 40; k++) {
    aim(wx, wy);
    G.step(DT);
    if (G.hands[1].fixed) return true;
  }
  grip(false);
  return false;
}

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (extra ? " -> " + extra : "")); }
}

// ---------- 1. 绳索 ----------
console.log("\n[1] 绳索节点可抓");
G.startLevel(1);
steps(60);
const rope = G.level.ropes[0];
const n0 = rope.nodes[0];
const ropeBase = G.level.platforms[2];
G.core.x = ropeBase.x + ropeBase.w / 2;
G.core.y = ropeBase.y - 14;
G.cam = G.core.y - 450;
G.camX = G.core.x - 800;
steps(10);
const okRope = grab(n0.x, n0.y);
check("抓住绳节点", okRope && G.hands[1].fixed);
grip(false);

// ---------- 2. 气流弹射 ----------
console.log("\n[2] 气流弹射");
G.startLevel(2);
steps(60);
const pad = G.level.boosts[0];
const P1 = G.level.platforms[2];
G.core.x = pad.x + pad.w / 2;
G.core.y = pad.y + pad.h - 20;
G.core.vx = 0; G.core.vy = 0;
G.cam = G.core.y - 450;
G.camX = G.core.x - 800;
steps(4);
check("站进气流会被弹起", G.core.vy < -500, "vy=" + G.core.vy.toFixed(0));
// 反复进入气流都应能被弹起（不能只弹一次）
let relaunch = false;
for (let k = 0; k < 300; k++) {
  G.step(DT);
  if (k > 20 && G.core.vy < -500) { relaunch = true; break; }
}
check("气流可反复触发（不是一次性的）", relaunch);

// ---------- 3. 移动平台带人 ----------
console.log("\n[3] 移动平台带人");
G.startLevel(3);
steps(60);
const mover = G.level.movers[0];
G.core.x = mover.x + mover.w / 2;
G.core.y = mover.y - 15;
G.core.vx = 0; G.core.vy = 0;
G.cam = G.core.y - 450;
G.camX = G.core.x - 800;
steps(20);
const x0 = G.core.x;
const m0 = mover.x;
steps(90);
check("站上移动平台后会被带着走", Math.abs(G.core.x - x0) > 30 && Math.abs(mover.x - m0) > 30,
  "coreΔ=" + (G.core.x - x0).toFixed(0) + " moverΔ=" + (mover.x - m0).toFixed(0));

// ---------- 4. 抓在移动平台上的手跟着平台走 ----------
console.log("\n[4] 抓握点随移动平台移动");
G.startLevel(3);
steps(60);
const mv = G.level.movers[0];
G.core.x = mv.x + mv.w / 2;
G.core.y = mv.y - 15;
G.cam = G.core.y - 450;
G.camX = G.core.x - 800;
steps(20);
const anchored = grab(mv.x + mv.w / 2, mv.y + 6);
const ax0 = G.hands[1].anchorX;
steps(60);
check("抓移动平台后抓点跟着平台动", anchored && Math.abs(G.hands[1].anchorX - ax0) > 30,
  "anchorΔ=" + (G.hands[1].anchorX - ax0).toFixed(0));
grip(false);

// ---------- 5. 出发点在平台上、地面不可抓 ----------
console.log("\n[5] 出发平台 / 地面不可抓");
G.startLevel(0);
steps(90);
const under = G.level.platforms.find((pp) => !pp.ground && G.core.x > pp.x && G.core.x < pp.x + pp.w && Math.abs((G.core.y + 14) - pp.y) < 6);
check("出发点在一块平台上（不是地面）", !!under && under.startPlat === true, under ? "" : "no platform under core");
// 站在地面上，朝地面握拳
G.core.x = 3000;
G.core.y = 3546;
G.cam = G.core.y - 450;
G.camX = G.core.x - 800;
steps(10);
aim(3000, 3560);
steps(6);
grip(true);
steps(20);
check("地面不可抓", G.hands[1].fixed === false);
grip(false);

// ---------- 6. 手与核心的最小距离 ----------
console.log("\n[6] 手与核心最小距离");
G.startLevel(0);
steps(60);
G.input.mouse.x = 800;
G.input.mouse.y = 450;
steps(4);
const dmin = Math.min(
  Math.hypot(G.hands[0].x - G.core.x, G.hands[0].y - G.core.y),
  Math.hypot(G.hands[1].x - G.core.x, G.hands[1].y - G.core.y)
);
check("手不会贴到核心上（≥35px）", dmin >= 35, "d=" + dmin.toFixed(0));

// ---------- 7. 摄像头未绑定到手时，该手默认抓紧 ----------
console.log("\n[7] 丢手默认抓紧（输入层）");
G.startLevel(0);
steps(30);
G.mode = "camera";
G.camera.ready = true;
G.camera.hands[0] = null;
G.camera.hands[1] = { x: 0.6, y: 0.55, closed: false };
const smp = G.Input.sample(DT);
check("未绑定的手返回 closed=true", smp.hands[0].closed === true, JSON.stringify(smp.hands[0]));
check("未绑定的手标记 lost", smp.hands[0].lost === true);
check("有绑定的手仍按开合状态", smp.hands[1].closed === false);
G.camera.ready = false;
G.mode = null;

console.log(fails === 0 ? "\nMECHANICS PASS" : "\nMECHANICS FAIL");
process.exit(fails === 0 ? 0 : 1);
