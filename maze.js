/* ============================================================
   maze.js  —  מנוע משחק מבוך לימודי
   ממשק זהה ל-MarioGame. ניווט במבוך: איסוף יהלומים (מטבעות),
   גבישי שאלה (?), ויציאה שנפתחת רק אחרי שעונים על כל השאלות.
   אותה לוגיקה של שאלות/דוחות/שלבים.
   ============================================================ */

const MazeGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};

  const MAZE = [
    "#####################",
    "#...................#",
    "#.###.###.#.###.###.#",
    "#...................#",
    "#.###.#.#####.#.###.#",
    "#.....#.......#.....#",
    "#.###.#.#####.#.###.#",
    "#.....#.......#.....#",
    "#.###.#.#####.#.###.#",
    "#...................#",
    "#.###.###.#.###.###.#",
    "#...................#",
    "#####################"
  ];
  const ROWS = MAZE.length, COLS = MAZE[0].length;
  const TILE = 28, OFFY = 44, SPEED = 3.0;
  const DELTA = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const REVERSE = { ArrowRight: "ArrowLeft", ArrowLeft: "ArrowRight", ArrowUp: "ArrowDown", ArrowDown: "ArrowUp" };
  const EXIT = { col: 19, row: 1 };

  let p, crystals, eaten, activeC, exitOpen;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, frame = 0, floats = [];

  let audioCtx = null;
  function beep(f, d, t) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = t || "square"; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.12, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
      o.start(); o.stop(audioCtx.currentTime + d);
    } catch (e) {}
  }
  const sounds = {
    gem: () => beep(700, 0.06, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"),
    open: () => { beep(523, 0.12); setTimeout(() => beep(784, 0.2), 120); }
  };

  const cx = c => c * TILE + TILE / 2;
  const cy = r => OFFY + r * TILE + TILE / 2;
  function isWall(c, r) { return r < 0 || r >= ROWS || c < 0 || c >= COLS || MAZE[r][c] === "#"; }
  function canMove(c, r, dir) { const d = DELTA[dir]; return d && !isWall(c + d[0], r + d[1]); }
  function approach(a, b, s) { return Math.abs(b - a) <= s ? b : a + Math.sign(b - a) * s; }

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;
    canvas.width = COLS * TILE;
    canvas.height = OFFY + ROWS * TILE;

    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);

    silver = 0; currentLevel = 1; answered = 0; floats = [];
    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  function buildLevel(n) {
    activeC = null; exitOpen = false; eaten = {};
    p = { col: 1, row: 11, x: cx(1), y: cy(11), dir: null, nextDir: null, tcol: 1, trow: 11, moving: false };

    const start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    const cols = [2, 6, 10, 14, 18];
    crystals = [];
    for (let i = 0; i < end - start; i++) {
      crystals.push({ col: cols[i % cols.length], row: 3, questionIndex: start + i, answered: false });
    }
  }

  function bindControls() {
    document.onkeydown = (e) => { if (DELTA[e.key]) { p.nextDir = e.key; e.preventDefault(); } };
    document.onkeyup = () => {};
  }
  function press(dir) { if (DELTA[dir] && p) p.nextDir = dir; }
  function release() {}

  function update() {
    if (paused) return;
    if (!p.moving) {
      if (p.nextDir && canMove(p.col, p.row, p.nextDir)) p.dir = p.nextDir;
      if (p.dir && canMove(p.col, p.row, p.dir)) { const d = DELTA[p.dir]; p.tcol = p.col + d[0]; p.trow = p.row + d[1]; p.moving = true; }
    }
    if (p.moving) {
      const tx = cx(p.tcol), ty = cy(p.trow);
      p.x = approach(p.x, tx, SPEED); p.y = approach(p.y, ty, SPEED);
      if (p.x === tx && p.y === ty) { p.col = p.tcol; p.row = p.trow; p.moving = false; onArrive(); }
    }
    for (const t of floats) { t.y -= 0.8; t.life--; }
    floats = floats.filter(t => t.life > 0);
  }

  function onArrive() {
    // יציאה פתוחה?
    if (exitOpen && p.col === EXIT.col && p.row === EXIT.row) { nextLevel(); return; }
    // גביש שאלה?
    const c = crystals.find(q => !q.answered && q.col === p.col && q.row === p.row);
    if (c) { paused = true; activeC = c; if (onQuestion) onQuestion(c.questionIndex); return; }
    // יהלום?
    const key = p.col + "," + p.row;
    if (MAZE[p.row][p.col] === "." && !eaten[key] &&
        !(p.col === EXIT.col && p.row === EXIT.row) &&
        !crystals.some(q => q.col === p.col && q.row === p.row)) {
      eaten[key] = true; silver++; sounds.gem();
    }
  }

  function resume(correct) {
    if (correct) {
      if (activeC) { activeC.answered = true; answered++; sounds.correct(); floats.push({ x: p.x, y: p.y - 18, text: "✓", life: 50 }); }
    } else {
      sounds.wrong();
      const rev = REVERSE[p.dir];
      if (rev && canMove(p.col, p.row, rev)) { const d = DELTA[rev]; p.col += d[0]; p.row += d[1]; p.x = cx(p.col); p.y = cy(p.row); }
      p.moving = false; p.dir = null; p.nextDir = null;
    }
    activeC = null; paused = false;
    if (crystals.length && crystals.every(q => q.answered) && !exitOpen) {
      exitOpen = true; sounds.open();
      floats.push({ x: cx(EXIT.col), y: cy(EXIT.row) - 18, text: "היציאה נפתחה!", life: 80 });
    }
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ----- ציור ----- */
  function draw() {
    ctx.fillStyle = "#14101f"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // קירות
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "#") {
        ctx.fillStyle = "#5b3a8e"; roundRect(c * TILE + 2, OFFY + r * TILE + 2, TILE - 4, TILE - 4, 6); ctx.fill();
        ctx.fillStyle = "#7a52b8"; roundRect(c * TILE + 5, OFFY + r * TILE + 5, TILE - 10, TILE - 10, 4); ctx.fill();
      }
    }
    // יהלומים
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "." && !eaten[c + "," + r] && !crystals.some(q => q.col === c && q.row === r) && !(c === EXIT.col && r === EXIT.row)) {
        drawGem(cx(c), cy(r), 4, "#4fd0ff");
      }
    }
    // יציאה
    drawExit();
    // גבישי שאלה
    for (const q of crystals) {
      const x = cx(q.col), y = cy(q.row);
      if (q.answered) { ctx.fillStyle = "rgba(255,255,255,0.18)"; drawGem(x, y, 8, "rgba(255,255,255,0.18)"); }
      else {
        ctx.save(); ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 14 + Math.sin(frame * 0.15) * 4;
        drawGem(x, y, 11, "#FFC93C"); ctx.restore();
        ctx.fillStyle = "#7a5200"; ctx.font = "bold 13px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("?", x, y + 1); ctx.textBaseline = "alphabetic";
      }
    }
    // הדמות (חוקר)
    drawHero();
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 80); ctx.fillStyle = "#7CFC00"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }

  function drawExit() {
    const x = cx(EXIT.col), y = cy(EXIT.row);
    if (exitOpen) {
      ctx.save(); ctx.shadowColor = "#2ecc71"; ctx.shadowBlur = 18;
      ctx.fillStyle = "#2ecc71"; roundRect(x - 11, y - 12, 22, 24, 4); ctx.fill(); ctx.restore();
      ctx.fillStyle = "#eafff0"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🏁", x, y + 1); ctx.textBaseline = "alphabetic";
    } else {
      ctx.fillStyle = "#995"; ctx.fillStyle = "#8a6d3b"; roundRect(x - 11, y - 12, 22, 24, 4); ctx.fill();
      ctx.fillStyle = "#5a4626"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("🔒", x, y + 1); ctx.textBaseline = "alphabetic";
    }
  }

  function drawHero() {
    if (window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, p.x, p.y, TILE - 1)) return;
    const x = p.x, y = p.y, r = TILE / 2 - 3;
    ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#1e8449"; ctx.beginPath(); ctx.arc(x, y - r + 4, r * 0.7, Math.PI, 0); ctx.fill();   // כובע
    ctx.fillStyle = "#fff"; ctx.beginPath();
    const ex = p.dir === "ArrowLeft" ? -3 : p.dir === "ArrowRight" ? 3 : 0;
    ctx.arc(x - 4 + ex, y, 2.5, 0, Math.PI * 2); ctx.arc(x + 4 + ex, y, 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(x - 4 + ex, y, 1.2, 0, Math.PI * 2); ctx.arc(x + 4 + ex, y, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  function drawGem(x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.7, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.7, y); ctx.closePath(); ctx.fill();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, canvas.width, OFFY);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("💎 " + silver, 12, 22);
    ctx.textAlign = "center";
    const done = crystals.filter(q => q.answered).length;
    ctx.fillText("🔑 " + done + " / " + crystals.length, canvas.width / 2, 22);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 22);
    ctx.textBaseline = "alphabetic";
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop() { frame++; update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
