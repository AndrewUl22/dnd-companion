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
let bestiaryCrFilter = 'Все';
let bestiarySizeFilter = 'Все';
let bestiaryHabitatFilter = 'Все';
let itemsFilter = 'Все';
let itemsRarityFilter = 'Все';
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

// Отдельный, независимый оверлей для выбора аватарки — открывается ПОВЕРХ формы,
// не уничтожая её (иначе, например, форма "новый предмет" терялась при выборе фото)
const avatarModalBackdrop = document.getElementById('avatarModalBackdrop');
function openAvatarModal(title, bodyHtml) {
  document.getElementById('avatarModalTitle').textContent = title;
  document.getElementById('avatarModalBody').innerHTML = bodyHtml;
  avatarModalBackdrop.classList.remove('hidden');
}
function closeAvatarModal() { avatarModalBackdrop.classList.add('hidden'); }
document.getElementById('avatarModalClose').addEventListener('click', closeAvatarModal);
avatarModalBackdrop.addEventListener('click', (e) => { if (e.target === avatarModalBackdrop) closeAvatarModal(); });

// ==================== AVATAR PICKER ====================
// Аватар может быть либо эмодзи (record.avatar), либо загруженной картинкой (record.avatarImage, dataURL).
// Картинка, если есть, имеет приоритет над эмодзи.
function avatarInnerHtml(record, fallbackEmoji) {
  if (record && record.avatarImage) return `<img src="${record.avatarImage}" alt="">`;
  return escapeHtml((record && record.avatar) || fallbackEmoji || '🧙');
}
function avatarPickerHtml(id, record, fallbackEmoji, large) {
  return `<button type="button" class="avatar-circle${large ? ' large' : ''}" id="${id}">${avatarInnerHtml(record, fallbackEmoji)}</button>`;
}
function resizeImageFile(file, maxDim, cb) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > h && w > maxDim) { h = Math.round(h * maxDim / w); w = maxDim; }
      else if (h > maxDim) { w = Math.round(w * maxDim / h); h = maxDim; }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      cb(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}
