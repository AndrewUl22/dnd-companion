// ==================== STORAGE ====================
const STORE_KEY = 'dnd_companion_state_v1';

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) { console.error('load failed', e); }
  return {
    characters: [],
    bestiary: JSON.parse(JSON.stringify(DEFAULT_BESTIARY)),
    items: JSON.parse(JSON.stringify(DEFAULT_ITEMS)),
    spells: JSON.parse(JSON.stringify(DEFAULT_SPELLS)),
    customRaces: [],
    customClasses: [],
    settings: { theme: 'dark', soundEnabled: true }
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadState();
if (!state.spells) state.spells = JSON.parse(JSON.stringify(DEFAULT_SPELLS)); // миграция для старых сохранений
if (!state.customRaces) state.customRaces = [];
if (!state.customClasses) state.customClasses = [];
if (!state.settings) state.settings = { theme: 'dark', soundEnabled: true };

function applyTheme() {
  document.body.setAttribute('data-theme', state.settings.theme || 'dark');
}
applyTheme();

let currentCharId = null;
let activeView = 'characters';
let bestiaryFilter = 'Все';
let itemsFilter = 'Все';
let spellLevelFilter = 'Все';
let spellClassFilter = 'Все';
let spellSchoolFilter = 'Все';
let spellSearchQuery = '';

// ==================== UTIL ====================
function uid(prefix) {
  return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function mod(score) {
  return Math.floor((score - 10) / 2);
}

function fmtMod(m) {
  return (m >= 0 ? '+' : '') + m;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

// ==================== NAVIGATION ====================
function switchView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.getElementById('view-' + view).classList.add('active');
  document.querySelectorAll('nav.tabbar button').forEach(b => {
    b.classList.toggle('active', b.dataset.view === view);
  });
  const titles = {
    characters: 'Персонажи', bestiary: 'Бестиарий', items: 'Предметы', spells: 'Заклинания',
    settings: 'Настройки', sheet: currentCharId ? getChar(currentCharId).name || 'Персонаж' : 'Персонаж'
  };
  document.getElementById('headerTitle').textContent = titles[view] || 'DnD Companion';
  document.getElementById('fabAdd').style.display = (view === 'sheet' || view === 'settings') ? 'none' : 'flex';

  if (view === 'characters') renderCharList();
  if (view === 'bestiary') renderBestiary();
  if (view === 'items') renderItems();
  if (view === 'spells') renderSpells();
}

document.querySelectorAll('nav.tabbar button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.getElementById('settingsBtn').addEventListener('click', () => switchView('settings'));

document.getElementById('fabAdd').addEventListener('click', () => {
  if (activeView === 'characters') openCharacterForm();
  else if (activeView === 'bestiary') openBestiaryForm();
  else if (activeView === 'items') openItemForm();
  else if (activeView === 'spells') openSpellForm();
});

// ==================== MODAL ====================
const modalBackdrop = document.getElementById('modalBackdrop');
function openModal(title, bodyHtml) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  modalBackdrop.classList.remove('hidden');
}
function closeModal() { modalBackdrop.classList.add('hidden'); }
document.getElementById('modalClose').addEventListener('click', closeModal);
modalBackdrop.addEventListener('click', (e) => { if (e.target === modalBackdrop) closeModal(); });

// ==================== AVATAR PICKER ====================
function avatarPickerHtml(id, current) {
  return `
    <button type="button" class="avatar-circle" id="${id}" data-current="${escapeAttr(current || '🧙')}">${current || '🧙'}</button>
  `;
}
function bindAvatarPicker(btnId, onChange) {
  const btn = document.getElementById(btnId);
  btn.addEventListener('click', () => {
    const grid = EMOJI_PALETTE.map(e => `<button type="button" class="emoji-choice" data-e="${e}">${e}</button>`).join('');
    openModal('Выберите иконку', `
      <div class="emoji-grid">${grid}</div>
      <label style="margin-top:10px">Или впишите свой символ/эмодзи</label>
      <input id="customEmojiInput" maxlength="4" placeholder="🐲">
      <button class="primary block" id="customEmojiConfirm">Использовать</button>
    `);
    document.querySelectorAll('.emoji-choice').forEach(b => {
      b.addEventListener('click', () => {
        btn.textContent = b.dataset.e;
        btn.dataset.current = b.dataset.e;
        onChange(b.dataset.e);
        closeModal();
      });
    });
    document.getElementById('customEmojiConfirm').addEventListener('click', () => {
      const val = document.getElementById('customEmojiInput').value.trim();
      if (!val) return;
      btn.textContent = val;
      btn.dataset.current = val;
      onChange(val);
      closeModal();
    });
  });
}

// эмодзи по умолчанию, если у записи ещё нет своего аватара
function defaultBeastEmoji(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('дракон')) return '🐉';
  if (t.includes('зверь')) return '🐺';
  if (t.includes('нежит')) return '💀';
  if (t.includes('гоблин') || t.includes('орк')) return '👹';
  if (t.includes('гуманоид')) return '🧑';
  if (t.includes('элементал')) return '🔥';
  return '❔';
}
function defaultItemEmoji(type) {
  const t = (type || '').toLowerCase();
  if (t.includes('оруж')) return '⚔️';
  if (t.includes('брон') || t.includes('щит')) return '🛡️';
  return '🎒';
}

// ==================== CHARACTERS ====================
function getChar(id) { return state.characters.find(c => c.id === id); }

function newCharacter(name) {
  return {
    id: uid('c'),
    name: name || 'Новый персонаж',
    avatar: '🧙',
    race: DEFAULT_RACES[0],
    class: DEFAULT_CLASSES[0],
    level: 1,
    background: '',
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ac: 10, speed: '30 фт', prof: 2,
    hp: { current: 10, max: 10, temp: 0 },
    inventory: [],
    knownSpells: [],
    spells: '',
    notes: ''
  };
}

function openCharacterForm() {
  openModal('Новый персонаж', `
    <label>Имя</label>
    <input id="newCharName" placeholder="Например, Тарин">
    <button class="primary block" id="createCharConfirm">Создать</button>
  `);
  document.getElementById('createCharConfirm').addEventListener('click', () => {
    const name = document.getElementById('newCharName').value.trim() || 'Новый персонаж';
    const c = newCharacter(name);
    state.characters.push(c);
    saveState();
    closeModal();
    openCharacter(c.id);
  });
}

function renderCharList() {
  const list = document.getElementById('charList');
  const empty = document.getElementById('charEmpty');
  list.innerHTML = '';
  if (state.characters.length === 0) { empty.style.display = 'block'; return; }
  empty.style.display = 'none';
  state.characters.forEach(c => {
    const el = document.createElement('div');
    el.className = 'list-item';
    el.innerHTML = `
      <div class="row" style="align-items:center;flex:none;gap:10px">
        <div class="avatar-circle small">${c.avatar || '🧙'}</div>
      </div>
      <div style="flex:1">
        <div>${escapeHtml(c.name)}</div>
        <div class="meta">${escapeHtml(c.race)} · ${escapeHtml(c.class)} · ур. ${c.level}</div>
      </div>
      <span class="badge">${c.hp.current}/${c.hp.max} ХП</span>
    `;
    el.addEventListener('click', () => openCharacter(c.id));
    list.appendChild(el);
  });
}

function openCharacter(id) {
  currentCharId = id;
  const c = getChar(id);
  if (!c.avatar) c.avatar = '🧙';
  document.getElementById('sheetName').value = c.name;
  document.getElementById('sheetAvatar').textContent = c.avatar;
  document.getElementById('sheetAvatar').dataset.current = c.avatar;
  populateRaceClassOptions();
  document.getElementById('sheetRace').value = c.race;
  document.getElementById('sheetClass').value = c.class;
  document.getElementById('sheetLevel').value = c.level;
  document.getElementById('sheetBackground').value = c.background;
  document.getElementById('sheetAC').value = c.ac;
  document.getElementById('sheetSpeed').value = c.speed;
  document.getElementById('sheetProf').value = c.prof;
  document.getElementById('hpCurrent').value = c.hp.current;
  document.getElementById('hpMax').value = c.hp.max;
  document.getElementById('hpTemp').value = c.hp.temp;
  document.getElementById('sheetSpells').value = c.spells;
  document.getElementById('sheetNotes').value = c.notes;

  renderAbilityGrid(c);
  renderSkills(c);
  renderInventory(c);
  renderCharSpells(c);
  updateTotalAC(c);
  switchView('sheet');
  playDoorCreak();
}

function populateRaceClassOptions() {
  const raceList = document.getElementById('raceOptions');
  const classList = document.getElementById('classOptions');
  raceList.innerHTML = [...DEFAULT_RACES, ...state.customRaces].map(r => `<option value="${escapeAttr(r)}">`).join('');
  classList.innerHTML = [...DEFAULT_CLASSES, ...state.customClasses].map(cl => `<option value="${escapeAttr(cl)}">`).join('');
}

function renderAbilityGrid(c) {
  const grid = document.getElementById('abilityGrid');
  const labels = { str: 'Сила', dex: 'Ловкость', con: 'Телослож.', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
  grid.innerHTML = Object.keys(labels).map(k => `
    <div class="ability-box" data-key="${k}">
      <div class="label">${labels[k]}</div>
      <div class="score">${c.abilities[k]}</div>
      <div class="mod">${fmtMod(mod(c.abilities[k]))}</div>
      <input type="number" data-ability="${k}" value="${c.abilities[k]}">
    </div>
  `).join('');
  grid.querySelectorAll('input').forEach(inp => {
    // ВАЖНО: обновляем только текст соседних элементов, не пересоздаём инпуты —
    // иначе на мобильных клавиатура схлопывается при каждом нажатии клавиши.
    inp.addEventListener('input', () => {
      const c = getChar(currentCharId);
      const key = inp.dataset.ability;
      const val = parseInt(inp.value);
      c.abilities[key] = isNaN(val) ? 0 : val;
      saveState();
      const box = inp.closest('.ability-box');
      box.querySelector('.score').textContent = c.abilities[key];
      box.querySelector('.mod').textContent = fmtMod(mod(c.abilities[key]));
      renderSkills(c);
    });
  });
}

function renderSkills(c) {
  const list = document.getElementById('skillsList');
  list.innerHTML = SKILL_LIST.map(s => {
    const m = mod(c.abilities[s.ability]) + Math.floor((c.prof || 0) * 0); // base, proficiency toggled manually not tracked per-skill in MVP
    return `<div class="skill-row"><span>${s.name}</span><span class="mod">${fmtMod(mod(c.abilities[s.ability]))}</span></div>`;
  }).join('');
}

function renderInventory(c) {
  const wrap = document.getElementById('sheetInventory');
  if (!c.inventory.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:16px 0">Инвентарь пуст</div>';
    updateTotalAC(c);
    return;
  }
  wrap.innerHTML = c.inventory.map((it, idx) => {
    const canEquip = !!it.acBonus;
    return `
    <div class="inv-item">
      <div>
        <div>${escapeHtml(it.name)} ${it.equipped ? '✅' : ''}</div>
        <div class="meta" style="color:var(--text-dim);font-size:11px">${escapeHtml(it.type || '')}${canEquip ? ' · КД +' + it.acBonus : ''}</div>
      </div>
      <div class="qty-controls row" style="flex:none;gap:4px;align-items:center">
        ${canEquip ? `<button data-idx="${idx}" data-act="equip" class="secondary" style="padding:5px 8px;font-size:11px">${it.equipped ? 'Снять' : 'Надеть'}</button>` : ''}
        <button data-idx="${idx}" data-act="dec">−</button>
        <span style="padding:0 6px">${it.qty}</span>
        <button data-idx="${idx}" data-act="inc">+</button>
        <button data-idx="${idx}" data-act="del">✕</button>
      </div>
    </div>
  `;
  }).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      const idx = parseInt(btn.dataset.idx);
      if (btn.dataset.act === 'inc') c.inventory[idx].qty++;
      if (btn.dataset.act === 'dec') c.inventory[idx].qty = Math.max(0, c.inventory[idx].qty - 1);
      if (btn.dataset.act === 'del') { c.inventory.splice(idx, 1); playChainClink(); }
      if (btn.dataset.act === 'equip') c.inventory[idx].equipped = !c.inventory[idx].equipped;
      saveState();
      renderInventory(c);
    });
  });
  updateTotalAC(c);
}

