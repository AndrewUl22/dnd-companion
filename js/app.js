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
    battle: { combatants: [], currentIndex: 0, round: 1 },
    settings: { theme: 'dark', soundEnabled: true, diceSkin: 'ruby' }
  };
}

function saveState() {
  localStorage.setItem(STORE_KEY, JSON.stringify(state));
}

let state = loadState();
if (!state.spells) state.spells = JSON.parse(JSON.stringify(DEFAULT_SPELLS)); // миграция для старых сохранений
if (!state.customRaces) state.customRaces = [];
if (!state.customClasses) state.customClasses = [];
if (!state.battle) state.battle = { combatants: [], currentIndex: 0, round: 1 };
if (!state.settings) state.settings = { theme: 'dark', soundEnabled: true, diceSkin: 'ruby' };
if (!state.settings.diceSkin) state.settings.diceSkin = 'ruby';

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
    settings: 'Настройки', battle: 'Бой', books: 'Книги', 'pdf-viewer': 'Книга', sheet: currentCharId ? getChar(currentCharId).name || 'Персонаж' : 'Персонаж'
  };
  document.getElementById('headerTitle').textContent = titles[view] || 'DnD Companion';
  document.getElementById('headerTitle').style.color = (view === 'sheet' && currentCharId && getChar(currentCharId).nameColor) ? getChar(currentCharId).nameColor : '';
  document.getElementById('fabAdd').style.display = (view === 'sheet' || view === 'settings' || view === 'books' || view === 'pdf-viewer') ? 'none' : 'flex';

  if (view === 'characters') renderCharList();
  if (view === 'bestiary') renderBestiary();
  if (view === 'items') renderItems();
  if (view === 'spells') renderSpells();
  if (view === 'battle') renderBattle();
  if (view === 'books') renderBooks();
}

document.querySelectorAll('nav.tabbar button').forEach(btn => {
  btn.addEventListener('click', () => switchView(btn.dataset.view));
});

document.getElementById('settingsBtn').addEventListener('click', () => switchView('settings'));
document.getElementById('battleBtn').addEventListener('click', () => switchView('battle'));
document.getElementById('booksBtn').addEventListener('click', () => switchView('books'));
document.getElementById('rulesBtn').addEventListener('click', () => window.open('https://next.dnd.su/', '_blank', 'noopener'));

