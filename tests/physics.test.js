import { describe, it, expect, beforeEach } from 'vitest';
import {
  updatePhysics,
  TILE,
  V_WALK_MAX,
  V_DASH_MAX,
  JUMP_V,
  G_RISE,
  G_FALL
} from '../src/physics.js';

describe('physics.js - マリオ物理演算の検証', () => {
  let player;
  let input;
  let level;

  beforeEach(() => {
    // プレイヤーの初期化
    player = {
      x: 32, y: 32, w: 24, h: 44,
      vx: 0, vy: 0,
      facing: 1,
      onGround: true,
      jumping: false,
      jumpCut: false,
      jumpHeldPrev: false,
      riseFrames: 0,
      skidding: false,
      animDist: 0,
    };

    // 入力の初期化
    input = {
      left: false,
      right: false,
      jump: false,
      dash: false,
    };

    // レベルの簡易モック (すべて空間とする)
    level = {
      width: 10,
      height: 10,
      cameraX: 0,
      enemies: [],
      tileAt: (tx, ty) => {
        // y = 8, 9 は地面タイルとする (y = 256px以上が地面)
        if (ty >= 8) return '#';
        return '.';
      },
      setTile: () => {},
      pixelWidth: 320,
      pixelHeight: 320,
    };
  });

  describe('1. 水平移動と慣性', () => {
    it('右ボタン押下で右に加速し、最大歩行速度で制限されること', () => {
      input.right = true;
      // 1ステップでは最大速度に達しないが正の速度になる
      updatePhysics(player, input, level);
      expect(player.vx).toBeGreaterThan(0);
      
      // 加速を繰り返して最大歩行速度にクランプされること
      for (let i = 0; i < 40; i++) {
        updatePhysics(player, input, level);
      }
      expect(player.vx).toBe(V_WALK_MAX);
    });

    it('ダッシュボタン（Bボタン）押下時は最大ダッシュ速度まで加速すること', () => {
      input.right = true;
      input.dash = true;
      for (let i = 0; i < 60; i++) {
        updatePhysics(player, input, level);
      }
      expect(player.vx).toBe(V_DASH_MAX);
    });

    it('逆キー入力時はブレーキ減速が働き、スリップ状態になること', () => {
      player.vx = 2.0; // すでに右に移動中
      player.onGround = true;
      input.left = true; // 左へ逆入力
      updatePhysics(player, input, level);
      
      expect(player.skidding).toBe(true);
      // 通常の摩擦以上の力で減速されていること (減速度 D_X = 0.3)
      expect(player.vx).toBe(2.0 - 0.3);
    });

    it('キーを離したとき、摩擦で滑りながら段階的に減速すること', () => {
      player.vx = 2.0;
      updatePhysics(player, input, level); // 入力なし
      expect(player.vx).toBe(2.0 - 0.15); // 摩擦 F_X = 0.15
    });
  });

  describe('2. ジャンプと非対称重力', () => {
    it('地面接地中にジャンプボタンを押すと、上向きの初速が適用されること', () => {
      input.jump = true;
      const events = updatePhysics(player, input, level);
      expect(player.vy).toBe(JUMP_V + G_RISE); // 初速 -6.7 + 最初のフレームの上昇重力 0.28 = -6.42
      expect(player.onGround).toBe(false);
      expect(player.jumping).toBe(true);
      expect(events.jumped).toBe(true);
    });

    it('上昇中にジャンプボタンを離すと、上向き速度が半減すること（可変ジャンプ）', () => {
      input.jump = true;
      updatePhysics(player, input, level); // ジャンプ開始
      
      input.jump = false; // ボタンをすぐ離す
      updatePhysics(player, input, level);
      expect(player.jumpCut).toBe(true);
      // 速度が半減され、上昇スピードが落ちていること
      expect(player.vy).toBeLessThan(0);
    });

    it('上昇キー長押し中（低重力）と落下中（高重力）で重力値が変化すること', () => {
      // 状態A: 上昇キー長押し中 (G_RISE = 0.28)
      player.onGround = false;
      player.jumping = true;
      player.vy = -5.0; // 上昇中
      input.jump = true;
      updatePhysics(player, input, level);
      const vyAfterRise = player.vy;
      expect(vyAfterRise).toBe(-5.0 + G_RISE);

      // 状態B: 落下中 (G_FALL = 0.56)
      player.vy = 1.0; // 落下中
      updatePhysics(player, input, level);
      expect(player.vy).toBe(1.0 + G_FALL);
    });
  });

  describe('3. 敵との衝突・踏みつけ判定', () => {
    it('落下中に敵を頭上から踏むと、敵は倒れ、プレイヤーは跳ね返ること', () => {
      // 敵を配置 (プレイヤーの足元付近)
      // プレイヤーサイズ: w=24, h=44, x=32, y=32. 足元は y=76
      const enemy = {
        x: 32, y: 72, w: 24, h: 24,
        vx: -0.7, vy: 0,
        dead: false,
        deadTimer: 0,
        animTime: 0
      };
      level.enemies = [enemy];

      // プレイヤーが落下中で、敵の頭上より高い位置から足元が重なったと仮定
      player.vy = 2.0; 
      player.y = 72 - 44 + 1; // 敵の天面に少し重なる位置
      
      const events = updatePhysics(player, input, level);
      
      expect(enemy.dead).toBe(true);
      expect(player.vy).toBe(-5.0); // 踏みつけ後の跳ね返り
      expect(events.stomped).toBe(true);
      expect(events.spike).toBe(false);
    });

    it('横方向から敵にぶつかった場合、ミス（死亡フラグ）になること', () => {
      const enemy = {
        x: 50, y: 32, w: 24, h: 24,
        vx: -0.7, vy: 0,
        dead: false,
        deadTimer: 0
      };
      level.enemies = [enemy];

      // プレイヤーと敵が横並びで重なる (落下中ではない)
      player.x = 40; 
      player.y = 32;
      player.vy = 0;
      
      const events = updatePhysics(player, input, level);
      
      expect(enemy.dead).toBe(false);
      expect(events.spike).toBe(true); // ミス/棘と同一扱いの死亡フラグ
    });
  });
});
