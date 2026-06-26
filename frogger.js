/* ============================================================
   frogger.js  —  מנוע "צפרדע חוצה כביש" לימודי (Frogger)
   ממשק זהה לשאר המנועים. חיצים להזזת הצפרדע, נמנעים ממכוניות,
   ומגיעים לעלה-השאלה (?) שלמעלה כדי לענות.
   ============================================================ */

const FroggerGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false;
  let TILE = 40, cols = 11, rows = 9;
  let frog, cars, pad, coins, activeQ;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1, start = 0;
  let lives = 3, hurtT = 0, frame = 0, floats = [];
  const HUD = 38;

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
    hop: () => beep(520, 0.05, "square"), coin: () => beep(880, 0.07, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"), hurt: () => beep(110, 0.35, "sawtooth")
  };

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;
    const W = Math.min(640, window.innerWidth - 20);
    cols = Math.floor(W / TILE); if (cols % 2 === 0) cols--; rows = 9;
    canvas.width = cols * TILE; canvas.height = rows * TILE + HUD;
    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);
    silver = 0; currentLevel = 1; answered = 0; lives = 3; floats = [];
    buildLevel(currentLevel); bindControls(); paused = false; loop();
  }

  function buildLevel(n) {
    hurtT = 0; activeQ = null; answered = 0;
    resetFrog();
    // שורות 1..rows-3 = נתיבי מכוניות; שורה 0 = יעד; שורה rows-1 = התחלה
    cars = [];
    for (let r = 1; r <= rows - 3; r++) {
      const dir = r % 2 === 0 ? 1 : -1;
      const spd = (0.8 + Math.random() * 0.8 + n * 0.15) * dir;
      const num = 2 + (Math.random() < 0.5 ? 0 : 1);
      for (let k = 0; k < num; k++) cars.push({ r: r, x: (k * cols / num + Math.random()) * TILE, w: TILE * 1.3, spd: spd, color: ["#e74c3c", "#2980b9", "#f39c12", "#8e44ad"][(r + k) % 4] });
    }
    coins = [];
    for (let i = 0; i < 3; i++) coins.push({ c: Math.floor(Math.random() * cols), r: rows - 2, taken: false });
    placePad();
    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
  }
  function resetFrog() { frog = { c: Math.floor(cols / 2), r: rows - 1 }; }
  function placePad() { pad = { c: Math.floor(Math.random() * cols), qi: start + answered }; }

  function bindControls() {
    document.onkeydown = (e) => {
      const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
      if (m[e.key]) { hop(m[e.key][0], m[e.key][1]); e.preventDefault(); }
    };
    document.onkeyup = () => {};
  }
  function press(d) { const m = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }; if (m[d]) hop(m[d][0], m[d][1]); }
  function release() {}

  function hop(dc, dr) {
    if (paused) return;
    frog.c = Math.max(0, Math.min(cols - 1, frog.c + dc));
    frog.r = Math.max(0, Math.min(rows - 1, frog.r + dr));
    sounds.hop();
    // הגעה לעלה השאלה
    if (frog.r === 0 && frog.c === pad.c) { paused = true; activeQ = pad; if (onQuestion) onQuestion(pad.qi); return; }
    // מטבע
    for (const co of coins) if (!co.taken && co.c === frog.c && co.r === frog.r) { co.taken = true; silver++; sounds.coin(); floats.push({ x: frog.c * TILE + TILE / 2, y: HUD + frog.r * TILE, text: "+1", life: 35 }); }
  }

  function update() {
    if (paused) return;
    frame++; if (hurtT > 0) hurtT--;
    for (const c of cars) {
      c.x += c.spd * 2;
      if (c.x > canvas.width + 10) c.x = -c.w - 10;
      if (c.x < -c.w - 10) c.x = canvas.width + 10;
    }
    // התנגשות
    if (hurtT === 0) {
      const fx = frog.c * TILE, fy = HUD + frog.r * TILE;
      for (const c of cars) {
        if (c.r === frog.r) {
          const cx = c.x, cy = HUD + c.r * TILE;
          if (fx + TILE - 6 > cx && fx + 6 < cx + c.w && fy === cy) { hurtPlayer(); break; }
        }
      }
    }
    for (const t of floats) { t.y -= 0.7; t.life--; } floats = floats.filter(t => t.life > 0);
  }

  function hurtPlayer() { lives--; hurtT = 55; silver = Math.max(0, silver - 2); sounds.hurt(); resetFrog(); if (lives <= 0) { lives = 3; hurtT = 90; floats.push({ x: canvas.width / 2, y: HUD + 60, text: "ממשיכים!", life: 70 }); } }

  function resume(correct) {
    if (correct) { answered++; sounds.correct(); floats.push({ x: canvas.width / 2, y: HUD + 40, text: "✓", life: 45 }); }
    else sounds.wrong();
    resetFrog(); placePad(); activeQ = null; paused = false;
    if (answered >= count) nextLevel();
  }
  function nextLevel() { if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); } else { currentLevel++; buildLevel(currentLevel); } }

  function draw() {
    // שורות: יעד (דשא), כביש, התחלה (דשא)
    for (let r = 0; r < rows; r++) {
      const y = HUD + r * TILE;
      if (r === 0 || r === rows - 1) ctx.fillStyle = "#5bbf52";
      else ctx.fillStyle = (r % 2 === 0) ? "#555a61" : "#4c5158";
      ctx.fillRect(0, y, canvas.width, TILE);
      if (r >= 1 && r <= rows - 3) { ctx.strokeStyle = "rgba(255,255,255,0.5)"; ctx.setLineDash([12, 12]); ctx.beginPath(); ctx.moveTo(0, y + TILE / 2); ctx.lineTo(canvas.width, y + TILE / 2); ctx.stroke(); ctx.setLineDash([]); }
    }
    // עלה השאלה
    ctx.fillStyle = "#6C5CE7"; const px = pad.c * TILE, py = HUD;
    roundRect(px + 4, py + 4, TILE - 8, TILE - 8, 8); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", px + TILE / 2, py + TILE / 2 + 1); ctx.textBaseline = "alphabetic";
    // מטבעות
    for (const co of coins) if (!co.taken) { ctx.fillStyle = "#FFC400"; ctx.beginPath(); ctx.arc(co.c * TILE + TILE / 2, HUD + co.r * TILE + TILE / 2, TILE * 0.25, 0, Math.PI * 2); ctx.fill(); }
    // מכוניות
    for (const c of cars) { ctx.fillStyle = c.color; roundRect(c.x, HUD + c.r * TILE + 5, c.w, TILE - 10, 6); ctx.fill(); ctx.fillStyle = "rgba(255,255,255,0.6)"; ctx.fillRect(c.x + c.w * 0.15, HUD + c.r * TILE + 9, c.w * 0.25, TILE - 18); }
    // צפרדע
    if (!(hurtT > 0 && Math.floor(frame / 4) % 2 === 0)) {
      const fx = frog.c * TILE + TILE / 2, fy = HUD + frog.r * TILE + TILE / 2;
      if (!(window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, fx, fy, TILE - 6))) {
        ctx.fillStyle = "#2ecc71"; ctx.beginPath(); ctx.arc(fx, fy, TILE * 0.34, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#27ae60"; ctx.beginPath(); ctx.arc(fx - 8, fy - 8, 5, 0, Math.PI * 2); ctx.arc(fx + 8, fy - 8, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(fx - 8, fy - 8, 3, 0, Math.PI * 2); ctx.arc(fx + 8, fy - 8, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(fx - 8, fy - 8, 1.4, 0, Math.PI * 2); ctx.arc(fx + 8, fy - 8, 1.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 45); ctx.fillStyle = "#fff"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.55)"; ctx.fillRect(0, 0, canvas.width, HUD);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("🪙 " + silver, 12, HUD / 2);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, HUD / 2); ctx.textBaseline = "alphabetic";
    for (let i = 0; i < 3; i++) drawHeart(canvas.width / 2 - 26 + i * 20, 11, 7, i < lives);
  }
  function drawHeart(x, y, s, filled) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.4); ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.1, x, y + s * 1.4);
    ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s, x + s, y + s * 0.4); ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
    ctx.closePath(); ctx.fillStyle = filled ? "#E53935" : "rgba(255,255,255,0.25)"; ctx.fill();
  }

  function loop() { update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
