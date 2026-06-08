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
     draw() - ציור כל אלמנטי המשחק.
     ------------------------------------------------------------ */
  function draw() {
    // רקע שמיים
    const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    grad.addColorStop(0, "#87CEEB");
    grad.addColorStop(1, "#C9F0FF");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // עננים פשוטים
    drawCloud(150 - cameraX * 0.3, 60);
    drawCloud(500 - cameraX * 0.3, 100);
    drawCloud(900 - cameraX * 0.3, 50);

    ctx.save();
    ctx.translate(-cameraX, 0);

    // פלטפורמות
    for (const p of platforms) {
      ctx.fillStyle = (p.h > 30) ? "#6B8E23" : "#8B5A2B"; // קרקע ירוקה / לבנים חומות
      ctx.fillRect(p.x, p.y, p.w, p.h);
      if (p.h > 30) {
        ctx.fillStyle = "#7CFC00"; // דשא עליון
        ctx.fillRect(p.x, p.y, p.w, 8);
      }
    }

    // מטבעות כסף
    for (const c of coins) {
      if (c.taken) continue;
      ctx.beginPath();
      ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
      ctx.fillStyle = "#C0C0C0";
      ctx.fill();
      ctx.strokeStyle = "#808080";
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // תיבות שאלה
    for (const box of questionBoxes) {
      ctx.fillStyle = box.answered ? "#9E9E9E" : "#FFB300";
      ctx.fillRect(box.x, box.y, box.w, box.h);
      ctx.strokeStyle = "#8B6508";
      ctx.lineWidth = 3;
      ctx.strokeRect(box.x, box.y, box.w, box.h);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 26px Arial";
      ctx.textAlign = "center";
      ctx.fillText(box.answered ? "✓" : "?", box.x + box.w / 2, box.y + box.h - 8);
    }

    // דגל סיום
    ctx.fillStyle = "#444";
    ctx.fillRect(flag.x, flag.y, 4, flag.h);
    ctx.fillStyle = "#E53935";
    ctx.beginPath();
    ctx.moveTo(flag.x + 4, flag.y);
    ctx.lineTo(flag.x + 40, flag.y + 15);
    ctx.lineTo(flag.x + 4, flag.y + 30);
    ctx.fill();

    // הדמות (מצוירת בלבנים פשוטות)
    drawPlayer();

    ctx.restore();
  }

  /* ----- ציור הדמות ----- */
  function drawPlayer() {
    const p = player;
    // גוף
    ctx.fillStyle = "#E53935";
    ctx.fillRect(p.x, p.y + 16, p.w, p.h - 16);
    // ראש
    ctx.fillStyle = "#FFCC80";
    ctx.fillRect(p.x + 4, p.y, p.w - 8, 18);
    // כובע
    ctx.fillStyle = "#C62828";
    ctx.fillRect(p.x + 2, p.y - 4, p.w - 4, 8);
    // עיניים (לפי כיוון)
    ctx.fillStyle = "#000";
    const eyeX = p.facing === 1 ? p.x + p.w - 12 : p.x + 8;
    ctx.fillRect(eyeX, p.y + 6, 4, 4);
  }

  /* ----- ציור ענן ----- */
  function drawCloud(x, y) {
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.beginPath();
    ctx.arc(x, y, 22, 0, Math.PI * 2);
    ctx.arc(x + 25, y + 5, 28, 0, Math.PI * 2);
    ctx.arc(x + 55, y, 22, 0, Math.PI * 2);
    ctx.fill();
  }

  /* ----- ציור ממשק עליון (HUD) ----- */
  function drawHUD() {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(0, 0, canvas.width, 34);
    ctx.fillStyle = "#fff";
    ctx.font = "bold 16px Arial";
    ctx.textAlign = "right";
    ctx.fillText("שלב " + currentLevel + " / " + totalLevels, canvas.width - 12, 23);
    ctx.textAlign = "left";
    ctx.fillText("🪙 מטבעות כסף: " + silverCoins, 12, 23);
  }

  /* ----- לולאת המשחק הראשית ----- */
  function loop() {
    update();
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
