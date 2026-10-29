import test from 'node:test';
import assert from 'node:assert/strict';
import { haversine, checkFix, lanterns, camp } from '../js/explore.js';

test('haversine is roughly right', () => {
  // 渥太华国会山到蒙特利尔皇家山约 166 公里
  const d = haversine({ lat: 45.4236, lng: -75.7009 }, { lat: 45.5048, lng: -73.5878 });
  assert.ok(d > 160000 && d < 170000, String(d));
});

test('fixes are rejected when inaccurate or too fast', () => {
  const prev = { lat: 45.42, lng: -75.70, time: 0 };
  assert.equal(checkFix({ lat: 45.42, lng: -75.70, accuracy: 150, time: 10000 }, prev).reason, 'accuracy');
  // 10 秒走 50 米 ≈ 18 km/h，可以
  assert.equal(checkFix({ lat: 45.42045, lng: -75.70, accuracy: 10, time: 10000 }, prev).ok, true);
  // 10 秒走 200 米 ≈ 72 km/h，开车
  assert.equal(checkFix({ lat: 45.4218, lng: -75.70, accuracy: 10, time: 10000 }, prev).reason, 'speed');
  // 设备报告的速度
  assert.equal(checkFix({ lat: 45.42, lng: -75.70, accuracy: 10, time: 1000, speed: 15 }, null).reason, 'speed');
});

test('lanterns come from XP and bonuses, lighting spends them', () => {
  const map = { lit: { a: 1, b: 1 }, bonusLanterns: 5 };
  assert.deepEqual(lanterns(map, 125), { earned: 17, spent: 2, balance: 15 });
});

test('camp grows with lit cells', () => {
  assert.equal(camp(0).name, '一顶帐篷');
  assert.equal(camp(9).toNext, 1);
  assert.equal(camp(30).name, '小木屋');
  assert.equal(camp(500).name, '小镇');
});
