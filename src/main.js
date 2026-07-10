// ============================================
// SUPER RYO-TAN — エントリーポイント / ゲームループ
// ============================================

import './style.css';
import { initPWA } from './pwa.js';
import { initInput, input } from './input.js';
import { TILE, G_FALL, updatePhysics, V_WALK_MAX, collidesSolid, SHELL_REVIVE_FRAMES } from './physics.js';
import { Level, LEVEL_COUNT, LEVEL_NAMES, EX_STAGE, stageLabel, loadProgress, saveProgress, loadBestTime, saveBestTime, loadTotalCoins, saveTotalCoins } from './level.js';
import { HAIR_COLORS, loadOwnedItems, loadSelectedHair, selectHair, buyHairColor } from './shop.js';
import {
  unlockAudio, sfxJump, sfxCoin, sfxBump, sfxBlock,
  sfxDeath, sfxClear, sfxSelect, sfxKick, sfxBreak,
  sfxFlag, sfxFirework, sfxPowerup, sfxShrink,
  sfxCheckpoint, startBgm, stopBgm
} from './audio.js';

const VIEW_W = 800;
const VIEW_H = 450;

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true; // 高解像度スプライトの縮小描画のため有効

// ---- スプライトシート (public/character.png) ----
// 背景透過処理済みシートから各ポーズを切り出す (実測座標)
const SPRITE_FRAMES = {
  idle: { x: 35, y: 27, w: 274, h: 430 },
  run: { x: 356, y: 75, w: 245, h: 381 },
  jump: { x: 638, y: 34, w: 246, h: 338 },
  fall: { x: 668, y: 970, w: 193, h: 179 }, // ミス時の落下ポーズ
};

const sprite = new Image();
let spriteReady = false;
sprite.onload = () => { spriteReady = true; };
sprite.src = import.meta.env.BASE_URL + encodeURIComponent('character.png');

// ---- 髪色の付け替え (ショップ) ----
// 金髪部分 (色相28〜55°・彩度0.3以上。肌は15〜22°、ブーツは16〜24°なので重ならない)
// のピクセルだけ色相を差し替えたスプライトを生成してキャッシュする
let selectedHair = loadSelectedHair();
const spriteVariants = new Map(); // hairId -> canvas

function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

function buildHairVariant(hue) {
  const cv = document.createElement('canvas');
  cv.width = sprite.naturalWidth;
  cv.height = sprite.naturalHeight;
  const c = cv.getContext('2d');
  c.drawImage(sprite, 0, 0);
  const imgData = c.getImageData(0, 0, cv.width, cv.height);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 10) continue;
    const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
    if (h >= 28 && h <= 55 && s >= 0.28 && l >= 0.2 && l <= 0.85) {
      const [r, g, b] = hslToRgb(hue, s, l);
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
    }
  }
  c.putImageData(imgData, 0, 0);
  return cv;
}

function getPlayerSprite() {
  if (!spriteReady) return null;
  const color = HAIR_COLORS.find((c) => c.id === selectedHair);
  if (!color || color.hue === null) return sprite;
  if (!spriteVariants.has(color.id)) {
    spriteVariants.set(color.id, buildHairVariant(color.hue));
  }
  return spriteVariants.get(color.id);
}


// ---- プレイヤー ----
const PLAYER_W = 24;
const PLAYER_H = 44;        // スモール時の高さ
const PLAYER_H_SUPER = 58;  // スーパー時の高さ (SMB準拠: きのこで大きくなる)

const player = {
  x: 0, y: 0, w: PLAYER_W, h: PLAYER_H,
  vx: 0, vy: 0,
  power: 'small', // small | super
  invincible: 0,  // 被弾後の無敵残りフレーム
  facing: 1,
  onGround: false,
  jumping: false,
  jumpCut: false,
  jumpHeldPrev: false,
  riseFrames: 0,
  coyoteFrames: 0,
  jumpBufferFrames: 0,
  skidding: false,
  animDist: 0,
  deathVy: 0,
  deathRot: 0,
};

// ---- ゲーム状態 ----
let mode = 'menu'; // menu | play | dying | clear
let paused = false; // 中断中 (物理更新とタイム計測を凍結)
let level = null;
let stageNum = 1;
let coins = 0;
let camX = 0;
let clearTimer = 0;
// ゴール演出 (SMB1準拠: ポール滑降 → 飛び降り → 歩き去り + 花火)
let clearPhase = '';    // slide | pause | hop | walk
let clearPhaseTimer = 0;
let clearFlagDrop = 0;  // 旗の下降量 (px)
let clearBonus = 0;     // ポールを掴んだ高さによるボーナスコイン
let stageToast = 0;
let elapsed = 0; // 描画演出用フレームカウンタ
let playTimer = 0; // プレイ時間 (フレーム)
let newRecord = false;
let bestTimeForStage = null;
// 中間チェックポイント
let checkpointReached = false; // 今回のライフで旗に到達済みか
let checkpointCoins = 0;       // 旗到達時点のコイン数 (リスポーン時に復元)
let usedCheckpoint = false;    // チェックポイントから再開したか (タイム記録の対象外になる)

const bumps = new Map(); // "tx,ty" -> 経過フレーム (ブロック叩きアニメ)
let particles = []; // コインポップ演出

// ============================================
// ステージ制御
// ============================================
function loadStage(n) {
  stageNum = n;
  paused = false;
  level = new Level(n - 1);
  coins = 0;
  camX = 0;
  level.cameraX = 0;
  clearTimer = 0;
  clearPhase = '';
  clearPhaseTimer = 0;
  clearFlagDrop = 0;
  stageToast = 110;
  bumps.clear();
  particles = [];
  playTimer = 0;
  newRecord = false;
  bestTimeForStage = loadBestTime(n);
  checkpointReached = false;
  checkpointCoins = 0;
  usedCheckpoint = false;
  respawn();
  mode = 'play';
  startBgm(bgmThemeFor(n));
}

// ステージ番号 → BGMテーマ
function bgmThemeFor(n) {
  if (n === 5 || n === 15) return 'underground';
  if (n === 3 || n === 9 || n === 12 || n === 16 || n === 18) return 'sky';
  if (n === 10 || n === 20 || n === EX_STAGE) return 'final';
  return 'overworld';
}

// ミス後の再開。チェックポイント到達済みならそこから再開する
// (敵・ブロックは復活し、コインは旗到達時点まで戻る。タイム記録は対象外になる)
function respawnAfterDeath() {
  if (checkpointReached && level.checkpointX !== undefined) {
    const cpX = level.checkpointX;
    const cpTy = level.checkpointTy;
    const keepCoins = checkpointCoins;
    loadStage(stageNum);
    checkpointReached = true;
    usedCheckpoint = true;
    checkpointCoins = keepCoins;
    coins = keepCoins;
    player.x = cpX * TILE + (TILE - player.w) / 2;
    player.y = cpTy * TILE - player.h - 0.2;
    camX = Math.max(0, Math.min(player.x - VIEW_W / 3, level.pixelWidth - VIEW_W));
    level.cameraX = camX;
  } else {
    loadStage(stageNum);
  }
}