function bindAvatarPicker(btnId, recordOrGetter, fallbackEmoji, onChange) {
  const btn = document.getElementById(btnId);
  const getRecord = () => (typeof recordOrGetter === 'function') ? recordOrGetter() : recordOrGetter;
  btn.addEventListener('click', () => {
    const record = getRecord();
    const grid = EMOJI_PALETTE.map(e => `<button type="button" class="emoji-choice" data-e="${e}">${e}</button>`).join('');
    openAvatarModal('Выберите иконку', `
      <button class="primary block" id="uploadPhotoBtn">📷 Загрузить фото (PNG/JPG)</button>
      <input type="file" id="uploadPhotoInput" accept="image/*" style="display:none">
      ${record && record.avatarImage ? '<button class="secondary block" id="removePhotoBtn">Убрать фото, вернуть эмодзи</button>' : ''}
      <div class="section-title" style="margin-top:10px">Или выберите эмодзи</div>
      <div class="emoji-grid">${grid}</div>
      <label style="margin-top:10px">Или впишите свой символ/эмодзи</label>
      <input id="customEmojiInput" maxlength="4" placeholder="🐲">
      <button class="primary block" id="customEmojiConfirm">Использовать</button>
    `);
    document.getElementById('uploadPhotoBtn').addEventListener('click', () => document.getElementById('uploadPhotoInput').click());
    document.getElementById('uploadPhotoInput').addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      resizeImageFile(file, 300, (dataUrl) => {
        const rec = getRecord();
        rec.avatarImage = dataUrl;
        btn.innerHTML = avatarInnerHtml(rec, fallbackEmoji);
        onChange(rec);
        closeAvatarModal();
        showToast('Фото добавлено');
      });
    });
    const removeBtn = document.getElementById('removePhotoBtn');
    if (removeBtn) removeBtn.addEventListener('click', () => {
      const rec = getRecord();
      rec.avatarImage = null;
      btn.innerHTML = avatarInnerHtml(rec, fallbackEmoji);
      onChange(rec);
      closeAvatarModal();
    });
    document.querySelectorAll('.emoji-choice').forEach(b => {
      b.addEventListener('click', () => {
        const rec = getRecord();
        rec.avatar = b.dataset.e;
        rec.avatarImage = null;
        btn.innerHTML = avatarInnerHtml(rec, fallbackEmoji);
        onChange(rec);
        closeAvatarModal();
      });
    });
    document.getElementById('customEmojiConfirm').addEventListener('click', () => {
      const val = document.getElementById('customEmojiInput').value.trim();
      if (!val) return;
      const rec = getRecord();
      rec.avatar = val;
      rec.avatarImage = null;
      btn.innerHTML = avatarInnerHtml(rec, fallbackEmoji);
      onChange(rec);
      closeAvatarModal();
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
    subclass: '',
    level: 1,
    xp: 0,
    background: '',
    alignment: '',
    size: 'Средний',
    inspiration: false,
    abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    ac: 10, speed: '30 фт', prof: 2,
    hp: { current: 10, max: 10, temp: 0 },
    hitDice: { total: '1к8', used: 0 },
    deathSaves: { successes: 0, failures: 0 },
    saveProf: { str: false, dex: false, con: false, int: false, wis: false, cha: false },
    skillProf: {},
    armorProf: { light: false, medium: false, heavy: false, shield: false },
    weaponProf: '', toolProf: '', languages: '',
    attacks: [],
    classFeatures: '', racialTraits: '', feats: '',
    appearance: '', backstory: '',
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
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
        <div class="avatar-circle small">${avatarInnerHtml(c, '🧙')}</div>
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

function migrateChar(c) {
  if (!c.subclass) c.subclass = c.subclass || '';
  if (c.xp === undefined) c.xp = 0;
  if (!c.alignment) c.alignment = c.alignment || '';
  if (!c.size) c.size = 'Средний';
  if (c.inspiration === undefined) c.inspiration = false;
  if (!c.hitDice) c.hitDice = { total: '', used: 0 };
  if (!c.deathSaves) c.deathSaves = { successes: 0, failures: 0 };
  if (!c.saveProf) c.saveProf = { str: false, dex: false, con: false, int: false, wis: false, cha: false };
  if (!c.skillProf) c.skillProf = {};
  if (!c.armorProf) c.armorProf = { light: false, medium: false, heavy: false, shield: false };
  if (c.weaponProf === undefined) c.weaponProf = '';
  if (c.toolProf === undefined) c.toolProf = '';
  if (c.languages === undefined) c.languages = '';
  if (!c.attacks) c.attacks = [];
  if (c.classFeatures === undefined) c.classFeatures = '';
  if (c.racialTraits === undefined) c.racialTraits = '';
  if (c.feats === undefined) c.feats = '';
  if (c.appearance === undefined) c.appearance = '';
  if (c.backstory === undefined) c.backstory = '';
  if (!c.currency) c.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  return c;
}

function openCharacter(id) {
  currentCharId = id;
  const c = migrateChar(getChar(id));
  if (!c.avatar) c.avatar = '🧙';
  document.getElementById('sheetName').value = c.name;
  document.getElementById('sheetAvatar').innerHTML = avatarInnerHtml(c, '🧙');
  populateRaceClassOptions();
  document.getElementById('sheetRace').value = c.race;
  document.getElementById('sheetClass').value = c.class;
  document.getElementById('sheetSubclass').value = c.subclass;
  document.getElementById('sheetLevel').value = c.level;
  document.getElementById('sheetXP').value = c.xp;
  document.getElementById('sheetBackground').value = c.background;
  document.getElementById('sheetAlignment').value = c.alignment;
  document.getElementById('sheetSize').value = c.size;
  document.getElementById('sheetAC').value = c.ac;
  document.getElementById('sheetSpeed').value = c.speed;
  document.getElementById('sheetProf').value = c.prof;
  document.getElementById('sheetInspiration').checked = c.inspiration;
  document.getElementById('hpCurrent').value = c.hp.current;
  document.getElementById('hpMax').value = c.hp.max;
  document.getElementById('hpTemp').value = c.hp.temp;
  document.getElementById('sheetHitDiceTotal').value = c.hitDice.total;
  document.getElementById('sheetHitDiceUsed').value = c.hitDice.used;
  document.getElementById('sheetWeaponProf').value = c.weaponProf;
  document.getElementById('sheetToolProf').value = c.toolProf;
  document.getElementById('sheetLanguages').value = c.languages;
  document.getElementById('sheetClassFeatures').value = c.classFeatures;
  document.getElementById('sheetRacialTraits').value = c.racialTraits;
  document.getElementById('sheetFeats').value = c.feats;
  document.getElementById('sheetAppearance').value = c.appearance;
  document.getElementById('sheetBackstory').value = c.backstory;
  document.getElementById('sheetSpells').value = c.spells;
  document.getElementById('sheetNotes').value = c.notes;
  document.getElementById('cCp').value = c.currency.cp;
  document.getElementById('cSp').value = c.currency.sp;
  document.getElementById('cEp').value = c.currency.ep;
  document.getElementById('cGp').value = c.currency.gp;
  document.getElementById('cPp').value = c.currency.pp;

  renderAbilityGrid(c);
  renderSaves(c);
  renderSkills(c);
  renderArmorProfChips(c);
  renderDeathSaves(c);
  renderAttacks(c);
  renderInventory(c);
  renderCharSpells(c);
  updateTotalAC(c);
  updateComputedStats(c);
  switchView('sheet');
  playDoorCreak();
}

function updateComputedStats(c) {
  const initEl = document.getElementById('initiativeDisplay');
  if (initEl) initEl.textContent = fmtMod(mod(c.abilities.dex));
  const perc = SKILL_LIST.find(s => s.name === 'Восприятие');
  const passive = 10 + mod(c.abilities[perc.ability]) + (c.skillProf['Восприятие'] ? (parseInt(c.prof) || 0) : 0);
  const passEl = document.getElementById('passivePerceptionDisplay');
  if (passEl) passEl.textContent = passive;
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
      renderSaves(c);
      updateComputedStats(c);
    });
  });
}

