// CRS 规则（按 IRCC 公开规则整理）。纯函数，不依赖浏览器。
// 来源：
//   https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/check-score/crs-criteria.html （2026-10-16）
//   https://www.canada.ca/en/immigration-refugees-citizenship/services/immigrate-canada/express-entry/changes.html （LMI，2026-11-03 生效）
//   https://www.canada.ca/en/immigration-refugees-citizenship/services/study-canada/work/after-graduation/eligibility/language-results.html （成绩换算）

export const RULES_VERSION = '2026-11-03';

export const ABILITIES = ['L', 'S', 'R', 'W'];
export const ABILITY_NAMES = { L: '听', S: '说', R: '读', W: '写' };

// ---------- 年龄 ----------
// [单人, 有配偶]
const AGE_POINTS = {
  18: [99, 90], 19: [105, 95], 30: [105, 95], 31: [99, 90], 32: [94, 85], 33: [88, 80],
  34: [83, 75], 35: [77, 70], 36: [72, 65], 37: [66, 60], 38: [61, 55], 39: [55, 50],
  40: [50, 45], 41: [39, 35], 42: [28, 25], 43: [17, 15], 44: [6, 5],
};

export function agePoints(age, withSpouse) {
  const i = withSpouse ? 1 : 0;
  if (age == null || age < 18 || age >= 45) return 0;
  if (age >= 20 && age <= 29) return [110, 100][i];
  return AGE_POINTS[age][i];
}

export function ageFromBirth(birthYear, birthMonth, today = new Date()) {
  if (!birthYear) return null;
  let age = today.getFullYear() - birthYear;
  const month = today.getMonth() + 1;
  if (birthMonth && month < birthMonth) age -= 1;
  return age;
}

// ---------- 学历 ----------
export const EDUCATION_LEVELS = [
  { key: 'none', name: '高中以下' },
  { key: 'secondary', name: '高中' },
  { key: 'one_year', name: '1 年制专上' },
  { key: 'two_year', name: '2 年制专上' },
  { key: 'bachelor', name: '学士或 3 年以上' },
  { key: 'two_or_more', name: '两个以上学历（其一 3 年以上）' },
  { key: 'master', name: '硕士或专业学位' },
  { key: 'phd', name: '博士' },
];

const EDU_POINTS = {
  none: [0, 0], secondary: [30, 28], one_year: [90, 84], two_year: [98, 91],
  bachelor: [120, 112], two_or_more: [128, 119], master: [135, 126], phd: [150, 140],
};
const SPOUSE_EDU_POINTS = {
  none: 0, secondary: 2, one_year: 6, two_year: 7, bachelor: 8, two_or_more: 9, master: 10, phd: 10,
};

// 连携技里的学历档位：0 = 无，1 = 1 年以上专上，2 = 两个以上学历 / 硕士 / 博士
function eduTier(edu) {
  if (['two_or_more', 'master', 'phd'].includes(edu)) return 2;
  if (['one_year', 'two_year', 'bachelor'].includes(edu)) return 1;
  return 0;
}

// ---------- 语言 ----------
export function firstLanguagePoints(clb, withSpouse) {
  if (!clb || clb < 4) return 0;
  const single = { 4: 6, 5: 6, 6: 9, 7: 17, 8: 23, 9: 31 };
  const spouse = { 4: 6, 5: 6, 6: 8, 7: 16, 8: 22, 9: 29 };
  if (clb >= 10) return withSpouse ? 32 : 34;
  return (withSpouse ? spouse : single)[clb];
}

export function secondLanguagePoints(clb) {
  if (!clb || clb <= 4) return 0;
  if (clb <= 6) return 1;
  if (clb <= 8) return 3;
  return 6;
}

function spouseLanguagePoints(clb) {
  if (!clb || clb <= 4) return 0;
  if (clb <= 6) return 1;
  if (clb <= 8) return 3;
  return 5;
}

const minClb = (levels) => (levels ? Math.min(...ABILITIES.map((a) => levels[a] || 0)) : 0);
const allAtLeast = (levels, n) => minClb(levels) >= n;