function respawn() {
  player.x = level.startX;
  player.y = level.startY;
  player.vx = 0;
  player.vy = 0;
  player.power = 'small';
  player.h = PLAYER_H;
  player.invincible = 0;
  player.facing = 1;
  player.onGround = false;
  player.jumping = false;
  player.jumpCut = false;
  player.jumpHeldPrev = true; // ボタン押しっぱなしの即ジャンプ暴発防止
  player.coyoteFrames = 0;
  player.jumpBufferFrames = 0;
  player.skidding = false;
  player.deathRot = 0;
}

function startDeath() {
  mode = 'dying';
  player.deathVy = -7; // 小さく跳ね上がる
  player.deathRot = 0;
  stopBgm();
  sfxDeath();
}

// きのこ取得: スモール → スーパー (足元基準で当たり判定を上に伸ばす)
function growPlayer() {
  player.power = 'super';
  player.y -= PLAYER_H_SUPER - PLAYER_H;
  player.h = PLAYER_H_SUPER;
  // 低い天井の下で取得した場合は頭を天井の下へ押し戻す (めり込みによる吹き飛び防止)
  const hit = collidesSolid(level, player.x, player.y, player.w, player.h);
  if (hit) player.y = (hit.ty + 1) * TILE + 0.25;
  sfxPowerup();
  particles.push({
    x: player.x + player.w / 2, y: player.y - 10,
    vy: -0.5, t: 0, life: 60, kind: 'text', text: 'パワーアップ!',
  });
}

// 被弾: スーパー → スモール + 無敵時間 (SMB準拠)
function shrinkPlayer() {
  player.power = 'small';
  player.y += PLAYER_H_SUPER - PLAYER_H;
  player.h = PLAYER_H;
  player.invincible = 120;
  sfxShrink();
}

function startClear() {
  mode = 'clear';
  clearTimer = 0;
  clearPhase = 'slide';
  clearPhaseTimer = 0;
  clearFlagDrop = 0;

  // ポール左側に張り付く (SMB1: 触れた側からそのまま滑り降りる)
  const poleCX = level.goalX * TILE + TILE / 2;
  player.x = poleCX - player.w + 2;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;

  // 掴んだ高さでボーナス (SMB1: 高いほど高得点 100〜5000点 → 本作はコインで換算)
  const baseY = (level.goalY + 1) * TILE;
  const topY = baseY - TILE * 5.5;
  const grabRatio = 1 - (player.y + player.h - topY) / (baseY - topY);
  clearBonus = grabRatio > 0.8 ? 10 : grabRatio > 0.6 ? 5 : grabRatio > 0.4 ? 3 : grabRatio > 0.2 ? 2 : 1;

  const clearTime = playTimer / 60;
  // チェックポイントから再開したクリアはタイム記録の対象外
  newRecord = usedCheckpoint ? false : saveBestTime(stageNum, clearTime);
  saveProgress(stageNum + 1);
  stopBgm();
  sfxFlag();
}

function finishClear() {
  showScreen(stageNum >= LEVEL_COUNT ? 'allclear-screen' : 'clear-screen');
  mode = 'menu';
}

function spawnFirework(x, y) {
  const colors = ['#ffd23f', '#ff5c7a', '#4ecdc4', '#9b5de5', '#fff6c9'];
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const spd = 1.2 + Math.random() * 1.4;
    particles.push({
      x, y,
      vx: Math.cos(ang) * spd,
      vy: Math.sin(ang) * spd,
      t: 0, life: 32 + Math.random() * 14,
      kind: 'firework',
      color: colors[(Math.random() * colors.length) | 0],
    });
  }
  sfxFirework();
}

