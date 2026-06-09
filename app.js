/* ============================================================
   app.js  —  הלוגיקה הראשית של האפליקציה (SPA)
   ניהול מסכים, טפסים, שאלות, הרצת המשחק ודוחות.
   ============================================================ */

// ----- מצב זמני של תהליך יצירת משחק -----
let draftGame = null;       // המשחק שנמצא בבנייה (לפני יצירת קוד)

// ----- מצב זמני של תלמיד שמשחק -----
let activeGame = null;      // המשחק שהתלמיד משחק בו כרגע
let activeEngine = null;    // מנוע המשחק הפעיל (MarioGame / PacmanGame)
let student = null;         // פרטי התלמיד הנוכחי
let studentAnswers = [];    // תשובות התלמיד (לדוח)
let currentQuestionIndex = 0;
let currentAttempts = 0;    // ניסיונות בשאלה הנוכחית
let quizMode = false;       // האם במצב "שאלות בלי משחק"

/* ============================================================
   ניהול מסכים
   ============================================================ */
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  window.scrollTo(0, 0);
}

/* ============================================================
   אתחול האפליקציה - נקרא בעת טעינת הדף
   ============================================================ */
window.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadLookups();   // טעינת טבלאות העזר מ-Supabase (כיתות/מקצועות/נושאים/סוגי משחק)
  } catch (e) {
    console.error("שגיאה בטעינת טבלאות העזר", e);
  }
  fillDropdowns();         // מילוי הרשימות הנפתחות
  showScreen("homeScreen");
  try {
    await seedDemoGame();  // יצירת משחק הדוגמה DEMO-A1 (אם אינו קיים)
  } catch (e) {
    console.error(e);
    alert("שגיאה בחיבור למסד הנתונים. בדוק את הגדרות Supabase ב-data.js ואת הרשאות הטבלאות.");
  }
});

/* ----- מילוי הרשימות הנפתחות -----
   במצב Supabase: הערכים הם מזהים (uuid) מהטבלאות.
   במצב מקומי: הערכים הם שמות מתוך appConfig. */
function fillDropdowns() {
  const gradeSel    = document.getElementById("grade");
  const subjectSel  = document.getElementById("subject");
  const topicSel    = document.getElementById("topic");
  const gameTypeSel = document.getElementById("gameType");
  [gradeSel, subjectSel, topicSel, gameTypeSel].forEach(s => s.innerHTML = "");

  if (USE_SUPABASE) {
    lookups.grades.forEach(g => gradeSel.add(new Option("כיתה " + g.name, g.id)));
    lookups.subjects.forEach(s => subjectSel.add(new Option(s.name, s.id)));
    lookups.topics.forEach(t => topicSel.add(new Option(t.name, t.id)));
    lookups.gameTypes.forEach(gt => gameTypeSel.add(new Option(gt.name, gt.id)));
  } else {
    appConfig.grades.forEach(g => gradeSel.add(new Option("כיתה " + g, g)));
    gradeSel.value = "א";
    appConfig.subjects.forEach(s => subjectSel.add(new Option(s, s)));
    subjectSel.value = "חשבון";
    appConfig.topics.forEach(t => topicSel.add(new Option(t, t)));
    appConfig.gameTypes.forEach(gt => {
      const opt = new Option(gt.name + (gt.active ? "" : " (בקרוב)"), gt.id);
      if (!gt.active) opt.disabled = true;
      gameTypeSel.add(opt);
    });
    gameTypeSel.value = "mario";
  }
}

/* ============================================================
   1. יצירת משחק - שלב פרטי המשחק
   ============================================================ */
function createGame() {
  const creatorName = document.getElementById("creatorName").value.trim();
  if (!creatorName) { alert("נא להזין שם יוצר"); return; }

  // בונים טיוטת משחק מתוך הטופס
  draftGame = {
    id: "game_" + Date.now(),
    code: "",
    creatorName: creatorName,
    creatorType: document.getElementById("creatorType").value,
    grade: document.getElementById("grade").value,
    subject: document.getElementById("subject").value,
    topic: document.getElementById("topic").value,
    gameType: document.getElementById("gameType").value,
    creatorEmail: document.getElementById("creatorEmail").value.trim(),
    title: document.getElementById("gameTitle").value.trim() || "תרגול",
    levels: parseInt(document.getElementById("levels").value) || 5,
    createdAt: new Date().toISOString().slice(0, 10),
    questions: []
  };

  renderQuestionsList();
  showScreen("addQuestionsScreen");
}

/* ============================================================
   2. הוספת שאלות
   ============================================================ */
function addQuestion() {
  const text = document.getElementById("qText").value.trim();
  const correct = document.getElementById("qCorrect").value.trim();
  if (!text || !correct) { alert("נא למלא שאלה ותשובה נכונה"); return; }

  // תשובות שגויות מופרדות בפסיק (לא חובה)
  const wrongRaw = document.getElementById("qWrong").value.trim();
  const wrongAnswers = wrongRaw ? wrongRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  const q = {
    id: "q" + (draftGame.questions.length + 1) + "_" + Date.now(),
    text: text,
    type: document.getElementById("qType").value,
    correctAnswer: correct,
    wrongAnswers: wrongAnswers,
    difficulty: document.getElementById("qDifficulty").value,
    coins: parseInt(document.getElementById("qCoins").value) || 10,
    explanation: document.getElementById("qExplanation").value.trim()
  };

  draftGame.questions.push(q);

  // איפוס שדות הטופס
  ["qText", "qCorrect", "qWrong", "qExplanation"].forEach(id => document.getElementById(id).value = "");
  document.getElementById("qText").focus();

  renderQuestionsList();
}

/* ----- יצירת שאלות אוטומטית ב-AI ----- */
async function generateAIQuestions() {
  if (!draftGame) { alert("צור קודם משחק"); return; }
  const status = document.getElementById("aiStatus");
  const btn = document.getElementById("aiBtn");

  const count = parseInt(document.getElementById("aiCount").value) || 10;
  const gradeText = (document.getElementById("grade").selectedOptions[0]?.text || "")
    .replace("כיתה", "").trim();
  const subject = document.getElementById("subject").selectedOptions[0]?.text || "";
  const topic = document.getElementById("topic").selectedOptions[0]?.text || "";
  const difficulty = document.getElementById("aiDifficulty").value || "קל";
  const type = document.getElementById("aiType").value || "multiple";

  status.className = "ai-status";
  status.textContent = "🤖 יוצר " + count + " שאלות... זה עשוי לקחת מספר שניות";
  btn.disabled = true;

  try {
    const qs = await generateQuestionsAI({ subject, grade: gradeText, topic, count, difficulty, type });
    if (!qs.length) { status.textContent = "לא התקבלו שאלות. נסה שוב."; return; }
    draftGame.questions.push(...qs);
    renderQuestionsList();
    status.className = "ai-status ok";
    status.textContent = "✅ נוספו " + qs.length + " שאלות! אפשר לערוך, להוסיף עוד, או לסיים.";
  } catch (e) {
    console.error(e);
    status.className = "ai-status err";
    status.textContent = "שגיאה: " + e.message;
  } finally {
    btn.disabled = false;
  }
}

/* ----- הצגת רשימת השאלות שנוספו ----- */
function renderQuestionsList() {
  const list = document.getElementById("questionsList");
  if (draftGame.questions.length === 0) {
    list.innerHTML = "<p class='muted'>עדיין לא נוספו שאלות.</p>";
    return;
  }
  list.innerHTML = draftGame.questions.map((q, i) => `
    <div class="q-item">
      <span><b>${i + 1}.</b> ${escapeHtml(q.text)} <small>(תשובה: ${escapeHtml(q.correctAnswer)}, ${q.coins} מטבעות)</small></span>
      <button class="btn-small btn-danger" onclick="removeQuestion(${i})">מחק</button>
    </div>
  `).join("");
}

function removeQuestion(i) {
  draftGame.questions.splice(i, 1);
  renderQuestionsList();
}

/* ============================================================
   3. סיום יצירה - יצירת קוד משחק ושמירה
   ============================================================ */
async function finishGameCreation() {
  if (draftGame.questions.length === 0) {
    alert("נא להוסיף לפחות שאלה אחת");
    return;
  }
  // לא יותר שלבים ממספר השאלות
  if (draftGame.levels > draftGame.questions.length) {
    draftGame.levels = draftGame.questions.length;
  }

  draftGame.code = generateGameCode();
  try {
    await saveGame(draftGame);
  } catch (e) {
    console.error(e);
    alert("שגיאה בשמירת המשחק. נסה שוב.");
    return;
  }

  document.getElementById("generatedCode").textContent = draftGame.code;
  showScreen("gameCodeScreen");
}

