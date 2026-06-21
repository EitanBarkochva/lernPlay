/* ============================================================
   spaceship.js  —  מנוע משחק חללית לימודי
   ממשק זהה ל-MarioGame. טיסה חופשית בחלל: איסוף כוכבים (מטבעות),
   שערי שאלות (?), מטאורים (אויבים), חיים ושלבים — אותה לוגיקה.
   ============================================================ */

const SpaceshipGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};
  let ship, stars, portals, asteroids, bgStars, activeP;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0;
  let lives = 3, hurtT = 0, frame = 0, floats = [];

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
    coin: () => beep(880, 0.08, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"),
    hurt: () => beep(110, 0.35, "sawtooth")
  };

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;

    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);

    silver = 0; currentLevel = 1; answered = 0; lives = 3; floats = [];
    // כוכבי רקע
    bgStars = [];
    for (let i = 0; i < 70; i++) bgStars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, s: Math.random() * 1.6 + 0.4 });

    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  function buildLevel(n) {
    hurtT = 0; activeP = null;
    ship = { x: 60, y: canvas.height / 2, vx: 0, vy: 0, w: 36, h: 26 };

    const start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    const count = Math.max(1, end - start);

    // שערי שאלה - פזורים בזיג-זג לרוחב המסך
    portals = [];
    for (let i = 0; i < end - start; i++) {
      const x = 180 + i * ((canvas.width - 260) / Math.max(1, count - 1 || 1));
      const y = (i % 2 === 0) ? 95 : canvas.height - 95;
      portals.push({ x: count === 1 ? canvas.width / 2 : x, y: count === 1 ? canvas.height / 2 : y, qi: start + i, answered: false, r: 26 });
    }

    // כוכבים לאיסוף
    stars = [];
    for (let i = 0; i < 14; i++) stars.push({ x: Math.random() * (canvas.width - 60) + 30, y: Math.random() * (canvas.height - 80) + 55, taken: false });

    // מטאורים (אויבים) - מספרם גדל עם השלבים
    asteroids = [];
    const an = Math.min(2 + currentLevel, 7);
    for (let i = 0; i < an; i++) {
      asteroids.push({
        x: Math.random() * canvas.width, y: 60 + Math.random() * (canvas.height - 100),
        vx: (Math.random() - 0.5) * (2 + currentLevel * 0.4), vy: (Math.random() - 0.5) * (2 + currentLevel * 0.4),
        r: 14 + Math.random() * 10, spin: Math.random() * Math.PI
      });
    }
  }

  function bindControls() {
    document.onkeydown = (e) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) { keys[e.key] = true; e.preventDefault(); } };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(dir) { keys[dir] = true; }
  function release(dir) { keys[dir] = false; }

  function update() {
    if (paused) return;
    if (hurtT > 0) hurtT--;

    const acc = 0.55, max = 5.2, fr = 0.93;
    if (keys.ArrowLeft) ship.vx -= acc;
    if (keys.ArrowRight) ship.vx += acc;
    if (keys.ArrowUp) ship.vy -= acc;
    if (keys.ArrowDown) ship.vy += acc;
    ship.vx = Math.max(-max, Math.min(max, ship.vx)) * fr;
    ship.vy = Math.max(-max, Math.min(max, ship.vy)) * fr;
    ship.x += ship.vx; ship.y += ship.vy;
    ship.x = Math.max(ship.w / 2, Math.min(canvas.width - ship.w / 2, ship.x));
    ship.y = Math.max(44 + ship.h / 2, Math.min(canvas.height - ship.h / 2, ship.y));

    // איסוף כוכבים
    for (const s of stars) {
      if (!s.taken && Math.hypot(s.x - ship.x, s.y - ship.y) < 24) { s.taken = true; silver++; sounds.coin(); }
    }
    // שערי שאלה
    for (const p of portals) {
      if (!p.answered && Math.hypot(p.x - ship.x, p.y - ship.y) < p.r + 14) { paused = true; activeP = p; if (onQuestion) onQuestion(p.qi); return; }
    }
    // מטאורים
    for (const a of asteroids) {
      a.x += a.vx; a.y += a.vy; a.spin += 0.04;
      if (a.x < a.r || a.x > canvas.width - a.r) a.vx *= -1;
      if (a.y < 44 + a.r || a.y > canvas.height - a.r) a.vy *= -1;
      if (hurtT === 0 && Math.hypot(a.x - ship.x, a.y - ship.y) < a.r + ship.h / 2 - 2) hurtPlayer();
    }
    for (const t of floats) { t.y -= 0.8; t.life--; }
    floats = floats.filter(t => t.life > 0);
  }

  function hurtPlayer() {
    lives--; hurtT = 90; silver = Math.max(0, silver - 2); sounds.hurt();
    ship.x = 60; ship.y = canvas.height / 2; ship.vx = 0; ship.vy = 0;
    if (lives <= 0) { lives = 3; hurtT = 120; floats.push({ x: ship.x, y: ship.y, text: "התחלה מחדש", life: 70 }); }
  }

  function resume(correct) {
    if (correct) {
      if (activeP) { activeP.answered = true; answered++; sounds.correct(); floats.push({ x: ship.x, y: ship.y - 20, text: "✓", life: 50 }); }
    } else {
      sounds.wrong();
      ship.x = Math.max(ship.w / 2, ship.x - 70); ship.vx = 0; ship.vy = 0;
    }
    activeP = null; paused = false;
    if (portals.length && portals.every(p => p.answered)) nextLevel();
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ----- ציור ----- */
  function draw() {
    // רקע חלל
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#0b1026"); grad.addColorStop(1, "#1a1040");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fff";
    for (const b of bgStars) { ctx.globalAlpha = 0.4 + Math.abs(Math.sin((frame + b.x) * 0.03)) * 0.6; ctx.fillRect(b.x, b.y, b.s, b.s); }
    ctx.globalAlpha = 1;

    // כוכבים לאיסוף
    for (const s of stars) { if (!s.taken) drawStar(s.x, s.y, 9, "#FFD11A"); }

    // שערי שאלה
    for (const p of portals) {
      if (p.answered) { ctx.strokeStyle = "rgba(255,255,255,0.2)"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke(); continue; }
      ctx.save(); ctx.shadowColor = "#4fd0ff"; ctx.shadowBlur = 16 + Math.sin(frame * 0.12) * 5;
      ctx.strokeStyle = "#4fd0ff"; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = "#a0e8ff"; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, p.r - 7 + Math.sin(frame * 0.15) * 2, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      ctx.fillStyle = "#fff"; ctx.font = "bold 22px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText("?", p.x, p.y + 1); ctx.textBaseline = "alphabetic";
    }

    // מטאורים
    for (const a of asteroids) drawAsteroid(a);

    // חללית
    drawShip();

    // טקסטים מרחפים
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#FFD700"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }

  function drawShip() {
    if (hurtT > 0 && Math.floor(frame / 4) % 2 === 0) return;
    const s = ship;
    if (window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, s.x, s.y, s.h + 18)) return;
    // להבת מנוע
    ctx.fillStyle = "#ff8c00";
    ctx.beginPath(); ctx.moveTo(s.x - s.w / 2, s.y - 5); ctx.lineTo(s.x - s.w / 2 - 8 - Math.random() * 5, s.y); ctx.lineTo(s.x - s.w / 2, s.y + 5); ctx.fill();
    // גוף
    ctx.fillStyle = "#dfe6ee";
    ctx.beginPath(); ctx.moveTo(s.x + s.w / 2, s.y); ctx.lineTo(s.x - s.w / 2, s.y - s.h / 2); ctx.lineTo(s.x - s.w / 4, s.y); ctx.lineTo(s.x - s.w / 2, s.y + s.h / 2); ctx.closePath(); ctx.fill();
    // חלון
    ctx.fillStyle = "#4fd0ff"; ctx.beginPath(); ctx.arc(s.x + 4, s.y, 5, 0, Math.PI * 2); ctx.fill();
  }

  function drawStar(x, y, r, color) {
    ctx.fillStyle = color; ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + i * 2 * Math.PI / 5;
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      const a2 = a + Math.PI / 5;
      ctx.lineTo(x + Math.cos(a2) * r * 0.45, y + Math.sin(a2) * r * 0.45);
    }
    ctx.closePath(); ctx.fill();
  }

  function drawAsteroid(a) {
    ctx.save(); ctx.translate(a.x, a.y); ctx.rotate(a.spin);
    ctx.fillStyle = "#8a8f99"; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const ang = i / 8 * Math.PI * 2; const rr = a.r * (0.8 + ((i % 2) ? 0.2 : 0)); ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr); }
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#6b7079"; ctx.beginPath(); ctx.arc(-a.r * 0.2, -a.r * 0.1, a.r * 0.25, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, canvas.width, 40);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("⭐ " + silver, 12, 20);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 20);
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < 3; i++) drawHeart(canvas.width / 2 - 26 + i * 20, 12, 7, i < lives);
  }
  function drawHeart(x, y, s, filled) {
    ctx.beginPath();
    ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.4);
    ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.1, x, y + s * 1.4);
    ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s, x + s, y + s * 0.4);
    ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
    ctx.closePath();
    ctx.fillStyle = filled ? "#E53935" : "rgba(255,255,255,0.25)"; ctx.fill();
  }

  function loop() { frame++; update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
