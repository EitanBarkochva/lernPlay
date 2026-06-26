/* ============================================================
   hoops.js  —  מנוע "קליעה לסל" לימודי (Basketball)
   ממשק זהה לשאר המנועים. ◀▶ להזזת השחקן, רווח/▲ לזריקה.
   קולעים לסל שעליו "?" כדי לפתוח שאלה ולאסוף מטבעות.
   ============================================================ */

const HoopsGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {}, shootPrev = false;
  let player, hoop, ball, activeQ;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1, start = 0;
  let lives = 3, frame = 0, floats = [];

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
    shoot: () => beep(440, 0.06, "square"), score: () => beep(880, 0.1, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"), miss: () => beep(200, 0.12, "sawtooth")
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
    activeQ = null; answered = 0;
    player = { x: canvas.width / 2, w: 56, speed: 5 };
    hoop = { x: canvas.width / 2, y: 98, w: 70, dir: 1, spd: 1.4 + n * 0.4 };
    ball = null;
    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
  }

  function bindControls() {
    document.onkeydown = (e) => { if (["ArrowLeft", "ArrowRight", "ArrowUp", " "].includes(e.key)) { keys[e.key] = true; e.preventDefault(); } };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(d) { keys[d] = true; } function release(d) { keys[d] = false; }

  function update() {
    if (paused) return;
    frame++;
    if (keys.ArrowLeft) player.x -= player.speed;
    if (keys.ArrowRight) player.x += player.speed;
    player.x = Math.max(player.w / 2, Math.min(canvas.width - player.w / 2, player.x));

    // סל נע
    hoop.x += hoop.dir * hoop.spd;
    if (hoop.x < hoop.w / 2 + 10) { hoop.x = hoop.w / 2 + 10; hoop.dir = 1; }
    if (hoop.x > canvas.width - hoop.w / 2 - 10) { hoop.x = canvas.width - hoop.w / 2 - 10; hoop.dir = -1; }

    // זריקה (edge)
    const sd = !!(keys[" "] || keys.ArrowUp);
    if (sd && !shootPrev && !ball) { ball = { x: player.x, y: canvas.height - 60, vy: -11, vx: 0 }; sounds.shoot(); }
    shootPrev = sd;

    if (ball) {
      ball.y += ball.vy; ball.x += ball.vx; ball.vy += 0.18;
      // הגעה לגובה הסל
      if (ball.vy < 0 && ball.y <= hoop.y + 6 && ball.y >= hoop.y - 6) {
        if (Math.abs(ball.x - hoop.x) < hoop.w / 2 - 6) { onScore(); ball = null; }
      }
      if (ball && (ball.y > canvas.height + 30 || ball.y < -30)) { if (ball.y < -30) sounds.miss(); ball = null; }
    }
    for (const t of floats) { t.y -= 0.8; t.life--; } floats = floats.filter(t => t.life > 0);
  }

  function onScore() {
    silver++; sounds.score();
    floats.push({ x: hoop.x, y: hoop.y + 20, text: "סל! +1", life: 45 });
    paused = true; activeQ = true; if (onQuestion) onQuestion(start + answered);
  }

  function resume(correct) {
    if (correct) { answered++; sounds.correct(); floats.push({ x: canvas.width / 2, y: canvas.height / 2, text: "✓", life: 50 }); }
    else { sounds.wrong(); }
    activeQ = null; paused = false; ball = null;
    if (answered >= count) nextLevel();
  }
  function nextLevel() { if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); } else { currentLevel++; buildLevel(currentLevel); } }

  function draw() {
    const g = ctx.createLinearGradient(0, 0, 0, canvas.height);
    g.addColorStop(0, "#ffe2b0"); g.addColorStop(1, "#f5c27a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // רצפת פרקט
    ctx.fillStyle = "#d99a52"; ctx.fillRect(0, canvas.height - 34, canvas.width, 34);
    ctx.strokeStyle = "rgba(255,255,255,0.4)"; ctx.beginPath(); ctx.moveTo(0, canvas.height - 34); ctx.lineTo(canvas.width, canvas.height - 34); ctx.stroke();

    // לוח + סל
    ctx.fillStyle = "#fff"; ctx.fillRect(hoop.x - 36, hoop.y - 40, 72, 30);
    ctx.strokeStyle = "#e74c3c"; ctx.lineWidth = 3; ctx.strokeRect(hoop.x - 16, hoop.y - 30, 32, 18);
    // טבעת
    ctx.strokeStyle = "#e8731a"; ctx.lineWidth = 5; ctx.beginPath(); ctx.ellipse(hoop.x, hoop.y, hoop.w / 2, 7, 0, 0, Math.PI * 2); ctx.stroke();
    // רשת
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1.5;
    for (let i = -2; i <= 2; i++) { ctx.beginPath(); ctx.moveTo(hoop.x + i * 12, hoop.y + 2); ctx.lineTo(hoop.x + i * 6, hoop.y + 22); ctx.stroke(); }
    // "?" על הסל
    ctx.fillStyle = "#6C5CE7"; ctx.beginPath(); ctx.arc(hoop.x, hoop.y - 52, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 20px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", hoop.x, hoop.y - 51); ctx.textBaseline = "alphabetic";

    // כדור
    if (ball) { ctx.fillStyle = "#e8731a"; ctx.beginPath(); ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2); ctx.fill(); ctx.strokeStyle = "#8a3f10"; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(ball.x, ball.y, 12, 0, Math.PI * 2); ctx.moveTo(ball.x - 12, ball.y); ctx.lineTo(ball.x + 12, ball.y); ctx.moveTo(ball.x, ball.y - 12); ctx.lineTo(ball.x, ball.y + 12); ctx.stroke(); }

    // שחקן
    const px = player.x, py = canvas.height - 34;
    if (!(window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, px, py - 24, 48))) {
      ctx.fillStyle = "#e74c3c"; roundRect(px - 14, py - 38, 28, 32, 6); ctx.fill();
      ctx.fillStyle = "#ffd9a0"; ctx.beginPath(); ctx.arc(px, py - 46, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#2c3e50"; ctx.fillRect(px - 12, py - 8, 10, 10); ctx.fillRect(px + 2, py - 8, 10, 10);
    }
    for (const t of floats) { ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#c0392b"; ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y); }
    ctx.globalAlpha = 1;
  }
  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, canvas.width, 38);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle"; ctx.fillText("🏀 " + silver, 12, 19);
    ctx.textAlign = "right"; ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 19); ctx.textBaseline = "alphabetic";
    ctx.textAlign = "center"; ctx.fillStyle = "#ffe"; ctx.font = "13px Arial"; ctx.fillText("ענו על " + answered + "/" + count, canvas.width / 2, 19);
  }

  function loop() { update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silver; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