/* ----- העתקת קוד המשחק ----- */
function copyCode() {
  const code = document.getElementById("generatedCode").textContent;
  navigator.clipboard.writeText(code).then(
    () => alert("הקוד הועתק: " + code),
    () => alert("הקוד: " + code)
  );
}

/* ============================================================
   טבלת אלופים - מי אסף הכי הרבה מטבעות
   ============================================================ */
let leaderboardData = [];

async function showLeaderboard() {
  showScreen("leaderboardScreen");
  const c = document.getElementById("leaderboardList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  try {
    leaderboardData = await getLeaderboard();
  } catch (e) {
    console.error(e);
    c.innerHTML = "<p class='muted'>שגיאה בטעינת הטבלה.</p>";
    return;
  }
  // מילוי סינון כיתות
  const sel = document.getElementById("lbGrade");
  sel.innerHTML = "<option value=''>כל הכיתות</option>";
  [...new Set(leaderboardData.map(e => e.grade).filter(Boolean))]
    .forEach(g => sel.add(new Option("כיתה " + g, g)));
  renderLeaderboard();
}

function renderLeaderboard() {
  const filter = document.getElementById("lbGrade").value;
  let list = leaderboardData.slice();
  if (filter) list = list.filter(e => e.grade === filter);

  const c = document.getElementById("leaderboardList");
  if (!list.length) {
    c.innerHTML = "<p class='muted'>עדיין אין תוצאות — שחקו כדי להופיע כאן! 🎮</p>";
    return;
  }

  const medals = ["🥇", "🥈", "🥉"];
  const rows = list.map((e, i) => `
    <tr class="${i < 3 ? 'lb-top' : ''}">
      <td>${medals[i] || (i + 1)}</td>
      <td>${escapeHtml(e.name)}</td>
      <td>${escapeHtml(e.grade)}</td>
      <td>💰 ${e.totalCoins}</td>
      <td>${e.games}</td>
    </tr>`).join("");

  c.innerHTML = `
    <table class="report-table">
      <thead><tr><th>#</th><th>שם</th><th>כיתה</th><th>סך מטבעות</th><th>משחקים</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

/* ============================================================
   תחרות 1 על 1 (אונליין)
   ============================================================ */
let duelMatch = null;      // שורת התחרות מה-DB
let duelRole = null;       // 'host' | 'guest'
let duelQuestions = [];
let duelIndex = 0;
let duelScore = 0;
let duelPoll = null;       // מזהה ה-interval של ה-polling
let duelResultShown = false;
const DUEL_TIME = 15;      // שניות לכל שאלה
let duelQTimer = null;     // טיימר השאלה
let duelTimeLeft = DUEL_TIME;

function stopDuelPoll() { if (duelPoll) { clearInterval(duelPoll); duelPoll = null; } }
function clearDuelTimer() { if (duelQTimer) { clearInterval(duelQTimer); duelQTimer = null; } }

/* ----- יצירת תחרות (מארח) ----- */
async function createDuel() {
  const name = document.getElementById("duelHostName").value.trim();
  const gameCode = document.getElementById("duelHostGame").value.trim();
  if (!name || !gameCode) { alert("נא להזין שם וקוד משחק"); return; }
  try {
    duelMatch = await createMatch(name, gameCode);
  } catch (e) { alert(e.message); return; }
  duelRole = "host";
  document.getElementById("duelWaitBox").style.display = "block";
  document.getElementById("duelCodeDisplay").textContent = duelMatch.match_code;
  document.getElementById("duelWaitStatus").textContent = "⏳ ממתין שהיריב יצטרף...";

  // המתנה להצטרפות היריב
  stopDuelPoll();
  let busy = false;
  duelPoll = setInterval(async () => {
    if (busy) return; busy = true;
    try {
      const m = await getMatch(duelMatch.match_code);
      if (m && m.guest_name) {
        duelMatch = m;
        stopDuelPoll();
        startDuelPlay();
      }
    } catch (e) { console.error(e); }
    busy = false;
  }, 1500);
}

function copyDuelCode() {
  const code = duelMatch ? duelMatch.match_code : "";
  navigator.clipboard.writeText(code).then(() => alert("הקוד הועתק: " + code), () => alert("הקוד: " + code));
}

/* ----- הצטרפות לתחרות (יריב) ----- */
async function joinDuel() {
  const name = document.getElementById("duelGuestName").value.trim();
  const code = document.getElementById("duelGuestCode").value.trim();
  if (!name || !code) { alert("נא להזין שם וקוד תחרות"); return; }
  const status = document.getElementById("duelJoinStatus");
  status.className = "ai-status";
  status.textContent = "מצטרף...";
  try {
    duelMatch = await joinMatch(code, name);
  } catch (e) { status.className = "ai-status err"; status.textContent = e.message; return; }
  duelRole = "guest";
  startDuelPlay();
}

/* ----- התחלת המשחק לשני השחקנים ----- */
async function startDuelPlay() {
  duelResultShown = false;
  duelIndex = 0;
  duelScore = 0;
  try {
    duelQuestions = await getMatchQuestions(duelMatch);
  } catch (e) { alert("שגיאה בטעינת השאלות"); return; }
  if (!duelQuestions.length) { alert("אין שאלות לתחרות"); return; }

  showScreen("duelPlayScreen");
  document.getElementById("duelWaitOpponent").textContent = "";
  renderDuelScoreboard();
  renderDuelQuestion();

  // polling לעדכון ניקוד היריב וסיום
  stopDuelPoll();
  let busy = false;
  duelPoll = setInterval(async () => {
    if (busy) return; busy = true;
    try {
      const m = await getMatch(duelMatch.match_code);
      if (m) {
        // שמירת השדות שלי המקומיים, עדכון שדות היריב
        duelMatch = m;
        renderDuelScoreboard();
        if (m.host_done && m.guest_done) showDuelResult();
      }
    } catch (e) { console.error(e); }
    busy = false;
  }, 1500);
}

/* ----- לוח ניקוד (אני מול יריב) ----- */
function renderDuelScoreboard() {
  const m = duelMatch;
  const n = duelQuestions.length;
  const meName = duelRole === "host" ? m.host_name : m.guest_name;
  const oppName = (duelRole === "host" ? m.guest_name : m.host_name) || "ממתין...";
  const oppScore = duelRole === "host" ? m.guest_score : m.host_score;
  const oppProg = duelRole === "host" ? m.guest_progress : m.host_progress;
  const oppDone = duelRole === "host" ? m.guest_done : m.host_done;
  document.getElementById("duelScoreboard").innerHTML = `
    <div class="duel-side me">
      <div class="duel-name">😀 ${escapeHtml(meName)} (אני)</div>
      <div class="duel-score">${duelScore}</div>
    </div>
    <div class="duel-vs">VS</div>
    <div class="duel-side opp">
      <div class="duel-name">😎 ${escapeHtml(oppName)}</div>
      <div class="duel-score">${oppScore}</div>
      <div class="duel-mini">${oppDone ? "סיים! ✓" : "ענה " + oppProg + "/" + n}</div>
    </div>`;
}

/* ----- ציור שאלת תחרות ----- */
function renderDuelQuestion() {
  const n = duelQuestions.length;
  const box = document.getElementById("duelQuestionBox");

  clearDuelTimer();
  if (duelIndex >= n) {
    // סיימתי את כל השאלות
    box.innerHTML = "<h2 class='question-text'>סיימת! 🎉</h2>";
    document.getElementById("duelProgress").textContent = "";
    document.getElementById("duelWaitOpponent").textContent = "⏳ ממתין שהיריב יסיים...";
    const fields = duelRole === "host"
      ? { host_score: duelScore, host_progress: n, host_done: true }
      : { guest_score: duelScore, guest_progress: n, guest_done: true };
    patchMatch(duelMatch.match_code, fields).catch(e => console.error(e));
    return;
  }

  document.getElementById("duelProgress").textContent = "שאלה " + (duelIndex + 1) + " מתוך " + n;
  const q = duelQuestions[duelIndex];
  let answerHtml;
  if (q.type === "open") {
    answerHtml = `<input type="text" id="duelInput" class="answer-input" placeholder="כתוב תשובה" autocomplete="off">
      <button class="btn" onclick="duelOpenSubmit()">שלח</button>`;
  } else if (q.type === "truefalse") {
    answerHtml = `<button class="btn answer-option" onclick="duelAnswer('נכון')">נכון</button>
      <button class="btn answer-option" onclick="duelAnswer('לא נכון')">לא נכון</button>`;
  } else {
    answerHtml = shuffle([q.correctAnswer, ...q.wrongAnswers]).map(opt =>
      `<button class="btn answer-option" onclick="duelAnswer('${escapeAttr(opt)}')">${escapeHtml(opt)}</button>`
    ).join("");
  }
  box.innerHTML = `<div id="duelTimer" class="duel-timer"></div>
    <h2 class="question-text">${escapeHtml(q.text)}</h2>
    <div class="answer-area">${answerHtml}</div>
    <div id="duelFeedback" class="feedback"></div>`;
  if (q.type === "open") setTimeout(() => document.getElementById("duelInput")?.focus(), 100);
  startQTimer();
}

/* ----- טיימר השאלה ----- */
function startQTimer() {
  clearDuelTimer();
  duelTimeLeft = DUEL_TIME;
  updateTimerDisplay();
  duelQTimer = setInterval(() => {
    duelTimeLeft--;
    updateTimerDisplay();
    if (duelTimeLeft <= 0) { clearDuelTimer(); duelSubmit(null, true); }
  }, 1000);
}
function updateTimerDisplay() {
  const t = document.getElementById("duelTimer");
  if (!t) return;
  const pct = Math.max(0, (duelTimeLeft / DUEL_TIME) * 100);
  const color = duelTimeLeft > 7 ? "#27ae60" : duelTimeLeft > 3 ? "#f39c12" : "#e74c3c";
  t.innerHTML = `<div class="timer-bar"><div class="timer-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="timer-num">⏱️ ${duelTimeLeft}</span>`;
}

