import {
  computeCrs, maxima, EDUCATION_LEVELS, WAGE_TIERS, TESTS, ABILITIES, ABILITY_NAMES, scoresToLevels,
  nextThreshold, RULES_VERSION,
} from './rules.js';
import {
  dateKey, dayXp, totals, streak, activeDays, proficiency, frenchSublevel, effectiveHours, attempts, partialWins,
  weekSummary, achievements, weekKey, focusFor,
} from './xp.js';
import { BRANCHES, SKILL_NAMES, CAN_DO, CAREER_COUNTERS, XP } from './content.js';
import { load, save, uid, emptyProfile, exportJson, importJson, emptyState } from './store.js';
import { drawCard, canvasToBlob } from './card.js';
import { EXPLORE, LANDMARKS, BASE_TYPES, checkFix, lanterns, camp } from './explore.js';
import * as mapview from './mapview.js';

let state = load();
let ui = { pendingDelete: null, simA: {}, simB: {}, cardRange: 'day', cardOpts: { nickname: true, streak: true, sublevel: true, attempts: true, explore: true } };
const $app = document.getElementById('app');
const $modal = document.getElementById('modal-root');

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const today = () => dateKey();
const route = () => (location.hash.replace('#', '') || 'today');
const fmtMin = (m) => (m >= 60 ? `${Math.floor(m / 60)} 小时 ${Math.round(m % 60)} 分` : `${Math.round(m)} 分钟`);
const langName = (l) => (l === 'en' ? '英语' : '法语');
const levelName = (l) => (l === 'en' ? 'CLB' : 'NCLC');

function commit(mut) {
  mut?.(state);
  save(state);
  render();
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast.h);
  toast.h = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------------- 页面 ----------------

function render() {
  if (!state.acceptedNotice) return showNotice();
  if (!state.onboarded) return showOnboarding();
  const r = route();
  const pages = { today: pageToday, map: pageMap, skills: pageSkills, sim: pageSim, me: pageMe };
  $app.innerHTML = (pages[r] || pageToday)() + nav(r);
  if (r === 'map') afterMapRender();
}

function nav(r) {
  const tab = (k, ico, name) => `<a href="#${k}" class="${r === k ? 'on' : ''}"><span class="ico">${ico}</span>${name}</a>`;
  return `<nav class="tabs"><div class="inner">${tab('today', '◎', '今日')}${tab('map', '⌖', '探索')}${tab('skills', '✦', '技能')}${tab('sim', '⇄', '模拟')}${tab('me', '◐', '我的')}</div></nav>`;
}

// ---------------- 探索 ----------------
const explore = { watchId: null, last: null, status: '', wakeLock: null, newCells: 0 };
const isDebug = new URLSearchParams(location.search).has('debug');

function pageMap() {
  const m = state.map;
  if (!m.consent) {
    return `<h1>探索</h1>
    <div class="card">
      <h2>走出去，揭开真实的加拿大</h2>
      <p class="small">地图上盖着迷雾。你真的走到哪里，哪里的迷雾就会散开；学习和求职攒下的<b>灯火</b>，可以把到过的地方点亮，解锁地标、让营地成长。</p>
      <h3>开始之前</h3>
      <ul class="small">
        <li>只有在你点“开始探索”、并且屏幕亮着的时候，才会读取位置。</li>
        <li><b>位置和走过的格子只存在你的手机上</b>，不会上传。分享卡片不会显示地图和位置。</li>
        <li>移动速度超过每小时 ${EXPLORE.maxSpeedKmh} 公里时不记录，请不要在开车时使用。</li>
        <li>走路时注意路况和天气。不出门也不会被惩罚，灯火会一直攒着。</li>
      </ul>
      <button class="btn primary block" data-action="map-consent">我明白了，进入地图</button>
    </div>`;
  }
  const lan = lanterns(m, totals(state).xp);
  const litN = Object.keys(m.lit).length;
  const c = camp(litN);
  const libs = mapview.libsReady();
  const unlocked = libs ? LANDMARKS.filter((l) => m.lit[mapview.cellAt(l.lat, l.lng)]) : [];
  return `<h1>探索</h1>
  <div class="grid4" style="margin-bottom:10px">
    <div class="stat"><div class="v">${lan.balance}</div><div class="k">灯火</div></div>
    <div class="stat"><div class="v">${Object.keys(m.visited).length}</div><div class="k">到过</div></div>
    <div class="stat"><div class="v">${litN}</div><div class="k">点亮</div></div>
    <div class="stat"><div class="v">${c.level}</div><div class="k">营地</div></div>
  </div>
  ${libs ? '<div class="map-slot" id="map-slot"></div>' : '<div class="card"><p class="err">地图组件没有加载成功，请检查网络后刷新。</p></div>'}
  <div class="explore-status" id="explore-status">${esc(explore.status || '点击灰色格子可以点亮它（花 1 盏灯火）。')}</div>
  <div class="grid2" style="margin-bottom:12px">
    ${explore.watchId != null
      ? '<button class="btn primary" data-action="explore-stop">停止探索</button>'
      : '<button class="btn primary" data-action="explore-start">开始探索</button>'}
    <button class="btn" data-action="light-nearby">点亮附近（最多 5 格）</button>
  </div>
  ${isDebug ? '<button class="btn small block" data-action="debug-walk" style="margin-bottom:12px">调试：模拟在渥太华走一段</button>' : ''}
  <div class="card">
    <div class="row between"><h2>营地：${esc(c.name)}</h2><span class="pill">Lv ${c.level}</span></div>
    <p class="small muted">${c.next ? `再点亮 ${c.toNext} 格，营地会变成“${esc(c.next.name)}”。` : '营地已经发展成小镇了。'}</p>
    <p class="tiny">灯火来自学习和求职：每 ${EXPLORE.xpPerLantern} XP 换 1 盏。累计获得 ${lan.earned} 盏，用掉 ${lan.spent} 盏。</p>
  </div>
  <div class="card">
    <h2>地标 ${unlocked.length} / ${LANDMARKS.length}</h2>
    ${unlocked.length ? `<ul class="list">${unlocked.map((l) => `<li><span>${esc(l.name)}</span><button class="btn small" data-action="show-landmark" data-id="${l.id}">查看</button></li>`).join('')}</ul>`
      : '<p class="small muted">走到加拿大各个城市的地标附近、点亮那一格，就能解锁地标卡片。</p>'}
  </div>
  <div class="card">
    <div class="row between"><h2>据点</h2><button class="btn small" data-action="open-base">把当前位置设为据点</button></div>
    <p class="small muted">图书馆、法语角、学校、招聘会……探索时到达自己的据点，每个据点每天 +${EXPLORE.baseBonus} 盏灯火。</p>
    ${m.bases.length ? `<ul class="list">${m.bases.map((b) => `<li><span>${esc(b.name)} <span class="tiny">${esc(b.type)}</span></span>
      ${ui.pendingDelete === b.id ? `<button class="btn small" data-action="delete-base" data-id="${b.id}">确认删除</button>` : `<button class="btn small ghost" data-action="ask-delete" data-id="${b.id}" aria-label="删除">×</button>`}</li>`).join('')}</ul>` : ''}
  </div>`;
}

function afterMapRender() {
  if (!state.map.consent || !mapview.libsReady()) return;
  const slot = document.getElementById('map-slot');
  if (!slot) return;
  const cells = Object.keys(state.map.visited);
  mapview.mount(slot, {
    initial: explore.last || (cells.length ? mapview.cellCenter(cells[cells.length - 1]) : null),
    onCellClick: lightCell,
  });
  mapview.update(state.map, explore.last);
}

function setStatus(msg) {
  explore.status = msg;
  const el = document.getElementById('explore-status');
  if (el) el.textContent = msg;
}