function renderSaves(c) {
  const wrap = document.getElementById('savesList');
  const labels = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', int: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
  wrap.innerHTML = Object.keys(labels).map(k => {
    const prof = !!c.saveProf[k];
    const total = mod(c.abilities[k]) + (prof ? (parseInt(c.prof) || 0) : 0);
    return `<div class="skill-row"><span><input type="checkbox" data-save="${k}" ${prof ? 'checked' : ''} style="width:auto;margin-right:6px;vertical-align:middle">${labels[k]}</span><span class="mod">${fmtMod(total)}</span></div>`;
  }).join('');
  wrap.querySelectorAll('input[data-save]').forEach(chk => {
    chk.addEventListener('change', () => {
      const c = getChar(currentCharId);
      c.saveProf[chk.dataset.save] = chk.checked;
      saveState();
      renderSaves(c);
    });
  });
}

function renderArmorProfChips(c) {
  const wrap = document.getElementById('armorProfChips');
  const labels = { light: 'Лёгкие', medium: 'Средние', heavy: 'Тяжёлые', shield: 'Щит' };
  wrap.innerHTML = Object.keys(labels).map(k => `<button type="button" class="chip ${c.armorProf[k] ? 'active' : ''}" data-a="${k}">${labels[k]}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const c = getChar(currentCharId);
      c.armorProf[chip.dataset.a] = !c.armorProf[chip.dataset.a];
      saveState();
      renderArmorProfChips(c);
    });
  });
}

function renderDeathSaves(c) {
  const succWrap = document.getElementById('deathSuccessRow');
  const failWrap = document.getElementById('deathFailRow');
  succWrap.innerHTML = [1, 2, 3].map(i => `<button type="button" class="death-dot ${c.deathSaves.successes >= i ? 'filled success' : ''}" data-type="s" data-n="${i}"></button>`).join('');
  failWrap.innerHTML = [1, 2, 3].map(i => `<button type="button" class="death-dot ${c.deathSaves.failures >= i ? 'filled fail' : ''}" data-type="f" data-n="${i}"></button>`).join('');
  [...succWrap.querySelectorAll('.death-dot'), ...failWrap.querySelectorAll('.death-dot')].forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      const n = parseInt(btn.dataset.n);
      const key = btn.dataset.type === 's' ? 'successes' : 'failures';
      c.deathSaves[key] = (c.deathSaves[key] === n) ? n - 1 : n;
      saveState();
      renderDeathSaves(c);
    });
  });
}

// ==================== ATTACKS ====================
function renderAttacks(c) {
  const wrap = document.getElementById('attacksList');
  if (!c.attacks.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:16px 0">Атаки не добавлены</div>';
    return;
  }
  wrap.innerHTML = c.attacks.map((a, idx) => `
    <div class="inv-item" data-idx="${idx}">
      <div>
        <div>${escapeHtml(a.name)}</div>
        <div class="meta" style="color:var(--text-dim);font-size:11px">Бонус ${escapeHtml(a.bonus)} · ${escapeHtml(a.damage)}${a.notes ? ' · ' + escapeHtml(a.notes) : ''}</div>
      </div>
      <div class="row" style="flex:none;gap:4px">
        <button data-idx="${idx}" data-act="edit" class="secondary" style="padding:5px 8px;font-size:11px">✎</button>
        <button data-idx="${idx}" data-act="del">✕</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      const idx = parseInt(btn.dataset.idx);
      if (btn.dataset.act === 'del') { c.attacks.splice(idx, 1); saveState(); renderAttacks(c); playChainClink(); }
      if (btn.dataset.act === 'edit') openAttackForm(c, idx);
    });
  });
}

