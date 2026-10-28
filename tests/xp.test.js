import test from 'node:test';
import assert from 'node:assert/strict';
import { dayXp, streak, weekKey, sublevel, proficiency, totals, weekSummary, frenchSublevel } from '../js/xp.js';

const s = (minutes, extra = {}) => ({ date: '2026-10-27', minutes, mode: 'active', branch: 'fr', skill: 'L', startedAt: 0, ...extra });

test('active minutes give 1 XP each plus first-of-day bonus', () => {
  assert.equal(dayXp([s(30)]).xp, 30 + 5);
});

test('passive minutes give half XP', () => {
  assert.equal(dayXp([s(60, { mode: 'passive' })]).xp, 30 + 5);
});

test('daily diminishing: 0-3h full, 3-6h half, 6h+ nothing', () => {
  assert.equal(dayXp([s(240)]).xp, 180 + 30 + 5);
  assert.equal(dayXp([s(600)]).xp, 180 + 90 + 5);
  // 跨越门槛的两段记录
  assert.equal(dayXp([s(170, { startedAt: 1 }), s(20, { startedAt: 2 })]).xp, 170 + 10 + 5 + 5);
});

test('plan completion, counters and weekly focus bonus', () => {
  assert.equal(dayXp([s(25, { completedPlan: true })]).xp, 25 + 5 + 10);
  assert.equal(dayXp([], [{ key: 'application' }, { key: 'interview' }]).xp, 35);
  assert.equal(dayXp([s(50)], [], { branch: 'fr', skill: 'L' }).xp, 60 + 5);
  assert.equal(dayXp([s(50)], [], { branch: 'fr', skill: 'S' }).xp, 50 + 5);
});

test('weeks start on Monday', () => {
  assert.equal(weekKey('2026-10-27'), '2026-10-26'); // 周二
  assert.equal(weekKey('2026-11-01'), '2026-10-26'); // 周日
});

test('streak uses up to 2 freezes per week', () => {
  // 周一到周五：周二、周三没学，用两张冻结卡
  const r = streak(['2026-10-26', '2026-10-29', '2026-10-30'], '2026-10-30');
  assert.equal(r.current, 3);
  assert.equal(r.freezesLeft, 0);
  // 同一周第三天没学，中断
  const r2 = streak(['2026-10-26', '2026-10-30'], '2026-10-30');
  assert.equal(r2.current, 1);
  assert.equal(r2.longest, 1);
  // 今天还没学不算中断
  assert.equal(streak(['2026-10-26'], '2026-10-27').current, 1);
});

test('sublevel from hours', () => {
  assert.equal(sublevel(0).key, 'A1.1');
  assert.equal(sublevel(100).key, 'A2.1');
  assert.equal(sublevel(450).key, 'B2.1');
  assert.equal(sublevel(900).key, 'B2.2');
});

test('proficiency calibrates to latest exam then adds hours', () => {
  const state = {
    sessions: [{ date: '2026-10-20', minutes: 600, mode: 'active', branch: 'fr', skill: 'S' },
      { date: '2026-10-25', minutes: 1800, mode: 'active', branch: 'fr', skill: 'S' }],
    exams: [{ date: '2026-10-22', lang: 'fr', kind: 'mock', levels: { L: 6, S: 5, R: 6, W: 6 } }],
    profile: {},
  };
  const p = proficiency(state, 'fr', 'S');
  assert.equal(p.calibrated, 5);
  assert.equal(p.hoursSince, 30);
  assert.equal(p.estimate, 5.5);
});

test('French sublevel starts from exam level when all four skills are known', () => {
  const state = {
    sessions: [{ date: '2026-10-25', minutes: 600, mode: 'active', branch: 'fr', skill: 'L' }],
    exams: [{ date: '2026-10-22', lang: 'fr', kind: 'official', levels: { L: 7, S: 6, R: 7, W: 7 } }],
    profile: {},
  };
  const sl = frenchSublevel(state);
  assert.equal(sl.key, 'B1.2'); // 最低一项 NCLC 6 → B1.2，再加 10 小时
  assert.equal(sl.hoursEquivalent, 310);
  assert.equal(frenchSublevel({ sessions: state.sessions, exams: [], profile: {} }).key, 'A1.1');
});

test('totals and week summary', () => {
  const state = { sessions: [s(30), s(30, { date: '2026-10-20' })], events: [] };
  assert.equal(totals(state).xp, 70);
  const w = weekSummary(state, '2026-10-27');
  assert.equal(w.thisWeek.minutes, 30);
  assert.equal(w.lastWeek.minutes, 30);
});
