/* ============================================================
   data.js  —  שכבת נתונים מותאמת לסכמה היחסית הקיימת ב-Supabase
   ------------------------------------------------------------
   טבלאות הסכמה שלך:
     learning_games (id, game_code, creator_id, grade_id, subject_id,
                     topic_id, game_type_id, title, description, is_active, ...)
     questions      (id, game_id, question_order, question_text,
                     question_type, correct_answer, difficulty,
                     coins_reward, explanation)
     question_options (id, question_id, option_text, is_correct, option_order)
     students       (id, full_name, grade_id, created_at)
     game_sessions  (id, game_id, student_id, started_at, finished_at,
                     current_level, silver_coins, gold_coins, total_coins,
                     correct_answers, wrong_answers, completed, play_mode)
     student_answers(id, session_id, question_id, student_answer,
                     correct_answer, is_correct, attempts, coins_earned, answered_at)
     creators (id, full_name, creator_type, email, created_at)
     grades   (id, name, sort_order)
     subjects (id, name)
     topics   (id, subject_id, grade_id, name)
     game_types (id, code, name)

   הקובץ הזה ממיר בין הטבלאות לבין אובייקטי המשחק הפנימיים של האפליקציה,
   כך ששאר הקוד (game.js והמסכים) ממשיך לעבוד בלי שינוי.
   כל הפונקציות אסינכרוניות (Promise).
   ============================================================ */

/* ============================================================
   הגדרות Supabase — מלא כאן את הערכים מהפרויקט שלך:
   Project Settings -> API -> Project URL + anon public key
   ============================================================ */
const SUPABASE_URL      = "https://tgmafboqaezfleggttyk.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnbWFmYm9xYWV6ZmxlZ2d0dHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5Mjk4NzgsImV4cCI6MjA5NjUwNTg3OH0.j32FDJSv5DQ4vh9b8dGoQ_ktCnPN4_GlDmqDvMR7xNU";

// אם הערכים עדיין placeholders -> עובדים מקומית עם localStorage
const USE_SUPABASE =
  !SUPABASE_URL.includes("YOUR_PROJECT") &&
  !SUPABASE_ANON_KEY.includes("YOUR_ANON_KEY");

// קיצור ל-encodeURIComponent (לסינון בעברית/רווחים ב-PostgREST)
const enc = encodeURIComponent;

/* ============================================================
   טבלאות עזר סטטיות (לשימוש רק במצב מקומי / כשאין Supabase)
   ============================================================ */
const appConfig = {
  gameTypes: [
    { id: "mario",     name: "סופר מריו", active: true  },
    { id: "pacman",    name: "פאקמן",     active: false },
    { id: "spaceship", name: "חללית",     active: false },
    { id: "maze",      name: "מבוך",       active: false },
    { id: "race",      name: "מרוץ",       active: false }
  ],
  grades: ["א", "ב", "ג", "ד", "ה", "ו", "ז", "ח", "ט", "י", "יא", "יב"],
  subjects: ["חשבון", "עברית", "אנגלית", "תורה", "מדעים", "פיזיקה", "תכנות", "פסיכומטרי"],
  topics: [
    "חיבור עד 10", "חיסור עד 10", "חיבור עד 20", "חיסור עד 20",
    "מספרים חסרים", "השוואת מספרים", "בעיות מילוליות פשוטות"
  ]
};

/* ============================================================
   מטמון טבלאות העזר מ-Supabase (נטען פעם אחת בהפעלה)
   ============================================================ */
let lookups = { grades: [], subjects: [], topics: [], gameTypes: [] };

async function loadLookups() {
  if (!USE_SUPABASE) return;
  // טוענים את כל טבלאות העזר במקביל; כל אחת עם הגנה משלה
  const [g, s, t, gt] = await Promise.all([
    sbSelect("grades?select=id,name,sort_order&order=sort_order.asc").catch(() => []),
    sbSelect("subjects?select=id,name&order=name.asc").catch(() => []),
    sbSelect("topics?select=id,name,subject_id,grade_id").catch(() => []),
    sbSelect("game_types?select=id,name,code").catch(() => [])
  ]);
  lookups = { grades: g, subjects: s, topics: t, gameTypes: gt };
}

