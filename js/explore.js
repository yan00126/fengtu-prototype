// 世界探索：纯逻辑（不依赖浏览器和 H3），方便测试。

export const EXPLORE = {
  h3Resolution: 9,
  revealRing: 1, // 揭开所在格子和相邻一圈
  maxAccuracyM: 100,
  maxSpeedKmh: 25,
  xpPerLantern: 10,
  lightCost: 1,
  baseBonus: 5,
};

export const CAMP_LEVELS = [
  { from: 0, name: '一顶帐篷' },
  { from: 10, name: '篝火营地' },
  { from: 30, name: '小木屋' },
  { from: 80, name: '有炊烟的木屋' },
  { from: 200, name: '小镇' },
];

export const BASE_TYPES = ['图书馆', '法语角', '学校', '招聘会 / networking', '考场', '其他'];

// 城市地标（坐标为大致的市中心或地标位置）
export const LANDMARKS = [
  { id: 'ottawa', name: '渥太华 · 国会山', lat: 45.4236, lng: -75.7009, fact: '加拿大首都。国会山俯瞰渥太华河，河对岸就是魁北克省的加蒂诺。' },
  { id: 'toronto', name: '多伦多 · CN 塔', lat: 43.6426, lng: -79.3871, fact: '加拿大人口最多的城市，一半以上的居民出生在加拿大以外。' },
  { id: 'montreal', name: '蒙特利尔 · 皇家山', lat: 45.5048, lng: -73.5878, fact: '世界上最大的法语城市之一，城市名字就来自皇家山（Mont Royal）。' },
  { id: 'quebec', name: '魁北克城 · 芳缇娜城堡', lat: 46.8122, lng: -71.2050, fact: '北美少数保留城墙的城市，老城区是世界文化遗产。' },
  { id: 'vancouver', name: '温哥华 · 斯坦利公园', lat: 49.3043, lng: -123.1443, fact: '斯坦利公园比纽约中央公园还大，三面环海。' },
  { id: 'victoria', name: '维多利亚 · 内港', lat: 48.4222, lng: -123.3700, fact: 'BC 省省会，在温哥华岛的南端。' },
  { id: 'calgary', name: '卡尔加里 · 弓河', lat: 51.0486, lng: -114.0708, fact: '离落基山脉只有一个多小时车程，每年夏天有卡尔加里牛仔节。' },
  { id: 'edmonton', name: '埃德蒙顿 · 北萨斯喀彻温河谷', lat: 53.5340, lng: -113.5080, fact: '河谷公园带是北美最大的城市绿地之一。' },
  { id: 'winnipeg', name: '温尼伯 · 福克斯', lat: 49.8875, lng: -97.1310, fact: '红河和阿西尼博因河在这里交汇，已经有六千年的聚会历史。' },
  { id: 'halifax', name: '哈利法克斯 · 21 号码头', lat: 44.6380, lng: -63.5680, fact: '大批移民曾经从这个码头踏上加拿大，现在是移民博物馆。' },
  { id: 'kingston', name: '金斯顿 · 亨利堡', lat: 44.2312, lng: -76.4600, fact: '加拿大的第一个首都。' },
  { id: 'waterloo', name: '滑铁卢 · 大学城', lat: 43.4723, lng: -80.5449, fact: '加拿大的科技重镇之一。' },
  { id: 'saskatoon', name: '萨斯卡通 · 南萨斯喀彻温河', lat: 52.1270, lng: -106.6650, fact: '有“桥城”之称，河上有多座桥。' },
  { id: 'regina', name: '里贾纳 · 瓦斯卡纳湖', lat: 50.4330, lng: -104.6150, fact: '萨斯喀彻温省省会，湖边就是省议会大楼。' },
  { id: 'stjohns', name: '圣约翰斯 · 信号山', lat: 47.5701, lng: -52.6819, fact: '北美最东边的城市，日出最早。' },
  { id: 'fredericton', name: '弗雷德里克顿 · 圣约翰河', lat: 45.9636, lng: -66.6431, fact: '新不伦瑞克省省会。新不伦瑞克是加拿大唯一的官方双语省份。' },
  { id: 'charlottetown', name: '夏洛特敦 · 联邦艺术中心', lat: 46.2340, lng: -63.1260, fact: '1864 年的夏洛特敦会议，是加拿大联邦成立的起点。' },
];

export function haversine(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// fix: { lat, lng, accuracy, time, speed? (m/s) }；prev: 上一个被接受的点
// 返回 { ok, reason }
export function checkFix(fix, prev) {
  if (fix.accuracy != null && fix.accuracy > EXPLORE.maxAccuracyM) return { ok: false, reason: 'accuracy' };
  let kmh = fix.speed != null && fix.speed >= 0 ? fix.speed * 3.6 : null;
  if (prev && fix.time > prev.time) {
    const dt = (fix.time - prev.time) / 1000;
    if (dt >= 3) kmh = Math.max(kmh ?? 0, (haversine(prev, fix) / dt) * 3.6);
  }
  if (kmh != null && kmh > EXPLORE.maxSpeedKmh) return { ok: false, reason: 'speed', kmh };
  return { ok: true, kmh };
}

export function lanterns(map, totalXp) {
  const earned = Math.floor(totalXp / EXPLORE.xpPerLantern) + (map.bonusLanterns || 0);
  const spent = Object.keys(map.lit || {}).length * EXPLORE.lightCost;
  return { earned, spent, balance: earned - spent };
}

export function camp(litCount) {
  let i = 0;
  while (i + 1 < CAMP_LEVELS.length && litCount >= CAMP_LEVELS[i + 1].from) i += 1;
  const next = CAMP_LEVELS[i + 1] || null;
  return { level: i + 1, ...CAMP_LEVELS[i], next, toNext: next ? next.from - litCount : 0 };
}

export function emptyMap() {
  return {
    consent: false,
    visited: {}, // cell -> 第一次到达的日期
    lit: {}, // cell -> 点亮的日期
    bonusLanterns: 0,
    bases: [], // { id, name, type, cell, lat, lng }
    baseVisits: {}, // 'YYYY-MM-DD' -> [baseId]
  };
}