// ---------- 考试成绩 → CLB/NCLC ----------
// 每项是 CLB 10..4 的下限
const TEST_TABLES = {
  IELTS: { L: [8.5, 8.0, 7.5, 6.0, 5.5, 5.0, 4.5], R: [8.0, 7.0, 6.5, 6.0, 5.0, 4.0, 3.5], W: [7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.0], S: [7.5, 7.0, 6.5, 6.0, 5.5, 5.0, 4.0] },
  PTE: { L: [89, 82, 71, 60, 50, 39, 28], R: [88, 78, 69, 60, 51, 42, 33], W: [90, 88, 79, 69, 60, 51, 41], S: [89, 84, 76, 68, 59, 51, 42] },
  TEF: { L: [546, 503, 462, 434, 393, 352, 306], R: [546, 503, 462, 434, 393, 352, 306], W: [558, 512, 472, 428, 379, 330, 268], S: [556, 518, 494, 456, 422, 387, 328] },
  TCF: { L: [549, 523, 503, 458, 398, 369, 331], R: [549, 524, 499, 453, 406, 375, 342], W: [16, 14, 12, 10, 7, 6, 4], S: [16, 14, 12, 10, 7, 6, 4] },
};

export const TESTS = {
  en: [
    { key: 'IELTS', name: 'IELTS 培训类' },
    { key: 'CELPIP', name: 'CELPIP' },
    { key: 'PTE', name: 'PTE Core' },
  ],
  fr: [
    { key: 'TEF', name: 'TEF Canada' },
    { key: 'TCF', name: 'TCF Canada' },
  ],
};

export function scoreToClb(test, ability, score) {
  if (score == null || score === '' || Number.isNaN(Number(score))) return null;
  const s = Number(score);
  if (test === 'CELPIP') return s < 4 ? 0 : Math.min(Math.floor(s), 10);
  const row = TEST_TABLES[test]?.[ability];
  if (!row) return null;
  for (let i = 0; i < row.length; i++) if (s >= row[i]) return 10 - i;
  return 0;
}

export function scoresToLevels(test, scores) {
  const out = {};
  for (const a of ABILITIES) out[a] = scoreToClb(test, a, scores?.[a]);
  return out;
}

// 下一个 CLB 需要的分数（用于“还差多少”）
export function nextThreshold(test, ability, clb) {
  if (clb >= 10) return null;
  const target = Math.max((clb || 3) + 1, 4);
  if (test === 'CELPIP') return target;
  const row = TEST_TABLES[test]?.[ability];
  return row ? row[10 - target] : null;
}

export function thresholdFor(test, ability, clb) {
  if (test === 'CELPIP') return clb;
  const row = TEST_TABLES[test]?.[ability];
  return row && clb >= 4 && clb <= 10 ? row[10 - clb] : null;
}

// ---------- 劳动力市场融入（LMI，2026-11-03 起） ----------
const WORK_LENGTH = { single: [0, 40, 53, 64, 72, 80], spouse: [0, 35, 46, 56, 63, 70] };
export const WAGE_TIERS = [
  { key: 'none', name: '不是高薪职业 / 不满 12 个月' },
  { key: 't13', name: '≥ 全国平均中位工资 1.3 倍' },
  { key: 't15', name: '≥ 1.5 倍' },
  { key: 't20', name: '≥ 2 倍' },
];
const HIGH_WAGE_POINTS = { none: 0, t13: 20, t15: 40, t20: 70 };
const JOB_OFFER_POINTS = { none: 0, t13: 50, t15: 70, t20: 100 };

export function workLengthPoints(years, withSpouse) {
  const y = Math.max(0, Math.min(5, Math.floor(years || 0)));
  return WORK_LENGTH[withSpouse ? 'spouse' : 'single'][y];
}

export function lmi(profile, withSpouse) {
  const exp = workLengthPoints(profile.canadianWorkYears, withSpouse) +
    ((profile.canadianWorkYears || 0) >= 1 ? HIGH_WAGE_POINTS[profile.highWageTier || 'none'] : 0);
  const offer = JOB_OFFER_POINTS[profile.jobOfferTier || 'none'];
  return { experience: exp, offer, points: Math.max(exp, offer), active: offer > exp ? 'offer' : 'experience' };
}