function onFix(fix) {
  const check = checkFix(fix, explore.last);
  if (!check.ok) {
    setStatus(check.reason === 'speed'
      ? `移动太快（约 ${Math.round(check.kmh)} 公里/小时），暂停记录。请不要在开车时使用。`
      : '定位不够精确，正在等待更好的信号……');
    return;
  }
  const first = !explore.last;
  explore.last = fix;
  const k = today();
  const cells = mapview.ringCells(fix.lat, fix.lng);
  const fresh = cells.filter((c) => !state.map.visited[c]);
  const reached = state.map.bases.filter((b) => cells.includes(b.cell) && !(state.map.baseVisits[k] || []).includes(b.id));
  if (fresh.length || reached.length) {
    commit((s) => {
      for (const c of fresh) s.map.visited[c] = k;
      for (const b of reached) {
        s.map.bonusLanterns += EXPLORE.baseBonus;
        s.map.baseVisits[k] = [...(s.map.baseVisits[k] || []), b.id];
      }
    });
    for (const b of reached) toast(`到达据点“${b.name}”，+${EXPLORE.baseBonus} 盏灯火`);
  } else {
    mapview.update(state.map, fix);
  }
  explore.newCells += fresh.length;
  setStatus(`探索中 · 这次新揭开 ${explore.newCells} 格`);
  if (first) mapview.flyTo(fix.lat, fix.lng);
  else mapview.follow(fix.lat, fix.lng);
}

async function startExplore() {
  if (!navigator.geolocation) { toast('这个浏览器不支持定位'); return; }
  explore.newCells = 0;
  explore.watchId = navigator.geolocation.watchPosition(
    (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy, speed: p.coords.speed, time: p.timestamp }),
    (err) => {
      setStatus(err.code === 1 ? '没有定位权限。请在浏览器设置里允许这个网站读取位置。' : '暂时拿不到位置，请到开阔的地方试试。');
      if (err.code === 1) stopExplore();
    },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
  );
  try { explore.wakeLock = await navigator.wakeLock?.request('screen'); } catch { /* 不支持就算了 */ }
  setStatus('正在定位……请保持屏幕亮着。');
  render();
}

function stopExplore() {
  if (explore.watchId != null && navigator.geolocation) navigator.geolocation.clearWatch(explore.watchId);
  explore.watchId = null;
  explore.wakeLock?.release?.();
  explore.wakeLock = null;
  setStatus(explore.newCells ? `探索结束 · 这次新揭开 ${explore.newCells} 格` : '探索结束');
  render();
}

function lightCell(cell) {
  const m = state.map;
  if (!m.visited[cell]) { setStatus('这里还盖着迷雾，要先走到附近才能点亮。'); return; }
  if (m.lit[cell]) { const l = mapview.landmarkInCell(cell); if (l) showLandmark(l); return; }
  if (lanterns(m, totals(state).xp).balance < EXPLORE.lightCost) { setStatus('灯火不够了。学习、求职都能获得灯火。'); return; }
  const before = camp(Object.keys(m.lit).length);
  commit((s) => { s.map.lit[cell] = today(); });
  const after = camp(Object.keys(state.map.lit).length);
  const l = mapview.landmarkInCell(cell);
  if (l) showLandmark(l, true);
  else if (after.level > before.level) toast(`营地升级：${after.name}`);
  else setStatus('点亮了一格。');
}

function lightNearby() {
  const m = state.map;
  const center = explore.last || mapview.center();
  const bal = lanterns(m, totals(state).xp).balance;
  const dark = Object.keys(m.visited).filter((c) => !m.lit[c]);
  if (!dark.length) { setStatus('附近没有可以点亮的格子。先出门走一走吧。'); return; }
  if (bal < EXPLORE.lightCost) { setStatus('灯火不够了。学习、求职都能获得灯火。'); return; }
  const dist = (c) => { const p = mapview.cellCenter(c); return (p.lat - center.lat) ** 2 + (p.lng - center.lng) ** 2; };
  const pick = dark.sort((a, b) => dist(a) - dist(b)).slice(0, Math.min(5, Math.floor(bal / EXPLORE.lightCost)));
  const before = camp(Object.keys(m.lit).length);
  commit((s) => { for (const c of pick) s.map.lit[c] = today(); });
  const after = camp(Object.keys(state.map.lit).length);
  const l = pick.map((c) => mapview.landmarkInCell(c)).find(Boolean);
  if (l) showLandmark(l, true);
  else toast(after.level > before.level ? `营地升级：${after.name}` : `点亮了 ${pick.length} 格`);
}

function showLandmark(l, fresh = false) {
  openModal(`<div class="celebrate"><div class="tiny">${fresh ? '解锁新地标' : '地标'}</div><div class="big">${esc(l.name)}</div></div>
    <p>${esc(l.fact)}</p>
    <button class="btn primary block" data-action="close-modal">好</button>`);
}

function openBase() {
  if (!explore.last) { toast('先点“开始探索”，拿到当前位置后再设据点'); return; }
  openModal(`<form data-form="base"><h1>设为据点</h1>
    <p class="small muted">用你现在的位置。据点只存在你的手机上。</p>
    <label class="field"><span>名字</span><input type="text" name="name" maxlength="20" placeholder="比如：市图书馆" required></label>
    <label class="field"><span>类型</span><select name="type">${BASE_TYPES.map((t) => `<option>${t}</option>`).join('')}</select></label>
    <button class="btn primary block">保存</button>
    <button type="button" class="btn ghost block" data-action="close-modal" style="margin-top:8px">取消</button></form>`);
}

// 调试：沿着渥太华市中心走一段（国会山 → 拜沃德市场 → 渥太华大学）
function debugWalk() {
  const path = [[45.4236, -75.7009], [45.4250, -75.6960], [45.4290, -75.6920], [45.4268, -75.6880], [45.4231, -75.6831]];
  const pts = [];
  for (let i = 0; i < path.length - 1; i++) {
    for (let t = 0; t < 1; t += 0.08) pts.push([path[i][0] + (path[i + 1][0] - path[i][0]) * t, path[i][1] + (path[i + 1][1] - path[i][1]) * t]);
  }
  let i = 0;
  let time = Date.now();
  explore.newCells = 0;
  const step = () => {
    if (i >= pts.length) { setStatus(`模拟结束 · 新揭开 ${explore.newCells} 格`); return; }
    time += 40000; // 每步约 40 秒，相当于步行速度
    onFix({ lat: pts[i][0], lng: pts[i][1], accuracy: 10, time });
    i += 1;
    setTimeout(step, 250);
  };
  step();
}

function header() {
  const t = totals(state);
  return `<div class="row between"><h1>${esc(state.nickname || '冒险者')}</h1><span class="pill accent">Lv ${t.level}</span></div>
  <div class="bar" style="margin-bottom:4px"><div class="fill" style="width:${(t.levelProgress * 100).toFixed(1)}%"></div></div>
  <div class="tiny" style="margin-bottom:14px">总 XP ${t.xp} · 距离 Lv ${t.level + 1} 还差 ${XP.perLevel - (t.xp % XP.perLevel)} XP</div>`;
}

