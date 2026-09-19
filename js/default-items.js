// Встроенные данные каталога. Эти записи не изменяются пользователем и загружаются отдельно.

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
  { id: "i_longsword", name: "Длинный меч", type: "Оружие", subtype: "", weight: "1.5 кг", cost: "15 зм", properties: "1к8 рубящего урона, универсальное (1к10)", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_chainmail", name: "Кольчуга", type: "Броня", subtype: "тяжёлая", weight: "27 кг", cost: "75 зм", properties: "Требует Силу 13, ограничивает скорость", armorSlot: "heavy", armorBaseAC: 16, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_shield", name: "Щит", type: "Броня", subtype: "", weight: "3 кг", cost: "10 зм", properties: "Пока щит в руке, КД увеличивается на 2", armorSlot: "flat", armorBaseAC: 0, acBonus: 2, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_leather", name: "Кожаная броня", type: "Броня", subtype: "лёгкая", weight: "5 кг", cost: "10 зм", properties: "Даёт защиту 11 + модификатор Ловкости", armorSlot: "light", armorBaseAC: 11, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false },
  { id: "i_healing_potion", name: "Зелье лечения", type: "Снаряжение", subtype: "", weight: "0.25 кг", cost: "50 зм", properties: "Восстанавливает 2к4+2 хитов", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Необычный", custom: false },
  { id: "i_rope", name: "Верёвка (15 м)", type: "Снаряжение", subtype: "", weight: "5 кг", cost: "1 зм", properties: "Прочная пеньковая верёвка", armorSlot: "none", armorBaseAC: 0, acBonus: 0, atkBonus: 0, rarity: "Обычный", custom: false }
];