// ----- פונקציות המרה בין מזהה לשם ולהפך -----
function nameById(arr, id) { const x = arr.find(r => r.id === id); return x ? x.name : ""; }
function gradeName(id)   { return nameById(lookups.grades, id); }
function subjectName(id) { return nameById(lookups.subjects, id); }
function gameTypeCodeById(id) {
  const x = lookups.gameTypes.find(r => r.id === id);
  return x ? (x.code || x.name) : "mario";
}
function gradeOrderById(id) { const x = lookups.grades.find(r => r.id === id); return x ? (x.sort_order || 0) : 0; }
function topicNameById(id)  { return nameById(lookups.topics, id); }
function gradeIdByName(n)   { const x = lookups.grades.find(r => r.name === n);   return x ? x.id : null; }
function subjectIdByName(n) { const x = lookups.subjects.find(r => r.name === n); return x ? x.id : null; }
function topicIdByName(n)   { const x = lookups.topics.find(r => r.name === n);   return x ? x.id : null; }
function gameTypeIdByCode(c){ const x = lookups.gameTypes.find(r => r.code === c || r.name === c); return x ? x.id : null; }

// מחזיר מזהה (Supabase) או שם (מקומי) - לפי מצב האחסון
function gradeRef(name)    { return USE_SUPABASE ? gradeIdByName(name)   : name; }
function subjectRef(name)  { return USE_SUPABASE ? subjectIdByName(name) : name; }
function topicRef(name)    { return USE_SUPABASE ? topicIdByName(name)   : name; }
function gameTypeRef(code) { return USE_SUPABASE ? gameTypeIdByCode(code): code; }

/* ============================================================
   שכבת Supabase REST (PostgREST) — בעזרת fetch בלבד
   ============================================================ */
async function sbFetch(path, options = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error("Supabase error " + res.status + ": " + txt);
  }
  return res;
}

// קריאת נתונים (GET) -> מערך שורות
async function sbSelect(path) {
  const res = await sbFetch(path);
  return res.json();
}

// הוספת נתונים (POST) -> מחזיר את השורות שנוצרו (כולל ה-id)
async function sbInsert(table, body) {
  const res = await sbFetch(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return res.json();
}

// עדכון נתונים (PATCH) -> מחזיר את השורות שעודכנו
async function sbUpdate(path, body) {
  const res = await sbFetch(path, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(body)
  });
  return res.json();
}

/* ============================================================
   הערות / דיווחי באגים מהמשתמשים (טבלת feedback)
   ============================================================ */
async function saveFeedback(fb) {
  const row = {
    game_code:  fb.gameCode  || null,
    game_title: fb.gameTitle || null,
    game_type:  fb.gameType  || null,
    level:      (fb.level !== undefined && fb.level !== null && fb.level !== "") ? String(fb.level) : null,
    screen:     fb.screen    || null,
    reporter:   fb.reporter  || null,
    kind:       fb.kind      || null,
    message:    fb.message
  };
  if (!USE_SUPABASE) {
    const key = "feedbackLocal";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    arr.unshift({ ...row, id: "fb_" + Date.now(), created_at: new Date().toISOString(), fixed: false, admin_note: null });
    localStorage.setItem(key, JSON.stringify(arr));
    return;
  }
  // return=minimal — אין צורך בהרשאת קריאה (anon לא יכול לקרוא את הטבלה)
  await sbFetch("feedback", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify(row)
  });
}

/* ----- ניהול הערות — מאובטח עם Supabase Auth (סיסמה מוצפנת בצד השרת) ----- */

// כניסת מנהל: מחזיר access_token. זורק 'bad-credentials' אם הפרטים שגויים.
async function adminSignIn(email, password) {
  if (!USE_SUPABASE) return "local-token";
  const res = await fetch(SUPABASE_URL + "/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: { apikey: SUPABASE_ANON_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password })
  });
  if (!res.ok) {
    if (res.status === 400) throw new Error("bad-credentials");
    throw new Error("login error " + res.status);
  }
  const d = await res.json();
  return d.access_token;
}

// fetch עם טוקן של מנהל מחובר (עוקף את חסימת ה-anon דרך RLS)
async function sbAuthFetch(path, token, options = {}) {
  const res = await fetch(SUPABASE_URL + "/rest/v1/" + path, {
    ...options,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });
  if (!res.ok) { const t = await res.text(); throw new Error("Supabase error " + res.status + ": " + t); }
  return res;
}