function updateTotalAC(c) {
  const bonus = (c.inventory || []).filter(i => i.equipped && i.acBonus).reduce((sum, i) => sum + i.acBonus, 0);
  const el = document.getElementById('totalACDisplay');
  if (el) el.textContent = (parseInt(c.ac) || 0) + bonus;
}

document.getElementById('addInvFromCatalog').addEventListener('click', () => {
  const options = state.items.map(it => `<option value="${it.id}">${escapeHtml(it.name)}</option>`).join('');
  openModal('Добавить предмет', `
    <label>Предмет из каталога</label>
    <select id="invCatalogSelect">${options}</select>
    <button class="primary block" id="invAddConfirm">Добавить в инвентарь</button>
  `);
  document.getElementById('invAddConfirm').addEventListener('click', () => {
    const c = getChar(currentCharId);
    const item = state.items.find(i => i.id === document.getElementById('invCatalogSelect').value);
    const existing = c.inventory.find(i => i.itemId === item.id);
    if (existing) existing.qty++;
    else c.inventory.push({ itemId: item.id, name: item.name, type: item.type, qty: 1, acBonus: item.acBonus || 0, equipped: false });
    saveState();
    renderInventory(c);
    closeModal();
  });
});

// bind sheet fields to state on change
[
  ['sheetName', 'name'], ['sheetLevel', 'level'], ['sheetBackground', 'background'],
  ['sheetAC', 'ac'], ['sheetSpeed', 'speed'], ['sheetProf', 'prof'],
  ['sheetSpells', 'spells'], ['sheetNotes', 'notes']
].forEach(([elId, field]) => {
  document.getElementById(elId).addEventListener('input', () => {
    const c = getChar(currentCharId);
    if (!c) return;
    const el = document.getElementById(elId);
    c[field] = (el.type === 'number') ? (parseInt(el.value) || 0) : el.value;
    saveState();
    if (field === 'name') renderCharList();
    if (field === 'ac') updateTotalAC(c);
  });
});
document.getElementById('sheetRace').addEventListener('change', (e) => {
  const val = e.target.value.trim();
  if (!val) return;
  getChar(currentCharId).race = val;
  if (!DEFAULT_RACES.includes(val) && !state.customRaces.includes(val)) state.customRaces.push(val);
  saveState();
  renderCharList();
});
document.getElementById('sheetClass').addEventListener('change', (e) => {
  const val = e.target.value.trim();
  if (!val) return;
  getChar(currentCharId).class = val;
  if (!DEFAULT_CLASSES.includes(val) && !state.customClasses.includes(val)) state.customClasses.push(val);
  saveState();
  renderCharList();
});
bindAvatarPicker('sheetAvatar', (emoji) => {
  const c = getChar(currentCharId);
  c.avatar = emoji;
  saveState();
  renderCharList();
});
['hpCurrent', 'hpMax', 'hpTemp'].forEach((elId, i) => {
  const field = ['current', 'max', 'temp'][i];
  document.getElementById(elId).addEventListener('input', () => {
    const c = getChar(currentCharId);
    c.hp[field] = parseInt(document.getElementById(elId).value) || 0;
    saveState();
    renderCharList();
  });
});