document.getElementById('fabAdd').addEventListener('click', () => {
  if (activeView === 'characters') openCharacterForm();
  else if (activeView === 'bestiary') openBestiaryForm();
  else if (activeView === 'items') openItemForm();
  else if (activeView === 'spells') openSpellForm();
  else if (activeView === 'battle') openCombatantForm();
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

// Общие псевдонимы: это тот же независимый оверлей, что и для выбора аватарки —
// используется везде, где нужно открыть что-то ПОВЕРХ уже открытой формы,
// не стирая её (например, заклинания монстра внутри формы редактирования существа)
const openAuxModal = openAvatarModal;
const closeAuxModal = closeAvatarModal;

// ==================== СВОЙ СПИСОК ВЫБОРА (замена нативного <select>) ====================
// Нативный select на телефоне открывает системный список ОС — его нельзя перекрасить
// или добавить туда ховер/анимацию. Вместо этого рисуем свой список в модалке.
function openListPicker(useAux, title, items, rowHtmlFn, onPick, searchFn) {
  const open = useAux ? openAuxModal : openModal;
  const bodyId = useAux ? 'avatarModalBody' : 'modalBody';
  const render = (list) => {
    const rows = list.length
      ? list.map((item, idx) => `<div class="list-item picker-row" data-idx="${idx}">${rowHtmlFn(item)}</div>`).join('')
      : '<div class="empty-state">Ничего не найдено</div>';
    const searchHtml = searchFn ? `<input id="pickerSearch" placeholder="Поиск…" style="margin-bottom:10px">` : '';
    open(title, `${searchHtml}<div id="pickerRows">${rows}</div>`);
    const bind = () => {
      document.getElementById(bodyId).querySelectorAll('.picker-row').forEach(el => {
        el.addEventListener('click', () => {
          onPick(list[parseInt(el.dataset.idx)]);
          (useAux ? closeAuxModal : closeModal)();
        });
      });
    };
    bind();
    if (searchFn) {
      document.getElementById('pickerSearch').addEventListener('input', (e) => {
        const filtered = items.filter(it => searchFn(it, e.target.value.toLowerCase()));
        document.getElementById('pickerRows').innerHTML = filtered.length
          ? filtered.map((item) => `<div class="list-item picker-row" data-idx="${items.indexOf(item)}">${rowHtmlFn(item)}</div>`).join('')
          : '<div class="empty-state">Ничего не найдено</div>';
        document.getElementById('pickerRows').querySelectorAll('.picker-row').forEach(el => {
          el.addEventListener('click', () => {
            onPick(items[parseInt(el.dataset.idx)]);
            (useAux ? closeAuxModal : closeModal)();
          });
        });
      });
    }
  };
  render(items);
}

// ==================== AVATAR PICKER ====================
// Аватар может быть либо эмодзи (record.avatar), либо загруженной картинкой (record.avatarImage, dataURL).
// Картинка, если есть, имеет приоритет над эмодзи.
function avatarInnerHtml(record, fallbackEmoji) {
  if (record && record.avatarImage) return `<img src="${record.avatarImage}" alt="">`;
  const val = (record && record.avatar) || fallbackEmoji || '🧙';
  // Собственные сгенерированные SVG-иконки (CUSTOM_ITEM_ICONS) не экранируем — это не пользовательский ввод
  if (typeof val === 'string' && val.trim().startsWith('<svg')) return val;
  return escapeHtml(val);
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
// Собственные нарисованные SVG-иконки для предметов, где обычный эмодзи выглядит невыразительно
const CUSTOM_ITEM_ICONS = {
  potion: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M9 2h6v4l4 8a3 3 0 0 1-3 5H8a3 3 0 0 1-3-5l4-8V2z" fill="none" stroke="#d9c39a" stroke-width="1.4"/><path d="M6.3 14.8h11.4L16.3 18.3a3 3 0 0 1-2.8 1.9h-3a3 3 0 0 1-2.8-1.9L6.3 14.8z" fill="#7fd97f"/><rect x="9" y="1.4" width="6" height="2" rx="0.5" fill="#d9c39a"/></svg>',
  rope: '<svg viewBox="0 0 100 100" width="26" height="26"><g stroke="#2b1c10" stroke-width="13" stroke-linecap="round" fill="none"><path d="M70 8 C88 8 92 28 78 38 C64 48 50 40 50 40"/><path d="M50 40 C35 30 20 40 15 55 C9 72 22 90 38 88 C54 86 58 68 50 40"/><path d="M50 40 L58 62"/><path d="M42 34 L60 56"/><path d="M36 44 L54 66"/><path d="M30 54 L48 76"/></g><g stroke="#8a5a34" stroke-width="9" stroke-linecap="round" fill="none"><path d="M70 8 C88 8 92 28 78 38 C64 48 50 40 50 40"/><path d="M50 40 C35 30 20 40 15 55 C9 72 22 90 38 88 C54 86 58 68 50 40"/></g><g stroke="#a5713f" stroke-width="7" stroke-linecap="round" fill="none"><path d="M50 40 L58 62"/><path d="M42 34 L60 56"/><path d="M36 44 L54 66"/><path d="M30 54 L48 76"/></g></svg>',
  chainmail: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 3 L18 3 L20 9 L18 22 L6 22 L4 9 Z" fill="#8f97a3" stroke="#4d545e" stroke-width="1"/><g stroke="#4d545e" stroke-width="0.6" fill="none"><circle cx="8" cy="7" r="1.3"/><circle cx="12" cy="7" r="1.3"/><circle cx="16" cy="7" r="1.3"/><circle cx="8" cy="11" r="1.3"/><circle cx="12" cy="11" r="1.3"/><circle cx="16" cy="11" r="1.3"/><circle cx="8" cy="15" r="1.3"/><circle cx="12" cy="15" r="1.3"/><circle cx="16" cy="15" r="1.3"/><circle cx="8" cy="19" r="1.3"/><circle cx="12" cy="19" r="1.3"/><circle cx="16" cy="19" r="1.3"/></g></svg>',
  leatherArmor: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M6 3 L18 3 L20 9 L18 22 L6 22 L4 9 Z" fill="#8a5a34" stroke="#4a2f18" stroke-width="1"/><path d="M12 4 L12 21" stroke="#4a2f18" stroke-width="1" stroke-dasharray="2 1.5"/><path d="M6 9 L18 9" stroke="#4a2f18" stroke-width="1" stroke-dasharray="2 1.5"/></svg>'
};

function defaultItemEmoji(name, type) {
  const s = ((name || '') + ' ' + (type || '')).toLowerCase();
  // Сначала — конкретные предметы (точнее общей категории)
  if (s.includes('зелье') || s.includes('эликсир') || s.includes('снадобье')) return CUSTOM_ITEM_ICONS.potion;
  if (s.includes('свиток')) return '📜';
  if (s.includes('верёвк') || s.includes('веревк') || s.includes('канат')) return CUSTOM_ITEM_ICONS.rope;
  if (s.includes('посох')) return '🪄';
  if (s.includes('жезл') || s.includes('палочк')) return '🪄';
  if (s.includes('кольц') || s.includes('перстен')) return '💍';
  if (s.includes('амулет') || s.includes('медальон') || s.includes('кулон')) return '📿';
  if (s.includes('книг') || s.includes('гримуар') || s.includes('фолиант')) return '📖';
  if (s.includes('карт') && !s.includes('картечь')) return '🗺️';
  if (s.includes('ключ')) return '🗝️';
  if (s.includes('факел') || s.includes('фонар')) return '🔦';
  if (s.includes('свеч')) return '🕯️';
  if (s.includes('стрел') || s.includes('лук')) return '🏹';
  if (s.includes('арбалет')) return '🏹';
  if (s.includes('кинжал')) return '🗡️';
  if (s.includes('меч') || s.includes('клинок') || s.includes('скимитар') || s.includes('рапир')) return '🗡️';
  if (s.includes('топор') || s.includes('секир')) return '🪓';
  if (s.includes('молот') || s.includes('булав')) return '🔨';
  if (s.includes('копь') || s.includes('пик') || s.includes('трезубец')) return '🔱';
  if (s.includes('кольчуг') || s.includes('пластинчат') || s.includes('латы')) return CUSTOM_ITEM_ICONS.chainmail;
  if (s.includes('кожан')) return CUSTOM_ITEM_ICONS.leatherArmor;
  if (s.includes('щит')) return '🛡️';
  if (s.includes('шлем') || s.includes('капюшон')) return '⛑️';
  if (s.includes('плащ') || s.includes('мантия') || s.includes('накидк')) return '🧥';
  if (s.includes('сапог') || s.includes('ботинк') || s.includes('обувь')) return '👢';
  if (s.includes('перчатк') || s.includes('рукавиц')) return '🧤';
  if (s.includes('монет') || s.includes('золот') || s.includes('казна') || s.includes('сокровищ')) return '💰';
  if (s.includes('еда') || s.includes('паёк') || s.includes('провизия') || s.includes('хлеб') || s.includes('мясо')) return '🍖';
  if (s.includes('инструмент') || s.includes('набор')) return '🧰';
  if (s.includes('яд')) return '☠️';
  if (s.includes('драгоц') || s.includes('самоцвет') || s.includes('алмаз') || s.includes('рубин')) return '💎';
  // Затем — общие категории
  if (s.includes('оруж')) return '⚔️';
  if (s.includes('брон')) return CUSTOM_ITEM_ICONS.chainmail;
  return '🎒';
}

// ==================== CHARACTERS ====================
function getChar(id) { return state.characters.find(c => c.id === id); }

function newCharacter(name) {
  return {
    id: uid('c'),
    name: name || 'Новый персонаж',
    avatar: '🧙',
    nameColor: '',
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
    spellcastingAbility: '',
    cantripsKnown: 0,
    customResources: [
      { name: '', total: 0, used: 0 },
      { name: '', total: 0, used: 0 },
      { name: '', total: 0, used: 0 },
      { name: '', total: 0, used: 0 }
    ],
    spellSlots: { 1: { total: 0, used: 0 }, 2: { total: 0, used: 0 }, 3: { total: 0, used: 0 }, 4: { total: 0, used: 0 }, 5: { total: 0, used: 0 }, 6: { total: 0, used: 0 }, 7: { total: 0, used: 0 }, 8: { total: 0, used: 0 }, 9: { total: 0, used: 0 } },
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
        <div${c.nameColor ? ` style="color:${c.nameColor}"` : ''}>${escapeHtml(c.name)}</div>
        <div class="meta">${escapeHtml(c.race)} · ${escapeHtml(c.class)} · ур. ${c.level}</div>
      </div>
      <span class="badge">${c.hp.current}/${c.hp.max} ХП</span>
    `;
    el.addEventListener('click', () => openCharacter(c.id));
    list.appendChild(el);
  });
}

function migrateChar(c) {
  if (c.nameColor === undefined) c.nameColor = '';
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
  if (c.spellcastingAbility === undefined) c.spellcastingAbility = '';
  if (c.cantripsKnown === undefined) c.cantripsKnown = 0;
  if (!c.customResources || !Array.isArray(c.customResources)) c.customResources = [];
  while (c.customResources.length < 4) c.customResources.push({ name: '', total: 0, used: 0 });
  if (!c.spellSlots) c.spellSlots = {};
  for (let lvl = 1; lvl <= 9; lvl++) {
    if (!c.spellSlots[lvl]) c.spellSlots[lvl] = { total: 0, used: 0 };
  }
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
  document.getElementById('sheetName').style.color = c.nameColor || '';
  document.getElementById('sheetAvatar').innerHTML = avatarInnerHtml(c, '🧙');
  renderCharColorSwatches(c);
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
  updateHpBar(c);
  document.getElementById('sheetHitDiceTotal').value = c.hitDice.total;
  document.getElementById('sheetHitDiceUsed').value = c.hitDice.used;
  document.getElementById('sheetWeaponProf').value = c.weaponProf;
  document.getElementById('sheetToolProf').value = c.toolProf;
  document.getElementById('sheetLanguages').value = c.languages;
  document.getElementById('sheetClassFeatures').innerHTML = c.classFeatures || '';
  document.getElementById('sheetRacialTraits').innerHTML = c.racialTraits || '';
  document.getElementById('sheetFeats').innerHTML = c.feats || '';
  document.getElementById('sheetAppearance').innerHTML = c.appearance || '';
  document.getElementById('sheetBackstory').innerHTML = c.backstory || '';
  document.getElementById('sheetSpells').innerHTML = c.spells || '';
  document.getElementById('sheetNotes').innerHTML = c.notes || '';
  document.getElementById('cCp').value = c.currency.cp;
  document.getElementById('cSp').value = c.currency.sp;
  document.getElementById('cEp').value = c.currency.ep;
  document.getElementById('cGp').value = c.currency.gp;
  document.getElementById('cPp').value = c.currency.pp;
  document.getElementById('sheetSpellAbility').value = c.spellcastingAbility;
  document.getElementById('sheetCantripsKnown').value = c.cantripsKnown;

  renderAbilityGrid(c);
  renderSaves(c);
  renderSkills(c);
  renderArmorProfChips(c);
  renderDeathSaves(c);
  renderAttacks(c);
  renderInventory(c);
  renderCharSpells(c);
  renderSpellSlots(c);
  renderCustomResources(c);
  updateTotalAC(c);
  updateComputedStats(c);
  updateSpellcastingStats(c);
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

function updateSpellcastingStats(c) {
  const ability = c.spellcastingAbility;
  const spellMod = ability ? mod(c.abilities[ability]) : 0;
  const prof = parseInt(c.prof) || 0;
  document.getElementById('spellModDisplay').textContent = fmtMod(spellMod);
  document.getElementById('spellDcDisplay').textContent = ability ? (8 + prof + spellMod) : '—';
  document.getElementById('spellAtkDisplay').textContent = ability ? fmtMod(prof + spellMod) : '—';
}

document.getElementById('sheetSpellAbility').addEventListener('change', (e) => {
  const c = getChar(currentCharId);
  c.spellcastingAbility = e.target.value;
  saveState();
  updateSpellcastingStats(c);
});
document.getElementById('sheetCantripsKnown').addEventListener('input', (e) => {
  const c = getChar(currentCharId);
  c.cantripsKnown = Math.max(0, parseInt(e.target.value) || 0);
  saveState();
});

function renderSpellSlots(c) {
  const wrap = document.getElementById('spellSlotsGrid');
  wrap.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
    const slot = c.spellSlots[lvl] || { total: 0, used: 0 };
    return `
      <div class="spell-slot-row" data-lvl="${lvl}">
        <span class="spell-slot-level">Ур. ${lvl}</span>
        <input type="number" class="spell-slot-total" data-lvl="${lvl}" min="0" value="${slot.total}">
        <div class="spell-slot-used-controls">
          <button type="button" data-lvl="${lvl}" data-act="dec">−</button>
          <span class="spell-slot-used-display" data-lvl="${lvl}">${slot.used}/${slot.total}</span>
          <button type="button" data-lvl="${lvl}" data-act="inc">+</button>
        </div>
      </div>
    `;
  }).join('');
  wrap.querySelectorAll('.spell-slot-total').forEach(inp => {
    inp.addEventListener('input', () => {
      const c = getChar(currentCharId);
      const lvl = inp.dataset.lvl;
      const total = Math.max(0, parseInt(inp.value) || 0);
      c.spellSlots[lvl].total = total;
      if (c.spellSlots[lvl].used > total) c.spellSlots[lvl].used = total;
      saveState();
      wrap.querySelector(`.spell-slot-used-display[data-lvl="${lvl}"]`).textContent = `${c.spellSlots[lvl].used}/${total}`;
    });
  });
  wrap.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      const lvl = btn.dataset.lvl;
      const slot = c.spellSlots[lvl];
      if (btn.dataset.act === 'inc') slot.used = Math.min(slot.total, slot.used + 1);
      if (btn.dataset.act === 'dec') slot.used = Math.max(0, slot.used - 1);
      saveState();
      wrap.querySelector(`.spell-slot-used-display[data-lvl="${lvl}"]`).textContent = `${slot.used}/${slot.total}`;
    });
  });
}

function renderCustomResources(c) {
  const wrap = document.getElementById('customResourcesGrid');
  wrap.innerHTML = c.customResources.map((res, idx) => `
    <div class="resource-row" data-idx="${idx}">
      <input type="text" class="resource-name-input" data-idx="${idx}" value="${escapeAttr(res.name)}" placeholder="Название (например, Ци)">
      <input type="number" class="resource-total-input" data-idx="${idx}" min="0" value="${res.total}">
      <div class="spell-slot-used-controls">
        <button type="button" data-idx="${idx}" data-act="dec">−</button>
        <span class="spell-slot-used-display" data-idx="${idx}">${res.used}/${res.total}</span>
        <button type="button" data-idx="${idx}" data-act="inc">+</button>
      </div>
    </div>
  `).join('');
  wrap.querySelectorAll('.resource-name-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const c = getChar(currentCharId);
      c.customResources[inp.dataset.idx].name = inp.value;
      saveState();
    });
  });
  wrap.querySelectorAll('.resource-total-input').forEach(inp => {
    inp.addEventListener('input', () => {
      const c = getChar(currentCharId);
      const idx = inp.dataset.idx;
      const total = Math.max(0, parseInt(inp.value) || 0);
      c.customResources[idx].total = total;
      if (c.customResources[idx].used > total) c.customResources[idx].used = total;
      saveState();
      wrap.querySelector(`.spell-slot-used-display[data-idx="${idx}"]`).textContent = `${c.customResources[idx].used}/${total}`;
    });
  });
  wrap.querySelectorAll('button[data-act]').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      const idx = btn.dataset.idx;
      const res = c.customResources[idx];
      if (btn.dataset.act === 'inc') res.used = Math.min(res.total, res.used + 1);
      if (btn.dataset.act === 'dec') res.used = Math.max(0, res.used - 1);
      saveState();
      wrap.querySelector(`.spell-slot-used-display[data-idx="${idx}"]`).textContent = `${res.used}/${res.total}`;
    });
  });
}

function populateRaceClassOptions() {
  const raceList = document.getElementById('raceOptions');
  const classList = document.getElementById('classOptions');
  raceList.innerHTML = [...DEFAULT_RACES, ...state.customRaces].map(r => `<option value="${escapeAttr(r)}">`).join('');
  classList.innerHTML = [...DEFAULT_CLASSES, ...state.customClasses].map(cl => `<option value="${escapeAttr(cl)}">`).join('');
}

const CHAR_COLOR_PALETTE = ['', '#e07a7a', '#7cb88a', '#6fa9e0', '#a67ce0', '#e0955a'];
function renderCharColorSwatches(c) {
  const wrap = document.getElementById('charColorSwatches');
  wrap.innerHTML = CHAR_COLOR_PALETTE.map(col => {
    const isDefault = col === '';
    const style = isDefault ? 'background:var(--bg-elevated);border:1px dashed var(--card-border)' : `background:${col}`;
    return `<button type="button" class="color-swatch ${c.nameColor === col ? 'is-selected' : ''}" data-color="${col}" style="${style};width:26px;height:26px;border-radius:50%" title="${isDefault ? 'По умолчанию' : ''}"></button>`;
  }).join('');
  wrap.querySelectorAll('.color-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = getChar(currentCharId);
      c.nameColor = btn.dataset.color;
      saveState();
      document.getElementById('sheetName').style.color = c.nameColor || '';
      renderCharColorSwatches(c);
      renderCharList();
      playFormatClick();
    });
  });
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
      updateSpellcastingStats(c);
      updateTotalAC(c);
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
    const slot = it.armorSlot || (it.acBonus ? 'flat' : 'none'); // обратная совместимость со старыми записями
    const canEquip = slot !== 'none' || !!it.atkBonus;
    const bonusParts = [];
    if (slot === 'light') bonusParts.push('КД ' + (it.armorBaseAC || 0) + '+Лов');
    else if (slot === 'medium') bonusParts.push('КД ' + (it.armorBaseAC || 0) + '+Лов(макс2)');
    else if (slot === 'heavy') bonusParts.push('КД ' + (it.armorBaseAC || 0));
    else if (slot === 'flat' && it.acBonus) bonusParts.push('КД +' + it.acBonus);
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

const ARMOR_DEX_CAP = { light: Infinity, medium: 2, heavy: 0 };

function updateTotalAC(c) {
  const equipped = (c.inventory || []).filter(i => i.equipped);
  const dexMod = mod(c.abilities.dex);
  // Надетая базовая броня (лёгкая/средняя/тяжёлая) заменяет ручной "Базовый КД", а не складывается с ним
  const bodyArmor = equipped.find(i => ['light', 'medium', 'heavy'].includes(i.armorSlot));
  let baseAC;
  if (bodyArmor) {
    const cap = ARMOR_DEX_CAP[bodyArmor.armorSlot];
    baseAC = (bodyArmor.armorBaseAC || 0) + Math.max(-Infinity, Math.min(dexMod, cap));
  } else {
    baseAC = parseInt(c.ac) || 0;
  }
  // Фиксированные бонусы (щиты, кольца и т.п. + старые записи без armorSlot) складываются поверх
  const flatBonus = equipped
    .filter(i => (i.armorSlot || (i.acBonus ? 'flat' : 'none')) === 'flat')
    .reduce((sum, i) => sum + (i.acBonus || 0), 0);
  const atkBonus = equipped.reduce((sum, i) => sum + (i.atkBonus || 0), 0);

  const el = document.getElementById('totalACDisplay');
  if (el) el.textContent = baseAC + flatBonus;
  const atkEl = document.getElementById('equipAtkBonusDisplay');
  if (atkEl) atkEl.textContent = atkBonus > 0 ? ('Бонус атаки от снаряжения: +' + atkBonus) : '';
}

document.getElementById('addInvFromCatalog').addEventListener('click', () => {
  const sorted = state.items.slice().sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  openListPicker(false, 'Выберите предмет', sorted,
    (it) => `<div class="avatar-circle small">${avatarInnerHtml(it, defaultItemEmoji(it.name, it.type))}</div><div style="flex:1"><div>${escapeHtml(it.name)}</div><div class="meta">${escapeHtml(it.type)}${it.rarity ? ' · ' + escapeHtml(it.rarity) : ''}</div></div><span class="badge">${escapeHtml(it.cost || '')}</span>`,
    (item) => {
      const c = getChar(currentCharId);
      const existing = c.inventory.find(i => i.itemId === item.id);
      if (existing) existing.qty++;
      else c.inventory.push({ itemId: item.id, name: item.name, type: item.type, qty: 1, armorSlot: item.armorSlot || 'none', armorBaseAC: item.armorBaseAC || 0, acBonus: item.acBonus || 0, atkBonus: item.atkBonus || 0, equipped: false });
      saveState();
      renderInventory(c);
    },
    (it, q) => it.name.toLowerCase().includes(q)
  );
});

// bind sheet fields to state on change
[
  ['sheetName', 'name'], ['sheetLevel', 'level'], ['sheetBackground', 'background'],
  ['sheetAC', 'ac'], ['sheetSpeed', 'speed'], ['sheetProf', 'prof'],
  ['sheetSubclass', 'subclass'], ['sheetXP', 'xp'], ['sheetAlignment', 'alignment'],
  ['sheetHitDiceTotal', ['hitDice', 'total']], ['sheetHitDiceUsed', ['hitDice', 'used']],
  ['sheetWeaponProf', 'weaponProf'], ['sheetToolProf', 'toolProf'], ['sheetLanguages', 'languages']
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
    if (field === 'prof') { renderSaves(c); renderSkills(c); updateComputedStats(c); updateSpellcastingStats(c); }
  });
});

// Форматируемые поля (contenteditable) — сохраняем HTML вместо простого текста
[
  ['sheetSpells', 'spells'], ['sheetNotes', 'notes'],
  ['sheetClassFeatures', 'classFeatures'], ['sheetRacialTraits', 'racialTraits'], ['sheetFeats', 'feats'],
  ['sheetAppearance', 'appearance'], ['sheetBackstory', 'backstory']
].forEach(([elId, field]) => {
  document.getElementById(elId).addEventListener('input', () => {
    const c = getChar(currentCharId);
    if (!c) return;
    const el = document.getElementById(elId);
    c[field] = el.innerHTML;
    saveState();
    // Если поле полностью очищено — сбрасываем размер шрифта в панели обратно на "Обычный",
    // иначе новый набранный текст визуально мелкий, а селектор всё ещё показывает старый уровень
    if (el.textContent.trim() === '') {
      const bar = document.querySelector(`.rich-toolbar[data-target="${elId}"]`);
      if (bar) {
        const sel = bar.querySelector('.fmt-size-select');
        if (sel) sel.value = '3';
      }
      try { document.execCommand('removeFormat'); } catch (e) { /* игнорируем */ }
    }
  });
});

// Панели форматирования: жирный + цвета для полей выше
function bindRichToolbars() {
  const colors = ['#d4af6e', '#e07a7a', '#7cb88a', '#6fa9e0', '#a67ce0'];
  document.querySelectorAll('.rich-toolbar').forEach(bar => {
    if (bar.dataset.bound) return;
    bar.dataset.bound = '1';
    const targetId = bar.dataset.target;
    const swatches = colors.map(c => `<button type="button" class="color-swatch" data-color="${c}" style="background:${c}" title="Цвет текста"></button>`).join('');
    bar.innerHTML = `
      <button type="button" class="fmt-btn bold-btn" data-cmd="bold" title="Жирный">B</button>
      <button type="button" class="fmt-btn italic-btn" data-cmd="italic" title="Курсив">I</button>
      <button type="button" class="fmt-btn underline-btn" data-cmd="underline" title="Подчёркнутый">U</button>
      <select class="fmt-size-select" title="Размер текста">
        <option value="3">Обычный</option>
        <option value="4">Уровень 1</option>
        <option value="5">Уровень 2</option>
        <option value="6">Уровень 3</option>
      </select>
      ${swatches}
      <button type="button" class="anchor-btn" title="Пометить выделенный текст как метку">#</button>
      <button type="button" class="jump-btn" title="Перейти к метке">🔍</button>
      <button type="button" class="clear-btn" title="Убрать форматирование">Очистить</button>
    `;
    const target = document.getElementById(targetId);
    let savedRange = null;

    function saveSelection() {
      const sel = window.getSelection();
      if (sel.rangeCount && target.contains(sel.anchorNode)) savedRange = sel.getRangeAt(0).cloneRange();
    }
    function restoreSelection() {
      if (!savedRange) return;
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(savedRange);
    }
    function hexToRgb(hex) {
      const n = parseInt(hex.replace('#', ''), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    }
    function updateActiveStates() {
      try {
        bar.querySelector('.bold-btn').classList.toggle('is-active', document.queryCommandState('bold'));
        bar.querySelector('.italic-btn').classList.toggle('is-active', document.queryCommandState('italic'));
        bar.querySelector('.underline-btn').classList.toggle('is-active', document.queryCommandState('underline'));
        const curColor = document.queryCommandValue('foreColor');
        bar.querySelectorAll('.color-swatch').forEach(sw => {
          sw.classList.toggle('is-selected', curColor === hexToRgb(sw.dataset.color));
        });
      } catch (e) { /* игнорируем, если команда недоступна вне фокуса */ }
    }
    target.addEventListener('keyup', () => { saveSelection(); updateActiveStates(); });
    target.addEventListener('mouseup', () => { saveSelection(); updateActiveStates(); });
    target.addEventListener('focus', updateActiveStates);
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === target) { saveSelection(); updateActiveStates(); }
    });

    bar.querySelectorAll('button').forEach(el => {
      el.addEventListener('mousedown', (e) => e.preventDefault()); // не терять выделение текста
    });
    bar.querySelectorAll('.fmt-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        target.focus();
        document.execCommand(btn.dataset.cmd);
        target.dispatchEvent(new Event('input'));
        updateActiveStates();
        playFormatClick();
      });
    });
    bar.querySelectorAll('.color-swatch').forEach(btn => {
      btn.addEventListener('click', () => {
        target.focus();
        document.execCommand('foreColor', false, btn.dataset.color);
        target.dispatchEvent(new Event('input'));
        updateActiveStates();
        playFormatClick();
      });
    });
    bar.querySelector('.fmt-size-select').addEventListener('mousedown', () => saveSelection());
    bar.querySelector('.fmt-size-select').addEventListener('change', (e) => {
      target.focus();
      restoreSelection();
      document.execCommand('fontSize', false, e.target.value);
      target.dispatchEvent(new Event('input'));
      saveSelection();
      playFormatClick();
    });
    bar.querySelector('.clear-btn').addEventListener('click', () => {
      target.focus();
      document.execCommand('removeFormat');
      target.dispatchEvent(new Event('input'));
      updateActiveStates();
      playFormatClick();
    });
    bar.querySelector('.anchor-btn').addEventListener('click', () => {
      const sel = window.getSelection();
      if (sel.isCollapsed) {
        showToast('Сначала выделите текст — например, название умения');
        return;
      }
      target.focus();
      const text = sel.toString();
      if (!text.trim()) { showToast('Сначала выделите текст — например, название умения'); return; }
      // добавляем невидимый пробел после метки, иначе курсор "застревает" внутри
      // подсвеченного span и весь следующий набранный текст тоже выглядит как метка
      document.execCommand('insertHTML', false, `<span class="text-anchor">${escapeHtml(text)}</span>&nbsp;`);
      target.dispatchEvent(new Event('input'));
      playFormatClick();
      showToast('Метка добавлена — теперь можно быстро перейти к ней через 🔍');
    });
    bar.querySelector('.jump-btn').addEventListener('click', () => {
      const anchors = Array.from(target.querySelectorAll('.text-anchor'));
      if (!anchors.length) { showToast('Пока нет меток — выделите текст и нажмите #'); return; }
      const items = anchors.map(el => ({ el, text: el.textContent }));
      openListPicker(false, 'Перейти к метке', items,
        (item) => `<div style="flex:1">${escapeHtml(item.text)}</div>`,
        (item) => {
          // scrollIntoView сам прокрутит и поле, и страницу вокруг него — надёжнее,
          // чем вручную считать offsetTop (тот часто мерился не от нужного контейнера).
          // ВАЖНО: не вызываем focus() после — это сбрасывает прокрутку обратно к
          // позиции курсора, из-за чего экран "прыгал" к метке и тут же откатывался назад.
          item.el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          item.el.classList.add('anchor-flash');
          setTimeout(() => item.el.classList.remove('anchor-flash'), 1400);
        }
      );
    });
  });
}
bindRichToolbars();

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
    updateHpBar(c);
  });
});

function updateHpBar(c) {
  const fill = document.getElementById('hpBarFill');
  if (!fill) return;
  const pct = c.hp.max > 0 ? Math.max(0, Math.min(100, (c.hp.current / c.hp.max) * 100)) : 0;
  fill.style.width = pct + '%';
}

document.getElementById('backToList').addEventListener('click', () => switchView('characters'));
document.getElementById('deleteCharBtn').addEventListener('click', () => {
  if (!confirm('Удалить этого персонажа безвозвратно?')) return;
  state.characters = state.characters.filter(c => c.id !== currentCharId);
  currentCharId = null;
  saveState();
  playChainClink();
  switchView('characters');
  renderCharList();
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
      <span class="badge">${b.flySpeed ? '🪽 ' : ''}${escapeHtml(b.speed)}</span>
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
  const spellsHtml = (b.knownSpells && b.knownSpells.length)
    ? `<div class="section-title">Заклинания</div>` + b.knownSpells.map(spId => {
        const sp = state.spells.find(x => x.id === spId);
        if (!sp) return '';
        return `<div class="skill-row" data-open-spell="${sp.id}" style="cursor:pointer"><span>${escapeHtml(sp.name)}</span><span class="mod">${sp.level === 0 ? 'Загов.' : 'Ур.' + sp.level} ▸</span></div>`;
      }).join('')
    : '';
  const speedParts = [`${escapeHtml(b.speed)} (по земле)`];
  if (b.flySpeed) speedParts.push(`полёт ${escapeHtml(b.flySpeed)}`);
  if (b.swimSpeed) speedParts.push(`плавание ${escapeHtml(b.swimSpeed)}`);
  if (b.climbSpeed) speedParts.push(`лазанье ${escapeHtml(b.climbSpeed)}`);
  openModal(b.name, `
    <div class="avatar-circle large" style="margin:0 auto 12px">${avatarInnerHtml(b, defaultBeastEmoji(b.type))}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(b.type)}${b.size ? ' · ' + escapeHtml(b.size) : ''} · КО ${escapeHtml(b.cr)}</div>
    ${b.habitat && b.habitat.length ? `<div class="meta" style="margin-bottom:8px;text-align:center">Обитание: ${escapeHtml(b.habitat.join(', '))}</div>` : ''}
    <div style="margin-bottom:8px">КД ${b.ac} · ХП ${escapeHtml(String(b.hp))}</div>
    <div style="margin-bottom:8px">Скорость: ${speedParts.join(', ')}</div>
    <div style="margin-bottom:8px;font-size:13px;color:var(--text-dim)">${abRow}</div>
    ${b.skills ? `<div style="margin-bottom:4px"><b>Навыки</b> ${escapeHtml(b.skills)}</div>` : ''}
    ${b.perception ? `<div style="margin-bottom:4px"><b>Восприятие (пассивное)</b> ${escapeHtml(b.perception)}</div>` : ''}
    ${b.languages ? `<div style="margin-bottom:8px"><b>Языки</b> ${escapeHtml(b.languages)}</div>` : ''}
    <div style="white-space:pre-wrap;margin-bottom:10px;font-size:15px;font-weight:500">${b.description || ''}</div>
    <div style="white-space:pre-wrap;font-size:15px;font-weight:500;background:var(--bg-elevated);padding:10px;border-radius:10px">${b.actions || ''}</div>
    ${spellsHtml}
    ${editBtn}
  `);
  document.querySelectorAll('[data-open-spell]').forEach(el => {
    el.addEventListener('click', () => openSpellDetail(el.dataset.openSpell, true));
  });
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
  const b = existing || { id: uid('b'), name: '', type: '', cr: '', size: 'Средний', habitat: [], ac: 10, hp: '', speed: '30 фт', flySpeed: '', swimSpeed: '', climbSpeed: '', skills: '', perception: '', languages: '', abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, actions: '', description: '', avatar: '', knownSpells: [], custom: true };
  if (!b.habitat) b.habitat = [];
  if (!b.knownSpells) b.knownSpells = [];
  if (b.flySpeed === undefined) b.flySpeed = '';
  if (b.swimSpeed === undefined) b.swimSpeed = '';
  if (b.climbSpeed === undefined) b.climbSpeed = '';
  if (b.skills === undefined) b.skills = '';
  if (b.perception === undefined) b.perception = '';
  if (b.languages === undefined) b.languages = '';
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
      <div><label>Скорость (по земле)</label><input id="bSpeed" value="${escapeAttr(b.speed)}"></div>
    </div>
    <div class="row">
      <div><label>Полёт</label><input id="bFlySpeed" value="${escapeAttr(b.flySpeed)}" placeholder="Например, 50 фт"></div>
      <div><label>Плавание</label><input id="bSwimSpeed" value="${escapeAttr(b.swimSpeed)}" placeholder="Например, 40 фт"></div>
    </div>
    <label>Лазанье (по стенам и т.п.)</label>
    <input id="bClimbSpeed" value="${escapeAttr(b.climbSpeed)}" placeholder="Например, 30 фт">
    <label>Размер</label>
    <select id="bSize">${sizeOptions}</select>
    <label>Обитание (можно выбрать несколько)</label>
    <div class="chip-row" id="bHabitatChips" style="flex-wrap:wrap">${habitatChips}</div>
    <label>Характеристики (СИЛ ЛОВ ТЕЛ ИНТ МДР ХАР через пробел)</label>
    <input id="bAbilities" value="${['str','dex','con','int','wis','cha'].map(k => b.abilities[k]).join(' ')}">
    <label>Навыки</label>
    <input id="bSkills" value="${escapeAttr(b.skills)}" placeholder="Например, Внимание +7, Магия +3">
    <label>Восприятие (пассивное)</label>
    <input id="bPerception" value="${escapeAttr(b.perception)}" placeholder="Например, 17">
    <label>Языки</label>
    <input id="bLanguages" value="${escapeAttr(b.languages)}" placeholder="Например, Общий, Ауран">
    <label>Описание</label>
    <div class="rich-toolbar" data-target="bDesc"></div>
    <div class="rich-editable" id="bDesc" contenteditable="true" data-placeholder="Описание существа">${b.description}</div>
    <label>Действия</label>
    <div class="rich-toolbar" data-target="bActions"></div>
    <div class="rich-editable" id="bActions" contenteditable="true" data-placeholder="Действия, атаки, особенности">${b.actions}</div>
    <label style="margin-top:6px">Заклинания (если существо владеет магией)</label>
    <div id="bKnownSpellsList"></div>
    <button type="button" class="secondary block" id="bAddSpellBtn">+ Добавить заклинание из каталога</button>
    <button class="primary block" id="saveBeast">Сохранить</button>
  `);
  bindRichToolbars();
  bindAvatarPicker('bAvatar', b, defaultBeastEmoji(b.type), () => {});
  const selectedHabitats = new Set(b.habitat);
  document.getElementById('bHabitatChips').querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const h = chip.dataset.h;
      if (selectedHabitats.has(h)) { selectedHabitats.delete(h); chip.classList.remove('active'); }
      else { selectedHabitats.add(h); chip.classList.add('active'); }
    });
  });

  function renderBeastSpellsInForm() {
    const wrap = document.getElementById('bKnownSpellsList');
    if (!b.knownSpells.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:10px 0">Заклинания не добавлены</div>';
      return;
    }
    wrap.innerHTML = b.knownSpells.map((spId, idx) => {
      const sp = state.spells.find(x => x.id === spId);
      if (!sp) return '';
      return `<div class="inv-item"><div data-open-sp="${sp.id}" style="cursor:pointer">${escapeHtml(sp.name)} <span style="color:var(--text-dim);font-size:11px">▸ подробнее</span></div><button type="button" data-idx="${idx}" data-act="del-sp">✕</button></div>`;
    }).join('');
    wrap.querySelectorAll('[data-open-sp]').forEach(el => {
      el.addEventListener('click', () => openSpellDetail(el.dataset.openSp, true));
    });
    wrap.querySelectorAll('[data-act="del-sp"]').forEach(btn => {
      btn.addEventListener('click', () => {
        b.knownSpells.splice(parseInt(btn.dataset.idx), 1);
        renderBeastSpellsInForm();
      });
    });
  }
  renderBeastSpellsInForm();

  document.getElementById('bAddSpellBtn').addEventListener('click', () => {
    const sorted = state.spells.slice().sort((a, b2) => a.level - b2.level || a.name.localeCompare(b2.name, 'ru'));
    openListPicker(true, 'Выберите заклинание', sorted,
      (sp) => `<div style="flex:1"><div>${escapeHtml(sp.name)}</div><div class="meta">${escapeHtml(sp.school)}</div></div><span class="badge">${sp.level === 0 ? 'Загов.' : 'Ур.' + sp.level}</span>`,
      (sp) => {
        if (!b.knownSpells.includes(sp.id)) b.knownSpells.push(sp.id);
        renderBeastSpellsInForm();
      },
      (sp, q) => sp.name.toLowerCase().includes(q)
    );
  });

  document.getElementById('saveBeast').addEventListener('click', () => {
    b.name = document.getElementById('bName').value.trim() || 'Без имени';
    b.type = document.getElementById('bType').value.trim();
    b.cr = document.getElementById('bCr').value.trim();
    b.ac = parseInt(document.getElementById('bAc').value) || 10;
    b.hp = document.getElementById('bHp').value.trim();
    b.speed = document.getElementById('bSpeed').value.trim();
    b.flySpeed = document.getElementById('bFlySpeed').value.trim();
    b.swimSpeed = document.getElementById('bSwimSpeed').value.trim();
    b.climbSpeed = document.getElementById('bClimbSpeed').value.trim();
    b.skills = document.getElementById('bSkills').value.trim();
    b.perception = document.getElementById('bPerception').value.trim();
    b.languages = document.getElementById('bLanguages').value.trim();
    b.size = document.getElementById('bSize').value;
    b.habitat = Array.from(selectedHabitats);
    b.avatar = b.avatar || defaultBeastEmoji(document.getElementById('bType').value.trim());
    const nums = document.getElementById('bAbilities').value.trim().split(/\s+/).map(n => parseInt(n) || 10);
    const keys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    keys.forEach((k, i) => { b.abilities[k] = nums[i] !== undefined ? nums[i] : 10; });
    b.description = document.getElementById('bDesc').innerHTML;
    b.actions = document.getElementById('bActions').innerHTML;
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

function openSpellDetail(id, aux) {
  const s = state.spells.find(x => x.id === id);
  const open = aux ? openAuxModal : openModal;
  const close = aux ? closeAuxModal : closeModal;
  playPageTurn();
  const editBtn = (s.custom && !aux) ? `<button class="secondary block" id="editSpell">Редактировать</button><button class="danger block" id="deleteSpell">Удалить</button>` : '';
  open(s.name, `
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
  if (s.custom && !aux) {
    document.getElementById('editSpell').addEventListener('click', () => openSpellForm(s));
    document.getElementById('deleteSpell').addEventListener('click', () => {
      if (!confirm('Удалить это заклинание?')) return;
      state.spells = state.spells.filter(x => x.id !== s.id);
      saveState();
      close();
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
  const sorted = state.spells.slice().sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, 'ru'));
  openListPicker(false, 'Выберите заклинание', sorted,
    (s) => `<div style="flex:1"><div>${escapeHtml(s.name)}</div><div class="meta">${escapeHtml(s.school)}${s.concentration ? ' · конц.' : ''}</div></div><span class="badge">${s.level === 0 ? 'Загов.' : 'Ур.' + s.level}</span>`,
    (s) => {
      const c = getChar(currentCharId);
      if (!c.knownSpells) c.knownSpells = [];
      if (!c.knownSpells.includes(s.id)) c.knownSpells.push(s.id);
      saveState();
      renderCharSpells(c);
    },
    (s, q) => s.name.toLowerCase().includes(q)
  );
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
      <div class="avatar-circle small">${avatarInnerHtml(it, defaultItemEmoji(it.name, it.type))}</div>
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

function armorSlotDescription(it) {
  if (it.armorSlot === 'light') return `🛡 КД: ${it.armorBaseAC} + модификатор Ловкости (без ограничения)`;
  if (it.armorSlot === 'medium') return `🛡 КД: ${it.armorBaseAC} + модификатор Ловкости (максимум +2)`;
  if (it.armorSlot === 'heavy') return `🛡 КД: ${it.armorBaseAC} (без модификатора Ловкости)`;
  if (it.armorSlot === 'flat' && it.acBonus) return `🛡 Бонус к КД при экипировке: +${it.acBonus}`;
  return '';
}

function openItemDetail(id) {
  const it = state.items.find(x => x.id === id);
  playPageTurn();
  const editBtn = it.custom ? `<button class="secondary block" id="editItem">Редактировать</button><button class="danger block" id="deleteItem">Удалить</button>` : '';
  const armorDesc = armorSlotDescription(it);
  openModal(it.name, `
    <div class="avatar-circle large" style="margin:0 auto 12px">${avatarInnerHtml(it, defaultItemEmoji(it.name, it.type))}</div>
    <div class="meta" style="color:var(--text-dim);margin-bottom:8px;text-align:center">${escapeHtml(it.type)}${it.rarity ? ' · ' + escapeHtml(it.rarity) : ''} · ${escapeHtml(it.weight || '')} · ${escapeHtml(it.cost || '')}</div>
    ${armorDesc ? `<div style="margin-bottom:8px">${armorDesc}</div>` : ''}
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
  const it = existing || { id: uid('i'), name: '', type: '', weight: '', cost: '', properties: '', armorSlot: 'none', armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: 'Обычный', avatar: '', custom: true };
  if (!it.rarity) it.rarity = 'Обычный';
  if (!it.armorSlot) it.armorSlot = it.acBonus ? 'flat' : 'none'; // обратная совместимость со старыми предметами
  const rarityOptions = RARITIES.map(r => `<option ${r === it.rarity ? 'selected' : ''}>${r}</option>`).join('');
  const armorSlotOptions = ARMOR_SLOTS.map(s => `<option value="${s.id}" ${s.id === it.armorSlot ? 'selected' : ''}>${s.label}</option>`).join('');
  openModal(existing ? 'Редактировать предмет' : 'Новый предмет', `
    <div style="text-align:center;margin-bottom:10px">${avatarPickerHtml('itAvatar', it, defaultItemEmoji(it.name, it.type), true)}</div>
    <label>Название</label><input id="itName" value="${escapeAttr(it.name)}">
    <label>Тип</label><input id="itType" value="${escapeAttr(it.type)}" placeholder="Оружие / Броня / Снаряжение">
    <label>Редкость</label>
    <select id="itRarity">${rarityOptions}</select>
    <div class="row">
      <div><label>Вес</label><input id="itWeight" value="${escapeAttr(it.weight)}"></div>
      <div><label>Цена</label><input id="itCost" value="${escapeAttr(it.cost)}"></div>
    </div>
    <label>Влияние на КД при экипировке</label>
    <select id="itArmorSlot">${armorSlotOptions}</select>
    <div class="row" id="itArmorBaseRow" style="display:${it.armorSlot === 'light' || it.armorSlot === 'medium' || it.armorSlot === 'heavy' ? 'flex' : 'none'}">
      <div><label>Базовое значение КД</label><input id="itArmorBaseAC" type="number" value="${it.armorBaseAC || 0}"></div>
    </div>
    <div class="row" id="itFlatBonusRow" style="display:${it.armorSlot === 'flat' ? 'flex' : 'none'}">
      <div><label>Бонус к КД</label><input id="itAcBonus" type="number" value="${it.acBonus || 0}"></div>
    </div>
    <div class="row">
      <div><label>Бонус к атаке (для оружия)</label><input id="itAtkBonus" type="number" value="${it.atkBonus || 0}"></div>
    </div>
    <label>Свойства / описание</label><textarea id="itProps">${escapeHtml(it.properties)}</textarea>
    <button class="primary block" id="saveItem">Сохранить</button>
  `);
  bindAvatarPicker('itAvatar', it, defaultItemEmoji(it.name, it.type), () => {});
  document.getElementById('itArmorSlot').addEventListener('change', (e) => {
    const v = e.target.value;
    document.getElementById('itArmorBaseRow').style.display = (v === 'light' || v === 'medium' || v === 'heavy') ? 'flex' : 'none';
    document.getElementById('itFlatBonusRow').style.display = (v === 'flat') ? 'flex' : 'none';
  });
  document.getElementById('saveItem').addEventListener('click', () => {
    it.name = document.getElementById('itName').value.trim() || 'Без названия';
    it.type = document.getElementById('itType').value.trim() || 'Снаряжение';
    it.rarity = document.getElementById('itRarity').value;
    it.weight = document.getElementById('itWeight').value.trim();
    it.cost = document.getElementById('itCost').value.trim();
    it.armorSlot = document.getElementById('itArmorSlot').value;
    it.armorBaseAC = parseInt(document.getElementById('itArmorBaseAC').value) || 0;
    it.acBonus = parseInt(document.getElementById('itAcBonus').value) || 0;
    it.atkBonus = parseInt(document.getElementById('itAtkBonus').value) || 0;
    it.avatar = it.avatar || defaultItemEmoji(document.getElementById('itName').value.trim(), document.getElementById('itType').value.trim());
    it.properties = document.getElementById('itProps').value;
    it.custom = true;
    if (!state.items.find(x => x.id === it.id)) state.items.push(it);
    saveState();
    closeModal();
    renderItems();
    showToast('Сохранено');
  });
}

// ==================== BATTLE TRACKER ====================
function sortedCombatants() {
  return state.battle.combatants
    .map((c, idx) => ({ ...c, _idx: idx }))
    .sort((a, b) => b.initiative - a.initiative);
}

function renderBattle() {
  document.getElementById('battleRound').textContent = state.battle.round;
  const list = document.getElementById('battleList');
  const empty = document.getElementById('battleEmpty');
  const ordered = sortedCombatants();
  if (!ordered.length) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }
  empty.style.display = 'none';
  const curId = ordered[state.battle.currentIndex] ? ordered[state.battle.currentIndex]._idx : -1;
  list.innerHTML = ordered.map((c) => `
    <div class="list-item ${c._idx === curId ? 'current-turn' : ''}" style="cursor:default">
      <div class="avatar-circle small">${escapeHtml(c.avatar || '⚔️')}</div>
      <div style="flex:1">
        <div>${escapeHtml(c.name)} ${c._idx === curId ? '▶' : ''}</div>
        <div class="meta">Иниц. ${c.initiative} · КД ${c.ac}</div>
      </div>
      <div class="row" style="flex:none;gap:4px;align-items:center">
        <button data-idx="${c._idx}" data-act="hpdown">−</button>
        <input type="number" class="battle-hp-input" data-idx="${c._idx}" data-act="hpval" value="${c.hp}">
        <span class="meta">/${c.maxHp}</span>
        <button data-idx="${c._idx}" data-act="hpup">+</button>
        <button data-idx="${c._idx}" data-act="del">✕</button>
      </div>
    </div>
  `).join('');
  list.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.idx);
      const c = state.battle.combatants[idx];
      if (btn.dataset.act === 'hpup') c.hp = Math.min(c.maxHp, c.hp + 1);
      if (btn.dataset.act === 'hpdown') c.hp = Math.max(0, c.hp - 1);
      if (btn.dataset.act === 'del') {
        state.battle.combatants.splice(idx, 1);
        if (state.battle.currentIndex >= state.battle.combatants.length) state.battle.currentIndex = 0;
        playChainClink();
      }
      saveState();
      renderBattle();
    });
  });
  list.querySelectorAll('input[data-act="hpval"]').forEach(inp => {
    inp.addEventListener('input', () => {
      const idx = parseInt(inp.dataset.idx);
      const c = state.battle.combatants[idx];
      c.hp = Math.max(0, Math.min(c.maxHp, parseInt(inp.value) || 0));
      saveState();
    });
  });
}

