/* ============================================================
   climber.js  —  מנוע "טיפוס קפיצות" לימודי (Doodle Jump)
   ממשק זהה לשאר המנועים. ◀▶ לתזוזה, קופצים אוטומטית על משטחים.
   נחיתה על משטח-שאלה (?) פותחת שאלה; אוספים מטבעות ומטפסים.
   ============================================================ */

const ClimberGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};
  let player, platforms, coins, activeP, qActive;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1, start = 0;
  let lives = 3, hurtT = 0, frame = 0, floats = [], sincePlat = 0;
  const GAP = 78, PW = 70;

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
    jump: () => beep(520, 0.06, "square"), coin: () => beep(880, 0.07, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"), hurt: () => beep(110, 0.35, "sawtooth")
  };

  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;
    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);
    silver = 0; currentLevel = 1; answered = 0; lives = 3; floats = [];
    buildLevel(currentLevel); bindControls(); paused = false; loop();
  }

  function buildLevel(n) {
    hurtT = 0; activeP = null; answered = 0; sincePlat = 0;
    platforms = []; coins = [];
    // משטח התחלה למטה + סולם משטחים למעלה
    platforms.push({ x: canvas.width / 2 - PW / 2, y: canvas.height - 40, q: null });
    for (let y = canvas.height - 40 - GAP; y > -GAP; y -= GAP) addPlatform(y);
    player = { x: canvas.width / 2, y: canvas.height - 70, vy: 0, w: 30, h: 30 };
    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
  }

  function addPlatform(y) {
    const x = 10 + Math.random() * (canvas.width - PW - 20);
    let q = null;
    const haveQ = platforms.some(p => p.q !== null && !p.done);
    sincePlat++;
    if (!haveQ && answered < count && sincePlat >= 3) { q = start + answered; sincePlat = 0; }
    const p = { x: x, y: y, q: q, done: false };
    platforms.push(p);
    if (q === null && Math.random() < 0.5) coins.push({ x: x + PW / 2, y: y - 24, taken: false });
    return p;
  }

  function bindControls() {
    document.onkeydown = (e) => { if (["ArrowLeft", "ArrowRight"].includes(e.key)) { keys[e.key] = true; e.preventDefault(); } };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(d) { keys[d] = true; } function release(d) { keys[d] = false; }

  function update() {
    if (paused) return;
    frame++; if (hurtT > 0) hurtT--;
    if (keys.ArrowLeft) player.x -= 5;
    if (keys.ArrowRight) player.x += 5;
    if (player.x < -player.w) player.x = canvas.width;          // גלישה אופקית
    if (player.x > canvas.width) player.x = -player.w;

    player.vy += 0.4; player.y += player.vy;

    // נחיתה על משטח
    if (player.vy > 0) {
      for (const p of platforms) {
        if (p.done) continue;
        if (player.x + player.w / 2 > p.x && player.x - player.w / 2 < p.x + PW &&
            player.y + player.h / 2 >= p.y && player.y + player.h / 2 <= p.y + 18) {
          if (p.q !== null) { paused = true; activeP = p; player.y = p.y - player.h / 2; player.vy = 0; if (onQuestion) onQuestion(p.q); return; }
          player.vy = -10.5; sounds.jump();
        }
      }
    }
    // איסוף מטבעות
    for (const co of coins) if (!co.taken && Math.hypot(co.x - player.x, co.y - player.y) < 22) { co.taken = true; silver++; sounds.coin(); floats.push({ x: co.x, y: co.y, text: "+1", life: 35 }); }

    // גלילת מצלמה כשעולים
    const thr = canvas.height * 0.4;
    if (player.y < thr) {
      const shift = thr - player.y; player.y = thr;
      for (const p of platforms) p.y += shift;
      for (const co of coins) co.y += shift;
      // הסרה למטה + הוספה למעלה
      platforms = platforms.filter(p => p.y < canvas.height + 30);
      coins = coins.filter(co => co.y < canvas.height + 30 && !co.taken);
      let top = Math.min(...platforms.map(p => p.y));
      while (top > 0) { top -= GAP; addPlatform(top); }
    }

    // נפילה
    if (player.y > canvas.height + 20 && hurtT === 0) hurtPlayer();

    for (const t of floats) { t.y -= 0.7; t.life--; } floats = floats.filter(t => t.life > 0);
  }

  function hurtPlayer() {
    lives--; hurtT = 60; silver = Math.max(0, silver - 2); sounds.hurt();
    // מציבים את השחקן על משטח קיים נמוך
    let low = platforms.reduce((a, p) => (!p.done && p.y > (a ? a.y : -1) && p.y < canvas.height) ? p : a, null) || platforms[0];
    player.x = low.x + PW / 2; player.y = low.y - player.h / 2; player.vy = -10.5;
    if (lives <= 0) { lives = 3; hurtT = 100; floats.push({ x: canvas.width / 2, y: canvas.height / 2, text: "ממשיכים!", life: 70 }); }
  }

  function resume(correct) {
    if (correct) { answered++; sounds.correct(); if (activeP) activeP.done = true; floats.push({ x: player.x, y: player.y - 20, text: "✓", life: 50 }); }
    else { sounds.wrong(); }
    if (activeP) { activeP.q = null; }      // המשטח הופך רגיל כדי שאפשר לקפוץ ממנו
    player.vy = -10.5; sounds.jump();
    activeP = null; paused = false;
    if (answered >= count) nextLevel();
  }
  function nextLevel() { if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); } else { currentLevel++; buildLevel(currentLevel); } }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#c8b6ff"); g.addColorStop(1, "#e8dcff");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // משטחים
    for (const p of platforms) {
      if (p.q !== null) {
        ctx.fillStyle = "#6C5CE7"; roundRect(p.x, p.y, PW, 14, 7); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", p.x + PW / 2, p.y + 8); ctx.textBaseline = "alphabetic";
      } else {
        ctx.fillStyle = p.done ? "#9aa6b2" : "#2ecc71"; roundRect(p.x, p.y, PW, 14, 7); ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,0.4)"; ctx.fillRect(p.x + 4, p.y + 2, PW - 8, 3);
      }
    }
    // מטבעות
    for (const co of coins) if (!co.taken) { ctx.fillStyle = "#FFC400"; ctx.beginPath(); ctx.arc(co.x, co.y, 9, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#FFF0A6"; ctx.beginPath(); ctx.arc(co.x - 3, co.y - 3, 3, 0, Math.PI * 2); ctx.fill(); }
    // שחקן
    if (!(hurtT > 0 && Math.floor(frame / 4) % 2 === 0)) {
      if (!(window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, player.x, player.y, player.h + 8))) {
        ctx.fillStyle = "#e67e22"; roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 8); ctx.fill();
        ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(player.x - 6, player.y - 4, 4, 0, Math.PI * 2); ctx.arc(player.x + 6, player.y - 4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#222"; ctx.beginPath(); ctx.arc(player.x - 6, player.y - 4, 1.8, 0, Math.PI * 2); ctx.arc(player.x + 6, player.y - 4, 1.8, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#222"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(player.x, player.y + 4, 5, 0.1 * Math.PI, 0.9 * Math.PI); ctx.stroke();
      }
    }
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#6C5CE7"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, canvas.width, 38);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("🪙 " + silver, 12, 19);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 19); ctx.textBaseline = "alphabetic";
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
