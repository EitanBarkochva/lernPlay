/* ============================================================
   game.js  —  מנוע משחק סופר מריו לימודי על גבי Canvas
   המשחק פשוט אך עובד: דמות שזזה וקופצת, פלטפורמות,
   מטבעות כסף, תיבות שאלה (?) ודגל סיום שלב.
   כשהדמות נוגעת בתיבת שאלה - המשחק נעצר ונפתחת שאלה (app.js).
   ============================================================ */

const MarioGame = (function () {
  // ---- משתני מצב כלליים של המשחק ----
  let canvas, ctx;
  let keys = {};                 // מקשים לחוצים
  let animationId = null;        // מזהה לולאת האנימציה
  let paused = false;            // האם המשחק עצור (בזמן שאלה)
  let game = null;               // אובייקט המשחק הנוכחי (עם השאלות)
  let onQuestion = null;         // callback שנקרא כשנוגעים בתיבת שאלה
  let onLevelComplete = null;    // callback בסיום כל השלבים

  // ---- נתוני העולם ----
  const GRAVITY = 0.6;
  const MOVE_SPEED = 3.2;
  const JUMP_POWER = 12;

  let player, platforms, coins, questionBoxes, flag;
  let cameraX = 0;               // הזזת מצלמה לגלילה אופקית
  let silverCoins = 0;           // מטבעות כסף שנאספו
  let currentLevel = 1;
  let totalLevels = 1;
  let perLevel = 5;              // כמה שאלות בכל שלב
  let activeBox = null;          // התיבה שנגעו בה כרגע (לסימון אחרי תשובה)
  let answeredBoxes = 0;         // כמה תיבות שאלה כבר נענו
  let frame = 0;                 // מונה פריימים לאנימציות
  let particles = [];            // חלקיקי נצנוץ (איסוף מטבע)

  // צלילים פשוטים נוצרים ב-Web Audio (בלי קבצים חיצוניים)
  let audioCtx = null;

  /* ----- יצירת צליל פשוט (ביפ) בתדר נתון ----- */
  function beep(freq, duration, type) {
    try {
      if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type || "square";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) { /* התעלמות אם אין תמיכה בשמע */ }
  }

  // צלילים לפי אירוע
  const sounds = {
    jump:   () => beep(440, 0.15, "square"),
    coin:   () => beep(880, 0.12, "sine"),
    correct:() => { beep(660, 0.12); setTimeout(() => beep(990, 0.18), 120); },
    wrong:  () => beep(160, 0.3, "sawtooth")
  };

  /* ------------------------------------------------------------
     init(config) - אתחול המשחק.
     config = { canvas, game, onQuestion, onLevelComplete }
     ------------------------------------------------------------ */
  function init(config) {
    canvas = config.canvas;
    ctx = canvas.getContext("2d");
    game = config.game;
    onQuestion = config.onQuestion;
    onLevelComplete = config.onLevelComplete;

    // מחלקים את כל השאלות למספר שלבים (כמה שאלות בכל שלב)
    const totalQuestions = game.questions.length || 1;
    totalLevels = (game.levels && game.levels > 0)
      ? Math.min(game.levels, totalQuestions)
      : Math.ceil(totalQuestions / 5);
    if (totalLevels < 1) totalLevels = 1;
    perLevel = Math.ceil(totalQuestions / totalLevels);

    silverCoins = 0;
    currentLevel = 1;
    answeredBoxes = 0;

    buildLevel(currentLevel);
    bindControls();
    paused = false;
    loop();
  }

  /* ------------------------------------------------------------
     buildLevel(n) - בניית שלב מספר n.
     כל שלב מכיל כמה תיבות שאלה (perLevel) פזורות לאורך המסלול,
     מטבעות כסף, פלטפורמות ודגל סיום בקצה.
     ------------------------------------------------------------ */
  function buildLevel(n) {
    cameraX = 0;
    activeBox = null;
    const groundY = canvas.height - 50;

    player = {
      x: 60, y: groundY - 60,
      w: 34, h: 44,
      vx: 0, vy: 0,
      onGround: false,
      facing: 1
    };

    // קרקע ארוכה
    platforms = [{ x: 0, y: groundY, w: 6000, h: 50 }];
    coins = [];
    questionBoxes = [];

    // השאלות של השלב הנוכחי (פרוסה מתוך כל השאלות)
    const start = (n - 1) * perLevel;
    const end = Math.min(start + perLevel, game.questions.length);
    const count = Math.max(1, end - start);

    const startX = 420, gap = 260;
    for (let i = 0; i < end - start; i++) {
      const x = startX + i * gap;
      const high = (i % 2 === 1);                 // כל תיבה שנייה גבוהה (דורשת קפיצה)
      const boxY = high ? groundY - 150 : groundY - 80;
      if (high) {
        // פלטפורמה קטנה מתחת לתיבה הגבוהה כדי להגיע אליה
        platforms.push({ x: x - 28, y: groundY - 96, w: 92, h: 18 });
      }
      questionBoxes.push({ x: x, y: boxY, w: 36, h: 36, questionIndex: start + i, answered: false });
      // מטבע כסף ליד כל תיבה
      coins.push({ x: x + 18, y: boxY - 28, r: 10, taken: false });
    }

    // דגל סיום אחרי התיבה האחרונה
    const lastX = startX + (count - 1) * gap;
    flag = { x: lastX + 220, y: groundY - 120, w: 12, h: 120 };
  }

  /* ----- חיבור מקשי מקלדת ----- */
  function bindControls() {
    document.onkeydown = (e) => {
      keys[e.key] = true;
      if ([" ", "ArrowLeft", "ArrowRight", "ArrowUp"].includes(e.key)) e.preventDefault();
    };
    document.onkeyup = (e) => { keys[e.key] = false; };
  }

  /* ----- פקדי מגע (נקראים מ-app.js בכפתורים) ----- */
  function press(dir)   { keys[dir] = true; }
  function release(dir) { keys[dir] = false; }

  /* ------------------------------------------------------------
     update() - עדכון פיזיקה ולוגיקה בכל פריים.
     ------------------------------------------------------------ */
  function update() {
    if (paused) return;

    // תנועה אופקית
    player.vx = 0;
    if (keys["ArrowRight"]) { player.vx = MOVE_SPEED;  player.facing = 1; }
    if (keys["ArrowLeft"])  { player.vx = -MOVE_SPEED; player.facing = -1; }

    // קפיצה
    if ((keys[" "] || keys["ArrowUp"]) && player.onGround) {
      player.vy = -JUMP_POWER;
      player.onGround = false;
      sounds.jump();
    }

    // כבידה
    player.vy += GRAVITY;
    player.x += player.vx;
    player.y += player.vy;

    // לא לצאת מגבול שמאל
    if (player.x < 0) player.x = 0;

    // התנגשות עם פלטפורמות
    player.onGround = false;
    for (const p of platforms) {
      if (player.x + player.w > p.x && player.x < p.x + p.w &&
          player.y + player.h > p.y && player.y + player.h < p.y + p.h + 20 &&
          player.vy >= 0) {
        player.y = p.y - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }

    // איסוף מטבעות כסף
    for (const c of coins) {
      if (!c.taken &&
          player.x + player.w > c.x - c.r && player.x < c.x + c.r &&
          player.y + player.h > c.y - c.r && player.y < c.y + c.r) {
        c.taken = true;
        silverCoins++;
        sounds.coin();
        spawnSparkles(c.x, c.y);     // אפקט נצנוץ באיסוף מטבע
      }
    }

    // נגיעה בתיבת שאלה -> עצירת המשחק ופתיחת שאלה
    for (const box of questionBoxes) {
      if (!box.answered &&
          player.x + player.w > box.x && player.x < box.x + box.w &&
          player.y + player.h > box.y && player.y < box.y + box.h) {
        paused = true;
        activeBox = box;                 // זוכרים איזו תיבה נגעו בה
        if (onQuestion) onQuestion(box.questionIndex);
        break;
      }
    }

    // הגעה לדגל = סיום שלב (רק אם כל תיבות השאלה נענו)
    const allAnswered = questionBoxes.every(b => b.answered);
    if (allAnswered &&
        player.x + player.w > flag.x && player.x < flag.x + flag.w) {
      nextLevel();
    }

    // עדכון מצלמה כך שהדמות בערך במרכז
    cameraX = player.x - canvas.width / 2;
    if (cameraX < 0) cameraX = 0;
  }

  /* ----- מעבר לשלב הבא או סיום המשחק ----- */
  function nextLevel() {
    if (currentLevel >= totalLevels) {
      // סיימנו את כל השלבים
      stop();
      if (onLevelComplete) onLevelComplete();
    } else {
      currentLevel++;
      buildLevel(currentLevel);
    }
  }

  /* ------------------------------------------------------------
     resume(wasCorrect) - המשך המשחק אחרי מענה על שאלה.
     אם נכון - מסמנים את התיבה כנענתה ומזיזים את הדמות הלאה.
     ------------------------------------------------------------ */
  function resume(wasCorrect) {
    if (wasCorrect) {
      const box = activeBox || questionBoxes.find(b => !b.answered);
      if (box) {
        box.answered = true;
        answeredBoxes++;
        sounds.correct();
      }
    } else {
      sounds.wrong();
      // דוחפים מעט את הדמות אחורה כדי שלא תיגע שוב מיד בתיבה
      player.x -= 50;
    }
    activeBox = null;
    paused = false;
  }

  /* ------------------------------------------------------------
     spawnSparkles(x, y) - יצירת חלקיקי נצנוץ במיקום נתון.
     ------------------------------------------------------------ */
  function spawnSparkles(x, y) {
    for (let i = 0; i < 8; i++) {
      particles.push({
        x: x, y: y,
        vx: (Math.random() - 0.5) * 4,
        vy: -Math.random() * 4 - 1,
        life: 30,
        color: Math.random() > 0.5 ? "#FFD700" : "#FFF6A0"
      });
    }
  }

  /* ----- עדכון וציור חלקיקים ----- */
  function updateParticles() {
    for (const p of particles) {
      p.x += p.vx; p.y += p.vy; p.vy += 0.2; p.life--;
    }
    particles = particles.filter(p => p.life > 0);
  }
  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, p.life / 30);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    ctx.globalAlpha = 1;
  }

  /* ------------------------------------------------------------
     draw() - ציור כל אלמנטי המשחק.
     ------------------------------------------------------------ */
  function draw() {
    const groundY = canvas.height - 50;

    // ----- רקע שמיים מדורג -----
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#4FA8E0");
    grad.addColorStop(0.6, "#9BD6F4");
    grad.addColorStop(1, "#DFF6FF");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // ----- שמש עם זוהר -----
    drawSun(canvas.width - 70, 70);

    // ----- גבעות רקע (פרלקס איטי) -----
    drawHills(groundY);

    // ----- עננים (פרלקס) -----
    drawCloud(150 - cameraX * 0.25, 70);
    drawCloud(520 - cameraX * 0.25, 110);
    drawCloud(880 - cameraX * 0.25, 55);
    drawCloud(1200 - cameraX * 0.25, 95);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // ----- פלטפורמות -----
    for (const p of platforms) {
      if (p.h > 30) drawGround(p); else drawBrick(p);
    }

    // ----- מטבעות זהב מסתובבים -----
    for (const c of coins) {
      if (c.taken) continue;
      drawCoin(c);
    }

    // ----- תיבות שאלה (מרחפות וזוהרות) -----
    for (const box of questionBoxes) {
      drawQuestionBox(box);
    }

    // ----- דגל סיום מתנופף -----
    drawFlag();

    // ----- חלקיקים -----
    drawParticles();

    // ----- הדמות -----
    drawPlayer();

    ctx.restore();
  }

  /* ----- שמש ----- */
  function drawSun(x, y) {
    const g = ctx.createRadialGradient(x, y, 8, x, y, 60);
    g.addColorStop(0, "rgba(255,241,150,0.95)");
    g.addColorStop(1, "rgba(255,241,150,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, 60, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#FFE45C";
    ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.fill();
  }

  /* ----- גבעות רקע ----- */
  function drawHills(groundY) {
    ctx.fillStyle = "#8FD06A";
    const off = -(cameraX * 0.4) % 600;
    for (let bx = off - 600; bx < canvas.width + 600; bx += 600) {
      ctx.beginPath();
      ctx.arc(bx + 150, groundY, 130, Math.PI, 0);
      ctx.arc(bx + 420, groundY, 90, Math.PI, 0);
      ctx.fill();
    }
  }

  /* ----- קרקע עם דשא -----*/
  function drawGround(p) {
    ctx.fillStyle = "#8B5A2B";                 // אדמה
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = "#6B3F1D";                 // נקודות אדמה
    for (let i = 0; i < p.w; i += 40) {
      ctx.fillRect(p.x + i + 10, p.y + 20, 6, 6);
      ctx.fillRect(p.x + i + 28, p.y + 34, 5, 5);
    }
    ctx.fillStyle = "#5BB347";                 // דשא
    ctx.fillRect(p.x, p.y, p.w, 12);
    ctx.fillStyle = "#74D45C";                 // הדגשת דשא
    ctx.fillRect(p.x, p.y, p.w, 4);
  }

  /* ----- פלטפורמת לבנים ----- */
  function drawBrick(p) {
    ctx.fillStyle = "#C8763C";
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.strokeStyle = "rgba(90,45,15,0.5)";
    ctx.lineWidth = 2;
    for (let i = 0; i < p.w; i += 24) ctx.strokeRect(p.x + i, p.y, 24, p.h);
    ctx.fillStyle = "rgba(255,255,255,0.25)";  // הדגשה עליונה
    ctx.fillRect(p.x, p.y, p.w, 3);
  }

  /* ----- מטבע זהב מסתובב + ברק ----- */
  function drawCoin(c) {
    const bob = Math.sin((frame + c.x) * 0.08) * 3;       // ריחוף
    const sx = Math.abs(Math.cos((frame + c.x) * 0.1));    // סיבוב (רוחב)
    const cy = c.y + bob;
    ctx.save();
    ctx.translate(c.x, cy);
    ctx.scale(sx * 0.9 + 0.1, 1);
    ctx.beginPath(); ctx.arc(0, 0, c.r, 0, Math.PI * 2);
    ctx.fillStyle = "#FFD11A"; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#E0A500"; ctx.stroke();
    ctx.fillStyle = "#FFE680";
    ctx.beginPath(); ctx.arc(-c.r * 0.25, -c.r * 0.25, c.r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  /* ----- תיבת שאלה ----- */
  function drawQuestionBox(box) {
    const bob = box.answered ? 0 : Math.sin(frame * 0.1) * 4;
    const y = box.y + bob;
    if (!box.answered) {                       // זוהר
      ctx.save();
      ctx.shadowColor = "#FFD54F"; ctx.shadowBlur = 18;
    }
    // גוף
    const g = ctx.createLinearGradient(box.x, y, box.x, y + box.h);
    if (box.answered) { g.addColorStop(0, "#B0B0B0"); g.addColorStop(1, "#8A8A8A"); }
    else { g.addColorStop(0, "#FFC93C"); g.addColorStop(1, "#F5A623"); }
    ctx.fillStyle = g;
    roundRect(box.x, y, box.w, box.h, 6); ctx.fill();
    ctx.strokeStyle = "#8B6508"; ctx.lineWidth = 3;
    roundRect(box.x, y, box.w, box.h, 6); ctx.stroke();
    if (!box.answered) ctx.restore();
    // ברגים בפינות
    ctx.fillStyle = "#8B6508";
    [[6,6],[box.w-6,6],[6,box.h-6],[box.w-6,box.h-6]].forEach(o => {
      ctx.beginPath(); ctx.arc(box.x + o[0], y + o[1], 2, 0, Math.PI * 2); ctx.fill();
    });
    // סימן
    ctx.fillStyle = "#fff";
    ctx.font = "bold 26px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(box.answered ? "✓" : "?", box.x + box.w / 2, y + box.h / 2 + 1);
    ctx.textBaseline = "alphabetic";
  }

  /* ----- דגל סיום מתנופף ----- */
  function drawFlag() {
    ctx.fillStyle = "#666";
    ctx.fillRect(flag.x, flag.y, 5, flag.h);
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(flag.x + 2.5, flag.y, 5, 0, Math.PI * 2); ctx.fill();
    const wave = Math.sin(frame * 0.15) * 5;
    ctx.fillStyle = "#E53935";
    ctx.beginPath();
    ctx.moveTo(flag.x + 5, flag.y + 4);
    ctx.quadraticCurveTo(flag.x + 26, flag.y + 4 + wave, flag.x + 46, flag.y + 16);
    ctx.quadraticCurveTo(flag.x + 26, flag.y + 22 + wave, flag.x + 5, flag.y + 30);
    ctx.fill();
  }

  /* ----- ציור הדמות עם אנימציית הליכה ----- */
  function drawPlayer() {
    const p = player;
    const moving = Math.abs(p.vx) > 0.1 && p.onGround;
    const legSwing = moving ? Math.sin(frame * 0.4) * 6 : 0;
    const cx = p.x, top = p.y;
    const dir = p.facing;

    // רגליים (מתחלפות בהליכה)
    ctx.fillStyle = "#1B3A6B";
    ctx.fillRect(cx + 6, top + p.h - 10 + Math.max(0, legSwing), 9, 10);
    ctx.fillRect(cx + p.w - 15, top + p.h - 10 + Math.max(0, -legSwing), 9, 10);
    // נעליים
    ctx.fillStyle = "#5A3210";
    ctx.fillRect(cx + 4, top + p.h - 3 + Math.max(0, legSwing), 12, 4);
    ctx.fillRect(cx + p.w - 16, top + p.h - 3 + Math.max(0, -legSwing), 12, 4);

    // אוברול (גוף)
    ctx.fillStyle = "#2E6BD6";
    roundRect(cx + 4, top + 18, p.w - 8, p.h - 24, 4); ctx.fill();
    // חולצה אדומה (כתפיים/ידיים)
    ctx.fillStyle = "#E53935";
    ctx.fillRect(cx + 2, top + 16, p.w - 4, 8);
    ctx.fillRect(cx - 1, top + 18, 6, 12);          // יד שמאל
    ctx.fillRect(cx + p.w - 5, top + 18, 6, 12);    // יד ימין
    // כפתורים
    ctx.fillStyle = "#FFD700";
    ctx.beginPath(); ctx.arc(cx + 11, top + 26, 2, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + p.w - 11, top + 26, 2, 0, 7); ctx.fill();

    // ראש (פנים)
    ctx.fillStyle = "#FFCC99";
    roundRect(cx + 5, top + 1, p.w - 10, 17, 4); ctx.fill();
    // כובע אדום
    ctx.fillStyle = "#C62828";
    roundRect(cx + 1, top - 4, p.w - 2, 9, 3); ctx.fill();
    ctx.fillRect(dir === 1 ? cx + p.w - 6 : cx - 4, top + 1, 10, 5); // מצחייה
    // לוגו על הכובע
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(cx + p.w / 2, top + 0.5, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#C62828"; ctx.font = "bold 5px Arial"; ctx.textAlign = "center";
    ctx.fillText("M", cx + p.w / 2, top + 2.5);
    // עיניים + שפם
    ctx.fillStyle = "#222";
    const eyeX = dir === 1 ? cx + p.w - 13 : cx + 9;
    ctx.fillRect(eyeX, top + 7, 3, 4);
    ctx.fillStyle = "#5A3210";
    ctx.fillRect(cx + 7, top + 13, p.w - 14, 3);    // שפם
  }

  /* ----- מלבן עם פינות מעוגלות ----- */
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  /* ----- ציור ענן ----- */
  function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 6, 28, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 30, y - 12, 20, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ----- ציור ממשק עליון (HUD) ----- */
  function drawHUD() {
    // רקע מדורג שקוף
    const g = ctx.createLinearGradient(0, 0, 0, 40);
    g.addColorStop(0, "rgba(0,0,0,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, canvas.width, 44);

    // תג מטבעות (שמאל)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(10, 8, 150, 26, 13); ctx.fill();
    ctx.fillStyle = "#FFD11A";
    ctx.beginPath(); ctx.arc(26, 21, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#E0A500"; ctx.font = "bold 11px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("$", 26, 21);
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "left";
    ctx.fillText("מטבעות: " + silverCoins, 40, 21);
    ctx.textBaseline = "alphabetic";

    // תג שלב (ימין)
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    roundRect(canvas.width - 150, 8, 140, 26, 13); ctx.fill();
    ctx.fillStyle = "#fff"; ctx.font = "bold 15px Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("🏁 שלב " + currentLevel + " / " + totalLevels, canvas.width - 80, 21);
    ctx.textBaseline = "alphabetic";
  }

  /* ----- לולאת המשחק הראשית ----- */
  function loop() {
    frame++;
    update();
    updateParticles();
    draw();
    drawHUD();
    animationId = requestAnimationFrame(loop);
  }

  /* ----- עצירת המשחק ----- */
  function stop() {
    if (animationId) cancelAnimationFrame(animationId);
    animationId = null;
    document.onkeydown = null;
    document.onkeyup = null;
    keys = {};
  }

  // מחזירים מטבעות כסף שנאספו (לדוח)
  function getSilverCoins() { return silverCoins; }
  function getCurrentLevel() { return currentLevel; }

  // ממשק ציבורי
  return {
    init,
    resume,
    stop,
    press,
    release,
    getSilverCoins,
    getCurrentLevel
  };
})();
