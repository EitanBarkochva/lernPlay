/* ============================================================
   flappy.js  —  מנוע "ציפור מעופפת" לימודי (Flappy)
   ממשק זהה לשאר המנועים. לוחצים (רווח / ▲ / כפתור) כדי לעוף,
   עוברים בין צינורות, אוספים מטבעות ועונים על שערי שאלה (?).
   ============================================================ */

const FlappyGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {}, flapPrev = false;
  let bird, objects, activeGate;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1;
  let start = 0, gatesSpawned = 0, speed = 2.4, spawnTimer = 0, spawnGap = 95, spawnCounter = 0, gateEvery = 3;
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
    flap: () => beep(560, 0.07, "square"),
    coin: () => beep(880, 0.07, "sine"),
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
    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  function buildLevel(n) {
    hurtT = 0; activeGate = null; objects = []; spawnCounter = 0; gatesSpawned = 0; answered = 0;
    spawnTimer = 50; speed = 2.2 + (n - 1) * 0.25; spawnGap = Math.max(70, 100 - n * 4);
    bird = { x: canvas.width * 0.28, y: canvas.height / 2, vy: 0, w: 30, h: 24 };
    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
  }

  function bindControls() {
    document.onkeydown = (e) => { if ([" ", "ArrowUp"].includes(e.key)) { keys[e.key] = true; e.preventDefault(); } };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(dir) { keys[dir] = true; }
  function release(dir) { keys[dir] = false; }

  function update() {
    if (paused) return;
    frame++;
    if (hurtT > 0) hurtT--;

    // נפנוף — מופעל בלחיצה (edge), לא בהחזקה
    const flapDown = !!(keys[" "] || keys.ArrowUp);
    if (flapDown && !flapPrev) { bird.vy = -6.6; sounds.flap(); }
    flapPrev = flapDown;

    bird.vy += 0.42; bird.y += bird.vy;
    // תקרה ורצפה
    if (bird.y < bird.h / 2) { bird.y = bird.h / 2; bird.vy = 0; }
    if (bird.y > canvas.height - bird.h / 2) { bird.y = canvas.height - bird.h / 2; if (hurtT === 0) hurtPlayer(); }

    // ספאון
    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnTimer = spawnGap; spawnCounter++;
      const gateOnScreen = objects.some(o => o.type === "gate");
      if (gatesSpawned < count && !gateOnScreen && spawnCounter % gateEvery === 0) {
        objects.push({ type: "gate", x: canvas.width + 30, qi: start + gatesSpawned }); gatesSpawned++;
      } else {
        const gapH = Math.max(120, 170 - currentLevel * 6);
        const gapY = 60 + Math.random() * (canvas.height - 120 - gapH);
        objects.push({ type: "pipe", x: canvas.width + 30, gapY: gapY, gapH: gapH, w: 46 });
        if (Math.random() < 0.6) objects.push({ type: "coin", x: canvas.width + 30 + 23, y: gapY + gapH / 2, taken: false });
      }
    }

    // קידום וטיפול
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      o.x -= speed;
      if (o.type === "gate") {
        if (o.x <= bird.x) { paused = true; activeGate = o; if (onQuestion) onQuestion(o.qi); return; }
      } else if (o.type === "coin") {
        if (!o.taken && Math.hypot(o.x - bird.x, o.y - bird.y) < 22) { o.taken = true; silver++; sounds.coin(); floats.push({ x: bird.x, y: bird.y - 20, text: "+1", life: 40 }); }
      } else if (o.type === "pipe") {
        if (hurtT === 0 && bird.x + bird.w / 2 > o.x && bird.x - bird.w / 2 < o.x + o.w) {
          if (bird.y - bird.h / 2 < o.gapY || bird.y + bird.h / 2 > o.gapY + o.gapH) hurtPlayer();
        }
      }
      if (o.x < -60) objects.splice(i, 1);
    }

    for (const t of floats) { t.y -= 0.8; t.life--; }
    floats = floats.filter(t => t.life > 0);
  }

  function hurtPlayer() {
    lives--; hurtT = 70; silver = Math.max(0, silver - 2); sounds.hurt();
    bird.y = canvas.height / 2; bird.vy = 0;
    floats.push({ x: bird.x, y: bird.y - 40, text: "אוי!", life: 45 });
    if (lives <= 0) { lives = 3; hurtT = 110; floats.push({ x: canvas.width / 2, y: 80, text: "ממשיכים!", life: 70 }); }
  }

  function resume(correct) {
    if (correct) { if (activeGate) { answered++; sounds.correct(); floats.push({ x: bird.x, y: bird.y - 30, text: "✓", life: 50 }); } }
    else { sounds.wrong(); if (activeGate) objects.push({ type: "gate", x: canvas.width + 30, qi: activeGate.qi }); }
    if (activeGate) { const i = objects.indexOf(activeGate); if (i >= 0) objects.splice(i, 1); }
    activeGate = null; paused = false; bird.vy = 0;
    if (answered >= count) nextLevel();
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ============================== ציור ============================== */
  function draw() {
    const sky = ctx.createLinearGradient(0, 0, 0, canvas.height);
    sky.addColorStop(0, "#7ec8ff"); sky.addColorStop(1, "#dff3ff");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // עננים
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (let i = 0; i < 4; i++) { const cxp = (canvas.width - ((frame * 0.5 + i * 220) % (canvas.width + 120))); const cy = 50 + i * 40; ctx.beginPath(); ctx.arc(cxp, cy, 18, 0, Math.PI * 2); ctx.arc(cxp + 18, cy + 4, 14, 0, Math.PI * 2); ctx.arc(cxp - 16, cy + 4, 13, 0, Math.PI * 2); ctx.fill(); }
    // קרקע
    ctx.fillStyle = "#5bbf52"; ctx.fillRect(0, canvas.height - 10, canvas.width, 10);

    for (const o of objects) drawObject(o);
    drawBird();

    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#FFD700"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }

  function drawObject(o) {
    if (o.type === "pipe") {
      ctx.fillStyle = "#3aa54a"; ctx.strokeStyle = "#2c7d38"; ctx.lineWidth = 3;
      ctx.fillRect(o.x, 0, o.w, o.gapY); ctx.strokeRect(o.x, 0, o.w, o.gapY);
      ctx.fillRect(o.x, o.gapY + o.gapH, o.w, canvas.height - o.gapY - o.gapH); ctx.strokeRect(o.x, o.gapY + o.gapH, o.w, canvas.height - o.gapY - o.gapH);
      // שפתי הצינור
      ctx.fillStyle = "#46b85a"; ctx.fillRect(o.x - 4, o.gapY - 14, o.w + 8, 14); ctx.fillRect(o.x - 4, o.gapY + o.gapH, o.w + 8, 14);
    } else if (o.type === "coin") {
      if (o.taken) return;
      ctx.fillStyle = "#FFC400"; ctx.beginPath(); ctx.arc(o.x, o.y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFF0A6"; ctx.beginPath(); ctx.arc(o.x - 3, o.y - 3, 4, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === "gate") {
      ctx.fillStyle = "rgba(108,92,231,0.25)"; ctx.fillRect(o.x - 4, 0, 8, canvas.height);
      ctx.fillStyle = "#6C5CE7"; const ry = canvas.height / 2 - 22;
      ctx.fillRect(o.x - 24, ry, 48, 44);
      ctx.fillStyle = "#fff"; ctx.font = "bold 26px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", o.x, ry + 23); ctx.textBaseline = "alphabetic";
    }
  }

  function drawBird() {
    if (hurtT > 0 && Math.floor(frame / 4) % 2 === 0) return;
    const b = bird, tilt = Math.max(-0.4, Math.min(0.7, b.vy * 0.06));
    if (window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, b.x, b.y, b.h + 12)) return;
    ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(tilt);
    // גוף
    ctx.fillStyle = "#FFD11A"; ctx.beginPath(); ctx.ellipse(0, 0, b.w / 2, b.h / 2, 0, 0, Math.PI * 2); ctx.fill();
    // כנף
    ctx.fillStyle = "#f0a500"; const wf = Math.sin(frame * 0.5) * 5;
    ctx.beginPath(); ctx.ellipse(-4, 2 + wf * 0.2, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
    // עין
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(8, -4, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(9, -4, 2, 0, Math.PI * 2); ctx.fill();
    // מקור
    ctx.fillStyle = "#e8731a"; ctx.beginPath(); ctx.moveTo(b.w / 2 - 2, 0); ctx.lineTo(b.w / 2 + 7, -3); ctx.lineTo(b.w / 2 + 7, 3); ctx.fill();
    ctx.restore();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.fillRect(0, 0, canvas.width, 38);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("🪙 " + silver, 12, 19);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 19);
    ctx.textBaseline = "alphabetic";
    for (let i = 0; i < 3; i++) drawHeart(canvas.width / 2 - 26 + i * 20, 11, 7, i < lives);
  }
  function drawHeart(x, y, s, filled) {
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.3);
    ctx.bezierCurveTo(x, y, x - s, y, x - s, y + s * 0.4);
    ctx.bezierCurveTo(x - s, y + s, x, y + s * 1.1, x, y + s * 1.4);
    ctx.bezierCurveTo(x, y + s * 1.1, x + s, y + s, x + s, y + s * 0.4);
    ctx.bezierCurveTo(x + s, y, x, y, x, y + s * 0.3);
    ctx.closePath(); ctx.fillStyle = filled ? "#E53935" : "rgba(255,255,255,0.25)"; ctx.fill();
  }

  function loop() { update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