async function adminGetFeedback(token) {
  if (!USE_SUPABASE) return JSON.parse(localStorage.getItem("feedbackLocal") || "[]");
  const res = await sbAuthFetch("feedback?select=*&order=created_at.desc&limit=1000", token);
  return res.json();
}

async function adminUpdateFeedback(token, id, fixed, note) {
  if (!USE_SUPABASE) {
    const key = "feedbackLocal";
    const arr = JSON.parse(localStorage.getItem(key) || "[]");
    const row = arr.find(r => r.id === id);
    if (row) { row.fixed = fixed; row.admin_note = note; localStorage.setItem(key, JSON.stringify(arr)); }
    return;
  }
  await sbAuthFetch("feedback?id=eq." + id, token, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ fixed: fixed, admin_note: note })
  });
}

/* ============================================================
   שכבת localStorage — גיבוי מקומי (כשאין Supabase)
   ============================================================ */
const STORAGE_KEY = "learningGameData";
function lsLoad() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { games: [], results: [] };
  try { return JSON.parse(raw); } catch (e) { return { games: [], results: [] }; }
}
function lsSave(db) { localStorage.setItem(STORAGE_KEY, JSON.stringify(db)); }

/* ============================================================
   API ציבורי — ממשק אחיד לשני מצבי האחסון
   ============================================================ */

/* ------------------------------------------------------------
   getGameByCode(code) - שליפת משחק לפי קוד והמרתו לאובייקט פנימי.
   ------------------------------------------------------------ */
async function getGameByCode(code) {
  const clean = (code || "").trim();
  if (!USE_SUPABASE) {
    const db = lsLoad();
    return db.games.find(g => g.code.toUpperCase() === clean.toUpperCase()) || null;
  }

  // 1) המשחק עצמו
  const rows = await sbSelect(
    "learning_games?game_code=ilike." + enc(clean) + "&select=*&limit=1"
  );
  if (!rows.length) return null;
  const g = rows[0];

  // 2) השאלות לפי סדר
  const qs = await sbSelect(
    "questions?game_id=eq." + g.id + "&select=*&order=question_order.asc"
  );

  // 3) אפשרויות התשובה לכל השאלות
  let opts = [];
  if (qs.length) {
    const ids = qs.map(q => q.id).join(",");
    opts = await sbSelect(
      "question_options?question_id=in.(" + ids + ")&select=*&order=option_order.asc"
    );
  }

  // המרה לאובייקטי שאלה פנימיים
  const questions = qs.map(q => {
    const qopts = opts.filter(o => o.question_id === q.id);
    const wrong = qopts.filter(o => !o.is_correct).map(o => o.option_text);
    return {
      id: q.id,                       // ה-uuid האמיתי (נשמר בדוח התשובות)
      text: q.question_text,
      type: q.question_type,
      correctAnswer: q.correct_answer,
      wrongAnswers: wrong,
      difficulty: q.difficulty,
      coins: q.coins_reward,
      explanation: q.explanation || ""
    };
  });

  return {
    id: g.id,
    code: g.game_code,
    title: g.title || "תרגול",
    subject: subjectName(g.subject_id),
    grade: gradeName(g.grade_id),
    topic: topicNameById(g.topic_id),
    subTopic: g.sub_topic || "",
    gameType: gameTypeCodeById(g.game_type_id),
    levels: Math.max(1, Math.round(questions.length / 5)), // ~5 שאלות לשלב
    questions: questions
  };
}

/* ------------------------------------------------------------
   saveGame(game) - שמירת משחק חדש (יוצר/משחק/שאלות/אפשרויות).
   game.grade / subject / topic / gameType מכילים כבר מזהים (uuid)
   במצב Supabase, או שמות במצב מקומי.
   ------------------------------------------------------------ */
