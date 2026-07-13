// ============================================
// 全ステージのクリア可能性テスト
// 実際の物理エンジン (updatePhysics) でプレイヤーを操作する探索ソルバーを走らせ、
// スタートからゴールまで到達できる入力列が存在することを機械的に証明する。
// - 敵は「回避・撃破可能」の前提で除外し、地形 (穴・トゲ・壁) の攻略可能性を検証する
// - EXステージのみパタパタ踏み台ジャンプが必須の設計なので対象外 (手動検証済み)
// ============================================

import { describe, it, expect } from 'vitest';
import { updatePhysics, TILE } from '../src/physics.js';
import { Level, LEVEL_COUNT, LEVEL_NAMES } from '../src/level.js';

const PLAYER_W = 24;
const PLAYER_H = 44; // スモール状態 (最悪ケース) で検証する

function makePlayer(level) {
  return {
    x: level.startX, y: level.startY, w: PLAYER_W, h: PLAYER_H,
    vx: 0, vy: 0, power: 'small', invincible: 0, facing: 1,
    onGround: false, jumping: false, jumpCut: false, skidding: false,
    jumpHeldPrev: true, coyoteFrames: 0, jumpBufferFrames: 0,
    stompGraceFrames: 0, riseFrames: 0, stompChain: 0,
  };
}

function clonePlayer(p) {
  return { ...p };
}

// 1プラン = 「入力を一定フレーム保持 → 着地するまで待つ」のマクロ行動。
// 戻り値: 'goal' | 'dead' | 着地時のプレイヤー状態
function runPlan(level, startPlayer, plan) {
  const p = clonePlayer(startPlayer);
  const MAX_FRAMES = 400;
  for (let f = 0; f < MAX_FRAMES; f++) {
    const holding = f < plan.hold;
    const input = {
      left: (holding ? plan.dir : plan.dirAfter ?? plan.dir) < 0,
      right: (holding ? plan.dir : plan.dirAfter ?? plan.dir) > 0,
      dash: plan.dash,
      jump: plan.jump && holding,
    };
    const events = updatePhysics(p, input, level);
    if (events.goal) return 'goal';
    if (events.spike || events.fellOff) return 'dead';
    // 入力保持が終わった後、接地したらプラン終了 (次の意思決定点)
    if (f >= plan.hold - 1 && p.onGround) {
      p.jumpHeldPrev = false;
      return p;
    }
  }
  return 'dead'; // 着地できないまま時間切れ (実質落下死)
}

// 地上の意思決定点から展開する行動プラン一覧
function plansFrom() {
  const plans = [];
  // 走る (ダッシュ長短 + 微調整の歩き)
  for (const dir of [1, -1]) {
    for (const hold of [8, 20, 40]) {
      plans.push({ dir, dash: true, jump: false, hold });
    }
    plans.push({ dir, dash: false, jump: false, hold: 4 });
  }
  // ジャンプ (方向 × ボタン保持フレーム = 可変ジャンプ高)
  for (const dir of [1, -1, 0]) {
    for (const hold of [2, 6, 12, 18, 26]) {
      plans.push({ dir, dash: true, jump: true, hold });
      if (dir !== 0) {
        // 頂点で方向キーを離して真下に落ちる変種 (精密着地用)
        plans.push({ dir, dash: true, jump: true, hold, dirAfter: 0 });
      }
    }
    // 歩きジャンプ (低速で距離を抑える)
    plans.push({ dir, dash: false, jump: true, hold: 12 });
  }
  return plans;
}

const ALL_PLANS = plansFrom();

function stateKey(p) {
  return `${Math.round(p.x / 6)},${Math.round(p.y / 8)},${Math.round(p.vx)}`;
}

/**
 * 貪欲最良優先探索 (x座標が大きい状態を優先)。
 * ゴールイベントに到達したら true。
 */
function solveStage(index, maxNodes = 30000) {
  const level = new Level(index);
  level.enemies = []; // 地形の攻略可能性のみを検証する
  const start = makePlayer(level);

  // スタート地点から自由落下して最初の接地状態を得る
  let s = start;
  for (let f = 0; f < 120 && !s.onGround; f++) {
    const events = updatePhysics(s, { left: false, right: false, dash: false, jump: false }, level);
    if (events.goal) return true;
    if (events.spike || events.fellOff) return false;
  }
  if (!s.onGround) return false;
  s.jumpHeldPrev = false;

  const visited = new Set([stateKey(s)]);
  // 優先度付きキュー代わり: x降順ソートの配列 (規模が小さいので十分)
  const frontier = [s];
  let expanded = 0;

  while (frontier.length > 0 && expanded < maxNodes) {
    // x座標が最大の状態を貪欲に展開する (全ステージ左→右進行)
    let bi = 0;
    for (let i = 1; i < frontier.length; i++) {
      if (frontier[i].x > frontier[bi].x) bi = i;
    }
    const cur = frontier.splice(bi, 1)[0];
    expanded++;

    for (const plan of ALL_PLANS) {
      const result = runPlan(level, cur, plan);
      if (result === 'goal') return true;
      if (result === 'dead') continue;
      const key = stateKey(result);
      if (visited.has(key)) continue;
      visited.add(key);
      frontier.push(result);
    }
  }
  return false;
}

describe('全ステージのクリア可能性 (物理シミュレーションによる到達性検証)', () => {
  // EX (最終インデックス) はパタパタ踏み台が必須設計のためソルバー対象外
  for (let i = 0; i < LEVEL_COUNT - 1; i++) {
    it(`Stage ${i + 1} 「${LEVEL_NAMES[i]}」がスタートからゴールまで到達可能なこと`, () => {
      expect(solveStage(i), `Stage ${i + 1} のゴールに到達できない`).toBe(true);
    }, 120000);
  }
});

describe('全ステージの構造の健全性', () => {
  for (let i = 0; i < LEVEL_COUNT; i++) {
    it(`Stage ${i + 1} 「${LEVEL_NAMES[i]}」の基本構造が正しいこと`, () => {
      const lvl = new Level(i);
      // ゴールが存在する
      expect(lvl.goalX, 'ゴールがない').toBeDefined();
      // ゴールポールの真下に足場があり、落下死せず旗に触れられる
      let solidBelowGoal = false;
      for (let y = lvl.goalY + 1; y < lvl.height; y++) {
        if (lvl.grid[y][lvl.goalX] === '#') { solidBelowGoal = true; break; }
      }
      expect(solidBelowGoal, 'ゴールの下に地面がない').toBe(true);
      // スタートの真下にも足場がある
      const stx = Math.floor(lvl.startX / TILE);
      let solidBelowStart = false;
      for (let y = 0; y < lvl.height; y++) {
        const ch = lvl.grid[y][stx];
        if (ch === '#' || ch === 'B' || ch === '=') { solidBelowStart = true; break; }
      }
      expect(solidBelowStart, 'スタートの下に地面がない').toBe(true);
    });
  }
});