document.getElementById('backToList').addEventListener('click', () => switchView('characters'));
document.getElementById('deleteCharBtn').addEventListener('click', () => {
  if (!confirm('Удалить этого персонажа безвозвратно?')) return;
  state.characters = state.characters.filter(c => c.id !== currentCharId);
  saveState();
  playChainClink();
  switchView('characters');
});

// ==================== BESTIARY ====================
function renderBestiaryFilterChips() {
  const types = ['Все', ...new Set(state.bestiary.map(b => b.type))];
  const wrap = document.getElementById('bestiaryFilter');
  wrap.innerHTML = types.map(t => `<button class="chip ${t === bestiaryFilter ? 'active' : ''}" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { bestiaryFilter = chip.dataset.t; renderBestiary(); });
  });
}

function renderBestiary() {
  renderBestiaryFilterChips();
  const list = document.getElementById('bestiaryList');
  const items = state.bestiary.filter(b => bestiaryFilter === 'Все' || b.type === bestiaryFilter);
  if (!items.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
  list.innerHTML = items.map(b => `
    <div class="list-item" data-id="${b.id}">
      <div class="avatar-circle small">${b.avatar || defaultBeastEmoji(b.type)}</div>
      <div style="flex:1">
        <div>${escapeHtml(b.name)} ${b.custom ? '★' : ''}</div>
        <div class="meta">${escapeHtml(b.type)} · КО ${escapeHtml(b.cr)} · КД ${b.ac} · ХП ${escapeHtml(String(b.hp))}</div>
      </div>
      <span class="badge">${escapeHtml(b.speed)}</span>
    </div>
  `).join('');
  list.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => openBestiaryDetail(el.dataset.id));
  });
}

function openBestiaryDetail(id) {
  const b = state.bestiary.find(x => x.id === id);
  playPageTurn();
  const ab = b.abilities;
  const abRow = ab ? Object.entries(ab).map(([k, v]) => `${k.toUpperCase()} ${v} (${fmtMod(mod(v))})`).join(' · ') : '';
  const editBtn = b.custom ? `<button class="secondary block" id="editBeast">Редактировать</button><button class="danger block" id="deleteBeast">Удалить</button>` : '';
  openModal(b.name, `
    <div class="avatar-circle" style="margin:0 auto 12px">${b.avatar || defaultBeastEmoji(b.type)}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(b.type)} · КО ${escapeHtml(b.cr)}</div>
    <div style="margin-bottom:8px">КД ${b.ac} · ХП ${escapeHtml(String(b.hp))} · Скорость ${escapeHtml(b.speed)}</div>
    <div style="margin-bottom:8px;font-size:13px;color:var(--text-dim)">${abRow}</div>
    <div style="white-space:pre-wrap;margin-bottom:10px">${escapeHtml(b.description || '')}</div>
    <div style="white-space:pre-wrap;font-size:13px;background:var(--bg-elevated);padding:10px;border-radius:10px">${escapeHtml(b.actions || '')}</div>
    ${editBtn}
  `);
  if (b.custom) {
    document.getElementById('editBeast').addEventListener('click', () => openBestiaryForm(b));
    document.getElementById('deleteBeast').addEventListener('click', () => {
      if (!confirm('Удалить это существо?')) return;
      state.bestiary = state.bestiary.filter(x => x.id !== b.id);
      saveState();
      playChainClink();
      closeModal();
      renderBestiary();
    });
  }
}

function openBestiaryForm(existing) {
  const b = existing || { id: uid('b'), name: '', type: '', cr: '', ac: 10, hp: '', speed: '30 фт', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, actions: '', description: '', avatar: '', custom: true };
  openModal(existing ? 'Редактировать существо' : 'Новое существо', `
    <div style="text-align:center;margin-bottom:10px">${avatarPickerHtml('bAvatar', b.avatar || defaultBeastEmoji(b.type))}</div>
    <label>Название</label><input id="bName" value="${escapeAttr(b.name)}">
    <label>Тип</label><input id="bType" value="${escapeAttr(b.type)}" placeholder="Например, Гуманоид">
    <div class="row">
      <div><label>Класс опасности</label><input id="bCr" value="${escapeAttr(b.cr)}" placeholder="1/4"></div>
      <div><label>КД</label><input id="bAc" type="number" value="${b.ac}"></div>
    </div>
    <div class="row">
      <div><label>ХП</label><input id="bHp" value="${escapeAttr(String(b.hp))}" placeholder="2к6"></div>
      <div><label>Скорость</label><input id="bSpeed" value="${escapeAttr(b.speed)}"></div>
    </div>
    <label>Характеристики (СИЛ ЛОВ ТЕЛ ИНТ МДР ХАР через пробел)</label>
    <input id="bAbilities" value="${['str','dex','con','int','wis','cha'].map(k => b.abilities[k]).join(' ')}">
    <label>Описание</label><textarea id="bDesc">${escapeHtml(b.description)}</textarea>
    <label>Действия</label><textarea id="bActions">${escapeHtml(b.actions)}</textarea>
    <button class="primary block" id="saveBeast">Сохранить</button>
  `);
  bindAvatarPicker('bAvatar', (emoji) => { b.avatar = emoji; });
  document.getElementById('saveBeast').addEventListener('click', () => {
    b.name = document.getElementById('bName').value.trim() || 'Без имени';
    b.type = document.getElementById('bType').value.trim();
    b.cr = document.getElementById('bCr').value.trim();
    b.ac = parseInt(document.getElementById('bAc').value) || 10;
    b.hp = document.getElementById('bHp').value.trim();
    b.speed = document.getElementById('bSpeed').value.trim();
    b.avatar = document.getElementById('bAvatar').dataset.current || b.avatar;
    const nums = document.getElementById('bAbilities').value.trim().split(/\s+/).map(n => parseInt(n) || 10);
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    keys.forEach((k, i) => { b.abilities[k] = nums[i] !== undefined ? nums[i] : 10; });
    b.description = document.getElementById('bDesc').value;
    b.actions = document.getElementById('bActions').value;
    b.custom = true;
    if (!state.bestiary.find(x => x.id === b.id)) state.bestiary.push(b);
    saveState();
    closeModal();
    renderBestiary();
    showToast('Сохранено');
  });
}

// ==================== SPELLS ====================
const SPELL_LEVEL_LABELS = { 0: 'Заговор', 1: '1', 2: '2', 3: '3', 4: '4', 5: '5', 6: '6', 7: '7', 8: '8', 9: '9' };

function renderSpellFilterChips() {
  const levelWrap = document.getElementById('spellLevelFilter');
  const levels = ['Все', ...Array.from(new Set(state.spells.map(s => s.level))).sort((a, b) => a - b)];
  levelWrap.innerHTML = levels.map(l => {
    const label = l === 'Все' ? 'Все' : SPELL_LEVEL_LABELS[l];
    return `<button class="chip ${String(l) === String(spellLevelFilter) ? 'active' : ''}" data-l="${l}">${label}</button>`;
  }).join('');
  levelWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { spellLevelFilter = chip.dataset.l === 'Все' ? 'Все' : parseInt(chip.dataset.l); renderSpells(); });
  });

  const classWrap = document.getElementById('spellClassFilter');
  const classes = ['Все', ...DEFAULT_CLASSES];
  classWrap.innerHTML = classes.map(c => `<button class="chip ${c === spellClassFilter ? 'active' : ''}" data-c="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  classWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { spellClassFilter = chip.dataset.c; renderSpells(); });
  });

  const schoolWrap = document.getElementById('spellSchoolFilter');
  const schools = ['Все', ...SPELL_SCHOOLS];
  schoolWrap.innerHTML = schools.map(s => `<button class="chip ${s === spellSchoolFilter ? 'active' : ''}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
  schoolWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { spellSchoolFilter = chip.dataset.s; renderSpells(); });
  });
}

function filteredSpells() {
  return state.spells.filter(s => {
    if (spellLevelFilter !== 'Все' && s.level !== spellLevelFilter) return false;
    if (spellClassFilter !== 'Все' && !s.classes.includes(spellClassFilter)) return false;
    if (spellSchoolFilter !== 'Все' && s.school !== spellSchoolFilter) return false;
    if (spellSearchQuery && !s.name.toLowerCase().includes(spellSearchQuery.toLowerCase())) return false;
    return true;
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
}

function renderSpells() {
  renderSpellFilterChips();
  const list = document.getElementById('spellsList');
  const items = filteredSpells();
  if (!items.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
  list.innerHTML = items.map(s => `
    <div class="list-item" data-id="${s.id}">
      <div>
        <div>${escapeHtml(s.name)} ${s.custom ? '★' : ''}</div>
        <div class="meta">${escapeHtml(s.school)} · ${s.concentration ? 'Конц. · ' : ''}${s.ritual ? 'Ритуал · ' : ''}${escapeHtml(s.classes.join(', '))}</div>
      </div>
      <span class="badge">${s.level === 0 ? 'Загов.' : 'Ур. ' + s.level}</span>
    </div>
  `).join('');
  list.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => openSpellDetail(el.dataset.id));
  });
}

document.getElementById('spellSearch').addEventListener('input', (e) => {
  spellSearchQuery = e.target.value;
  renderSpells();
});

function openSpellDetail(id) {
  const s = state.spells.find(x => x.id === id);
  playPageTurn();
  const editBtn = s.custom ? `<button class="secondary block" id="editSpell">Редактировать</button><button class="danger block" id="deleteSpell">Удалить</button>` : '';
  openModal(s.name, `
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px">${escapeHtml(s.school)} · ${s.level === 0 ? 'Заговор' : 'Уровень ' + s.level}${s.ritual ? ' · Ритуал' : ''}</div>
    <div class="row" style="margin-bottom:8px;font-size:13px">
      <div>⏱ ${escapeHtml(s.time)}</div>
      <div>🎯 ${escapeHtml(s.range)}</div>
    </div>
    <div class="row" style="margin-bottom:8px;font-size:13px">
      <div>🗣 ${escapeHtml(s.components)}</div>
      <div>⏳ ${escapeHtml(s.duration)}${s.concentration ? ' (конц.)' : ''}</div>
    </div>
    <div class="meta" style="margin-bottom:8px">Классы: ${escapeHtml(s.classes.join(', '))}</div>
    <div style="white-space:pre-wrap">${escapeHtml(s.description || '')}</div>
    ${editBtn}
  `);
  if (s.custom) {
    document.getElementById('editSpell').addEventListener('click', () => openSpellForm(s));
    document.getElementById('deleteSpell').addEventListener('click', () => {
      if (!confirm('Удалить это заклинание?')) return;
      state.spells = state.spells.filter(x => x.id !== s.id);
      saveState();
      closeModal();
      renderSpells();
    });
  }
}

function openSpellForm(existing) {
  const s = existing || { id: uid('sp'), name: '', level: 1, school: SPELL_SCHOOLS[0], time: '1 действие', range: '', components: 'В, С', duration: 'Мгновенно', concentration: false, ritual: false, classes: [], description: '', custom: true };
  const levelOptions = Object.keys(SPELL_LEVEL_LABELS).map(l => `<option value="${l}" ${String(s.level) === l ? 'selected' : ''}>${SPELL_LEVEL_LABELS[l]}</option>`).join('');
  const schoolOptions = SPELL_SCHOOLS.map(sc => `<option ${sc === s.school ? 'selected' : ''}>${sc}</option>`).join('');
  const classChips = DEFAULT_CLASSES.map(c => `<button type="button" class="chip ${s.classes.includes(c) ? 'active' : ''}" data-c="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('');
  openModal(existing ? 'Редактировать заклинание' : 'Новое заклинание', `
    <label>Название</label><input id="spName" value="${escapeAttr(s.name)}">
    <div class="row">
      <div><label>Уровень</label><select id="spLevel">${levelOptions}</select></div>
      <div><label>Школа</label><select id="spSchool">${schoolOptions}</select></div>
    </div>
    <div class="row">
      <div><label>Время накладывания</label><input id="spTime" value="${escapeAttr(s.time)}"></div>
      <div><label>Дистанция</label><input id="spRange" value="${escapeAttr(s.range)}"></div>
    </div>
    <div class="row">
      <div><label>Компоненты</label><input id="spComponents" value="${escapeAttr(s.components)}"></div>
      <div><label>Длительность</label><input id="spDuration" value="${escapeAttr(s.duration)}"></div>
    </div>
    <div class="row" style="margin-bottom:10px">
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text)"><input type="checkbox" id="spConc" style="width:auto;margin:0" ${s.concentration ? 'checked' : ''}> Концентрация</label>
      <label style="display:flex;align-items:center;gap:6px;font-size:13px;color:var(--text)"><input type="checkbox" id="spRitual" style="width:auto;margin:0" ${s.ritual ? 'checked' : ''}> Ритуал</label>
    </div>
    <label>Классы (нажмите, чтобы отметить)</label>
    <div class="chip-row" id="spClassChips">${classChips}</div>
    <label>Описание</label><textarea id="spDesc">${escapeHtml(s.description)}</textarea>
    <button class="primary block" id="saveSpell">Сохранить</button>
  `);
  const selectedClasses = new Set(s.classes);
  document.getElementById('spClassChips').querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const c = chip.dataset.c;
      if (selectedClasses.has(c)) { selectedClasses.delete(c); chip.classList.remove('active'); }
      else { selectedClasses.add(c); chip.classList.add('active'); }
    });
  });
  document.getElementById('saveSpell').addEventListener('click', () => {
    s.name = document.getElementById('spName').value.trim() || 'Без названия';
    s.level = parseInt(document.getElementById('spLevel').value);
    s.school = document.getElementById('spSchool').value;
    s.time = document.getElementById('spTime').value.trim();
    s.range = document.getElementById('spRange').value.trim();
    s.components = document.getElementById('spComponents').value.trim();
    s.duration = document.getElementById('spDuration').value.trim();
    s.concentration = document.getElementById('spConc').checked;
    s.ritual = document.getElementById('spRitual').checked;
    s.classes = Array.from(selectedClasses);
    s.description = document.getElementById('spDesc').value;
    s.custom = true;
    if (!state.spells.find(x => x.id === s.id)) state.spells.push(s);
    saveState();
    closeModal();
    renderSpells();
    showToast('Сохранено');
  });
}

