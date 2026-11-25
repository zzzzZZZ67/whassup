// 第 1 关可通过性：抓边 → 收手拉起 → 绕到外侧 → 横移 → 松手
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
const setOff = (ox, oy) => { G.demo.h2 = { x: ox, y: oy }; };
const grip = (v) => { G.demo.c2 = !!v; };

function grab(wx, wy) {
  aim(wx, wy);
  steps(8);
  grip(true);
  for (let k = 0; k < 40; k++) {
    aim(wx, wy);
    G.step(DT);
    if (G.hands[1].fixed) return true;
  }
  grip(false);
  return false;
}
function holdOff(ox, oy, n) {
  for (let k = 0; k < n; k++) { setOff(ox, oy); G.step(DT); }
}

G.startLevel(0);
steps(60);
const ledges = G.level.platforms.slice(2);   // 跳过地面和出发平台
let ok = true;
for (let i = 0; i < ledges.length; i++) {
  const p = ledges[i];
  let climbed = false;
  for (let a = 0; a < 4 && !climbed; a++) {
    const out = G.core.x > p.x + p.w / 2 ? 1 : -1;
    const side = { x: out > 0 ? p.x + p.w + 10 : p.x - 10, y: p.y + 6 };
    if (!grab(side.x, side.y)) break;
    const h = G.hands[1];
    const ax = h.anchorX, ay = h.anchorY;
    const topY = p.y - 90;
    const outX = out > 0 ? p.x + p.w + 70 : p.x - 70;
    holdOff(ax - outX, ay - topY, 80);
    holdOff(ax - (p.x + p.w / 2), ay - topY, 80);
    grip(false);
    steps(100);
    if (G.core.y < p.y - 10 && G.core.x > p.x - 10 && G.core.x < p.x + p.w + 10) climbed = true;
  }
  console.log(`平台 ${i + 1}: ${climbed ? "OK" : "失败"}  core=${G.core.x.toFixed(0)},${G.core.y.toFixed(0)} 目标=${p.x},${p.y}`);
  if (!climbed) { ok = false; break; }
  if (G.state === "result") break;
}
console.log("state:", G.state, ok && G.state === "result" ? "L1 PASS" : "L1 FAIL");
process.exit(ok && G.state === "result" ? 0 : 1);