document.getElementById('nextTurnBtn').addEventListener('click', () => {
  if (!state.battle.combatants.length) return;
  state.battle.currentIndex++;
  if (state.battle.currentIndex >= state.battle.combatants.length) {
    state.battle.currentIndex = 0;
    state.battle.round++;
  }
  saveState();
  renderBattle();
  playDiceRoll();
});

document.getElementById('resetBattleBtn').addEventListener('click', () => {
  if (!confirm('Убрать всех участников и сбросить раунд?')) return;
  state.battle = { combatants: [], currentIndex: 0, round: 1 };
  saveState();
  renderBattle();
});

function openCombatantForm() {
  const charOptions = state.characters.map(c => `<option value="char:${c.id}">${escapeHtml(c.name)}</option>`).join('');
  const beastOptions = state.bestiary.map(b => `<option value="beast:${b.id}">${escapeHtml(b.name)}</option>`).join('');
  openModal('Добавить участника', `
    <label>Быстро добавить из персонажей/бестиария</label>
    <select id="cbQuickPick">
      <option value="">— выбрать —</option>
      ${charOptions ? `<optgroup label="Персонажи">${charOptions}</optgroup>` : ''}
      ${beastOptions ? `<optgroup label="Существа">${beastOptions}</optgroup>` : ''}
    </select>
    <label>Имя</label><input id="cbName" placeholder="Например, Гоблин №1">
    <div class="row">
      <div><label>ХП (максимум)</label><input id="cbHp" type="number" value="10"></div>
      <div><label>КД</label><input id="cbAc" type="number" value="10"></div>
    </div>
    <label>Инициатива</label><input id="cbInit" type="number" value="10">
    <button class="primary block" id="cbSaveBtn">Добавить в бой</button>
  `);
  document.getElementById('cbQuickPick').addEventListener('change', (e) => {
    const [kind, id] = e.target.value.split(':');
    if (kind === 'char') {
      const c = getChar(id);
      document.getElementById('cbName').value = c.name;
      document.getElementById('cbHp').value = c.hp.max;
      document.getElementById('cbAc').value = c.ac;
    } else if (kind === 'beast') {
      const b = state.bestiary.find(x => x.id === id);
      document.getElementById('cbName').value = b.name;
      const hpNum = parseInt(String(b.hp).match(/\d+/)?.[0]) || 10;
      document.getElementById('cbHp').value = hpNum;
      document.getElementById('cbAc').value = b.ac;
    }
  });
  document.getElementById('cbSaveBtn').addEventListener('click', () => {
    const name = document.getElementById('cbName').value.trim() || 'Участник';
    const maxHp = parseInt(document.getElementById('cbHp').value) || 10;
    const ac = parseInt(document.getElementById('cbAc').value) || 10;
    const initiative = parseInt(document.getElementById('cbInit').value) || 0;
    state.battle.combatants.push({ name, hp: maxHp, maxHp, ac, initiative, avatar: '⚔️' });
    saveState();
    closeModal();
    renderBattle();
    showToast('Добавлено в бой');
  });
}