document.getElementById('addAttackBtn').addEventListener('click', () => openAttackForm(getChar(currentCharId)));

function openAttackForm(c, idx) {
  const existing = idx !== undefined ? c.attacks[idx] : null;
  const a = existing || { name: '', bonus: '+0', damage: '', notes: '' };
  openModal(existing ? 'Редактировать атаку' : 'Новая атака', `
    <label>Название</label><input id="atkName" value="${escapeAttr(a.name)}" placeholder="Длинный меч">
    <label>Бонус атаки/СЛ</label><input id="atkBonus" value="${escapeAttr(a.bonus)}" placeholder="+5">
    <label>Урон и эффект</label><input id="atkDamage" value="${escapeAttr(a.damage)}" placeholder="1к8+3 рубящего">
    <label>Заметки</label><input id="atkNotes" value="${escapeAttr(a.notes)}">
    <button class="primary block" id="saveAttack">Сохранить</button>
  `);
  document.getElementById('saveAttack').addEventListener('click', () => {
    const newA = {
      name: document.getElementById('atkName').value.trim() || 'Атака',
      bonus: document.getElementById('atkBonus').value.trim(),
      damage: document.getElementById('atkDamage').value.trim(),
      notes: document.getElementById('atkNotes').value.trim()
    };
    if (existing) c.attacks[idx] = newA; else c.attacks.push(newA);
    saveState();
    closeModal();
    renderAttacks(c);
  });
}

function renderSkills(c) {
  const list = document.getElementById('skillsList');
  list.innerHTML = SKILL_LIST.map(s => {
    const prof = !!c.skillProf[s.name];
    const total = mod(c.abilities[s.ability]) + (prof ? (parseInt(c.prof) || 0) : 0);
    return `<div class="skill-row"><span><input type="checkbox" data-skill="${escapeAttr(s.name)}" ${prof ? 'checked' : ''} style="width:auto;margin-right:6px;vertical-align:middle">${s.name} <span style="color:var(--text-dim);font-size:11px">(${s.ability})</span></span><span class="mod">${fmtMod(total)}</span></div>`;
  }).join('');
  list.querySelectorAll('input[data-skill]').forEach(chk => {
    chk.addEventListener('change', () => {
      const c = getChar(currentCharId);
      c.skillProf[chk.dataset.skill] = chk.checked;
      saveState();
      renderSkills(c);
      updateComputedStats(c);
    });
  });
}