// ============================================
// 固定タイムステップ更新
// ============================================
function updateStep() {
  elapsed++;

  if (mode === 'play') {
    level.cameraX = camX;
    const prevOnGround = player.onGround;
    const events = updatePhysics(player, input, level);

    playTimer++;

    if (events.jumped) sfxJump();
    if (events.headBonk) sfxBump();
    if (events.stomped) sfxKick();

    if (!prevOnGround && player.onGround) {
      // 着地ダスト
      for (let i = 0; i < 6; i++) {
        particles.push({
          x: player.x + player.w / 2,
          y: player.y + player.h,
          vx: (i - 2.5) * 0.4,
          vy: -0.5 - Math.random() * 0.5,
          t: 0,
          life: 22,
          kind: 'spark',
        });
      }
    }

    // 走行ダスト
    if (player.onGround && Math.abs(player.vx) > V_WALK_MAX - 0.2 && elapsed % 8 === 0) {
      particles.push({
        x: player.x + player.w / 2 - Math.sign(player.vx) * (player.w / 2),
        y: player.y + player.h,
        vx: -Math.sign(player.vx) * 0.4,
        vy: -0.4,
        t: 0,
        life: 20,
        kind: 'spark',
      });
    }

    // スリップダスト
    if (player.skidding && elapsed % 4 === 0) {
      particles.push({
        x: player.x + player.w / 2,
        y: player.y + player.h,
        vx: (Math.random() * 2 - 1) * 0.5,
        vy: -0.8 - Math.random() * 0.5,
        t: 0,
        life: 25,
        kind: 'spark',
      });
    }

    for (const b of events.bumped) {
      if (b.kind === 'item') {
        bumps.set(`${b.tx},${b.ty}`, 0);
        coins++;
        sfxBlock();
        particles.push({
          x: b.tx * TILE + TILE / 2, y: b.ty * TILE - 6,
          vy: -3.2, t: 0, life: 34, kind: 'coin',
        });
      } else if (b.kind === 'mushroom') {
        bumps.set(`${b.tx},${b.ty}`, 0);
        sfxBlock();
        // きのこがブロック上面からせり上がる
        level.items.push({
          x: b.tx * TILE + (TILE - 24) / 2,
          y: b.ty * TILE - 4,
          targetY: b.ty * TILE - 24 - 0.2,
          w: 24, h: 24,
          vx: 0, vy: 0,
          state: 'rising',
        });
      } else if (b.kind === 'break') {
        // スーパー時のレンガ破壊: 破片が四方に飛び散る
        sfxBreak();
        for (const [dx, dy] of [[-1, -3.4], [1, -3.4], [-1, -1.8], [1, -1.8]]) {
          particles.push({
            x: b.tx * TILE + TILE / 2 + dx * 7,
            y: b.ty * TILE + TILE / 2,
            vx: dx * (1.1 + Math.random() * 0.9),
            vy: dy - Math.random(),
            t: 0,
            life: 44,
            kind: 'debris',
            rot: Math.random() * Math.PI,
            rotV: 0.22 * dx,
          });
        }
      } else if (b.kind === 'bump') {
        bumps.set(`${b.tx},${b.ty}`, 0);
        sfxBump();
      }
    }
    // 下から叩いたブロックの上にいた敵の撃破
    if (events.bumpKills) {
      sfxKick();
      for (const k of events.bumpKills) {
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: k.x, y: k.y,
            vx: (i - 2.5) * 0.6,
            vy: -1 - Math.random(),
            t: 0, life: 24, kind: 'spark',
          });
        }
      }
    }
    // 踏みつけ連鎖ボーナス (着地せず2体目以降: +1, +2, +4, 上限+8)
    if (events.stompChain >= 2) {
      const bonus = Math.min(2 ** (events.stompChain - 2), 8);
      coins += bonus;
      sfxCoin();
      particles.push({
        x: player.x + player.w / 2, y: player.y - 12,
        vy: -0.6, t: 0, life: 45, kind: 'text', text: `コイン +${bonus}`,
      });
    }
    if (events.powerup) {
      if (player.power === 'small') {
        growPlayer();
      } else {
        // スーパー時のきのこはコインボーナス (SMB1のスコア加算に相当)
        coins += 2;
        sfxCoin();
        particles.push({
          x: player.x + player.w / 2, y: player.y - 10,
          vy: -0.5, t: 0, life: 50, kind: 'text', text: 'コイン +2',
        });
      }
    }
    if (events.kicked) sfxKick();
    if (events.shellKills) {
      sfxKick();
      for (const k of events.shellKills) {
        for (let i = 0; i < 6; i++) {
          particles.push({
            x: k.x, y: k.y,
            vx: (i - 2.5) * 0.6,
            vy: -1 - Math.random(),
            t: 0, life: 24, kind: 'spark',
          });
        }
        // 甲羅の連鎖撃破ボーナス (+1, +2, +4, 上限+8)
        if (k.bonus) {
          coins += k.bonus;
          particles.push({
            x: k.x, y: k.y - 16,
            vy: -0.6, t: 0, life: 45, kind: 'text', text: `コイン +${k.bonus}`,
          });
        }
      }
    }
    for (const c of events.coins) {
      coins++;
      sfxCoin();
      particles.push({
        x: c.tx * TILE + TILE / 2, y: c.ty * TILE + TILE / 2,
        vy: -1.6, t: 0, life: 22, kind: 'spark',
      });
    }
    // 中間チェックポイント: 旗の列を越えたら到達 (SMB準拠で高さは問わない)
    if (!checkpointReached && level.checkpointX !== undefined && mode === 'play' &&
        player.x + player.w / 2 >= level.checkpointX * TILE + TILE / 2) {
      checkpointReached = true;
      checkpointCoins = coins;
      sfxCheckpoint();
      particles.push({
        x: level.checkpointX * TILE + TILE / 2, y: (level.checkpointTy - 2) * TILE - 8,
        vy: -0.5, t: 0, life: 60, kind: 'text', text: 'チェックポイント!',
      });
    }

    if (events.fellOff) {
      startDeath(); // 落下は状態に関わらずミス
    } else if (events.spike) {
      if (player.power === 'super') shrinkPlayer();
      else startDeath();
    } else if (events.goal) {
      startClear();
    }

    // カメラ: 画面の1/3より右へ出たら右スクロール、1/4より左へ戻ったら左スクロール
    if (player.x - camX > VIEW_W / 3) {
      camX = player.x - VIEW_W / 3;
    } else if (player.x - camX < VIEW_W / 4) {
      camX = player.x - VIEW_W / 4;
    }
    camX = Math.min(camX, level.pixelWidth - VIEW_W);
    camX = Math.max(camX, 0);

    player.animDist += Math.abs(player.vx);
  } else if (mode === 'dying') {
    // 上に跳ねてから回転しながら画面下へ (衝突無視)
    player.deathVy += G_FALL * 0.55;
    player.y += player.deathVy;
    player.deathRot += 0.12;
    if (player.y > level.pixelHeight + 300) {
      respawnAfterDeath(); // チェックポイント到達済みならそこから、未到達なら最初から
    }
  } else if (mode === 'clear') {
    clearTimer++;
    clearPhaseTimer++;
    const baseY = (level.goalY + 1) * TILE;
    const poleTopY = baseY - TILE * 5.5;
    const slideEndY = baseY - player.h;
    const flagDropMax = (baseY - 10) - (poleTopY + 6) - 26; // 旗がポール下端に達するまで

    if (clearPhase === 'slide') {
      // プレイヤーと旗が一緒にポールを滑り降りる
      player.y = Math.min(player.y + 2.4, slideEndY);
      clearFlagDrop = Math.min(clearFlagDrop + 3, flagDropMax);
      if (player.y >= slideEndY && clearFlagDrop >= flagDropMax) {
        clearPhase = 'pause';
        clearPhaseTimer = 0;
      }
    } else if (clearPhase === 'pause') {
      // 一拍おいてポールの反対側へ飛び降りる (SMB1準拠)
      if (clearPhaseTimer >= 22) {
        clearPhase = 'hop';
        clearPhaseTimer = 0;
        player.vx = 1.5;
        player.vy = -3.8;
        player.onGround = false;
        coins += clearBonus;
        // クリア確定: 今回の獲得コイン (ボーナス込み) を累計に加算して保存
        saveTotalCoins(loadTotalCoins() + coins);
        particles.push({
          x: player.x + player.w / 2 + 14, y: player.y - 8,
          vy: -0.5, t: 0, life: 70, kind: 'text', text: `コイン +${clearBonus}`,
        });
        sfxClear();
      }
    } else if (clearPhase === 'hop' || clearPhase === 'walk') {
      if (clearPhase === 'walk') {
        player.vx = 2.0;
        player.animDist += player.vx;
      }
      player.x += player.vx;
      if (!player.onGround) {
        player.vy = Math.min(player.vy + G_FALL, 8);
        player.y += player.vy;
        const footTy = Math.floor((player.y + player.h) / TILE);
        const ch = level.tileAt(Math.floor((player.x + player.w / 2) / TILE), footTy);
        if (player.vy > 0 && (ch === '#' || ch === '=' || ch === 'B' || ch === 'U' || ch === '?' || ch === 'M')) {
          player.y = footTy * TILE - player.h;
          player.vy = 0;
          player.onGround = true;
          if (clearPhase === 'hop') {
            clearPhase = 'walk';
            clearPhaseTimer = 0;
          }
        }
      }
      if (clearPhase === 'walk') {
        // 打ち上げ花火 (SMB1オマージュ)
        if (clearPhaseTimer === 15 || clearPhaseTimer === 42 || clearPhaseTimer === 69) {
          spawnFirework(
            camX + VIEW_W * (0.35 + Math.random() * 0.4),
            70 + Math.random() * 90,
          );
        }
        const offRight = player.x - camX > VIEW_W - 40 ||
          player.x > level.pixelWidth - TILE;
        if (clearPhaseTimer >= 140 || offRight) finishClear();
      }
      // 安全弁: 万一足場がなく落ち続けた場合もクリア画面へ
      if (player.y > level.pixelHeight + 200) finishClear();
    }
  }

  // 演出更新
  for (const [key, t] of bumps) {
    if (t >= 14) bumps.delete(key);
    else bumps.set(key, t + 1);
  }
  particles = particles.filter((p) => {
    p.t++;
    p.y += p.vy;
    if (p.vx) p.x += p.vx;
    p.vy += p.kind === 'debris' ? 0.24
      : p.kind === 'firework' ? 0.04
      : p.kind === 'text' ? 0
      : 0.12;
    if (p.kind === 'debris' && p.rot !== undefined) {
      p.rot += p.rotV || 0;
    }
    return p.t < p.life;
  });

  if (stageToast > 0) stageToast--;
}