function pageToday() {
  const k = today();
  const sessions = state.sessions.filter((s) => s.date === k);
  const events = state.events.filter((e) => e.date === k);
  const d = dayXp(sessions, events, focusFor(state, k));
  const st = streak(activeDays(state), k);
  const focus = focusFor(state, k);

  const sessionList = sessions.length
    ? `<ul class="list">${sessions.sort((a, b) => b.startedAt - a.startedAt).map((s) => `
      <li><span>${esc(BRANCHES[s.branch]?.name)}${s.skill ? ' · ' + esc(SKILL_NAMES[s.skill]) : ''}
        <span class="tiny">${s.mode === 'passive' ? '被动' : '主动'}${s.source === 'manual' ? ' · 补录' : ''}${s.completedPlan ? ' · 完成计划' : ''}</span></span>
        <span class="row">${s.minutes} 分
        ${ui.pendingDelete === s.id
          ? `<button class="btn small" data-action="delete-session" data-id="${s.id}">确认删除</button>`
          : `<button class="btn small ghost" data-action="ask-delete" data-id="${s.id}" aria-label="删除">×</button>`}</span></li>`).join('')}</ul>`
    : '<p class="muted small">今天还没有记录。从 5 分钟开始也可以。</p>';

  return `${header()}
  <div class="grid2" style="margin-bottom:12px">
    <div class="stat"><div class="v">${d.xp}</div><div class="k">今日 XP</div></div>
    <div class="stat"><div class="v">${fmtMin(d.minutes)}</div><div class="k">今日学习</div></div>
    <div class="stat"><div class="v">${st.current} 天</div><div class="k">连续 · 最长 ${st.longest} 天</div></div>
    <div class="stat"><div class="v">${st.freezesLeft} 张</div><div class="k">本周冻结卡（断一天不清零）</div></div>
  </div>
  ${timerCard()}
  <div class="card">
    <div class="row between"><h2>今天的记录</h2><button class="btn small" data-action="open-manual">补录</button></div>
    ${sessionList}
  </div>
  <div class="card">
    <h2>求职行动</h2>
    <div class="row wrap">${CAREER_COUNTERS.map((c) => `<button class="btn small" data-action="counter" data-key="${c.key}">+ ${c.name}</button>`).join('')}</div>
    <p class="tiny" style="margin-top:8px">今天：${CAREER_COUNTERS.map((c) => `${c.name} ${events.filter((e) => e.key === c.key).length}`).join(' · ')}</p>
  </div>
  <div class="card">
    <h2>本周重点</h2>
    <p class="small muted">自己选一项作为本周重点，练这一项 XP +20%。</p>
    <select data-change="focus">
      <option value="">不设重点</option>
      ${['en', 'fr'].map((b) => BRANCHES[b].skills.map((sk) => `<option value="${b}:${sk}" ${focus && focus.branch === b && focus.skill === sk ? 'selected' : ''}>${BRANCHES[b].name} · ${SKILL_NAMES[sk]}</option>`).join('')).join('')}
    </select>
  </div>
  <button class="btn primary block" data-action="open-card">生成分享卡片</button>`;
}

function branchSkillSelect(prefix = '') {
  return `<div class="grid2">
    <label class="field"><span>分支</span><select name="branch" data-change="${prefix}branch">
      ${Object.entries(BRANCHES).map(([k, b]) => `<option value="${k}">${b.name}</option>`).join('')}</select></label>
    <label class="field"><span>子技能</span><select name="skill">
      ${BRANCHES.en.skills.map((s) => `<option value="${s}">${SKILL_NAMES[s]}</option>`).join('')}
      <option value="">（不分）</option></select></label>
  </div>
  <div class="field"><span class="tiny">类型</span>
    <div class="seg" data-seg="mode"><button type="button" class="on" data-val="active">主动学习</button><button type="button" data-val="passive">被动沉浸</button></div>
    <span class="tiny">被动沉浸 = 看剧、背景音，XP 减半</span>
    <input type="hidden" name="mode" value="active"></div>`;
}

function timerCard() {
  const t = state.timer;
  if (t) {
    return `<div class="card">
      <div class="row between"><h2>正在学习</h2><span class="pill">${esc(BRANCHES[t.branch]?.name)}${t.skill ? ' · ' + esc(SKILL_NAMES[t.skill]) : ''}</span></div>
      <div class="timer" id="timer-display">${fmtElapsed(t.startedAt)}</div>
      ${t.planned ? `<p class="tiny" style="text-align:center">计划 ${t.planned} 分钟，完成可得 +${XP.planComplete} XP</p>` : ''}
      <div class="grid2"><button class="btn" data-action="timer-cancel">放弃这次</button><button class="btn primary" data-action="timer-stop">结束并记录</button></div>
    </div>`;
  }
  return `<form class="card" data-form="timer-start">
    <h2>开始学习</h2>
    ${branchSkillSelect()}
    <label class="field"><span>计划时长（完成 +${XP.planComplete} XP）</span><select name="planned">
      <option value="">不设</option><option value="15">15 分钟</option><option value="25" selected>25 分钟</option><option value="45">45 分钟</option><option value="60">60 分钟</option></select></label>
    <button class="btn primary block">开始计时</button>
  </form>`;
}

function pageSkills() {
  const crs = computeCrs(state.profile);
  const mx = maxima(crs.withSpouse);
  const attr = (name, v, max, note = '') => `<div class="attr"><span>${name}${note ? ` <span class="tiny">${note}</span>` : ''}</span><b>${v} / ${max}</b>
    <div class="bar"><div class="fill" style="width:${Math.min(100, (v / max) * 100)}%"></div></div></div>`;
  const lm = crs.lmi;
  return `<h1>技能树</h1>
  <div class="card">
    <div class="row between"><div><div class="tiny">按 IRCC 公开规则计算（规则版本 ${RULES_VERSION}）</div><div class="crs-total">${crs.total}</div><div class="tiny">当前 CRS</div></div>
    <button class="btn small" data-action="open-profile">修改档案</button></div>
    <h3>属性面板</h3>
    ${attr('年龄', crs.A.age, mx.age, crs.age != null ? `${crs.age} 岁` : '')}
    ${attr('学历', crs.A.education, mx.education)}
    ${attr('第一官方语言', crs.A.firstLanguage, mx.firstLanguage, state.profile.firstLanguage === 'fr' ? '法语' : '英语')}
    ${attr('第二官方语言', crs.A.secondLanguage, mx.secondLanguage)}
    ${attr('劳动力市场融入', crs.A.lmi, mx.lmi, lm.active === 'offer' ? '按 offer 计' : '按工作经验计')}
    ${crs.withSpouse ? attr('配偶', crs.subtotals.B, mx.spouse) : ''}
    ${attr('连携技（技能可转移性）', crs.subtotals.C, mx.transferability)}
    ${attr('附加分', crs.subtotals.D, mx.additional)}
    <p class="tiny" style="margin-top:8px">分数可能有误，请以 IRCC 官方计算为准。本工具不提供移民建议。</p>
  </div>
  ${languagePanel('en')}
  ${languagePanel('fr')}
  ${careerPanel(crs)}`;
}

function languagePanel(lang) {
  const target = state.targets[lang];
  const scale = 12;
  const skills = ABILITIES.map((a) => {
    const p = proficiency(state, lang, a);
    const cal = p.calibrated;
    const est = p.estimate;
    const srcName = { official: '正式考试', mock: '模考', test: '成绩', self: '自估', hours: '按学习时长估算' }[p.source] || '';
    const label = cal != null
      ? `${levelName(lang)} ${cal}（${srcName}）${p.hoursSince >= 0.5 ? ` · 之后又学了 ${p.hoursSince.toFixed(1)} 小时` : ''}`
      : `约 ${levelName(lang)} ${est.toFixed(1)}（${srcName}）`;
    return `<div class="skill"><div class="top"><span>${ABILITY_NAMES[a]}</span><span class="small muted">${label}</span></div>
      <div class="bar">
        <div class="est" style="width:${(Math.min(est, scale) / scale) * 100}%"></div>
        ${cal != null ? `<div class="fill" style="width:${(Math.min(cal, scale) / scale) * 100}%"></div>` : ''}
        <div class="target" style="left:${(target / scale) * 100}%"></div>
      </div></div>`;
  }).join('');

  const totalHours = effectiveHours(state.sessions, lang, null);
  let extra = '';
  if (lang === 'fr') {
    const sl = frenchSublevel(state);
    const band = sl.key.slice(0, 2);
    const bands = ['A1', 'A2', 'B1', 'B2'];
    const showBands = bands.slice(0, bands.indexOf(band) + 2).slice(-2);
    extra = `<h3>小等级 ${sl.key}</h3>
      <div class="bar"><div class="fill" style="width:${sl.progress * 100}%"></div></div>
      <p class="tiny">${sl.calibrated ? '按成绩起算 · ' : ''}累计有效学习 ${totalHours.toFixed(1)} 小时${sl.next ? ` · 距离 ${sl.next.key} 还差约 ${(sl.next.from - sl.hoursEquivalent).toFixed(1)} 小时（估算）` : ''}</p>
      <h3>能做到</h3>
      ${showBands.map((b) => `<div class="tiny" style="margin-top:6px">${b}</div>` + CAN_DO[b].map((c) => {
        const key = `${b} · ${c}`;
        return `<label class="check"><input type="checkbox" data-change="cando" data-key="${esc(key)}" ${state.canDo[key] ? 'checked' : ''}><span class="small">${esc(c)}</span></label>`;
      }).join('')).join('')}`;
  }

  return `<div class="card">
    <div class="row between"><h2>${langName(lang)}</h2><span class="tiny">目标 ${levelName(lang)} ${target} · 实色 = 成绩，虚线 = 估算</span></div>
    ${skills}
    ${extra}
    ${bossBlock(lang)}
  </div>`;
}

