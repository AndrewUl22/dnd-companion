// Стартовые данные приложения. Всё это можно редактировать через "Настройки > Импорт/Экспорт",
// а пользовательский контент добавляется прямо из интерфейса и хранится в localStorage.

const DEFAULT_RACES = [
  "Человек", "Эльф", "Полуэльф", "Дворф", "Полурослик", "Тифлинг",
  "Драконорождённый", "Гном", "Полуорк"
];

const DEFAULT_CLASSES = [
  "Воин", "Волшебник", "Плут", "Жрец", "Варвар", "Бард",
  "Друид", "Монах", "Паладин", "Следопыт", "Колдун", "Чародей",
  "Изобретатель", "Псионик"
];

const SKILL_LIST = [
  { name: "Акробатика", ability: "dex" },
  { name: "Анализ", ability: "int" },
  { name: "Атлетика", ability: "str" },
  { name: "Восприятие", ability: "wis" },
  { name: "Выступление", ability: "cha" },
  { name: "Выживание", ability: "wis" },
  { name: "Запугивание", ability: "cha" },
  { name: "История", ability: "int" },
  { name: "Ловкость рук", ability: "dex" },
  { name: "Магия", ability: "int" },
  { name: "Медицина", ability: "wis" },
  { name: "Обман", ability: "cha" },
  { name: "Природа", ability: "int" },
  { name: "Проницательность", ability: "wis" },
  { name: "Религия", ability: "int" },
  { name: "Скрытность", ability: "dex" },
  { name: "Убеждение", ability: "cha" },
  { name: "Уход за животными", ability: "wis" }
];

const DEFAULT_BESTIARY = [
  {
    id: "b_goblin",
    name: "Гоблин",
    type: "Гуманоид",
    subtype: "гоблиноид",
    cr: "1/4",
    size: "Маленький",
    habitat: ["Лес", "Подземье", "Холмы"],
    ac: 15,
    hp: "2к6",
    speed: "30 фт",
    abilities: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
    actions: "Скимитар: +4 к попаданию, 1к6+2 режущего урона.\nКороткий лук: +4 к попаданию, 1к6+2 колющего урона.",
    description: "Мелкие злобные гуманоиды, живущие стаями в пещерах и руинах.",
    custom: false
  },
  {
    id: "b_wolf",
    name: "Волк",
    type: "Зверь",
    cr: "1/4",
    size: "Средний",
    habitat: ["Лес", "Равнина", "Горы", "Арктика"],
    ac: 13,
    hp: "2к8+2",
    speed: "40 фт",
    abilities: { str: 12, dex: 15, con: 12, int: 3, wis: 12, cha: 6 },
    actions: "Укус: +4 к попаданию, 2к4+2 колющего урона, цель должна пройти спасбросок Силы иначе будет сбита с ног.",
    description: "Охотится стаями, использует численное превосходство и тактику окружения.",
    custom: false
  },
  {
    id: "b_orc",
    name: "Орк",
    type: "Гуманоид",
    subtype: "орк",
    cr: "1/2",
    size: "Средний",
    habitat: ["Горы", "Холмы", "Равнина"],
    ac: 13,
    hp: "15 (2к8+6)",
    speed: "30 фт",
    abilities: { str: 16, dex: 12, con: 16, int: 7, wis: 11, cha: 10 },
    actions: "Большой топор: +5 к попаданию, 1к12+3 рубящего урона.\nПометка яростью: при провале первой атаки в бою может совершить ещё одну.",
    description: "Свирепые воины, объединяющиеся в военные отряды под предводительством вождей.",
    custom: false
  }
];

const SPELL_SCHOOLS = [
  "Преобразование", "Вызов", "Некромантия", "Ограждение",
  "Прорицание", "Иллюзия", "Очарование", "Воплощение"
];

