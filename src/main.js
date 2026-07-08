// ============================================
// SUPER RYO-TAN — エントリーポイント / ゲームループ
// ============================================

import './style.css';
import { initInput, input } from './input.js';
import { TILE, G_FALL, updatePhysics, V_WALK_MAX } from './physics.js';
import { Level, LEVEL_COUNT, LEVEL_NAMES, loadProgress, saveProgress, loadBestTime, saveBestTime } from './level.js';
import {
  unlockAudio, sfxJump, sfxCoin, sfxBump, sfxBlock,
  sfxDeath, sfxClear, sfxSelect, sfxKick, sfxBreak
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


// ---- プレイヤー ----
const PLAYER_W = 24;
const PLAYER_H = 44;

const player = {
  x: 0, y: 0, w: PLAYER_W, h: PLAYER_H,
  vx: 0, vy: 0,
  facing: 1,
  onGround: false,
  jumping: false,
  jumpCut: false,
  jumpHeldPrev: false,
  riseFrames: 0,
  skidding: false,
  animDist: 0,
  deathVy: 0,
  deathRot: 0,
};

// ---- ゲーム状態 ----
let mode = 'menu'; // menu | play | dying | clear
let level = null;
let stageNum = 1;
let coins = 0;
let camX = 0;
let clearTimer = 0;
let stageToast = 0;
let elapsed = 0; // 描画演出用フレームカウンタ
let playTimer = 0; // プレイ時間 (フレーム)
let newRecord = false;
let bestTimeForStage = null;

const bumps = new Map(); // "tx,ty" -> 経過フレーム (ブロック叩きアニメ)
let particles = []; // コインポップ演出

// ============================================
// ステージ制御
// ============================================
function loadStage(n) {
  stageNum = n;
  level = new Level(n - 1);
  coins = 0;
  camX = 0;
  level.cameraX = 0;
  clearTimer = 0;
  stageToast = 110;
  bumps.clear();
  particles = [];
  playTimer = 0;
  newRecord = false;
  bestTimeForStage = loadBestTime(n);
  respawn();
  mode = 'play';
}

function respawn() {
  player.x = level.startX;
  player.y = level.startY;
  player.vx = 0;
  player.vy = 0;
  player.facing = 1;
  player.onGround = false;
  player.jumping = false;
  player.jumpCut = false;
  player.jumpHeldPrev = true; // ボタン押しっぱなしの即ジャンプ暴発防止
  player.skidding = false;
  player.deathRot = 0;
}

function startDeath() {
  mode = 'dying';
  player.deathVy = -7; // 小さく跳ね上がる
  player.deathRot = 0;
  sfxDeath();
}

function startClear() {
  mode = 'clear';
  clearTimer = 0;
  player.vx = 0;
  const clearTime = playTimer / 60;
  newRecord = saveBestTime(stageNum, clearTime);
  saveProgress(stageNum + 1);
  sfxClear();
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
      } else if (b.kind === 'bump') {
        bumps.set(`${b.tx},${b.ty}`, 0);
        sfxBump();
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
    if (events.spike || events.fellOff) {
      startDeath();
    } else if (events.goal) {
      startClear();
    }

    // カメラ: プレイヤーが画面の1/3を超えたら右スクロール。左には戻らない
    const target = player.x - VIEW_W / 3;
    if (target > camX) camX = target;
    camX = Math.min(camX, level.pixelWidth - VIEW_W);
    camX = Math.max(camX, 0);

    player.animDist += Math.abs(player.vx);
  } else if (mode === 'dying') {
    // 上に跳ねてから回転しながら画面下へ (衝突無視)
    player.deathVy += G_FALL * 0.55;
    player.y += player.deathVy;
    player.deathRot += 0.12;
    if (player.y > level.pixelHeight + 300) {
      loadStage(stageNum); // 同じステージをやり直し
    }
  } else if (mode === 'clear') {
    clearTimer++;
    // 接地していなければ落下だけ続ける
    if (!player.onGround) {
      player.vy = Math.min(player.vy + G_FALL, 8);
      player.y += player.vy;
      const footTy = Math.floor((player.y + player.h) / TILE);
      const ch = level.tileAt(Math.floor((player.x + player.w / 2) / TILE), footTy);
      if (ch === '#' || ch === '=' || ch === 'B' || ch === 'U' || ch === '?') {
        player.y = footTy * TILE - player.h;
        player.vy = 0;
        player.onGround = true;
      }
    }
    if (clearTimer === 110) {
      if (stageNum >= LEVEL_COUNT) {
        showScreen('allclear-screen');
      } else {
        showScreen('clear-screen');
      }
      mode = 'menu';
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
    p.vy += p.kind === 'debris' ? 0.24 : 0.12;
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
    case '?': {
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

  // 旗 (はためき)
  const wave = Math.sin(elapsed * 0.1) * 4;
  ctx.fillStyle = '#ff5c7a';
  ctx.beginPath();
  ctx.moveTo(x + 2, topY + 6);
  ctx.lineTo(x + 40 + wave, topY + 18);
  ctx.lineTo(x + 2, topY + 32);
  ctx.closePath();
  ctx.fill();

  // 台座
  ctx.fillStyle = '#3b2f4f';
  ctx.fillRect(x - 12, baseY - 8, 24, 8);
}

function drawPlayer(rx, ry) {
  let frame;
  if (mode === 'dying') {
    frame = SPRITE_FRAMES.fall;
  } else if (!player.onGround) {
    frame = SPRITE_FRAMES.jump;
  } else if (Math.abs(player.vx) > 0.3) {
    frame = SPRITE_FRAMES.run;
  } else {
    frame = SPRITE_FRAMES.idle;
  }

  const dh = 46;
  const dw = dh * (frame.w / frame.h);
  const cx = rx + player.w / 2;
  const footY = ry + player.h;

  ctx.save();
  ctx.translate(cx, footY - dh / 2);
  if (mode === 'dying') {
    ctx.rotate(player.deathRot);
  } else if (player.facing < 0) {
    ctx.scale(-1, 1);
  }

  if (spriteReady) {
    ctx.drawImage(sprite, frame.x, frame.y, frame.w, frame.h, -dw / 2, -dh / 2, dw, dh);
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
  ctx.fillText(`STAGE ${stageNum}`, 20, 17);
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
    ctx.fillText(`STAGE ${stageNum}`, VIEW_W / 2, 140);
    ctx.font = 'bold 18px "Segoe UI", sans-serif';
    ctx.fillStyle = '#eef1ff';
    ctx.fillText(LEVEL_NAMES[stageNum - 1], VIEW_W / 2, 176);
    ctx.globalAlpha = 1;
  }

  if (mode === 'clear') {
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

function drawEnemy(e, cam) {
  const rx = e.x - cam;
  const ry = e.y;
  if (rx < -e.w || rx > VIEW_W) return;

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

  const x0 = Math.floor(renderCam / TILE) - 1;
  const x1 = x0 + Math.ceil(VIEW_W / TILE) + 2;
  for (let ty = 0; ty < level.height; ty++) {
    for (let tx = Math.max(0, x0); tx <= Math.min(level.width - 1, x1); tx++) {
      const ch = level.grid[ty][tx];
      if (ch !== '.' && ch !== 'g' && ch !== 'G') drawTile(ch, tx, ty, renderCam);
    }
  }
  drawGoal(renderCam);
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

    if (level) updateStep();

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

  requestAnimationFrame(gameLoop);
}

// ============================================
// UI (タイトル / ステージ選択 / クリア)
// ============================================
const screens = ['title-screen', 'select-screen', 'clear-screen', 'allclear-screen'];

function showScreen(id) {
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
      btn.innerHTML = `<span class="num">${i}</span><span class="best-time">${timeStr}</span>`;
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

function wireUI() {
  const on = (id, fn) => document.getElementById(id).addEventListener('click', () => {
    unlockAudio();
    sfxSelect();
    fn();
  });

  on('btn-start', () => { hideScreens(); loadStage(1); });
  on('btn-select', () => { buildStageGrid(); showScreen('select-screen'); });
  on('btn-back', () => showScreen('title-screen'));
  on('btn-next', () => {
    hideScreens();
    loadStage(Math.min(stageNum + 1, LEVEL_COUNT));
  });
  on('btn-clear-select', () => { buildStageGrid(); showScreen('select-screen'); });
  on('btn-allclear-title', () => showScreen('title-screen'));

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
initInput();
wireUI();
fitStage();
window.addEventListener('resize', fitStage);
window.addEventListener('orientationchange', fitStage);

// E2Eテスト・デバッグ用の状態フック
window.__game = {
  player,
  state: () => ({ mode, stageNum, coins, camX }),
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

