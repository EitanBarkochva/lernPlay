/* ============================================================
   bubbles.js  —  משחק בועות (Bubble Shooter) לימודי
   ממשק זהה ל-MarioGame. תותח מכוון יורה כדור; פגיעה בבועת שאלה (?)
   פותחת שאלה, ותשובה נכונה משחררת טיל שמפוצץ אשכול בועות = מטבעות.
   אותה לוגיקה של שאלות / דוחות / שלבים.
   ============================================================ */

const BubblesGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};
  let cannon, projectile, bubbles, particles, activeBubble;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, frame = 0, floats = [];

  const COLORS = ["#e74c3c", "#3498db", "#2ecc71", "#f1c40f", "#9b59b6", "#e67e22"];
  const R = 18, PSPEED = 8, AIM = 0.045, MAXA = 1.2, EXPL = 78;

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
    shoot: () => beep(300, 0.08, "square"),
    pop: () => beep(660, 0.06, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"),
    boom: () => { beep(120, 0.25, "sawtooth"); setTimeout(() => beep(80, 0.3, "sawtooth"), 60); }
  };

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;

    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);

    silver = 0; currentLevel = 1; answered = 0; floats = []; particles = [];
    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  function buildLevel(n) {
    activeBubble = null; projectile = null; particles = [];
    cannon = { x: canvas.width / 2, y: canvas.height - 24, angle: 0 };

    // סידור בועות בשורות בחלק העליון
    bubbles = [];
    const cols = Math.floor((canvas.width - 30) / (R * 2 + 6));
    const gapX = (canvas.width - cols * (R * 2)) / (cols + 1);
    const rows = 4;
    const cells = [];
    for (let r = 0; r < rows; r++) {
      const off = (r % 2) * (R + 3);
      for (let c = 0; c < cols; c++) {
        const x = gapX + R + c * (R * 2 + gapX) + off;
        const y = 60 + r * (R * 2 - 2);
        if (x < canvas.width - R) cells.push({ x, y });
      }
    }

    const start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    const qCount = end - start;

    // בחירת תאים לבועות שאלה (פזורים)
    const qCells = [];
    for (let i = 0; i < qCount && cells.length; i++) {
      const idx = Math.floor((i + 0.5) * cells.length / qCount);
      qCells.push(Math.min(idx, cells.length - 1));
    }

    cells.forEach((cell, i) => {
      const qPos = qCells.indexOf(i);
      bubbles.push({
        x: cell.x, y: cell.y, r: R,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        popped: false,
        q: qPos >= 0,
        questionIndex: qPos >= 0 ? start + qPos : -1,
        answered: false
      });
    });
  }

  function bindControls() {
    document.onkeydown = (e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { keys[e.key] = true; e.preventDefault(); }
      if (e.key === " " || e.key === "ArrowUp") { fire(); e.preventDefault(); }
    };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(dir) { if (dir === " " || dir === "ArrowUp") fire(); else keys[dir] = true; }
  function release(dir) { keys[dir] = false; }

  function fire() {
    if (paused || projectile) return;
    projectile = { x: cannon.x, y: cannon.y - 22, vx: Math.sin(cannon.angle) * PSPEED, vy: -Math.cos(cannon.angle) * PSPEED, r: 9 };
    sounds.shoot();
  }

  function update() {
    if (paused) return;
    // כיוון התותח
    if (keys.ArrowLeft) cannon.angle = Math.max(-MAXA, cannon.angle - AIM);
    if (keys.ArrowRight) cannon.angle = Math.min(MAXA, cannon.angle + AIM);

    // כדור
    if (projectile) {
      projectile.x += projectile.vx; projectile.y += projectile.vy;
      if (projectile.x < projectile.r || projectile.x > canvas.width - projectile.r) projectile.vx *= -1; // ריקושט מהקירות
      if (projectile.y < 44) { projectile = null; }
      else {
        for (const b of bubbles) {
          if (b.popped) continue;
          if (Math.hypot(b.x - projectile.x, b.y - projectile.y) < b.r + projectile.r) {
            if (b.q && !b.answered) { paused = true; activeBubble = b; if (onQuestion) onQuestion(b.questionIndex); projectile = null; }
            else if (!b.q) { popBubble(b); projectile = null; }
            else { projectile = null; } // בועת שאלה שכבר נענתה
            break;
          }
        }
      }
    }

    for (const p of particles) { p.x += p.vx; p.y += p.vy; p.vy += 0.15; p.life--; }
    particles = particles.filter(p => p.life > 0);
    for (const t of floats) { t.y -= 0.8; t.life--; }
    floats = floats.filter(t => t.life > 0);
  }

  function popBubble(b) {
    b.popped = true; silver++; sounds.pop(); spark(b.x, b.y, b.color, 6);
  }
  function spark(x, y, color, n) {
    for (let i = 0; i < n; i++) particles.push({ x, y, vx: (Math.random() - 0.5) * 5, vy: (Math.random() - 0.5) * 5, life: 25, color });
  }

  function resume(correct) {
    if (correct && activeBubble) {
      // טיל מתפוצץ - מפוצץ את הבועה וכל מה שסביבה
      activeBubble.answered = true; answered++;
      sounds.correct(); sounds.boom();
      const ax = activeBubble.x, ay = activeBubble.y;
      for (const b of bubbles) {
        if (!b.popped && Math.hypot(b.x - ax, b.y - ay) <= EXPL) {
          b.popped = true; silver++; spark(b.x, b.y, b.color, 8);
        }
      }
      // התפוצצות גדולה
      for (let i = 0; i < 24; i++) particles.push({ x: ax, y: ay, vx: (Math.random() - 0.5) * 9, vy: (Math.random() - 0.5) * 9, life: 35, color: i % 2 ? "#ff8c00" : "#ffd700" });
      floats.push({ x: ax, y: ay, text: "בום! 💥", life: 50 });
    } else {
      sounds.wrong();
    }
    activeBubble = null; paused = false;
    if (bubbles.filter(b => b.q).every(b => b.answered)) setTimeout(nextLevel, 500);
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ----- ציור ----- */
  function draw() {
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#1b2a4a"); grad.addColorStop(1, "#0e1530");
    ctx.fillStyle = grad; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // קו כיוון מקווקו
    if (!projectile && !paused) {
      ctx.strokeStyle = "rgba(255,255,255,0.35)"; ctx.lineWidth = 2; ctx.setLineDash([6, 8]);
      ctx.beginPath(); ctx.moveTo(cannon.x, cannon.y - 18);
      ctx.lineTo(cannon.x + Math.sin(cannon.angle) * 220, cannon.y - 18 - Math.cos(cannon.angle) * 220); ctx.stroke();
      ctx.setLineDash([]);
    }

    // בועות
    for (const b of bubbles) {
      if (b.popped) continue;
      ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
      if (b.q && !b.answered) {
        ctx.save(); ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 14 + Math.sin(frame * 0.15) * 4;
        ctx.fillStyle = "#FFC93C"; ctx.fill(); ctx.restore();
        ctx.fillStyle = "#7a5200"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("?", b.x, b.y + 1); ctx.textBaseline = "alphabetic";
      } else {
        ctx.fillStyle = b.color; ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.35)"; ctx.beginPath(); ctx.arc(b.x - 5, b.y - 5, b.r * 0.32, 0, Math.PI * 2); ctx.fill();
      }
    }

    // חלקיקים
    for (const p of particles) { ctx.globalAlpha = Math.max(0, p.life / 35); ctx.fillStyle = p.color; ctx.fillRect(p.x - 2, p.y - 2, 4, 4); }
    ctx.globalAlpha = 1;

    // כדור
    if (projectile) { ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(projectile.x, projectile.y, projectile.r, 0, Math.PI * 2); ctx.fill(); }

    // תותח
    drawCannon();

    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#FFD700"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }

  function drawCannon() {
    const c = cannon;
    ctx.save(); ctx.translate(c.x, c.y - 18); ctx.rotate(c.angle);
    ctx.fillStyle = "#7f8c8d"; ctx.fillRect(-7, -34, 14, 36);          // קנה
    ctx.fillStyle = "#bdc3c7"; ctx.fillRect(-7, -34, 14, 6);
    ctx.restore();
    ctx.fillStyle = "#34495e"; ctx.beginPath(); ctx.arc(c.x, c.y - 14, 18, Math.PI, 0); ctx.fill();   // בסיס
    ctx.fillStyle = "#e74c3c"; ctx.beginPath(); ctx.arc(c.x, c.y - 14, 8, 0, Math.PI * 2); ctx.fill();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.5)"; ctx.fillRect(0, 0, canvas.width, 40);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("🪙 " + silver, 12, 20);
    const done = bubbles.filter(b => b.q && b.answered).length, tot = bubbles.filter(b => b.q).length;
    ctx.textAlign = "center"; ctx.fillText("❓ " + done + " / " + tot, canvas.width / 2, 20);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 20);
    ctx.textBaseline = "alphabetic";
  }

  function loop() { frame++; update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
