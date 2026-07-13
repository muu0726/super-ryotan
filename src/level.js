// ============================================
// 全31ステージ (1〜30 + EX) のマップデータと生成ロジック
// 記号: #=地面 B=レンガ ==浮き足場 ?=ハテナ M=きのこ入りハテナ U=使用済み
//       T=10コインブロック(見た目はレンガ) X=隠しブロック(下から叩くと出現)
//       o=コイン H=トゲ G=ゴール S=スタート .=空間
//       E=クリボー風 K=ノコノコ風 F=パタパタ風
// 各ステージは14行。短い行はパーサが '.' で右側を埋める。
// 中間チェックポイントはロード時に各ステージ (EXを除く) へ自動配置される。
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
  D(15) + '?.M.?' + D(20) + 'X',
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
  D(50) + '?T' + D(22) + 'ooo',
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
  D(8) + 'M',
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
  D(15) + '?T' + D(28) + 'ooo' + D(25) + 'ooo',
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
  D(10) + 'M' + D(15) + W(21) + D(48) + '?',
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

// ---- Stage 11: カメのこうしん ----
const L11_GROUND = W(35) + D(3) + W(30) + D(4) + W(38);
const LEVEL_11 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(55) + 'ooo',
  D(20) + '?.?' + D(27) + 'M' + D(24) + 'X',
  D(54) + '=====',
  D(3) + 'S' + D(11) + 'K' + D(14) + 'E' + D(12) + 'K' + D(20) + 'E.K' + D(30) + 'G',
  L11_GROUND,
  L11_GROUND,
];

// ---- Stage 12: うきしまのうみ ----
const L12_GROUND = W(20) + D(30) + W(15) + D(30) + W(25);
const LEVEL_12 = [
  '', '', '', '', '',
  '',
  '',
  D(30) + 'F' + D(44) + 'F',
  D(22) + 'ooo' + D(4) + 'ooo' + D(28) + 'ooo' + D(4) + 'ooo',
  D(55) + '?',
  D(21) + '====' + D(4) + '====' + D(4) + '====' + D(4) + '====' +
    D(10) + '====' + D(4) + '====' + D(4) + '====' + D(4) + '====' + D(4) + '====',
  D(3) + 'S' + D(12) + 'E' + D(40) + 'K' + D(45) + 'G',
  L12_GROUND,
  L12_GROUND,
];

// ---- Stage 13: トゲトゲロード ----
const L13_GROUND = W(120);
const LEVEL_13 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(46) + 'ooo' + D(20) + 'ooo',
  D(20) + 'M' + D(50) + '?',
  D(45) + '=====' + D(15) + '=====',
  D(3) + 'S' + D(10) + 'HHH' + D(6) + 'HHH' + D(8) + 'E' + D(5) + 'HHHH' + D(8) + 'HHHH' +
    D(10) + 'K' + D(6) + 'HHHH' + D(12) + 'HHH' + D(5) + 'HHH' + D(15) + 'G',
  L13_GROUND,
  L13_GROUND,
];

// ---- Stage 14: ピラミッドごえ ----
const L14_GROUND = W(50) + D(4) + W(62);
const LEVEL_14 = [
  '', '', '', '', '',
  '',
  D(30) + 'oooooo',
  '',
  D(27) + W(12),
  D(24) + W(18) + D(18) + 'M.?',
  D(21) + W(24) + D(20) + '====',
  D(3) + 'S' + D(9) + 'E' + D(4) + W(30) + D(15) + 'E' + D(6) + 'HHH' + D(6) + 'K' + D(10) + 'HHH' + D(12) + 'G',
  L14_GROUND,
  L14_GROUND,
];

