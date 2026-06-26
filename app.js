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
let currentScreenId = "homeScreen";
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
  currentScreenId = id;
  window.scrollTo(0, 0);
  // בורר הדמויות נבנה בכל הגעה למסך הכניסה (גם דרך "בחר משחק")
  if (id === "studentLoginScreen" && typeof buildAvatarPicker === "function") buildAvatarPicker();
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
  populateGameCodes();     // מילוי תיבת הקודים הנפתחת (לכניסת תלמיד)
});

/* ----- מילוי תיבת הקודים הנפתחת עם כל המשחקים (חיפוש לפי קוד/שם) ----- */
async function populateGameCodes() {
  const list = document.getElementById("gameCodesDatalist");
  if (!list) return;
  let games;
  try { games = await listGames(); }
  catch (e) { console.error("שגיאה בטעינת רשימת הקודים", e); return; }

  games.sort((a, b) => (a.gradeOrder - b.gradeOrder) || a.code.localeCompare(b.code));
  list.innerHTML = "";
  games.forEach(g => {
    const opt = document.createElement("option");
    opt.value = g.code;  // הערך שייכנס לשדה הוא הקוד עצמו
    const parts = [g.title || g.topic || "משחק"];
    if (g.grade) parts.push("כיתה " + g.grade);
    if (g.subject) parts.push(g.subject);
    opt.textContent = parts.join(" · ");  // תיאור לזיהוי המשחק ברשימה
    list.appendChild(opt);
  });
}

/* ----- פתיחת מסכי כניסה עם רענון רשימת הקודים ----- */
function showStudentLogin() { populateGameCodes(); buildAvatarPicker(); showScreen("studentLoginScreen"); }

/* ============================================================
   🎭 בחירת דמות לשחקן (אווטאר) + העלאת תמונה אישית
   ============================================================ */
const AVATARS = ["🐰", "🐱", "🐶", "🦊", "🐵", "🦄", "🤖", "🐯", "🐼", "🐸", "🦁", "🐧", "🐲", "🚀", "⭐",
  "🐻", "🐨", "🐮", "🐷", "🐔", "🦉", "🦋", "🐙", "🐠", "🦖", "🐢", "🐝", "🦝", "👽", "🦸", "🧙", "🥷", "🐉", "🦕", "🦜", "🦈", "🐺", "🍄", "👾", "🎃"];
let selectedAvatar = { type: "default" };
let uploadedAvatarImg = null;
const AVATAR_KEY = "playerAvatarPref";
function saveAvatarPref(pref) { try { localStorage.setItem(AVATAR_KEY, JSON.stringify(pref)); } catch (e) {} }

function buildAvatarPicker() {
  const c = document.getElementById("avatarPicker");
  if (!c || c.dataset.built) return;
  c.dataset.built = "1";
  let html = '<button type="button" class="avatar-opt selected" data-type="default" onclick="selectAvatar(this)" title="דמות רגילה">🙂</button>';
  AVATARS.forEach(e => { html += `<button type="button" class="avatar-opt" data-type="emoji" data-val="${e}" onclick="selectAvatar(this)">${e}</button>`; });
  html += '<button type="button" class="avatar-opt avatar-upload" onclick="document.getElementById(\'avatarUpload\').click()" title="העלה תמונה">📷</button>';
  c.innerHTML = html;
  restoreAvatarPref();
}

/* שחזור הדמות שנשמרה מהכניסה הקודמת */
function restoreAvatarPref() {
  let pref;
  try { pref = JSON.parse(localStorage.getItem(AVATAR_KEY) || "null"); } catch (e) { pref = null; }
  if (!pref) return;
  if (pref.type === "emoji") {
    const b = [...document.querySelectorAll("#avatarPicker .avatar-opt")].find(x => x.dataset.val === pref.value);
    if (b) selectAvatar(b);
  } else if (pref.type === "image" && pref.data) {
    const img = new Image();
    img.onload = () => {
      uploadedAvatarImg = img; selectedAvatar = { type: "image" };
      document.querySelectorAll("#avatarPicker .avatar-opt").forEach(b => b.classList.remove("selected"));
      const ub = document.querySelector("#avatarPicker .avatar-upload");
      if (ub) { ub.classList.add("selected"); ub.innerHTML = '<img class="avatar-thumb" src="' + pref.data + '" alt="">'; }
    };
    img.src = pref.data;
  }
}

function selectAvatar(btn) {
  document.querySelectorAll("#avatarPicker .avatar-opt").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  selectedAvatar = (btn.dataset.type === "emoji") ? { type: "emoji", value: btn.dataset.val } : { type: "default" };
  saveAvatarPref(selectedAvatar);
}

function downscaleImage(img, max) {
  let w = img.width, h = img.height;
  if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max; } else { w = Math.round(w * max / h); h = max; } }
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.85);
}