// -- привязка заклинаний к персонажу --
function renderCharSpells(c) {
  const wrap = document.getElementById('sheetSpellsKnown');
  if (!c.knownSpells) c.knownSpells = [];
  if (!c.knownSpells.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:16px 0">Заклинания не добавлены</div>';
    return;
  }
  wrap.innerHTML = c.knownSpells.map((spellId, idx) => {
    const s = state.spells.find(x => x.id === spellId);
    if (!s) return '';
    return `
      <div class="inv-item">
        <div class="spell-tap" data-open="${s.id}" style="cursor:pointer">
          <div>${escapeHtml(s.name)} <span style="color:var(--text-dim);font-size:11px">▸ подробнее</span></div>
          <div class="meta" style="color:var(--text-dim);font-size:11px">${s.level === 0 ? 'Заговор' : 'Ур. ' + s.level} · ${escapeHtml(s.school)}</div>
        </div>
        <button data-idx="${idx}" data-act="del">✕</button>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('[data-open]').forEach(el => {
    el.addEventListener('click', () => openSpellDetail(el.dataset.open));
  });
  wrap.querySelectorAll('button[data-act="del"]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      c.knownSpells.splice(parseInt(btn.dataset.idx), 1);
      saveState();
      renderCharSpells(c);
    });
  });
}

document.getElementById('addSpellFromCatalog').addEventListener('click', () => {
  const options = state.spells
    .slice()
    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'))
    .map(s => `<option value="${s.id}">${s.level === 0 ? 'Заговор' : 'Ур.' + s.level} — ${escapeHtml(s.name)}</option>`)
    .join('');
  openModal('Добавить заклинание', `
    <label>Заклинание из каталога</label>
    <select id="spellCatalogSelect">${options}</select>
    <button class="primary block" id="spellAddConfirm">Добавить персонажу</button>
  `);
  document.getElementById('spellAddConfirm').addEventListener('click', () => {
    const c = getChar(currentCharId);
    const spellId = document.getElementById('spellCatalogSelect').value;
    if (!c.knownSpells) c.knownSpells = [];
    if (!c.knownSpells.includes(spellId)) c.knownSpells.push(spellId);
    saveState();
    renderCharSpells(c);
    closeModal();
  });
});

// ==================== ITEMS ====================
function renderItemsFilterChips() {
  const types = ['Все', ...new Set(state.items.map(i => i.type))];
  const wrap = document.getElementById('itemsFilter');
  wrap.innerHTML = types.map(t => `<button class="chip ${t === itemsFilter ? 'active' : ''}" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { itemsFilter = chip.dataset.t; renderItems(); });
  });
}