function bossBlock(lang) {
  const n = attempts(state, lang);
  const exams = state.exams.filter((e) => e.lang === lang).sort((a, b) => (a.date < b.date ? 1 : -1));
  const lastOfficial = exams.find((e) => e.kind === 'official');
  const target = state.targets[lang];
  const next = state.nextExam[lang];
  const daysTo = next ? Math.ceil((new Date(next) - new Date(today())) / 86400000) : null;
  const wins = lastOfficial ? partialWins(lastOfficial, target) : [];
  return `<h3>Boss 战：${langName(lang)}考试</h3>
    <div class="row wrap" style="margin-bottom:8px">
      <span class="pill gold">已挑战 ${n} 次</span>
      ${lastOfficial ? `<span class="pill ${wins.length === 4 ? 'ok' : ''}">上次：${wins.length}/4 项达到目标</span>` : ''}
      ${daysTo != null && daysTo >= 0 ? `<span class="pill accent">${daysTo === 0 ? '今天考试' : `距离下次考试 ${daysTo} 天`}</span>` : ''}
    </div>
    ${lastOfficial ? `<p class="small">${ABILITIES.map((a) => `${ABILITY_NAMES[a]} ${levelName(lang)} ${lastOfficial.levels[a]}${lastOfficial.levels[a] >= target ? ' ✓' : ''}`).join(' · ')}</p>` : ''}
    <div class="row wrap">
      <button class="btn small" data-action="open-exam" data-lang="${lang}" data-kind="mock">录入模考</button>
      <button class="btn small" data-action="open-exam" data-lang="${lang}" data-kind="official">录入正式考试</button>
      <label class="small row">下次考试 <input type="date" data-change="next-exam" data-lang="${lang}" value="${next || ''}" style="width:auto"></label>
    </div>
    ${exams.length ? `<ul class="list" style="margin-top:8px">${exams.slice(0, 6).map((e) => `<li><span>${e.date} · ${e.kind === 'official' ? '正式' : '模考'} · ${esc(e.test)}</span><span class="tiny">${ABILITIES.map((a) => `${ABILITY_NAMES[a]}${e.levels[a] ?? '-'}`).join(' ')}</span></li>`).join('')}</ul>` : ''}`;
}

function careerPanel(crs) {
  const lm = crs.lmi;
  const count = (k) => state.events.filter((e) => e.key === k).length;
  const apps = count('application');
  const inter = count('interview');
  return `<div class="card">
    <h2>职业</h2>
    <p class="small">劳动力市场融入取两条路线中较高的一个：</p>
    <ul class="list">
      <li><span>加拿大工作经验 ${state.profile.canadianWorkYears || 0} 年${lm.active === 'experience' ? ' <span class="pill ok">生效中</span>' : ''}</span><b>${lm.experience}</b></li>
      <li><span>Job offer${lm.active === 'offer' ? ' <span class="pill ok">生效中</span>' : ''}</span><b>${lm.offer}</b></li>
    </ul>
    <h3>求职副本（累计）</h3>
    <p class="small">${CAREER_COUNTERS.map((c) => `${c.name} ${count(c.key)}`).join(' · ')}${apps ? ` · 投递到面试 ${((inter / apps) * 100).toFixed(0)}%` : ''}</p>
    <p class="tiny">转化率只和你自己比。涉及换工作、雇主担保对申请的影响，请查看 IRCC 官网或咨询持牌顾问。</p>
  </div>`;
}

// ---------------- 模拟 ----------------
const SIM_FIELDS = [
  { key: 'en', name: '英语四项', opts: [['', '不变'], ...[7, 8, 9, 10].map((n) => [n, `全部 CLB ${n}`])] },
  { key: 'fr', name: '法语四项', opts: [['', '不变'], ...[5, 7, 9].map((n) => [n, `全部 NCLC ${n}`])] },
  { key: 'work', name: '加拿大工作经验', opts: [['', '不变'], ...[1, 2, 3, 4, 5].map((n) => [n, `${n} 年`])] },
  { key: 'edu', name: '学历', opts: [['', '不变'], ...EDUCATION_LEVELS.map((e) => [e.key, e.name])] },
  { key: 'offer', name: 'Job offer', opts: [['', '不变'], ...WAGE_TIERS.map((w) => [w.key, w.name])] },
  { key: 'pnp', name: '省提名', opts: [['', '不变'], ['yes', '有']] },
];

function applySim(profile, sim) {
  const p = JSON.parse(JSON.stringify(profile));
  const all = (n) => ({ L: n, S: n, R: n, W: n });
  if (sim.en) p.english = { ...(p.english || {}), levels: all(Number(sim.en)) };
  if (sim.fr) p.french = { ...(p.french || {}), levels: all(Number(sim.fr)) };
  if (sim.work) p.canadianWorkYears = Number(sim.work);
  if (sim.edu) p.education = sim.edu;
  if (sim.offer) p.jobOfferTier = sim.offer;
  if (sim.pnp) p.pnp = true;
  return p;
}

