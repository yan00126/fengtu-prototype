// XP、连续打卡、熟练度、成就。纯函数，不依赖浏览器。
import { XP, SUBLEVELS, PROFICIENCY_PASSIVE_RATE, HOURS_PER_LEVEL_PER_SKILL } from './content.js';
import { ABILITIES } from './rules.js';

export function dateKey(d = new Date()) {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
}

function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

// 周一开始的周
export function weekKey(key) {
  const d = parseKey(key);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return dateKey(d);
}

// 当天累计时长 [from, from+len) 中，按每日递减规则折算后的分钟数
function diminished(from, len) {
  const seg = (a, b, w) => Math.max(0, Math.min(from + len, b) - Math.max(from, a)) * w;
  return seg(0, XP.fullMinutes, 1) + seg(XP.fullMinutes, XP.halfMinutes, 0.5);
}

// 一天的 XP。sessions: 当天的学习记录；events: 当天的计数型行动；focus: { branch, skill } 本周重点
export function dayXp(sessions = [], events = [], focus = null) {
  const sorted = [...sessions].sort((a, b) => (a.startedAt || 0) - (b.startedAt || 0));
  let cum = 0;
  let xp = 0;
  let active = 0;
  let passive = 0;
  let plans = 0;
  for (const s of sorted) {
    const len = Math.max(0, s.minutes || 0);
    const rate = s.mode === 'passive' ? XP.passiveRate : 1;
    const isFocus = focus && focus.branch === s.branch && (!focus.skill || focus.skill === s.skill);
    xp += diminished(cum, len) * rate * (isFocus ? 1 + XP.focusBonus : 1);
    cum += len;
    if (s.mode === 'passive') passive += len; else active += len;
    if (s.completedPlan) plans += 1;
  }
  const first = sorted.length ? XP.firstOfDay : 0;
  const planBonus = plans * XP.planComplete;
  const counterXp = events.reduce((t, e) => t + (XP.counters[e.key] || 0), 0);
  return {
    xp: Math.round(xp) + first + planBonus + counterXp,
    minutes: active + passive,
    active,
    passive,
    bonus: { first, plan: planBonus, counters: counterXp },
  };
}

function groupByDay(items) {
  const m = new Map();
  for (const it of items || []) {
    if (!m.has(it.date)) m.set(it.date, []);
    m.get(it.date).push(it);
  }
  return m;
}

export function focusFor(state, key) {
  return state.focus && state.focus.week === weekKey(key) ? state.focus : null;
}

export function xpByDay(state) {
  const sessions = groupByDay(state.sessions);
  const events = groupByDay(state.events);
  const days = new Set([...sessions.keys(), ...events.keys()]);
  const out = new Map();
  for (const k of days) out.set(k, dayXp(sessions.get(k), events.get(k), focusFor(state, k)));
  return out;
}

export function totals(state) {
  let xp = 0;
  let minutes = 0;
  for (const d of xpByDay(state).values()) {
    xp += d.xp;
    minutes += d.minutes;
  }
  return { xp, minutes, level: Math.floor(xp / XP.perLevel) + 1, levelProgress: (xp % XP.perLevel) / XP.perLevel };
}

// 连续打卡：有学习记录或计数型行动的一天算“活跃”。每周最多 2 张冻结卡，自动用掉。
export function streak(activeKeys, today = dateKey()) {
  const set = new Set(activeKeys);
  const thisWeek = weekKey(today);
  if (!set.size) return { current: 0, longest: 0, freezesLeft: XP.freezesPerWeek, frozen: [] };
  const sorted = [...set].sort();
  const used = {};
  const frozen = [];
  let cur = 0;
  let longest = 0;
  for (let k = sorted[0]; k <= today; k = addDays(k, 1)) {
    if (set.has(k)) {
      cur += 1;
      longest = Math.max(longest, cur);
    } else if (k !== today) {
      const w = weekKey(k);
      if (cur > 0 && (used[w] || 0) < XP.freezesPerWeek) {
        used[w] = (used[w] || 0) + 1;
        frozen.push(k);
      } else {
        cur = 0;
      }
    }
  }
  return { current: cur, longest, freezesLeft: XP.freezesPerWeek - (used[thisWeek] || 0), frozen };
}

export function activeDays(state) {
  return [...new Set([...(state.sessions || []), ...(state.events || [])].map((x) => x.date))];
}

// ---------- 熟练度 ----------
export function effectiveHours(sessions, lang, skill, sinceKey = null) {
  let min = 0;
  for (const s of sessions || []) {
    if (s.branch !== lang) continue;
    if (sinceKey && s.date < sinceKey) continue;
    const w = s.mode === 'passive' ? PROFICIENCY_PASSIVE_RATE : 1;
    if (!skill) min += s.minutes * w;
    else if (s.skill === skill) min += s.minutes * w;
    else if (s.skill === 'G') min += (s.minutes * w) / 4; // 通用练习平均分给四项
  }
  return min / 60;
}

