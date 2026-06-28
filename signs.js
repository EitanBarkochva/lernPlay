/* ============================================================
   signs.js — תמרורי תנועה ללימוד תאוריה (כרטיסיות + משחק)
   כל תמרור: name (המשמעות), cat (קטגוריה), svg (ציור).
   הציורים הם גרסאות מצוירות נאמנות (לא תצלומים רשמיים).
   ============================================================ */
const ROAD_SIGNS = (function () {
  // עוטף svg בריבוע 100x100
  const W = inner => `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
  const RED = "#e30613", BLUE = "#0d57a7", YEL = "#ffd400", BLK = "#1a1a1a", WHT = "#ffffff";
  // משולש אזהרה (רקע לבן, מסגרת אדומה)
  const tri = sym => W(`<polygon points="50,8 94,86 6,86" fill="${WHT}" stroke="${RED}" stroke-width="7" stroke-linejoin="round"/>${sym}`);
  // עיגול איסור (לבן, מסגרת אדומה)
  const ban = sym => W(`<circle cx="50" cy="50" r="42" fill="${WHT}" stroke="${RED}" stroke-width="8"/>${sym}`);
  // עיגול חובה (כחול מלא, סמל לבן)
  const must = sym => W(`<circle cx="50" cy="50" r="44" fill="${BLUE}"/>${sym}`);
  // ריבוע מידע (כחול)
  const info = sym => W(`<rect x="8" y="8" width="84" height="84" rx="6" fill="${BLUE}"/>${sym}`);
  const slash = `<line x1="22" y1="22" x2="78" y2="78" stroke="${RED}" stroke-width="8"/>`;

  return [
    { name: "עצור — עצירה מוחלטת", cat: "איסור",
      svg: W(`<polygon points="32,8 68,8 92,32 92,68 68,92 32,92 8,68 8,32" fill="${RED}"/><text x="50" y="60" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="26" fill="${WHT}">עצור</text>`) },
    { name: "תן זכות קדימה", cat: "איסור",
      svg: W(`<polygon points="50,90 6,14 94,14" fill="${WHT}" stroke="${RED}" stroke-width="7" stroke-linejoin="round"/>`) },
    { name: "אין כניסה", cat: "איסור",
      svg: ban(`<rect x="26" y="44" width="48" height="12" fill="${RED}"/>`) },
    { name: "מהירות מרבית 50 קמ\"ש", cat: "איסור",
      svg: ban(`<text x="50" y="64" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="34" fill="${BLK}">50</text>`) },
    { name: "מהירות מרבית 90 קמ\"ש", cat: "איסור",
      svg: ban(`<text x="50" y="64" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="34" fill="${BLK}">90</text>`) },
    { name: "אסור לפנות שמאלה", cat: "איסור",
      svg: ban(`<path d="M62 70 V46 H40 l8 -8 M40 46 l8 8" fill="none" stroke="${BLK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${slash}`) },
    { name: "אסור לפנות ימינה", cat: "איסור",
      svg: ban(`<path d="M38 70 V46 H60 l-8 -8 M60 46 l-8 8" fill="none" stroke="${BLK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>${slash}`) },
    { name: "אסור לעקוף", cat: "איסור",
      svg: ban(`<rect x="30" y="34" width="16" height="32" rx="3" fill="${RED}"/><rect x="54" y="34" width="16" height="32" rx="3" fill="${BLK}"/>`) },
    { name: "חניה אסורה", cat: "איסור",
      svg: W(`<circle cx="50" cy="50" r="42" fill="${BLUE}" stroke="${RED}" stroke-width="8"/><line x1="22" y1="22" x2="78" y2="78" stroke="${RED}" stroke-width="8"/><text x="50" y="62" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="30" fill="${WHT}">P</text>`) },
    { name: "סע ישר בלבד", cat: "חובה",
      svg: must(`<path d="M50 74 V32 M50 32 l-12 14 M50 32 l12 14" fill="none" stroke="${WHT}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "פנה ימינה", cat: "חובה",
      svg: must(`<path d="M34 50 H66 M66 50 l-14 -12 M66 50 l-14 12" fill="none" stroke="${WHT}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "פנה שמאלה", cat: "חובה",
      svg: must(`<path d="M66 50 H34 M34 50 l14 -12 M34 50 l14 12" fill="none" stroke="${WHT}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "כיכר (מעגל תנועה) — חובה", cat: "חובה",
      svg: must(`<g fill="none" stroke="${WHT}" stroke-width="6"><path d="M50 26 a24 24 0 1 1 -22 14"/><path d="M28 40 l-4 -10 M28 40 l10 -2" stroke-linecap="round"/></g>`) },
    { name: "עיקול חד שמאלה", cat: "אזהרה",
      svg: tri(`<path d="M58 78 V52 q0 -16 -16 -16 l8 -8 M42 36 l8 8" fill="none" stroke="${BLK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "עיקול חד ימינה", cat: "אזהרה",
      svg: tri(`<path d="M42 78 V52 q0 -16 16 -16 l-8 -8 M58 36 l-8 8" fill="none" stroke="${BLK}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "צומת לפניך", cat: "אזהרה",
      svg: tri(`<path d="M50 32 V78 M30 54 H70" stroke="${BLK}" stroke-width="7" stroke-linecap="round"/>`) },
    { name: "רמזור לפניך", cat: "אזהרה",
      svg: tri(`<rect x="42" y="34" width="16" height="40" rx="4" fill="${BLK}"/><circle cx="50" cy="42" r="4" fill="${RED}"/><circle cx="50" cy="54" r="4" fill="${YEL}"/><circle cx="50" cy="66" r="4" fill="#19a319"/>`) },
    { name: "מעבר חצייה (הולכי רגל)", cat: "אזהרה",
      svg: tri(`<circle cx="50" cy="40" r="6" fill="${BLK}"/><path d="M50 46 v18 M50 52 l-9 6 M50 52 l9 6 M50 64 l-7 12 M50 64 l7 12" stroke="${BLK}" stroke-width="4" fill="none" stroke-linecap="round"/>`) },
    { name: "ילדים / בית ספר", cat: "אזהרה",
      svg: tri(`<circle cx="42" cy="42" r="5" fill="${BLK}"/><path d="M42 47 v14 M42 52 l-7 5 M42 52 l7 5 M42 61 l-6 11 M42 61 l6 11" stroke="${BLK}" stroke-width="3.5" fill="none" stroke-linecap="round"/><circle cx="60" cy="46" r="4.5" fill="${BLK}"/><path d="M60 50 v12 M60 54 l-6 4 M60 54 l6 4 M60 62 l-5 9 M60 62 l5 9" stroke="${BLK}" stroke-width="3" fill="none" stroke-linecap="round"/>`) },
    { name: "חניה מותרת", cat: "מידע",
      svg: info(`<text x="50" y="68" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="48" fill="${WHT}">P</text>`) },
    { name: "מהירות מרבית 30 קמ\"ש", cat: "איסור",
      svg: ban(`<text x="50" y="64" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="34" fill="${BLK}">30</text>`) },
    { name: "היצרות הדרך", cat: "אזהרה",
      svg: tri(`<path d="M34 80 L44 50 M66 80 L56 50" stroke="${BLK}" stroke-width="7" stroke-linecap="round"/>`) },

    // ===== תוספת תמרורים =====
    { name: "מהירות מרבית 70 קמ\"ש", cat: "איסור",
      svg: ban(`<text x="50" y="64" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="34" fill="${BLK}">70</text>`) },
    { name: "מהירות מרבית 100 קמ\"ש", cat: "איסור",
      svg: ban(`<text x="50" y="62" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="26" fill="${BLK}">100</text>`) },
    { name: "סוף כל ההגבלות", cat: "איסור",
      svg: W(`<circle cx="50" cy="50" r="42" fill="${WHT}" stroke="#777" stroke-width="4"/><g stroke="#777" stroke-width="5" stroke-linecap="round"><line x1="30" y1="24" x2="76" y2="70"/><line x1="24" y1="30" x2="70" y2="76"/></g>`) },
    { name: "אסור לבצע פניית פרסה", cat: "איסור",
      svg: ban(`<path d="M38 68 V46 a12 12 0 0 1 24 0 V60 l-7 -7 M62 60 l7 -7" fill="none" stroke="${BLK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>${slash}`) },
    { name: "אסורה כניסת אופניים", cat: "איסור",
      svg: ban(`<g fill="none" stroke="${BLK}" stroke-width="3.5"><circle cx="38" cy="58" r="8"/><circle cx="62" cy="58" r="8"/><path d="M38 58 L50 42 L62 58 M44 42 H56 M50 42 V58" stroke-linecap="round"/></g>${slash}`) },

    { name: "ירידה תלולה", cat: "אזהרה",
      svg: tri(`<path d="M22 50 L78 78" stroke="${BLK}" stroke-width="6" stroke-linecap="round"/><text x="34" y="46" font-family="Arial" font-weight="bold" font-size="15" fill="${BLK}">10%</text>`) },
    { name: "עלייה תלולה", cat: "אזהרה",
      svg: tri(`<path d="M22 78 L78 50" stroke="${BLK}" stroke-width="6" stroke-linecap="round"/><text x="40" y="80" font-family="Arial" font-weight="bold" font-size="15" fill="${BLK}">10%</text>`) },
    { name: "דרך משובשת (בליטות)", cat: "אזהרה",
      svg: tri(`<path d="M24 74 q10 -24 20 0 q10 -24 20 0" fill="none" stroke="${BLK}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "מפגש מסילת ברזל עם מחסום", cat: "אזהרה",
      svg: tri(`<g stroke="${BLK}" stroke-width="5" stroke-linecap="round"><line x1="34" y1="42" x2="34" y2="76"/><line x1="30" y1="50" x2="72" y2="50"/></g>`) },
    { name: "מפגש מסילת ברזל ללא מחסום", cat: "אזהרה",
      svg: tri(`<g fill="${BLK}"><rect x="32" y="50" width="26" height="14" rx="2"/><rect x="54" y="42" width="10" height="22" rx="1"/><circle cx="39" cy="68" r="4"/><circle cx="57" cy="68" r="4"/></g>`) },
    { name: "עבודות בדרך", cat: "אזהרה",
      svg: tri(`<circle cx="44" cy="40" r="5" fill="${BLK}"/><path d="M44 45 V60 M44 50 L34 56 M44 50 L56 46 M44 60 L37 76 M44 60 L51 76 M56 46 L66 56" stroke="${BLK}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 80 q14 -10 30 0 Z" fill="${BLK}"/>`) },
    { name: "בעלי חיים בדרך", cat: "אזהרה",
      svg: tri(`<g stroke="${BLK}" stroke-width="4" stroke-linecap="round" fill="none"><ellipse cx="48" cy="56" rx="14" ry="6" fill="${BLK}" stroke="none"/><line x1="40" y1="60" x2="38" y2="74"/><line x1="46" y1="61" x2="45" y2="74"/><line x1="54" y1="61" x2="55" y2="74"/><line x1="60" y1="60" x2="63" y2="74"/><line x1="61" y1="52" x2="68" y2="42"/><path d="M68 42 l-3 -6 M68 42 l6 -2"/></g>`) },
    { name: "כביש חלקלק", cat: "אזהרה",
      svg: tri(`<rect x="40" y="42" width="20" height="12" rx="3" fill="${BLK}"/><circle cx="44" cy="56" r="3" fill="${BLK}"/><circle cx="56" cy="56" r="3" fill="${BLK}"/><path d="M30 74 q5 -7 10 0 q5 7 10 0 q5 -7 10 0" fill="none" stroke="${BLK}" stroke-width="3.5" stroke-linecap="round"/>`) },

    { name: "נתיב אופניים (חובה)", cat: "חובה",
      svg: must(`<g fill="none" stroke="${WHT}" stroke-width="4"><circle cx="38" cy="60" r="9"/><circle cx="62" cy="60" r="9"/><path d="M38 60 L50 44 L62 60 M44 44 H56 M50 44 V60" stroke-linecap="round"/></g>`) },
    { name: "שביל להולכי רגל (חובה)", cat: "חובה",
      svg: must(`<circle cx="50" cy="32" r="5" fill="${WHT}"/><path d="M50 38 V58 M50 44 L42 52 M50 44 L58 52 M50 58 L44 74 M50 58 L56 74" stroke="${WHT}" stroke-width="4" fill="none" stroke-linecap="round"/>`) },
    { name: "עבור מצד ימין", cat: "חובה",
      svg: must(`<path d="M40 38 L62 62 M62 62 l-13 0 M62 62 l0 -13" fill="none" stroke="${WHT}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>`) },

    { name: "דרך חד-סטרית", cat: "מידע",
      svg: info(`<path d="M28 50 H68 M68 50 l-12 -9 M68 50 l-12 9" fill="none" stroke="${WHT}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>`) },
    { name: "דרך ללא מוצא", cat: "מידע",
      svg: info(`<path d="M50 78 V46 M34 46 H66" fill="none" stroke="${WHT}" stroke-width="8" stroke-linecap="round"/><rect x="33" y="40" width="34" height="6" fill="${RED}"/>`) },
    { name: "חניית נכים", cat: "מידע",
      svg: info(`<circle cx="44" cy="30" r="5" fill="${WHT}"/><path d="M44 36 V52 H58" fill="none" stroke="${WHT}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="52" cy="62" r="13" fill="none" stroke="${WHT}" stroke-width="4"/>`) },
    { name: "תחנת אוטובוס", cat: "מידע",
      svg: info(`<g stroke="${WHT}" stroke-width="3.5" fill="none"><rect x="30" y="32" width="40" height="30" rx="4"/><line x1="30" y1="50" x2="70" y2="50"/></g><circle cx="40" cy="66" r="4" fill="${WHT}"/><circle cx="60" cy="66" r="4" fill="${WHT}"/>`) },
    { name: "בית חולים", cat: "מידע",
      svg: info(`<text x="50" y="68" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="48" fill="${WHT}">H</text>`) },
    { name: "מהירות מומלצת 60 קמ\"ש", cat: "מידע",
      svg: info(`<text x="50" y="64" text-anchor="middle" font-family="Arial" font-weight="bold" font-size="34" fill="${WHT}">60</text>`) },
  ];
})();