// ==================== BOOKS (PDF) ====================
function renderBooks() {
  const list = document.getElementById('booksList');
  const empty = document.getElementById('booksEmpty');
  getAllBooks().then((books) => {
    if (!books.length) {
      list.innerHTML = '';
      empty.style.display = 'block';
      return;
    }
    empty.style.display = 'none';
    list.innerHTML = books.map(b => `
      <div class="list-item" data-id="${b.id}">
        <div class="avatar-circle small">📕</div>
        <div style="flex:1">
          <div>${escapeHtml(b.name)}</div>
          <div class="meta">${formatFileSize(b.size)}</div>
        </div>
        <button type="button" data-id="${b.id}" data-act="delbook" class="secondary" style="padding:6px 10px;font-size:11px">✕</button>
      </div>
    `).join('');
    list.querySelectorAll('.list-item').forEach(el => {
      el.addEventListener('click', (e) => {
        if (e.target.closest('[data-act="delbook"]')) return;
        openBookViewer(el.dataset.id, books);
      });
    });
    list.querySelectorAll('[data-act="delbook"]').forEach(btn => {
      btn.addEventListener('click', () => {
        if (!confirm('Удалить эту книгу?')) return;
        deleteBookById(btn.dataset.id).then(() => { playChainClink(); renderBooks(); });
      });
    });
  }).catch(() => {
    list.innerHTML = '<div class="empty-state">Не удалось загрузить список книг</div>';
  });
}