// ---- Stage 15: ちかめいろ ----
const L15_CEIL = 'B'.repeat(120);
const L15_PILLAR = D(25) + 'BB' + D(20) + 'BB' + D(20) + 'BB';
const L15_GROUND = W(60) + D(3) + W(30) + D(3) + W(24);
const LEVEL_15 = [
  L15_CEIL,
  L15_CEIL,
  L15_PILLAR,
  L15_PILLAR,
  L15_PILLAR,
  L15_PILLAR,
  L15_PILLAR,
  L15_PILLAR,
  L15_PILLAR,
  D(12) + '?T' + D(19) + 'M' + D(30) + 'ooo' + D(20) + 'ooo',
  D(18) + 'oo' + D(30) + 'oo' + D(30) + 'oo',
  D(3) + 'S' + D(14) + 'E' + D(9) + 'HH' + D(12) + 'K' + D(9) + 'HHH' + D(14) + 'E' + D(11) + 'K' + D(6) + 'HH' + D(26) + 'G',
  L15_GROUND,
  L15_GROUND,
];

// ---- Stage 16: パタパタのそら ----
const L16_GROUND = W(18) + D(70) + W(30);
const LEVEL_16 = [
  '', '', '', '',
  '',
  D(34) + 'F' + D(27) + 'F',
  D(24) + 'oo' + D(5) + 'oo' + D(19) + 'oo' + D(5) + 'oo',
  D(48) + 'F',
  D(23) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===' +
    D(4) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===',
  D(8) + 'M' + D(85) + '?',
  D(20) + '===' + D(55) + '===' + D(2) + '===',
  D(3) + 'S' + D(9) + 'E' + D(80) + 'E' + D(12) + 'G',
  L16_GROUND,
  L16_GROUND,
];

// ---- Stage 17: ちょうスピードラン ----
const L17_GROUND = W(30) + D(5) + W(20) + D(5) + W(18) + D(5) + W(37);
const LEVEL_17 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(30) + 'ooooo' + D(20) + 'ooooo' + D(18) + 'ooooo',
  D(15) + '??' + D(60) + 'M',
  '',
  D(3) + 'S' + D(20) + 'E' + D(20) + 'K' + D(28) + 'E' + D(15) + 'HHH' + D(20) + 'G',
  L17_GROUND,
  L17_GROUND,
];

// ---- Stage 18: くものとりで ----
// 左の塔をジグザグに登り、最上段 (row 3) の足場を渡って右へ降りる
const L18_GROUND = W(18) + D(84) + W(18);
const LEVEL_18 = [
  '',
  D(42) + 'F',
  D(36) + 'oooo' + D(12) + 'oooo',
  D(28) + '====' + D(4) + '====' + D(4) + '====' + D(4) + '====',
  D(23) + '====',
  D(62) + '====',
  D(19) + '====' + D(60) + 'F',
  D(70) + '====',
  D(22) + '====',
  D(10) + 'M' + D(2) + '?' + D(64) + '====' + D(4) + '====',
  D(16) + '====' + D(72) + '====' + D(2) + '====',
  D(3) + 'S' + D(7) + 'E' + D(98) + 'G',
  L18_GROUND,
  L18_GROUND,
];

// ---- Stage 19: トゲのだいかいろう ----
const L19_GROUND = W(120);
const LEVEL_19 = [
  '', '', '', '', '',
  '',
  '',
  D(40) + 'F' + D(27) + 'F',
  D(35) + 'ooo' + D(11) + 'ooo' + D(11) + 'ooo',
  D(78) + 'M' + D(6) + '?',
  D(28) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===' +
    D(4) + '===' + D(4) + '===' + D(4) + '===',
  D(3) + 'S' + D(12) + 'E' + D(9) + 'H'.repeat(46) + D(8) + 'E' + D(6) + 'HHH' + D(10) + 'G',
  L19_GROUND,
  L19_GROUND,
];

// ---- Stage 20: けっせんのみち ----
const L20_GROUND = W(25) + D(4) + W(15) + D(5) + W(20) + D(24) + W(12) + D(4) + W(31);
const LEVEL_20 = [
  '', '', '', '', '',
  '',
  '',
  D(74) + 'F' + D(8) + 'F',
  D(30) + 'ooo' + D(37) + 'ooo' + D(4) + 'ooo' + D(4) + 'ooo',
  D(20) + 'M' + D(40) + 'M' + D(50) + '?',
  D(70) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===',
  D(3) + 'S' + D(8) + 'HH' + D(3) + 'E' + D(15) + 'K' + D(3) + 'HH' + D(10) + 'E' + D(4) + 'HHH' +
    D(40) + 'K' + D(2) + 'HH' + D(20) + 'G',
  L20_GROUND,
  L20_GROUND,
];

