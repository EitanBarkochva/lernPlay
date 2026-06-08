-- ============================================================
-- supabase_setup.sql
-- הטבלאות שלך כבר קיימות! הקובץ הזה רק מאפשר לאפליקציה (anon key)
-- לקרוא ולכתוב בטבלאות. הרץ ב-Supabase: SQL Editor -> New query -> Run.
--
-- שים לב: זו מדיניות פתוחה (כל מי שיש לו את הקוד יכול לקרוא/לכתוב),
-- מתאימה לשלב פיתוח/כיתה. כשתוסיף התחברות מורה עם סיסמה -> תחמיר כאן.
-- ============================================================

-- הפעלת RLS על כל הטבלאות
alter table learning_games   enable row level security;
alter table questions        enable row level security;
alter table question_options enable row level security;
alter table students         enable row level security;
alter table game_sessions    enable row level security;
alter table student_answers  enable row level security;
alter table creators         enable row level security;
alter table grades           enable row level security;
alter table subjects         enable row level security;
alter table topics           enable row level security;
alter table game_types       enable row level security;

-- פונקציית עזר: יוצרת מדיניות קריאה+כתיבה פתוחה לטבלה אחת
-- (מריצים ידנית לכל טבלה למטה כדי שיהיה ברור וניתן לעריכה)

-- ----- קריאה (SELECT) לכולם -----
drop policy if exists "anon read" on learning_games;   create policy "anon read" on learning_games   for select using (true);
drop policy if exists "anon read" on questions;        create policy "anon read" on questions        for select using (true);
drop policy if exists "anon read" on question_options; create policy "anon read" on question_options for select using (true);
drop policy if exists "anon read" on students;         create policy "anon read" on students         for select using (true);
drop policy if exists "anon read" on game_sessions;    create policy "anon read" on game_sessions    for select using (true);
drop policy if exists "anon read" on student_answers;  create policy "anon read" on student_answers  for select using (true);
drop policy if exists "anon read" on creators;         create policy "anon read" on creators         for select using (true);
drop policy if exists "anon read" on grades;           create policy "anon read" on grades           for select using (true);
drop policy if exists "anon read" on subjects;         create policy "anon read" on subjects         for select using (true);
drop policy if exists "anon read" on topics;           create policy "anon read" on topics           for select using (true);
drop policy if exists "anon read" on game_types;       create policy "anon read" on game_types       for select using (true);

-- ----- כתיבה (INSERT) לכולם -----
drop policy if exists "anon write" on learning_games;   create policy "anon write" on learning_games   for insert with check (true);
drop policy if exists "anon write" on questions;        create policy "anon write" on questions        for insert with check (true);
drop policy if exists "anon write" on question_options; create policy "anon write" on question_options for insert with check (true);
drop policy if exists "anon write" on students;         create policy "anon write" on students         for insert with check (true);
drop policy if exists "anon write" on game_sessions;    create policy "anon write" on game_sessions    for insert with check (true);
drop policy if exists "anon write" on student_answers;  create policy "anon write" on student_answers  for insert with check (true);
drop policy if exists "anon write" on creators;         create policy "anon write" on creators         for insert with check (true);

-- ============================================================
-- (לא חובה) נתוני עזר לדוגמה - הרץ רק אם הטבלאות ריקות:
-- ============================================================
-- insert into grades (name, sort_order) values ('א',1),('ב',2),('ג',3) on conflict do nothing;
-- insert into subjects (name) values ('חשבון'),('עברית'),('אנגלית') on conflict do nothing;
-- insert into game_types (code, name) values ('mario','סופר מריו') on conflict do nothing;