function duelOpenSubmit() {
  const v = document.getElementById("duelInput").value.trim();
  if (!v) { alert("נא לכתוב תשובה"); return; }
  duelSubmit(v, false);
}
function duelAnswer(val) { duelSubmit(val, false); }

/* ----- בדיקת תשובה + בונוס מהירות ----- */
function duelSubmit(val, timedOut) {
  clearDuelTimer();
  const q = duelQuestions[duelIndex];
  const correct = !timedOut && normalize(val) === normalize(q.correctAnswer);
  const fb = document.getElementById("duelFeedback");
  if (correct) {
    const gained = 10 + Math.max(0, duelTimeLeft);   // 10 בסיס + בונוס מהירות
    duelScore += gained;
    if (fb) { fb.className = "feedback correct"; fb.textContent = "נכון! +" + gained + " נקודות ⚡"; }
  } else if (fb) {
    fb.className = "feedback wrong";
    fb.textContent = timedOut ? "נגמר הזמן! ⏰ התשובה: " + q.correctAnswer : "טעות (" + q.correctAnswer + ")";
  }

  document.querySelectorAll("#duelQuestionBox .answer-option, #duelQuestionBox .btn").forEach(b => b.disabled = true);

  duelIndex++;
  renderDuelScoreboard();
  const fields = duelRole === "host"
    ? { host_score: duelScore, host_progress: duelIndex }
    : { guest_score: duelScore, guest_progress: duelIndex };
  patchMatch(duelMatch.match_code, fields).catch(e => console.error(e));

  setTimeout(renderDuelQuestion, 900);
}

/* ----- מסך תוצאה ----- */
async function showDuelResult() {
  if (duelResultShown) return;
  duelResultShown = true;
  stopDuelPoll();
  clearDuelTimer();
  let m = duelMatch;
  try { const fresh = await getMatch(duelMatch.match_code); if (fresh) m = fresh; } catch (e) {}

  // רישום המנצח לטבלת הניצחונות (פעם אחת)
  const winner = m.host_score > m.guest_score ? m.host_name
               : m.guest_score > m.host_score ? m.guest_name : null;
  try { await recordDuelWinner(m.match_code, winner); } catch (e) { console.error(e); }

  const myScore = duelRole === "host" ? m.host_score : m.guest_score;
  const oppScore = duelRole === "host" ? m.guest_score : m.host_score;
  const oppName = (duelRole === "host" ? m.guest_name : m.host_name) || "יריב";
  let title, emoji, cls;
  if (myScore > oppScore) { title = "ניצחת! 🏆"; emoji = "🥇"; cls = "good"; }
  else if (myScore < oppScore) { title = "הפסדת 😅"; emoji = "💪"; cls = "bad"; }
  else { title = "תיקו! 🤝"; emoji = "🤝"; cls = ""; }

  document.getElementById("duelResultBox").innerHTML = `
    <h2 style="text-align:center">${emoji} ${title}</h2>
    <div class="report-cards">
      <div class="report-card ${cls}">😀 אני: ${myScore} נקודות</div>
      <div class="report-card">😎 ${escapeHtml(oppName)}: ${oppScore} נקודות</div>
    </div>`;
  showScreen("duelResultScreen");
}