// ---- Stage 21: カメのぐんたい ----
// ノコノコ主体の敵ラッシュ。甲羅の連鎖と穴越えを両立させる
const L21_GROUND = W(34) + D(4) + W(30) + D(4) + W(40);
const LEVEL_21 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(56) + 'ooo',
  D(18) + 'M' + D(20) + '?' + D(28) + '?',
  D(33) + '==' + D(20) + 'ooo' + D(15) + '==',
  D(3) + 'S' + D(10) + 'K' + D(8) + 'K' + D(18) + 'E.K' + D(12) + 'HHH' + D(14) + 'K' + D(8) + 'K' + D(20) + 'G',
  L21_GROUND,
  L21_GROUND,
];

// ---- Stage 22: ふたごのとう ----
// 左の塔をジグザグに登り、頂上の連続足場を渡って右の塔を降りる (18の強化版)
const L22_GROUND = W(16) + D(88) + W(16);
const LEVEL_22 = [
  '',
  D(41) + 'F' + D(29) + 'F',
  D(27) + 'ooo' + D(11) + 'ooo' + D(13) + 'ooo',
  D(26) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===' + D(4) + '===',
  D(21) + '===',
  D(60) + '===',
  D(17) + '===' + D(46) + '===',
  D(72) + '===',
  D(20) + '===',
  D(10) + 'M.?' + D(65) + '===' + D(3) + '===',
  D(14) + '===' + D(73) + '===' + D(3) + '===',
  D(3) + 'S' + D(6) + 'E' + D(100) + 'G',
  L22_GROUND,
  L22_GROUND,
];

// ---- Stage 23: じごくのちかどう ----
// 地下 + トゲと敵の波状攻撃。柱の下ではジャンプが制限される
const L23_CEIL = 'B'.repeat(124);
const L23_PILLAR = D(22) + 'BB' + D(18) + 'BB' + D(18) + 'BB' + D(18) + 'BB';
const L23_GROUND = W(50) + D(4) + W(40) + D(4) + W(26);
const LEVEL_23 = [
  L23_CEIL,
  L23_CEIL,
  L23_PILLAR,
  L23_PILLAR,
  L23_PILLAR,
  L23_PILLAR,
  L23_PILLAR,
  L23_PILLAR,
  L23_PILLAR,
  D(12) + '?T' + D(16) + 'M' + D(30) + 'ooo' + D(20) + 'ooo',
  D(18) + 'oo' + D(28) + 'oo' + D(28) + 'oo',
  D(3) + 'S' + D(10) + 'HH' + D(9) + 'E' + D(7) + 'HHH' + D(10) + 'K' + D(11) + 'HH' + D(9) + 'E' + D(8) + 'HHH' + D(10) + 'K' + D(10) + 'HH' + D(16) + 'G',
  L23_GROUND,
  L23_GROUND,
];

// ---- Stage 24: とびとびのしま ----
// 小島づたいの連続ジャンプ。島の上では敵が待ち構える
const L24_GROUND =
  W(16) + D(4) + W(8) + D(4) + W(8) + D(5) + W(8) + D(4) + W(6) + D(5) +
  W(6) + D(5) + W(8) + D(4) + W(6) + D(5) + W(20);
const LEVEL_24 = [
  '', '', '', '', '',
  '',
  '',
  D(50) + 'F' + D(30) + 'F',
  D(30) + 'oo' + D(10) + 'oo' + D(20) + 'oo' + D(10) + 'oo',
  D(21) + '?' + D(38) + 'M' + D(30) + '?',
  '',
  D(3) + 'S' + D(19) + 'E' + D(12) + 'E' + D(11) + 'K' + D(10) + 'E' + D(12) + 'K' + D(12) + 'E' + D(20) + 'G',
  L24_GROUND,
  L24_GROUND,
];

