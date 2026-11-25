// 生成关卡：层数 / 层间隔离 / 传送 / 检查点 / 平均难度 / 世界边界
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const code = html.match(/<script>([\s\S]*?)<\/script>/)[1];

const sandbox = {
  window: {
    localStorage: {
      _s: {},
      getItem(k) { return this._s[k] ?? null; },
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
vm.runInContext(code, sandbox);

const G = sandbox.window.Game;
const DT = 1 / 120;
const specs = [
  { layers: 3, avg: 2.5 },
  { layers: 3, avg: 2.8 },
  { layers: 4, avg: 2.8 },
  { layers: 4, avg: 3.0 },
  { layers: 5, avg: 3.0 },
  { layers: 10, avg: 3.5 }
];

let fails = 0;
function check(name, cond, extra) {
  if (cond) console.log("  PASS  " + name);
  else { fails++; console.log("  FAIL  " + name + (extra ? "  -> " + extra : "")); }
}

for (let i = 0; i < specs.length; i++) {
  const spec = specs[i];
  G.startLevel(5 + i);
  const L = G.level;
  const starts = L.checkpoints.filter((c) => c.kind === "start");
  const ends = L.checkpoints.filter((c) => c.kind === "end");
  const avg = L.layers.reduce((a, l) => a + l.avg, 0) / L.layers.length;
  let minGap = Infinity;
  for (let l = 0; l < starts.length - 1; l++) minGap = Math.min(minGap, starts[l + 1].y - ends[l].y);
  const gap = -minGap;

  console.log(`\n${L.name}: 层=${L.layers.length} 检查点=${L.checkpoints.length} 平均=${avg.toFixed(2)} 层间间隔=${gap.toFixed(0)} worldH=${L.worldH}`);

  check("从层初检查点开始",
    Math.abs(G.core.x - L.checkpoints[0].spawn.x) < 1 && Math.abs(G.core.y - L.checkpoints[0].spawn.y) < 1,
    "core=" + G.core.x.toFixed(0) + "," + G.core.y.toFixed(0));
  check("层数正确", L.layers.length === spec.layers);
  check("每层 起点+终点 两个检查点", L.checkpoints.length === spec.layers * 2);
  check("起点数 = 终点数 = 层数", starts.length === spec.layers && ends.length === spec.layers);
  check("平均难度接近目标", Math.abs(avg - spec.avg) <= 0.08, avg.toFixed(2) + " vs " + spec.avg);
  check("层间间隔远大于臂展（>600）", gap > 600, gap.toFixed(0));
  check("检查点都在平台上", L.checkpoints.every((cp) =>
    L.platforms.some((p) => cp.x >= p.x - 0.01 && cp.x <= p.x + p.w + 0.01 && Math.abs(cp.y - p.y) < 0.01)));
  check("层末都指向下一层层初", ends.every((e, k) => k === ends.length - 1 ? e.teleportTo == null : e.teleportTo != null));
  check("最高点在世界内", Math.min(...L.platforms.map((p) => p.y)) > 100);
  check("有终点", !!L.summit);

  // 传送到下一层
  if (ends[0] && ends[0].teleportTo != null) {
    const core = G.core;
    core.x = ends[0].trigger.x; core.y = ends[0].trigger.y; core.vx = 0; core.vy = 0;
    for (let k = 0; k < 4; k++) G.step(DT);
    const t = L.checkpoints[ends[0].teleportTo];
    check("层末传送后落在下一层层初", Math.abs(core.x - t.spawn.x) < 1 && Math.abs(core.y - t.spawn.y) < 1);
    check("传送后视野跟随（cam 在动）", Math.abs(G.cam - (core.y - 450)) > 20, "cam=" + G.cam.toFixed(0));
  }
}

console.log("\n" + (fails === 0 ? "GEN LEVELS PASS" : fails + " FAILURE(S)"));
process.exit(fails === 0 ? 0 : 1);