// ==================== PDF VIEWER (pdf.js, рендер на canvas) ====================
// pdf.js подключён через <script> с CDN в index.html — грузится браузером
// пользователя при открытии сайта, а не требует ничего от нас на этапе сборки.
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let pdfCurrentDoc = null;
let pdfCurrentPageNum = 1;
let pdfCurrentScale = 1.2;

function openBookViewer(id, books) {
  const book = books.find(b => b.id === id);
  if (!book) return;
  if (typeof pdfjsLib === 'undefined') {
    showToast('Не удалось загрузить модуль чтения PDF — проверьте подключение к интернету при первом открытии книги');
    return;
  }
  document.getElementById('pdfViewerTitle').textContent = book.name;
  document.getElementById('pdfCanvas').style.display = 'none';
  document.getElementById('pdfLoading').style.display = 'block';
  document.getElementById('pdfLoading').textContent = 'Открываем книгу…';
  document.getElementById('pdfPageIndicator').textContent = '— / —';
  switchView('pdf-viewer');

  book.blob.arrayBuffer().then((buf) => {
    return pdfjsLib.getDocument({ data: buf }).promise;
  }).then((pdf) => {
    pdfCurrentDoc = pdf;
    pdfCurrentPageNum = 1;
    // Стартовый масштаб подбираем так, чтобы страница по ширине заполняла экран,
    // а не был на глаз зафиксирован — иначе на разных телефонах либо мелко, либо обрезано
    return pdf.getPage(1).then((page) => {
      const naturalWidth = page.getViewport({ scale: 1 }).width;
      const wrap = document.getElementById('pdfCanvasWrap');
      const availableWidth = wrap.clientWidth - 20; // минус внутренние отступы
      pdfCurrentScale = Math.max(0.5, availableWidth / naturalWidth);
      renderPdfPage(pdfCurrentPageNum);
    });
  }).catch((err) => {
    console.error(err);
    document.getElementById('pdfLoading').textContent = 'Не удалось открыть файл — возможно, он повреждён';
  });
}