// ---- Stage 25: トゲのうみ ----
// 52タイルの大トゲ地帯を、ダッシュジャンプの勢いを保ったまま足場づたいに渡る
const L25_GROUND = W(124);
const LEVEL_25 = [
  '', '', '', '', '',
  '',
  D(60) + 'F',
  D(30) + 'oo' + D(20) + 'oo' + D(20) + 'oo',
  D(45) + '===' + D(25) + '===',
  D(90) + 'M.?',
  D(26) + '===' + D(5) + '===' + D(5) + '===' + D(5) + '===' + D(5) + '===' + D(5) + '===' + D(5) + '===',
  D(3) + 'S' + D(12) + 'E' + D(8) + 'H'.repeat(52) + D(8) + 'E' + D(8) + 'HHHH' + D(8) + 'G',
  L25_GROUND,
  L25_GROUND,
];

// ---- Stage 26: かぜのこみち ----
// 奈落の上に2タイル足場が延々と続く。勢いの管理が生命線
const L26_GROUND = W(14) + D(94) + W(16);
const LEVEL_26 = [
  '', '', '', '',
  '',
  D(45) + 'F' + D(30) + 'F',
  '',
  '',
  D(30) + 'oo' + D(15) + 'oo' + D(15) + 'oo' + D(15) + 'oo',
  D(10) + 'M' + D(55) + '?',
  D(16) + '==' + D(4) + '==' + D(4) + '==' + D(5) + '==' + D(4) + '==' + D(5) + '==' +
    D(4) + '==' + D(5) + '==' + D(4) + '==' + D(5) + '==' + D(4) + '==' + D(4) + '==' +
    D(5) + '==' + D(4) + '==' + D(5) + '==',
  D(3) + 'S' + D(8) + 'E' + D(105) + 'G',
  L26_GROUND,
  L26_GROUND,
];

// ---- Stage 27: ちょうおおジャンプ ----
// 5タイル幅の大穴をフルダッシュジャンプで越え続けるスピードコース
const L27_GROUND = W(28) + D(5) + W(14) + D(5) + W(14) + D(5) + W(12) + D(5) + W(12) + D(5) + W(21);
const LEVEL_27 = [
  '', '', '', '', '',
  '',
  '',
  '',
  D(28) + 'ooooo' + D(14) + 'ooooo' + D(14) + 'ooooo' + D(12) + 'ooooo' + D(12) + 'ooooo',
  D(12) + '??' + D(60) + 'M',
  '',
  D(3) + 'S' + D(16) + 'E' + D(20) + 'K' + D(20) + 'E' + D(25) + 'K' + D(25) + 'G',
  L27_GROUND,
  L27_GROUND,
];

// ---- Stage 28: やみのめいろ ----
// 地下迷路。天井の低い隙間 (高さ2タイル) をくぐりつつトゲと敵をさばく
const L28_CEIL = 'B'.repeat(122);
const L28_PILLAR = D(26) + 'BB' + D(26) + 'BB' + D(26) + 'BB';
const L28_LOW = D(18) + 'B'.repeat(6) + D(14) + 'B'.repeat(6) + D(14) + 'B'.repeat(6) + D(14) + 'B'.repeat(6);
const L28_GROUND = W(105) + D(4) + W(13);
const LEVEL_28 = [
  L28_CEIL,
  L28_CEIL,
  L28_PILLAR,
  L28_PILLAR,
  L28_PILLAR,
  L28_PILLAR,
  L28_PILLAR,
  '',
  L28_LOW,
  D(10) + 'M.T' + D(5) + 'B'.repeat(6) + D(14) + 'B'.repeat(6) + D(14) + 'B'.repeat(6) + D(14) + 'B'.repeat(6) + D(10) + '?',
  D(30) + 'oo' + D(18) + 'oo' + D(18) + 'oo',
  D(3) + 'S' + D(8) + 'E' + D(15) + 'HH' + D(3) + 'K' + D(14) + 'HH' + D(3) + 'E' + D(14) + 'HH' + D(3) + 'K' + D(14) + 'HHH' + D(4) + 'E' + D(16) + 'G',
  L28_GROUND,
  L28_GROUND,
];