function onAvatarUpload(e) {
  const f = e.target.files && e.target.files[0];
  if (!f) return;
  if (!/^image\//.test(f.type)) { alert("נא לבחור קובץ תמונה"); return; }
  const reader = new FileReader();
  reader.onload = () => {
    const raw = new Image();
    raw.onload = () => {
      const smallUrl = downscaleImage(raw, 256);   // הקטנה לחיסכון מקום וביצועים
      const img = new Image();
      img.onload = () => {
        uploadedAvatarImg = img;
        selectedAvatar = { type: "image" };
        saveAvatarPref({ type: "image", data: smallUrl });   // נשמר לכניסה הבאה
        document.querySelectorAll("#avatarPicker .avatar-opt").forEach(b => b.classList.remove("selected"));
        const ub = document.querySelector("#avatarPicker .avatar-upload");
        if (ub) { ub.classList.add("selected"); ub.innerHTML = '<img class="avatar-thumb" src="' + smallUrl + '" alt="">'; }
      };
      img.src = smallUrl;
    };
    raw.onerror = () => alert("לא ניתן לטעון את התמונה");
    raw.src = reader.result;
  };
  reader.readAsDataURL(f);
}

/* נקרא ב-startGame: קובע את האווטאר הפעיל שכל המנועים מציירים */
function applySelectedAvatar() {
  if (selectedAvatar.type === "emoji") window.PLAYER_AVATAR = { type: "emoji", value: selectedAvatar.value };
  else if (selectedAvatar.type === "image" && uploadedAvatarImg) window.PLAYER_AVATAR = { type: "image", img: uploadedAvatarImg };
  else window.PLAYER_AVATAR = null;
}

/* מצויר ע"י כל מנועי המשחק במקום הדמות, אם נבחר אווטאר. מחזיר true אם צויר. */
window.drawPlayerAvatar = function (ctx, cx, cy, size) {
  const a = window.PLAYER_AVATAR;
  if (!a) return false;
  if (a.type === "emoji") {
    ctx.save();
    ctx.font = "bold " + Math.round(size) + "px Arial";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(a.value, cx, cy);
    ctx.restore();
    return true;
  }
  if (a.type === "image" && a.img) {
    const s = size;
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(a.img, cx - s / 2, cy - s / 2, s, s);
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, s / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 2; ctx.stroke();
    return true;
  }
  return false;
};
function openTeacherReports() { populateGameCodes(); showScreen("teacherReportsScreen"); }
function showQuizOnly()     { populateGameCodes(); showScreen("quizOnlyScreen"); }

/* ----- מילוי הרשימות הנפתחות -----
   במצב Supabase: הערכים הם מזהים (uuid) מהטבלאות.
   במצב מקומי: הערכים הם שמות מתוך appConfig. */
function fillDropdowns() {
  const gradeSel    = document.getElementById("grade");
  const subjectSel  = document.getElementById("subject");
  const topicList   = document.getElementById("topicsDatalist");
  const gameTypeSel = document.getElementById("gameType");
  [gradeSel, subjectSel, topicList, gameTypeSel].forEach(s => s.innerHTML = "");

  // הנושא הוא שדה טקסט חופשי עם רשימת הצעות (datalist) — אפשר לבחור קיים או להקליד חדש
  if (USE_SUPABASE) {
    lookups.grades.forEach(g => gradeSel.add(new Option("כיתה " + g.name, g.id)));
    lookups.subjects.forEach(s => subjectSel.add(new Option(s.name, s.id)));
    lookups.topics.forEach(t => topicList.appendChild(new Option(t.name)));
    lookups.gameTypes.forEach(gt => gameTypeSel.add(new Option(gt.name, gt.id)));
  } else {
    appConfig.grades.forEach(g => gradeSel.add(new Option("כיתה " + g, g)));
    gradeSel.value = "א";
    appConfig.subjects.forEach(s => subjectSel.add(new Option(s, s)));
    subjectSel.value = "חשבון";
    appConfig.topics.forEach(t => topicList.appendChild(new Option(t)));
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
    topic: document.getElementById("topic").value.trim(),
    subTopic: document.getElementById("subTopic").value.trim(),
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
  const topic = document.getElementById("topic").value.trim();
  const subTopic = document.getElementById("subTopic").value.trim();
  const difficulty = document.getElementById("aiDifficulty").value || "קל";
  const type = document.getElementById("aiType").value || "multiple";

  status.className = "ai-status";
  status.textContent = "🤖 יוצר " + count + " שאלות... זה עשוי לקחת מספר שניות";
  btn.disabled = true;

  try {
    const qs = await generateQuestionsAI({ subject, grade: gradeText, topic, subTopic, count, difficulty, type });
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
   ייבוא שאלות מקובץ (Excel / CSV / טקסט)
   ============================================================ */

/* כותרות העמודות המוכרות (גמיש - תומך בכמה ניסוחים) */
function matchColumn(key) {
  const k = (key || "").toString().trim().toLowerCase().replace(/["']/g, "");
  if (/(שאל|question|q\b)/.test(k)) return "text";
  if (/(נכונה|תשובה נכונה|correct|answer|תשובה)/.test(k)) return "correct";
  if (/(שגוי|מסיח|wrong|distract|אפשרויות)/.test(k)) return "wrong";
  if (/(סוג|type)/.test(k)) return "type";
  if (/(קוש|רמה|difficult|level)/.test(k)) return "difficulty";
  if (/(מטבע|coin|points|נקוד)/.test(k)) return "coins";
  if (/(הסבר|expl|explanation)/.test(k)) return "explanation";
  return null;
}

function normType(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (/(true|false|נכון|לא נכון|truefalse)/.test(s)) return "truefalse";
  if (/(open|פתוח)/.test(s)) return "open";
  return "multiple";
}
function normDifficulty(v) {
  const s = (v || "").toString().trim().toLowerCase();
  if (/(בינוני|medium)/.test(s)) return "medium";
  if (/(קשה|hard)/.test(s)) return "hard";
  return "easy";
}
function splitWrongs(v) {
  if (v == null) return [];
  return v.toString().split(/[,;|]/).map(s => s.trim()).filter(Boolean);
}

/* המרת שורה (אובייקט עם מפתחות עבריים/אנגליים) לשאלה פנימית */
function rowToQuestion(row, idx) {
  const mapped = {};
  Object.keys(row).forEach(key => {
    const col = matchColumn(key);
    if (col && mapped[col] == null) mapped[col] = row[key];
  });
  const text = (mapped.text || "").toString().trim();
  const correct = (mapped.correct == null ? "" : mapped.correct).toString().trim();
  if (!text || !correct) return null; // שורה לא תקינה
  return {
    id: "qimp_" + Date.now() + "_" + idx,
    text: text,
    type: normType(mapped.type),
    correctAnswer: correct,
    wrongAnswers: splitWrongs(mapped.wrong),
    difficulty: normDifficulty(mapped.difficulty),
    coins: parseInt(mapped.coins) || 10,
    explanation: (mapped.explanation || "").toString().trim()
  };
}

/* פירוק פורמט הטקסט הפשוט: כל שורה  שאלה | תשובה | שגויות | הסבר */
function parseTextFormat(content) {
  const out = [];
  content.split(/\r?\n/).forEach((line, i) => {
    const t = line.trim();
    if (!t || t.startsWith("#")) return; // דילוג על שורות ריקות / הערות
    const parts = t.split("|").map(s => s.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) return;
    out.push({
      id: "qimp_" + Date.now() + "_" + i,
      text: parts[0],
      type: "multiple",
      correctAnswer: parts[1],
      wrongAnswers: splitWrongs(parts[2]),
      difficulty: "easy",
      coins: 10,
      explanation: parts[3] || ""
    });
  });
  return out;
}

/* פירוק גיליון Excel/CSV דרך SheetJS - תומך בכותרות או במבנה לפי מיקום */
function parseSheet(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!sheet) return [];
  // raw:true מונע המרה אוטומטית של ערכים כמו "8,9,11" לתאריך/מספר
  const rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: true });
  // אם יש כותרות מוכרות - נשתמש בהן
  const hasKnownHeaders = rows.length && Object.keys(rows[0]).some(k => matchColumn(k));
  if (hasKnownHeaders) {
    return rows.map((r, i) => rowToQuestion(r, i)).filter(Boolean);
  }
  // אחרת - לפי מיקום: שאלה, תשובה, שגויות, סוג, קושי, מטבעות, הסבר
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const out = [];
  aoa.forEach((cells, i) => {
    if (i === 0 && /שאל|question/i.test((cells[0] || "").toString())) return; // דילוג על כותרת
    const text = (cells[0] || "").toString().trim();
    const correct = (cells[1] == null ? "" : cells[1]).toString().trim();
    if (!text || !correct) return;
    out.push({
      id: "qimp_" + Date.now() + "_" + i,
      text: text,
      type: normType(cells[3]),
      correctAnswer: correct,
      wrongAnswers: splitWrongs(cells[2]),
      difficulty: normDifficulty(cells[4]),
      coins: parseInt(cells[5]) || 10,
      explanation: (cells[6] || "").toString().trim()
    });
  });
  return out;
}

async function importQuestionsFile() {
  if (!draftGame) { alert("צור קודם משחק"); return; }
  const input = document.getElementById("importFile");
  const status = document.getElementById("importStatus");
  const file = input.files && input.files[0];
  if (!file) return;

  status.className = "ai-status";
  status.textContent = "📥 קורא את הקובץ...";

  try {
    const name = file.name.toLowerCase();
    let questions = [];

    if (name.endsWith(".txt")) {
      const text = await file.text();
      // טקסט עם | -> פורמט פשוט; אחרת ננסה לפרק כ-CSV
      questions = text.includes("|")
        ? parseTextFormat(text)
        : parseSheet(XLSX.read(text, { type: "string", raw: true }));
    } else if (name.endsWith(".csv")) {
      const text = await file.text();
      questions = parseSheet(XLSX.read(text, { type: "string", raw: true }));
    } else {
      const buf = await file.arrayBuffer();
      questions = parseSheet(XLSX.read(buf, { type: "array", raw: true }));
    }

    if (!questions.length) {
      status.className = "ai-status err";
      status.textContent = "לא נמצאו שאלות תקינות בקובץ. ודאו שיש עמודת שאלה ועמודת תשובה נכונה (הורידו תבנית לדוגמה).";
      input.value = "";
      return;
    }

    draftGame.questions.push(...questions);
    renderQuestionsList();
    status.className = "ai-status ok";
    status.textContent = "✅ יובאו " + questions.length + " שאלות מהקובץ! אפשר לערוך, להוסיף עוד, או לסיים.";
  } catch (e) {
    console.error(e);
    status.className = "ai-status err";
    status.textContent = "שגיאה בקריאת הקובץ: " + e.message;
  } finally {
    input.value = ""; // לאפשר העלאה חוזרת של אותו קובץ
  }
}

/* הורדת תבנית לדוגמה בפורמט המבוקש */
function downloadTemplate(kind) {
  const header = ["שאלה", "תשובה נכונה", "תשובות שגויות", "סוג", "רמת קושי", "מטבעות", "הסבר"];
  const examples = [
    ["כמה זה 4 + 3?", "7", "5, 6, 8", "בחירה מרובה", "קל", "10", "4 ועוד 3 הם 7"],
    ["בירת ישראל היא ירושלים", "נכון", "לא נכון", "נכון/לא נכון", "קל", "10", "ירושלים היא בירת ישראל"],
    ["מהי בירת צרפת?", "פריז", "", "תשובה פתוחה", "בינוני", "15", "פריז היא בירת צרפת"]
  ];

  if (kind === "txt") {
    const lines = [
      "# כל שורה היא שאלה אחת, בפורמט:  שאלה | תשובה נכונה | תשובות שגויות (מופרדות בפסיק) | הסבר",
      "# שורות שמתחילות ב-# הן הערות ויידלגו.",
      "כמה זה 4 + 3? | 7 | 5, 6, 8 | 4 ועוד 3 הם 7",
      "מהי בירת צרפת? | פריז |  | פריז היא בירת צרפת"
    ];
    downloadBlob("תבנית-שאלות.txt", "﻿" + lines.join("\n"), "text/plain;charset=utf-8");
    return;
  }

  const aoa = [header, ...examples];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  if (kind === "csv") {
    const csv = XLSX.utils.sheet_to_csv(ws);
    downloadBlob("תבנית-שאלות.csv", "﻿" + csv, "text/csv;charset=utf-8");
  } else {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "שאלות");
    XLSX.writeFile(wb, "תבנית-שאלות.xlsx");
  }
}

function downloadBlob(filename, content, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

/* ============================================================
   אשף תלמיד: בחירת סוג משחק (שלב 1) -> בחירת נושא (שלב 2)
   ============================================================ */
const STYLE_META = {
  mario:     { emoji: "🍄", name: "סופר מריו" },
  pacman:    { emoji: "🟡", name: "פאקמן" },
  spaceship: { emoji: "🚀", name: "חללית" },
  maze:      { emoji: "🧩", name: "מבוך" },
  bubbles:   { emoji: "🎯", name: "בועות" },
  temple:    { emoji: "🏃", name: "ריצה אינסופית" },
  flappy:    { emoji: "🐤", name: "ציפור מעופפת" },
  snake:     { emoji: "🐍", name: "נחש" },
  frogger:   { emoji: "🐸", name: "צפרדע" },
  hoops:     { emoji: "🏀", name: "קליעה לסל" },
  climber:   { emoji: "🧗", name: "טיפוס קפיצות" }
};
const SUBJECT_META = {
  "חשבון":     { emoji: "➗", c1: "#3aa0e6", c2: "#1f6aa3" },
  "אנגלית":    { emoji: "🔤", c1: "#a55fd0", c2: "#7d3aa0" },
  "עברית":     { emoji: "✍️", c1: "#e17055", c2: "#c0392b" },
  "מדעים":     { emoji: "🔬", c1: "#1ec9a6", c2: "#128a72" },
  "תורה":      { emoji: "📖", c1: "#f6a833", c2: "#df6f1a" },
  "פסיכומטרי": { emoji: "🧠", c1: "#6166e0", c2: "#3f44b0" }
};
let wizardStyle = null, wizardSubject = null;

function showGamePicker() { wizardStyle = null; wizardSubject = null; showScreen("homeScreen"); }

function chooseGameStyle(style) { wizardStyle = style; showSubjects(); }

/* שלב 2 — קוביות מקצוע */
async function showSubjects() {
  showScreen("subjectScreen");
  const sb = document.getElementById("subjectStyleBanner");
  if (sb && wizardStyle && STYLE_META[wizardStyle]) {
    const m = STYLE_META[wizardStyle];
    sb.innerHTML = `<span>סוג המשחק: <b>${m.emoji} ${escapeHtml(m.name)}</b></span><button class="btn-small" onclick="showGamePicker()">🔄 החלף</button>`;
    sb.style.display = "flex";
  }
  const c = document.getElementById("subjectCubes");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  try { browseGames = await listGames(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }

  const subjects = [...new Set(browseGames.filter(g => !isBandGame(g)).map(g => g.subject).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, "he"));
  const bands = [...new Set(browseGames.filter(g => isBandGame(g)).map(g => g.topic))].sort();
  const cube = (val, emoji, name, desc, c1, c2) =>
    `<button class="style-card" style="--c1:${c1};--c2:${c2}" onclick="chooseSubject('${escapeAttr(val)}')">
      <span class="style-emoji">${emoji}</span><span class="style-name">${escapeHtml(name)}</span>
      <span class="style-desc">${escapeHtml(desc)}</span></button>`;
  let html = "";
  subjects.forEach(s => {
    const m = SUBJECT_META[s] || { emoji: "📚", c1: "#5d6d7e", c2: "#34495e" };
    const n = browseGames.filter(g => g.subject === s && !isBandGame(g)).length;
    html += cube("subject:" + s, m.emoji, s, n + " משחקים", m.c1, m.c2);
  });
  bands.forEach(b => html += cube("band:" + b, "📘", b, "אוצר מילים", "#4a4fc0", "#3a3f9e"));
  c.innerHTML = html;
}

function chooseSubject(val) { wizardSubject = val; showBrowse(); }

function backFromBrowse() {
  if (wizardStyle) showSubjects();      // חזרה לקוביות המקצוע
  else showScreen("homeScreen");
}

function renderStyleBanner() {
  const b = document.getElementById("browseStyleBanner");
  if (!b) return;
  if (wizardStyle && STYLE_META[wizardStyle]) {
    const m = STYLE_META[wizardStyle];
    b.innerHTML = `<span>סוג המשחק: <b>${m.emoji} ${escapeHtml(m.name)}</b></span>
      <button class="btn-small" onclick="showSubjects()">🔄 החלף מקצוע</button>`;
    b.style.display = "flex";
  } else {
    b.innerHTML = ""; b.style.display = "none";
  }
}

async function showBrowse() {
  showScreen("browseScreen");
  renderStyleBanner();
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

  // אם נבחר מקצוע באשף — מסננים אליו אוטומטית
  if (wizardSubject) { subSel.value = wizardSubject; }

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
          <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}${g.subTopic ? " · " + escapeHtml(g.subTopic) : ""}</span>
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
  // אם נבחר סוג משחק באשף — נטמיע אותו אוטומטית
  if (wizardStyle) { const gs = document.getElementById("gameStyle"); if (gs) gs.value = wizardStyle; }
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
        <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}${g.subTopic ? " · " + escapeHtml(g.subTopic) : ""}</span>
        <span class="game-card-play">▶ שחק</span>
      </button>`;
  });
  if (last !== null) html += "</div>";
  c.innerHTML = html;
}

/* ============================================================
   פסיכומטרי לילדים — משחקי חשיבה והיגיון לכיתות א–ו
   ============================================================ */
async function showPsycho() {
  showScreen("psychoScreen");
  const c = document.getElementById("psychoList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  let games;
  try { games = await listGames(); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה.</p>"; return; }

  const list = games
    .filter(g => g.subject === "פסיכומטרי")
    .sort((a, b) => (a.gradeOrder - b.gradeOrder) || a.code.localeCompare(b.code));

  if (!list.length) { c.innerHTML = "<p class='muted'>עדיין אין משחקי פסיכומטרי זמינים.</p>"; return; }

  c.innerHTML = '<div class="browse-grid">' + list.map(g => `
    <button class="game-card" onclick="pickGame('${escapeAttr(g.code)}','${escapeAttr(g.grade)}')">
      <span class="game-card-topic">🧠 כיתה ${escapeHtml(g.grade)}</span>
      <span class="game-card-sub">${escapeHtml(g.title)} · ${escapeHtml(g.code)}</span>
      <span class="game-card-play">▶ שחק</span>
    </button>`).join("") + "</div>";
}

/* ============================================================
   ✨ משחקים מומלצים אישית — לפי פרופיל הילד וההתקדמות
   ============================================================ */
function showRecommend() {
  showScreen("recommendScreen");
  // מילוי רשימת הכיתות
  const sel = document.getElementById("recoGrade");
  if (sel && !sel.options.length) {
    sel.innerHTML = "<option value=''>בחר/י כיתה</option>";
    (appConfig.grades || []).forEach(g => sel.add(new Option("כיתה " + g, g)));
  }
  // מילוי אוטומטי אם תלמיד כבר מחובר
  if (typeof student !== "undefined" && student) {
    if (student.name)  document.getElementById("recoName").value = student.name;
    if (student.grade) document.getElementById("recoGrade").value = student.grade;
  }
  document.getElementById("recoSummary").innerHTML = "";
  document.getElementById("recoList").innerHTML = "";
}

function recoCard(g) {
  return `
    <button class="game-card" onclick="pickGame('${escapeAttr(g.code)}','${escapeAttr(g.grade)}')">
      <span class="game-card-topic">${escapeHtml(g.topic || g.title)}</span>
      <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}</span>
      <span class="game-card-play">▶ שחק</span>
    </button>`;
}
function recoBucket(title, subtitle, games) {
  if (!games.length) return "";
  return `<h3 class="browse-grade">${title}</h3>` +
    (subtitle ? `<p class="muted" style="margin:-2px 0 8px">${subtitle}</p>` : "") +
    `<div class="browse-grid">` + games.map(recoCard).join("") + `</div>`;
}

async function getRecommendations() {
  const name = document.getElementById("recoName").value.trim();
  let grade = document.getElementById("recoGrade").value;
  const summary = document.getElementById("recoSummary");
  const list = document.getElementById("recoList");
  if (!name) { alert("נא להזין שם"); return; }
  list.innerHTML = "<p class='muted'>טוען המלצות...</p>"; summary.innerHTML = "";

  let games, history;
  try {
    games = await listGames();
    history = await getStudentHistory(name);
  } catch (e) { console.error(e); list.innerHTML = "<p class='muted'>שגיאה בטעינת ההמלצות.</p>"; return; }

  // משחקים "רגילים" בלבד (לא Bands) להמלצות לפי כיתה
  const normal = games.filter(g => !isBandGame(g));
  // אם לא נבחרה כיתה — מנסים להסיק מההיסטוריה
  if (!grade && history.length) {
    const gc = {}; history.forEach(h => { if (h.grade) gc[h.grade] = (gc[h.grade] || 0) + 1; });
    grade = Object.keys(gc).sort((a, b) => gc[b] - gc[a])[0] || "";
  }

  const playedCodes = new Set(history.filter(h => h.code).map(h => h.code));

  // ביצועים לפי מקצוע
  const perSub = {};
  history.forEach(h => {
    if (!h.subject || h.total == null || h.total === 0) return;
    const e = perSub[h.subject] || { correct: 0, total: 0 };
    e.correct += h.correct; e.total += h.total; perSub[h.subject] = e;
  });
  const subPct = {}; Object.keys(perSub).forEach(s => subPct[s] = Math.round(perSub[s].correct / perSub[s].total * 100));
  const weakSubjects = Object.keys(subPct).filter(s => subPct[s] < 70);
  const strongSubjects = Object.keys(subPct).filter(s => subPct[s] >= 85);

  // סיכום פרופיל
  if (history.length) {
    const totalCoins = history.reduce((a, h) => a + (h.coins || 0), 0);
    let txt = `שיחקת ${history.length} משחקים · אספת ${totalCoins} מטבעות 💰`;
    if (strongSubjects.length) txt += ` · חזק/ה ב: ${strongSubjects.join(", ")} 💪`;
    if (weakSubjects.length) txt += ` · כדאי לחזק: ${weakSubjects.join(", ")}`;
    summary.innerHTML = `<div class="reco-profile">👤 <b>${escapeHtml(name)}</b>${grade ? " · כיתה " + escapeHtml(grade) : ""}<br>${txt}</div>`;
  } else {
    summary.innerHTML = `<div class="reco-profile">👤 <b>${escapeHtml(name)}</b>${grade ? " · כיתה " + escapeHtml(grade) : ""}<br>עדיין אין היסטוריית משחקים — הנה כמה משחקים מצוינים להתחלה!</div>`;
  }

  const gradeGames = grade ? normal.filter(g => g.grade === grade) : normal;
  const take = (arr, n) => arr.slice(0, n);
  let html = "";

  // 1) חיזוק לפי מקצועות חלשים
  if (weakSubjects.length) {
    const weakGames = gradeGames.filter(g => weakSubjects.includes(g.subject));
    const unplayedWeak = weakGames.filter(g => !playedCodes.has(g.code));
    const pick = (unplayedWeak.length ? unplayedWeak : weakGames);
    html += recoBucket("💪 כדאי לחזק", "תרגול נוסף במקצועות שבהם אפשר להשתפר", take(pick, 6));
  }

  // 2) מומלצים לכיתה — חדשים שעוד לא שיחקת, מקצועות שעוד לא ניסית קודם
  const unplayed = gradeGames.filter(g => !playedCodes.has(g.code));
  const triedSubjects = new Set(Object.keys(perSub));
  const fresh = unplayed.filter(g => !triedSubjects.has(g.subject));
  const restUnplayed = unplayed.filter(g => triedSubjects.has(g.subject));
  const reco2 = take([...fresh, ...restUnplayed], 8);
  html += recoBucket(history.length ? "⭐ מומלצים לכיתה שלך" : "⭐ מומלצים להתחלה",
    grade ? ("משחקים חדשים לכיתה " + grade) : "", reco2);

  // 3) אתגר הבא — כיתה מעל, במקצועות חזקים
  if (strongSubjects.length && grade) {
    const gi = (appConfig.grades || []).indexOf(grade);
    const next = gi >= 0 ? (appConfig.grades || [])[gi + 1] : null;
    if (next) {
      const challenge = normal.filter(g => g.grade === next && strongSubjects.includes(g.subject));
      html += recoBucket("🚀 מוכן/ה לאתגר הבא?", "כיתה " + next + " — במקצועות שאתה חזק בהם", take(challenge, 6));
    }
  }

  list.innerHTML = html || "<p class='muted'>לא נמצאו המלצות מתאימות. נסו לבחור כיתה.</p>";
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
let examAnswered = false;   // מונע לחיצה כפולה בזמן הצגת המשוב
let examParentEmail = "", examTeacherEmail = "";   // נמענים לשליחת תוצאות המבחן

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
      <div class="game-card exam-card">
        <span class="game-card-topic">${escapeHtml(g.topic || g.title)}</span>
        <span class="game-card-sub">${escapeHtml(g.subject)} · ${escapeHtml(g.code)}${g.subTopic ? " · " + escapeHtml(g.subTopic) : ""}</span>
        <div class="exam-card-actions">
          <button class="btn green exam-go" onclick="startExam('${escapeAttr(g.code)}')">📝 התחל מבחן</button>
          <button class="btn-small exam-pdf" onclick="exportExamPdf('${escapeAttr(g.code)}')">📄 ייצוא ל-PDF</button>
        </div>
      </div>`;
  });
  if (last !== null) html += "</div>";
  c.innerHTML = html;
}