function renderItems() {
  renderItemsFilterChips();
  const list = document.getElementById('itemsList');
  const items = state.items.filter(i => itemsFilter === 'Все' || i.type === itemsFilter);
  if (!items.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
  list.innerHTML = items.map(it => `
    <div class="list-item" data-id="${it.id}">
      <div class="avatar-circle small">${it.avatar || defaultItemEmoji(it.type)}</div>
      <div style="flex:1">
        <div>${escapeHtml(it.name)} ${it.custom ? '★' : ''}</div>
        <div class="meta">${escapeHtml(it.type)} · ${escapeHtml(it.weight || '')}</div>
      </div>
      <span class="badge">${escapeHtml(it.cost || '')}</span>
    </div>
  `).join('');
  list.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => openItemDetail(el.dataset.id));
  });
}

function openItemDetail(id) {
  const it = state.items.find(x => x.id === id);
  playPageTurn();
  const editBtn = it.custom ? `<button class="secondary block" id="editItem">Редактировать</button><button class="danger block" id="deleteItem">Удалить</button>` : '';
  openModal(it.name, `
    <div class="avatar-circle" style="margin:0 auto 12px">${it.avatar || defaultItemEmoji(it.type)}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(it.type)} · ${escapeHtml(it.weight || '')} · ${escapeHtml(it.cost || '')}</div>
    ${it.acBonus ? `<div style="margin-bottom:8px">🛡 Бонус к КД при экипировке: +${it.acBonus}</div>` : ''}
    <div style="white-space:pre-wrap">${escapeHtml(it.properties || '')}</div>
    ${editBtn}
  `);
  if (it.custom) {
    document.getElementById('editItem').addEventListener('click', () => openItemForm(it));
    document.getElementById('deleteItem').addEventListener('click', () => {
      if (!confirm('Удалить этот предмет?')) return;
      state.items = state.items.filter(x => x.id !== it.id);
      saveState();
      playChainClink();
      closeModal();
      renderItems();
    });
  }
}

