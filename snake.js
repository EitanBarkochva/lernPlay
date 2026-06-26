/* ============================================================
   snake.js  —  מנוע "נחש" לימודי (Snake)
   ממשק זהה לשאר המנועים. חיצים לכיוון, אוכלים מטבעות וגדלים,
   אכילת פרי-שאלה (?) פותחת שאלה. התנגשות בעצמך מורידה חיים.
   ============================================================ */

const SnakeGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};
  let TILE = 26, cols = 10, rows = 12;
  let snake, dir, nextDir, food, qfood, activeQ;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1, start = 0;
  let lives = 3, hurtT = 0, frame = 0, stepEvery = 8, stepT = 0, floats = [];

  let audioCtx = null;
  function beep(f, d, t) {
    try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const o = audioCtx.createOscillator(), g = audioCtx.createGain();
      o.type = t || "square"; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
      g.gain.setValueAtTime(0.12, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + d);
      o.start(); o.stop(audioCtx.currentTime + d);
    } catch (e) {}
  }
  const sounds = {
    coin: () => beep(880, 0.07, "sine"), correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"), hurt: () => beep(110, 0.35, "sawtooth")
  };

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;
    const W = Math.min(560, window.innerWidth - 20);
    cols = Math.floor(W / TILE); rows = 13;
    canvas.width = cols * TILE; canvas.height = rows * TILE + 38;
    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);
    silver = 0; currentLevel = 1; answered = 0; lives = 3; floats = [];
    buildLevel(currentLevel); bindControls(); paused = false; loop();
  }

  const HUD = 38;
  function rowsArea() { return rows; }
  function buildLevel(n) {
    hurtT = 0; activeQ = null; answered = 0;
    stepEvery = Math.max(4, 9 - n);
    snake = [{ c: 4, r: 6 }, { c: 3, r: 6 }, { c: 2, r: 6 }];
    dir = { dc: 1, dr: 0 }; nextDir = { dc: 1, dr: 0 };
    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
    placeFood(); placeQ();
  }

  function freeCell() {
    let c, r, tries = 0;
    do { c = Math.floor(Math.random() * cols); r = Math.floor(Math.random() * rows); tries++; }
    while (tries < 80 && (snake.some(s => s.c === c && s.r === r) || (food && food.c === c && food.r === r) || (qfood && qfood.c === c && qfood.r === r)));
    return { c, r };
  }
  function placeFood() { food = freeCell(); }
  function placeQ() { if (answered < count) { const f = freeCell(); qfood = { c: f.c, r: f.r, qi: start + answered }; } else qfood = null; }

  function bindControls() {
    document.onkeydown = (e) => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (m[e.key]) { const [dc, dr] = m[e.key]; if (dc !== -dir.dc || dr !== -dir.dr) nextDir = { dc, dr }; e.preventDefault(); }
    };
    document.onkeyup = () => {};
  }
  function press(d) { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (m[d]) { const [dc, dr] = m[d]; if (dc !== -dir.dc || dr !== -dir.dr) nextDir = { dc, dr }; } }
  function release() {}

  function update() {
    if (paused) return;
    frame++; if (hurtT > 0) hurtT--;
    stepT++; if (stepT < stepEvery) { tickFloats(); return; }
    stepT = 0;
    dir = nextDir;
    let nc = (snake[0].c + dir.dc + cols) % cols;
    let nr = (snake[0].r + dir.dr + rows) % rows;
    // התנגשות בגוף
    if (snake.some((s, i) => i > 0 && s.c === nc && s.r === nr)) { if (hurtT === 0) hurtPlayer(); tickFloats(); return; }
    const head = { c: nc, r: nr };
    // פרי שאלה
    if (qfood && nc === qfood.c && nr === qfood.r) { snake.unshift(head); paused = true; activeQ = qfood; if (onQuestion) onQuestion(qfood.qi); return; }
    snake.unshift(head);
    if (food && nc === food.c && nr === food.r) { silver++; sounds.coin(); floats.push({ x: nc * TILE + TILE / 2, y: HUD + nr * TILE, text: "+1", life: 35 }); placeFood(); }
    else snake.pop();
    tickFloats();
  }
  function tickFloats() { for (const t of floats) { t.y -= 0.7; t.life--; } floats = floats.filter(t => t.life > 0); }

  function hurtPlayer() {
    lives--; hurtT = 60; silver = Math.max(0, silver - 2); sounds.hurt();
    snake = [{ c: 4, r: 6 }, { c: 3, r: 6 }, { c: 2, r: 6 }]; dir = { dc: 1, dr: 0 }; nextDir = { dc: 1, dr: 0 };
    if (lives <= 0) { lives = 3; hurtT = 100; floats.push({ x: canvas.width / 2, y: HUD + 60, text: "ממשיכים!", life: 70 }); }
  }

  function resume(correct) {
    if (correct) { answered++; sounds.correct(); floats.push({ x: canvas.width / 2, y: HUD + 40, text: "✓", life: 45 }); }
    else { sounds.wrong(); if (snake.length > 3) snake.pop(); }
    placeQ(); activeQ = null; paused = false;
    if (answered >= count) nextLevel();
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  function draw() {
    // רקע משבצות
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      ctx.fillStyle = ((r + c) % 2 === 0) ? "#aee0a0" : "#a0d894";
      ctx.fillRect(c * TILE, HUD + r * TILE, TILE, TILE);
    }
    // מטבע
    if (food) { ctx.fillStyle = "#FFC400"; ctx.beginPath(); ctx.arc(food.c * TILE + TILE / 2, HUD + food.r * TILE + TILE / 2, TILE * 0.32, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#FFF0A6"; ctx.beginPath(); ctx.arc(food.c * TILE + TILE / 2 - 3, HUD + food.r * TILE + TILE / 2 - 3, 3, 0, Math.PI * 2); ctx.fill(); }
    // פרי שאלה
    if (qfood) { ctx.fillStyle = "#6C5CE7"; ctx.beginPath(); ctx.arc(qfood.c * TILE + TILE / 2, HUD + qfood.r * TILE + TILE / 2, TILE * 0.42, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(TILE * 0.6) + "px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", qfood.c * TILE + TILE / 2, HUD + qfood.r * TILE + TILE / 2 + 1); ctx.textBaseline = "alphabetic"; }
    // נחש
    if (!(hurtT > 0 && Math.floor(frame / 4) % 2 === 0)) {
      const head = snake[0];
      if (!(window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, head.c * TILE + TILE / 2, HUD + head.r * TILE + TILE / 2, TILE - 2))) {
        for (let i = snake.length - 1; i >= 0; i--) {
          const s = snake[i];
          ctx.fillStyle = i === 0 ? "#1e7d34" : "#2faa48";
          const pad = i === 0 ? 1 : 2;
          roundRect(s.c * TILE + pad, HUD + s.r * TILE + pad, TILE - pad * 2, TILE - pad * 2, 6); ctx.fill();
        }
        // עיניים
        const h = snake[0];
        ctx.fillStyle = "#fff";
        ctx.beginPath(); ctx.arc(h.c * TILE + TILE / 2 - 4, HUD + h.r * TILE + TILE / 2 - 3, 3, 0, Math.PI * 2);
        ctx.arc(h.c * TILE + TILE / 2 + 4, HUD + h.r * TILE + TILE / 2 - 3, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222";
        ctx.beginPath(); ctx.arc(h.c * TILE + TILE / 2 - 4, HUD + h.r * TILE + TILE / 2 - 3, 1.3, 0, Math.PI * 2);
        ctx.arc(h.c * TILE + TILE / 2 + 4, HUD + h.r * TILE + TILE / 2 - 3, 1.3, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 45); ctx.fillStyle = "#1e7d34"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, canvas.width, HUD);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("🪙 " + silver, 12, HUD / 2);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, HUD / 2);
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < 3; i++) drawHeart(canvas.width / 2 - 26 + i * 20, 11, 7, i < lives);
  }
  function drawHeart(x, y, s, filled) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.4); ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.1, x, y + s * 1.4);
    ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s, x + s, y + s * 0.4); ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
    ctx.closePath(); ctx.fillStyle = filled ? "#E53935" : "rgba(255,255,255,0.25)"; ctx.fill();
  }

  function loop() { update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