// ---- Stage 29: てんくうのはて ----
// 1タイル足場を交えた空中回廊。パタパタがジャンプの軌道を横切る
const L29_GROUND = W(12) + D(96) + W(16);
const LEVEL_29 = [
  '', '', '', '',
  D(50) + 'F',
  D(30) + 'oo' + D(40) + 'oo',
  '',
  D(28) + '==' + D(30) + '==',
  D(36) + 'o' + D(3) + 'F' + D(6) + 'o' + D(10) + 'o' + D(11) + 'F',
  D(8) + 'M' + D(80) + '?',
  D(14) + '==' + D(4) + '=' + D(4) + '==' + D(4) + '=' + D(4) + '==' + D(5) + '==' +
    D(4) + '=' + D(4) + '==' + D(5) + '==' + D(4) + '=' + D(4) + '==' + D(5) + '==' +
    D(4) + '=' + D(4) + '==' + D(5) + '==' + D(4) + '==',
  D(3) + 'S' + D(7) + 'E' + D(110) + 'G',
  L29_GROUND,
  L29_GROUND,
];

// ---- Stage 30: さいごのけっせん ----
// 全ギミック総動員の最長ステージ。敵ラッシュ→トゲ地帯→大穴の足場渡りでフィナーレ
const L30_GROUND = W(40) + D(5) + W(20) + D(5) + W(25) + D(24) + W(21);
const LEVEL_30 = [
  '', '', '', '',
  '',
  D(120) + 'F',
  D(30) + 'ooo',
  D(96) + 'F' + D(20) + 'F',
  D(40) + 'ooooo' + D(20) + 'ooooo' + D(28) + 'oooo',
  D(18) + 'M' + D(35) + '?.T',
  D(95) + '==' + D(4) + '==' + D(4) + '==' + D(4) + '==',
  D(3) + 'S' + D(8) + 'K' + D(4) + 'E' + D(6) + 'HHHH' + D(8) + 'E.E' + D(10) + 'HH' +
    D(8) + 'K' + D(12) + 'HHHH' + D(8) + 'E' + D(6) + 'HHH' + D(30) + 'K' + D(6) + 'G',
  L30_GROUND,
  L30_GROUND,
];

// ---- Stage EX: エクストラ：天空の跳躍 ----
// ほぼ全面が奈落。1タイル足場を渡り、H+# の壁 (col 23/52/68) の直前にだけ
// パタパタ (F) を計3体配置。壁越えは踏む瞬間にタイミングよくジャンプを押す
// 大ジャンプ (STOMP_JUMP_V) で行う (押さない小バウンドでは激突する)。
// F は一度踏むと羽を失って落ちるため、壁越えは各回一発勝負。
// F は足場列の1段上 (row 9) に浮遊させ、踏んだ位置からの上昇 (約100px)
// で振幅のどの位相で踏んでも壁上端 (row 8) を越えられるようにしている。
const LEX_GROUND = W(10) + D(90) + W(15);
const LEVEL_EX = [
  '', '', '', '', '',
  '',
  D(44) + 'ooo' + D(32) + 'ooo',
  '',
  D(23) + 'H' + D(9) + 'ooo' + D(9) + 'o' + D(6) + 'H' + D(6) + 'ooo' + D(6) + 'H' + D(11) + 'o',
  D(22) + 'F#' + D(18) + 'o' + D(8) + 'F#' + D(14) + 'F#' + D(8) + 'o',
  D(13) + '=' + D(3) + '=' + D(7) + '=' + D(3) + '=' + D(3) + '===' + D(3) + '=' +
    D(3) + '=' + D(2) + '=' + D(7) + '=' + D(3) + '=====' + D(7) + '=' + D(3) + '=' +
    D(3) + '=' + D(2) + '=' + D(2) + '=' + D(3) + '=' + D(3) + '=' + D(3) + '=',
  D(3) + 'S' + D(97) + 'G',
  LEX_GROUND,
  LEX_GROUND,
];

const RAW_LEVELS = [
  LEVEL_1, LEVEL_2, LEVEL_3, LEVEL_4, LEVEL_5,
  LEVEL_6, LEVEL_7, LEVEL_8, LEVEL_9, LEVEL_10,
  LEVEL_11, LEVEL_12, LEVEL_13, LEVEL_14, LEVEL_15,
  LEVEL_16, LEVEL_17, LEVEL_18, LEVEL_19, LEVEL_20,
  LEVEL_21, LEVEL_22, LEVEL_23, LEVEL_24, LEVEL_25,
  LEVEL_26, LEVEL_27, LEVEL_28, LEVEL_29, LEVEL_30,
  LEVEL_EX,
];