// ---------- 总分 ----------
// profile 结构见 store.js 的 emptyProfile()
export function computeCrs(profile, today = new Date()) {
  const withSpouse = !!profile.withSpouse;
  const age = ageFromBirth(profile.birthYear, profile.birthMonth, today);
  const en = profile.english?.levels || null;
  const fr = profile.french?.levels || null;
  const firstIsFrench = profile.firstLanguage === 'fr';
  const first = firstIsFrench ? fr : en;
  const second = firstIsFrench ? en : fr;

  const sum = (levels, fn) => (levels ? ABILITIES.reduce((t, a) => t + fn(levels[a] || 0), 0) : 0);

  // A. 核心
  const A = {
    age: agePoints(age, withSpouse),
    education: EDU_POINTS[profile.education || 'none'][withSpouse ? 1 : 0],
    firstLanguage: sum(first, (c) => firstLanguagePoints(c, withSpouse)),
    secondLanguage: Math.min(sum(second, secondLanguagePoints), withSpouse ? 22 : 24),
    lmi: lmi(profile, withSpouse).points,
  };

  // B. 配偶
  const sp = profile.spouse || {};
  const B = withSpouse
    ? {
        education: SPOUSE_EDU_POINTS[sp.education || 'none'],
        language: sum(sp.languageLevels, spouseLanguagePoints),
        work: [0, 5, 7, 8, 9, 10][Math.max(0, Math.min(5, Math.floor(sp.canadianWorkYears || 0)))],
      }
    : { education: 0, language: 0, work: 0 };

  // C. 连携技（按第一官方语言）
  const tier = eduTier(profile.education);
  const can = Math.floor(profile.canadianWorkYears || 0);
  const foreign = Math.floor(profile.foreignWorkYears || 0);
  const fTier = foreign >= 3 ? 2 : foreign >= 1 ? 1 : 0;
  const langBand = allAtLeast(first, 9) ? 2 : allAtLeast(first, 7) ? 1 : 0;
  const pick = (t, band) => (t === 0 || band === 0 ? 0 : [[13, 25], [25, 50]][t - 1][band - 1]);

  const eduLang = pick(tier, langBand);
  const eduWork = pick(tier, can >= 2 ? 2 : can >= 1 ? 1 : 0);
  const forLang = pick(fTier, langBand);
  const forWork = pick(fTier, can >= 2 ? 2 : can >= 1 ? 1 : 0);
  let cert = 0;
  if (profile.certificateOfQualification) {
    if (allAtLeast(first, 7)) cert = 50;
    else if (allAtLeast(first, 5)) cert = 25;
  }
  const C = {
    education: Math.min(eduLang + eduWork, 50),
    foreignWork: Math.min(forLang + forWork, 50),
    certificate: cert,
    detail: { eduLang, eduWork, forLang, forWork },
  };
  const cTotal = Math.min(C.education + C.foreignWork + C.certificate, 100);

  // D. 附加
  let french = 0;
  if (allAtLeast(fr, 7)) french = allAtLeast(en, 5) ? 50 : 25;
  const D = {
    pnp: profile.pnp ? 600 : 0,
    sibling: profile.sibling ? 15 : 0,
    canadianEducation: { none: 0, short: 15, long: 30 }[profile.canadianEducation || 'none'],
    french,
  };
  const dTotal = Math.min(D.pnp + D.sibling + D.canadianEducation + D.french, 600);

  const aTotal = A.age + A.education + A.firstLanguage + A.secondLanguage + A.lmi;
  const bTotal = B.education + B.language + B.work;
  return {
    total: aTotal + bTotal + cTotal + dTotal,
    age,
    withSpouse,
    A, B, C, D,
    subtotals: { A: aTotal, B: bTotal, C: cTotal, D: dTotal },
    lmi: lmi(profile, withSpouse),
  };
}

// 各项上限（用于属性面板）
export function maxima(withSpouse) {
  return {
    age: withSpouse ? 100 : 110,
    education: withSpouse ? 140 : 150,
    firstLanguage: withSpouse ? 128 : 136,
    secondLanguage: withSpouse ? 22 : 24,
    lmi: withSpouse ? 140 : 150,
    spouse: 40,
    transferability: 100,
    additional: 600,
  };
}