async function startExam(code) {
  const name = document.getElementById("examName").value.trim();
  if (!name) { alert("נא להזין שם לפני בחירת בחינה"); return; }
  const minutes = parseInt(document.getElementById("examTime").value) || 0;
  const emails = {
    parent:  (document.getElementById("examParentEmail")  || {}).value?.trim() || "",
    teacher: (document.getElementById("examTeacherEmail") || {}).value?.trim() || ""
  };
  await startExamWith(code, name, minutes, emails);
}

/* ----- ייצוא שאלות הבחינה ל-PDF (דרך חלון הדפסה -> "שמירה כ-PDF") ----- */
async function exportExamPdf(code) {
  let g;
  try { g = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בטעינת הבחינה"); return; }
  if (!g || !g.questions.length) { alert("לא נמצאו שאלות לבחינה זו"); return; }

  const letters = ["א", "ב", "ג", "ד", "ה", "ו"];
  let qHtml = "", keyHtml = "";
  g.questions.forEach((q, i) => {
    qHtml += `<div class="q"><div class="qt">${i + 1}. ${escapeHtml(q.text)}</div>`;
    if (q.type === "open") {
      qHtml += `<div class="ans-line">תשובה: ______________________________________</div>`;
      keyHtml += `<div>${i + 1}. ${escapeHtml(q.correctAnswer)}</div>`;
    } else {
      const opts = (q.type === "truefalse") ? ["נכון", "לא נכון"]
                 : shuffle([q.correctAnswer, ...(q.wrongAnswers || [])]);
      qHtml += `<div class="opts">` + opts.map((o, j) =>
        `<div class="opt">${letters[j] || (j + 1)}. ${escapeHtml(o)}</div>`).join("") + `</div>`;
      const ci = opts.findIndex(o => normalize(o) === normalize(q.correctAnswer));
      keyHtml += `<div>${i + 1}. ${letters[ci] || ""} (${escapeHtml(q.correctAnswer)})</div>`;
    }
    qHtml += `</div>`;
  });

  const doc = `<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">
    <title>${escapeHtml(g.title)}</title>
    <style>
      * { box-sizing: border-box; }
      body { font-family: "Heebo", Arial, sans-serif; direction: rtl; color: #1a1a1a; margin: 28px; line-height: 1.5; }
      h1 { font-size: 22px; margin: 0 0 4px; }
      .meta { color: #555; font-size: 13px; margin-bottom: 6px; }
      .name-line { font-size: 14px; border-bottom: 1px solid #999; padding-bottom: 6px; margin-bottom: 18px; }
      .q { margin: 0 0 16px; page-break-inside: avoid; }
      .qt { font-weight: 700; font-size: 16px; margin-bottom: 6px; }
      .opts { padding-right: 18px; }
      .opt { margin: 3px 0; font-size: 15px; }
      .ans-line { color: #444; margin-top: 6px; }
      .key { page-break-before: always; }
      .key h2 { font-size: 18px; border-bottom: 2px solid #333; padding-bottom: 4px; }
      .key div { margin: 3px 0; font-size: 14px; }
      @media print { body { margin: 14mm; } }
    </style></head><body>
    <h1>${escapeHtml(g.title)}</h1>
    <div class="meta">מקצוע: ${escapeHtml(g.subject || "")} · קוד: ${escapeHtml(g.code)} · ${g.questions.length} שאלות</div>
    <div class="name-line">שם: ______________________   כיתה: __________   תאריך: __________   ציון: ______</div>
    ${qHtml}
    <div class="key"><h2>מפתח תשובות (למורה)</h2>${keyHtml}</div>
    </body></html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("הדפדפן חסם את חלון ההדפסה. אנא אפשרו חלונות קופצים (pop-ups) ונסו שוב."); return; }
  w.document.write(doc);
  w.document.close();
  w.focus();
  setTimeout(() => { try { w.print(); } catch (e) {} }, 500);
}

/* התחלת מבחן ישירות (משמש גם מתוך דוח התלמיד) */
async function startExamWith(code, name, minutes, emails) {
  let g;
  try { g = await getGameByCode(code); }
  catch (e) { console.error(e); alert("שגיאה בטעינת הבחינה"); return; }
  if (!g || !g.questions.length) { alert("הבחינה לא נמצאה"); return; }

  examGame = g; examName = name;
  examParentEmail = (emails && emails.parent) || "";
  examTeacherEmail = (emails && emails.teacher) || "";
  examQuestions = shuffle(g.questions);   // ערבוב שאלות
  examIndex = 0; examAnswers = [];
  examTimed = minutes > 0; examTotalSec = minutes * 60; examTimeLeft = examTotalSec; examStart = Date.now();

  showScreen("examRunScreen");
  if (examTimed) startExamTimer(); else document.getElementById("examTimerBar").innerHTML = "<span class='timer-num'>⏱️ ללא הגבלת זמן</span>";
  renderExamQuestion();
}

/* מעבר ממסך הדוח ישר למבחן על אותו הנושא (עם שאלת טיימר) */
function startExamFromReport() {
  if (!activeGame || !activeGame.code) { showExams(); return; }
  const name = (typeof student !== "undefined" && student && student.name) ? student.name : "תלמיד";
  const emails = (typeof student !== "undefined" && student)
    ? { parent: student.parentEmail || "", teacher: student.teacherEmail || "" } : {};
  askExamTimer(minutes => startExamWith(activeGame.code, name, minutes, emails));
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
  examAnswered = false;
  document.getElementById("examProgress").textContent = "שאלה " + (examIndex + 1) + " מתוך " + n;
  const q = examQuestions[examIndex];
  let answerHtml;
  if (q.type === "open") {
    answerHtml = `<input type="text" id="examInput" class="answer-input" placeholder="כתוב תשובה" autocomplete="off"
        onkeydown="if(event.key==='Enter')examOpenSubmit()">
      <button class="btn" id="examSubmitBtn" onclick="examOpenSubmit()">בדיקה ✓</button>`;
  } else if (q.type === "truefalse") {
    answerHtml = `<button class="btn answer-option exam-opt" data-val="נכון" onclick="examAnswer('נכון')">נכון</button>
      <button class="btn answer-option exam-opt" data-val="לא נכון" onclick="examAnswer('לא נכון')">לא נכון</button>`;
  } else {
    answerHtml = shuffle([q.correctAnswer, ...q.wrongAnswers]).map(o =>
      `<button class="btn answer-option exam-opt" data-val="${escapeAttr(o)}" onclick="examAnswer('${escapeAttr(o)}')">${escapeHtml(o)}</button>`).join("");
  }
  const examWord = englishWordFromText(q.text);
  document.getElementById("examQuestionBox").innerHTML =
    `<h2 class="question-text">${escapeHtml(q.text)}${speakerBtnHtml(examWord)}</h2>
     <div class="answer-area">${answerHtml}</div>
     <div class="feedback" id="examFeedback"></div>`;
  if (q.type === "open") setTimeout(() => document.getElementById("examInput")?.focus(), 100);
}

function examOpenSubmit() {
  if (examAnswered) return;
  const v = document.getElementById("examInput").value.trim();
  if (!v) { alert("נא לכתוב תשובה"); return; }
  examAnswer(v);
}

/* ----- מבחן: רישום תשובה + משוב מיידי (✓/✗ + צליל) ואז המשך ----- */
function examAnswer(val) {
  if (examAnswered) return;          // כבר ענו על השאלה הזו
  examAnswered = true;
  const q = examQuestions[examIndex];
  const correct = normalize(val) === normalize(q.correctAnswer);
  examAnswers.push({
    questionId: q.id, questionText: q.text, studentAnswer: val,
    correctAnswer: q.correctAnswer, isCorrect: correct, attempts: 1, coinsEarned: correct ? 10 : 0
  });

  // משוב חזותי
  const box = document.getElementById("examQuestionBox");
  box.querySelectorAll(".exam-opt").forEach(b => {
    b.disabled = true;
    if (b.getAttribute("data-val") === val) b.classList.add(correct ? "opt-correct" : "opt-wrong");
    if (!correct && normalize(b.getAttribute("data-val")) === normalize(q.correctAnswer)) b.classList.add("opt-correct");
  });
  const inp = document.getElementById("examInput");
  if (inp) { inp.disabled = true; const sb = document.getElementById("examSubmitBtn"); if (sb) sb.disabled = true; }

  const fb = document.getElementById("examFeedback");
  if (fb) {
    if (correct) { fb.className = "feedback correct"; fb.innerHTML = "✅ נכון! כל הכבוד"; }
    else { fb.className = "feedback wrong"; fb.innerHTML = "❌ טעות — התשובה הנכונה: <b>" + escapeHtml(q.correctAnswer) + "</b>"; }
  }

  // צליל מותאם
  if (correct) playCorrect(); else playWrong();
  // חיזוק חיובי — הקראת המילה באנגלית בתשובה נכונה
  if (correct) { const w = englishWordFromText(q.text); if (w) setTimeout(() => speakEnglish(w), 350); }

  // מעבר לשאלה הבאה
  setTimeout(() => { examIndex++; renderExamQuestion(); }, correct ? 950 : 1700);
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

  // פאנל שליחת מייל + שליחה אוטומטית להורה/מורה שהוזנו
  lastEmail = {
    subject: "תוצאת מבחן - " + examName + " - " + examGame.title,
    body: buildExamEmailBody(correct, total, pct)
  };
  const examRecipients = buildRecipients(examParentEmail, examTeacherEmail);
  mountEmailPanel("examEmail", examRecipients, examGame.creatorEmail || "");

  showScreen("examResultScreen");
  if (pass) { setTimeout(() => launchConfetti(2200), 200); playVictory(); }   // 🎉🔊 חגיגה קצרה בהצלחה
}

function buildExamEmailBody(correct, total, pct) {
  let b = "שלום,\n\n";
  b += "הנבחן/ת " + examName + " סיים/ה מבחן.\n\n";
  b += "מקצוע/נושא: " + (examGame.subject || "") + " — " + examGame.title + "\n";
  b += "ציון: " + pct + "%\n";
  b += "מספר שאלות במבחן: " + total + "\n";
  b += "תשובות נכונות: " + correct + " מתוך " + total + "\n";
  b += "מטבעות זהב שנאספו: " + (correct * 10) + "\n";
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

  // מאתחלים מצב תלמיד (כולל כתובות מייל אופציונליות להורה/מורה)
  activeGame = found;
  student = {
    name: name, grade: grade || found.grade,
    parentEmail: (document.getElementById("parentEmail") || {}).value?.trim() || "",
    teacherEmail: (document.getElementById("teacherEmail") || {}).value?.trim() || "",
    timerOn: (document.getElementById("timerEnabled") || { checked: true }).checked
  };
  studentAnswers = [];
  currentAttempts = 0;
  quizMode = false;

  applySelectedAvatar();   // 🎭 קביעת הדמות שנבחרה

  const style = (document.getElementById("gameStyle") || {}).value || "mario";
  launchGameEngine(style);
}

/* ----- הפעלת מנוע המשחק (משותף ל"התחל" ול"שחק שוב") ----- */
let lastGameStyle = "mario";
function launchGameEngine(style) {
  lastGameStyle = style;
  const engines = { mario: MarioGame, pacman: PacmanGame, spaceship: SpaceshipGame, maze: MazeGame, bubbles: BubblesGame, temple: TempleRunGame, flappy: FlappyGame, snake: SnakeGame, frogger: FroggerGame, hoops: HoopsGame, climber: ClimberGame };
  activeEngine = engines[style] || MarioGame;
  // משחקים עם כפתור פעולה אחד (שמאל/ימין/פעולה); השאר ב-D-pad של 4 כיוונים
  const useMarioControls = (style === "mario" || style === "bubbles" || style === "flappy" || style === "hoops");

  showScreen("marioGameScreen");
  document.getElementById("gameTitleLabel").textContent = activeGame.title + " — " + activeGame.subject;
  document.getElementById("marioControls").style.display = useMarioControls ? "flex" : "none";
  document.getElementById("pacmanControls").style.display = useMarioControls ? "none" : "flex";
  document.getElementById("marioGameScreen").classList.toggle("dpad-mode", !useMarioControls);
  const jb = document.getElementById("jumpBtn");
  if (jb) jb.textContent = (style === "bubbles") ? "🚀 ירה" : (style === "flappy") ? "🐤 עוף" : (style === "hoops") ? "🏀 קלע" : "⬆ קפיצה";
  const hints = {
    mario: "מקלדת: חיצים ימינה/שמאלה לתנועה, רווח לקפיצה. הגע לתיבת ה-❓ כדי לענות!",
    pacman: "מקלדת: חיצים לכל הכיוונים. אסוף נקודות, הגע ל-❓ כדי לענות, והיזהר מהרוחות!",
    spaceship: "מקלדת: חיצים לכל הכיוונים. אסוף כוכבים, טוס ל-❓ כדי לענות, והתחמק ממטאורים!",
    maze: "מקלדת: חיצים לכל הכיוונים. ענה על כל ה-❓ כדי לפתוח את היציאה 🏁 והגע אליה!",
    bubbles: "מקלדת: חיצים ימינה/שמאלה לכיוון התותח, רווח לירייה. פגע ב-❓ וענה נכון כדי לפוצץ בועות!",
    temple: "מקלדת: ◀▶ להחלפת מסלול, ▲/רווח לקפיצה, ▼ להחלקה. אסוף מטבעות, הימנע ממכשולים, וענה על שערי ה-❓!",
    flappy: "מקלדת: רווח / ▲ כדי לעוף. עברו בין הצינורות, אספו מטבעות וטוסו לשער ה-❓!",
    snake: "מקלדת: חיצים לכל הכיוונים. אכלו מטבעות וגדלו, ואכלו את פרי ה-❓ כדי לענות!",
    frogger: "מקלדת: חיצים להזזת הצפרדע. היזהרו ממכוניות והגיעו לעלה ה-❓ שלמעלה!",
    hoops: "מקלדת: ◀▶ לתזוזה, רווח/▲ לזריקה. קלעו לסל שעליו ה-❓ כדי לענות!",
    climber: "מקלדת: ◀▶ לתזוזה. קופצים אוטומטית — נחתו על משטח ה-❓ כדי לענות וטפסו גבוה!"
  };
  document.getElementById("controlsHint").textContent = hints[style] || hints.mario;

  const canvas = document.getElementById("gameCanvas");
  canvas.width = Math.min(900, window.innerWidth - 20);
  canvas.height = 420;

  activeEngine.init({
    canvas: canvas,
    game: activeGame,
    onQuestion: openQuestion,           // נקרא כשנוגעים בתיבת שאלה
    onLevelComplete: finishMarioGame    // נקרא בסיום כל השלבים
  });

  // מסירים פוקוס מכפתורים כדי שמקשי המקלדת (חיצים/רווח) יגיעו למשחק
  if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
}

/* ----- שחק שוב — אותו משחק, אותו סגנון ----- */
function playAgain() {
  if (!activeGame) { showScreen("homeScreen"); return; }
  studentAnswers = [];
  currentAttempts = 0;
  quizMode = false;
  launchGameEngine(lastGameStyle || "mario");
}

/* ============================================================
   5. פתיחת שאלה במהלך המשחק
   ============================================================ */
function openQuestion(index) {
  currentQuestionIndex = index;
  currentAttempts = 0;
  renderQuestion(activeGame.questions[index]);
  document.getElementById("questionModal").classList.add("show");
  startQuestionTimer();   // ⏱️ ספירה לאחור — 10 שניות לענות
  if (currentSpeakWord) setTimeout(() => speakEnglish(currentSpeakWord), 350);   // 🔊 הקראה אוטומטית באנגלית
}

/* ----- שעון אופציונלי לכרטיס השאלה (10 שניות, ולכיתות הגבוהות 15) ----- */
let questionTimer = null, qTimeLeft = 0, qTotalSecs = 10;
const HIGH_GRADES = ["ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"];

function questionSeconds() {
  const g = (typeof student !== "undefined" && student) ? student.grade : "";
  return HIGH_GRADES.includes(g) ? 15 : 10;
}

function startQuestionTimer() {
  clearQuestionTimer();
  const el = document.getElementById("qTimerBar");
  // השעון אופציונלי — כבוי או במצב quiz: לא מציגים ולא סופרים
  if (quizMode || !(typeof student !== "undefined" && student && student.timerOn)) {
    if (el) el.innerHTML = "";
    return;
  }
  qTotalSecs = questionSeconds();
  qTimeLeft = qTotalSecs;
  updateQuestionTimer();
  questionTimer = setInterval(() => {
    qTimeLeft--;
    updateQuestionTimer();
    if (qTimeLeft <= 0) { clearQuestionTimer(); onQuestionTimeout(); }
  }, 1000);
}
function clearQuestionTimer() {
  if (questionTimer) { clearInterval(questionTimer); questionTimer = null; }
}
function updateQuestionTimer() {
  const el = document.getElementById("qTimerBar");
  if (!el) return;
  const pct = Math.max(0, qTimeLeft / qTotalSecs * 100);
  const color = qTimeLeft > qTotalSecs * 0.5 ? "#27ae60" : qTimeLeft > qTotalSecs * 0.2 ? "#f39c12" : "#e74c3c";
  el.innerHTML = `<div class="timer-bar"><div class="timer-fill" style="width:${pct}%;background:${color}"></div></div>
    <span class="timer-num">⏱️ ${qTimeLeft}</span>`;
}
function onQuestionTimeout() {
  const q = activeGame.questions[currentQuestionIndex];
  const fb = document.getElementById("questionFeedback");
  if (fb) { fb.className = "feedback wrong"; fb.textContent = "⏰ נגמר הזמן! הכרטיס נעלם"; }
  // נועלים את כפתורי התשובה
  document.querySelectorAll("#answerArea button, #answerArea input").forEach(b => b.disabled = true);
  if (typeof playWrong === "function") playWrong();
  recordAnswer(q, "(לא נענה בזמן)", false, 0);
  setTimeout(() => {
    closeQuestionModal();
    if (quizMode) nextQuizQuestion();
    else if (activeEngine) activeEngine.resume(true);   // הכרטיס "נצרך" וממשיכים
  }, 1000);
}

/* ----- קריין אנגלית (Text-to-Speech, ללא ספריות) ----- */
let currentSpeakWord = "";
function englishWordFromText(text) {
  const m = (text || "").match(/["“”']([^"“”']{1,40})["“”']/);
  if (m && /[A-Za-z]/.test(m[1])) return m[1];
  return "";
}
function speakerBtnHtml(word) {
  if (!word) return "";
  return ` <button type="button" class="speak-btn" onclick="speakEnglish('${escapeAttr(word)}')" aria-label="הקראת המילה באנגלית" title="האזנה למילה">🔊</button>`;
}
function speakEnglish(word) {
  try {
    if (!("speechSynthesis" in window) || !word) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = "en-US"; u.rate = 0.9; u.pitch = 1;
    const voices = window.speechSynthesis.getVoices() || [];
    const v = voices.find(x => /^en[-_]/i.test(x.lang));
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

/* ----- ציור השאלה בתוך החלון הקופץ ----- */
function renderQuestion(q) {
  currentSpeakWord = englishWordFromText(q.text);
  document.getElementById("questionText").innerHTML = escapeHtml(q.text) + speakerBtnHtml(currentSpeakWord);
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
  clearQuestionTimer();   // ענו בזמן — עוצרים את השעון
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

    // חיזוק חיובי — הקראת המילה באנגלית שוב
    if (currentSpeakWord) speakEnglish(currentSpeakWord);

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
  clearQuestionTimer();
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

  // פאנל שליחת מייל + שליחה אוטומטית להורה/מורה שהוזנו ברישום
  lastEmail = {
    subject: "דוח תוצאות - " + result.studentName + " - " + game.title,
    body: buildStudentEmailBody(game, result, correctCount, wrongCount)
  };
  const recipients = buildRecipients(student && student.parentEmail, student && student.teacherEmail);
  mountEmailPanel("reportEmail", recipients, game.creatorEmail || "");

  showScreen("studentReportScreen");
  setTimeout(() => launchConfetti(2200), 200);   // 🎉 חגיגה קצרה (≈2.4 שניות)
  playVictory();                                 // 🔊 צליל ניצחון
}

function buildStudentEmailBody(game, result, correctCount, wrongCount) {
  let b = "שלום " + (game.creatorName || "") + ",\n\n";
  b += "התלמיד/ה " + result.studentName + " (כיתה " + result.studentGrade + ") סיים/ה את המשחק.\n\n";
  b += "מקצוע: " + game.subject + "\n";
  b += "משחק: " + game.title + "\n";
  b += "מספר שאלות שענה/תה: " + (correctCount + wrongCount) + "\n";
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

// בונה רשימת נמענים (הורה/מורה) מתוך כתובות שמולאו
function buildRecipients(parent, teacher) {
  const r = [];
  if (parent && parent.trim())  r.push({ role: "הורה", email: parent.trim() });
  if (teacher && teacher.trim()) r.push({ role: "מורה", email: teacher.trim() });
  return r;
}

function mountEmailPanel(mountId, recipients, fallbackTo) {
  const el = document.getElementById(mountId);
  if (!el) return;
  const emails = (recipients && recipients.length) ? recipients.map(r => r.email) : [];
  const toVal = emails.length ? emails.join(", ") : (fallbackTo || "");
  const hint = (recipients && recipients.length)
    ? "יישלח אל: " + recipients.map(r => r.role + " — " + escapeHtml(r.email)).join(" · ")
    : "מלאו כתובת מייל ולחצו שלח";
  el.innerHTML = `
    <div class="form-card email-panel">
      <label>📧 שליחת הדוח במייל להורה / מורה</label>
      <p class="muted email-hint">${hint}</p>
      <input type="email" class="emailTo" value="${escapeAttr(toVal)}" placeholder="כתובת מייל (אפשר כמה, מופרדות בפסיק)">
      <div class="email-btns">
        <button class="btn green big" onclick="emailMailto(this)">📧 שלח דוח</button>
      </div>
      <p class="ai-status email-status"></p>
    </div>`;
}

function emailMailto(btn) {
  const panel = btn.closest(".email-panel");
  const raw = panel.querySelector(".emailTo").value || "";
  const addr = raw.split(",").map(s => s.trim()).filter(Boolean).join(",");
  const status = panel.querySelector(".email-status");
  if (!addr) {
    if (status) { status.className = "ai-status email-status err"; status.textContent = "נא להזין כתובת מייל"; }
    return;
  }
  window.location.href = "mailto:" + addr +
    "?subject=" + encodeURIComponent(lastEmail.subject) +
    "&body=" + encodeURIComponent(lastEmail.body);
  if (status) { status.className = "ai-status email-status ok"; status.textContent = "📧 נפתחה אפליקציית המייל — נותר ללחוץ 'שלח' שם"; }
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
      <p><b>שאלה ${i + 1}:</b> ${escapeHtml(q.text)}${speakerBtnHtml(englishWordFromText(q.text))}</p>
      <p class="answer-line">תשובה נכונה: <b>${escapeHtml(q.correctAnswer)}</b>
        ${q.wrongAnswers.length ? " | אפשרויות שגויות: " + q.wrongAnswers.map(escapeHtml).join(", ") : ""}</p>
      ${q.explanation ? `<p class="muted">הסבר: ${escapeHtml(q.explanation)}</p>` : ""}
    </div>`).join("");

  const topicLine = [game.topic, game.subTopic].filter(Boolean).map(escapeHtml).join(" › ");
  document.getElementById("viewQuestionsResult").innerHTML =
    `<h3>${escapeHtml(game.title)} — ${escapeHtml(game.subject)}</h3>` +
    (topicLine ? `<p class="muted">${topicLine}</p>` : "") + html;
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

/* ============================================================
   🔊 צליל ניצחון (Web Audio, ללא קבצים) + טוגל השתקה
   ============================================================ */
let _audioCtx = null;
function getAudioCtx() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (_audioCtx.state === "suspended") _audioCtx.resume();
    return _audioCtx;
  } catch (e) { return null; }
}
function soundEnabled() { return localStorage.getItem("soundOn") !== "0"; }