// ============================================
// 描画
// ============================================
const STAGE_TINTS = [
  ['#1a2247', '#2c3a6e'], ['#232047', '#3d3670'], ['#0f2a3f', '#1e4a63'],
  ['#2a1f3d', '#463466'], ['#17141f', '#262033'], ['#301b2c', '#552f4b'],
  ['#1b2c3b', '#2f4d63'], ['#33203a', '#57365f'], ['#101b3c', '#22346b'],
  ['#2b1420', '#4d2438'],
];

function drawBackground(cam) {
  const [top, bottom] = STAGE_TINTS[(stageNum - 1) % STAGE_TINTS.length];
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);

  // 星 (固定疑似乱数)
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (let i = 0; i < 40; i++) {
    const sx = ((i * 137 + 71) % 820) - ((cam * 0.1) % 820);
    const sy = (i * 89 + 23) % 260;
    const tw = (Math.sin(elapsed * 0.03 + i) + 1) * 0.5;
    ctx.globalAlpha = 0.25 + tw * 0.4;
    ctx.fillRect(((sx % 820) + 820) % 820 - 10, sy, 2, 2);
  }
  ctx.globalAlpha = 1;

  // 遠景シルエット (パララックス 0.25)
  ctx.fillStyle = 'rgba(8, 10, 22, 0.55)';
  const px = -(cam * 0.25) % 400;
  for (let i = -1; i < 4; i++) {
    const bx = px + i * 400;
    ctx.beginPath();
    ctx.moveTo(bx, VIEW_H);
    ctx.lineTo(bx + 60, 300);
    ctx.lineTo(bx + 140, 360);
    ctx.lineTo(bx + 230, 260);
    ctx.lineTo(bx + 320, 350);
    ctx.lineTo(bx + 400, VIEW_H);
    ctx.closePath();
    ctx.fill();
  }
}

