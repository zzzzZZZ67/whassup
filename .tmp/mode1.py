import pathlib, sys

p = pathlib.Path(r"C:\Users\lixia\Desktop\final_project\index.html")
s = p.read_text(encoding="utf-8")

def rep(old, new, label=""):
    global s
    if old not in s:
        print("NOT FOUND:", label or old[:70])
        sys.exit(1)
    s = s.replace(old, new, 1)
    print("ok:", label or new[:44])

# CSS
rep("  button.primary:hover{background:linear-gradient(180deg,#ffd89b,#e0aa55)}",
    """  button.primary:hover{background:linear-gradient(180deg,#ffd89b,#e0aa55)}
  /* 模式选中：选中的变黄，另一个变黑 */
  button.mode-on{
    background:linear-gradient(180deg,#f2c780,#d19a45)!important;color:#2a1a08!important;
    border-color:#f2c780!important;font-weight:700;
    box-shadow:0 0 0 2px rgba(242,199,128,.35),0 6px 18px rgba(242,199,128,.22);
  }
  button.mode-off{
    background:#0b0a08!important;color:#6f6353!important;
    border-color:rgba(255,255,255,.08)!important;box-shadow:none;
  }
  button.mode-off:hover{background:#0b0a08!important;transform:none}""", "mode css")

# 逻辑
rep('''  function switchMode(mode) {
    Game.mode = mode;
  }''',
'''  function updateModeButtons() {
    if (typeof document === "undefined") return;
    const cam = document.getElementById("btn-cam");
    const demo = document.getElementById("btn-demo");
    if (!cam || !demo) return;
    const onCam = Game.mode === "camera";
    const onDemo = Game.mode === "demo";
    if (cam.classList) {
      cam.classList.toggle("mode-on", onCam);
      cam.classList.toggle("mode-off", onDemo);
    }
    if (demo.classList) {
      demo.classList.toggle("mode-on", onDemo);
      demo.classList.toggle("mode-off", onCam);
    }
  }

  function switchMode(mode) {
    Game.mode = mode;
    updateModeButtons();
  }''', "mode buttons logic")

rep('''    document.getElementById("btn-segments").addEventListener("click", showSegments);''',
'''    updateModeButtons();
    document.getElementById("btn-segments").addEventListener("click", showSegments);''', "boot update")

p.write_text(s, encoding="utf-8")
print("WROTE", len(s))