function playVictory() {
  if (!soundEnabled()) return;
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const beep = (f, t, dur, type, vol) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };
  // ארפג'ו עולה C5-E5-G5-C6 ואז אקורד נוצץ
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => beep(f, now + i * 0.12, 0.4, "triangle", 0.25));
  const t2 = now + notes.length * 0.12;
  beep(1046.5, t2, 0.6, "sine", 0.2);
  beep(1318.5, t2, 0.6, "sine", 0.18);
}

// צליל קצר לתשובה נכונה — שני צלילים עולים נעימים
function playCorrect() {
  if (!soundEnabled()) return;
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const beep = (f, t, dur) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "triangle"; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t); o.stop(t + dur + 0.02);
  };
  beep(659.25, now, 0.15);          // E5
  beep(987.77, now + 0.12, 0.28);   // B5
}

// צליל קצר לתשובה שגויה — באזז יורד נמוך
function playWrong() {
  if (!soundEnabled()) return;
  const ctx = getAudioCtx(); if (!ctx) return;
  const now = ctx.currentTime;
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.type = "sawtooth";
  o.frequency.setValueAtTime(220, now);
  o.frequency.exponentialRampToValueAtTime(130, now + 0.32);
  g.gain.setValueAtTime(0.0001, now);
  g.gain.exponentialRampToValueAtTime(0.22, now + 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, now + 0.36);
  o.connect(g).connect(ctx.destination);
  o.start(now); o.stop(now + 0.38);
}