function openItemForm(existing) {
  const it = existing || { id: uid('i'), name: '', type: '', weight: '', cost: '', properties: '', acBonus: 0, avatar: '', custom: true };
  openModal(existing ? 'Редактировать предмет' : 'Новый предмет', `
    <div style="text-align:center;margin-bottom:10px">${avatarPickerHtml('itAvatar', it.avatar || defaultItemEmoji(it.type))}</div>
    <label>Название</label><input id="itName" value="${escapeAttr(it.name)}">
    <label>Тип</label><input id="itType" value="${escapeAttr(it.type)}" placeholder="Оружие / Броня / Снаряжение">
    <div class="row">
      <div><label>Вес</label><input id="itWeight" value="${escapeAttr(it.weight)}"></div>
      <div><label>Цена</label><input id="itCost" value="${escapeAttr(it.cost)}"></div>
    </div>
    <label>Бонус к КД при экипировке (0, если не влияет)</label>
    <input id="itAcBonus" type="number" value="${it.acBonus || 0}">
    <label>Свойства / описание</label><textarea id="itProps">${escapeHtml(it.properties)}</textarea>
    <button class="primary block" id="saveItem">Сохранить</button>
  `);
  bindAvatarPicker('itAvatar', (emoji) => { it.avatar = emoji; });
  document.getElementById('saveItem').addEventListener('click', () => {
    it.name = document.getElementById('itName').value.trim() || 'Без названия';
    it.type = document.getElementById('itType').value.trim() || 'Снаряжение';
    it.weight = document.getElementById('itWeight').value.trim();
    it.cost = document.getElementById('itCost').value.trim();
    it.acBonus = parseInt(document.getElementById('itAcBonus').value) || 0;
    it.avatar = document.getElementById('itAvatar').dataset.current || it.avatar;
    it.properties = document.getElementById('itProps').value;
    it.custom = true;
    if (!state.items.find(x => x.id === it.id)) state.items.push(it);
    saveState();
    closeModal();
    renderItems();
    showToast('Сохранено');
  });
}