async function saveGame(game) {
  if (!USE_SUPABASE) {
    const db = lsLoad();
    db.games.push(game);
    lsSave(db);
    return;
  }

  // 1) מציאת/יצירת יוצר
  const creator_id = await resolveCreator(game);

  // 1ב) מציאת/יצירת נושא לפי השם שהוקלד (תומך בנושאים חדשים)
  const topic_id = await resolveTopic(game.topic, game.subject, game.grade);

  // 2) יצירת רשומת המשחק
  const ins = await sbInsert("learning_games", {
    game_code: game.code,
    title: game.title,
    creator_id: creator_id,
    grade_id: game.grade || null,
    subject_id: game.subject || null,
    topic_id: topic_id,
    sub_topic: game.subTopic || null,
    game_type_id: game.gameType || null,
    is_active: true
  });
  const gameId = ins[0].id;

  // 3) הוספת כל השאלות בבת אחת
  const qBody = game.questions.map((q, i) => ({
    game_id: gameId,
    question_order: i + 1,
    question_text: q.text,
    question_type: q.type,
    correct_answer: q.correctAnswer,
    difficulty: q.difficulty,
    coins_reward: q.coins,
    explanation: q.explanation || ""
  }));
  const qIns = await sbInsert("questions", qBody);

  // 4) הוספת אפשרויות תשובה לשאלות בחירה מרובה
  const optBody = [];
  qIns.forEach(row => {
    const src = game.questions[row.question_order - 1];
    if (src && src.type === "multiple") {
      optBody.push({ question_id: row.id, option_text: src.correctAnswer, is_correct: true, option_order: 1 });
      (src.wrongAnswers || []).forEach((w, idx) =>
        optBody.push({ question_id: row.id, option_text: w, is_correct: false, option_order: idx + 2 })
      );
    }
  });
  if (optBody.length) await sbInsert("question_options", optBody);
}

/* מציאת נושא לפי שם (בתוך המקצוע), או יצירת נושא חדש.
   מקבל שם נושא חופשי שהוקלד ומחזיר את ה-uuid שלו. */
async function resolveTopic(name, subjectId, gradeId) {
  const clean = (name || "").trim();
  if (!clean) return null;

  // אם כבר קיים במטמון (אותו שם + מקצוע) - נשתמש בו
  const cached = lookups.topics.find(t =>
    t.name === clean && (!subjectId || !t.subject_id || t.subject_id === subjectId));
  if (cached) return cached.id;

  // חיפוש בשרת
  let path = "topics?name=eq." + enc(clean) + "&select=id,name,subject_id,grade_id&limit=1";
  if (subjectId) path = "topics?name=eq." + enc(clean) + "&subject_id=eq." + subjectId +
                        "&select=id,name,subject_id,grade_id&limit=1";
  const found = await sbSelect(path).catch(() => []);
  if (found.length) { lookups.topics.push(found[0]); return found[0].id; }

  // יצירת נושא חדש
  const ins = await sbInsert("topics", {
    name: clean,
    subject_id: subjectId || null,
    grade_id: gradeId || null
  });
  if (ins.length) { lookups.topics.push(ins[0]); return ins[0].id; }
  return null;
}

/* מציאת יוצר לפי אימייל, או יצירת חדש */
async function resolveCreator(game) {
  if (game.creatorEmail) {
    const found = await sbSelect("creators?email=eq." + enc(game.creatorEmail) + "&select=id&limit=1");
    if (found.length) return found[0].id;
  }
  const ins = await sbInsert("creators", {
    full_name: game.creatorName,
    creator_type: game.creatorType,
    email: game.creatorEmail || null
  });
  return ins[0].id;
}

/* ------------------------------------------------------------
   saveStudentResult(result) - שמירת סשן משחק + תשובות התלמיד.
   ------------------------------------------------------------ */