function renderPdfPage(num) {
  if (!pdfCurrentDoc) return;
  pdfCurrentDoc.getPage(num).then((page) => {
    const viewport = page.getViewport({ scale: pdfCurrentScale });
    const canvas = document.getElementById('pdfCanvas');
    const ctx = canvas.getContext('2d');
    // Рендерим с учётом плотности пикселей экрана (devicePixelRatio) — иначе на
    // современных телефонах (обычно ×2–×3) текст на canvas выглядит смазанным
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * dpr);
    canvas.height = Math.floor(viewport.height * dpr);
    canvas.style.width = viewport.width + 'px';
    canvas.style.height = viewport.height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    page.render({ canvasContext: ctx, viewport }).promise.then(() => {
      document.getElementById('pdfLoading').style.display = 'none';
      canvas.style.display = 'block';
      document.getElementById('pdfPageIndicator').textContent = `${num} / ${pdfCurrentDoc.numPages}`;
    });
  });
}

document.getElementById('pdfPrevBtn').addEventListener('click', () => {
  if (!pdfCurrentDoc || pdfCurrentPageNum <= 1) return;
  pdfCurrentPageNum--;
  renderPdfPage(pdfCurrentPageNum);
});
document.getElementById('pdfNextBtn').addEventListener('click', () => {
  if (!pdfCurrentDoc || pdfCurrentPageNum >= pdfCurrentDoc.numPages) return;
  pdfCurrentPageNum++;
  renderPdfPage(pdfCurrentPageNum);
});
document.getElementById('pdfZoomInBtn').addEventListener('click', () => {
  if (!pdfCurrentDoc) return;
  pdfCurrentScale = Math.min(3, pdfCurrentScale + 0.25);
  renderPdfPage(pdfCurrentPageNum);
});
document.getElementById('pdfZoomOutBtn').addEventListener('click', () => {
  if (!pdfCurrentDoc) return;
  pdfCurrentScale = Math.max(0.5, pdfCurrentScale - 0.25);
  renderPdfPage(pdfCurrentPageNum);
});
document.getElementById('pdfBackBtn').addEventListener('click', () => {
  pdfCurrentDoc = null;
  switchView('books');
});