export const LEVEL_NAMES = [
  'はじまりの草原', 'だんさとトゲ', 'そらのあしば', 'リズムのたに', 'ちかつうろ',
  'トゲのかいろう', 'おおきなかいだん', 'スピードラン', 'てんくうのとう', 'さいごのしれん',
  'カメのこうしん', 'うきしまのうみ', 'トゲトゲロード', 'ピラミッドごえ', 'ちかめいろ',
  'パタパタのそら', 'ちょうスピードラン', 'くものとりで', 'トゲのだいかいろう', 'けっせんのみち',
  'カメのぐんたい', 'ふたごのとう', 'じごくのちかどう', 'とびとびのしま', 'トゲのうみ',
  'かぜのこみち', 'ちょうおおジャンプ', 'やみのめいろ', 'てんくうのはて', 'さいごのけっせん',
  'エクストラ：天空の跳躍',
];

export const LEVEL_COUNT = RAW_LEVELS.length;

// 最終ステージ (31番目) はエクストラ扱い。表示は番号ではなく「EX」にする
export const EX_STAGE = LEVEL_COUNT;
export const stageLabel = (n) => (n === EX_STAGE ? 'EX' : String(n));

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
    this.blockCoins = new Map(); // "tx,ty" -> 10コインブロックの残りコイン数

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
        } else if (ch === 'T') {
          this.blockCoins.set(`${x},${y}`, 10);
        }
      }
    }

    this.pixelWidth = this.width * TILE;
    this.pixelHeight = this.height * TILE;

    this.placeCheckpoint();
  }

  // 中間チェックポイントの自動配置 (EXステージを除く)。
  // ステージ中央から外側へ向かって、旗を立てられる足場
  // (足元がソリッド/すり抜け床・上2タイルが空間・隣にトゲなし) を探す。
  placeCheckpoint() {
    if (this.index === RAW_LEVELS.length - 1) return; // EXは一発勝負のまま
    const mid = Math.floor(this.width / 2);
    const maxOff = Math.floor(this.width / 3);
    for (let off = 0; off <= maxOff; off++) {
      for (const x of off === 0 ? [mid] : [mid - off, mid + off]) {
        if (x < 2 || x >= this.width - 2) continue;
        // 各列で最上段の足場のみを検討する (地下ステージの天井を避ける)
        for (let y = 2; y < this.height - 1; y++) {
          const ch = this.grid[y][x];
          const footing = ch === '#' || ch === '=' || ch === 'B' || ch === 'U' || ch === 'T';
          if (!footing) continue;
          const clear = this.grid[y - 1][x] === '.' && this.grid[y - 2][x] === '.';
          const noSpike =
            this.grid[y - 1][x - 1] !== 'H' && this.grid[y - 1][x + 1] !== 'H' &&
            this.grid[y][x - 1] !== 'H' && this.grid[y][x + 1] !== 'H';
          if (clear && noSpike) {
            this.checkpointX = x;  // 旗のあるタイル列
            this.checkpointTy = y; // 旗が立つ足場タイルの行 (この上面にリスポーン)
            return;
          }
          break;
        }
      }
    }
  }

  // 10コインブロックからコインを1枚取り出し、残数を返す
  takeBlockCoin(tx, ty) {
    const key = `${tx},${ty}`;
    const left = (this.blockCoins.get(key) ?? 1) - 1;
    this.blockCoins.set(key, left);
    return left;
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

// ---- 累計コイン数のセーブ (localStorage) ----
const TOTAL_COINS_KEY = 'super-ryotan-total-coins-v1';

export function loadTotalCoins() {
  try {
    const n = parseInt(localStorage.getItem(TOTAL_COINS_KEY), 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveTotalCoins(count) {
  try {
    localStorage.setItem(TOTAL_COINS_KEY, String(count));
  } catch {
    // localStorage 不可 (プライベートモード等) でもゲームは続行
  }
}