async function saveStudentResult(result) {
  if (!USE_SUPABASE) {
    const db = lsLoad();
    db.results.push(result);
    lsSave(db);
    return;
  }

  // מזהה המשחק לפי הקוד
  const gameRows = await sbSelect(
    "learning_games?game_code=ilike." + enc(result.gameCode) + "&select=id&limit=1"
  );
  const game_id = gameRows.length ? gameRows[0].id : null;

  // מציאת/יצירת תלמיד
  const grade_id = result.studentGrade ? gradeIdByName(result.studentGrade) : null;
  const student_id = await resolveStudent(result.studentName, grade_id);

  // ספירת נכון/שגוי מתוך התשובות
  const correct = result.answers.filter(a => a.isCorrect).length;
  const wrong = result.answers.length - correct;

  // יצירת סשן משחק
  const now = new Date().toISOString();
  const sess = await sbInsert("game_sessions", {
    game_id: game_id,
    student_id: student_id,
    play_mode: result.playMode || "mario",
    current_level: result.currentLevel,
    silver_coins: result.silverCoins,
    gold_coins: result.goldCoins,
    total_coins: result.totalCoins,
    correct_answers: correct,
    wrong_answers: wrong,
    completed: result.completed,
    started_at: now,
    finished_at: now
  });
  const session_id = sess[0].id;

  // הוספת כל התשובות
  if (result.answers.length) {
    const body = result.answers.map(a => ({
      session_id: session_id,
      question_id: a.questionId,
      student_answer: a.studentAnswer,
      correct_answer: a.correctAnswer,
      is_correct: a.isCorrect,
      attempts: a.attempts,
      coins_earned: a.coinsEarned
    }));
    await sbInsert("student_answers", body);
  }
}

/* מציאת תלמיד לפי שם, או יצירת חדש */
async function resolveStudent(name, grade_id) {
  const found = await sbSelect("students?full_name=eq." + enc(name) + "&select=id&limit=1");
  if (found.length) return found[0].id;
  const ins = await sbInsert("students", { full_name: name, grade_id: grade_id || null });
  return ins[0].id;
}

/* ------------------------------------------------------------
   getResultsByCode(code) - כל הסשנים של משחק (לדוח המורה),
   כולל שם התלמיד וכל תשובותיו, בהמרה לאובייקט הפנימי.
   ------------------------------------------------------------ */
async function getResultsByCode(code) {
  const clean = (code || "").trim();
  if (!USE_SUPABASE) {
    const db = lsLoad();
    return db.results.filter(r => r.gameCode.toUpperCase() === clean.toUpperCase());
  }

  const gameRows = await sbSelect("learning_games?game_code=ilike." + enc(clean) + "&select=id&limit=1");
  if (!gameRows.length) return [];
  const game_id = gameRows[0].id;

  const sessions = await sbSelect(
    "game_sessions?game_id=eq." + game_id + "&select=*&order=started_at.asc"
  );
  if (!sessions.length) return [];

  // שמות התלמידים
  const studentIds = [...new Set(sessions.map(s => s.student_id).filter(Boolean))];
  const students = studentIds.length
    ? await sbSelect("students?id=in.(" + studentIds.join(",") + ")&select=id,full_name,grade_id")
    : [];

  // כל התשובות של כל הסשנים
  const sessionIds = sessions.map(s => s.id);
  const answers = await sbSelect(
    "student_answers?session_id=in.(" + sessionIds.join(",") + ")&select=*&order=answered_at.asc"
  );

  // טקסט השאלות (לא נשמר ב-student_answers, שולפים מטבלת questions)
  const qIds = [...new Set(answers.map(a => a.question_id).filter(Boolean))];
  const questions = qIds.length
    ? await sbSelect("questions?id=in.(" + qIds.join(",") + ")&select=id,question_text")
    : [];

  // בנייה לפי המבנה שהדוחות מצפים לו
  return sessions.map(s => {
    const stu = students.find(x => x.id === s.student_id) || {};
    const sAns = answers.filter(a => a.session_id === s.id).map(a => {
      const q = questions.find(x => x.id === a.question_id) || {};
      return {
        questionId: a.question_id,
        questionText: q.question_text || "",
        studentAnswer: a.student_answer,
        correctAnswer: a.correct_answer,
        isCorrect: a.is_correct,
        attempts: a.attempts,
        coinsEarned: a.coins_earned
      };
    });
    return {
      studentName: stu.full_name || "תלמיד",
      studentGrade: gradeName(stu.grade_id) || "",
      gameType: "",
      silverCoins: s.silver_coins,
      goldCoins: s.gold_coins,
      totalCoins: s.total_coins,
      currentLevel: s.current_level,
      completed: s.completed,
      finishedAt: s.finished_at ? new Date(s.finished_at).toLocaleString("he-IL") : "",
      answers: sAns
    };
  });
}

/* ------------------------------------------------------------
   listGames() - רשימת כל המשחקים הפעילים (לבחירה במסך "בחר משחק").
   מחזיר: [{ code, title, grade, gradeOrder, subject, topic }]
   ------------------------------------------------------------ */
