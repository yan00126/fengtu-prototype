// 本地存储：数据只存在这台设备的浏览器里，不发送到任何地方。
const KEY = 'fengtu.v1';

export function emptyProfile() {
  return {
    withSpouse: false,
    birthYear: null,
    birthMonth: null,
    education: 'bachelor',
    canadianEducation: 'none',
    firstLanguage: 'en',
    // levels: { L, S, R, W }；source: 'test' | 'self'；date: 填写日期
    english: null,
    french: null,
    canadianWorkYears: 0,
    highWageTier: 'none',
    jobOfferTier: 'none',
    foreignWorkYears: 0,
    certificateOfQualification: false,
    pnp: false,
    sibling: false,
    spouse: { education: 'none', languageLevels: null, canadianWorkYears: 0 },
  };
}

export function emptyState() {
  return {
    version: 1,
    acceptedNotice: false,
    onboarded: false,
    nickname: '',
    profile: emptyProfile(),
    targets: { en: 9, fr: 7 },
    sessions: [], // { id, date, startedAt, minutes, branch, skill, mode, planned, completedPlan, source }
    events: [], // { id, date, key }  计数型行动
    exams: [], // { id, date, lang, test, kind: 'mock'|'official', scores, levels }
    nextExam: { en: null, fr: null }, // 下次考试 / 可重考日期
    canDo: {},
    focus: null, // { week, branch, skill }
    timer: null, // { startedAt, branch, skill, mode, planned }
    lastCelebration: null,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return { ...emptyState(), ...JSON.parse(raw) };
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

// 导出：withProfile 为 false 时去掉个人档案，只保留学习记录
export function exportJson(state, withProfile) {
  const data = { ...state, timer: null, exportedAt: new Date().toISOString() };
  if (!withProfile) {
    data.profile = null;
    data.nickname = '';
  }
  return JSON.stringify(data, null, 2);
}

export function importJson(text) {
  const data = JSON.parse(text);
  if (!data || data.version !== 1 || !Array.isArray(data.sessions)) throw new Error('文件格式不对');
  const base = emptyState();
  return { ...base, ...data, profile: data.profile || base.profile };
}
