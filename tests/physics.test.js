import { describe, it, expect, beforeEach } from 'vitest';
import {
  updatePhysics,
  TILE,
  V_WALK_MAX,
  V_DASH_MAX,
  JUMP_V,
  JUMP_V_DASH,
  G_RISE,
  G_FALL,
  SHELL_SPEED,
  ITEM_SPEED,
  STOMP_BOUNCE_V,
  STOMP_JUMP_V
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
      expect(player.vy).toBe(STOMP_BOUNCE_V); // 踏みつけ後の跳ね返り
      expect(events.stomped).toBe(true);
      expect(events.spike).toBe(false);
    });

    it('踏む瞬間にジャンプを押していると大ジャンプ (STOMP_JUMP_V) になること', () => {
      const enemy = {
        x: 32, y: 72, w: 24, h: 24,
        vx: -0.7, vy: 0,
        dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [enemy];

      player.onGround = false;
      player.vy = 2.0;
      player.y = 72 - 44 + 1;
      input.jump = true; // このフレームで押した (jumpHeldPrev = false)

      const events = updatePhysics(player, input, level);

      expect(events.stomped).toBe(true);
      expect(player.vy).toBe(STOMP_JUMP_V);
      expect(player.jumping).toBe(true);
    });

    it('踏んだ直後の猶予フレーム内のジャンプ押下も大ジャンプに変換されること', () => {
      const enemy = {
        x: 32, y: 72, w: 24, h: 24,
        vx: -0.7, vy: 0,
        dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [enemy];

      // フレーム1: ボタンなしで踏む → 小バウンド
      player.onGround = false;
      player.vy = 2.0;
      player.y = 72 - 44 + 1;
      const ev1 = updatePhysics(player, input, level);
      expect(ev1.stomped).toBe(true);
      expect(player.vy).toBe(STOMP_BOUNCE_V);

      // フレーム2: 猶予内にジャンプ押下 → 大ジャンプに変換 (重力1フレーム分が乗る)
      input.jump = true;
      updatePhysics(player, input, level);
      expect(player.vy).toBe(STOMP_JUMP_V + G_RISE);
      expect(player.jumping).toBe(true);
    });

    it('ボタンを押しっぱなし (長押し) のまま踏んでも大ジャンプにはならないこと', () => {
      const enemy = {
        x: 32, y: 72, w: 24, h: 24,
        vx: -0.7, vy: 0,
        dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [enemy];

      player.onGround = false;
      player.vy = 2.0;
      player.y = 72 - 44 + 1;
      input.jump = true;
      player.jumpHeldPrev = true; // 前フレームから押しっぱなし

      const events = updatePhysics(player, input, level);

      expect(events.stomped).toBe(true);
      expect(player.vy).toBe(STOMP_BOUNCE_V); // 小バウンドのまま
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

  describe('4. 走行連動ジャンプ・コヨーテタイム・先行入力', () => {
    it('ダッシュ速度でジャンプすると初速が強化されること (SMB準拠)', () => {
      player.vx = V_DASH_MAX;
      input.right = true;
      input.dash = true;
      input.jump = true;
      const events = updatePhysics(player, input, level);
      expect(events.jumped).toBe(true);
      expect(player.vy).toBe(JUMP_V_DASH + G_RISE);
    });

    it('歩行速度以下のジャンプは通常初速のままであること', () => {
      player.vx = V_WALK_MAX;
      input.right = true;
      input.jump = true;
      updatePhysics(player, input, level);
      expect(player.vy).toBe(JUMP_V + G_RISE);
    });

    it('崖を離れた直後 (コヨーテタイム内) でもジャンプできること', () => {
      const airLevel = { ...level, tileAt: () => '.' };
      // 足場が消えて3フレーム落下 (猶予5F以内)
      updatePhysics(player, input, airLevel);
      updatePhysics(player, input, airLevel);
      updatePhysics(player, input, airLevel);
      input.jump = true;
      const events = updatePhysics(player, input, airLevel);
      expect(events.jumped).toBe(true);
      expect(player.vy).toBeLessThan(0);
    });

    it('コヨーテ猶予を過ぎたら空中ではジャンプできないこと', () => {
      const airLevel = { ...level, tileAt: () => '.' };
      for (let i = 0; i < 8; i++) updatePhysics(player, input, airLevel);
      input.jump = true;
      const events = updatePhysics(player, input, airLevel);
      expect(events.jumped).toBeUndefined();
      expect(player.vy).toBeGreaterThan(0);
    });

    it('着地直前のジャンプ入力が先行受付され、着地後に自動でジャンプすること', () => {
      // 地面上面 (y=256) の少し上から落下しながらボタンを押す
      player.y = 8 * TILE - player.h - 10;
      player.onGround = false;
      player.vy = 3.0;
      input.jump = true; // 空中で押す (エッジ)
      updatePhysics(player, input, level);
      let jumped = false;
      for (let i = 0; i < 5; i++) {
        const events = updatePhysics(player, input, level); // 押しっぱなし
        if (events.jumped) { jumped = true; break; }
      }
      expect(jumped).toBe(true);
      expect(player.vy).toBeLessThan(0);
    });
  });

  describe('6. パワーアップ・きのこ・無敵時間', () => {
    it('無敵時間中は敵に横から触れてもダメージを受けず、無敵が減少すること', () => {
      const enemy = {
        x: 50, y: 32, w: 24, h: 24,
        vx: -0.7, vy: 0, dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [enemy];
      player.x = 40;
      player.y = 32;
      player.invincible = 10;

      const events = updatePhysics(player, input, level);

      expect(events.spike).toBe(false);
      expect(player.invincible).toBe(9);
    });

    it('きのこがブロックからせり上がった後、自走を開始すること', () => {
      level.items = [{
        x: 100, y: 5 * TILE - 4, targetY: 5 * TILE - 24 - 0.2,
        w: 24, h: 24, vx: 0, vy: 0, state: 'rising',
      }];
      // せり上がり (0.5px/frame) が完了するまで回す
      for (let i = 0; i < 60; i++) updatePhysics(player, input, level);
      const it = level.items[0];
      expect(it.state).toBe('move');
      expect(it.vx).toBe(ITEM_SPEED);
    });

    it('自走中のきのこが地面上を移動し、重力で接地を維持すること', () => {
      const item = {
        x: 100, y: 8 * TILE - 24 - 0.2,
        w: 24, h: 24, vx: ITEM_SPEED, vy: 0, state: 'move',
      };
      level.items = [item];
      const x0 = item.x;
      for (let i = 0; i < 10; i++) updatePhysics(player, input, level);
      expect(item.x).toBeGreaterThan(x0);
      expect(item.y + item.h).toBeLessThanOrEqual(8 * TILE);
    });

    it('プレイヤーがきのこに触れると powerup イベントが発生し、アイテムが消えること', () => {
      level.items = [{
        x: player.x, y: player.y,
        w: 24, h: 24, vx: ITEM_SPEED, vy: 0, state: 'move',
      }];
      const events = updatePhysics(player, input, level);
      expect(events.powerup).toBe(true);
      expect(level.items.length).toBe(0);
    });
  });

  describe('7. ノコノコ風 (koopa) と甲羅', () => {
    const makeKoopa = (x, y) => ({
      type: 'koopa', state: 'walk', shellTimer: 0,
      x, y, w: 24, h: 30,
      vx: -0.6, vy: 0, onGround: true, dead: false, deadTimer: 0, animTime: 0,
    });

    it('歩行中のノコノコを踏むと甲羅状態になること (死なない)', () => {
      const koopa = makeKoopa(32, 8 * TILE - 30);
      level.enemies = [koopa];
      player.vy = 2.0;
      player.y = koopa.y - player.h + 1; // 敵の天面に少し重なる
      player.x = koopa.x;

      const events = updatePhysics(player, input, level);

      expect(koopa.dead).toBe(false);
      expect(koopa.state).toBe('shell');
      expect(koopa.vx).toBe(0);
      expect(events.stomped).toBe(true);
      expect(player.vy).toBe(STOMP_BOUNCE_V); // 跳ね返り
    });

    it('静止甲羅に横から触れると蹴り出され、滑走すること (ダメージなし)', () => {
      const shell = makeKoopa(60, 8 * TILE - 20);
      shell.state = 'shell';
      shell.h = 20;
      shell.vx = 0;
      level.enemies = [shell];
      // プレイヤーが左から接触
      player.x = 44;
      player.y = 8 * TILE - player.h;
      player.vy = 0;

      const events = updatePhysics(player, input, level);

      expect(events.spike).toBe(false);
      expect(events.kicked).toBe(true);
      expect(shell.state).toBe('slide');
      expect(shell.vx).toBe(SHELL_SPEED); // 左から蹴ったので右へ滑走
    });

    it('滑走中の甲羅が他の敵に当たると連鎖撃破すること', () => {
      const shell = makeKoopa(50, 8 * TILE - 20);
      shell.state = 'slide';
      shell.h = 20;
      shell.vx = SHELL_SPEED;
      const victim = {
        x: 60, y: 8 * TILE - 24,
        w: 24, h: 24, vx: -0.7, vy: 0,
        onGround: true, dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [shell, victim];
      player.x = 200; // プレイヤーは離れた場所
      player.y = 0;

      const events = updatePhysics(player, input, level);

      expect(victim.dead).toBe(true);
      expect(events.shellKills.length).toBe(1);
    });
  });

  describe('8. パタパタ風 (flyer)', () => {
    it('上下に浮遊し、地形や重力の影響を受けないこと', () => {
      const baseY = 4 * TILE;
      const flyer = {
        type: 'flyer', x: 200, y: baseY, baseY,
        w: 26, h: 22, vx: 0, vy: 0,
        onGround: false, dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [flyer];
      player.x = 0; player.y = 0;

      let minY = Infinity, maxY = -Infinity;
      for (let i = 0; i < 200; i++) {
        updatePhysics(player, input, level);
        minY = Math.min(minY, flyer.y);
        maxY = Math.max(maxY, flyer.y);
      }
      expect(minY).toBeGreaterThanOrEqual(baseY - 28.01); // 振幅28pxの範囲内
      expect(maxY).toBeLessThanOrEqual(baseY + 28.01);
      expect(maxY - minY).toBeGreaterThan(20); // 実際に上下している
    });

    it('踏むと羽を失い歩行型 (walker) に変化すること', () => {
      const flyer = {
        type: 'flyer', x: 32, y: 100, baseY: 100,
        w: 26, h: 22, vx: 0, vy: 0,
        onGround: false, dead: false, deadTimer: 0, animTime: 0,
      };
      level.enemies = [flyer];
      player.vy = 2.0;
      player.x = flyer.x;
      player.y = flyer.y - player.h + 1;

      const events = updatePhysics(player, input, level);

      expect(flyer.type).toBe('walker');
      expect(flyer.dead).toBe(false);
      expect(events.stomped).toBe(true);
    });
  });

  describe('5. すり抜け床 (=)', () => {
    const platLevel = () => ({
      ...level,
      enemies: [],
      tileAt: (tx, ty) => (ty === 5 ? '=' : ty >= 8 ? '#' : '.'),
    });

    it('下から上昇中はすり抜けて天井扱いにならないこと', () => {
      const lvl = platLevel();
      player.y = 6 * TILE + 2; // 床のすぐ下
      player.onGround = false;
      player.jumping = true;
      player.jumpHeldPrev = true;
      player.vy = -6.0;
      input.jump = true;
      const before = player.y;
      updatePhysics(player, input, lvl);
      expect(player.y).toBeLessThan(before); // 上へ抜けている
      expect(player.vy).toBeLessThan(0);     // 止められていない
    });

    it('上から落下すると床上面に着地すること', () => {
      const lvl = platLevel();
      player.y = 5 * TILE - player.h - 6; // 床上面の6px上
      player.onGround = false;
      player.vy = 7.0;
      updatePhysics(player, input, lvl);
      expect(player.onGround).toBe(true);
      expect(player.vy).toBe(0);
      expect(player.y + player.h).toBeCloseTo(5 * TILE - 0.2, 1);
    });

    it('床の上に立ち続けられること (接地が維持される)', () => {
      const lvl = platLevel();
      player.y = 5 * TILE - player.h - 6;
      player.onGround = false;
      player.vy = 7.0;
      for (let i = 0; i < 30; i++) updatePhysics(player, input, lvl);
      expect(player.onGround).toBe(true);
      expect(player.y + player.h).toBeLessThanOrEqual(5 * TILE);
    });
  });
});