// ==================== IMPORT / EXPORT ====================
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'dnd-companion-export-' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  showToast('Файл сохранён');
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(reader.result);
      // merge: append characters, merge bestiary/items by id (avoid dup)
      if (Array.isArray(incoming.characters)) {
        incoming.characters.forEach(c => {
          if (!state.characters.find(x => x.id === c.id)) state.characters.push(c);
        });
      }
      if (Array.isArray(incoming.bestiary)) {
        incoming.bestiary.forEach(b => {
          if (!state.bestiary.find(x => x.id === b.id)) state.bestiary.push(b);
        });
      }
      if (Array.isArray(incoming.items)) {
        incoming.items.forEach(i => {
          if (!state.items.find(x => x.id === i.id)) state.items.push(i);
        });
      }
      if (Array.isArray(incoming.spells)) {
        incoming.spells.forEach(sp => {
          if (!state.spells.find(x => x.id === sp.id)) state.spells.push(sp);
        });
      }
      if (Array.isArray(incoming.customRaces)) {
        incoming.customRaces.forEach(r => { if (!state.customRaces.includes(r)) state.customRaces.push(r); });
      }
      if (Array.isArray(incoming.customClasses)) {
        incoming.customClasses.forEach(cl => { if (!state.customClasses.includes(cl)) state.customClasses.push(cl); });
      }
      saveState();
      showToast('Импорт завершён');
      renderCharList(); renderBestiary(); renderItems(); renderSpells();
    } catch (err) {
      alert('Не удалось прочитать файл: ' + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
});