function updateSoundBtn() {
  const b = document.getElementById("soundToggle");
  if (b) b.textContent = soundEnabled() ? "🔊" : "🔇";
}
function toggleSound() {
  const on = soundEnabled();
  localStorage.setItem("soundOn", on ? "0" : "1");
  updateSoundBtn();
  if (on) {} else playVictory();   // השמעת דוגמה כשמדליקים
}
document.addEventListener("DOMContentLoaded", updateSoundBtn);

/* ============================================================
   ⏱️ מודל בחירת טיימר למבחן (מתוך דוח התלמיד)
   ============================================================ */
function askExamTimer(cb) {
  const overlay = document.createElement("div");
  overlay.className = "modal show";
  overlay.innerHTML = `
    <div class="modal-content">
      <h2 class="question-text">📝 רוצים טיימר למבחן?</h2>
      <div class="answer-area">
        <button class="btn green" data-min="0">⏱️ בלי הגבלת זמן</button>
        <button class="btn blue" data-min="5">5 דקות</button>
        <button class="btn blue" data-min="10">10 דקות</button>
        <button class="btn blue" data-min="15">15 דקות</button>
        <button class="btn-small" data-min="cancel" style="margin-top:8px">ביטול</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", e => {
    const b = e.target.closest("button[data-min]");
    if (!b) return;
    const v = b.getAttribute("data-min");
    overlay.remove();
    if (v === "cancel") return;
    cb(parseInt(v) || 0);
  });
}

/* ============================================================
   🐞 דיווח באגים / הצעות שיפור — כפתור בכל מסך + טבלת איסוף
   ============================================================ */
const SCREEN_LABELS = {
  homeScreen: "דף הבית", createGameScreen: "יצירת משחק", browseScreen: "בחירת משחק",
  bandsScreen: "אנגלית Bands", examsScreen: "מבחנים — בחירה", examRunScreen: "מבחן",
  examResultScreen: "תוצאת מבחן", programsScreen: "תוכניות עולה", programGamesScreen: "משחקי תוכנית",
  studentLoginScreen: "כניסת תלמיד", marioGameScreen: "מסך המשחק", quizRunScreen: "שאלות בלי משחק",
  studentReportScreen: "דוח תלמיד", teacherReportsScreen: "דוחות מורה", viewQuestionsScreen: "צפייה בשאלות",
  leaderboardScreen: "טבלת אלופים", duelHomeScreen: "תחרות 1 על 1", duelPlayScreen: "תחרות — משחק",
  psychoScreen: "פסיכומטרי", helpScreen: "עזרה", feedbackScreen: "הערות ובאגים"
};
function screenLabel(id) { return SCREEN_LABELS[id] || id || ""; }

function getFeedbackContext() {
  let code = "", title = "", type = "", level = "", reporter = "";
  if (typeof activeGame !== "undefined" && activeGame) { code = activeGame.code || ""; title = activeGame.title || ""; type = activeGame.gameType || ""; }
  if (!code && typeof examGame !== "undefined" && examGame) { code = examGame.code || ""; title = examGame.title || ""; type = "exam"; }
  if (typeof activeEngine !== "undefined" && activeEngine && typeof activeEngine.getCurrentLevel === "function") {
    try { level = activeEngine.getCurrentLevel(); } catch (e) {}
  }
  if (typeof student !== "undefined" && student && student.name) reporter = student.name;
  else if (typeof examName !== "undefined" && examName) reporter = examName;

  let label = "מסך: " + screenLabel(currentScreenId);
  if (code) label += " · משחק: " + title + " (" + code + ")";
  if (level !== "" && level != null) label += " · שלב: " + level;
  return { gameCode: code, gameTitle: title, gameType: type, level, reporter, screen: currentScreenId, label };
}

function openFeedback() {
  closeFeedback();
  const ctx = getFeedbackContext();
  const overlay = document.createElement("div");
  overlay.className = "modal show"; overlay.id = "feedbackModal";
  overlay.dataset.kind = "bug";
  overlay.innerHTML = `
    <div class="modal-content" style="max-width:560px;text-align:right">
      <h2 class="question-text" style="text-align:center">🐞 דיווח על באג / הצעת שיפור</h2>
      <p class="muted" style="text-align:center;margin-top:-10px">${escapeHtml(ctx.label)}</p>
      <div class="fb-kinds" id="fbKindBtns">
        <button type="button" class="fb-kind active" data-kind="bug">🐞 באג</button>
        <button type="button" class="fb-kind" data-kind="improvement">💡 הצעת שיפור</button>
      </div>
      <label class="fb-label">השם שלך (לא חובה)</label>
      <input id="fbReporter" class="answer-input" style="text-align:right" placeholder="מי כותב?" value="${escapeAttr(ctx.reporter)}">
      <label class="fb-label">מה ההערה?</label>
      <textarea id="fbMessage" class="fb-textarea" rows="4" placeholder="כתבו כאן מה קרה או מה כדאי לשפר..."></textarea>
      <div class="fb-status" id="fbStatus"></div>
      <div style="display:flex;gap:10px;margin-top:12px">
        <button class="btn green" style="flex:1" onclick="submitFeedback()">📨 שליחה</button>
        <button class="btn-small" onclick="closeFeedback()">ביטול</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector("#fbKindBtns").addEventListener("click", e => {
    const b = e.target.closest(".fb-kind"); if (!b) return;
    overlay.querySelectorAll(".fb-kind").forEach(x => x.classList.remove("active"));
    b.classList.add("active"); overlay.dataset.kind = b.dataset.kind;
  });
  overlay.addEventListener("click", e => { if (e.target === overlay) closeFeedback(); });
  setTimeout(() => document.getElementById("fbMessage")?.focus(), 100);
}