export function sublevel(hours) {
  let i = 0;
  while (i + 1 < SUBLEVELS.length && hours >= SUBLEVELS[i + 1].from) i += 1;
  const cur = SUBLEVELS[i];
  const next = SUBLEVELS[i + 1] || null;
  const progress = next ? (hours - cur.from) / (next.from - cur.from) : 1;
  return { ...cur, index: i, next, progress: Math.min(1, Math.max(0, progress)) };
}

// 某语言某子技能的基准：最近一次考试（模考或正式），其次是捏人时填的成绩
export function baseline(state, lang, skill) {
  const exams = (state.exams || []).filter((e) => e.lang === lang && e.levels?.[skill] != null)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  if (exams.length) return { level: exams[0].levels[skill], date: exams[0].date, source: exams[0].kind };
  const p = state.profile?.[lang === 'en' ? 'english' : 'french'];
  if (p?.levels?.[skill] != null) return { level: p.levels[skill], date: p.date || null, source: p.source || 'self' };
  return null;
}

// 法语小等级：四项都有成绩时，从最低一项对应的小等级起算，再加上之后的学习时长；否则按累计时长
export function frenchSublevel(state) {
  const bases = ABILITIES.map((a) => baseline(state, 'fr', a));
  const total = effectiveHours(state.sessions, 'fr', null);
  if (bases.every((b) => b && b.level >= 1)) {
    const min = Math.min(...bases.map((b) => b.level));
    const since = bases.map((b) => b.date).filter(Boolean).sort().pop() || null;
    const start = [...SUBLEVELS].reverse().find((s) => s.nclc <= min) || SUBLEVELS[0];
    const hours = start.from + effectiveHours(state.sessions, 'fr', null, since);
    return { ...sublevel(hours), hoursEquivalent: hours, totalHours: total, calibrated: true };
  }
  return { ...sublevel(total), hoursEquivalent: total, totalHours: total, calibrated: false };
}

// 返回 { calibrated, estimate, source, hoursSince }
// calibrated：考试或自填的等级；estimate：加上之后学习时长推算出的小数等级
export function proficiency(state, lang, skill) {
  const b = baseline(state, lang, skill);
  if (b) {
    const hours = effectiveHours(state.sessions, lang, skill, b.date);
    const estimate = Math.min(12, b.level + hours / HOURS_PER_LEVEL_PER_SKILL);
    return { calibrated: b.level, estimate, source: b.source, hoursSince: hours };
  }
  // 没有任何成绩：按小等级表估算（单项时长 × 4 近似整门语言）
  const hours = effectiveHours(state.sessions, lang, skill);
  const sl = sublevel(hours * 4);
  const nextNclc = sl.next ? sl.next.nclc : sl.nclc;
  return { calibrated: null, estimate: sl.nclc + (nextNclc - sl.nclc) * sl.progress, source: 'hours', hoursSince: hours };
}

// ---------- 考试（Boss 战） ----------
export function attempts(state, lang) {
  return (state.exams || []).filter((e) => e.lang === lang && e.kind === 'official').length;
}

export function partialWins(exam, target) {
  return ABILITIES.filter((a) => (exam.levels?.[a] || 0) >= target);
}

// ---------- 周报 ----------
export function weekSummary(state, today = dateKey()) {
  const byDay = xpByDay(state);
  const thisW = weekKey(today);
  const lastW = addDays(thisW, -7);
  const sum = (w) => {
    let xp = 0;
    let minutes = 0;
    let days = 0;
    for (let i = 0; i < 7; i++) {
      const d = byDay.get(addDays(w, i));
      if (d) {
        xp += d.xp;
        minutes += d.minutes;
        days += 1;
      }
    }
    return { xp, minutes, days };
  };
  return { thisWeek: sum(thisW), lastWeek: sum(lastW), weekStart: thisW };
}

// ---------- 成就 ----------
export function achievements(state, today = dateKey()) {
  const list = [];
  const s = streak(activeDays(state), today);
  const t = totals(state);
  const add = (key, name, got, detail = '') => list.push({ key, name, got: !!got, detail });

  add('first', '第一步', (state.sessions || []).length > 0, '记录第一次学习');
  for (const n of [7, 30, 100]) add(`streak${n}`, `连续 ${n} 天`, s.longest >= n);
  for (const h of [10, 50, 100, 300]) add(`hours${h}`, `累计 ${h} 小时`, t.minutes / 60 >= h);
  add('mock', '第一次试炼', (state.exams || []).some((e) => e.kind === 'mock'), '完成一次模考');
  for (const lang of ['en', 'fr']) {
    const n = attempts(state, lang);
    const name = lang === 'en' ? '英语' : '法语';
    if (n >= 1) add(`attempt-${lang}`, `${name} Boss · 第 ${n} 次挑战`, true, '每一次挑战都算数');
  }
  for (const [key, done] of Object.entries(state.canDo || {})) if (done) add(`cando-${key}`, key, true, '能做到');
  return list;
}
