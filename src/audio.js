// ============================================
// 効果音: Web Audio API (OscillatorNode) で動的生成
// 外部音声ファイル不使用
// ============================================

let ctx = null;
let master = null;

// ブラウザの自動再生制限があるため、初回のユーザー操作時に初期化する
export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.28;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function tone({ type = 'square', from = 440, to = from, dur = 0.1, delay = 0, vol = 1, curve = 'exp' }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t0);
  if (to !== from) {
    if (curve === 'exp' && from > 0 && to > 0) {
      osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    } else {
      osc.frequency.linearRampToValueAtTime(to, t0 + dur);
    }
  }
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(gain).connect(master);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 減衰ノイズ (ミス音・衝突音用)
function noise({ dur = 0.2, delay = 0, vol = 0.6, low = 200 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + delay;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = low;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, t0);
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t0);
}

// ---- ジャンプ音: 高音への周波数スイープ ----
export function sfxJump() {
  tone({ type: 'square', from: 220, to: 880, dur: 0.16, vol: 0.5 });
}

// ---- コイン取得音 ----
export function sfxCoin() {
  tone({ type: 'square', from: 988, to: 988, dur: 0.07, vol: 0.45 });
  tone({ type: 'square', from: 1319, to: 1319, dur: 0.24, delay: 0.07, vol: 0.45 });
}

// ---- ブロック衝突音: 低音のドン ----
export function sfxBump() {
  tone({ type: 'triangle', from: 180, to: 80, dur: 0.1, vol: 0.8 });
  noise({ dur: 0.08, vol: 0.3, low: 500 });
}

// ---- ハテナブロック開封音 ----
export function sfxBlock() {
  tone({ type: 'square', from: 523, to: 1047, dur: 0.12, vol: 0.5 });
}

// ---- ミス音: 減衰ノイズ + 下降音 ----
export function sfxDeath() {
  noise({ dur: 0.3, vol: 0.5, low: 300 });
  tone({ type: 'square', from: 494, to: 494, dur: 0.12, delay: 0.1, vol: 0.5 });
  tone({ type: 'square', from: 466, to: 466, dur: 0.12, delay: 0.25, vol: 0.5 });
  tone({ type: 'square', from: 440, to: 110, dur: 0.7, delay: 0.4, vol: 0.55, curve: 'exp' });
}

// ---- ステージクリア音: メロディライン ----
export function sfxClear() {
  const melody = [523, 659, 784, 1047, 784, 1047, 1319, 1568];
  melody.forEach((f, i) => {
    tone({ type: 'square', from: f, to: f, dur: 0.16, delay: i * 0.13, vol: 0.4 });
    tone({ type: 'triangle', from: f / 2, to: f / 2, dur: 0.16, delay: i * 0.13, vol: 0.35 });
  });
}

// ---- パワーアップ音: 上昇アルペジオ (SMB1のきのこ音風) ----
export function sfxPowerup() {
  const notes = [262, 330, 392, 523, 659, 784, 1047];
  notes.forEach((f, i) => {
    tone({ type: 'square', from: f, to: f, dur: 0.07, delay: i * 0.045, vol: 0.4 });
  });
}

// ---- 縮小音: 下降ステップ (SMB1のダメージ縮小音風) ----
export function sfxShrink() {
  const notes = [784, 587, 440, 330, 247];
  notes.forEach((f, i) => {
    tone({ type: 'square', from: f, to: f * 0.85, dur: 0.09, delay: i * 0.07, vol: 0.4 });
  });
}

// ---- ゴールポール滑降音: 下降スライドホイッスル (SMB1の旗降下音風) ----
export function sfxFlag() {
  tone({ type: 'square', from: 1568, to: 196, dur: 0.9, vol: 0.35 });
  tone({ type: 'triangle', from: 784, to: 98, dur: 0.9, vol: 0.3 });
}

// ---- 花火: 破裂ノイズ + 低音の余韻 ----
export function sfxFirework() {
  noise({ dur: 0.35, vol: 0.5, low: 900 });
  tone({ type: 'triangle', from: 500, to: 60, dur: 0.3, vol: 0.4 });
}

// ---- 決定音 (UI) ----
export function sfxSelect() {
  tone({ type: 'square', from: 660, to: 990, dur: 0.08, vol: 0.4 });
}

// ---- 敵踏みつけ音 ----
export function sfxKick() {
  tone({ type: 'triangle', from: 300, to: 80, dur: 0.12, vol: 0.75 });
  noise({ dur: 0.1, vol: 0.45, low: 600 });
}

// ---- ブロック破壊音 ----
export function sfxBreak() {
  noise({ dur: 0.15, vol: 0.8, low: 300 });
  tone({ type: 'triangle', from: 150, to: 40, dur: 0.14, vol: 0.7 });
}