function closeFeedback() { document.getElementById("feedbackModal")?.remove(); }

async function submitFeedback() {
  const msgEl = document.getElementById("fbMessage");
  const status = document.getElementById("fbStatus");
  const msg = msgEl.value.trim();
  if (!msg) { status.className = "fb-status err"; status.textContent = "נא לכתוב הערה לפני השליחה"; msgEl.focus(); return; }

  const overlay = document.getElementById("feedbackModal");
  const ctx = getFeedbackContext();
  ctx.reporter = document.getElementById("fbReporter").value.trim() || ctx.reporter;
  ctx.kind = (overlay && overlay.dataset.kind) || "bug";
  ctx.message = msg;

  status.className = "fb-status"; status.textContent = "שולח...";
  try {
    await saveFeedback(ctx);
    status.className = "fb-status ok"; status.textContent = "תודה! ההערה נשמרה ✓";
    setTimeout(closeFeedback, 1200);
  } catch (e) {
    console.error(e);
    status.className = "fb-status err"; status.textContent = "שגיאה בשמירה. נסו שוב.";
  }
}

/* ----- דף ניהול הערות/תקלות — למנהל בלבד (Supabase Auth) ----- */
function getAdminToken() { return sessionStorage.getItem("adminToken"); }

function showFeedbackList() {   // נקרא מכפתור הבית
  if (getAdminToken()) showAdminDashboard();
  else { showScreen("adminLoginScreen"); setTimeout(() => document.getElementById("adminEmail")?.focus(), 100); }
}