async function listGames() {
  if (!USE_SUPABASE) {
    const db = lsLoad();
    return db.games.map(g => ({
      code: g.code, title: g.title,
      grade: g.grade || "", gradeOrder: 0,
      subject: g.subject || "", topic: g.topic || "", subTopic: g.subTopic || ""
    }));
  }
  const rows = await sbSelect(
    "learning_games?is_active=eq.true&select=game_code,title,grade_id,subject_id,topic_id,sub_topic"
  );
  return rows.map(r => ({
    code: r.game_code,
    title: r.title,
    grade: gradeName(r.grade_id),
    gradeOrder: gradeOrderById(r.grade_id),
    subject: subjectName(r.subject_id),
    topic: topicNameById(r.topic_id),
    subTopic: r.sub_topic || ""
  }));
}

/* ------------------------------------------------------------
   getLeaderboard(gradeFilter) - טבלת אלופים: סיכום מטבעות לכל תלמיד.
   מחזיר: [{ name, grade, totalCoins, games }] ממוין מהגבוה לנמוך.
   ------------------------------------------------------------ */
async function getLeaderboard(gradeFilter) {
  let rows;
  if (!USE_SUPABASE) {
    const db = lsLoad();
    rows = db.results.map(r => ({ name: r.studentName, grade: r.studentGrade, coins: r.totalCoins || 0 }));
  } else {
    const sessions = await sbSelect("game_sessions?select=student_id,total_coins");
    const ids = [...new Set(sessions.map(s => s.student_id).filter(Boolean))];
    const students = ids.length
      ? await sbSelect("students?id=in.(" + ids.join(",") + ")&select=id,full_name,grade_id")
      : [];
    rows = sessions.map(s => {
      const stu = students.find(x => x.id === s.student_id) || {};
      return { name: stu.full_name || "תלמיד", grade: gradeName(stu.grade_id) || "", coins: s.total_coins || 0 };
    });
  }

  // צבירה לפי תלמיד (שם + כיתה)
  const map = new Map();
  rows.forEach(r => {
    const key = r.name + "|" + r.grade;
    const e = map.get(key) || { name: r.name, grade: r.grade, totalCoins: 0, games: 0 };
    e.totalCoins += r.coins;
    e.games += 1;
    map.set(key, e);
  });

  let list = [...map.values()];
  if (gradeFilter) list = list.filter(e => e.grade === gradeFilter);
  list.sort((a, b) => b.totalCoins - a.totalCoins);
  return list.slice(0, 50);
}

/* ------------------------------------------------------------
   sendReportEmail({to, subject, body}) - שליחת מייל אמיתי דרך
   Edge Function (Resend). זורק שגיאה אם נכשל / לא מוגדר.
   ------------------------------------------------------------ */
async function sendReportEmail(params) {
  const res = await fetch(SUPABASE_URL + "/functions/v1/send-report", {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: SUPABASE_ANON_KEY, Authorization: "Bearer " + SUPABASE_ANON_KEY },
    body: JSON.stringify(params)
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error("תשובה לא תקינה מהשרת"); }
  if (!res.ok || data.error) throw new Error(data.error || ("שגיאה " + res.status));
  return data;
}

/* ------------------------------------------------------------
   getBandGames() - משחקי אוצר המילים לפי Bands (אנגלית).
   מחזיר אובייקט { "Band I": [{code,title}], "Band II": [...], ... }
   ------------------------------------------------------------ */
async function getBandGames() {
  if (!USE_SUPABASE) return {};
  const tops = await sbSelect("topics?name=ilike.Band*&select=id,name");
  if (!tops.length) return {};
  const byId = {}; tops.forEach(t => byId[t.id] = t.name);
  const ids = tops.map(t => t.id).join(",");
  const games = await sbSelect("learning_games?topic_id=in.(" + ids + ")&is_active=eq.true&select=game_code,title,topic_id&order=game_code.asc");
  const grouped = {};
  games.forEach(g => {
    const band = byId[g.topic_id] || "Band";
    (grouped[band] = grouped[band] || []).push({ code: g.game_code, title: g.title });
  });
  return grouped;
}

