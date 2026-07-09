// ============================================
// 11ステージのマップデータと生成ロジック
// 記号: #=地面 B=レンガ ==浮き足場 ?=ハテナ M=きのこ入りハテナ U=使用済み
//       o=コイン H=トゲ G=ゴール S=スタート .=空間
//       E=クリボー風 K=ノコノコ風 F=パタパタ風
// 各ステージは14行。短い行はパーサが '.' で右側を埋める。
// ============================================

import { TILE } from './physics.js';

const D = (n) => '.'.repeat(n);
const W = (n) => '#'.repeat(n);

// ---- Stage 1: はじまりの草原 ----
const L1_GROUND = W(30) + D(3) + W(22) + D(3) + W(42);
const LEVEL_1 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(71) + 'ooo',
  D(15) + '?.M.?',
  D(70) + '=====',
  D(3) + 'S' + D(12) + 'E' + D(10) + 'ooooo' + D(12) + 'E' + D(5) + 'ooooo' + D(33) + 'G',
  L1_GROUND,
  L1_GROUND,
];

// ---- Stage 2: だんさとトゲ ----
const L2_GROUND = W(75) + D(3) + W(32);
const LEVEL_2 = [
  '', '', '', '', '',
  '',
  '',
  '',
  '',
  D(50) + '?' + D(23) + 'ooo',
  D(24) + 'E' + D(1) + '####' + D(30) + 'ooo',
  D(3) + 'S' + D(16) + '##########' + D(10) + 'HHH' + D(8) + 'K' + D(8) + 'HHH' + D(37) + 'G',
  L2_GROUND,
  L2_GROUND,
];

// ---- Stage 3: そらのあしば ----
const L3_GROUND = W(25) + D(24) + W(21) + D(24) + W(16);
const LEVEL_3 = [
  '', '', '', '', '',
  '',
  '',
  D(52) + 'F',
  D(27) + 'oooo' + D(3) + 'oooo' + D(41) + 'oooo' + D(3) + 'oooo',
  D(55) + '??',
  D(27) + '====' + D(3) + '====' + D(3) + '=====' + D(26) + '====' + D(3) + '====' + D(3) + '=====',
  D(3) + 'S' + D(10) + 'E' + D(45) + 'E' + D(41) + 'G',
  L3_GROUND,
  L3_GROUND,
];

// ---- Stage 4: リズムのたに ----
const L4_GROUND =
  W(15) + D(3) + W(5) + D(3) + W(5) + D(3) + W(5) + D(3) + W(5) + D(4) +
  W(5) + D(3) + W(5) + D(4) + W(5) + D(4) + W(30);
const LEVEL_4 = [
  '', '', '', '', '',
  '',
  '',
  '',
  '',
  D(83) + 'M',
  D(47) + 'ooo' + D(14) + 'ooo' + D(6) + 'ooo',
  D(3) + 'S' + D(5) + 'E' + D(75) + 'E' + D(1) + 'HHH' + D(14) + 'G',
  L4_GROUND,
  L4_GROUND,
];

// ---- Stage 5: ちかつうろ ----
const L5_CEIL = 'B'.repeat(110);
const L5_PILLAR = D(30) + 'BB' + D(23) + 'BB';
const L5_GROUND = W(80) + D(3) + W(27);
const LEVEL_5 = [
  L5_CEIL,
  L5_CEIL,
  L5_PILLAR,
  L5_PILLAR,
  L5_PILLAR,
  L5_PILLAR,
  L5_PILLAR,
  L5_PILLAR,
  L5_PILLAR,
  D(15) + '?' + D(29) + 'ooo' + D(25) + 'ooo',
  D(20) + 'oo' + D(48) + 'oo',
  D(3) + 'S' + D(18) + 'E' + D(14) + 'HH' + D(22) + 'K' + D(3) + 'HHH' + D(32) + 'G',
  L5_GROUND,
  L5_GROUND,
];

// ---- Stage 6: トゲのかいろう ----
const L6_GROUND = W(116); // ゴール (col 114) の下まで地面を敷く
const LEVEL_6 = [
  '', '', '', '', '',
  '',
  '',
  D(70) + 'F',
  D(38) + 'ooo' + D(11) + 'ooo' + D(11) + 'ooo',
  D(78) + '?',
  D(31) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===',
  D(3) + 'S' + D(14) + 'E' + D(10) + 'H'.repeat(42) + D(13) + 'E' + D(12) + 'HHH' + D(14) + 'G',
  L6_GROUND,
  L6_GROUND,
];