async function adminLogin() {
  const email = document.getElementById("adminEmail").value.trim();
  const pass  = document.getElementById("adminPass").value;
  const st = document.getElementById("adminLoginStatus");
  if (!email || !pass) { st.className = "fb-status err"; st.textContent = "נא להזין אימייל וסיסמה"; return; }
  st.className = "fb-status"; st.textContent = "מתחבר...";
  try {
    const token = await adminSignIn(email, pass);
    if (!token) { st.className = "fb-status err"; st.textContent = "שגיאה בהתחברות"; return; }
    sessionStorage.setItem("adminToken", token);
    document.getElementById("adminPass").value = "";
    st.textContent = "";
    showAdminDashboard();
  } catch (e) {
    if (e.message === "bad-credentials") {
      st.className = "fb-status err"; st.textContent = "אימייל או סיסמה שגויים";
    } else {
      console.error(e); st.className = "fb-status err"; st.textContent = "שגיאה בהתחברות";
    }
  }
}

function adminLogout() {
  sessionStorage.removeItem("adminToken");
  showScreen("homeScreen");
}

function fbLocation(r) {
  let loc = screenLabel(r.screen);
  if (r.game_title || r.game_code) loc += " · " + (r.game_title || "") + (r.game_code ? (" (" + r.game_code + ")") : "");
  if (r.level) loc += " · שלב " + r.level;
  return loc;
}

