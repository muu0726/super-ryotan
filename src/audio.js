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
  // 解錠前に startBgm されていた場合はここから再生を開始する
  if (bgmTheme && !bgmTimer) runBgm();
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

// ---- チェックポイント通過音: 上昇3音ジングル ----
export function sfxCheckpoint() {
  tone({ type: 'square', from: 660, to: 660, dur: 0.09, vol: 0.4 });
  tone({ type: 'square', from: 880, to: 880, dur: 0.09, delay: 0.09, vol: 0.4 });
  tone({ type: 'square', from: 1320, to: 1320, dur: 0.24, delay: 0.18, vol: 0.4 });
}

// ============================================
// BGM: Web Audio ルックアヘッド・ステップシーケンサ
// 外部音源なしで矩形波リード + 三角波ベースの8bitループを生成する
// ============================================

const NOTE = (midi) => 440 * Math.pow(2, (midi - 69) / 12);

// 各テーマは8分音符グリッドのループ。0 は休符 (MIDIノート番号)
const BGM_THEMES = {
  // 地上: 明るいCメジャーの跳ねるフレーズ
  overworld: {
    bpm: 116,
    lead: [
      72, 0, 76, 0, 79, 0, 76, 0, 74, 0, 77, 0, 81, 0, 77, 0,
      76, 0, 79, 0, 84, 0, 79, 0, 77, 76, 74, 0, 72, 0, 0, 0,
    ],
    bass: [
      48, 0, 55, 0, 48, 0, 55, 0, 50, 0, 57, 0, 50, 0, 57, 0,
      52, 0, 59, 0, 52, 0, 59, 0, 53, 0, 55, 0, 48, 0, 43, 0,
    ],
  },
  // 地下: まばらでスタッカートなAマイナー
  underground: {
    bpm: 96,
    lead: [
      69, 0, 0, 69, 0, 72, 0, 0, 67, 0, 0, 67, 0, 70, 0, 0,
      65, 0, 0, 65, 0, 69, 0, 0, 64, 0, 67, 0, 64, 0, 0, 0,
    ],
    bass: [
      45, 0, 0, 45, 0, 0, 45, 0, 43, 0, 0, 43, 0, 0, 43, 0,
      41, 0, 0, 41, 0, 0, 41, 0, 40, 0, 0, 40, 0, 40, 0, 0,
    ],
  },
  // 空中: ふわふわ漂うFメジャー
  sky: {
    bpm: 126,
    lead: [
      77, 0, 81, 0, 84, 0, 81, 0, 79, 0, 84, 0, 88, 0, 84, 0,
      77, 0, 81, 0, 84, 0, 81, 0, 86, 84, 81, 79, 77, 0, 0, 0,
    ],
    bass: [
      53, 0, 0, 0, 57, 0, 60, 0, 55, 0, 0, 0, 59, 0, 62, 0,
      53, 0, 0, 0, 57, 0, 60, 0, 50, 0, 55, 0, 53, 0, 0, 0,
    ],
  },
  // 決戦: 刻むベースの緊張感あるDマイナー
  final: {
    bpm: 140,
    lead: [
      74, 0, 74, 77, 0, 74, 0, 72, 74, 0, 74, 79, 0, 77, 0, 74,
      74, 0, 74, 77, 0, 74, 0, 72, 70, 0, 72, 0, 74, 0, 0, 0,
    ],
    bass: [
      38, 38, 0, 38, 38, 0, 38, 0, 38, 38, 0, 38, 38, 0, 38, 0,
      36, 36, 0, 36, 36, 0, 36, 0, 34, 0, 36, 0, 38, 0, 0, 0,
    ],
  },
};

let bgmTheme = null;    // 再生要求中のテーマ名 (null = 停止)
let bgmTimer = null;    // ルックアヘッドスケジューラの interval ID
let bgmGain = null;     // BGM専用バス (停止時にまとめて消音する)
let bgmStep = 0;
let bgmNextTime = 0;

function scheduleBgmNote(freq, type, t, dur, vol) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(bgmGain);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function runBgm() {
  const theme = BGM_THEMES[bgmTheme];
  if (!theme || !ctx) return;
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.55; // SFXより控えめ
  bgmGain.connect(master);
  bgmStep = 0;
  bgmNextTime = ctx.currentTime + 0.06;

  const tick = () => {
    const stepDur = 60 / theme.bpm / 2; // 8分音符
    // 先の0.2秒ぶんまで先行スケジュールする
    while (bgmNextTime < ctx.currentTime + 0.2) {
      const lead = theme.lead[bgmStep % theme.lead.length];
      const bass = theme.bass[bgmStep % theme.bass.length];
      if (lead) scheduleBgmNote(NOTE(lead), 'square', bgmNextTime, stepDur * 0.85, 0.16);
      if (bass) scheduleBgmNote(NOTE(bass), 'triangle', bgmNextTime, stepDur * 0.9, 0.3);
      bgmNextTime += stepDur;
      bgmStep++;
    }
  };
  tick();
  bgmTimer = setInterval(tick, 80);
}

// BGM再生を要求する。AudioContext 未解錠なら unlockAudio 後に自動で始まる
export function startBgm(name) {
  if (bgmTheme === name && bgmTimer) return; // 同じ曲は継続
  stopBgm();
  bgmTheme = name;
  if (ctx) runBgm();
}

export function stopBgm() {
  bgmTheme = null;
  if (bgmTimer) {
    clearInterval(bgmTimer);
    bgmTimer = null;
  }
  if (bgmGain) {
    // スケジュール済みノートごとフェードアウトして切り離す
    const g = bgmGain;
    bgmGain = null;
    g.gain.setTargetAtTime(0, ctx.currentTime, 0.05);
    setTimeout(() => g.disconnect(), 300);
  }
}