/* ------------------------------------------------------------
   generateQuestionsAI(params) - יצירת שאלות אוטומטית ב-AI
   דרך ה-Edge Function ב-Supabase (שמקושר ל-Claude API).
   params = { subject, grade, topic, count, difficulty }
   מחזיר מערך שאלות בפורמט הפנימי של האפליקציה.
   ------------------------------------------------------------ */
async function generateQuestionsAI(params) {
  const res = await fetch(SUPABASE_URL + "/functions/v1/generate-questions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: "Bearer " + SUPABASE_ANON_KEY
    },
    body: JSON.stringify(params)
  });
  let data;
  try { data = await res.json(); } catch (e) { throw new Error("תשובה לא תקינה מהשרת"); }
  if (!res.ok || data.error) throw new Error(data.error || ("שגיאה " + res.status));

  const diff = params.difficulty === "בינוני" ? "medium"
             : params.difficulty === "קשה" ? "hard" : "easy";
  return (data.questions || []).map((x, i) => ({
    id: "qai_" + Date.now() + "_" + i,
    text: x.q,
    type: params.type || "multiple",
    correctAnswer: x.correct,
    wrongAnswers: Array.isArray(x.wrongs) ? x.wrongs : [],
    difficulty: diff,
    coins: 10,
    explanation: x.expl || ""
  }));
}

/* ============================================================
   תחרות 1 על 1 (אונליין) — דרך טבלת matches
   ============================================================ */

/* יצירת קוד תחרות בפורמט VS-1234 */
function generateMatchCode() {
  return "VS-" + Math.floor(1000 + Math.random() * 9000);
}

/* createMatch(hostName, gameCode) - מארח יוצר תחרות חדשה.
   בוחר עד 10 שאלות אקראיות מהמשחק, שמורות בסדר קבוע לשני השחקנים. */
async function createMatch(hostName, gameCode) {
  if (!USE_SUPABASE) throw new Error("התחרות דורשת חיבור למסד הנתונים");
  const game = await getGameByCode(gameCode);
  if (!game) throw new Error("קוד המשחק לא נמצא");
  if (!game.questions.length) throw new Error("אין שאלות במשחק הזה");

  // בחירת עד 10 שאלות אקראיות (סדר קבוע לשני השחקנים)
  const ids = shuffleArr(game.questions.map(q => q.id)).slice(0, Math.min(10, game.questions.length));

  // קוד תחרות ייחודי
  let code;
  for (let i = 0; i < 6; i++) {
    code = generateMatchCode();
    const existing = await getMatch(code);
    if (!existing) break;
  }

  const ins = await sbInsert("matches", {
    match_code: code,
    game_code: game.code,
    question_ids: ids,
    host_name: hostName,
    status: "waiting"
  });
  return ins[0];
}

/* getMatch(code) - שליפת תחרות לפי קוד */
async function getMatch(code) {
  if (!USE_SUPABASE) return null;
  const rows = await sbSelect("matches?match_code=ilike." + enc((code || "").trim()) + "&select=*&limit=1");
  return rows.length ? rows[0] : null;
}

/* joinMatch(code, guestName) - יריב מצטרף לתחרות */
async function joinMatch(code, guestName) {
  const m = await getMatch(code);
  if (!m) throw new Error("קוד התחרות לא נמצא");
  if (m.guest_name) throw new Error("התחרות כבר מלאה");
  const upd = await sbUpdate("matches?match_code=ilike." + enc(m.match_code), {
    guest_name: guestName,
    status: "playing"
  });
  return upd[0];
}

/* patchMatch(code, fields) - עדכון שדות התחרות (ניקוד/התקדמות/סיום) */
async function patchMatch(code, fields) {
  const upd = await sbUpdate("matches?match_code=ilike." + enc((code || "").trim()), fields);
  return upd[0];
}

/* recordDuelWinner(code, winnerName) - רישום המנצח (פעם אחת בלבד).
   הסינון winner_name=is.null מבטיח שרק הכתיבה הראשונה נרשמת. */
async function recordDuelWinner(code, winnerName) {
  if (!winnerName) {
    // תיקו - רק מסמנים שהסתיים
    await sbUpdate("matches?match_code=ilike." + enc(code), { status: "finished" });
    return;
  }
  await sbUpdate(
    "matches?match_code=ilike." + enc(code) + "&winner_name=is.null",
    { winner_name: winnerName, status: "finished" }
  );
}