function drawTile(ch, tx, ty, cam) {
  let x = tx * TILE - cam;
  let y = ty * TILE;
  if (x < -TILE || x > VIEW_W) return;

  const bump = bumps.get(`${tx},${ty}`);
  if (bump !== undefined) {
    y -= Math.sin((bump / 14) * Math.PI) * 8;
  }

  switch (ch) {
    case '#': {
      // 地面: 上端に発光エッジ
      const above = level.tileAt(tx, ty - 1);
      ctx.fillStyle = '#3b2f4f';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      if (above !== '#' && above !== 'B') {
        ctx.fillStyle = '#4ecdc4';
        ctx.fillRect(x, y, TILE, 5);
        ctx.fillStyle = 'rgba(78,205,196,0.35)';
        ctx.fillRect(x, y + 5, TILE, 3);
      }
      break;
    }
    case 'T': // 10コインブロックはSMB準拠でレンガと見分けがつかない
    case 'B': {
      ctx.fillStyle = '#5a3d4a';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
      ctx.beginPath();
      ctx.moveTo(x, y + TILE / 2); ctx.lineTo(x + TILE, y + TILE / 2);
      ctx.moveTo(x + TILE / 2, y); ctx.lineTo(x + TILE / 2, y + TILE / 2);
      ctx.moveTo(x + TILE / 4, y + TILE / 2); ctx.lineTo(x + TILE / 4, y + TILE);
      ctx.stroke();
      break;
    }
    case '=': {
      ctx.fillStyle = '#6b5b95';
      ctx.fillRect(x, y + 2, TILE, TILE - 8);
      ctx.fillStyle = '#ffd23f';
      ctx.fillRect(x, y + 2, TILE, 4);
      break;
    }
    case '?':
    case 'M': { // きのこ入りも見た目は同じハテナブロック (SMB準拠で中身は開けるまで不明)
      const pulse = (Math.sin(elapsed * 0.12) + 1) * 0.5;
      ctx.fillStyle = '#c98f1b';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = `rgba(255, 210, 63, ${0.75 + pulse * 0.25})`;
      ctx.fillRect(x + 2, y + 2, TILE - 4, TILE - 4);
      ctx.fillStyle = '#503a10';
      ctx.font = 'bold 20px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 1);
      break;
    }
    case 'U': {
      ctx.fillStyle = '#4a465c';
      ctx.fillRect(x, y, TILE, TILE);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
      break;
    }
    case 'o': {
      const t = elapsed * 0.1 + tx * 0.7;
      const sx = Math.abs(Math.cos(t)) * 10 + 2;
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.ellipse(x + TILE / 2, y + TILE / 2, sx, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b8860b';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'H': {
      ctx.fillStyle = '#cdd3ea';
      for (let i = 0; i < 2; i++) {
        const bx = x + i * (TILE / 2);
        ctx.beginPath();
        ctx.moveTo(bx, y + TILE);
        ctx.lineTo(bx + TILE / 4, y + TILE * 0.35);
        ctx.lineTo(bx + TILE / 2, y + TILE);
        ctx.closePath();
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,92,122,0.35)';
      ctx.fillRect(x, y + TILE - 4, TILE, 4);
      break;
    }
  }
}

function drawGoal(cam) {
  if (level.goalX === undefined) return;
  const x = level.goalX * TILE - cam + TILE / 2;
  const baseY = (level.goalY + 1) * TILE;
  const topY = baseY - TILE * 5.5;
  if (x < -80 || x > VIEW_W + 80) return;

  // ポール
  ctx.fillStyle = '#cdd3ea';
  ctx.fillRect(x - 2, topY, 4, baseY - topY);
  ctx.beginPath();
  ctx.arc(x, topY, 6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffd23f';
  ctx.fill();

  // 旗 (はためき / クリア時はプレイヤーと一緒に下降)
  const wave = Math.sin(elapsed * 0.1) * 4;
  const flagY = topY + 6 + clearFlagDrop;
  ctx.fillStyle = '#ff5c7a';
  ctx.beginPath();
  ctx.moveTo(x + 2, flagY);
  ctx.lineTo(x + 40 + wave, flagY + 12);
  ctx.lineTo(x + 2, flagY + 26);
  ctx.closePath();
  ctx.fill();

  // 台座
  ctx.fillStyle = '#3b2f4f';
  ctx.fillRect(x - 12, baseY - 8, 24, 8);
}

// 中間チェックポイントの旗 (未到達: グレー / 到達済み: ゴールド)
function drawCheckpoint(cam) {
  if (level.checkpointX === undefined) return;
  const x = level.checkpointX * TILE - cam + TILE / 2;
  if (x < -60 || x > VIEW_W + 60) return;
  const baseY = level.checkpointTy * TILE;
  const topY = baseY - TILE * 2;
  const color = checkpointReached ? '#ffd23f' : '#8b93b8';

  ctx.fillStyle = color;
  ctx.fillRect(x - 1.5, topY, 3, baseY - topY);
  ctx.beginPath();
  ctx.arc(x, topY, 4, 0, Math.PI * 2);
  ctx.fill();

  const wave = Math.sin(elapsed * 0.12) * 2;
  ctx.fillStyle = checkpointReached ? '#ffd23f' : 'rgba(139, 147, 184, 0.7)';
  ctx.beginPath();
  ctx.moveTo(x + 1.5, topY + 2);
  ctx.lineTo(x + 20 + wave, topY + 9);
  ctx.lineTo(x + 1.5, topY + 16);
  ctx.closePath();
  ctx.fill();
}

function drawPlayer(rx, ry) {
  let frame;
  if (mode === 'dying') {
    frame = SPRITE_FRAMES.fall;
  } else if (mode === 'clear' && (clearPhase === 'slide' || clearPhase === 'pause')) {
    frame = SPRITE_FRAMES.jump; // ポールに掴まる滑降ポーズ
  } else if (!player.onGround) {
    frame = SPRITE_FRAMES.jump;
  } else if (Math.abs(player.vx) > 0.3) {
    frame = SPRITE_FRAMES.run;
  } else {
    frame = SPRITE_FRAMES.idle;
  }

  const dh = player.h + 2; // パワー状態に応じた描画サイズ (small 46 / super 60)
  const dw = dh * (frame.w / frame.h);
  const cx = rx + player.w / 2;
  const footY = ry + player.h;

  ctx.save();
  // 被弾後の無敵点滅
  if (player.invincible > 0 && mode === 'play' && player.invincible % 6 < 3) {
    ctx.globalAlpha = 0.35;
  }
  ctx.translate(cx, footY - dh / 2);
  if (mode === 'dying') {
    ctx.rotate(player.deathRot);
  } else if (player.facing < 0) {
    ctx.scale(-1, 1);
  }

  const spr = getPlayerSprite();
  if (spr) {
    ctx.drawImage(spr, frame.x, frame.y, frame.w, frame.h, -dw / 2, -dh / 2, dw, dh);
  } else {
    // 画像読込前のフォールバック
    ctx.fillStyle = '#ff5c7a';
    ctx.fillRect(-player.w / 2, -dh / 2, player.w, dh);
  }
  ctx.restore();
}

function drawParticles(cam) {
  for (const p of particles) {
    const a = 1 - p.t / p.life;
    ctx.globalAlpha = a;
    if (p.kind === 'coin') {
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.ellipse(p.x - cam, p.y, 7, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'firework') {
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x - cam, p.y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.kind === 'text') {
      ctx.fillStyle = '#ffd23f';
      ctx.font = 'bold 16px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(p.text, p.x - cam, p.y);
    } else if (p.kind === 'debris') {
      // レンガ破片: 回転しながら落ちる小さな塊
      ctx.save();
      ctx.translate(p.x - cam, p.y);
      ctx.rotate(p.rot || 0);
      ctx.fillStyle = '#5a3d4a';
      ctx.fillRect(-5, -5, 10, 10);
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-5, -5, 10, 10);
      ctx.restore();
    } else {
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      ctx.arc(p.x - cam, p.y, 4 * a, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawHUD() {
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.font = 'bold 15px "Segoe UI", sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(10, 10, 335, 30);
  ctx.fillStyle = '#eef1ff';
  ctx.fillText(`STAGE ${stageLabel(stageNum)}`, 20, 17);
  // コイン
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.ellipse(120, 25, 6, 8, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#eef1ff';
  ctx.fillText(`× ${coins}`, 132, 17);

  // タイマー
  const timeStr = (playTimer / 60).toFixed(1);
  ctx.fillText(`TIME ${timeStr}s`, 185, 17);

  // ベストタイム
  const bestStr = bestTimeForStage !== null ? `${bestTimeForStage.toFixed(1)}s` : '--';
  ctx.fillStyle = 'rgba(255, 210, 63, 0.85)';
  ctx.fillText(`BEST ${bestStr}`, 265, 17);

  if (stageToast > 0 && mode === 'play') {
    const a = Math.min(1, stageToast / 30);
    ctx.globalAlpha = a;
    ctx.textAlign = 'center';
    ctx.font = 'bold 26px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText(`STAGE ${stageLabel(stageNum)}`, VIEW_W / 2, 140);
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef1ff';
    ctx.fillText(LEVEL_NAMES[stageNum - 1], VIEW_W / 2, 176);
    ctx.globalAlpha = 1;
  }

  // SMB1準拠: 滑降が終わってから "COURSE CLEAR!" とファンファーレ
  if (mode === 'clear' && clearPhase !== 'slide') {
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffd23f';
    ctx.fillText('COURSE CLEAR!', VIEW_W / 2, 130);

    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef1ff';
    const clearTime = playTimer / 60;
    ctx.fillText(`TIME: ${clearTime.toFixed(2)}s`, VIEW_W / 2, 175);

    if (newRecord) {
      ctx.fillStyle = '#ff5c7a';
      ctx.font = 'bold 20px "Segoe UI", sans-serif';
      ctx.fillText('🏆 NEW RECORD! 🏆', VIEW_W / 2, 210);
    }
  }
}

// きのこアイテム (ネオン調): 傘 + 斑点 + 目
function drawItem(it, cam) {
  const x = it.x - cam;
  const y = it.y;
  if (x < -32 || x > VIEW_W) return;

  // 軸
  ctx.fillStyle = '#eef1ff';
  ctx.fillRect(x + 6, y + 12, 12, 12);
  // 傘
  ctx.fillStyle = '#ff5c7a';
  ctx.beginPath();
  ctx.arc(x + 12, y + 12, 12, Math.PI, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#ffd23f';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 斑点
  ctx.fillStyle = '#fff6c9';
  ctx.beginPath();
  ctx.arc(x + 6, y + 8, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 12, y + 4, 2.5, 0, Math.PI * 2);
  ctx.arc(x + 18, y + 8, 2.5, 0, Math.PI * 2);
  ctx.fill();
  // 目
  ctx.fillStyle = '#1a2247';
  ctx.fillRect(x + 8, y + 15, 2, 5);
  ctx.fillRect(x + 14, y + 15, 2, 5);
}

function drawKoopa(e) {
  const inShell = e.state === 'shell' || e.state === 'slide';

  // 影
  ctx.fillStyle = 'rgba(0,0,0,0.15)';
  ctx.beginPath();
  ctx.ellipse(0, e.h / 2 - 1, e.w / 2 - 2, 2, 0, 0, Math.PI * 2);
  ctx.fill();

  // 歩行復帰の予兆: 残り60フレームを切った甲羅は小刻みに震える (SMB準拠)
  if (e.state === 'shell' && e.shellTimer > SHELL_REVIVE_FRAMES - 60) {
    ctx.translate(Math.sin(e.animTime * 0.9) * 1.5, 0);
  }

  ctx.save();
  if (e.state === 'slide') {
    ctx.rotate(e.animTime * 0.35 * Math.sign(e.vx || 1)); // 滑走中はスピン
  }
  // 甲羅 (ターコイズネオンのドーム)
  ctx.fillStyle = '#00f5d4';
  ctx.beginPath();
  ctx.arc(0, inShell ? 1 : 3, e.w / 2 - 1, Math.PI, 0);
  ctx.rect(-e.w / 2 + 1, inShell ? 1 : 3, e.w - 2, inShell ? 6 : 5);
  ctx.fill();
  ctx.strokeStyle = '#9b5de5';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 甲羅の模様
  ctx.strokeStyle = 'rgba(155,93,229,0.7)';
  ctx.beginPath();
  ctx.moveTo(-4, inShell ? -8 : -6); ctx.lineTo(-4, inShell ? 5 : 6);
  ctx.moveTo(4, inShell ? -8 : -6); ctx.lineTo(4, inShell ? 5 : 6);
  ctx.stroke();
  ctx.restore();

  if (!inShell) {
    // 頭 (進行方向側) と足
    const dir = Math.sign(e.vx || -1);
    ctx.fillStyle = '#c1fba4';
    ctx.beginPath();
    ctx.arc(dir * (e.w / 2 - 1), -6, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a2247';
    ctx.fillRect(dir * (e.w / 2 - 1) + dir * 1, -8, 2, 3); // 目
    const walkWave = Math.sin(e.animTime * 0.25) * 3;
    ctx.fillStyle = '#3a0ca3';
    ctx.fillRect(-8 + walkWave, e.h / 2 - 4, 6, 4);
    ctx.fillRect(2 - walkWave, e.h / 2 - 4, 6, 4);
  }
}

function drawFlyer(e) {
  const flap = Math.sin(e.animTime * 0.3);

  // 羽 (左右にパタパタ)
  ctx.fillStyle = 'rgba(238,241,255,0.85)';
  ctx.beginPath();
  ctx.moveTo(-e.w / 2 + 2, -2);
  ctx.lineTo(-e.w / 2 - 8, -6 - flap * 6);
  ctx.lineTo(-e.w / 2 + 4, 4);
  ctx.closePath();
  ctx.moveTo(e.w / 2 - 2, -2);
  ctx.lineTo(e.w / 2 + 8, -6 - flap * 6);
  ctx.lineTo(e.w / 2 - 4, 4);
  ctx.closePath();
  ctx.fill();

  // 体 (イエローネオン)
  ctx.fillStyle = '#ffd23f';
  ctx.beginPath();
  ctx.arc(0, -1, e.w / 2 - 3, Math.PI, 0);
  ctx.rect(-e.w / 2 + 3, -1, e.w - 6, e.h / 2);
  ctx.fill();
  ctx.strokeStyle = '#f15bb5';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 目
  ctx.fillStyle = '#1a2247';
  ctx.fillRect(-5, -4, 3, 4);
  ctx.fillRect(2, -4, 3, 4);
}

function drawEnemy(e, cam) {
  const rx = e.x - cam;
  const ry = e.y;
  if (rx < -e.w - 12 || rx > VIEW_W + 12) return;

  ctx.save();
  ctx.translate(rx + e.w / 2, ry + e.h / 2);

  if (e.dead) {
    // 踏みつぶされた状態 (平べったい円)
    ctx.scale(1.5, 0.2);
    ctx.fillStyle = '#ff5c7a';
    ctx.beginPath();
    ctx.arc(0, 0, e.w / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 92, 122, 0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();
  } else if (e.type === 'koopa') {
    drawKoopa(e);
  } else if (e.type === 'flyer') {
    drawFlyer(e);
  } else {
    // 歩行足のアニメ
    const walkWave = Math.sin(e.animTime * 0.25) * 3;

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(0, e.h / 2 - 1, e.w / 2 - 2, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // ネオン体 (Goomba)
    ctx.fillStyle = '#9b5de5'; // ネオンパープル
    ctx.beginPath();
    ctx.arc(0, -2, e.w / 2, Math.PI, 0, false); // 上半身
    ctx.rect(-e.w / 2, -2, e.w, e.h / 2 + 2); // 下半身
    ctx.fill();

    ctx.strokeStyle = '#f15bb5'; // ピンクネオンアウトライン
    ctx.lineWidth = 2;
    ctx.stroke();

    // 目 (怒り目)
    ctx.fillStyle = '#00f5d4'; // ターコイズネオン
    ctx.beginPath();
    ctx.moveTo(-6, -4); ctx.lineTo(-2, -2); ctx.lineTo(-3, 0); ctx.closePath();
    ctx.moveTo(6, -4); ctx.lineTo(2, -2); ctx.lineTo(3, 0); ctx.closePath();
    ctx.fill();

    // 足
    ctx.fillStyle = '#3a0ca3';
    ctx.fillRect(-8 + walkWave, e.h / 2 - 4, 6, 4);
    ctx.fillRect(2 - walkWave, e.h / 2 - 4, 6, 4);
  }
  ctx.restore();
}

function draw(renderX, renderY, renderCam) {
  drawBackground(renderCam);

  // アイテムはタイルより先に描画し、出現途中はブロックの裏に隠れるようにする
  if (level && level.items) {
    for (const it of level.items) {
      drawItem(it, renderCam);
    }
  }

  const x0 = Math.floor(renderCam / TILE) - 1;
  const x1 = x0 + Math.ceil(VIEW_W / TILE) + 2;
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = Math.max(0, x0); tx <= Math.min(level.width - 1, x1); tx++) {
      const ch = level.grid[ty][tx];
      if (ch !== '.' && ch !== 'g' && ch !== 'G') drawTile(ch, tx, ty, renderCam);
    }
  }
  drawGoal(renderCam);
  drawCheckpoint(renderCam);
  drawParticles(renderCam);

  // 敵キャラの描画
  if (level && level.enemies) {
    for (const e of level.enemies) {
      drawEnemy(e, renderCam);
    }
  }

  drawPlayer(renderX - renderCam, renderY);
  drawHUD();
}

// ============================================
// 蓄積型 Fixed Timestep ゲームループ
// ============================================
let lastTime = 0;
let accumulator = 0;
const fixedTimeStep = 1000 / 60; // 16.67ms (60FPS固定)

let prevX = 0, prevY = 0, prevCam = 0;
let currentX = 0, currentY = 0, currentCam = 0;

function gameLoop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  let deltaTime = timestamp - lastTime;
  lastTime = timestamp;

  // スパイク防止
  if (deltaTime > 100) deltaTime = fixedTimeStep;

  accumulator += deltaTime;

  let updateCount = 0;
  while (accumulator >= fixedTimeStep) {
    prevX = player.x;
    prevY = player.y;
    prevCam = camX;

    if (level && !paused) updateStep();

    currentX = player.x;
    currentY = player.y;
    currentCam = camX;

    accumulator -= fixedTimeStep;

    // パニック制限
    updateCount++;
    if (updateCount > 5) {
      accumulator = 0;
      break;
    }
  }

  if (level) {
    const alpha = accumulator / fixedTimeStep;
    const renderX = prevX * (1 - alpha) + currentX * alpha;
    const renderY = prevY * (1 - alpha) + currentY * alpha;
    const renderCam = prevCam * (1 - alpha) + currentCam * alpha;
    draw(renderX, renderY, renderCam);
  } else {
    ctx.fillStyle = '#12172e';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // 中断ボタンとタッチ操作UIはプレイ操作中のみ表示
  pauseBtn.classList.toggle('hidden', mode !== 'play' || paused);
  touchUi.classList.toggle('hidden', mode !== 'play' || paused);

  requestAnimationFrame(gameLoop);
}

// ============================================
// UI (タイトル / ステージ選択 / クリア / ポーズ)
// ============================================
const screens = ['title-screen', 'select-screen', 'shop-screen', 'clear-screen', 'allclear-screen', 'pause-screen'];
const pauseBtn = document.getElementById('btn-pause');
const touchUi = document.getElementById('touch-ui');

// ---- タッチ操作ボタンのサイズ設定 (小/中/大) ----
const TC_SIZE_KEY = 'super-ryotan-tc-size-v1';
const TC_SIZES = ['small', 'medium', 'large'];

function loadTcSize() {
  try {
    const v = localStorage.getItem(TC_SIZE_KEY);
    return TC_SIZES.includes(v) ? v : 'medium';
  } catch {
    return 'medium';
  }
}

function applyTcSize(size) {
  touchUi.classList.toggle('tc-small', size === 'small');
  touchUi.classList.toggle('tc-large', size === 'large');
  for (const b of document.querySelectorAll('.tc-size-btn')) {
    b.classList.toggle('selected', b.dataset.size === size);
  }
  try {
    localStorage.setItem(TC_SIZE_KEY, size);
  } catch {
    // localStorage 不可でもサイズはセッション中有効
  }
}

function pauseGame() {
  if (mode !== 'play' || paused) return;
  paused = true;
  stopBgm();
  showScreen('pause-screen');
}

function resumeGame() {
  if (!paused) return;
  paused = false;
  startBgm(bgmThemeFor(stageNum));
  hideScreens();
}

// 中断メニューからステージを離脱する (選択画面・タイトルへ)
function quitStage(screenId) {
  paused = false;
  mode = 'menu';
  stopBgm();
  showScreen(screenId);
}

function showScreen(id) {
  if (id === 'title-screen') {
    document.getElementById('total-coins-value').textContent = loadTotalCoins();
  }
  for (const s of screens) {
    document.getElementById(s).classList.toggle('hidden', s !== id);
  }
}

function hideScreens() {
  for (const s of screens) document.getElementById(s).classList.add('hidden');
}

function buildStageGrid() {
  const grid = document.getElementById('stage-grid');
  const unlocked = loadProgress();
  grid.innerHTML = '';
  for (let i = 1; i <= LEVEL_COUNT; i++) {
    const btn = document.createElement('button');
    btn.className = 'stage-cell';
    if (i <= unlocked) {
      const best = loadBestTime(i);
      const timeStr = best !== null ? `⏱${best.toFixed(1)}s` : '';
      btn.innerHTML = `<span class="num">${stageLabel(i)}</span><span class="best-time">${timeStr}</span>`;
    } else {
      btn.innerHTML = '🔒';
    }
    btn.disabled = i > unlocked;
    btn.title = i <= unlocked ? LEVEL_NAMES[i - 1] : '未解放';
    btn.addEventListener('click', () => {
      unlockAudio();
      sfxSelect();
      hideScreens();
      loadStage(i);
    });
    grid.appendChild(btn);
  }
}

// ---- ショップ (髪色の購入・付け替え) ----
function renderShop() {
  document.getElementById('shop-coins-value').textContent = loadTotalCoins();
  const grid = document.getElementById('shop-grid');
  const owned = loadOwnedItems();
  const total = loadTotalCoins();
  grid.innerHTML = '';
  for (const c of HAIR_COLORS) {
    const isOwned = owned.includes(c.id);
    const isSelected = selectedHair === c.id;
    const btn = document.createElement('button');
    btn.className = 'shop-item' +
      (isSelected ? ' selected' : '') +
      (!isOwned ? ' locked' : '') +
      (!isOwned && total < c.price ? ' unaffordable' : '');
    btn.innerHTML = `
      <span class="swatch" style="background:${c.swatch}"></span>
      <span class="item-name">${c.name}</span>
      <span class="item-state">${isSelected ? 'そうびちゅう' : isOwned ? 'えらぶ' : `🪙 ${c.price}`}</span>`;
    btn.addEventListener('click', () => {
      unlockAudio();
      if (loadOwnedItems().includes(c.id)) {
        if (selectHair(c.id)) {
          selectedHair = c.id;
          sfxSelect();
        }
      } else {
        const res = buyHairColor(c.id);
        if (res.ok) {
          selectHair(c.id);
          selectedHair = c.id;
          sfxPowerup(); // 購入成功ファンファーレ
        } else {
          sfxBump(); // コイン不足
        }
      }
      renderShop();
    });
    grid.appendChild(btn);
  }
}

// ---- バグ報告・フィードバック送信 (Formspree連携) ----
const FEEDBACK_ENDPOINT = 'https://formspree.io/f/mjgqqzdd';

// セーブ状態や端末情報を「システム・環境情報」として自動収集する
function collectDebugInfo() {
  let unlockedStage = '1';
  let totalCoins = '0';
  try {
    unlockedStage = localStorage.getItem('super-ryotan-progress-v1') || '1';
    totalCoins = localStorage.getItem('super-ryotan-total-coins-v1') || '0';
  } catch {
    // プライベートモード等で localStorage 不可でも送信自体は続行
  }
  return {
    version: document.getElementById('version-label')?.textContent || '',
    unlockedStage,
    totalCoins,
    userAgent: navigator.userAgent,
    screenSize: `${window.innerWidth}x${window.innerHeight}`,
    timestamp: new Date().toISOString(),
  };
}

let feedbackToastTimer = null;

// ネオン調トースト (ok: ターコイズ発光 / ng: ピンク発光)。3.5秒でフェードアウト
function showFeedbackToast(message, ok) {
  const toast = document.getElementById('feedback-toast');
  toast.textContent = message;
  toast.classList.remove('ok', 'ng', 'show');
  toast.classList.add(ok ? 'ok' : 'ng');
  void toast.offsetWidth; // 連続表示でもアニメーションをやり直す
  toast.classList.add('show');
  clearTimeout(feedbackToastTimer);
  feedbackToastTimer = setTimeout(() => toast.classList.remove('show'), 3500);
}

function openFeedback() {
  document.getElementById('feedback-debug-preview').textContent =
    JSON.stringify(collectDebugInfo(), null, 2);
  document.getElementById('feedback-modal').classList.remove('hidden');
  document.getElementById('feedback-message').focus();
}

function closeFeedback() {
  document.getElementById('feedback-modal').classList.add('hidden');
}

function initFeedback() {
  const modal = document.getElementById('feedback-modal');
  const form = document.getElementById('feedback-form');
  const submitBtn = document.getElementById('btn-feedback-submit');

  document.getElementById('btn-title-feedback').addEventListener('click', () => {
    unlockAudio();
    sfxSelect();
    openFeedback();
  });
  document.getElementById('btn-feedback-close').addEventListener('click', () => {
    sfxSelect();
    closeFeedback();
  });

  // モーダル内のキーイベントはゲーム側 (window のリスナー) へ伝播させない。
  // 伝播すると input.js が Z/Space/矢印等を preventDefault してテキスト入力を潰してしまう
  for (const type of ['keydown', 'keyup']) {
    modal.addEventListener(type, (e) => {
      if (type === 'keydown' && e.key === 'Escape') closeFeedback();
      e.stopPropagation();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const message = document.getElementById('feedback-message').value.trim();
    if (!message) {
      showFeedbackToast('詳細内容を入力してください', false);
      return;
    }

    submitBtn.disabled = true;
    const label = submitBtn.textContent;
    submitBtn.textContent = '送信中...';
    try {
      const res = await fetch(FEEDBACK_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          category: document.getElementById('feedback-category').value,
          message,
          email: document.getElementById('feedback-email').value,
          ...collectDebugInfo(),
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      form.reset();
      closeFeedback();
      showFeedbackToast('フィードバックを送信しました！🚀', true);
    } catch {
      // 失敗時はモーダルを開いたまま再操作できる状態に戻す
      showFeedbackToast('送信に失敗しました。時間をおいて再度お試しください', false);
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = label;
    }
  });
}

function wireUI() {
  const on = (id, fn) => document.getElementById(id).addEventListener('click', () => {
    unlockAudio();
    sfxSelect();
    fn();
  });

  on('btn-start', () => { hideScreens(); loadStage(1); });
  on('btn-select', () => { buildStageGrid(); showScreen('select-screen'); });
  on('btn-back', () => showScreen('title-screen'));
  on('btn-shop', () => { renderShop(); showScreen('shop-screen'); });
  on('btn-shop-back', () => showScreen('title-screen'));
  on('btn-next', () => {
    hideScreens();
    loadStage(Math.min(stageNum + 1, LEVEL_COUNT));
  });
  on('btn-clear-select', () => { buildStageGrid(); showScreen('select-screen'); });
  on('btn-allclear-title', () => showScreen('title-screen'));

  // 中断ボタンとポーズメニュー
  on('btn-pause', pauseGame);
  on('btn-resume', resumeGame);
  on('btn-retry', () => { hideScreens(); loadStage(stageNum); });
  on('btn-pause-select', () => { buildStageGrid(); quitStage('select-screen'); });
  on('btn-pause-title', () => quitStage('title-screen'));

  // タッチ操作ボタンのサイズ切り替え (タイトル・ポーズ画面の各ピッカー)
  for (const b of document.querySelectorAll('.tc-size-btn')) {
    b.addEventListener('click', () => {
      unlockAudio();
      sfxSelect();
      applyTcSize(b.dataset.size);
    });
  }

  // ESC / P でポーズをトグル
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' && e.key.toLowerCase() !== 'p') return;
    if (paused) resumeGame();
    else if (mode === 'play') { sfxSelect(); pauseGame(); }
  });

  // 初回のあらゆる操作で AudioContext を解錠
  window.addEventListener('keydown', unlockAudio, { once: false });
  window.addEventListener('touchstart', unlockAudio, { once: false });
  window.addEventListener('pointerdown', unlockAudio, { once: false });
}

// ---- 16:9 スケーリング ----
function fitStage() {
  const wrap = document.getElementById('stage-wrap');
  const scale = Math.min(window.innerWidth / VIEW_W, window.innerHeight / VIEW_H);
  const margin = scale > 1.05 ? 0.97 : 1;
  wrap.style.width = `${Math.floor(VIEW_W * scale * margin)}px`;
  wrap.style.height = `${Math.floor(VIEW_H * scale * margin)}px`;
}

// ============================================
// 起動
// ============================================
initPWA();
initInput();
wireUI();
initFeedback();
applyTcSize(loadTcSize());
fitStage();
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', fitStage);

// E2Eテスト・デバッグ用の状態フック
window.__game = {
  player,
  state: () => ({ mode, stageNum, coins, camX, paused }),
  level: () => level,
};

// ?stage=N で直接ステージ開始
const directStage = parseInt(new URLSearchParams(location.search).get('stage'), 10);
if (Number.isFinite(directStage) && directStage >= 1 && directStage <= LEVEL_COUNT) {
  hideScreens();
  loadStage(directStage);
} else {
  showScreen('title-screen');
}
requestAnimationFrame(gameLoop);

