# מסד הנתונים מחובר ✅

האפליקציה מחוברת לפרויקט Supabase ייעודי שנבנה עבורה — **הכל כבר מוכן ועובד**,
לא צריך לעשות כלום. הנתונים נשמרים בענן ומשותפים בין כל המחשבים.

## פרטי הפרויקט
| | |
|---|---|
| שם פרויקט | **lernPlay** |
| Project URL | `https://tgmafboqaezfleggttyk.supabase.co` |
| מפתח | anon key (כבר מוטמע ב-[`data.js`](data.js)) |
| עלות | חינם ($0/חודש) |

המפתחות כבר נמצאים בראש [`data.js`](data.js) — פשוט פתח את `index.html` והכל עובד מול הענן.

## הטבלאות שנוצרו
**טבלאות ראשיות:** `learning_games`, `questions`, `question_options`,
`students`, `game_sessions`, `student_answers`
**טבלאות עזר:** `grades` (א-יב), `subjects` (7 מקצועות), `game_types` (5 סוגים),
`topics` (נושאי חשבון לכיתה א), `creators`, `question_bank` (לעתיד)

טבלאות העזר כבר מלאות בנתונים, ומשחק הדוגמה **DEMO-A1** (10 שאלות) כבר קיים.

## מיפוי פעולות לטבלאות
| פעולה באפליקציה | מה קורה ב-DB |
|------------------|--------------|
| יצירת משחק | `creators` → `learning_games` → `questions` → `question_options` |
| כניסת תלמיד עם קוד | קריאה מ-`learning_games` + `questions` + `question_options` |
| סיום משחק / quiz | `students` → `game_sessions` → `student_answers` |
| דוח מורה | `game_sessions` + `students` + `student_answers` + `questions` |
| רשימות נפתחות | `grades`, `subjects`, `topics`, `game_types` |

## הרשאות (RLS)
RLS מופעל על כל הטבלאות עם מדיניות גישה ציבורית (קריאה+כתיבה+עדכון ל-anon),
מתאים לשלב כיתה/פיתוח. הקובץ [`supabase_setup.sql`](supabase_setup.sql) שמור
לתיעוד בלבד — **כבר הורץ**, אין צורך להריץ שוב.

## לעבור חזרה למצב מקומי (אם בא לך)
אם תרצה לבדוק בלי ענן, פשוט החזר את שני הערכים בראש `data.js` ל-`YOUR_PROJECT`/
`YOUR_ANON_KEY` והאפליקציה תעבוד על localStorage.

## פיתוח עתידי (הרחבות מומלצות)
- התחברות מורה עם סיסמה → להחמיר את מדיניות ה-RLS
- שליחת מייל אמיתית (Edge Function) במקום `mailto:`
- יצירת שאלות עם AI ושמירה ב-`question_bank`
- הפעלת סוגי משחק נוספים (פאקמן/חללית) מטבלת `game_types`