/* getDuelWins() - טבלת ניצחונות: כמה ניצח כל שחקן */
async function getDuelWins() {
  if (!USE_SUPABASE) return [];
  const rows = await sbSelect("matches?winner_name=not.is.null&select=winner_name");
  const map = {};
  rows.forEach(r => { if (r.winner_name) map[r.winner_name] = (map[r.winner_name] || 0) + 1; });
  return Object.entries(map)
    .map(([name, wins]) => ({ name, wins }))
    .sort((a, b) => b.wins - a.wins)
    .slice(0, 50);
}

/* getMatchQuestions(match) - שאלות התחרות לפי הסדר השמור */
async function getMatchQuestions(match) {
  const game = await getGameByCode(match.game_code);
  if (!game) return [];
  const byId = {};
  game.questions.forEach(q => { byId[q.id] = q; });
  return (match.question_ids || []).map(id => byId[id]).filter(Boolean);
}

/* ערבוב מערך (עותק) */
function shuffleArr(a) {
  const arr = a.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ------------------------------------------------------------
   generateGameCode() - קוד משחק אקראי בפורמט XY-1234.
   ------------------------------------------------------------ */
function generateGameCode() {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const p = letters[Math.floor(Math.random() * letters.length)] +
            letters[Math.floor(Math.random() * letters.length)];
  return p + "-" + Math.floor(1000 + Math.random() * 9000);
}

/* ============================================================
   seedDemoGame() - יצירת משחק הדוגמה DEMO-A1 אם אינו קיים.
   ============================================================ */
async function seedDemoGame() {
  const existing = await getGameByCode("DEMO-A1");
  if (existing) return;

  const demoGame = {
    id: "game_demo",
    code: "DEMO-A1",
    creatorName: "המורה איתן",
    creatorType: "teacher",
    creatorEmail: "teacher@example.com",
    grade: gradeRef("א"),
    subject: subjectRef("חשבון"),
    topic: "חיבור עד 10",
    subTopic: "",
    gameType: gameTypeRef("mario"),
    title: "תרגול חשבון לכיתה א",
    levels: 10,
    questions: [
      mkQ("qd1",  "כמה זה 2 + 3?",                          "5", ["4", "6", "7"],  "2 ועוד 3 הם 5"),
      mkQ("qd2",  "כמה זה 5 + 4?",                          "9", ["8", "10", "7"], "5 ועוד 4 הם 9"),
      mkQ("qd3",  "כמה זה 9 - 2?",                          "7", ["6", "8", "5"],  "9 פחות 2 הם 7"),
      mkQ("qd4",  "כמה זה 6 - 1?",                          "5", ["4", "6", "7"],  "6 פחות 1 הם 5"),
      mkQ("qd5",  "איזה מספר חסר? 3 + __ = 5",               "2", ["1", "3", "4"],  "3 ועוד 2 הם 5"),
      mkQ("qd6",  "איזה מספר גדול יותר: 7 או 4?",            "7", ["4"],            "7 גדול מ-4"),
      mkQ("qd7",  "כמה זה 10 - 5?",                         "5", ["4", "6", "3"],  "10 פחות 5 הם 5"),
      mkQ("qd8",  "כמה זה 1 + 8?",                          "9", ["8", "10", "7"], "1 ועוד 8 הם 9"),
      mkQ("qd9",  "לדני יש 3 תפוחים וקיבל עוד 2. כמה יש לו?",    "5", ["4", "6", "3"], "3 ועוד 2 הם 5"),
      mkQ("qd10", "לרוני היו 6 מדבקות והיא נתנה 2. כמה נשארו?",  "4", ["3", "5", "2"], "6 פחות 2 הם 4")
    ]
  };

  await saveGame(demoGame);
}

/* פונקציית עזר ליצירת שאלה (ברירת מחדל: בחירה מרובה, קל, 10 מטבעות) */
function mkQ(id, text, correctAnswer, wrongAnswers, explanation) {
  return {
    id: id,
    text: text,
    type: "multiple",
    correctAnswer: correctAnswer,
    wrongAnswers: wrongAnswers || [],
    difficulty: "easy",
    coins: 10,
    explanation: explanation || ""
  };
}
