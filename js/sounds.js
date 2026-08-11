// Атмосферные звуки, синтезируемые прямо в браузере (без внешних аудиофайлов —
// чтобы приложение продолжало работать офлайн).

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function soundsEnabled() {
  return !state.settings || state.settings.soundEnabled !== false;
}

// Скрип открывающейся двери: медленно "плывущая" по частоте пила + шум
function playDoorCreak() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 300;
    filter.Q.value = 6;

    osc.frequency.setValueAtTime(90, now);
    osc.frequency.linearRampToValueAtTime(140, now + 0.35);
    osc.frequency.linearRampToValueAtTime(70, now + 0.7);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.06, now + 0.08);
    gain.gain.linearRampToValueAtTime(0.05, now + 0.55);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.8);
  } catch (e) { /* тихо игнорируем, если Web Audio недоступен */ }
}

// Звон цепей: несколько коротких металлических щелчков со случайной высотой
function playChainClink() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const hits = 3 + Math.floor(Math.random() * 2);
    for (let i = 0; i < hits; i++) {
      const t = now + i * (0.09 + Math.random() * 0.05);
      const osc = ctx.createOscillator();
      osc.type = 'square';
      const freq = 700 + Math.random() * 500;
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.6, t + 0.08);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.04, t);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.14);
    }
  } catch (e) { /* игнорируем */ }
}

// Стук игральной кости: короткие шумовые щелчки затухающей громкости
function playDiceRoll() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const hits = 5 + Math.floor(Math.random() * 4);
    for (let i = 0; i < hits; i++) {
      const t = now + i * (0.04 + Math.random() * 0.05);
      const bufferSize = ctx.sampleRate * 0.03;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12 * (1 - i / hits), t);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
    }
  } catch (e) { /* игнорируем */ }
}

// Магический перезвон для заставки при запуске: восходящий арпеджио колокольчиков
function playSplashChime() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5]; // C5 E5 G5 C6 E6
    notes.forEach((freq, i) => {
      const t = now + i * 0.11;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.07, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 1);
    });
  } catch (e) { /* игнорируем */ }
}

// Полная озвучка заставки: кубик катится и стучит, глухо приземляется,
// затем магический перезвон под мерцание искр — синхронизировано с CSS-анимацией.
function playSplashDiceLand() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;

    // Фаза 1: быстрые затухающие стуки (кубик катится и замедляется)
    const clatterTimes = [0, 0.09, 0.16, 0.22, 0.27, 0.31, 0.34];
    clatterTimes.forEach((dt, i) => {
      const t = now + dt;
      const bufferSize = ctx.sampleRate * 0.025;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize);
      const src = ctx.createBufferSource();
      src.buffer = buffer;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.16 * (1 - i / clatterTimes.length), t);
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(t);
    });

    // Фаза 2: глухой "приземляющий" удар
    const landT = now + 0.4;
    const thud = ctx.createOscillator();
    thud.type = 'sine';
    thud.frequency.setValueAtTime(140, landT);
    thud.frequency.exponentialRampToValueAtTime(50, landT + 0.18);
    const thudGain = ctx.createGain();
    thudGain.gain.setValueAtTime(0.25, landT);
    thudGain.gain.exponentialRampToValueAtTime(0.001, landT + 0.3);
    thud.connect(thudGain);
    thudGain.connect(ctx.destination);
    thud.start(landT);
    thud.stop(landT + 0.32);

    // Фаза 3: магический перезвон под появление искр
    const chimeStart = now + 0.55;
    const notes = [659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const t = chimeStart + i * 0.14;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.linearRampToValueAtTime(0.06, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.9);
    });
  } catch (e) { /* игнорируем */ }
}
// Короткий тихий "клик" для кнопок форматирования текста
function playFormatClick() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.1);
  } catch (e) { /* игнорируем */ }
}
function playPageTurn() {
  if (!soundsEnabled()) return;
  try {
    const ctx = getAudioCtx();
    const now = ctx.currentTime;
    const bufferSize = ctx.sampleRate * 0.15;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let j = 0; j < bufferSize; j++) data[j] = (Math.random() * 2 - 1) * (1 - j / bufferSize) * 0.5;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1500;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(now);
  } catch (e) { /* игнорируем */ }
}
