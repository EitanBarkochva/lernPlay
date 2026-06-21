/* ============================================================
   pacman.js  —  מנוע משחק פאקמן לימודי
   אותו ממשק ציבורי כמו MarioGame (init/resume/stop/press/
   release/getSilverCoins/getCurrentLevel) ואותה לוגיקה:
   שאלות משובצות במבוך, איסוף נקודות, רוחות (אויבים), חיים ושלבים.
   ============================================================ */

const PacmanGame = (function () {
  let canvas, ctx, game, onQuestion, onLevelComplete;
  let animationId = null, paused = false;
  let keys = {};

  // ----- מבוך (#=קיר, .=נקודה, רווח=ריק) -----
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
  const TILE = 28, OFFY = 44, SPEED = 2.8, GHOST_SPEED = 2.2;

  const DELTA = { ArrowRight: [1, 0], ArrowLeft: [-1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  const REVERSE = { ArrowRight: "ArrowLeft", ArrowLeft: "ArrowRight", ArrowUp: "ArrowDown", ArrowDown: "ArrowUp" };

  let pac, ghosts, eaten, questionPellets, activeQ;
  let silverCoins = 0, currentLevel = 1, totalLevels = 1, perLevel = 5, answered = 0;
  let lives = 3, hurtT = 0, frame = 0, floatTexts = [];

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
    waka: () => beep(420, 0.05, "square"),
    coin: () => beep(880, 0.08, "sine"),
    correct: () => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong: () => beep(150, 0.3, "sawtooth"),
    hurt: () => beep(120, 0.35, "sawtooth")
  };

  // ----- עזר גריד -----
  const cx = c => c * TILE + TILE / 2;
  const cy = r => OFFY + r * TILE + TILE / 2;
  function isWall(c, r) { return r < 0 || r >= ROWS || c < 0 || c >= COLS || MAZE[r][c] === "#"; }
  function canMove(c, r, dir) { const d = DELTA[dir]; return d && !isWall(c + d[0], r + d[1]); }
  function approach(a, b, s) { return Math.abs(b - a) <= s ? b : a + Math.sign(b - a) * s; }

  /* ------------------------------------------------------------
     init(config) - אתחול המשחק.
     ------------------------------------------------------------ */
  function init(config) {
    canvas = config.canvas; ctx = canvas.getContext("2d");
    game = config.game; onQuestion = config.onQuestion; onLevelComplete = config.onLevelComplete;
    canvas.width = COLS * TILE;
    canvas.height = OFFY + ROWS * TILE;

    const totalQ = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0) ? Math.min(game.levels, totalQ) : Math.ceil(totalQ / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQ / totalLevels);

    silverCoins = 0; currentLevel = 1; answered = 0; lives = 3; floatTexts = [];
    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  /* ----- בניית שלב: נקודות, תיבות שאלה ורוחות ----- */
  function buildLevel(n) {
    hurtT = 0; activeQ = null;
    // נקודות בכל תא פתוח
    eaten = {};
    // מיקום פתיחה לפאקמן
    pac = { col: 10, row: 11, x: cx(10), y: cy(11), dir: null, nextDir: null, tcol: 10, trow: 11, moving: false };

    // תיבות שאלה - אחת לכל שאלה בשלב, על מסדרון פתוח (שורה 3)
    const start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    const cols = [2, 6, 10, 14, 18];
    questionPellets = [];
    for (let i = 0; i < end - start; i++) {
      questionPellets.push({ col: cols[i % cols.length], row: 3, questionIndex: start + i, answered: false });
    }

    // רוחות (אויבים) - מספרן גדל עם השלבים
    const gn = Math.min(1 + Math.floor((currentLevel - 1) / 1), 4);
    const spots = [[10, 5], [10, 7], [4, 9], [16, 9]];
    ghosts = [];
    const colorsArr = ["#FF4040", "#FFB8FF", "#00FFFF", "#FFB852"];
    for (let i = 0; i < gn; i++) {
      const s = spots[i % spots.length];
      ghosts.push({ col: s[0], row: s[1], x: cx(s[0]), y: cy(s[1]), dir: "ArrowLeft", tcol: s[0], trow: s[1], moving: false, color: colorsArr[i % 4] });
    }
  }

  function bindControls() {
    document.onkeydown = (e) => {
      if (DELTA[e.key]) { keys = {}; pac.nextDir = e.key; e.preventDefault(); }
    };
    document.onkeyup = () => {};
  }
  function press(dir) { if (DELTA[dir] && pac) pac.nextDir = dir; }
  function release() { /* בפאקמן ממשיכים לזוז עד קיר */ }

  /* ------------------------------------------------------------
     update() - תנועה ולוגיקה.
     ------------------------------------------------------------ */
  function update() {
    if (paused) return;
    if (hurtT > 0) hurtT--;

    // תנועת פאקמן (צעד-בין-תאים)
    if (!pac.moving) {
      if (pac.nextDir && canMove(pac.col, pac.row, pac.nextDir)) pac.dir = pac.nextDir;
      if (pac.dir && canMove(pac.col, pac.row, pac.dir)) {
        const d = DELTA[pac.dir]; pac.tcol = pac.col + d[0]; pac.trow = pac.row + d[1]; pac.moving = true;
      }
    }
    if (pac.moving) {
      const tx = cx(pac.tcol), ty = cy(pac.trow);
      pac.x = approach(pac.x, tx, SPEED); pac.y = approach(pac.y, ty, SPEED);
      if (pac.x === tx && pac.y === ty) { pac.col = pac.tcol; pac.row = pac.trow; pac.moving = false; onArrive(); }
    }

    // תנועת רוחות
    for (const g of ghosts) {
      if (!g.moving) {
        const opts = Object.keys(DELTA).filter(dir => canMove(g.col, g.row, dir) && dir !== REVERSE[g.dir]);
        const list = opts.length ? opts : Object.keys(DELTA).filter(dir => canMove(g.col, g.row, dir));
        if (list.length) { g.dir = list[Math.floor(Math.random() * list.length)]; const d = DELTA[g.dir]; g.tcol = g.col + d[0]; g.trow = g.row + d[1]; g.moving = true; }
      }
      if (g.moving) {
        const tx = cx(g.tcol), ty = cy(g.trow);
        g.x = approach(g.x, tx, GHOST_SPEED); g.y = approach(g.y, ty, GHOST_SPEED);
        if (g.x === tx && g.y === ty) { g.col = g.tcol; g.row = g.trow; g.moving = false; }
      }
      // התנגשות עם פאקמן
      if (hurtT === 0 && Math.hypot(g.x - pac.x, g.y - pac.y) < TILE * 0.7) hurtPlayer();
    }

    // טקסטים מרחפים
    for (const t of floatTexts) { t.y -= 0.8; t.life--; }
    floatTexts = floatTexts.filter(t => t.life > 0);
  }

  /* ----- הגעה לתא: אכילת נקודה / פתיחת שאלה ----- */
  function onArrive() {
    // תיבת שאלה?
    const q = questionPellets.find(p => !p.answered && p.col === pac.col && p.row === pac.row);
    if (q) { paused = true; activeQ = q; if (onQuestion) onQuestion(q.questionIndex); return; }
    // נקודה רגילה?
    const key = pac.col + "," + pac.row;
    if (MAZE[pac.row][pac.col] === "." && !eaten[key] && !questionPellets.some(p => p.col === pac.col && p.row === pac.row)) {
      eaten[key] = true; silverCoins++; sounds.waka();
    }
  }

  /* ----- פגיעה ברוח ----- */
  function hurtPlayer() {
    lives--; hurtT = 90; silverCoins = Math.max(0, silverCoins - 2); sounds.hurt();
    // החזרה למיקום פתיחה
    pac.col = 10; pac.row = 11; pac.x = cx(10); pac.y = cy(11); pac.moving = false; pac.dir = null; pac.nextDir = null;
    ghosts.forEach((g, i) => { const s = [[10, 5], [10, 7], [4, 9], [16, 9]][i % 4]; g.col = s[0]; g.row = s[1]; g.x = cx(s[0]); g.y = cy(s[1]); g.moving = false; });
    if (lives <= 0) { lives = 3; hurtT = 120; floatTexts.push({ x: pac.x, y: pac.y, text: "התחלה מחדש", life: 70 }); }
  }

  /* ------------------------------------------------------------
     resume(correct) - חזרה אחרי שאלה (אותה לוגיקה כמו מריו).
     ------------------------------------------------------------ */
  function resume(correct) {
    if (correct) {
      if (activeQ) { activeQ.answered = true; answered++; sounds.correct(); floatTexts.push({ x: pac.x, y: pac.y, text: "✓", life: 50 }); }
    } else {
      sounds.wrong();
      // מזיזים את פאקמן אחורה כדי שלא ייפתח שוב מיד
      const rev = REVERSE[pac.dir];
      if (rev && canMove(pac.col, pac.row, rev)) { const d = DELTA[rev]; pac.col += d[0]; pac.row += d[1]; pac.x = cx(pac.col); pac.y = cy(pac.row); }
      pac.moving = false; pac.dir = null; pac.nextDir = null;
    }
    activeQ = null; paused = false;
    if (questionPellets.length && questionPellets.every(p => p.answered)) nextLevel();
  }

  function nextLevel() {
    if (currentLevel >= totalLevels) { stop(); if (onLevelComplete) onLevelComplete(); }
    else { currentLevel++; buildLevel(currentLevel); }
  }

  /* ------------------------------------------------------------
     ציור
     ------------------------------------------------------------ */
  function draw() {
    ctx.fillStyle = "#0a0a1a"; ctx.fillRect(0, 0, canvas.width, canvas.height);

    // קירות
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "#") {
        ctx.fillStyle = "#1f3bb3";
        roundRect(c * TILE + 2, OFFY + r * TILE + 2, TILE - 4, TILE - 4, 6); ctx.fill();
        ctx.fillStyle = "#3a5bd6";
        roundRect(c * TILE + 5, OFFY + r * TILE + 5, TILE - 10, TILE - 10, 4); ctx.fill();
      }
    }
    // נקודות
    ctx.fillStyle = "#FFE08A";
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      if (MAZE[r][c] === "." && !eaten[c + "," + r] && !questionPellets.some(p => p.col === c && p.row === r)) {
        ctx.beginPath(); ctx.arc(cx(c), cy(r), 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }
    // תיבות שאלה
    for (const p of questionPellets) {
      const x = cx(p.col), y = cy(p.row);
      if (p.answered) {
        ctx.fillStyle = "rgba(255,255,255,0.2)"; ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.save(); ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 14 + Math.sin(frame * 0.15) * 4;
        ctx.fillStyle = "#FFC93C"; ctx.beginPath(); ctx.arc(x, y, 10, 0, Math.PI * 2); ctx.fill(); ctx.restore();
        ctx.fillStyle = "#8B6508"; ctx.font = "bold 14px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("?", x, y + 1); ctx.textBaseline = "alphabetic";
      }
    }
    // רוחות
    for (const g of ghosts) drawGhost(g);
    // פאקמן
    drawPac();
    // טקסטים מרחפים
    for (const t of floatTexts) {
      ctx.globalAlpha = Math.max(0, t.life / 50); ctx.fillStyle = "#FFD700";
      ctx.font = "bold 16px Arial"; ctx.textAlign = "center"; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  function drawPac() {
    if (hurtT > 0 && Math.floor(frame / 4) % 2 === 0) return;
    if (window.drawPlayerAvatar && window.drawPlayerAvatar(ctx, pac.x, pac.y, TILE - 2)) return;
    const mouth = Math.abs(Math.sin(frame * 0.25)) * 0.32;       // פתיחת פה
    let ang = 0;
    if (pac.dir === "ArrowLeft") ang = Math.PI;
    else if (pac.dir === "ArrowUp") ang = -Math.PI / 2;
    else if (pac.dir === "ArrowDown") ang = Math.PI / 2;
    ctx.save(); ctx.translate(pac.x, pac.y); ctx.rotate(ang);
    ctx.fillStyle = "#FFE21F"; ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, TILE / 2 - 2, mouth * Math.PI, (2 - mouth) * Math.PI);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  function drawGhost(g) {
    const x = g.x, y = g.y, r = TILE / 2 - 2;
    ctx.fillStyle = g.color;
    ctx.beginPath();
    ctx.arc(x, y - 2, r, Math.PI, 0);
    ctx.lineTo(x + r, y + r - 2);
    for (let i = 0; i < 3; i++) ctx.lineTo(x + r - (i + 0.5) * (2 * r / 3), y + r - 6), ctx.lineTo(x + r - (i + 1) * (2 * r / 3), y + r - 2);
    ctx.closePath(); ctx.fill();
    // עיניים
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(x - 4, y - 3, 3.5, 0, Math.PI * 2); ctx.arc(x + 4, y - 3, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#0033cc";
    const dx = DELTA[g.dir] ? DELTA[g.dir][0] * 1.5 : 0, dy = DELTA[g.dir] ? DELTA[g.dir][1] * 1.5 : 0;
    ctx.beginPath(); ctx.arc(x - 4 + dx, y - 3 + dy, 1.8, 0, Math.PI * 2); ctx.arc(x + 4 + dx, y - 3 + dy, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(0, 0, canvas.width, OFFY);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left"; ctx.textBaseline = "middle";
    ctx.fillText("🪙 " + silverCoins, 12, 22);
    ctx.textAlign = "right";
    ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 22);
    ctx.textBaseline = "alphabetic";
    // לבבות
    for (let i = 0; i < 3; i++) drawHeart(canvas.width / 2 - 26 + i * 20, 14, 7, i < lives);
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

  function roundRect(x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }

  function loop() { frame++; update(); draw(); drawHUD(); animationId = requestAnimationFrame(loop); }
  function stop() { if (animationId) cancelAnimationFrame(animationId); animationId = null; document.onkeydown = null; document.onkeyup = null; keys = {}; }
  function getSilverCoins() { return silverCoins; }
  function getCurrentLevel() { return currentLevel; }

  return { init, resume, stop, press, release, getSilverCoins, getCurrentLevel };
})();