// ---- Stage 7: おおきなかいだん ----
const L7_GROUND = W(60) + D(5) + W(55);
const LEVEL_7 = [
  '', '', '', '', '',
  '',
  D(34) + 'oooooooo',
  '',
  D(29) + W(15),
  D(26) + W(21) + D(48) + '?.M',
  D(23) + W(27) + D(11) + '===',
  D(3) + 'S' + D(11) + 'E' + D(4) + W(33) + D(22) + 'HHH' + D(2) + 'E' + D(4) + 'HHH' + D(24) + 'G',
  L7_GROUND,
  L7_GROUND,
];

// ---- Stage 8: スピードラン ----
const L8_GROUND = W(40) + D(4) + W(26) + D(4) + W(21) + D(4) + W(21);
const LEVEL_8 = [
  '', '', '', '', '',
  '',
  '',
  '',
  '',
  D(20) + '??',
  D(40) + 'oooo' + D(26) + 'oooo' + D(21) + 'oooo',
  D(3) + 'S' + D(21) + 'E' + D(29) + 'HH' + D(15) + 'K' + D(11) + 'HH' + D(30) + 'G',
  L8_GROUND,
  L8_GROUND,
];

// ---- Stage 9: てんくうのとう ----
const L9_GROUND = W(20) + D(79) + W(11);
const LEVEL_9 = [
  '', '', '', '',
  D(60) + 'F',
  D(33) + 'E' + D(1) + 'oo' + D(5) + 'oo',
  D(34) + '====' + D(3) + '====',
  D(48) + '====' + D(3) + '====',
  D(28) + '====' + D(29) + 'oo',
  D(10) + 'M' + D(50) + '====' + D(3) + '====',
  D(22) + '====' + D(48) + '====' + D(2) + '====' + D(2) + '====' + D(2) + '====',
  D(3) + 'S' + D(6) + 'E' + D(91) + 'G',
  L9_GROUND,
  L9_GROUND,
];

// ---- Stage 10: さいごのしれん ----
const L10_GROUND = W(30) + D(4) + W(16) + D(5) + W(15) + D(25) + W(35);
const LEVEL_10 = [
  '', '', '', '', '',
  '',
  '',
  D(85) + 'F',
  D(77) + '===' + D(20) + 'ooo',
  D(60) + 'M.?',
  D(40) + '##' + D(9) + '===' + D(18) + '===' + D(8) + '===' + D(3) + '===' + D(7) + '===' + D(4) + '===',
  D(3) + 'S' + D(11) + 'HH' + D(3) + 'E' + D(1) + 'HH' + D(16) + '##' + D(2) + 'HH' + D(12) + 'K' + D(5) + 'HH' + D(33) + 'HHH' + D(1) + 'E' + D(2) + 'HHH' + D(14) + 'G',
  L10_GROUND,
  L10_GROUND,
];

// ---- Stage 11: エクストラ：天空の跳躍 ----
// ほぼ全面が奈落。空中のパタパタ (F) は一度踏むと羽を失って落ちるため、
// 「一回きり」の踏み台を跳ね返り (STOMP_BOUNCE_V) で繋いで渡る高難易度ステージ。
// 跳ね返り(長押し)の到達範囲は同じ高さで約6.3タイル・上昇約100px (3.1タイル)。
// 同列4タイル間隔・1行上への乗り継ぎ3タイル間隔の配置に対して余裕があるが、
// 踏み台が一回きりのため着地精度は引き続き要求される。
// H+# の壁 (col 23/52/68) は長押し跳ね返りで越える (長押しなしの小バウンド
// では激突する)。
const L11_GROUND = W(10) + D(90) + W(15);
const LEVEL_11 = [
  '', '', '', '', '',
  '',
  D(44) + 'ooo' + D(32) + 'ooo',
  '',
  D(23) + 'H' + D(9) + 'ooo' + D(9) + 'F' + D(6) + 'H' + D(6) + 'ooo' + D(6) + 'H' + D(11) + 'F',
  D(23) + '#' + D(18) + 'F' + D(9) + '#' + D(15) + '#' + D(8) + 'F',
  D(13) + 'F' + D(3) + 'F' + D(3) + 'F' + D(3) + 'F' + D(3) + 'F' + D(3) + '===' + D(3) + 'F' +
    D(10) + 'F' + D(3) + 'F' + D(3) + '=====' + D(3) + 'F' + D(3) + 'F' + D(3) + 'F' +
    D(9) + 'F' + D(3) + 'F' + D(3) + 'F' + D(3) + 'F',
  D(3) + 'S' + D(97) + 'G',
  L11_GROUND,
  L11_GROUND,
];

const RAW_LEVELS = [
  LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10,
  LEVEL_11,
];