// classes здесь ссылаются на DEFAULT_CLASSES (по названию)
const DEFAULT_SPELLS = [
  { id: "sp_fire_bolt", name: "Огненный снаряд", level: 0, school: "Воплощение", time: "1 действие", range: "36 м", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Метательный сгусток пламени по одной цели в пределах дистанции, наносит урон огнём. С ростом уровня персонажа урон увеличивается.", custom: false },
  { id: "sp_mage_hand", name: "Волшебная рука", level: 0, school: "Преобразование", time: "1 действие", range: "9 м", components: "В, С", duration: "1 минута", concentration: false, ritual: false, classes: ["Волшебник", "Чародей", "Колдун", "Бард"], description: "Создаёт призрачную парящую руку, способную перемещать, брать и открывать лёгкие предметы на расстоянии.", custom: false },
  { id: "sp_light", name: "Свет", level: 0, school: "Воплощение", time: "1 действие", range: "Касание", components: "В, М", duration: "1 час", concentration: false, ritual: false, classes: ["Бард", "Жрец", "Волшебник"], description: "Предмет, к которому прикоснулись, начинает испускать яркий свет в небольшом радиусе.", custom: false },
  { id: "sp_guidance", name: "Наставление", level: 0, school: "Прорицание", time: "1 действие", range: "Касание", components: "В, С", duration: "1 минута", concentration: true, ritual: false, classes: ["Жрец", "Друид"], description: "Цель получает бонус к одной проверке характеристики по своему выбору, пока действует заклинание.", custom: false },
  { id: "sp_sacred_flame", name: "Священное пламя", level: 0, school: "Воплощение", time: "1 действие", range: "18 м", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Жрец"], description: "Столб искрящегося света обрушивается на существо, цель совершает спасбросок Ловкости или получает урон излучением.", custom: false },
  { id: "sp_minor_illusion", name: "Малая иллюзия", level: 0, school: "Иллюзия", time: "1 действие", range: "9 м", components: "С, М", duration: "1 минута", concentration: false, ritual: false, classes: ["Бард", "Колдун", "Волшебник"], description: "Создаёт безобидную иллюзию звука или образа предмета в пределах дистанции.", custom: false },

  { id: "sp_magic_missile", name: "Волшебная стрела", level: 1, school: "Воплощение", time: "1 действие", range: "36 м", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Создаёт три светящихся снаряда силовой энергии, каждый бьёт по отдельной цели и наносит урон, не требуя броска атаки.", custom: false },
  { id: "sp_shield", name: "Щит", level: 1, school: "Ограждение", time: "1 реакция", range: "На себя", components: "В, С", duration: "1 раунд", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Невидимый барьер силы резко повышает класс доспеха заклинателя до начала следующего хода и защищает от волшебной стрелы.", custom: false },
  { id: "sp_cure_wounds", name: "Лечение ран", level: 1, school: "Воплощение", time: "1 действие", range: "Касание", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Жрец", "Друид", "Бард", "Паладин", "Следопыт"], description: "Существо, которого коснулся заклинатель, восстанавливает некоторое количество хитов.", custom: false },
  { id: "sp_healing_word", name: "Исцеляющее слово", level: 1, school: "Воплощение", time: "1 бонусное действие", range: "18 м", components: "В", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Жрец", "Друид", "Бард"], description: "Произнесённое слово силы восстанавливает хиты выбранному существу на расстоянии, не требуя прикосновения.", custom: false },
  { id: "sp_sleep", name: "Сон", level: 1, school: "Очарование", time: "1 действие", range: "18 м", components: "В, С, М", duration: "1 минута", concentration: false, ritual: false, classes: ["Бард", "Чародей", "Волшебник"], description: "Погружает нескольких существ в области в магический сон, начиная с тех, у кого меньше всего хитов.", custom: false },
  { id: "sp_detect_magic", name: "Обнаружение магии", level: 1, school: "Прорицание", time: "1 действие", range: "На себя", components: "В, С", duration: "10 минут", concentration: true, ritual: true, classes: ["Волшебник", "Жрец", "Друид", "Бард", "Чародей", "Следопыт", "Паладин"], description: "Заклинатель ощущает присутствие магии в пределах 9 метров и может определить школу ближайшего источника.", custom: false },
  { id: "sp_burning_hands", name: "Горящие руки", level: 1, school: "Воплощение", time: "1 действие", range: "На себя (конус 4.5 м)", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Из растопыренных пальцев вырывается лист пламени, поражающий всех в конусе; спасбросок Ловкости уменьшает урон вдвое.", custom: false },
  { id: "sp_shield_of_faith", name: "Щит веры", level: 1, school: "Ограждение", time: "1 бонусное действие", range: "18 м", components: "В, С, М", duration: "10 минут", concentration: true, ritual: false, classes: ["Жрец", "Паладин"], description: "Вокруг выбранного существа возникает мерцающее поле, повышающее его класс доспеха.", custom: false },

  { id: "sp_misty_step", name: "Туманный шаг", level: 2, school: "Преобразование", time: "1 бонусное действие", range: "На себя", components: "В", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Колдун", "Чародей", "Волшебник"], description: "Заклинатель окутывается серебристым туманом и телепортируется на видимое место неподалёку.", custom: false },
  { id: "sp_invisibility", name: "Невидимость", level: 2, school: "Иллюзия", time: "1 действие", range: "Касание", components: "В, С, М", duration: "1 час", concentration: true, ritual: false, classes: ["Волшебник", "Чародей", "Колдун", "Бард"], description: "Цель становится невидимой, пока не совершит атаку или не сотворит заклинание.", custom: false },
  { id: "sp_scorching_ray", name: "Опаляющий луч", level: 2, school: "Воплощение", time: "1 действие", range: "36 м", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Заклинатель выпускает три огненных луча, каждый из которых можно направить в свою или одну общую цель.", custom: false },
  { id: "sp_hold_person", name: "Удержание личности", level: 2, school: "Очарование", time: "1 действие", range: "18 м", components: "В, С, М", duration: "1 минута", concentration: true, ritual: false, classes: ["Бард", "Жрец", "Друид", "Чародей", "Колдун", "Волшебник"], description: "Гуманоидная цель должна пройти спасбросок Мудрости или окажется парализована на время действия заклинания.", custom: false },
  { id: "sp_spiritual_weapon", name: "Духовное оружие", level: 2, school: "Воплощение", time: "1 бонусное действие", range: "18 м", components: "В, С", duration: "1 минута", concentration: false, ritual: false, classes: ["Жрец"], description: "Создаёт парящее оружие из энергии, которым заклинатель может атаковать бонусным действием.", custom: false },

  { id: "sp_fireball", name: "Огненный шар", level: 3, school: "Воплощение", time: "1 действие", range: "45 м", components: "В, С, М", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Волшебник", "Чародей"], description: "Яркая вспышка срывается с пальца и взрывается в указанной точке, нанося урон огнём всем в радиусе взрыва.", custom: false },
  { id: "sp_counterspell", name: "Контрзаклинание", level: 3, school: "Ограждение", time: "1 реакция", range: "18 м", components: "С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Чародей", "Колдун", "Волшебник"], description: "Прерывает заклинание, которое творит другое существо, если реагирующий успевает вмешаться прежде, чем оно завершится.", custom: false },
  { id: "sp_fly", name: "Полёт", level: 3, school: "Преобразование", time: "1 действие", range: "Касание", components: "В, С, М", duration: "10 минут", concentration: true, ritual: false, classes: ["Волшебник", "Чародей", "Колдун"], description: "Цель обретает скорость полёта на время действия заклинания.", custom: false },
  { id: "sp_haste", name: "Ускорение", level: 3, school: "Преобразование", time: "1 действие", range: "9 м", components: "В, С, М", duration: "1 минута", concentration: true, ritual: false, classes: ["Волшебник", "Чародей"], description: "Скорость цели удваивается, КД и спасброски Ловкости повышаются, появляется дополнительное действие — но после окончания заклинания наступает истощение.", custom: false },
  { id: "sp_dispel_magic", name: "Рассеивание магии", level: 3, school: "Ограждение", time: "1 действие", range: "36 м", components: "В, С", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Жрец", "Друид", "Паладин", "Чародей", "Колдун", "Волшебник", "Бард"], description: "Прекращает действие одного заклинания на существе, предмете или магическом эффекте в пределах дистанции.", custom: false },

  { id: "sp_greater_invis", name: "Большая невидимость", level: 4, school: "Иллюзия", time: "1 действие", range: "Касание", components: "В, С", duration: "1 минута", concentration: true, ritual: false, classes: ["Бард", "Чародей", "Волшебник"], description: "Цель становится невидимой даже во время атак и сотворения заклинаний.", custom: false },
  { id: "sp_wall_of_fire", name: "Огненная стена", level: 4, school: "Воплощение", time: "1 действие", range: "36 м", components: "В, С, М", duration: "1 минута", concentration: true, ritual: false, classes: ["Друид", "Чародей", "Волшебник"], description: "Создаёт стену пламени, наносящую урон существам, проходящим сквозь неё или оказавшимся рядом.", custom: false },
  { id: "sp_polymorph", name: "Полиморф", level: 4, school: "Преобразование", time: "1 действие", range: "18 м", components: "В, С, М", duration: "1 час", concentration: true, ritual: false, classes: ["Бард", "Друид", "Чародей", "Колдун", "Волшебник"], description: "Превращает цель в безобидное животное; статистика цели заменяется на статистику облика на время действия.", custom: false },

  { id: "sp_cone_of_cold", name: "Конус холода", level: 5, school: "Воплощение", time: "1 действие", range: "На себя (конус 18 м)", components: "В, С, М", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Чародей", "Волшебник"], description: "Из ладоней вырывается волна ледяного воздуха, наносящая урон холодом всем существам в конусе.", custom: false },
  { id: "sp_greater_restoration", name: "Большое восстановление", level: 5, school: "Воплощение", time: "1 действие", range: "Касание", components: "В, С, М", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Бард", "Жрец", "Друид"], description: "Снимает с цели одно истощение, паралич, окаменение или уменьшает одну из характеристик обратно до нормы.", custom: false },
  { id: "sp_wall_of_force", name: "Силовая стена", level: 5, school: "Воплощение", time: "1 действие", range: "36 м", components: "В, С, М", duration: "10 минут", concentration: true, ritual: false, classes: ["Волшебник"], description: "Создаёт невидимую непроницаемую стену, которую невозможно повредить обычным оружием.", custom: false },

  { id: "sp_disintegrate", name: "Дезинтеграция", level: 6, school: "Преобразование", time: "1 действие", range: "18 м", components: "В, С, М", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Чародей", "Волшебник"], description: "Тонкий зелёный луч поражает цель; при провале спасброска и достаточном уроне существо рассыпается в пыль.", custom: false },
  { id: "sp_teleport", name: "Телепортация", level: 7, school: "Преобразование", time: "1 действие", range: "3 м", components: "В", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Бард", "Чародей", "Волшебник"], description: "Мгновенно переносит заклинателя и до восьми спутников в знакомое место, даже на другой план.", custom: false },
  { id: "sp_sunburst", name: "Солнечный всплеск", level: 8, school: "Воплощение", time: "1 действие", range: "45 м", components: "В, С, М", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Друид", "Чародей", "Волшебник"], description: "Яркая вспышка солнечного света заливает область, ослепляя существ и нанося урон излучением.", custom: false },
  { id: "sp_wish", name: "Желание", level: 9, school: "Вызов", time: "1 действие", range: "На себя", components: "В", duration: "Мгновенно", concentration: false, ritual: false, classes: ["Чародей", "Волшебник"], description: "Самое мощное заклинание из существующих: позволяет воплотить почти любой эффект силой одной лишь мысли, но злоупотребление им опасно для самого заклинателя.", custom: false }
];

// Размеры и типы местности обитания (для бестиария)
const CREATURE_SIZES = ["Крошечный", "Маленький", "Средний", "Большой", "Огромный", "Колоссальный"];
const HABITATS = ["Арктика", "Подводье", "Побережье", "Пустыня", "Тропики", "Лес", "Равнина", "Холмы", "Горы", "Болота", "Подземье", "Город"];

// Редкость предметов
const RARITIES = ["Обычный", "Необычный", "Редкий", "Очень редкий", "Легендарный", "Артефакт"];

// Как предмет влияет на КД: тип брони определяет, как учитывается модификатор Ловкости
const ARMOR_SLOTS = [
  { id: "none", label: "Не влияет на КД" },
  { id: "light", label: "Лёгкая броня (+ полный мод. Ловкости)" },
  { id: "medium", label: "Средняя броня (+ Ловкость, максимум +2)" },
  { id: "heavy", label: "Тяжёлая броня (без Ловкости)" },
  { id: "flat", label: "Фиксированный бонус (щит, кольцо и т.п.)" }
];

const DEFAULT_ITEMS = [
  { id: "i_longsword", name: "Длинный меч", type: "Оружие", weight: "1.5 кг", cost: "15 зм", properties: "1к8 рубящего урона, универсальное (1к10)", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_chainmail", name: "Кольчуга", type: "Броня (тяжёлая)", weight: "27 кг", cost: "75 зм", properties: "Требует Силу 13, ограничивает скорость", armorSlot: "heavy", armorBaseAC: 16, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_shield", name: "Щит", type: "Броня", weight: "3 кг", cost: "10 зм", properties: "Пока щит в руке, КД увеличивается на 2", armorSlot: "flat", armorBaseAC: 0, acBonus: 2, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_leather", name: "Кожаная броня", type: "Броня (лёгкая)", weight: "5 кг", cost: "10 зм", properties: "Даёт защиту 11 + модификатор Ловкости", armorSlot: "light", armorBaseAC: 11, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_healing_potion", name: "Зелье лечения", type: "Снаряжение", weight: "0.25 кг", cost: "50 зм", properties: "Восстанавливает 2к4+2 хитов", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Необычный", custom: false },
  { id: "i_rope", name: "Верёвка (15 м)", type: "Снаряжение", weight: "5 кг", cost: "1 зм", properties: "Прочная пеньковая верёвка", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false }
];

// Палитра эмодзи для выбора аватара персонажа/существа/предмета
const EMOJI_PALETTE = [
  "🧙", "🧝", "🧛", "🧟", "🧞", "🧜", "🧚", "🗡️", "⚔️", "🛡️",
  "🏹", "🔮", "📜", "🐉", "🐺", "🦇", "🕷️", "💀", "👹", "👺",
  "🦅", "🐍", "🦂", "🐗", "🐻", "🔥", "❄️", "⚡", "🌙", "⭐",
  "💰", "🗝️", "🍺", "🏰", "⚱️", "🩸", "☠️", "🪓", "🔱", "🎭",
  "☀️", "🌤️", "⛅", "🌧️", "⛈️", "🌩️", "🌨️", "🌪️", "🌫️", "🌈",
  "💧", "🌊", "☁️", "💨", "🌡️", "🌑", "🌕", "☄️", "🌋", "🕳️",
  "🌵", "🌲", "🍄", "🌾", "🕸️", "⛰️", "🏔️", "🗿", "⚓", "🧭",
  "🧊", "🪨", "🧱", "🪦", "🕯️", "🧿", "💎", "🪶", "🐲", "🦴"
];

// Темы оформления
const THEMES = [
  { id: "dark", label: "Тёмное фэнтези" },
  { id: "parchment", label: "Пергамент" },
  { id: "midnight", label: "Полночь" },
  { id: "emerald", label: "Изумруд" },
  { id: "undead", label: "Нежить" },
  { id: "ukraine", label: "Україна" },
  { id: "ember", label: "Пламя" },
  { id: "irish", label: "Ирландский клевер" }
];