/* ----- טבלת ניצחונות ----- */
async function showDuelWins() {
  showScreen("duelWinsScreen");
  const c = document.getElementById("duelWinsList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  let list;
  try { list = await getDuelWins(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }
  if (!list.length) { c.innerHTML = "<p class='muted'>עדיין אין ניצחונות — שחקו תחרות! ⚔️</p>"; return; }
  const medals = ["🥇", "🥈", "🥉"];
  c.innerHTML = `<table class="report-table">
    <thead><tr><th>#</th><th>שם</th><th>ניצחונות</th></tr></thead>
    <tbody>${list.map((e, i) => `
      <tr class="${i < 3 ? 'lb-top' : ''}">
        <td>${medals[i] || (i + 1)}</td>
        <td>${escapeHtml(e.name)}</td>
        <td>🏆 ${e.wins}</td>
      </tr>`).join("")}</tbody></table>`;
}

/* ----- יציאה מהתחרות ----- */
function leaveDuel() {
  stopDuelPoll();
  clearDuelTimer();
  duelMatch = null; duelRole = null; duelQuestions = []; duelIndex = 0; duelScore = 0;
  showScreen("homeScreen");
}

/* ============================================================
   בחירת משחק מוכן (browse) - רשימת כל המשחקים לפי כיתה ונושא
   ============================================================ */
let browseGames = [];   // המשחקים שנטענו לרשימה

async function showBrowse() {
  showScreen("browseScreen");
  const container = document.getElementById("browseList");
  container.innerHTML = "<p class='muted'>טוען משחקים...</p>";
  try {
    browseGames = await listGames();
  } catch (e) {
    console.error(e);
    container.innerHTML = "<p class='muted'>שגיאה בטעינת המשחקים.</p>";
    return;
  }

  // מילוי סינון הכיתות (לפי כיתות שקיימות, ממוינות)
  const sel = document.getElementById("browseGrade");
  sel.innerHTML = "<option value=''>כל הכיתות</option>";
  const grades = [...new Map(browseGames.map(g => [g.grade, g.gradeOrder])).entries()]
    .filter(([name]) => name)
    .sort((a, b) => a[1] - b[1]);
  grades.forEach(([name]) => sel.add(new Option("כיתה " + name, name)));

  // מילוי תיבת המקצועות: הכל + מקצועות רגילים + Bands
  const subSel = document.getElementById("browseSubject");
  subSel.innerHTML = "<option value=''>📋 הכל</option>";
  const subjects = [...new Set(browseGames.filter(g => !isBandGame(g)).map(g => g.subject).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "he"));
  subjects.forEach(s => subSel.add(new Option(s, "subject:" + s)));
  const bands = [...new Set(browseGames.filter(g => isBandGame(g)).map(g => g.topic))].sort();
  bands.forEach(b => subSel.add(new Option("📘 " + b, "band:" + b)));

  renderBrowse();
}

function isBandGame(g) { return (g.topic || "").startsWith("Band "); }

const BAND_ORDER = ["Band I", "Band II", "Band III"];
let browseOpen = null; // קבוצת המפתחות הפתוחים באקורדיאון

function toggleBrowseGroup(key) {
  if (!browseOpen) browseOpen = new Set();
  if (browseOpen.has(key)) browseOpen.delete(key);
  else browseOpen.add(key);
  renderBrowse();
}

/* ----- ציור רשימת המשחקים כאקורדיאון: כיתה א..ו ואז Bands ----- */
function renderBrowse() {
  const gradeFilter = document.getElementById("browseGrade").value;
  const subVal = document.getElementById("browseSubject").value;
  const term = document.getElementById("browseSearch").value.trim().toLowerCase();
  const container = document.getElementById("browseList");

  let games = browseGames.slice();

  if (gradeFilter) games = games.filter(g => g.grade === gradeFilter);

  // סינון לפי מקצוע / Band
  if (subVal.startsWith("band:")) {
    const bn = subVal.slice(5);
    games = games.filter(g => isBandGame(g) && g.topic === bn);
  } else if (subVal.startsWith("subject:")) {
    const sn = subVal.slice(8);
    games = games.filter(g => g.subject === sn && !isBandGame(g));
  }

  if (term) {
    games = games.filter(g =>
      (g.topic || "").toLowerCase().includes(term) ||
      (g.title || "").toLowerCase().includes(term) ||
      (g.code  || "").toLowerCase().includes(term));
  }

  if (!games.length) {
    container.innerHTML = "<p class='muted'>לא נמצאו משחקים תואמים.</p>";
    return;
  }

  // בניית קבוצות מסודרות: כיתות לפי gradeOrder, ואז Bands בסוף
  const groups = [], idx = {};
  games.forEach(g => {
    const isB = isBandGame(g);
    const key   = isB ? ("band:" + g.topic) : ("grade:" + g.grade);
    const label = isB ? ("📘 " + g.topic) : ("כיתה " + g.grade);
    const bi = isB ? BAND_ORDER.indexOf(g.topic) : -1;
    const rank = isB ? (1000 + (bi < 0 ? 99 : bi)) : (g.gradeOrder || 0);
    if (idx[key] === undefined) { idx[key] = groups.length; groups.push({ key, label, rank, games: [] }); }
    groups[idx[key]].games.push(g);
  });
  groups.sort((a, b) => a.rank - b.rank);
  groups.forEach(gr => gr.games.sort((a, b) => (a.topic || a.title || "").localeCompare(b.topic || b.title || "", "he")));

  // אתחול מצב פתיחה: כברירת מחדל הקבוצה הראשונה (כיתה א) פתוחה
  if (browseOpen === null) browseOpen = new Set(groups.length ? [groups[0].key] : []);
  // בחיפוש — פותחים את כל הקבוצות התואמות כדי לראות תוצאות
  const forceAll = !!term;
  // אם כלום לא פתוח מבין הקבוצות הנוכחיות, פותחים את הראשונה
  if (!forceAll && !groups.some(gr => browseOpen.has(gr.key)) && groups.length) browseOpen.add(groups[0].key);

  let html = "";
  groups.forEach(gr => {
    const open = forceAll || browseOpen.has(gr.key);
    let cards = "";
    gr.games.forEach(g => {
      cards += `
        <button class="game-card" onclick="pickGame('${escapeAttr(g.code)}','${escapeAttr(g.grade)}')">
          <span class="game-card-topic">${escapeHtml(g.topic || g.title)}</span>
          <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}</span>
          <span class="game-card-play">▶ שחק</span>
        </button>`;
    });
    html += `
      <div class="acc-item ${open ? "open" : ""}">
        <button type="button" class="acc-head" onclick="toggleBrowseGroup('${escapeAttr(gr.key)}')">
          <span class="acc-title">${escapeHtml(gr.label)}</span>
          <span class="acc-meta">${gr.games.length} משחקים <span class="acc-arrow">▾</span></span>
        </button>
        <div class="acc-panel"><div class="browse-grid">${cards}</div></div>
      </div>`;
  });
  container.innerHTML = html;
}

/* ----- בחירת משחק -> מעבר לכניסת תלמיד עם הקוד מוכן ----- */
function pickGame(code, grade) {
  document.getElementById("gameCode").value = code;
  document.getElementById("studentGrade").value = grade || "";
  showScreen("studentLoginScreen");
  document.getElementById("studentName").focus();
}

/* ============================================================
   תוכניות "עולה לכיתה X" — חזרה לקראת השנה הבאה
   כל תוכנית מרכזת את משחקי הכיתה שצריך לתרגל כדי להיות מוכן.
   ============================================================ */
const PROGRAMS = [
  { target: "א", practice: "א", desc: "הכנה לכיתה א — משחקי יסוד" },
  { target: "ב", practice: "א", desc: "חזרה על חומר כיתה א" },
  { target: "ג", practice: "ב", desc: "חזרה על חומר כיתה ב" },
  { target: "ד", practice: "ג", desc: "חזרה על חומר כיתה ג" },
  { target: "ה", practice: "ד", desc: "חזרה על חומר כיתה ד" },
  { target: "ו", practice: "ה", desc: "חזרה על חומר כיתה ה" },
  { target: "ז", practice: "ו", desc: "חזרה על חומר כיתה ו" },
];
let programGamesCache = [];

async function showPrograms() {
  showScreen("programsScreen");
  const c = document.getElementById("programsList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  try { programGamesCache = await listGames(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }

  c.innerHTML = '<div class="browse-grid">' + PROGRAMS.map(p => {
    const count = programGamesCache.filter(g => g.grade === p.practice).length;
    return `
      <button class="game-card program-card" onclick="showProgram('${escapeAttr(p.target)}')">
        <span class="game-card-topic">🎓 עולה לכיתה ${escapeHtml(p.target)}</span>
        <span class="game-card-sub">${escapeHtml(p.desc)}</span>
        <span class="game-card-play">${count} משחקים ▶</span>
      </button>`;
  }).join("") + "</div>";
}

function showProgram(target) {
  const p = PROGRAMS.find(x => x.target === target);
  if (!p) return;
  showScreen("programGamesScreen");
  document.getElementById("programTitle").textContent = "🎓 עולה לכיתה " + target;
  document.getElementById("programSubtitle").textContent = p.desc + " — שחקו בכל המשחקים כדי להיות מוכנים! 💪";

  const games = programGamesCache
    .filter(g => g.grade === p.practice)
    .sort((a, b) =>
      (a.subject || "").localeCompare(b.subject || "", "he") ||
      (a.topic || "").localeCompare(b.topic || "", "he"));

  const c = document.getElementById("programGamesList");
  if (!games.length) {
    c.innerHTML = "<p class='muted'>אין עדיין משחקים זמינים לתוכנית זו.</p>";
    return;
  }

  let html = "", last = null;
  games.forEach(g => {
    if (g.subject !== last) {
      if (last !== null) html += "</div>";
      html += `<h3 class="browse-grade">${escapeHtml(g.subject || "כללי")}</h3><div class="browse-grid">`;
      last = g.subject;
    }
    html += `
      <button class="game-card" onclick="pickGame('${escapeAttr(g.code)}','${escapeAttr(g.grade)}')">
        <span class="game-card-topic">${escapeHtml(g.topic || g.title)}</span>
        <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}</span>
        <span class="game-card-play">▶ שחק</span>
      </button>`;
  });
  if (last !== null) html += "</div>";
  c.innerHTML = html;
}

/* ============================================================
   אנגלית - Bands (אוצר מילים רשמי)
   ============================================================ */
async function showBands() {
  showScreen("bandsScreen");
  const c = document.getElementById("bandsList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  let groups;
  try { groups = await getBandGames(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }

  const order = ["Band I", "Band II", "Band III"];
  const oi = b => { const i = order.indexOf(b); return i < 0 ? 99 : i; };
  const keys = Object.keys(groups).sort((a, b) => oi(a) - oi(b) || a.localeCompare(b));
  if (!keys.length) { c.innerHTML = "<p class='muted'>עדיין אין משחקי Bands.</p>"; return; }

  let html = "";
  keys.forEach(band => {
    const list = groups[band].slice().sort((a, b) => a.code.localeCompare(b.code));
    html += `<h3 class="browse-grade">📘 ${escapeHtml(band)} <small>(${list.length} חלקים)</small></h3><div class="browse-grid">`;
    list.forEach((g, i) => {
      html += `
        <button class="game-card" onclick="pickGame('${escapeAttr(g.code)}','')">
          <span class="game-card-topic">חלק ${i + 1}</span>
          <span class="game-card-sub">${escapeHtml(g.code)} · 30 מילים</span>
          <span class="game-card-play">▶ שחק</span>
        </button>`;
    });
    html += "</div>";
  });
  c.innerHTML = html;
}

/* ============================================================
   מבחנים (מצב בחינה עם טיימר וציון)
   ============================================================ */
let examGames = [];
let examGame = null, examName = "", examQuestions = [], examIndex = 0, examAnswers = [];
let examTimer = null, examTimeLeft = 0, examTimed = false, examTotalSec = 0, examStart = 0;

function clearExamTimer() { if (examTimer) { clearInterval(examTimer); examTimer = null; } }

async function showExams() {
  showScreen("examsScreen");
  const c = document.getElementById("examsList");
  c.innerHTML = "<p class='muted'>טוען בחינות...</p>";
  try { examGames = await listGames(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }

  const sel = document.getElementById("examGrade");
  sel.innerHTML = "<option value=''>כל הכיתות</option>";
  [...new Map(examGames.map(g => [g.grade, g.gradeOrder])).entries()]
    .filter(([n]) => n).sort((a, b) => a[1] - b[1])
    .forEach(([n]) => sel.add(new Option("כיתה " + n, n)));
  renderExams();
}

function renderExams() {
  const filter = document.getElementById("examGrade").value;
  const term = document.getElementById("examSearch").value.trim().toLowerCase();
  let games = examGames.slice().sort((a, b) => (a.gradeOrder - b.gradeOrder) || (a.topic || "").localeCompare(b.topic || "", "he"));
  if (filter) games = games.filter(g => g.grade === filter);
  if (term) games = games.filter(g => ((g.topic || "") + " " + (g.title || "") + " " + (g.subject || "") + " " + g.code).toLowerCase().includes(term));

  const c = document.getElementById("examsList");
  if (!games.length) { c.innerHTML = "<p class='muted'>לא נמצאו בחינות תואמות.</p>"; return; }
  let html = "", last = null;
  games.forEach(g => {
    const grp = g.grade ? ("כיתה " + g.grade) : (g.subject || "כללי");
    if (grp !== last) { if (last !== null) html += "</div>"; html += `<h3 class="browse-grade">${escapeHtml(grp)}</h3><div class="browse-grid">`; last = grp; }
    html += `
      <button class="game-card" onclick="startExam('${escapeAttr(g.code)}')">
        <span class="game-card-topic">${escapeHtml(g.topic || g.title)}</span>
        <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}</span>
        <span class="game-card-play">📝 התחל מבחן</span>
      </button>`;
  });
  if (last !== null) html += "</div>";
  c.innerHTML = html;
}

async function startExam(code) {
  const name = document.getElementById("examName").value.trim();
  if (!name) { alert("נא להזין שם לפני בחירת בחינה"); return; }
  const minutes = parseInt(document.getElementById("examTime").value) || 0;
  await startExamWith(code, name, minutes);
}

/* התחלת מבחן ישירות (משמש גם מתוך דוח התלמיד) */
async function startExamWith(code, name, minutes) {
  let g;
  try { g = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בטעינת הבחינה"); return; }
  if (!g || !g.questions.length) { alert("הבחינה לא נמצאה"); return; }

  examGame = g; examName = name;
  examQuestions = shuffle(g.questions);   // ערבוב שאלות
  examIndex = 0; examAnswers = [];
  examTimed = minutes > 0; examTotalSec = minutes * 60; examTimeLeft = examTotalSec; examStart = Date.now();

  showScreen("examRunScreen");
  if (examTimed) startExamTimer(); else document.getElementById("examTimerBar").innerHTML = "<span class='timer-num'>⏱️ ללא הגבלת זמן</span>";
  renderExamQuestion();
}

/* מעבר ממסך הדוח ישר למבחן על אותו הנושא */
function startExamFromReport() {
  if (!activeGame || !activeGame.code) { showExams(); return; }
  const name = (typeof student !== "undefined" && student && student.name) ? student.name : "תלמיד";
  startExamWith(activeGame.code, name, 0);
}

function startExamTimer() {
  clearExamTimer();
  updateExamTimer();
  examTimer = setInterval(() => {
    examTimeLeft--;
    updateExamTimer();
    if (examTimeLeft <= 0) { clearExamTimer(); finishExam(true); }
  }, 1000);
}
function updateExamTimer() {
  const el = document.getElementById("examTimerBar");
  if (!el) return;
  const m = Math.floor(examTimeLeft / 60), s = examTimeLeft % 60;
  const pct = examTotalSec ? Math.max(0, examTimeLeft / examTotalSec * 100) : 0;
  const color = examTimeLeft > 60 ? "#27ae60" : examTimeLeft > 20 ? "#f39c12" : "#e74c3c";
  el.innerHTML = `<div class="timer-bar"><div class="timer-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="timer-num">⏱️ ${m}:${String(s).padStart(2, "0")}</span>`;
}

function renderExamQuestion() {
  const n = examQuestions.length;
  if (examIndex >= n) { finishExam(false); return; }
  document.getElementById("examProgress").textContent = "שאלה " + (examIndex + 1) + " מתוך " + n;
  const q = examQuestions[examIndex];
  let answerHtml;
  if (q.type === "open") {
    answerHtml = `<input type="text" id="examInput" class="answer-input" placeholder="כתוב תשובה" autocomplete="off">
      <button class="btn" onclick="examOpenSubmit()">הבא ➡</button>`;
  } else if (q.type === "truefalse") {
    answerHtml = `<button class="btn answer-option" onclick="examAnswer('נכון')">נכון</button>
      <button class="btn answer-option" onclick="examAnswer('לא נכון')">לא נכון</button>`;
  } else {
    answerHtml = shuffle([q.correctAnswer, ...q.wrongAnswers]).map(o =>
      `<button class="btn answer-option" onclick="examAnswer('${escapeAttr(o)}')">${escapeHtml(o)}</button>`).join("");
  }
  document.getElementById("examQuestionBox").innerHTML =
    `<h2 class="question-text">${escapeHtml(q.text)}</h2><div class="answer-area">${answerHtml}</div>`;
  if (q.type === "open") setTimeout(() => document.getElementById("examInput")?.focus(), 100);
}

function examOpenSubmit() {
  const v = document.getElementById("examInput").value.trim();
  if (!v) { alert("נא לכתוב תשובה"); return; }
  examAnswer(v);
}

/* ----- מבחן: רישום תשובה והמשך (בלי משוב תוך כדי) ----- */
function examAnswer(val) {
  const q = examQuestions[examIndex];
  const correct = normalize(val) === normalize(q.correctAnswer);
  examAnswers.push({
    questionId: q.id, questionText: q.text, studentAnswer: val,
    correctAnswer: q.correctAnswer, isCorrect: correct, attempts: 1, coinsEarned: correct ? 10 : 0
  });
  examIndex++;
  renderExamQuestion();
}

async function finishExam(timedOut) {
  clearExamTimer();
  const total = examQuestions.length;
  const correct = examAnswers.filter(a => a.isCorrect).length;
  const pct = total ? Math.round(correct / total * 100) : 0;

  const result = {
    id: "result_" + Date.now(), gameCode: examGame.code, studentName: examName,
    studentGrade: examGame.grade || "", gameType: "exam", playMode: "exam",
    finishedAt: new Date().toLocaleString("he-IL"), silverCoins: 0,
    goldCoins: correct * 10, totalCoins: correct * 10, currentLevel: 0,
    completed: !timedOut, answers: examAnswers.slice()
  };
  try { await saveStudentResult(result); } catch (e) { console.error(e); }
  showExamResult(correct, total, pct, timedOut);
}

function showExamResult(correct, total, pct, timedOut) {
  const pass = pct >= 60;
  const label = pct >= 90 ? "מצוין! 🏆" : pct >= 75 ? "כל הכבוד! 😀" : pass ? "עברת ✓" : "כדאי לתרגל עוד 💪";
  const elapsed = Math.round((Date.now() - examStart) / 1000);
  const mm = Math.floor(elapsed / 60), ss = elapsed % 60;

  const rows = examAnswers.map((a, i) => `
    <tr class="${a.isCorrect ? 'row-ok' : 'row-bad'}">
      <td>${i + 1}</td><td>${escapeHtml(a.questionText)}</td>
      <td>${escapeHtml(a.studentAnswer)}</td><td>${escapeHtml(a.correctAnswer)}</td>
      <td>${a.isCorrect ? "✅" : "❌"}</td>
    </tr>`).join("");

  document.getElementById("examResultBox").innerHTML = `
    <h2 style="text-align:center">📝 תוצאת המבחן</h2>
    ${timedOut ? "<p style='text-align:center;color:#e74c3c;font-weight:bold'>⏰ הזמן נגמר!</p>" : ""}
    <div class="exam-grade ${pass ? 'pass' : 'fail'}">${pct}%</div>
    <p style="text-align:center;font-weight:bold;font-size:1.3rem">${label}</p>
    <div class="report-cards">
      <div class="report-card">👦 ${escapeHtml(examName)}</div>
      <div class="report-card good">✅ נכון: ${correct}</div>
      <div class="report-card bad">❌ שגוי/דילוג: ${total - correct}</div>
      <div class="report-card">❓ ${total} שאלות</div>
      <div class="report-card">⏱️ זמן: ${mm}:${String(ss).padStart(2, "0")}</div>
    </div>
    <div class="table-wrap">
      <table class="report-table">
        <thead><tr><th>#</th><th>השאלה</th><th>תשובתך</th><th>נכונה</th><th>תוצאה</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;

  // פאנל שליחת מייל
  lastEmail = {
    subject: "תוצאת מבחן - " + examName + " - " + examGame.title,
    body: buildExamEmailBody(correct, total, pct)
  };
  mountEmailPanel("examEmail", examGame.creatorEmail || "");

  showScreen("examResultScreen");
  if (pass) setTimeout(() => launchConfetti(pct >= 90 ? 3200 : 2400), 250);   // 🎉 חגיגה בהצלחה
}

function buildExamEmailBody(correct, total, pct) {
  let b = "שלום,\n\n";
  b += "הנבחן/ת " + examName + " סיים/ה מבחן.\n\n";
  b += "מקצוע/נושא: " + (examGame.subject || "") + " — " + examGame.title + "\n";
  b += "ציון: " + pct + "%\n";
  b += "תשובות נכונות: " + correct + " מתוך " + total + "\n";
  b += "תאריך: " + new Date().toLocaleString("he-IL") + "\n";
  return b;
}

function quitExam() {
  clearExamTimer();
  examGame = null; examQuestions = []; examIndex = 0; examAnswers = [];
  showScreen("homeScreen");
}

/* ============================================================
   4. כניסת תלמיד
   ============================================================ */
async function startGame() {
  const name = document.getElementById("studentName").value.trim();
  const grade = document.getElementById("studentGrade").value.trim();
  const code = document.getElementById("gameCode").value.trim();

  if (!name || !code) { alert("נא להזין שם וקוד משחק"); return; }

  let found;
  try { found = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בחיבור למסד הנתונים."); return; }
  if (!found) { alert("הקוד לא נמצא, בדוק שהקלדת נכון."); return; }

  // מאתחלים מצב תלמיד
  activeGame = found;
  student = { name: name, grade: grade || found.grade };
  studentAnswers = [];
  currentAttempts = 0;
  quizMode = false;

  // בחירת סוג המשחק - אותן שאלות, מנוע שונה
  const style = (document.getElementById("gameStyle") || {}).value || "mario";
  const engines = { mario: MarioGame, pacman: PacmanGame, spaceship: SpaceshipGame, maze: MazeGame, bubbles: BubblesGame };
  activeEngine = engines[style] || MarioGame;
  // מריו ובועות משתמשים בפקדי שמאל/ימין/פעולה; השאר ב-D-pad
  const useMarioControls = (style === "mario" || style === "bubbles");

  // עוברים למסך המשחק ומציגים את פקדי המגע המתאימים
  showScreen("marioGameScreen");
  document.getElementById("gameTitleLabel").textContent = found.title + " — " + found.subject;
  document.getElementById("marioControls").style.display = useMarioControls ? "flex" : "none";
  document.getElementById("pacmanControls").style.display = useMarioControls ? "none" : "flex";
  const jb = document.getElementById("jumpBtn");
  if (jb) jb.textContent = (style === "bubbles") ? "🚀 ירה" : "⬆ קפיצה";
  const hints = {
    mario: "מקלדת: חיצים ימינה/שמאלה לתנועה, רווח לקפיצה. הגע לתיבת ה-❓ כדי לענות!",
    pacman: "מקלדת: חיצים לכל הכיוונים. אסוף נקודות, הגע ל-❓ כדי לענות, והיזהר מהרוחות!",
    spaceship: "מקלדת: חיצים לכל הכיוונים. אסוף כוכבים, טוס ל-❓ כדי לענות, והתחמק ממטאורים!",
    maze: "מקלדת: חיצים לכל הכיוונים. ענה על כל ה-❓ כדי לפתוח את היציאה 🏁 והגע אליה!",
    bubbles: "מקלדת: חיצים ימינה/שמאלה לכיוון התותח, רווח לירייה. פגע ב-❓ וענה נכון כדי לפוצץ בועות!"
  };
  document.getElementById("controlsHint").textContent = hints[style] || hints.mario;

  const canvas = document.getElementById("gameCanvas");
  // התאמת גודל הקנבס (מריו משתמש בגודל הזה; פאקמן מגדיר גודל משלו)
  canvas.width = Math.min(900, window.innerWidth - 20);
  canvas.height = 420;

  activeEngine.init({
    canvas: canvas,
    game: found,
    onQuestion: openQuestion,           // נקרא כשנוגעים בתיבת שאלה
    onLevelComplete: finishMarioGame    // נקרא בסיום כל השלבים
  });
}

/* ============================================================
   5. פתיחת שאלה במהלך המשחק
   ============================================================ */
function openQuestion(index) {
  currentQuestionIndex = index;
  currentAttempts = 0;
  renderQuestion(activeGame.questions[index]);
  document.getElementById("questionModal").classList.add("show");
}

/* ----- ציור השאלה בתוך החלון הקופץ ----- */
function renderQuestion(q) {
  document.getElementById("questionText").textContent = q.text;
  document.getElementById("questionFeedback").textContent = "";
  const answerArea = document.getElementById("answerArea");

  if (q.type === "open") {
    // תשובה פתוחה
    answerArea.innerHTML = `
      <input type="text" id="answerInput" class="answer-input" placeholder="כתוב את התשובה" autocomplete="off">
      <button class="btn" onclick="submitAnswer()">שלח תשובה</button>`;
    setTimeout(() => document.getElementById("answerInput").focus(), 100);
  } else if (q.type === "truefalse") {
    // נכון / לא נכון
    answerArea.innerHTML = `
      <button class="btn answer-option" onclick="submitChoice('נכון')">נכון</button>
      <button class="btn answer-option" onclick="submitChoice('לא נכון')">לא נכון</button>`;
  } else {
    // בחירה מרובה - מערבבים את כל התשובות
    const options = shuffle([q.correctAnswer, ...q.wrongAnswers]);
    answerArea.innerHTML = options.map(opt =>
      `<button class="btn answer-option" onclick="submitChoice('${escapeAttr(opt)}')">${escapeHtml(opt)}</button>`
    ).join("");
  }
}

/* ----- שליחת תשובה פתוחה ----- */
function submitAnswer() {
  const val = document.getElementById("answerInput").value.trim();
  if (!val) { alert("נא לכתוב תשובה"); return; }
  checkAnswer(val);
}

/* ----- שליחת בחירה (בחירה מרובה / נכון-לא נכון) ----- */
function submitChoice(val) {
  checkAnswer(val);
}

/* ============================================================
   6. בדיקת תשובה
   ============================================================ */
function checkAnswer(answer) {
  const q = activeGame.questions[currentQuestionIndex];
  currentAttempts++;
  const isCorrect = normalize(answer) === normalize(q.correctAnswer);
  const feedback = document.getElementById("questionFeedback");

  if (isCorrect) {
    // חישוב מטבעות - פחות מטבעות אם היו ניסיונות רבים
    let coins = q.coins;
    if (currentAttempts === 2) coins = Math.round(q.coins * 0.6);
    else if (currentAttempts >= 3) coins = Math.round(q.coins * 0.3);

    feedback.className = "feedback correct";
    feedback.textContent = "כל הכבוד! 🎉 קיבלת " + coins + " מטבעות זהב";

    // שמירת התשובה לדוח
    recordAnswer(q, answer, true, coins);

    // סגירת החלון והמשך המשחק אחרי רגע
    setTimeout(() => {
      closeQuestionModal();
      if (quizMode) nextQuizQuestion();
      else activeEngine.resume(true);
    }, 1200);

  } else {
    feedback.className = "feedback wrong";
    let msg = "נסה שוב 💪";
    if (q.explanation) msg += " — " + q.explanation;
    feedback.textContent = msg;

    // אחרי 3 ניסיונות - מגלים את התשובה וממשיכים עם 0 מטבעות
    if (currentAttempts >= 3) {
      feedback.textContent = "התשובה הנכונה היא: " + q.correctAnswer +
        (q.explanation ? " — " + q.explanation : "");
      recordAnswer(q, answer, false, 0);
      setTimeout(() => {
        closeQuestionModal();
        if (quizMode) nextQuizQuestion();
        else activeEngine.resume(true); // ממשיכים הלאה גם אם טעה (כדי לא להיתקע)
      }, 1800);
    } else if (!quizMode) {
      // במצב משחק - חוזרים למשחק לנסות שוב להגיע לתיבה
      setTimeout(() => {
        closeQuestionModal();
        activeEngine.resume(false);
      }, 1500);
    }
    // במצב quiz נשארים על אותה שאלה לניסיון נוסף
  }
}

/* ----- שמירת תשובה במערך הדוח (מונע כפילות לאותה שאלה) ----- */
function recordAnswer(q, answer, isCorrect, coins) {
  // מסירים רישום קודם לאותה שאלה (אם היה)
  studentAnswers = studentAnswers.filter(a => a.questionId !== q.id);
  studentAnswers.push({
    questionId: q.id,
    questionText: q.text,
    studentAnswer: answer,
    correctAnswer: q.correctAnswer,
    isCorrect: isCorrect,
    attempts: currentAttempts,
    coinsEarned: coins
  });
}

function closeQuestionModal() {
  document.getElementById("questionModal").classList.remove("show");
}

/* ============================================================
   7. סיום משחק מריו -> שמירת דוח והצגתו
   ============================================================ */
function finishMarioGame() {
  const silver = activeEngine.getSilverCoins();
  const lastLevel = activeEngine.getCurrentLevel();
  saveAndShowReport(silver, lastLevel, true);
}

/* ----- בניית דוח, שמירתו והצגתו לתלמיד ----- */
async function saveAndShowReport(silverCoins, lastLevel, completed) {
  const gold = studentAnswers.reduce((sum, a) => sum + a.coinsEarned, 0);
  const correctCount = studentAnswers.filter(a => a.isCorrect).length;
  const wrongCount = studentAnswers.length - correctCount;

  const result = {
    id: "result_" + Date.now(),
    gameCode: activeGame.code,
    studentName: student.name,
    studentGrade: student.grade,
    gameType: activeGame.gameType,
    playMode: quizMode ? "quiz" : "mario",   // נשמר ב-game_sessions.play_mode
    startedAt: "",
    finishedAt: new Date().toLocaleString("he-IL"),
    silverCoins: silverCoins,
    goldCoins: gold,
    totalCoins: silverCoins + gold,
    currentLevel: lastLevel,
    completed: completed,
    answers: studentAnswers.slice()
  };

  try {
    await saveStudentResult(result);
  } catch (e) {
    console.error(e);
    alert("שגיאה בשמירת הדוח, אך הוא יוצג לך כעת.");
  }
  showStudentReport(result, correctCount, wrongCount);
}

/* ============================================================
   8. דוח תלמיד
   ============================================================ */
function showStudentReport(result, correctCount, wrongCount) {
  const game = activeGame;
  const summary = document.getElementById("studentReportSummary");

  // באנר חגיגי לפי הביצועים
  const total = result.answers.length;
  const pct = total ? Math.round(correctCount / total * 100) : 0;
  let emoji, title;
  if (pct >= 90)      { emoji = "🏆"; title = "מדהים! כל הכבוד!"; }
  else if (pct >= 70) { emoji = "🎉"; title = "כל הכבוד!"; }
  else if (pct >= 50) { emoji = "😀"; title = "יפה מאוד!"; }
  else                { emoji = "💪"; title = "כל הכבוד שסיימת!"; }
  const banner = `
    <div class="celebrate-banner">
      <div class="celebrate-emoji">${emoji}</div>
      <div class="celebrate-title">${title}</div>
      <div class="celebrate-sub">ענית נכון על ${correctCount} מתוך ${total} · אספת ${result.totalCoins} מטבעות 💰</div>
    </div>`;

  summary.innerHTML = banner + `
    <div class="report-cards">
      <div class="report-card">👦 ${escapeHtml(result.studentName)}</div>
      <div class="report-card">📚 ${escapeHtml(game.subject)}</div>
      <div class="report-card">🏫 כיתה ${escapeHtml(result.studentGrade)}</div>
      <div class="report-card">❓ ${result.answers.length} שאלות</div>
      <div class="report-card good">✅ נכון: ${correctCount}</div>
      <div class="report-card bad">❌ שגוי: ${wrongCount}</div>
      <div class="report-card">🪙 כסף: ${result.silverCoins}</div>
      <div class="report-card gold">🥇 זהב: ${result.goldCoins}</div>
      <div class="report-card total">💰 סך הכל: ${result.totalCoins}</div>
      <div class="report-card">🏁 שלב אחרון: ${result.currentLevel}</div>
    </div>`;

  // טבלת פירוט
  const tbody = result.answers.map((a, i) => `
    <tr class="${a.isCorrect ? 'row-ok' : 'row-bad'}">
      <td>${i + 1}</td>
      <td>${escapeHtml(a.questionText)}</td>
      <td>${escapeHtml(a.studentAnswer)}</td>
      <td>${escapeHtml(a.correctAnswer)}</td>
      <td>${a.isCorrect ? "✅" : "❌"}</td>
      <td>${a.attempts}</td>
      <td>${a.coinsEarned}</td>
    </tr>`).join("");

  document.getElementById("studentReportTable").innerHTML = `
    <table class="report-table">
      <thead><tr>
        <th>#</th><th>השאלה</th><th>תשובת התלמיד</th><th>תשובה נכונה</th>
        <th>נכון</th><th>ניסיונות</th><th>מטבעות</th>
      </tr></thead>
      <tbody>${tbody}</tbody>
    </table>`;

  // פאנל שליחת מייל (mailto + אוטומטי)
  lastEmail = {
    subject: "דוח תוצאות - " + result.studentName + " - " + game.title,
    body: buildStudentEmailBody(game, result, correctCount, wrongCount)
  };
  mountEmailPanel("reportEmail", game.creatorEmail || "");

  showScreen("studentReportScreen");
  setTimeout(() => launchConfetti(), 250);   // 🎉 חגיגה!
}

function buildStudentEmailBody(game, result, correctCount, wrongCount) {
  let b = "שלום " + (game.creatorName || "") + ",\n\n";
  b += "התלמיד/ה " + result.studentName + " (כיתה " + result.studentGrade + ") סיים/ה את המשחק.\n\n";
  b += "מקצוע: " + game.subject + "\n";
  b += "משחק: " + game.title + "\n";
  b += "תשובות נכונות: " + correctCount + "\n";
  b += "תשובות שגויות: " + wrongCount + "\n";
  b += "מטבעות זהב: " + result.goldCoins + " | כסף: " + result.silverCoins + " | סך הכל: " + result.totalCoins + "\n";
  b += "שלב אחרון: " + result.currentLevel + "\n";
  b += "תאריך: " + result.finishedAt + "\n";
  return b;
}

/* ============================================================
   שליחת דוח במייל (mailto + שליחה אוטומטית דרך Resend)
   ============================================================ */
let lastEmail = { subject: "", body: "" };

function mountEmailPanel(mountId, defaultTo) {
  const el = document.getElementById(mountId);
  if (!el) return;
  el.innerHTML = `
    <div class="form-card email-panel">
      <label>📧 שליחת הדוח במייל למורה / הורה</label>
      <input type="email" class="emailTo" placeholder="כתובת מייל" value="${escapeAttr(defaultTo || "")}">
      <div class="email-btns">
        <button class="btn blue" onclick="emailMailto(this)">📧 פתח באפליקציית המייל</button>
        <button class="btn green" onclick="emailAuto(this)">🚀 שלח אוטומטית</button>
      </div>
      <p class="ai-status email-status"></p>
    </div>`;
}

function emailMailto(btn) {
  const panel = btn.closest(".email-panel");
  const to = panel.querySelector(".emailTo").value.trim();
  window.location.href = "mailto:" + encodeURIComponent(to) +
    "?subject=" + encodeURIComponent(lastEmail.subject) +
    "&body=" + encodeURIComponent(lastEmail.body);
}

async function emailAuto(btn) {
  const panel = btn.closest(".email-panel");
  const to = panel.querySelector(".emailTo").value.trim();
  const status = panel.querySelector(".email-status");
  if (!to) { status.className = "ai-status email-status err"; status.textContent = "נא להזין כתובת מייל"; return; }
  status.className = "ai-status email-status"; status.textContent = "שולח...";
  btn.disabled = true;
  try {
    await sendReportEmail({ to: to, subject: lastEmail.subject, body: lastEmail.body });
    status.className = "ai-status email-status ok";
    status.textContent = "✅ נשלח בהצלחה ל-" + to;
  } catch (e) {
    console.error(e);
    status.className = "ai-status email-status err";
    status.textContent = "לא נשלח אוטומטית: " + e.message + " — אפשר ללחוץ על 'פתח באפליקציית המייל'.";
  } finally { btn.disabled = false; }
}

/* ============================================================
   9. מצב "שאלות בלי משחק" (Quiz)
   ============================================================ */
async function startQuiz() {
  const name = document.getElementById("quizStudentName").value.trim();
  const code = document.getElementById("quizGameCode").value.trim();
  if (!name || !code) { alert("נא להזין שם וקוד משחק"); return; }

  let found;
  try { found = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בחיבור למסד הנתונים."); return; }
  if (!found) { alert("הקוד לא נמצא, בדוק שהקלדת נכון."); return; }

  activeGame = found;
  student = { name: name, grade: found.grade };
  studentAnswers = [];
  currentQuestionIndex = 0;
  quizMode = true;

  showScreen("quizRunScreen");
  showQuizQuestion();
}

/* ----- הצגת שאלה במצב quiz ----- */
function showQuizQuestion() {
  currentAttempts = 0;
  const q = activeGame.questions[currentQuestionIndex];
  document.getElementById("quizProgress").textContent =
    "שאלה " + (currentQuestionIndex + 1) + " מתוך " + activeGame.questions.length;

  document.getElementById("questionText").textContent = q.text;
  // משתמשים באותו חלון שאלה אבל מוטמע במסך (לא מודאל)
  renderQuestionInline(q);
}

/* ----- ציור שאלה בתוך מסך ה-quiz ----- */
function renderQuestionInline(q) {
  const container = document.getElementById("quizQuestionBox");
  let answerHtml = "";

  if (q.type === "open") {
    answerHtml = `
      <input type="text" id="answerInput" class="answer-input" placeholder="כתוב את התשובה" autocomplete="off">
      <button class="btn" onclick="submitAnswer()">שלח תשובה</button>`;
  } else if (q.type === "truefalse") {
    answerHtml = `
      <button class="btn answer-option" onclick="submitChoice('נכון')">נכון</button>
      <button class="btn answer-option" onclick="submitChoice('לא נכון')">לא נכון</button>`;
  } else {
    const options = shuffle([q.correctAnswer, ...q.wrongAnswers]);
    answerHtml = options.map(opt =>
      `<button class="btn answer-option" onclick="submitChoice('${escapeAttr(opt)}')">${escapeHtml(opt)}</button>`
    ).join("");
  }

  container.innerHTML = `
    <h2 class="question-text">${escapeHtml(q.text)}</h2>
    <div class="answer-area">${answerHtml}</div>
    <div id="questionFeedback" class="feedback"></div>`;

  if (q.type === "open") setTimeout(() => document.getElementById("answerInput").focus(), 100);
}

/* ----- מעבר לשאלה הבאה במצב quiz ----- */
function nextQuizQuestion() {
  currentQuestionIndex++;
  if (currentQuestionIndex >= activeGame.questions.length) {
    // סיום ה-quiz -> דוח (בלי מטבעות כסף, בלי שלבים)
    const correctCount = studentAnswers.filter(a => a.isCorrect).length;
    const wrongCount = studentAnswers.length - correctCount;
    saveAndShowReport(0, 0, true);
  } else {
    showQuizQuestion();
  }
}

/* ============================================================
   10. דוחות מורה
   ============================================================ */
async function showTeacherReports() {
  const code = document.getElementById("teacherCode").value.trim();
  if (!code) { alert("נא להזין קוד משחק"); return; }

  let game, results;
  try {
    game = await getGameByCode(code);
    if (!game) { alert("הקוד לא נמצא."); return; }
    results = await getResultsByCode(code);
  } catch (e) {
    console.error(e); alert("שגיאה בחיבור למסד הנתונים."); return;
  }
  const container = document.getElementById("teacherReportsResult");

  if (results.length === 0) {
    container.innerHTML = "<p class='muted'>עדיין אף תלמיד לא שיחק במשחק הזה.</p>";
    return;
  }

  const rows = results.map((r, i) => {
    const correct = r.answers.filter(a => a.isCorrect).length;
    const wrong = r.answers.length - correct;
    return `
      <tr class="clickable" onclick="toggleStudentDetail(${i})">
        <td>${escapeHtml(r.studentName)}</td>
        <td>${escapeHtml(r.studentGrade)}</td>
        <td>${correct}</td>
        <td>${wrong}</td>
        <td>${r.totalCoins}</td>
        <td>${r.currentLevel}</td>
        <td>${escapeHtml(r.finishedAt)}</td>
      </tr>
      <tr id="detail-${i}" class="detail-row" style="display:none">
        <td colspan="7">${buildDetailTable(r)}</td>
      </tr>`;
  }).join("");

  container.innerHTML = `
    <h3>${escapeHtml(game.title)} — ${escapeHtml(game.subject)} (${results.length} תלמידים)</h3>
    <table class="report-table">
      <thead><tr>
        <th>שם תלמיד</th><th>כיתה</th><th>נכונות</th><th>שגויות</th>
        <th>סך מטבעות</th><th>שלב אחרון</th><th>תאריך</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="muted">לחץ על שורת תלמיד כדי לראות פירוט מלא.</p>`;
}

/* ----- בניית טבלת פירוט לתלמיד בודד ----- */
function buildDetailTable(r) {
  const rows = r.answers.map((a, i) => `
    <tr class="${a.isCorrect ? 'row-ok' : 'row-bad'}">
      <td>${i + 1}</td>
      <td>${escapeHtml(a.questionText)}</td>
      <td>${escapeHtml(a.studentAnswer)}</td>
      <td>${escapeHtml(a.correctAnswer)}</td>
      <td>${a.isCorrect ? "✅" : "❌"}</td>
      <td>${a.attempts}</td>
      <td>${a.coinsEarned}</td>
    </tr>`).join("");
  return `<table class="report-table inner">
      <thead><tr><th>#</th><th>שאלה</th><th>תשובה</th><th>נכונה</th><th>נכון</th><th>ניסיונות</th><th>מטבעות</th></tr></thead>
      <tbody>${rows}</tbody></table>`;
}

function toggleStudentDetail(i) {
  const row = document.getElementById("detail-" + i);
  row.style.display = row.style.display === "none" ? "table-row" : "none";
}

/* ============================================================
   11. צפייה בשאלות ללא משחק (תצוגה בלבד)
   ============================================================ */
async function viewQuestions() {
  const code = document.getElementById("viewCode").value.trim();
  if (!code) { alert("נא להזין קוד משחק"); return; }
  let game;
  try { game = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בחיבור למסד הנתונים."); return; }
  if (!game) { alert("הקוד לא נמצא."); return; }

  const html = game.questions.map((q, i) => `
    <div class="q-view">
      <p><b>שאלה ${i + 1}:</b> ${escapeHtml(q.text)}</p>
      <p class="answer-line">תשובה נכונה: <b>${escapeHtml(q.correctAnswer)}</b>
        ${q.wrongAnswers.length ? " | אפשרויות שגויות: " + q.wrongAnswers.map(escapeHtml).join(", ") : ""}</p>
      ${q.explanation ? `<p class="muted">הסבר: ${escapeHtml(q.explanation)}</p>` : ""}
    </div>`).join("");

  document.getElementById("viewQuestionsResult").innerHTML =
    `<h3>${escapeHtml(game.title)} — ${escapeHtml(game.subject)}</h3>` + html;
}

/* ============================================================
   פקדי מגע למשחק (כפתורים במסך טלפון)
   ============================================================ */
function touchPress(dir)   { activeEngine.press(dir); }
function touchRelease(dir) { activeEngine.release(dir); }

/* ----- יציאה מהמשחק חזרה לדף הבית ----- */
function quitGame() {
  activeEngine.stop();
  closeQuestionModal();
  showScreen("homeScreen");
}

/* ============================================================
   פונקציות עזר
   ============================================================ */
// השוואת תשובות בלי רגישות לרווחים/אותיות
function normalize(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

/* ============================================================
   🎉 אנימציית קונפטי חגיגית (קנבס, ללא ספריות)
   ============================================================ */
function launchConfetti(duration) {
  // כיבוד העדפת תנועה מופחתת
  try { if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; } catch (e) {}
  duration = duration || 2800;
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  function resize() { canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
  resize();
  window.addEventListener("resize", resize);

  const colors = ["#e74c3c", "#f1c40f", "#2ecc71", "#3498db", "#9b59b6", "#e67e22", "#1abc9c", "#fd79a8"];
  const W = () => innerWidth, H = () => innerHeight;
  const N = 150, parts = [];
  for (let i = 0; i < N; i++) {
    parts.push({
      x: Math.random() * W(),
      y: -20 - Math.random() * H() * 0.6,
      r: 6 + Math.random() * 9,
      c: colors[(Math.random() * colors.length) | 0],
      vx: (Math.random() - 0.5) * 2,
      vy: 2.2 + Math.random() * 3.8,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.35,
      shape: Math.random() < 0.5 ? "rect" : "circle"
    });
  }
  const start = performance.now();
  function frame(t) {
    const elapsed = t - start;
    ctx.clearRect(0, 0, W(), H());
    parts.forEach(p => {
      p.x += p.vx; p.y += p.vy; p.vy += 0.025; p.rot += p.vr;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      if (p.shape === "rect") ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6);
      else { ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    });
    if (elapsed < duration) requestAnimationFrame(frame);
    else {
      canvas.style.transition = "opacity .6s"; canvas.style.opacity = "0";
      setTimeout(() => { window.removeEventListener("resize", resize); canvas.remove(); }, 650);
    }
  }
  requestAnimationFrame(frame);
}

// ערבוב מערך (Fisher-Yates)
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// בריחה מתווי HTML למניעת שבירת עיצוב
function escapeHtml(s) {
  return (s || "").toString()
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
// בריחה לשימוש בתוך מרכאות בודדות ב-onclick
function escapeAttr(s) {
  return (s || "").toString().replace(/'/g, "\\'").replace(/"/g, "&quot;");
}