export const LEVEL_NAMES = [
  'はじまりの草原', 'だんさとトゲ', 'そらのあしば', 'リズムのたに', 'ちかつうろ',
  'トゲのかいろう', 'おおきなかいだん', 'スピードラン', 'てんくうのとう', 'さいごのしれん',
  'エクストラ：天空の跳躍',
];

export const LEVEL_COUNT = RAW_LEVELS.length;

// マップ記号から敵エンティティを生成する
// E=クリボー風(巡回・崖で反転) K=ノコノコ風(踏むと甲羅化) F=パタパタ風(上下浮遊)
function makeEnemy(ch, tx, ty) {
  const common = { vy: 0, onGround: false, dead: false, deadTimer: 0, animTime: 0 };
  if (ch === 'K') {
    return {
      ...common,
      type: 'koopa', state: 'walk', shellTimer: 0,
      x: tx * TILE + (TILE - 24) / 2,
      y: ty * TILE + (TILE - 30) - 0.2,
      w: 24, h: 30,
      vx: -0.6,
    };
  }
  if (ch === 'F') {
    const baseY = ty * TILE + 4;
    return {
      ...common,
      type: 'flyer',
      x: tx * TILE + (TILE - 26) / 2,
      y: baseY, baseY,
      w: 26, h: 22,
      vx: 0,
    };
  }
  return {
    ...common,
    type: 'walker',
    x: tx * TILE + (TILE - 24) / 2,
    y: ty * TILE + (TILE - 24) - 0.2, // 地面にぴったり接地
    w: 24, h: 24,
    vx: -0.7,
  };
}

export class Level {
  constructor(index) {
    this.index = index;
    const rows = RAW_LEVELS[index];
    this.height = rows.length; // 14
    this.width = Math.max(...rows.map((r) => r.length));
    this.grid = rows.map((r) => (r + '.'.repeat(this.width - r.length)).split(''));

    this.startX = TILE * 2;
    this.startY = TILE * 10;
    this.cameraX = 0;
    this.enemies = []; // 敵のリスト
    this.items = [];   // 出現中のきのこ等のアイテム

    // スタート位置、ゴールポール、敵の検出
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        const ch = this.grid[y][x];
        if (ch === 'S') {
          this.startX = x * TILE;
          this.startY = y * TILE - 16;
          this.grid[y][x] = '.';
        } else if (ch === 'G') {
          this.goalX = x;
          this.goalY = y;
          // ポール上方5タイルを不可視のゴール判定 'g' にする
          for (let dy = 1; dy <= 5; dy++) {
            if (y - dy >= 0 && this.grid[y - dy][x] === '.') {
              this.grid[y - dy][x] = 'g';
            }
          }
        } else if (ch === 'E' || ch === 'K' || ch === 'F') {
          this.enemies.push(makeEnemy(ch, x, y));
          this.grid[y][x] = '.';
        }
      }
    }

    this.pixelWidth = this.width * TILE;
    this.pixelHeight = this.height * TILE;
  }

  tileAt(tx, ty) {
    if (tx < 0 || tx >= this.width) return '#'; // 左右端は壁
    if (ty < 0 || ty >= this.height) return '.';
    return this.grid[ty][tx];
  }

  setTile(tx, ty, ch) {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) return;
    this.grid[ty][tx] = ch;
  }
}

// ---- 進行状況のセーブ (localStorage) ----
const SAVE_KEY = 'super-ryotan-progress-v1';

export function loadProgress() {
  try {
    const n = parseInt(localStorage.getItem(SAVE_KEY), 10);
    return Number.isFinite(n) ? Math.min(Math.max(n, 1), LEVEL_COUNT) : 1;
  } catch {
    return 1;
  }
}

export function saveProgress(maxStage) {
  try {
    const cur = loadProgress();
    if (maxStage > cur) {
      localStorage.setItem(SAVE_KEY, String(Math.min(maxStage, LEVEL_COUNT)));
    }
  } catch {
    // localStorage 不可 (プライベートモード等) でもゲームは続行
  }
}

// ---- タイムアタック記録のセーブ (localStorage) ----
const TIME_KEY_PREFIX = 'super-ryotan-time-v1-';

export function loadBestTime(stageNum) {
  try {
    const val = localStorage.getItem(TIME_KEY_PREFIX + stageNum);
    return val !== null ? parseFloat(val) : null;
  } catch {
    return null;
  }
}

export function saveBestTime(stageNum, seconds) {
  try {
    const cur = loadBestTime(stageNum);
    if (cur === null || seconds < cur) {
      localStorage.setItem(TIME_KEY_PREFIX + stageNum, String(seconds));
      return true; // 新記録
    }
  } catch {
    // localStorage不可でも無視
  }
  return false;
}