document.getElementById('addBookBtn').addEventListener('click', () => {
  document.getElementById('bookFileInput').click();
});
document.getElementById('bookFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type !== 'application/pdf') { showToast('Нужен файл в формате PDF'); return; }
  showToast('Загружаем книгу…');
  addBookFile(file).then(() => {
    playPageTurn();
    showToast('Книга добавлена');
    renderBooks();
  }).catch(() => {
    showToast('Не удалось сохранить файл — возможно, не хватает места');
  });
  e.target.value = '';
});

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
document.getElementById('rulesLinkBtn').addEventListener('click', () => window.open('https://next.dnd.su/', '_blank', 'noopener'));

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

// ==================== DICE ROLLER (SVG-кубики со скинами) ====================
const DICE_TYPES = [4, 6, 8, 10, 12, 20, 100];
let diceHistory = [];
let selectedDie = 20;

const DICE_SKINS = {
  ruby: { label: 'Рубиновый', stops: ['#3a030f', '#d81e3f', '#7a0d1f'], rim: '#e0b13f', text: '#fff5e0' },
  gold: { label: 'Золотой', stops: ['#4a3608', '#e0b13f', '#8a6a1c'], rim: '#fff2c9', text: '#2a1c04' },
  emerald: { label: 'Изумрудный', stops: ['#04331e', '#2e9e63', '#0d4a2d'], rim: '#d7f5e3', text: '#eafff3' },
  amethyst: { label: 'Аметистовый', stops: ['#220433', '#8a4fd8', '#3a0d6e'], rim: '#e3c9ff', text: '#f5e9ff' },
  obsidian: { label: 'Обсидиановый', stops: ['#050506', '#2a2a33', '#0a0a0d'], rim: '#4fd8d8', text: '#e8ffff' }
};
const DICE_SKIN_IDS = Object.keys(DICE_SKINS);

function currentDiceSkin() {
  return state.settings.diceSkin && DICE_SKINS[state.settings.diceSkin] ? state.settings.diceSkin : 'ruby';
}

// Точки многоугольника для каждого типа кости (viewBox 100×100)
function diePolygonPoints(sides) {
  switch (sides) {
    case 4: return '50,8 90,85 10,85';
    case 8: return '50,5 90,50 50,95 10,50';
    case 10: return '50,5 78,25 70,95 30,95 22,25';
    case 12: return '50,5 90,38 75,90 25,90 10,38';
    case 20: case 100: return '50,5 90,27 90,73 50,95 10,73 10,27';
    default: return '';
  }
}

function buildDieSvg(sides, skinId, faceLabel) {
  const skin = DICE_SKINS[skinId] || DICE_SKINS.ruby;
  const gradId = 'dieGrad_' + skinId;
  const gradientStops = `<stop offset="0%" stop-color="${skin.stops[0]}"/><stop offset="55%" stop-color="${skin.stops[1]}"/><stop offset="100%" stop-color="${skin.stops[2]}"/>`;
  const bodyShape = sides === 6
    ? `<rect x="12" y="12" width="76" height="76" rx="14" fill="url(#${gradId})" stroke="${skin.rim}" stroke-width="3"/>`
    : `<polygon points="${diePolygonPoints(sides)}" fill="url(#${gradId})" stroke="${skin.rim}" stroke-width="3" stroke-linejoin="round"/>`;
  const showFacets = sides === 20 || sides === 100;
  let facets = '';
  let flavorNumbers = '';
  if (showFacets) {
    const pts = diePolygonPoints(sides).split(' ').map(p => p.split(',').map(Number));
    facets = pts.map(([x, y]) => `<line x1="50" y1="50" x2="${x}" y2="${y}" stroke="${skin.rim}" stroke-width="1" opacity="0.45"/>`).join('');
    // Декоративные "соседние грани" вокруг центральной — как у настоящего гранёного кубика.
    // Числа фиксированные (это просто внешний вид граней, а не реальный результат броска)
    const flavors = [4, 14, 9, 16, 10, 18];
    flavorNumbers = pts.map(([x, y], i) => {
      const [nx, ny] = pts[(i + 1) % pts.length];
      const tx = (x + nx + 50) / 3, ty = (y + ny + 50) / 3;
      return `<text x="${tx}" y="${ty}" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="${skin.text}" opacity="0.4" font-family="'Cinzel', serif">${flavors[i]}</text>`;
    }).join('');
  }
  // Размер шрифта подстраивается под количество цифр — иначе трёхзначные
  // числа (например, 100 или сумма нескольких костей) вылезают за грань
  const digits = String(faceLabel).length;
  const fontSize = digits >= 4 ? 20 : digits === 3 ? 24 : (showFacets ? 34 : 30);
  return `<svg viewBox="0 0 100 100" width="170" height="170" class="die-svg">
    <defs><linearGradient id="${gradId}" x1="0%" y1="0%" x2="100%" y2="100%">${gradientStops}</linearGradient></defs>
    ${bodyShape}${facets}${flavorNumbers}
    <text x="50" y="52" text-anchor="middle" dominant-baseline="central" font-size="${fontSize}" font-weight="800" fill="${skin.text}" font-family="'Cinzel', serif">${faceLabel}</text>
  </svg>`;
}

