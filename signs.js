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
  ];
})();
