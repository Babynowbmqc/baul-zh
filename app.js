/* 游戏宝箱 · 中文版 · 前端逻辑
   数据：games.js 里的 SEED_GAMES 为初始目录；用户的增改删、收藏、评分和历史记录存在浏览器 localStorage。 */
(function () {
  'use strict';

  // ---------- 文案字典 ----------
  const L = {
    family: { verbal: '语言游戏', libreta: '纸笔游戏', truco: '小诡计', logica: '逻辑游戏', fisico: '身体游戏', teatro: '戏剧游戏', rol: '秘密身份' },
    familyDesc: {
      verbal: '只用嘴巴就能玩', libreta: '要一张纸和一支笔', truco: '只能玩一次的诡计，规则就是秘密', logica: '手势和小策略',
      fisico: '要跑要跳要动手', teatro: '即兴表演练习', rol: '有人在撒谎，找出是谁'
    },
    setting: { interior: '室内', exterior: '户外' },
    space: { sentados: '坐着就行', sala: '一个房间', amplio: '开阔场地' },
    duration: { expres: '极短', corto: '短', medio: '中等', largo: '长', muylargo: '很长' },
    durationMin: { expres: 5, corto: 15, medio: 30, largo: 60, muylargo: 120 },
    durationText: { expres: '不到 5 分钟', corto: '5 到 15 分钟', medio: '15 到 30 分钟', largo: '半小时到一小时', muylargo: '一小时以上' },
    materials: { ninguno: '不需要材料', basicos: '纸笔之类', especificos: '专门道具' },
    complexity: { facil: '简单', media: '中等', compleja: '复杂' },
    age: { todos: '老少皆宜', jovenes: '青少年以上', adultos: '仅限成人' },
    dynamic: { libre: '自由玩', competitivo: '个人竞争', cooperativo: '合作', equipos: '分队', unovstodos: '一人对众人' },
    skills: {
      vocabulario: '词汇', deduccion: '推理', empatia: '共情', memoria: '记忆', faroleo: '演技/唬人', improvisacion: '即兴', estrategia: '策略',
      actuacion: '表演', musica: '音乐', reflejos: '反应', cultura: '常识', ritmo: '节奏', observacion: '观察', dibujo: '画画', confianza: '信任'
    },
    occasions: { sobremesa: '饭后', viaje: '路上', hielo: '破冰', campamento: '营地', fiesta: '派对', teambuilding: '团建', calentamiento: '热身' },
    moderator: { true: '需要主持人', false: '不需要主持人' },
    warnings: { '身体接触': '身体接触', '露骨': '露骨内容', '酒精': '可能涉及喝酒' },
    profile: { fisico: '身体', mental: '脑力', verbal: '语言', social: '社交', creativo: '创意' }
  };
  const FAMILY_ORDER = ['verbal', 'libreta', 'truco', 'logica', 'fisico', 'teatro', 'rol'];

  // ---------- 存储 ----------
  const KEY = 'baul-zh-v1';
  const store = load();
  function load() {
    try { return Object.assign({ custom: {}, history: {}, ratings: {}, favs: [] }, JSON.parse(localStorage.getItem(KEY) || '{}')); }
    catch (e) { return { custom: {}, history: {}, ratings: {}, favs: [] }; }
  }
  function save() { localStorage.setItem(KEY, JSON.stringify(store)); }

  // 合并种子数据和本地改动
  function allGames() {
    const map = new Map();
    (window.SEED_GAMES || []).forEach(g => map.set(g.id, Object.assign({}, g)));
    Object.keys(store.custom).forEach(id => {
      const c = store.custom[id];
      if (c === null) map.delete(id); else map.set(id, c);
    });
    const list = [...map.values()];
    list.forEach(g => {
      const r = store.ratings[g.id];
      g._count = r ? r.count : 0; g._sum = r ? r.sum : 0;
      g._avg = g._count ? g._sum / g._count : 0;
    });
    return list;
  }

  // ---------- 状态 ----------
  const state = { people: 6, setting: '', time: '', mood: '', q: '', fav: false, sort: 'family', multi: {} };
  const MULTI_KEYS = ['family', 'space', 'materials', 'dynamic', 'skills', 'occasions', 'complexity', 'age', 'moderator', 'warnings'];
  MULTI_KEYS.forEach(k => state.multi[k] = new Set());

  const $ = s => document.querySelector(s);
  const el = (tag, attrs, ...kids) => {
    const n = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(k => {
      if (k === 'class') n.className = attrs[k];
      else if (k === 'html') n.innerHTML = attrs[k];
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), attrs[k]);
      else if (k === 'style') n.style.cssText = attrs[k];
      else n.setAttribute(k, attrs[k]);
    });
    kids.flat().forEach(c => { if (c == null) return; n.append(c.nodeType ? c : document.createTextNode(String(c))); });
    return n;
  };
  const esc = s => String(s == null ? '' : s);

  // ---------- 筛选 ----------
  function matches(g) {
    if (state.fav && !store.favs.includes(g.id)) return false;
    if (g.playersMin && state.people < g.playersMin) return false;
    if (g.playersMax && state.people > g.playersMax) return false;
    if (state.setting && !(g.setting || []).includes(state.setting)) return false;
    if (state.time && L.durationMin[g.duration] > Number(state.time)) return false;
    if (state.mood) {
      const p = g.profile || {};
      if (state.mood === 'tranquilo') { if ((p.fisico || 0) > 1) return false; }
      else if ((p[state.mood] || 0) < 2) return false;
    }
    for (const k of MULTI_KEYS) {
      const sel = state.multi[k]; if (!sel.size) continue;
      let v = g[k];
      if (k === 'moderator') v = String(!!g.moderator);
      const arr = Array.isArray(v) ? v : [v];
      if (!arr.some(x => sel.has(String(x)))) return false;
    }
    if (state.q) {
      const q = state.q.toLowerCase();
      const hay = [g.name, g.nameEs, g.tagline, g.description, g.tips, g.secret, g.materialsList, L.family[g.family],
        ...(g.skills || []).map(s => L.skills[s]), ...(g.occasions || []).map(s => L.occasions[s])].join(' ').toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  }

  function sorted(list) {
    const by = state.sort;
    const name = (a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN');
    const cmp = {
      family: (a, b) => FAMILY_ORDER.indexOf(a.family) - FAMILY_ORDER.indexOf(b.family) || name(a, b),
      'rating-desc': (a, b) => b._avg - a._avg || b._count - a._count || name(a, b),
      'rating-asc': (a, b) => (a._count ? a._avg : 99) - (b._count ? b._avg : 99) || name(a, b),
      alpha: name,
      fast: (a, b) => L.durationMin[a.duration] - L.durationMin[b.duration] || name(a, b),
      long: (a, b) => L.durationMin[b.duration] - L.durationMin[a.duration] || name(a, b),
      people: (a, b) => (b.playersMax || 999) - (a.playersMax || 999) || (b.playersMin || 0) - (a.playersMin || 0) || name(a, b),
      new: (a, b) => (b.createdAt || '').localeCompare(a.createdAt || '') || name(a, b)
    }[by] || name;
    return list.slice().sort(cmp);
  }

  // ---------- 渲染 ----------
  let lastVisible = [];
  function render() {
    const games = allGames();
    $('#stat-total').textContent = games.length;
    $('#stat-nomat').textContent = games.filter(g => g.materials === 'ninguno').length;
    $('#stat-nolimit').textContent = games.filter(g => !g.playersMax).length;
    $('#fav-count').textContent = store.favs.length;
    $('#more-count').textContent = MULTI_KEYS.reduce((n, k) => n + state.multi[k].size, 0);

    const vis = sorted(games.filter(matches));
    lastVisible = vis;
    $('#result-count').textContent = vis.length;
    const box = $('#results'); box.innerHTML = '';
    $('#empty').hidden = vis.length > 0;

    let lastFam = null;
    vis.forEach(g => {
      if (state.sort === 'family' && g.family !== lastFam) {
        lastFam = g.family;
        const n = vis.filter(x => x.family === g.family).length;
        box.append(el('div', { class: 'fam-head' }, el('h2', null, L.family[g.family] || g.family), el('small', null, `${L.familyDesc[g.family] || ''} · ${n} 个`)));
      }
      box.append(card(g));
    });
  }

  const famVar = g => `--fam:var(--fam-${g.family in L.family ? g.family : 'verbal'})`;
  const playersText = g => g.playersMax ? (g.playersMin === g.playersMax ? `${g.playersMin} 人` : `${g.playersMin}–${g.playersMax} 人`) : `${g.playersMin || 1} 人以上`;

  function profileBars(g, big) {
    const p = g.profile || {};
    const wrap = el('div', { class: big ? 'profile-big' : 'profile' });
    Object.keys(L.profile).forEach(k => {
      const bars = el('b', null, ...[1, 2, 3].map(i => el('s', { class: (p[k] || 0) >= i ? 'on' : '' })));
      wrap.append(big ? el('div', null, L.profile[k], bars) : el('i', null, L.profile[k], bars));
    });
    return wrap;
  }

  function card(g) {
    const fav = store.favs.includes(g.id);
    const c = el('article', { class: 'card', style: famVar(g), tabindex: '0', role: 'button', 'aria-label': g.name,
      onclick: () => openDetail(g.id), onkeydown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(g.id); } } },
      el('div', { class: 'card-top' },
        el('h3', null, g.name, g.nameEs && g.nameEs !== g.name ? el('span', { class: 'es' }, g.nameEs) : null),
        el('button', { class: 'fav' + (fav ? ' on' : ''), 'aria-label': fav ? '取消收藏' : '收藏', title: fav ? '取消收藏' : '收藏',
          onclick: e => { e.stopPropagation(); toggleFav(g.id); } }, fav ? '★' : '☆')),
      el('p', { class: 'tagline' }, g.tagline || ''),
      el('div', { class: 'badges' },
        el('span', { class: 'badge fam' }, L.family[g.family] || g.family),
        el('span', { class: 'badge' }, L.duration[g.duration] || g.duration),
        el('span', { class: 'badge' }, L.materials[g.materials] || ''),
        g.moderator ? el('span', { class: 'badge' }, '需要主持人') : null,
        ...(g.warnings || []).map(w => el('span', { class: 'badge warn' }, L.warnings[w] || w)),
        g.needsInfo ? el('span', { class: 'badge need' }, '缺少规则') : null),
      profileBars(g),
      el('div', { class: 'meta' },
        el('span', null, '👥 ' + playersText(g)),
        el('span', null, '📍 ' + (g.setting || []).map(s => L.setting[s]).join(' / ')),
        el('span', { class: 'rating' }, g._count ? [el('b', null, '★ ' + g._avg.toFixed(1)), ` (${g._count})`] : '还没有人评分'))
    );
    return c;
  }

  // ---------- 详情 ----------
  let currentId = null;
  function openDetail(id) {
    const g = allGames().find(x => x.id === id); if (!g) return;
    currentId = id;
    const fav = store.favs.includes(id);
    const mine = (store.ratings[id] || {}).mine || 0;
    const body = $('#game-detail'); body.innerHTML = ''; body.style.cssText = famVar(g);
    const facts = [
      ['人数', playersText(g)], ['时长', `${L.duration[g.duration]} · ${L.durationText[g.duration] || ''}`],
      ['地点', (g.setting || []).map(s => L.setting[s]).join(' / ') || '—'], ['场地', L.space[g.space] || '—'],
      ['材料', L.materials[g.materials] + (g.materialsList ? '：' + g.materialsList : '')], ['获取方式', g.purchase || '—'],
      ['规则难度', L.complexity[g.complexity] || '—'], ['年龄', L.age[g.age] || '—'],
      ['主持人', g.moderator ? '需要一位知道规则的人' : '不需要'], ['玩法形式', (g.dynamic || []).map(d => L.dynamic[d]).join('、') || '—'],
      ['考验什么', (g.skills || []).map(s => L.skills[s] || s).join('、') || '—'], ['适合场合', (g.occasions || []).map(s => L.occasions[s] || s).join('、') || '—']
    ];
    body.append(
      el('div', { class: 'detail' },
        el('div', { class: 'detail-head' },
          el('h2', null, g.name, g.nameEs && g.nameEs !== g.name ? el('span', { class: 'es' }, '原名：' + g.nameEs) : null),
          el('button', { class: 'fav' + (fav ? ' on' : ''), 'aria-label': '收藏', onclick: () => { toggleFav(id); openDetail(id); } }, fav ? '★' : '☆'),
          el('button', { class: 'detail-close', 'aria-label': '关闭', onclick: () => $('#dlg-game').close() }, '×')),
        el('p', { class: 'detail-tag' }, g.tagline || ''),
        el('div', { class: 'badges' },
          el('span', { class: 'badge fam' }, L.family[g.family] || g.family),
          ...(g.warnings || []).map(w => el('span', { class: 'badge warn' }, L.warnings[w] || w)),
          g.needsInfo ? el('span', { class: 'badge need' }, '缺少规则，欢迎补充') : null),
        el('div', { class: 'detail-facts' }, ...facts.map(([k, v]) => el('div', null, el('span', null, k), v))),
        el('h3', null, '游戏画像'), profileBars(g, true),
        el('h3', null, '怎么玩'), el('p', null, g.description || ''),
        g.secret ? el('details', { class: 'secret-box' }, el('summary', null, '🤫 秘密 / 诀窍（没玩过的人别点开）'), el('p', null, g.secret)) : null,
        g.tips ? [el('h3', null, '小贴士'), el('p', null, g.tips)] : null,
        el('div', { class: 'rate-row' },
          el('span', null, '给它打个分：'),
          el('span', { class: 'stars' }, ...[1, 2, 3, 4, 5].map(i => el('button', { type: 'button', class: mine >= i ? 'on' : '', 'aria-label': `${i} 星`, onclick: () => rate(id, i) }, '★'))),
          el('span', null, g._count ? `平均 ${g._avg.toFixed(1)} 分，${g._count} 人评过` : '还没有人评分')),
        el('div', { class: 'detail-actions' },
          el('button', { class: 'chip', onclick: () => copyGame(g) }, '📋 复制规则'),
          el('button', { class: 'chip', onclick: () => openForm(id) }, '✎ 编辑'),
          el('button', { class: 'chip', onclick: () => openHistory(id) }, '🕘 历史'),
          el('button', { class: 'chip chip-danger', onclick: () => removeGame(id) }, '删除'))
      ));
    $('#dlg-game').showModal();
    body.scrollTop = 0;
  }

  function toggleFav(id) {
    const i = store.favs.indexOf(id);
    if (i >= 0) store.favs.splice(i, 1); else store.favs.push(id);
    save(); render();
  }

  function rate(id, n) {
    const r = store.ratings[id] || { count: 0, sum: 0, mine: 0 };
    if (r.mine) { r.sum -= r.mine; r.count -= 1; }
    r.mine = n; r.sum += n; r.count += 1;
    store.ratings[id] = r; save(); toast(`已打 ${n} 星`); render(); openDetail(id);
  }

  function gameToText(g) {
    const lines = [g.name + (g.nameEs && g.nameEs !== g.name ? `（${g.nameEs}）` : ''), g.tagline, '',
      `类型：${L.family[g.family]} · 人数：${playersText(g)} · 时长：${L.duration[g.duration]} · 材料：${L.materials[g.materials]}${g.materialsList ? '（' + g.materialsList + '）' : ''}`,
      '', '怎么玩：', g.description];
    if (g.secret) lines.push('', '秘密：', g.secret);
    if (g.tips) lines.push('', '小贴士：', g.tips);
    return lines.join('\n');
  }
  async function copyGame(g) {
    const t = gameToText(g);
    try { await navigator.clipboard.writeText(t); toast('已复制到剪贴板'); }
    catch (e) { const ta = $('#copy-text'); ta.value = t; $('#dlg-copy').showModal(); ta.focus(); ta.select(); }
  }

  function removeGame(id) {
    const g = allGames().find(x => x.id === id); if (!g) return;
    if (!confirm(`确定要把「${g.name}」从宝箱里拿掉吗？可以在历史记录里恢复。`)) return;
    pushHistory(id, { type: 'delete', before: g, after: null, who: '' });
    store.custom[id] = null; save();
    $('#dlg-game').close(); toast('已删除，可从历史恢复'); render();
  }

  // ---------- 历史 ----------
  function pushHistory(id, entry) {
    const h = store.history[id] || [];
    h.unshift(Object.assign({ at: new Date().toISOString() }, entry));
    store.history[id] = h.slice(0, 50);
  }
  function openHistory(id) {
    const h = store.history[id] || [];
    const g = allGames().find(x => x.id === id);
    const seed = (window.SEED_GAMES || []).find(x => x.id === id);
    const body = $('#history-body'); body.innerHTML = '';
    const label = { add: '添加了这个游戏', edit: '修改了内容', delete: '删除了这个游戏', restore: '恢复了' };
    body.append(
      el('div', { class: 'detail-head' }, el('h2', null, '历史：' + (g ? g.name : (h[0] && h[0].before ? h[0].before.name : id))),
        el('button', { class: 'detail-close', 'aria-label': '关闭', onclick: () => $('#dlg-history').close() }, '×')),
      h.length ? el('ul', { class: 'hist-list' }, ...h.map((e, i) => el('li', null,
        el('time', null, new Date(e.at).toLocaleString('zh-CN', { hour12: false })),
        el('span', { class: 'what' }, label[e.type] || e.type, e.who ? el('span', { class: 'who' }, ' · ' + e.who) : null),
        e.before ? el('button', { class: 'chip', onclick: () => restore(id, e.before) }, '恢复到改动前') : null
      ))) : el('p', { class: 'muted' }, '这个游戏还没有任何改动记录。'),
      seed && store.custom[id] !== undefined ? el('p', null, el('button', { class: 'chip', onclick: () => restore(id, seed, true) }, '恢复为原始目录版本')) : null
    );
    $('#dlg-history').showModal();
  }
  function restore(id, version, isSeed) {
    const cur = allGames().find(x => x.id === id) || null;
    pushHistory(id, { type: 'restore', before: cur, after: version, who: '' });
    if (isSeed) delete store.custom[id]; else store.custom[id] = Object.assign({}, version, { updatedAt: new Date().toISOString() });
    save(); $('#dlg-history').close(); toast('已恢复'); render();
    if ($('#dlg-game').open) openDetail(id);
  }

  // ---------- 表单 ----------
  const form = $('#game-form');
  function fillSelect(sel, dict, blank) {
    sel.innerHTML = '';
    if (blank) sel.append(el('option', { value: '' }, blank));
    Object.keys(dict).forEach(k => sel.append(el('option', { value: k }, dict[k])));
  }
  function buildForm() {
    fillSelect(form.family, L.family, '选一个…');
    fillSelect(form.duration, L.duration, '选一个…');
    fillSelect(form.space, L.space); fillSelect(form.materials, L.materials);
    fillSelect(form.complexity, L.complexity); fillSelect(form.age, L.age);
    const pg = $('#profile-inputs');
    Object.keys(L.profile).forEach(k => pg.append(el('label', null, el('span', null, L.profile[k]), el('input', { type: 'number', name: 'p_' + k, min: 0, max: 3, value: 0 }))));
    form.querySelectorAll('fieldset[data-multi]').forEach(fs => {
      const key = fs.dataset.multi;
      Object.keys(L[key]).forEach(k => fs.append(el('label', { class: 'fopt' }, el('input', { type: 'checkbox', name: key, value: k }), L[key][k])));
    });
  }
  function slug(s) {
    const base = s.toLowerCase().replace(/[^a-z0-9一-鿿]+/g, '-').replace(/^-|-$/g, '') || 'game';
    let id = base, n = 2; const ids = new Set(allGames().map(g => g.id));
    while (ids.has(id)) id = base + '-' + n++;
    return id;
  }
  function openForm(id) {
    form.reset(); $('#form-error').hidden = true;
    form.dataset.id = id || '';
    $('#form-title').textContent = id ? '编辑游戏' : '添加一个游戏';
    if (id) {
      const g = allGames().find(x => x.id === id); if (!g) return;
      ['name', 'tagline', 'description', 'secret', 'materialsList', 'tips'].forEach(k => form[k].value = g[k] || '');
      ['family', 'duration', 'space', 'materials', 'complexity', 'age', 'purchase'].forEach(k => { if (g[k]) form[k].value = g[k]; });
      form.playersMin.value = g.playersMin || ''; form.playersMax.value = g.playersMax || '';
      form.moderator.checked = !!g.moderator;
      form.querySelectorAll('[name=setting]').forEach(c => c.checked = (g.setting || []).includes(c.value));
      Object.keys(L.profile).forEach(k => form['p_' + k].value = (g.profile || {})[k] || 0);
      ['dynamic', 'skills', 'occasions', 'warnings'].forEach(key => form.querySelectorAll(`[name=${key}]`).forEach(c => c.checked = (g[key] || []).includes(c.value)));
    } else {
      form.space.value = 'sentados'; form.materials.value = 'ninguno'; form.complexity.value = 'facil'; form.age.value = 'todos';
    }
    if ($('#dlg-game').open) $('#dlg-game').close();
    $('#dlg-form').showModal();
    form.querySelector('.form-grid').scrollTop = 0;
  }
  form.addEventListener('submit', e => {
    e.preventDefault();
    const err = $('#form-error');
    const name = form.name.value.trim();
    if (!name || !form.family.value || !form.duration.value || !form.description.value.trim()) {
      err.textContent = '名称、类型、时长和玩法是必填的。'; err.hidden = false; return;
    }
    const id = form.dataset.id;
    const prev = id ? allGames().find(x => x.id === id) : null;
    const checked = key => [...form.querySelectorAll(`[name=${key}]:checked`)].map(c => c.value);
    const profile = {}; Object.keys(L.profile).forEach(k => profile[k] = Math.max(0, Math.min(3, Number(form['p_' + k].value) || 0)));
    const now = new Date().toISOString();
    const who = form.author.value.trim();
    const g = Object.assign({}, prev || {}, {
      id: id || slug(name), name, nameEs: prev ? prev.nameEs : '', tagline: form.tagline.value.trim(), family: form.family.value,
      description: form.description.value.trim(), secret: form.secret.value.trim(),
      playersMin: Number(form.playersMin.value) || 1, playersMax: Number(form.playersMax.value) || null,
      setting: checked('setting'), space: form.space.value, duration: form.duration.value, materials: form.materials.value,
      materialsList: form.materialsList.value.trim(), purchase: form.purchase.value, profile,
      skills: checked('skills'), dynamic: checked('dynamic'), moderator: form.moderator.checked,
      complexity: form.complexity.value, age: form.age.value, warnings: checked('warnings'), occasions: checked('occasions'),
      tips: form.tips.value.trim(), needsInfo: false, origin: prev ? prev.origin : 'comunidad',
      version: (prev ? prev.version || 0 : 0) + 1, createdAt: prev ? prev.createdAt : now, updatedAt: now,
      createdBy: prev ? prev.createdBy : (who || null), updatedBy: who || null, ratingCount: 0, ratingSum: 0
    });
    pushHistory(g.id, { type: prev ? 'edit' : 'add', before: prev, after: g, who });
    store.custom[g.id] = g; save();
    $('#dlg-form').close(); toast(prev ? '已保存修改' : '已放进宝箱'); render(); openDetail(g.id);
  });
  $('#form-cancel').addEventListener('click', () => $('#dlg-form').close());

  // ---------- 更多筛选 ----------
  function buildMoreFilters() {
    document.querySelectorAll('#more-filters .fgroup').forEach(gw => {
      const key = gw.dataset.key, box = gw.querySelector('.fopts');
      Object.keys(L[key]).forEach(k => {
        const input = el('input', { type: 'checkbox', value: k, onchange: () => { input.checked ? state.multi[key].add(k) : state.multi[key].delete(k); render(); } });
        box.append(el('label', { class: 'fopt' }, input, L[key][k]));
      });
    });
  }

  // ---------- 事件 ----------
  function clearFilters() {
    Object.assign(state, { setting: '', time: '', mood: '', q: '', fav: false });
    MULTI_KEYS.forEach(k => state.multi[k].clear());
    $('#f-setting').value = ''; $('#f-time').value = ''; $('#f-mood').value = ''; $('#q').value = '';
    $('#btn-fav').setAttribute('aria-pressed', 'false');
    document.querySelectorAll('#more-filters input').forEach(i => i.checked = false);
    render();
  }
  $('#people-minus').addEventListener('click', () => { state.people = Math.max(1, state.people - 1); $('#people-count').value = state.people; render(); });
  $('#people-plus').addEventListener('click', () => { state.people = Math.min(60, state.people + 1); $('#people-count').value = state.people; render(); });
  $('#f-setting').addEventListener('change', e => { state.setting = e.target.value; render(); });
  $('#f-time').addEventListener('change', e => { state.time = e.target.value; render(); });
  $('#f-mood').addEventListener('change', e => { state.mood = e.target.value; render(); });
  $('#q').addEventListener('input', e => { state.q = e.target.value.trim(); render(); });
  $('#sort').addEventListener('change', e => { state.sort = e.target.value; render(); });
  $('#btn-fav').addEventListener('click', e => { state.fav = !state.fav; e.currentTarget.setAttribute('aria-pressed', String(state.fav)); render(); });
  $('#btn-more').addEventListener('click', e => { const p = $('#more-filters'); p.hidden = !p.hidden; e.currentTarget.setAttribute('aria-expanded', String(!p.hidden)); });
  $('#btn-clear').addEventListener('click', clearFilters);
  $('#btn-clear-2').addEventListener('click', clearFilters);
  $('#btn-random').addEventListener('click', () => {
    const pool = lastVisible.length ? lastVisible : allGames();
    if (!pool.length) return;
    openDetail(pool[Math.floor(Math.random() * pool.length)].id);
  });
  $('#btn-add').addEventListener('click', () => openForm());
  $('#fab-add').addEventListener('click', () => openForm());
  $('#copy-close').addEventListener('click', () => $('#dlg-copy').close());
  document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));

  let toastT;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 1800); }

  // ---------- 启动 ----------
  buildMoreFilters(); buildForm();
  $('#people-count').value = state.people;
  render();
  // 通过 #id 打开某个游戏
  if (location.hash.length > 1) { const id = decodeURIComponent(location.hash.slice(1)); if (allGames().some(g => g.id === id)) openDetail(id); }
})();
