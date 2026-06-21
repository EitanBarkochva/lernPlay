/* ============================================================
   templerun.js  —  מנוע "ריצה אינסופית" (Temple Run) לימודי
   ממשק זהה לשאר המנועים: init / resume / stop / press / release /
   getSilverCoins / getCurrentLevel.
   הדמות רצה קדימה אוטומטית; השחקן מחליף מסלולים (◀▶), קופץ (▲/רווח)
   ומחליק (▼). אוספים מטבעות, נזהרים ממכשולים, ועונים על שערי שאלה (?).
   ============================================================ */

const TempleRunGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false, keys = {};
  let player, objects, activeGate;
  let silver = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0, count = 1;
  let start = 0, gatesSpawned = 0;
  let speed = 0.012, spawnTimer = 0, spawnGap = 26, spawnCounter = 0, gateEvery = 4;
  let lives = 3, hurtT = 0, frame = 0, floats = [], laneCooldown = 0, pLaneX = 0;

  // גיאומטריה (פרספקטיבה מדומה)
  let cx, horizonY, groundNearY, laneOff;

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
    coin: () => beep(880, 0.07, "sine"),
    jump: () => beep(520, 0.09, "square"),
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

    cx = canvas.width / 2;
    horizonY = 64;
    groundNearY = canvas.height - 26;
    laneOff = Math.min(150, canvas.width * 0.24);

    silver = 0; currentLevel = 1; answered = 0; lives = 3; floats = [];
    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  function buildLevel(n) {
    hurtT = 0; activeGate = null; objects = []; spawnCounter = 0; gatesSpawned = 0; answered = 0;
    spawnTimer = 40;
    speed = 0.011 + (n - 1) * 0.0018;
    spawnGap = Math.max(16, 28 - n);
    player = { lane: 1, jumpY: 0, vy: 0, jumping: false, sliding: 0, runFrame: 0 };
    pLaneX = cx;

    start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    count = Math.max(1, end - start);
  }

  function bindControls() {
    document.onkeydown = (e) => {
      if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", " "].includes(e.key)) { keys[e.key] = true; e.preventDefault(); }
    };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }
  function press(dir) { keys[dir] = true; }
  function release(dir) { keys[dir] = false; }

  /* ----- פרספקטיבה: מיקום על המסך לפי עומק z (0=קרוב, 1=רחוק) ולפי מסלול ----- */
  function laneNearX(lane) { return cx + (lane - 1) * laneOff; }
  function project(z, lane) {
    const nx = laneNearX(lane);
    return {
      x: cx + (nx - cx) * (1 - z),
      y: groundNearY - (groundNearY - horizonY) * z,
      scale: 1 - 0.8 * z
    };
  }
  function roadHalf(z) { return (laneOff * 1.5) * (1 - 0.82 * z); }

  function update() {
    if (paused) return;
    frame++; player.runFrame += 0.35;
    if (hurtT > 0) hurtT--;
    if (laneCooldown > 0) laneCooldown--;

    // החלפת מסלול
    if (keys.ArrowLeft && laneCooldown === 0) { player.lane = Math.max(0, player.lane - 1); laneCooldown = 9; }
    if (keys.ArrowRight && laneCooldown === 0) { player.lane = Math.min(2, player.lane + 1); laneCooldown = 9; }
    // קפיצה
    if ((keys.ArrowUp || keys[" "]) && !player.jumping && player.sliding <= 0) { player.jumping = true; player.vy = 7.2; sounds.jump(); }
    if (player.jumping) { player.jumpY += player.vy; player.vy -= 0.5; if (player.jumpY <= 0) { player.jumpY = 0; player.vy = 0; player.jumping = false; } }
    // החלקה
    if (keys.ArrowDown && !player.jumping && player.sliding <= 0) player.sliding = 30;
    if (player.sliding > 0) player.sliding--;

    // החלקת תנועה של המסלול
    const targetX = laneNearX(player.lane);
    pLaneX += (targetX - pLaneX) * 0.35;

    // ספאון אובייקטים
    spawnTimer--;
    if (spawnTimer <= 0) {
      spawnTimer = spawnGap;
      spawnCounter++;
      const gateOnScreen = objects.some(o => o.type === "gate");
      if (gatesSpawned < count && !gateOnScreen && spawnCounter % gateEvery === 0) {
        objects.push({ type: "gate", qi: start + gatesSpawned, z: 1, lane: 1 });
        gatesSpawned++;
      } else {
        const lane = (Math.random() * 3) | 0;
        const r = Math.random();
        if (r < 0.55) objects.push({ type: "coin", lane: lane, z: 1 });
        else if (r < 0.8) objects.push({ type: "low", lane: lane, z: 1 });
        else objects.push({ type: "high", lane: lane, z: 1 });
      }
    }

    // קידום אובייקטים + טיפול בהגעה לשחקן
    for (let i = objects.length - 1; i >= 0; i--) {
      const o = objects[i];
      o.z -= speed;
      if (o.z <= 0.02) {
        if (o.type === "gate") { paused = true; activeGate = o; if (onQuestion) onQuestion(o.qi); return; }
        if (o.lane === player.lane) {
          if (o.type === "coin") { silver++; sounds.coin(); floats.push({ x: pLaneX, y: groundNearY - 40, text: "+1", life: 40 }); }
          else if (o.type === "low" && player.jumpY < 22 && hurtT === 0) hurtPlayer();
          else if (o.type === "high" && player.sliding <= 0 && hurtT === 0) hurtPlayer();
        }
        objects.splice(i, 1);
      }
    }

    for (const t of floats) { t.y -= 0.8; t.life--; }
    floats = floats.filter(t => t.life > 0);
  }

  function hurtPlayer() {
    lives--; hurtT = 70; silver = Math.max(0, silver - 2); sounds.hurt();
    floats.push({ x: pLaneX, y: groundNearY - 50, text: "אוי!", life: 45 });
    if (lives <= 0) { lives = 3; hurtT = 110; floats.push({ x: cx, y: groundNearY - 80, text: "ממשיכים!", life: 70 }); }
  }

  function resume(correct) {
    if (correct) {
      if (activeGate) { answered++; sounds.correct(); floats.push({ x: pLaneX, y: groundNearY - 50, text: "✓", life: 50 }); }
    } else {
      sounds.wrong();
      if (activeGate) objects.push({ type: "gate", qi: activeGate.qi, z: 1, lane: 1 });   // אותה שאלה תחזור
    }
    if (activeGate) { const i = objects.indexOf(activeGate); if (i >= 0) objects.splice(i, 1); }
    activeGate = null; paused = false;
    if (answered >= count) nextLevel();
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ============================== ציור ============================== */
  function draw() {
    // שמיים
    const sky = ctx.createLinearGradient(0, 0, 0, horizonY + 40);
    sky.addColorStop(0, "#7ec8ff"); sky.addColorStop(1, "#dff3ff");
    ctx.fillStyle = sky; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // דשא
    ctx.fillStyle = "#5bbf52"; ctx.fillRect(0, horizonY, canvas.width, canvas.height - horizonY);

    // כביש (טרפז עם פרספקטיבה)
    const nH = roadHalf(0), fH = roadHalf(1);
    ctx.fillStyle = "#caa46a";
    ctx.beginPath();
    ctx.moveTo(cx - nH, groundNearY); ctx.lineTo(cx - fH, horizonY);
    ctx.lineTo(cx + fH, horizonY); ctx.lineTo(cx + nH, groundNearY);
    ctx.closePath(); ctx.fill();
    // שולי הכביש
    ctx.strokeStyle = "#8a6d3b"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(cx - nH, groundNearY); ctx.lineTo(cx - fH, horizonY); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + nH, groundNearY); ctx.lineTo(cx + fH, horizonY); ctx.stroke();

    // קווי הפרדה בין מסלולים (מנוקדים, נעים)
    ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 2;
    ctx.setLineDash([14, 16]); ctx.lineDashOffset = -(frame * 4) % 30;
    for (const lx of [-0.5, 0.5]) {
      const nearX = cx + lx * laneOff * 2, farX = cx;
      ctx.beginPath(); ctx.moveTo(nearX, groundNearY); ctx.lineTo(cx + (farX - cx) * 1 + lx * 0, horizonY); ctx.stroke();
    }
    ctx.setLineDash([]);

    // אובייקטים מהרחוק לקרוב
    const sorted = objects.slice().sort((a, b) => b.z - a.z);
    for (const o of sorted) drawObject(o);

    // שחקן
    drawRunner();

    // טקסטים מרחפים
    for (const t of floats) {
      ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#FFD700";
      ctx.font = "bold 18px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawObject(o) {
    const p = project(o.z, o.lane);
    if (o.type === "coin") {
      const r = 11 * p.scale;
      ctx.fillStyle = "#FFC400"; ctx.beginPath(); ctx.arc(p.x, p.y - 16 * p.scale, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#FFE680"; ctx.beginPath(); ctx.arc(p.x, p.y - 16 * p.scale, r * 0.55, 0, Math.PI * 2); ctx.fill();
    } else if (o.type === "low") {
      const w = 46 * p.scale, h = 20 * p.scale;
      ctx.fillStyle = "#7a4a1e"; ctx.fillRect(p.x - w / 2, p.y - h, w, h);
      ctx.strokeStyle = "#5a3414"; ctx.lineWidth = 2; ctx.strokeRect(p.x - w / 2, p.y - h, w, h);
    } else if (o.type === "high") {
      const w = 50 * p.scale, h = 12 * p.scale, gap = 42 * p.scale;
      ctx.fillStyle = "#b03030"; ctx.fillRect(p.x - w / 2, p.y - gap - h, w, h);
      ctx.fillStyle = "#7a1f1f"; ctx.fillRect(p.x - 4 * p.scale, p.y - gap - h, 8 * p.scale, gap);
    } else if (o.type === "gate") {
      const half = roadHalf(o.z), top = p.y - 70 * p.scale;
      ctx.fillStyle = "#6C5CE7"; ctx.fillRect(cx - half, top, half * 2, 26 * p.scale);
      ctx.fillStyle = "#fff"; ctx.font = "bold " + Math.round(26 * p.scale) + "px Arial";
      ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText("?", cx, top + 13 * p.scale);
      ctx.textBaseline = "alphabetic";
      // עמודי השער
      ctx.fillStyle = "#4a3fb0"; ctx.fillRect(cx - half, top, 7 * p.scale, p.y - top);
      ctx.fillStyle = "#4a3fb0"; ctx.fillRect(cx + half - 7 * p.scale, top, 7 * p.scale, p.y - top);
    }
  }

  function drawRunner() {
    if (hurtT > 0 && Math.floor(frame / 4) % 2 === 0) return;
    const x = pLaneX, baseY = groundNearY - player.jumpY;
    const sliding = player.sliding > 0;
    const bodyH = sliding ? 16 : 34, bodyW = sliding ? 30 : 20;
    // צל
    ctx.fillStyle = "rgba(0,0,0,0.2)"; ctx.beginPath();
    ctx.ellipse(x, groundNearY + 2, 18, 6, 0, 0, Math.PI * 2); ctx.fill();
    // רגליים (מתנדנדות)
    if (!sliding) {
      const sw = Math.sin(player.runFrame) * 7;
      ctx.strokeStyle = "#2c3e50"; ctx.lineWidth = 6; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x - 5 + sw, baseY + 16); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x, baseY); ctx.lineTo(x + 5 - sw, baseY + 16); ctx.stroke();
    }
    // גוף
    ctx.fillStyle = "#e74c3c"; ctx.fillRect(x - bodyW / 2, baseY - bodyH, bodyW, bodyH);
    // ידיים
    if (!sliding) {
      const aw = Math.sin(player.runFrame) * 6;
      ctx.strokeStyle = "#e67e22"; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.moveTo(x - bodyW / 2, baseY - bodyH + 8); ctx.lineTo(x - bodyW / 2 - 6, baseY - bodyH + 14 - aw); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + bodyW / 2, baseY - bodyH + 8); ctx.lineTo(x + bodyW / 2 + 6, baseY - bodyH + 14 + aw); ctx.stroke();
    }
    // ראש
    ctx.fillStyle = "#ffd9a0"; ctx.beginPath();
    ctx.arc(x, baseY - bodyH - (sliding ? 4 : 10), 10, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5a3414"; ctx.fillRect(x - 10, baseY - bodyH - (sliding ? 12 : 18), 20, 6);
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, canvas.width, 38);
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