async function showAdminDashboard() {
  const token = getAdminToken();
  if (!token) { showFeedbackList(); return; }
  showScreen("feedbackScreen");
  const c = document.getElementById("feedbackList");
  c.innerHTML = "<p class='muted'>טוען...</p>";
  let rows;
  try { rows = await adminGetFeedback(token); }
  catch (e) { console.error(e); c.innerHTML = "<p class='muted'>שגיאה בטעינה — ייתכן שההתחברות פגה. <a href='#' onclick='adminLogout();return false'>התחבר שוב</a></p>"; return; }
  if (!Array.isArray(rows)) { c.innerHTML = "<p class='muted'>שגיאת הרשאה.</p>"; return; }
  if (!rows.length) { c.innerHTML = "<p class='muted'>אין עדיין הערות. כל דיווח שיישלח דרך 🐞 יופיע כאן.</p>"; return; }

  const fmt = d => { try { return new Date(d).toLocaleString("he-IL"); } catch (e) { return d || ""; } };
  const kindLabel = k => k === "bug" ? "🐞 תקלה" : "💡 הערה";
  const open = rows.filter(r => !r.fixed).length;

  c.innerHTML = `
    <p class="muted" style="margin-bottom:8px">סה"כ ${rows.length} · פתוחות: <b>${open}</b> · טופלו: ${rows.length - open}</p>
    <table class="report-table feedback-admin">
      <thead><tr>
        <th>תאריך</th><th>סוג</th><th>איפה</th><th>הדיווח</th><th>מאת</th><th>תוקן?</th><th>הערת מנהל</th><th></th>
      </tr></thead>
      <tbody>` + rows.map(r => `
        <tr id="fbrow_${r.id}" class="${r.fixed ? "row-ok" : ""}">
          <td>${escapeHtml(fmt(r.created_at))}</td>
          <td>${kindLabel(r.kind)}</td>
          <td style="text-align:right;max-width:200px">${escapeHtml(fbLocation(r))}</td>
          <td style="text-align:right;max-width:260px">${escapeHtml(r.message)}</td>
          <td>${escapeHtml(r.reporter || "")}</td>
          <td><input type="checkbox" class="fb-fix" id="fbfix_${r.id}" ${r.fixed ? "checked" : ""}></td>
          <td><input type="text" class="fb-admin-note" id="fbnote_${r.id}" value="${escapeAttr(r.admin_note || "")}" placeholder="הערה / סטטוס..."></td>
          <td><button class="btn-small" onclick="adminSaveRow('${escapeAttr(r.id)}')">💾 שמור</button></td>
        </tr>`).join("") + `
      </tbody>
    </table>`;
}

async function adminSaveRow(id) {
  const token = getAdminToken();
  if (!token) { showFeedbackList(); return; }
  const fixed = document.getElementById("fbfix_" + id).checked;
  const note  = document.getElementById("fbnote_" + id).value;
  const btn = document.querySelector(`#fbrow_${CSS.escape(id)} .btn-small`);
  if (btn) { btn.disabled = true; btn.textContent = "שומר..."; }
  try {
    await adminUpdateFeedback(token, id, fixed, note);
    const tr = document.getElementById("fbrow_" + id);
    if (tr) tr.className = fixed ? "row-ok" : "";
    if (btn) { btn.textContent = "✓ נשמר"; setTimeout(() => { btn.textContent = "💾 שמור"; btn.disabled = false; }, 1200); }
  } catch (e) {
    console.error(e);
    if (btn) { btn.textContent = "💾 שמור"; btn.disabled = false; }
    alert("שגיאה בשמירה. נסו שוב.");
  }
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