document.getElementById('resetBtn').addEventListener('click', () => {
  if (!confirm('Это удалит всех персонажей и весь добавленный контент. Продолжить?')) return;
  localStorage.removeItem(STORE_KEY);
  state = loadState();
  applyTheme();
  showToast('Данные очищены');
  switchView('characters');
});

// ==================== THEME & SOUND SETTINGS ====================
function renderThemeChips() {
  const wrap = document.getElementById('themeChips');
  wrap.innerHTML = THEMES.map(t => `<button class="chip ${state.settings.theme === t.id ? 'active' : ''}" data-theme="${t.id}">${escapeHtml(t.label)}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      state.settings.theme = chip.dataset.theme;
      saveState();
      applyTheme();
      renderThemeChips();
    });
  });
}
renderThemeChips();

const soundToggle = document.getElementById('soundToggle');
soundToggle.checked = state.settings.soundEnabled !== false;
soundToggle.addEventListener('change', () => {
  state.settings.soundEnabled = soundToggle.checked;
  saveState();
  if (soundToggle.checked) playChainClink();
});

// ==================== DICE ROLLER ====================
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
let diceHistory = [];

function openDiceRoller() {
  renderDiceModal();
}

function renderDiceModal() {
  const buttons = DICE_TYPES.map(d => `<button type="button" class="chip dice-btn" data-d="${d}" style="font-size:15px;padding:12px 16px">d${d}</button>`).join('');
  const historyHtml = diceHistory.length
    ? diceHistory.slice(0, 10).map(h => `<div class="skill-row"><span>d${h.die}</span><span class="mod">${h.result}</span></div>`).join('')
    : '<div class="empty-state" style="padding:10px 0">Пока не было бросков</div>';
  openModal('Кубики', `
    <div class="chip-row" id="diceButtons" style="flex-wrap:wrap">${buttons}</div>
    <div id="diceResultBig" style="text-align:center;font-size:48px;font-weight:700;color:var(--accent);margin:16px 0">—</div>
    <div class="section-title" style="margin-top:4px">История</div>
    <div id="diceHistoryList">${historyHtml}</div>
  `);
  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const die = parseInt(btn.dataset.d);
      const result = 1 + Math.floor(Math.random() * die);
      diceHistory.unshift({ die, result });
      document.getElementById('diceResultBig').textContent = result;
      document.getElementById('diceHistoryList').innerHTML = diceHistory.slice(0, 10).map(h => `<div class="skill-row"><span>d${h.die}</span><span class="mod">${h.result}</span></div>`).join('');
      playDiceRoll();
    });
  });
}

document.getElementById('diceBtn').addEventListener('click', openDiceRoller);

// ==================== HELPERS ====================
function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, s => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[s]));
}
function escapeAttr(str) { return escapeHtml(str); }

// ==================== SPLASH SCREEN ====================
(function () {
  const splash = document.getElementById('splash');
  if (!splash) return;
  // Звук проигрывается только если браузер уже разрешил аудио (обычно после первого
  // взаимодействия с приложением, например, повторного открытия PWA) — это ограничение
  // самих браузеров, а не приложения.
  try {
    const ctx = getAudioCtx();
    if (ctx.state === 'running') playSplashChime();
  } catch (e) { /* тихо игнорируем */ }
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 550);
  }, 1900);
  // На случай первого тапа — "разбудить" звук на будущее
  document.addEventListener('pointerdown', function unlockAudioOnce() {
    try { getAudioCtx(); } catch (e) {}
    document.removeEventListener('pointerdown', unlockAudioOnce);
  }, { once: true });
})();

// ==================== INIT ====================
renderCharList();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
