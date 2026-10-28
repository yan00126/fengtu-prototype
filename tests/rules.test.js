import test from 'node:test';
import assert from 'node:assert/strict';
import {
  agePoints, ageFromBirth, firstLanguagePoints, scoreToClb, scoresToLevels, computeCrs, lmi, nextThreshold,
} from '../js/rules.js';

const all = (n) => ({ L: n, S: n, R: n, W: n });
const base = (over = {}) => ({
  withSpouse: false, birthYear: 1997, birthMonth: 1, education: 'master', canadianEducation: 'none',
  firstLanguage: 'en', english: { levels: all(9) }, french: null,
  canadianWorkYears: 1, highWageTier: 'none', jobOfferTier: 'none', foreignWorkYears: 0,
  certificateOfQualification: false, pnp: false, sibling: false, spouse: {}, ...over,
});
const today = new Date(2026, 9, 27);

test('age points', () => {
  assert.equal(agePoints(29, false), 110);
  assert.equal(agePoints(30, false), 105);
  assert.equal(agePoints(35, true), 70);
  assert.equal(agePoints(45, false), 0);
  assert.equal(agePoints(17, false), 0);
  assert.equal(ageFromBirth(1997, 11, today), 28);
  assert.equal(ageFromBirth(1997, 10, today), 29);
});

test('first language points per ability', () => {
  assert.equal(firstLanguagePoints(9, false), 31);
  assert.equal(firstLanguagePoints(10, true), 32);
  assert.equal(firstLanguagePoints(3, false), 0);
});

test('test score conversion', () => {
  assert.equal(scoreToClb('IELTS', 'L', 8.0), 9);
  assert.equal(scoreToClb('IELTS', 'L', 7.5), 8);
  assert.equal(scoreToClb('IELTS', 'R', 7.0), 9);
  assert.equal(scoreToClb('CELPIP', 'S', 11), 10);
  assert.equal(scoreToClb('TEF', 'S', 456), 7);
  assert.equal(scoreToClb('TCF', 'W', 9), 6);
  assert.equal(scoreToClb('TCF', 'R', 300), 0);
  assert.deepEqual(scoresToLevels('IELTS', { L: 6, S: 6, R: 6, W: 6 }), all(7));
  assert.equal(nextThreshold('IELTS', 'W', 8), 7.0);
});

test('single, 29, master, CLB 9, 1 year Canadian work', () => {
  const r = computeCrs(base({ birthMonth: 10 }), today);
  assert.equal(r.A.age, 110);
  assert.equal(r.A.education, 135);
  assert.equal(r.A.firstLanguage, 124);
  assert.equal(r.A.lmi, 40);
  assert.equal(r.C.education, 50); // 学历+语言 50，学历+工作 25，封顶 50
  assert.equal(r.total, 409 + 50);
});

test('French NCLC 7 adds second language and French bonus', () => {
  const r = computeCrs(base({ birthMonth: 10, french: { levels: all(7) } }), today);
  assert.equal(r.A.secondLanguage, 12);
  assert.equal(r.D.french, 50);
  const weakEn = computeCrs(base({ birthMonth: 10, english: { levels: all(4) }, french: { levels: all(7) } }), today);
  assert.equal(weakEn.D.french, 25);
});

test('LMI takes the higher of experience and job offer', () => {
  assert.deepEqual(lmi({ canadianWorkYears: 1, highWageTier: 't13', jobOfferTier: 't20' }, false),
    { experience: 60, offer: 100, points: 100, active: 'offer' });
  assert.equal(lmi({ canadianWorkYears: 5, highWageTier: 't20', jobOfferTier: 'none' }, false).points, 150);
  assert.equal(lmi({ canadianWorkYears: 5, highWageTier: 't20' }, true).points, 140);
  // 不满 1 年没有高薪加成
  assert.equal(lmi({ canadianWorkYears: 0, highWageTier: 't20' }, false).points, 0);
});

test('provincial nomination and caps', () => {
  const r = computeCrs(base({ birthMonth: 10, pnp: true, sibling: true, canadianEducation: 'long' }), today);
  assert.equal(r.subtotals.D, 600);
});

test('with spouse uses spouse tables and spouse factors', () => {
  const r = computeCrs(base({
    birthMonth: 10, withSpouse: true,
    spouse: { education: 'bachelor', languageLevels: all(9), canadianWorkYears: 1 },
  }), today);
  assert.equal(r.A.age, 100);
  assert.equal(r.A.education, 126);
  assert.equal(r.subtotals.B, 8 + 20 + 5);
});
