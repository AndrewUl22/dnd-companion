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

// Мягкий "лист бумаги": используется при открытии карточек
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