function renderInventory(c) {
  const wrap = document.getElementById('sheetInventory');
  if (!c.inventory.length) {
    wrap.innerHTML = '<div class="empty-state" style="padding:16px 0">Инвентарь пуст</div>';
    updateTotalAC(c);
    return;
  }
  wrap.innerHTML = c.inventory.map((it, idx) => {
    const canEquip = !!it.acBonus || !!it.atkBonus;
    const bonusParts = [];
    if (it.acBonus) bonusParts.push('КД +' + it.acBonus);
    if (it.atkBonus) bonusParts.push('Атака +' + it.atkBonus);
    return `
    <div class="inv-item">
      <div>
        <div>${escapeHtml(it.name)} ${it.equipped ? '✅' : ''}</div>
        <div class="meta" style="color:var(--text-dim);font-size:11px">${escapeHtml(it.type || '')}${bonusParts.length ? ' · ' + bonusParts.join(' · ') : ''}</div>
      </div>
      <div class="qty-controls row" style="flex:none;gap:4px;align-items:center">
        ${canEquip ? `<button data-idx="${idx}" data-act="equip" class="equip-btn ${it.equipped ? 'is-on' : ''}" title="${it.equipped ? 'Снять' : 'Надеть'}">${it.equipped ? '✓' : '⭘'}</button>` : ''}
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
  const equipped = (c.inventory || []).filter(i => i.equipped);
  const acBonus = equipped.reduce((sum, i) => sum + (i.acBonus || 0), 0);
  const atkBonus = equipped.reduce((sum, i) => sum + (i.atkBonus || 0), 0);
  const el = document.getElementById('totalACDisplay');
  if (el) el.textContent = (parseInt(c.ac) || 0) + acBonus;
  const atkEl = document.getElementById('equipAtkBonusDisplay');
  if (atkEl) atkEl.textContent = atkBonus > 0 ? ('Бонус атаки от снаряжения: +' + atkBonus) : '';
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
    else c.inventory.push({ itemId: item.id, name: item.name, type: item.type, qty: 1, acBonus: item.acBonus || 0, atkBonus: item.atkBonus || 0, equipped: false });
    saveState();
    renderInventory(c);
    closeModal();
  });
});

// bind sheet fields to state on change
[
  ['sheetName', 'name'], ['sheetLevel', 'level'], ['sheetBackground', 'background'],
  ['sheetAC', 'ac'], ['sheetSpeed', 'speed'], ['sheetProf', 'prof'],
  ['sheetSpells', 'spells'], ['sheetNotes', 'notes'],
  ['sheetSubclass', 'subclass'], ['sheetXP', 'xp'], ['sheetAlignment', 'alignment'],
  ['sheetHitDiceTotal', ['hitDice', 'total']], ['sheetHitDiceUsed', ['hitDice', 'used']],
  ['sheetWeaponProf', 'weaponProf'], ['sheetToolProf', 'toolProf'], ['sheetLanguages', 'languages'],
  ['sheetClassFeatures', 'classFeatures'], ['sheetRacialTraits', 'racialTraits'], ['sheetFeats', 'feats'],
  ['sheetAppearance', 'appearance'], ['sheetBackstory', 'backstory']
].forEach(([elId, field]) => {
  document.getElementById(elId).addEventListener('input', () => {
    const c = getChar(currentCharId);
    if (!c) return;
    const el = document.getElementById(elId);
    const val = (el.type === 'number') ? (parseInt(el.value) || 0) : el.value;
    if (Array.isArray(field)) c[field[0]][field[1]] = val;
    else c[field] = val;
    saveState();
    if (field === 'name') renderCharList();
    if (field === 'ac') updateTotalAC(c);
    if (field === 'prof') { renderSaves(c); renderSkills(c); updateComputedStats(c); }
  });
});
document.getElementById('sheetSize').addEventListener('change', (e) => {
  getChar(currentCharId).size = e.target.value;
  saveState();
});
document.getElementById('sheetInspiration').addEventListener('change', (e) => {
  getChar(currentCharId).inspiration = e.target.checked;
  saveState();
});
['cCp', 'cSp', 'cEp', 'cGp', 'cPp'].forEach((elId) => {
  const key = elId.slice(1).toLowerCase();
  document.getElementById(elId).addEventListener('input', () => {
    const c = getChar(currentCharId);
    c.currency[key] = parseInt(document.getElementById(elId).value) || 0;
    saveState();
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
bindAvatarPicker('sheetAvatar', () => getChar(currentCharId), '🧙', (record) => {
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
function crToNumber(cr) {
  if (!cr) return 0;
  const s = String(cr).trim();
  if (s.includes('/')) {
    const [a, b] = s.split('/').map(Number);
    return b ? a / b : 0;
  }
  return parseFloat(s) || 0;
}

function renderBestiaryFilterChips() {
  const types = ['Все', ...new Set(state.bestiary.map(b => b.type))];
  const wrap = document.getElementById('bestiaryFilter');
  wrap.innerHTML = types.map(t => `<button class="chip ${t === bestiaryFilter ? 'active' : ''}" data-t="${escapeHtml(t)}">${escapeHtml(t)}</button>`).join('');
  wrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { bestiaryFilter = chip.dataset.t; renderBestiary(); });
  });

  const crWrap = document.getElementById('bestiaryCrFilter');
  const crValues = ['Все', ...new Set(state.bestiary.map(b => b.cr).filter(Boolean))].sort((a, b) => {
    if (a === 'Все') return -1;
    if (b === 'Все') return 1;
    return crToNumber(a) - crToNumber(b);
  });
  crWrap.innerHTML = crValues.map(cr => `<button class="chip ${cr === bestiaryCrFilter ? 'active' : ''}" data-cr="${escapeHtml(cr)}">${cr === 'Все' ? 'Все' : 'КО ' + escapeHtml(cr)}</button>`).join('');
  crWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { bestiaryCrFilter = chip.dataset.cr; renderBestiary(); });
  });

  const sizeWrap = document.getElementById('bestiarySizeFilter');
  const sizeValues = ['Все', ...CREATURE_SIZES.filter(s => state.bestiary.some(b => b.size === s))];
  sizeWrap.innerHTML = sizeValues.map(s => `<button class="chip ${s === bestiarySizeFilter ? 'active' : ''}" data-s="${escapeHtml(s)}">${escapeHtml(s)}</button>`).join('');
  sizeWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { bestiarySizeFilter = chip.dataset.s; renderBestiary(); });
  });

  const habWrap = document.getElementById('bestiaryHabitatFilter');
  const habValues = ['Все', ...HABITATS.filter(h => state.bestiary.some(b => (b.habitat || []).includes(h)))];
  habWrap.innerHTML = habValues.map(h => `<button class="chip ${h === bestiaryHabitatFilter ? 'active' : ''}" data-h="${escapeHtml(h)}">${escapeHtml(h)}</button>`).join('');
  habWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { bestiaryHabitatFilter = chip.dataset.h; renderBestiary(); });
  });
}

function renderBestiary() {
  renderBestiaryFilterChips();
  const list = document.getElementById('bestiaryList');
  const items = state.bestiary
    .filter(b =>
      (bestiaryFilter === 'Все' || b.type === bestiaryFilter) &&
      (bestiaryCrFilter === 'Все' || b.cr === bestiaryCrFilter) &&
      (bestiarySizeFilter === 'Все' || b.size === bestiarySizeFilter) &&
      (bestiaryHabitatFilter === 'Все' || (b.habitat || []).includes(bestiaryHabitatFilter))
    )
    .sort((a, b) => crToNumber(a.cr) - crToNumber(b.cr));
  if (!items.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
  list.innerHTML = items.map(b => `
    <div class="list-item" data-id="${b.id}">
      <div class="avatar-circle small">${avatarInnerHtml(b, defaultBeastEmoji(b.type))}</div>
      <div style="flex:1">
        <div>${escapeHtml(b.name)} ${b.custom ? '★' : ''}</div>
        <div class="meta">${escapeHtml(b.type)}${b.size ? ' · ' + escapeHtml(b.size) : ''} · КО ${escapeHtml(b.cr)} · КД ${b.ac} · ХП ${escapeHtml(String(b.hp))}</div>
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
    <div class="avatar-circle large" style="margin:0 auto 12px">${avatarInnerHtml(b, defaultBeastEmoji(b.type))}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(b.type)}${b.size ? ' · ' + escapeHtml(b.size) : ''} · КО ${escapeHtml(b.cr)}</div>
    ${b.habitat && b.habitat.length ? `<div class="meta" style="margin-bottom:8px;text-align:center">Обитание: ${escapeHtml(b.habitat.join(', '))}</div>` : ''}
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
  const b = existing || { id: uid('b'), name: '', type: '', cr: '', size: 'Средний', habitat: [], ac: 10, hp: '', speed: '30 фт', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, actions: '', description: '', avatar: '', custom: true };
  if (!b.habitat) b.habitat = [];
  const sizeOptions = CREATURE_SIZES.map(s => `<option ${s === b.size ? 'selected' : ''}>${s}</option>`).join('');
  const habitatChips = HABITATS.map(h => `<button type="button" class="chip ${b.habitat.includes(h) ? 'active' : ''}" data-h="${escapeHtml(h)}">${escapeHtml(h)}</button>`).join('');
  openModal(existing ? 'Редактировать существо' : 'Новое существо', `
    <div style="text-align:center;margin-bottom:10px">${avatarPickerHtml('bAvatar', b, defaultBeastEmoji(b.type), true)}</div>
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
    <label>Размер</label>
    <select id="bSize">${sizeOptions}</select>
    <label>Обитание (можно выбрать несколько)</label>
    <div class="chip-row" id="bHabitatChips" style="flex-wrap:wrap">${habitatChips}</div>
    <label>Характеристики (СИЛ ЛОВ ТЕЛ ИНТ МДР ХАР через пробел)</label>
    <input id="bAbilities" value="${['str','dex','con','int','wis','cha'].map(k => b.abilities[k]).join(' ')}">
    <label>Описание</label><textarea id="bDesc">${escapeHtml(b.description)}</textarea>
    <label>Действия</label><textarea id="bActions">${escapeHtml(b.actions)}</textarea>
    <button class="primary block" id="saveBeast">Сохранить</button>
  `);
  bindAvatarPicker('bAvatar', b, defaultBeastEmoji(b.type), () => {});
  const selectedHabitats = new Set(b.habitat);
  document.getElementById('bHabitatChips').querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const h = chip.dataset.h;
      if (selectedHabitats.has(h)) { selectedHabitats.delete(h); chip.classList.remove('active'); }
      else { selectedHabitats.add(h); chip.classList.add('active'); }
    });
  });
  document.getElementById('saveBeast').addEventListener('click', () => {
    b.name = document.getElementById('bName').value.trim() || 'Без имени';
    b.type = document.getElementById('bType').value.trim();
    b.cr = document.getElementById('bCr').value.trim();
    b.ac = parseInt(document.getElementById('bAc').value) || 10;
    b.hp = document.getElementById('bHp').value.trim();
    b.speed = document.getElementById('bSpeed').value.trim();
    b.size = document.getElementById('bSize').value;
    b.habitat = Array.from(selectedHabitats);
    b.avatar = b.avatar || defaultBeastEmoji(document.getElementById('bType').value.trim());
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

  const rarWrap = document.getElementById('itemsRarityFilter');
  const rarValues = ['Все', ...RARITIES.filter(r => state.items.some(i => i.rarity === r))];
  rarWrap.innerHTML = rarValues.map(r => `<button class="chip ${r === itemsRarityFilter ? 'active' : ''}" data-r="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('');
  rarWrap.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => { itemsRarityFilter = chip.dataset.r; renderItems(); });
  });
}

function rarityToNumber(r) {
  return Math.max(0, RARITIES.indexOf(r));
}

function renderItems() {
  renderItemsFilterChips();
  const list = document.getElementById('itemsList');
  const items = state.items
    .filter(i => (itemsFilter === 'Все' || i.type === itemsFilter) && (itemsRarityFilter === 'Все' || i.rarity === itemsRarityFilter))
    .sort((a, b) => rarityToNumber(a.rarity) - rarityToNumber(b.rarity));
  if (!items.length) { list.innerHTML = '<div class="empty-state">Ничего не найдено</div>'; return; }
  list.innerHTML = items.map(it => `
    <div class="list-item" data-id="${it.id}">
      <div class="avatar-circle small">${avatarInnerHtml(it, defaultItemEmoji(it.type))}</div>
      <div style="flex:1">
        <div>${escapeHtml(it.name)} ${it.custom ? '★' : ''}</div>
        <div class="meta">${escapeHtml(it.type)}${it.rarity ? ' · ' + escapeHtml(it.rarity) : ''} · ${escapeHtml(it.weight || '')}</div>
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
    <div class="avatar-circle large" style="margin:0 auto 12px">${avatarInnerHtml(it, defaultItemEmoji(it.type))}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(it.type)}${it.rarity ? ' · ' + escapeHtml(it.rarity) : ''} · ${escapeHtml(it.weight || '')} · ${escapeHtml(it.cost || '')}</div>
    ${it.acBonus ? `<div style="margin-bottom:8px">🛡 Бонус к КД при экипировке: +${it.acBonus}</div>` : ''}
    ${it.atkBonus ? `<div style="margin-bottom:8px">⚔️ Бонус к атаке при экипировке: +${it.atkBonus}</div>` : ''}
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
  const it = existing || { id: uid('i'), name: '', type: '', weight: '', cost: '', properties: '', acBonus: 0, atkBonus: 0, rarity: 'Обычный', avatar: '', custom: true };
  if (!it.rarity) it.rarity = 'Обычный';
  const rarityOptions = RARITIES.map(r => `<option ${r === it.rarity ? 'selected' : ''}>${r}</option>`).join('');
  openModal(existing ? 'Редактировать предмет' : 'Новый предмет', `
    <div style="text-align:center;margin-bottom:10px">${avatarPickerHtml('itAvatar', it, defaultItemEmoji(it.type), true)}</div>
    <label>Название</label><input id="itName" value="${escapeAttr(it.name)}">
    <label>Тип</label><input id="itType" value="${escapeAttr(it.type)}" placeholder="Оружие / Броня / Снаряжение">
    <label>Редкость</label>
    <select id="itRarity">${rarityOptions}</select>
    <div class="row">
      <div><label>Вес</label><input id="itWeight" value="${escapeAttr(it.weight)}"></div>
      <div><label>Цена</label><input id="itCost" value="${escapeAttr(it.cost)}"></div>
    </div>
    <div class="row">
      <div><label>Бонус к КД (для брони)</label><input id="itAcBonus" type="number" value="${it.acBonus || 0}"></div>
      <div><label>Бонус к атаке (для оружия)</label><input id="itAtkBonus" type="number" value="${it.atkBonus || 0}"></div>
    </div>
    <label>Свойства / описание</label><textarea id="itProps">${escapeHtml(it.properties)}</textarea>
    <button class="primary block" id="saveItem">Сохранить</button>
  `);
  bindAvatarPicker('itAvatar', it, defaultItemEmoji(it.type), () => {});
  document.getElementById('saveItem').addEventListener('click', () => {
    it.name = document.getElementById('itName').value.trim() || 'Без названия';
    it.type = document.getElementById('itType').value.trim() || 'Снаряжение';
    it.rarity = document.getElementById('itRarity').value;
    it.weight = document.getElementById('itWeight').value.trim();
    it.cost = document.getElementById('itCost').value.trim();
    it.acBonus = parseInt(document.getElementById('itAcBonus').value) || 0;
    it.atkBonus = parseInt(document.getElementById('itAtkBonus').value) || 0;
    it.avatar = it.avatar || defaultItemEmoji(document.getElementById('itType').value.trim());
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
let selectedDie = 20;

function openDiceRoller() {
  renderDiceModal();
}

function renderDiceModal() {
  const buttons = DICE_TYPES.map(d => `<button type="button" class="chip dice-btn ${d === selectedDie ? 'active' : ''}" data-d="${d}">d${d}</button>`).join('');
  const historyHtml = diceHistory.length
    ? diceHistory.slice(0, 12).map(h => `<div class="skill-row"><span>${h.label}</span><span class="mod">${h.total}${h.rolls ? ' (' + h.rolls.join('+') + (h.mod ? (h.mod > 0 ? '+' + h.mod : h.mod) : '') + ')' : ''}</span></div>`).join('')
    : '<div class="empty-state" style="padding:10px 0">Пока не было бросков</div>';
  openModal('Кубики', `
    <div class="chip-row" id="diceButtons" style="flex-wrap:wrap">${buttons}</div>
    <div class="row" style="margin-top:8px">
      <div>
        <label>Количество костей</label>
        <input id="diceCount" type="number" min="1" max="20" value="1">
      </div>
      <div>
        <label>Модификатор</label>
        <input id="diceMod" type="number" value="0">
      </div>
    </div>
    <button class="primary block" id="rollDiceBtn">Бросить</button>
    <div id="diceResultBig" style="text-align:center;font-size:48px;font-weight:700;color:var(--accent);margin:12px 0">—</div>
    <div class="section-title" style="margin-top:4px">История</div>
    <div id="diceHistoryList">${historyHtml}</div>
  `);
  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDie = parseInt(btn.dataset.d);
      document.querySelectorAll('.dice-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.d) === selectedDie));
    });
  });
  document.getElementById('rollDiceBtn').addEventListener('click', () => {
    const count = Math.max(1, Math.min(20, parseInt(document.getElementById('diceCount').value) || 1));
    const modifier = parseInt(document.getElementById('diceMod').value) || 0;
    const rolls = [];
    for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * selectedDie));
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    const label = `${count}к${selectedDie}${modifier ? (modifier > 0 ? '+' + modifier : modifier) : ''}`;
    diceHistory.unshift({ label, total, rolls, mod: modifier });
    document.getElementById('diceResultBig').textContent = total;
    document.getElementById('diceHistoryList').innerHTML = diceHistory.slice(0, 12).map(h => `<div class="skill-row"><span>${h.label}</span><span class="mod">${h.total}${h.rolls.length > 1 || h.mod ? ' (' + h.rolls.join('+') + (h.mod ? (h.mod > 0 ? '+' + h.mod : h.mod) : '') + ')' : ''}</span></div>`).join('');
    playDiceRoll();
  });
}

document.getElementById('diceBtn').addEventListener('click', openDiceRoller);

// ==================== EXPANDABLE TEXT EDITOR ====================
document.querySelectorAll('.expand-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const source = document.getElementById(targetId);
    const label = btn.closest('h3, label').textContent.replace('⤢', '').replace('Развернуть', '').trim() || 'Текст';
    openModal(label, `<textarea id="expandedTextarea" class="expanded-editor-textarea">${escapeHtml(source.value)}</textarea>`);
    const expanded = document.getElementById('expandedTextarea');
    expanded.focus();
    expanded.addEventListener('input', () => {
      source.value = expanded.value;
      source.dispatchEvent(new Event('input'));
    });
  });
});

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
    if (ctx.state === 'running') playSplashDiceLand();
  } catch (e) { /* тихо игнорируем */ }
  setTimeout(() => {
    splash.classList.add('fade-out');
    setTimeout(() => splash.remove(), 550);
  }, 2100);
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
