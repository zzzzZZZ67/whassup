# 测试脚本

不依赖浏览器，用 Node.js 直接跑 `index.html` 里的逻辑。需要 Node 18+（用到了 `node:vm` 与 ESM）。

```bash
node tests/smoke.mjs     # 逻辑冒烟：落地、抓取、拉起、松手、检查点、R 复位、边界、登顶
node tests/climb.mjs     # 脚本化爬关：自动打通第 1 关的 6 段平台
node tests/domtest.mjs   # 假 DOM 入口：boot → 演示模式 → 300 帧渲染 + 按键
```

说明：

- 三个脚本都会自己从 `../index.html` 里正则抽取 `<script>`，不需要构建。
- `domtest.mjs` 用假的 Canvas 2D 上下文，只验证"代码路径不抛错"，**不验证画面**。
- 摄像头相关逻辑没有覆盖，需要真机验证。