function renderDieDisplay(faceValue) {
  const wrap = document.getElementById('dieDisplayWrap');
  if (!wrap) return;
  // Раньше здесь была жёстко зашита заглушка "00" для d100 — теперь всегда
  // показываем реальное переданное значение
  wrap.innerHTML = buildDieSvg(selectedDie, currentDiceSkin(), String(faceValue));
}

function triggerCritEffect(kind) {
  const wrap = document.getElementById('dieDisplayWrap');
  if (!wrap) return;
  wrap.classList.remove('die-crit-gold', 'die-crit-fail');
  void wrap.offsetWidth; // рестарт CSS-анимации
  wrap.classList.add(kind === 'crit' ? 'die-crit-gold' : 'die-crit-fail');
  setTimeout(() => wrap.classList.remove('die-crit-gold', 'die-crit-fail'), 900);
}

function animateDiceRoll(finalValue, onDone) {
  const wrap = document.getElementById('dieDisplayWrap');
  if (!wrap) { onDone(); return; }
  wrap.classList.add('die-shaking');
  let ticks = 0;
  const maxTicks = 10;
  const timer = setInterval(() => {
    ticks++;
    const randomFace = 1 + Math.floor(Math.random() * selectedDie);
    renderDieDisplay(randomFace);
    if (ticks >= maxTicks) {
      clearInterval(timer);
      wrap.classList.remove('die-shaking');
      renderDieDisplay(finalValue);
      onDone();
    }
  }, 60);
}

function openDiceRoller() {
  renderDiceModal();
}

let diceModifier = 0;
let diceAdvMode = 'none'; // 'none' | 'adv' | 'dis' — работает только для одиночного d20

function renderDiceModal() {
  const buttons = DICE_TYPES.map(d => `<button type="button" class="chip dice-btn ${d === selectedDie ? 'active' : ''}" data-d="${d}">d${d}</button>`).join('');
  const skinSwatches = DICE_SKIN_IDS.map(id => {
    const s = DICE_SKINS[id];
    const grad = `linear-gradient(160deg, ${s.stops[0]}, ${s.stops[1]}, ${s.stops[2]})`;
    return `<button type="button" class="dice-skin-swatch ${currentDiceSkin() === id ? 'is-selected' : ''}" data-skin="${id}" style="background:${grad};border-color:${s.rim}" title="${s.label}"></button>`;
  }).join('');
  const historyHtml = diceHistory.length
    ? diceHistory.slice(0, 12).map(h => `<div class="skill-row"><span>${h.label}</span><span class="mod">${h.total}${h.rolls ? ' (' + h.rolls.join('+') + (h.mod ? (h.mod > 0 ? '+' + h.mod : h.mod) : '') + ')' : ''}</span></div>`).join('')
    : '<div class="empty-state" style="padding:10px 0">Пока не было бросков</div>';
  openModal('Кубики', `
    <div class="chip-row dice-skin-row">${skinSwatches}</div>
    <div class="chip-row" id="diceButtons" style="flex-wrap:wrap">${buttons}</div>
    <div class="die-display-outer">
      <div id="dieDisplayWrap" class="die-display-wrap"></div>
    </div>
    <label style="text-align:center">Количество костей</label>
    <input id="diceCount" type="number" min="1" max="20" value="1" style="text-align:center;margin-bottom:10px">
    <div class="dice-mod-row">
      <span class="dice-mod-label">Модификатор</span>
      <div class="dice-mod-stepper">
        <button type="button" class="dice-mod-btn" id="diceModDec">−</button>
        <span class="dice-mod-value" id="diceModValue">${fmtMod(diceModifier)}</span>
        <button type="button" class="dice-mod-btn" id="diceModInc">+</button>
      </div>
    </div>
    <div class="dice-adv-row">
      <span class="dice-adv-label">Преимущество / Помеха</span>
      <div class="dice-adv-toggle">
        <button type="button" class="dice-adv-btn ${diceAdvMode === 'none' ? 'active' : ''}" data-adv="none">Обычно</button>
        <button type="button" class="dice-adv-btn ${diceAdvMode === 'adv' ? 'active' : ''}" data-adv="adv">Преим.</button>
        <button type="button" class="dice-adv-btn ${diceAdvMode === 'dis' ? 'active' : ''}" data-adv="dis">Помеха</button>
      </div>
    </div>
    <button class="roll-dice-gold-btn" id="rollDiceBtn">⚅ Бросить</button>
    <div class="section-title" style="margin-top:10px">История</div>
    <div id="diceHistoryList">${historyHtml}</div>
  `);
  renderDieDisplay(selectedDie === 100 ? 0 : selectedDie);

  document.querySelectorAll('.dice-skin-swatch').forEach(btn => {
    btn.addEventListener('click', () => {
      state.settings.diceSkin = btn.dataset.skin;
      saveState();
      document.querySelectorAll('.dice-skin-swatch').forEach(b => b.classList.toggle('is-selected', b === btn));
      renderDieDisplay(selectedDie === 100 ? 0 : selectedDie);
      playFormatClick();
    });
  });
  document.querySelectorAll('.dice-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedDie = parseInt(btn.dataset.d);
      document.querySelectorAll('.dice-btn').forEach(b => b.classList.toggle('active', parseInt(b.dataset.d) === selectedDie));
      renderDieDisplay(selectedDie === 100 ? 0 : selectedDie);
    });
  });
  document.getElementById('diceModDec').addEventListener('click', () => {
    diceModifier--;
    document.getElementById('diceModValue').textContent = fmtMod(diceModifier);
    playFormatClick();
  });
  document.getElementById('diceModInc').addEventListener('click', () => {
    diceModifier++;
    document.getElementById('diceModValue').textContent = fmtMod(diceModifier);
    playFormatClick();
  });
  document.querySelectorAll('.dice-adv-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      diceAdvMode = btn.dataset.adv;
      document.querySelectorAll('.dice-adv-btn').forEach(b => b.classList.toggle('active', b === btn));
      playFormatClick();
    });
  });
  document.getElementById('rollDiceBtn').addEventListener('click', () => {
    const modifier = diceModifier;
    const useAdv = diceAdvMode !== 'none' && selectedDie === 20;
    let rolls, label;
    if (useAdv) {
      const r1 = 1 + Math.floor(Math.random() * 20);
      const r2 = 1 + Math.floor(Math.random() * 20);
      const picked = diceAdvMode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
      rolls = [picked];
      label = `d20 ${diceAdvMode === 'adv' ? '(преим.)' : '(помеха)'}${modifier ? (modifier > 0 ? '+' + modifier : modifier) : ''} [${r1},${r2}]`;
    } else {
      const count = Math.max(1, Math.min(20, parseInt(document.getElementById('diceCount').value) || 1));
      rolls = [];
      for (let i = 0; i < count; i++) rolls.push(1 + Math.floor(Math.random() * selectedDie));
      label = `${count}к${selectedDie}${modifier ? (modifier > 0 ? '+' + modifier : modifier) : ''}`;
    }
    const total = rolls.reduce((a, b) => a + b, 0) + modifier;
    playDiceRoll();
    animateDiceRoll(total, () => {
      diceHistory.unshift({ label, total, rolls, mod: modifier });
      document.getElementById('diceHistoryList').innerHTML = diceHistory.slice(0, 12).map(h => `<div class="skill-row"><span>${h.label}</span><span class="mod">${h.total}${h.rolls.length > 1 || h.mod ? ' (' + h.rolls.join('+') + (h.mod ? (h.mod > 0 ? '+' + h.mod : h.mod) : '') + ')' : ''}</span></div>`).join('');
      if (selectedDie === 20 && rolls.length === 1) {
        if (rolls[0] === 20) triggerCritEffect('crit');
        else if (rolls[0] === 1) triggerCritEffect('fail');
      }
    });
  });
}

document.getElementById('diceBtn').addEventListener('click', openDiceRoller);

// ==================== EXPANDABLE TEXT EDITOR ====================
document.querySelectorAll('.expand-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const targetId = btn.dataset.target;
    const source = document.getElementById(targetId);
    const isRich = source.classList.contains('rich-editable');
    const label = btn.closest('h3, label').textContent.replace('⤢', '').replace('Развернуть', '').trim() || 'Текст';
    if (isRich) {
      openModal(label, `
        <div class="rich-toolbar" id="expandedToolbar" data-target="expandedRich"></div>
        <div id="expandedRich" class="rich-editable expanded-editor-rich" contenteditable="true">${source.innerHTML}</div>
        <button class="primary block" id="expandedDoneBtn" style="margin-top:10px">✓ Готово</button>
      `);
      bindRichToolbars();
      const expanded = document.getElementById('expandedRich');
      expanded.focus();
      expanded.addEventListener('input', () => {
        source.innerHTML = expanded.innerHTML;
        source.dispatchEvent(new Event('input'));
      });
      document.getElementById('expandedDoneBtn').addEventListener('click', closeModal);
    } else {
      openModal(label, `<textarea id="expandedTextarea" class="expanded-editor-textarea">${escapeHtml(source.value)}</textarea>`);
      const expanded = document.getElementById('expandedTextarea');
      expanded.focus();
      expanded.addEventListener('input', () => {
        source.value = expanded.value;
        source.dispatchEvent(new Event('input'));
      });
    }
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

// Числовые поля: выделяем текущее значение целиком при фокусе,
// чтобы ввод новой цифры не превращался в "03" или "103"
document.addEventListener('focus', (e) => {
  if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'number') {
    e.target.select();
  }
}, true);

// ==================== INIT ====================
renderCharList();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
