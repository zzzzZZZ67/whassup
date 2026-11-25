// 路段：10 段都能生成并结算
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

let fails = 0;
for (let i = 0; i < 20; i++) {
  G.startSegment(i);
  for (let k = 0; k < 30; k++) G.step(DT);
  const built = G.state === "play" && G.level && G.level.summit && G.level.platforms.length >= 3;
  G.core.x = G.level.summit.x;
  G.core.y = G.level.summit.y;
  G.core.vx = 0; G.core.vy = 0;
  for (let k = 0; k < 3; k++) G.step(DT);
  const done = G.state === "result";
  if (!built || !done) fails++;
  console.log(`路段 ${i + 1} ${G.level.name}: ${built && done ? "OK" : "失败"}`);
}
console.log(fails === 0 ? "SEGMENTS PASS" : "SEGMENTS FAIL " + fails);
process.exit(fails === 0 ? 0 : 1);