function pageSim() {
  const base = computeCrs(state.profile);
  const col = (id, sim) => {
    const r = computeCrs(applySim(state.profile, sim));
    const diff = r.total - base.total;
    const changes = [
      ['第一语言', r.A.firstLanguage - base.A.firstLanguage], ['第二语言', r.A.secondLanguage - base.A.secondLanguage],
      ['学历', r.A.education - base.A.education], ['劳动力市场融入', r.A.lmi - base.A.lmi],
      ['连携技', r.subtotals.C - base.subtotals.C], ['附加分', r.subtotals.D - base.subtotals.D],
    ].filter(([, d]) => d !== 0);
    return `<div class="card"><h2>路线 ${id}</h2>
      ${SIM_FIELDS.map((f) => `<label class="field"><span>${f.name}</span><select data-change="sim" data-route="${id}" data-key="${f.key}">
        ${f.opts.map(([v, n]) => `<option value="${v}" ${String(sim[f.key] ?? '') === String(v) ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></label>`).join('')}
      <div class="crs-total" style="font-size:32px">${r.total}</div>
      <div class="small ${diff > 0 ? 'delta up' : 'muted'}">${diff >= 0 ? '+' : ''}${diff}</div>
      <ul class="list">${changes.map(([n, d]) => `<li><span class="small">${n}</span><span class="small">${d > 0 ? '+' : ''}${d}</span></li>`).join('') || '<li class="tiny">还没有变化</li>'}</ul>
      ${r.D.french > 0 ? '<p class="tiny">满足法语类别抽签的语言条件</p>' : ''}
    </div>`;
  };
  const myRecord = (lang) => {
    const h = effectiveHours(state.sessions, lang, null);
    const mocks = state.exams.filter((e) => e.lang === lang).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-3);
    return `<li><span>${langName(lang)}：累计有效学习 ${h.toFixed(1)} 小时</span><span class="tiny">${mocks.map((e) => `${e.date.slice(5)} 最低 ${Math.min(...ABILITIES.map((a) => e.levels[a] ?? 0))}`).join(' → ') || '还没有成绩'}</span></li>`;
  };
  return `<h1>路线模拟</h1>
  <p class="small muted">选几个“如果”，看分数会怎么变。这里只按规则算分，不排序、不推荐，由你自己判断。当前 CRS：${base.total}</p>
  <div class="cols">${col('A', ui.simA)}${col('B', ui.simB)}</div>
  <div class="card" style="margin-top:12px"><h2>你自己的记录</h2><ul class="list">${myRecord('en')}${myRecord('fr')}</ul>
  <p class="tiny">涉及申请决策（比如是否接受省提名），请查看 IRCC 官网或咨询持牌移民顾问（RCIC）。</p></div>`;
}

// ---------------- 我的 ----------------
function pageMe() {
  const w = weekSummary(state, today());
  const visitedN = Object.keys(state.map.visited).length;
  const litN = Object.keys(state.map.lit).length;
  const landmarksN = mapview.libsReady() ? LANDMARKS.filter((l) => state.map.lit[mapview.cellAt(l.lat, l.lng)]).length : 0;
  const ach = [
    ...achievements(state, today()),
    { name: '走出门', got: visitedN > 0, detail: '第一次揭开迷雾' },
    { name: '点亮 10 格', got: litN >= 10, detail: '营地升起篝火' },
    { name: '点亮 100 格', got: litN >= 100, detail: '地图上的一片光' },
    { name: '第一个地标', got: landmarksN > 0, detail: '解锁一张地标卡片' },
    { name: '有了据点', got: state.map.bases.length > 0, detail: '设置第一个据点' },
  ];
  const delta = w.thisWeek.minutes - w.lastWeek.minutes;
  return `<h1>我的</h1>
  <div class="card"><h2>本周</h2>
    <div class="grid2">
      <div class="stat"><div class="v">${fmtMin(w.thisWeek.minutes)}</div><div class="k">学习时长 · 上周 ${fmtMin(w.lastWeek.minutes)}</div></div>
      <div class="stat"><div class="v">${w.thisWeek.xp}</div><div class="k">XP · 上周 ${w.lastWeek.xp}</div></div>
    </div>
    <p class="small" style="margin-top:8px">${w.thisWeek.days} 天有记录。${delta > 0 ? `比上周多学了 ${fmtMin(delta)}。` : ''}</p>
  </div>
  <div class="card"><h2>成就</h2><div class="ach">${ach.map((a) => `<div class="${a.got ? 'got' : ''}"><b>${esc(a.name)}</b><div class="tiny">${esc(a.detail)}</div></div>`).join('')}</div></div>
  <div class="card"><h2>目标</h2>
    <div class="grid2">
      <label class="field"><span>英语目标 CLB</span><select data-change="target" data-lang="en">${[7, 8, 9, 10].map((n) => `<option ${state.targets.en === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field"><span>法语目标 NCLC</span><select data-change="target" data-lang="fr">${[5, 7, 9].map((n) => `<option ${state.targets.fr === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
  </div>
  <div class="card"><h2>数据</h2>
    <p class="small muted">你的数据只存在这台设备的浏览器里。清除浏览器数据会让记录消失，请定期导出备份。</p>
    <div class="row wrap">
      <button class="btn small" data-action="export" data-profile="1">导出全部</button>
      <button class="btn small" data-action="export" data-profile="0">导出（去掉个人档案）</button>
      <label class="btn small">导入<input type="file" accept="application/json" data-change="import" hidden></label>
    </div>
    <p class="tiny" style="margin-top:8px">参加测试的朋友：结束时如果愿意，可以把“去掉个人档案”的导出文件发给组织者。</p>
    <div class="row wrap" style="margin-top:8px">
      <button class="btn small ghost" data-action="show-notice">说明</button>
      ${ui.pendingDelete === 'reset' ? '<button class="btn small" data-action="reset">确认清空所有数据</button>' : '<button class="btn small ghost" data-action="ask-reset">清空数据</button>'}
    </div>
    <p class="tiny">规则版本 ${RULES_VERSION} · 原型 v0.1</p>
  </div>`;
}

// ---------------- 弹窗 ----------------
function openModal(html, onMount) {
  $modal.innerHTML = `<div class="modal-bg" data-action="close-modal-bg"><div class="modal" role="dialog" aria-modal="true">${html}</div></div>`;
  onMount?.($modal.querySelector('.modal'));
}
function closeModal() { $modal.innerHTML = ''; }

function showNotice() {
  $app.innerHTML = '';
  openModal(`<h1>欢迎来到枫途（测试原型）</h1>
    <p>这是一个把 PR 之路变成成长记录的小工具：每天学习、求职都能拿到经验值，考试就像挑战 Boss。</p>
    <ul class="small">
      <li>这是<b>测试原型</b>，不是正式产品，可能有错误。</li>
      <li><b>不提供移民建议。</b>分数按 IRCC 公开规则计算，可能有误，一切以 IRCC 官方为准。需要建议请咨询持牌移民顾问（RCIC）或律师。</li>
      <li><b>数据只存在你的设备上</b>，不会发送给任何人。请定期在“我的”页面导出备份。</li>
    </ul>
    <button class="btn primary block" data-action="accept-notice">我明白了</button>`);
}

function languageFieldset(lang, p) {
  const tests = TESTS[lang];
  const mode = p ? (p.source === 'self' ? 'self' : 'test') : 'none';
  return `<fieldset data-lang-block="${lang}"><legend>${langName(lang)}</legend>
    <div class="seg" data-seg="${lang}-mode">
      <button type="button" data-val="none" class="${mode === 'none' ? 'on' : ''}">没有</button>
      <button type="button" data-val="test" class="${mode === 'test' ? 'on' : ''}">有考试成绩</button>
      <button type="button" data-val="self" class="${mode === 'self' ? 'on' : ''}">自己估计</button>
    </div>
    <input type="hidden" name="${lang}-mode" value="${mode}">
    <div data-show="${lang}-mode:test" style="margin-top:10px;${mode === 'test' ? '' : 'display:none'}">
      <label class="field"><span>考试</span><select name="${lang}-test">${tests.map((t) => `<option value="${t.key}" ${p?.test === t.key ? 'selected' : ''}>${t.name}</option>`).join('')}</select></label>
      <div class="grid4">${ABILITIES.map((a) => `<label class="field"><span>${ABILITY_NAMES[a]}</span><input type="number" step="0.5" inputmode="decimal" name="${lang}-score-${a}" value="${p?.scores?.[a] ?? ''}"></label>`).join('')}</div>
    </div>
    <div data-show="${lang}-mode:self" style="margin-top:10px;${mode === 'self' ? '' : 'display:none'}">
      <div class="grid4">${ABILITIES.map((a) => `<label class="field"><span>${ABILITY_NAMES[a]}</span><select name="${lang}-self-${a}">${[0, 4, 5, 6, 7, 8, 9, 10].map((n) => `<option value="${n}" ${p?.levels?.[a] === n ? 'selected' : ''}>${n === 0 ? '<4' : n}</option>`).join('')}</select></label>`).join('')}</div>
      <p class="tiny">按 ${levelName(lang)} 等级估计。自估只用于显示，等有了模考或正式成绩会自动校准。</p>
    </div>
  </fieldset>`;
}

function profileForm(isEdit) {
  const p = state.profile;
  const opt = (list, val) => list.map(([v, n]) => `<option value="${v}" ${String(val) === String(v) ? 'selected' : ''}>${n}</option>`).join('');
  const years = new Date().getFullYear();
  return `<form data-form="profile">
    <h1>${isEdit ? '修改档案' : '创建角色'}</h1>
    <p class="small muted">按官方规则算出你的初始属性。只填计算需要的信息，数据只存在你的设备上。</p>
    <label class="field"><span>昵称（会显示在分享卡片上，可以不填真名）</span><input type="text" name="nickname" maxlength="16" value="${esc(state.nickname)}"></label>
    <fieldset><legend>基本</legend>
      <div class="seg" data-seg="withSpouse"><button type="button" data-val="0" class="${p.withSpouse ? '' : 'on'}">单人</button><button type="button" data-val="1" class="${p.withSpouse ? 'on' : ''}">有配偶随行</button></div>
      <input type="hidden" name="withSpouse" value="${p.withSpouse ? 1 : 0}">
      <div class="grid2" style="margin-top:10px">
        <label class="field"><span>出生年</span><select name="birthYear">${opt([['', '请选择'], ...Array.from({ length: 50 }, (_, i) => [years - 18 - i, years - 18 - i])], p.birthYear ?? '')}</select></label>
        <label class="field"><span>出生月</span><select name="birthMonth">${opt(Array.from({ length: 12 }, (_, i) => [i + 1, `${i + 1} 月`]), p.birthMonth ?? 1)}</select></label>
      </div>
      <label class="field"><span>最高学历（海外学历需要 ECA）</span><select name="education">${opt(EDUCATION_LEVELS.map((e) => [e.key, e.name]), p.education)}</select></label>
      <label class="field"><span>加拿大学历</span><select name="canadianEducation">${opt([['none', '没有'], ['short', '1–2 年制'], ['long', '3 年以上']], p.canadianEducation)}</select></label>
    </fieldset>
    ${languageFieldset('en', p.english)}
    ${languageFieldset('fr', p.french)}
    <label class="field"><span>第一官方语言</span><select name="firstLanguage">${opt([['en', '英语'], ['fr', '法语']], p.firstLanguage)}</select></label>
    <fieldset><legend>工作</legend>
      <div class="grid2">
        <label class="field"><span>加拿大技术类工作经验</span><select name="canadianWorkYears">${opt([0, 1, 2, 3, 4, 5].map((n) => [n, n === 0 ? '不满 1 年' : n === 5 ? '5 年以上' : `${n} 年`]), p.canadianWorkYears)}</select></label>
        <label class="field"><span>海外工作经验</span><select name="foreignWorkYears">${opt([[0, '没有'], [1, '1–2 年'], [3, '3 年以上']], p.foreignWorkYears >= 3 ? 3 : p.foreignWorkYears >= 1 ? 1 : 0)}</select></label>
      </div>
      <label class="field"><span>加拿大高薪职业经验（12 个月以上，看 NOC 全国中位工资）</span><select name="highWageTier">${opt(WAGE_TIERS.map((w) => [w.key, w.name]), p.highWageTier)}</select></label>
      <label class="field"><span>有效 job offer（高薪职业）</span><select name="jobOfferTier">${opt([['none', '没有'], ...WAGE_TIERS.slice(1).map((w) => [w.key, w.name])], p.jobOfferTier)}</select></label>
      <label class="check"><input type="checkbox" name="certificateOfQualification" ${p.certificateOfQualification ? 'checked' : ''}> 有加拿大技工证书</label>
    </fieldset>
    <fieldset><legend>其他</legend>
      <label class="check"><input type="checkbox" name="pnp" ${p.pnp ? 'checked' : ''}> 已有省提名</label>
      <label class="check"><input type="checkbox" name="sibling" ${p.sibling ? 'checked' : ''}> 有兄弟姐妹是加拿大公民或 PR</label>
    </fieldset>
    <fieldset data-show="withSpouse:1" style="${p.withSpouse ? '' : 'display:none'}"><legend>配偶</legend>
      <label class="field"><span>配偶学历</span><select name="spouseEducation">${opt(EDUCATION_LEVELS.map((e) => [e.key, e.name]), p.spouse?.education || 'none')}</select></label>
      <div class="grid2">
        <label class="field"><span>配偶语言（四项大致 CLB）</span><select name="spouseClb">${opt([[0, '没有 / <5'], [5, '5–6'], [7, '7–8'], [9, '9 以上']], p.spouse?.languageLevels?.L ?? 0)}</select></label>
        <label class="field"><span>配偶加拿大工作经验</span><select name="spouseWork">${opt([0, 1, 2, 3, 4, 5].map((n) => [n, n === 0 ? '不满 1 年' : `${n} 年`]), p.spouse?.canadianWorkYears || 0)}</select></label>
      </div>
    </fieldset>
    <p class="err" data-error></p>
    <button class="btn primary block">${isEdit ? '保存' : '生成我的角色'}</button>
    ${isEdit ? '<button type="button" class="btn ghost block" data-action="close-modal" style="margin-top:8px">取消</button>' : ''}
  </form>`;
}

function showOnboarding() {
  $app.innerHTML = '';
  openModal(profileForm(false));
}

function readLanguage(fd, lang) {
  const mode = fd.get(`${lang}-mode`);
  if (mode === 'test') {
    const test = fd.get(`${lang}-test`);
    const scores = {};
    for (const a of ABILITIES) {
      const v = fd.get(`${lang}-score-${a}`);
      if (v === '' || v == null) return { error: `请填写${langName(lang)}四项成绩` };
      scores[a] = Number(v);
    }
    return { value: { source: 'test', test, scores, levels: scoresToLevels(test, scores), date: today() } };
  }
  if (mode === 'self') {
    const levels = {};
    for (const a of ABILITIES) levels[a] = Number(fd.get(`${lang}-self-${a}`)) || 0;
    return { value: { source: 'self', levels, date: today() } };
  }
  return { value: null };
}

function submitProfile(form) {
  const fd = new FormData(form);
  const err = form.querySelector('[data-error]');
  if (!fd.get('birthYear')) { err.textContent = '请选择出生年'; return; }
  const en = readLanguage(fd, 'en');
  const fr = readLanguage(fd, 'fr');
  if (en.error || fr.error) { err.textContent = en.error || fr.error; return; }
  const spouseClb = Number(fd.get('spouseClb')) || 0;
  const before = state.onboarded ? computeCrs(state.profile).total : null;
  const p = {
    ...emptyProfile(),
    withSpouse: fd.get('withSpouse') === '1',
    birthYear: Number(fd.get('birthYear')),
    birthMonth: Number(fd.get('birthMonth')),
    education: fd.get('education'),
    canadianEducation: fd.get('canadianEducation'),
    english: en.value,
    french: fr.value,
    firstLanguage: fd.get('firstLanguage'),
    canadianWorkYears: Number(fd.get('canadianWorkYears')),
    foreignWorkYears: Number(fd.get('foreignWorkYears')),
    highWageTier: fd.get('highWageTier'),
    jobOfferTier: fd.get('jobOfferTier'),
    certificateOfQualification: fd.get('certificateOfQualification') === 'on',
    pnp: fd.get('pnp') === 'on',
    sibling: fd.get('sibling') === 'on',
    spouse: {
      education: fd.get('spouseEducation') || 'none',
      languageLevels: spouseClb ? { L: spouseClb, S: spouseClb, R: spouseClb, W: spouseClb } : null,
      canadianWorkYears: Number(fd.get('spouseWork')) || 0,
    },
  };
  const first = !state.onboarded;
  commit((s) => {
    s.profile = p;
    s.nickname = String(fd.get('nickname') || '').trim();
    s.onboarded = true;
  });
  const crs = computeCrs(state.profile);
  if (first) {
    openModal(`<div class="celebrate"><div class="tiny">你的初始属性</div><div class="big">CRS ${crs.total}</div>
      <p class="small">这是起点，不是评价。接下来每一次学习、每一份投递，都会被记录下来。</p></div>
      <button class="btn primary block" data-action="close-modal">开始</button>`);
  } else {
    closeModal();
    if (before !== crs.total) toast(`档案已更新：CRS ${before} → ${crs.total}`);
  }
}

function openManual() {
  openModal(`<form data-form="manual"><h1>补录学习</h1>
    <label class="field"><span>日期</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
    <label class="field"><span>时长（分钟）</span><input type="number" name="minutes" min="1" max="720" inputmode="numeric" required></label>
    ${branchSkillSelect()}
    <p class="err" data-error></p>
    <button class="btn primary block">记录</button>
    <button type="button" class="btn ghost block" data-action="close-modal" style="margin-top:8px">取消</button></form>`);
}

function addSession(session) {
  const before = totals(state).level;
  commit((s) => s.sessions.push({ id: uid(), ...session }));
  const after = totals(state);
  if (after.level > before) toast(`升级了！Lv ${after.level}`);
  else toast(`+${session.minutes} 分钟，已记录`);
}

function openExam(lang, kind) {
  const tests = TESTS[lang];
  const nth = attempts(state, lang) + 1;
  openModal(`<form data-form="exam" data-lang="${lang}" data-kind="${kind}">
    <h1>${kind === 'official' ? `${langName(lang)} Boss 战 · 第 ${nth} 次挑战` : `${langName(lang)}模考（试炼）`}</h1>
    <div class="grid2">
      <label class="field"><span>考试</span><select name="test">${tests.map((t) => `<option value="${t.key}">${t.name}</option>`).join('')}</select></label>
      <label class="field"><span>日期</span><input type="date" name="date" value="${today()}" max="${today()}"></label>
    </div>
    <div class="grid4">${ABILITIES.map((a) => `<label class="field"><span>${ABILITY_NAMES[a]}</span><input type="number" step="0.5" inputmode="decimal" name="score-${a}" required></label>`).join('')}</div>
    <p class="tiny">${kind === 'official' ? '正式成绩会更新你的 CRS。' : '模考成绩只用来校准熟练度，不影响 CRS。'}</p>
    <p class="err" data-error></p>
    <button class="btn primary block">录入成绩</button>
    <button type="button" class="btn ghost block" data-action="close-modal" style="margin-top:8px">取消</button></form>`);
}

function submitExam(form) {
  const fd = new FormData(form);
  const lang = form.dataset.lang;
  const kind = form.dataset.kind;
  const test = fd.get('test');
  const scores = {};
  for (const a of ABILITIES) {
    const v = fd.get(`score-${a}`);
    if (v === '') { form.querySelector('[data-error]').textContent = '请填写四项成绩'; return; }
    scores[a] = Number(v);
  }
  const levels = scoresToLevels(test, scores);
  const prev = state.exams.filter((e) => e.lang === lang).sort((a, b) => (a.date < b.date ? 1 : -1))[0];
  const hoursSincePrev = effectiveHours(state.sessions, lang, null, prev?.date || null);
  const crsBefore = computeCrs(state.profile).total;
  const exam = { id: uid(), date: fd.get('date') || today(), lang, test, kind, scores, levels };
  commit((s) => {
    s.exams.push(exam);
    if (kind === 'official') {
      const key = lang === 'en' ? 'english' : 'french';
      s.profile[key] = { source: 'test', test, scores, levels, date: exam.date };
    }
  });
  const crsAfter = computeCrs(state.profile).total;
  const target = state.targets[lang];
  const wins = partialWins(exam, target);
  const n = attempts(state, lang);
  const rows = ABILITIES.map((a) => {
    const d = prev ? levels[a] - (prev.levels[a] || 0) : null;
    const nt = nextThreshold(test, a, levels[a]);
    return `<li><span>${ABILITY_NAMES[a]} · ${levelName(lang)} ${levels[a]} ${levels[a] >= target ? '<span class="pill ok">达到目标</span>' : ''}</span>
      <span class="tiny">${d != null && d !== 0 ? `${d > 0 ? '+' : ''}${d} · ` : ''}${levels[a] < target && nt != null ? `下一级需要 ${nt} 分` : ''}</span></li>`;
  }).join('');
  const headline = wins.length === 4 ? '四项全部达到目标！'
    : wins.length > 0 ? `${wins.map((a) => ABILITY_NAMES[a]).join('、')} 已经达到目标` : '这次的战报';
  openModal(`<div class="celebrate">
      <div class="tiny">${kind === 'official' ? `${langName(lang)} Boss 战 · 第 ${n} 次挑战` : `${langName(lang)}试炼`}</div>
      <div class="big">${headline}</div>
      ${prev ? `<p class="small muted">距离上次成绩，你又学了 ${hoursSincePrev.toFixed(1)} 小时。</p>` : ''}
    </div>
    <ul class="list">${rows}</ul>
    ${kind === 'official' && crsAfter !== crsBefore ? `<p class="small" style="margin-top:10px">CRS ${crsBefore} → <b>${crsAfter}</b></p>` : ''}
    ${kind === 'official' && n > 1 ? `<p class="small muted">第 ${n} 次挑战。坚持本身就值得记住。</p>` : ''}
    <button class="btn primary block" data-action="close-modal" style="margin-top:12px">好</button>`);
}

// ---------------- 分享卡片 ----------------
function cardData() {
  const k = today();
  const st = streak(activeDays(state), k);
  const t = totals(state);
  const o = ui.cardOpts;
  let minutes;
  let xp;
  let title;
  if (ui.cardRange === 'day') {
    const d = dayXp(state.sessions.filter((s) => s.date === k), state.events.filter((e) => e.date === k), focusFor(state, k));
    minutes = d.minutes; xp = d.xp; title = '今日战报';
  } else {
    const w = weekSummary(state, k).thisWeek;
    minutes = w.minutes; xp = w.xp; title = '本周战报';
  }
  const stats = [
    { label: ui.cardRange === 'day' ? '今天学习（分钟）' : '本周学习（分钟）', value: Math.round(minutes) },
    { label: ui.cardRange === 'day' ? '今日 XP' : '本周 XP', value: xp },
  ];
  if (o.streak) stats.push({ label: `连续天数 · 最长 ${st.longest}`, value: st.current }, { label: '角色等级', value: `Lv ${t.level}` });
  const lines = [];
  if (o.sublevel) {
    const sl = frenchSublevel(state);
    if (sl.totalHours > 0 || sl.calibrated) {
      lines.push(`法语小等级 ${sl.key}${sl.next ? `，距离 ${sl.next.key} 还差约 ${(sl.next.from - sl.hoursEquivalent).toFixed(0)} 小时` : ''}`);
    }
  }
  if (o.attempts) {
    for (const lang of ['en', 'fr']) {
      const n = attempts(state, lang);
      if (n) lines.push(`${langName(lang)}考试：已挑战 ${n} 次`);
    }
  }
  if (o.explore) {
    const visited = Object.keys(state.map.visited).length;
    const lit = Object.keys(state.map.lit).length;
    if (visited) lines.push(`探索：到过 ${visited} 格，点亮 ${lit} 格 · 营地：${camp(lit).name}`);
  }
  if (!lines.length) lines.push('每一天的努力都算数。');
  return {
    title,
    subtitle: k,
    nickname: o.nickname && state.nickname ? state.nickname : '',
    stats,
    lines,
    footer: '枫途 · 把 PR 之路变成成长记录（测试原型）',
  };
}

async function openCard() {
  const canvas = drawCard(cardData());
  const url = canvas.toDataURL('image/png');
  const o = ui.cardOpts;
  const chk = (k, n) => `<label class="check"><input type="checkbox" data-change="card-opt" data-key="${k}" ${o[k] ? 'checked' : ''}><span class="small">${n}</span></label>`;
  openModal(`<h1>分享卡片</h1>
    <div class="seg" data-seg="card-range"><button type="button" data-val="day" class="${ui.cardRange === 'day' ? 'on' : ''}">今日</button><button type="button" data-val="week" class="${ui.cardRange === 'week' ? 'on' : ''}">本周</button></div>
    <div class="grid2" style="margin:8px 0">${chk('nickname', '显示昵称')}${chk('streak', '连续天数和等级')}${chk('sublevel', '法语小等级')}${chk('attempts', '考试挑战次数')}${chk('explore', '探索进度（不含位置）')}</div>
    <p class="tiny">卡片不会显示 CRS、个人档案、地图和位置。在手机上长按图片可以保存或转发。</p>
    <img class="card-preview" src="${url}" alt="分享卡片预览">
    <div class="grid2" style="margin-top:10px">
      <button class="btn" data-action="card-download">保存图片</button>
      <button class="btn primary" data-action="card-share">分享</button>
    </div>
    <button class="btn ghost block" data-action="close-modal" style="margin-top:8px">关闭</button>`);
  ui.cardCanvas = canvas;
}

async function shareCard() {
  const blob = await canvasToBlob(ui.cardCanvas);
  const file = new File([blob], `枫途-${today()}.png`, { type: 'image/png' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* 用户取消 */ }
  } else {
    downloadBlob(blob, file.name);
    toast('已保存图片，可以发到群里');
  }
}

function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------------- 事件 ----------------
document.addEventListener('click', async (e) => {
  const seg = e.target.closest('[data-seg] button');
  if (seg) {
    const box = seg.closest('[data-seg]');
    const name = box.dataset.seg;
    box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === seg));
    if (name === 'card-range') { ui.cardRange = seg.dataset.val; openCard(); return; }
    const input = box.parentElement.querySelector(`input[name="${name}"]`);
    if (input) input.value = seg.dataset.val;
    const root = box.closest('form') || document;
    root.querySelectorAll(`[data-show^="${name}:"]`).forEach((el) => {
      el.style.display = el.dataset.show === `${name}:${seg.dataset.val}` ? '' : 'none';
    });
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const a = el.dataset.action;
  if (a === 'close-modal-bg') { if (e.target === el && state.onboarded && state.acceptedNotice) closeModal(); return; }
  if (a === 'close-modal') { closeModal(); render(); }
  if (a === 'accept-notice') { closeModal(); commit((s) => { s.acceptedNotice = true; }); }
  if (a === 'show-notice') showNoticeAgain();
  if (a === 'open-manual') openManual();
  if (a === 'open-profile') openModal(profileForm(true));
  if (a === 'open-exam') openExam(el.dataset.lang, el.dataset.kind);
  if (a === 'open-card') openCard();
  if (a === 'card-download') { const b = await canvasToBlob(ui.cardCanvas); downloadBlob(b, `枫途-${today()}.png`); }
  if (a === 'card-share') shareCard();
  if (a === 'ask-delete') { ui.pendingDelete = el.dataset.id; render(); }
  if (a === 'delete-session') { ui.pendingDelete = null; commit((s) => { s.sessions = s.sessions.filter((x) => x.id !== el.dataset.id); }); }
  if (a === 'ask-reset') { ui.pendingDelete = 'reset'; render(); }
  if (a === 'reset') { ui.pendingDelete = null; state = emptyState(); save(state); location.hash = ''; render(); }
  if (a === 'counter') {
    commit((s) => s.events.push({ id: uid(), date: today(), key: el.dataset.key }));
    toast(`+${XP.counters[el.dataset.key]} XP`);
  }
  if (a === 'timer-stop') {
    const t = state.timer;
    const minutes = Math.round((Date.now() - t.startedAt) / 60000);
    commit((s) => { s.timer = null; });
    if (minutes < 1) { toast('不到 1 分钟，没有记录'); return; }
    addSession({ date: dateKey(new Date(t.startedAt)), startedAt: t.startedAt, minutes, branch: t.branch, skill: t.skill,
      mode: t.mode, planned: t.planned, completedPlan: !!t.planned && minutes >= t.planned, source: 'timer' });
  }
  if (a === 'timer-cancel') commit((s) => { s.timer = null; });
  if (a === 'map-consent') commit((s) => { s.map.consent = true; });
  if (a === 'explore-start') startExplore();
  if (a === 'explore-stop') stopExplore();
  if (a === 'light-nearby') lightNearby();
  if (a === 'open-base') openBase();
  if (a === 'debug-walk') debugWalk();
  if (a === 'show-landmark') showLandmark(LANDMARKS.find((l) => l.id === el.dataset.id));
  if (a === 'delete-base') { ui.pendingDelete = null; commit((s) => { s.map.bases = s.map.bases.filter((b) => b.id !== el.dataset.id); }); }
  if (a === 'export') {
    const withProfile = el.dataset.profile === '1';
    downloadBlob(new Blob([exportJson(state, withProfile)], { type: 'application/json' }), `枫途-备份-${today()}${withProfile ? '' : '-无档案'}.json`);
  }
});

function showNoticeAgain() {
  openModal(`<h1>说明</h1>
    <ul class="small">
      <li>这是测试原型，不是正式产品。</li>
      <li>不提供移民建议。分数按 IRCC 公开规则计算（规则版本 ${RULES_VERSION}），可能有误，以官方为准。</li>
      <li>数据只存在你的设备上。XP 规则：主动学习 1 分钟 = 1 XP；被动沉浸减半；每天前 3 小时全额，3–6 小时减半，6 小时以上不计 XP；每天第一次学习 +${XP.firstOfDay}；完成计划 +${XP.planComplete}。</li>
    </ul>
    <button class="btn primary block" data-action="close-modal">好</button>`);
}

document.addEventListener('change', async (e) => {
  const el = e.target;
  const c = el.dataset.change;
  if (!c) return;
  if (c === 'branch') {
    const form = el.closest('form');
    const skills = BRANCHES[el.value].skills;
    form.querySelector('[name=skill]').innerHTML = (skills.length ? skills.map((s) => `<option value="${s}">${SKILL_NAMES[s]}</option>`).join('') : '') + '<option value="">（不分）</option>';
  }
  if (c === 'focus') {
    const [branch, skill] = el.value ? el.value.split(':') : [];
    commit((s) => { s.focus = el.value ? { week: weekKey(today()), branch, skill } : null; });
  }
  if (c === 'cando') commit((s) => { s.canDo[el.dataset.key] = el.checked; });
  if (c === 'next-exam') commit((s) => { s.nextExam[el.dataset.lang] = el.value || null; });
  if (c === 'target') commit((s) => { s.targets[el.dataset.lang] = Number(el.value); });
  if (c === 'sim') {
    const obj = el.dataset.route === 'A' ? ui.simA : ui.simB;
    obj[el.dataset.key] = el.value;
    render();
  }
  if (c === 'card-opt') { ui.cardOpts[el.dataset.key] = el.checked; openCard(); }
  if (c === 'import') {
    const f = el.files?.[0];
    if (!f) return;
    try {
      state = importJson(await f.text());
      save(state);
      render();
      toast('已导入');
    } catch (err) {
      toast(`导入失败：${err.message}`);
    }
  }
});

document.addEventListener('submit', (e) => {
  const form = e.target.closest('form[data-form]');
  if (!form) return;
  e.preventDefault();
  const f = form.dataset.form;
  if (f === 'profile') submitProfile(form);
  if (f === 'exam') submitExam(form);
  if (f === 'timer-start') {
    const fd = new FormData(form);
    commit((s) => {
      s.timer = { startedAt: Date.now(), branch: fd.get('branch'), skill: fd.get('skill') || null, mode: fd.get('mode'), planned: Number(fd.get('planned')) || null };
    });
  }
  if (f === 'base') {
    const fd = new FormData(form);
    const p = explore.last;
    closeModal();
    commit((s) => s.map.bases.push({ id: uid(), name: String(fd.get('name')).trim() || '据点', type: fd.get('type'), lat: p.lat, lng: p.lng, cell: mapview.cellAt(p.lat, p.lng) }));
    toast('据点已保存');
  }
  if (f === 'manual') {
    const fd = new FormData(form);
    const minutes = Number(fd.get('minutes'));
    if (!minutes || minutes < 1) { form.querySelector('[data-error]').textContent = '请填写时长'; return; }
    closeModal();
    addSession({ date: fd.get('date') || today(), startedAt: Date.now(), minutes, branch: fd.get('branch'), skill: fd.get('skill') || null,
      mode: fd.get('mode'), planned: null, completedPlan: false, source: 'manual' });
  }
});

window.addEventListener('hashchange', () => { ui.pendingDelete = null; render(); window.scrollTo(0, 0); });

// 计时器显示
function fmtElapsed(startedAt) {
  const sec = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${h ? h + ':' : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

setInterval(() => {
  const el = document.getElementById('timer-display');
  if (el && state.timer) el.textContent = fmtElapsed(state.timer.startedAt);
}, 1000);

render();
