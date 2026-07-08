// ============================================
// マリオ物理 (Fixed Timestep 16.67ms 基準) + タイル衝突
// ============================================

export const TILE = 32;

// ---- 水平方向 (px/frame @60FPS) ----
export const V_WALK_MAX = 2.5;   // 歩行最大速度 (秒速150px)
export const V_DASH_MAX = 4.5;   // ダッシュ最大速度 (秒速270px)
export const A_X = 0.1;          // 水平加速度
export const F_X = 0.15;         // 地面摩擦 (入力なし時の減衰)
export const D_X = 0.3;          // ブレーキ減速 (逆キー入力時 = 加速度の3倍)

// ---- 垂直方向 (最大高度80px / 頂点到達0.4秒=24フレーム) ----
export const G_RISE = 0.28;      // 上昇時重力 2α/t²
export const G_FALL = 0.56;      // 落下時重力 (上昇の2倍)
export const JUMP_V = -6.7;      // 初速 -√(2αγ)
export const MAX_RISE_FRAMES = 24;
export const TERMINAL_V = 8.0;   // 終端速度 (床すり抜け防止)

// ---- 当たり判定 ----
const INSET = 0.2;               // 継ぎ目スタック対策のコライダー縮小量

function isSolid(ch) {
  return ch === '#' || ch === '=' || ch === 'B' || ch === '?' || ch === 'U';
}

/**
 * AABB とタイルマップの重なりを走査する。
 * hit(tx, ty, ch) が truthy を返したら走査を打ち切る。
 */
function forEachOverlapTile(level, x, y, w, h, hit) {
  const x0 = Math.floor((x + INSET) / TILE);
  const x1 = Math.floor((x + w - INSET) / TILE);
  const y0 = Math.floor((y + INSET) / TILE);
  const y1 = Math.floor((y + h - INSET) / TILE);
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      if (hit(tx, ty, level.tileAt(tx, ty))) return;
    }
  }
}

function collidesSolid(level, x, y, w, h) {
  let found = null;
  forEachOverlapTile(level, x, y, w, h, (tx, ty, ch) => {
    if (isSolid(ch)) {
      found = { tx, ty, ch };
      return true;
    }
    return false;
  });
  return found;
}

/**
 * 1固定ステップ分の物理更新。
 * 発生イベントを { bumped:[{tx,ty}], coins:[{tx,ty}], spike, goal, fellOff } で返す。
 */
export function updatePhysics(player, input, level) {
  const events = { bumped: [], coins: [], spike: false, goal: false, fellOff: false };

  // ---------- 水平方向 ----------
  const vmax = input.dash ? V_DASH_MAX : V_WALK_MAX;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);

  if (dir !== 0) {
    const movingOpposite = player.vx !== 0 && Math.sign(player.vx) !== dir;
    if (movingOpposite) {
      // ブレーキ: 加速度の3倍で急減速 (スリップ状態)
      player.vx += dir * D_X;
      player.skidding = player.onGround;
    } else {
      player.vx += dir * A_X;
      player.skidding = false;
    }
    // 最大速度クランプ (ダッシュ解除時はなだらかに減速)
    if (Math.abs(player.vx) > vmax) {
      player.vx = Math.sign(player.vx) * Math.max(vmax, Math.abs(player.vx) - F_X);
    }
    player.facing = dir;
  } else {
    // 摩擦: スッと止まらず滑る
    player.skidding = false;
    if (Math.abs(player.vx) <= F_X) {
      player.vx = 0;
    } else {
      player.vx -= Math.sign(player.vx) * F_X;
    }
  }

  // ---------- ジャンプ (可変ジャンプ制御) ----------
  if (input.jump) {
    if (player.onGround && !player.jumpHeldPrev) {
      player.vy = JUMP_V;
      player.onGround = false;
      player.jumping = true;
      player.riseFrames = 0;
      player.jumpCut = false;
      events.jumped = true;
    }
  } else if (player.jumping && !player.jumpCut && player.vy < 0) {
    // ボタン早期リリース → 上昇速度を50%に減衰し惰性上昇へ
    player.vy *= 0.5;
    player.jumpCut = true;
  }
  player.jumpHeldPrev = input.jump;

  // ---------- 重力 (上昇/落下で変速) ----------
  let g = G_FALL;
  if (player.vy < 0 && player.jumping && !player.jumpCut &&
      input.jump && player.riseFrames < MAX_RISE_FRAMES) {
    g = G_RISE; // 長押し中の上昇フェーズのみ低重力
    player.riseFrames++;
  }
  player.vy += g;
  if (player.vy > TERMINAL_V) player.vy = TERMINAL_V;

  // ---------- X軸更新 → 衝突解決 (X/Y独立の絶対原則) ----------
  player.x += player.vx;
  {
    const hit = collidesSolid(level, player.x, player.y, player.w, player.h);
    if (hit) {
      if (player.vx > 0) {
        player.x = hit.tx * TILE - player.w - INSET;
      } else if (player.vx < 0) {
        player.x = (hit.tx + 1) * TILE + INSET;
      }
      player.vx = 0;
    }
  }
  // カメラ左端より左へは戻れない
  if (player.x < level.cameraX) {
    player.x = level.cameraX;
    if (player.vx < 0) player.vx = 0;
  }

  // ---------- Y軸更新 → 衝突解決 ----------
  player.y += player.vy;
  {
    const hit = collidesSolid(level, player.x, player.y, player.w, player.h);
    if (hit) {
      if (player.vy > 0) {
        // 着地: 床の上に押し戻す
        player.y = hit.ty * TILE - player.h - INSET;
        player.vy = 0;
        player.onGround = true;
        player.jumping = false;
      } else if (player.vy < 0) {
        // 天井: 押し下げて落下へ移行
        player.y = (hit.ty + 1) * TILE + INSET;
        player.vy = 0;
        player.jumping = false;
        // 頭上のハテナブロックを叩く (頭の中心に最も近いものを1つ)
        const headX = player.x + player.w / 2;
        const cx = Math.floor(headX / TILE);
        for (const tx of [cx, cx - 1, cx + 1]) {
          if (level.tileAt(tx, hit.ty) === '?') {
            level.setTile(tx, hit.ty, 'U');
            events.bumped.push({ tx, ty: hit.ty });
            break;
          }
        }
        if (events.bumped.length === 0) events.headBonk = true;
      }
    } else if (player.vy > 0) {
      player.onGround = false;
    }
  }

  // 接地確認 (足元1px下にソリッドがあるか)
  if (player.vy === 0 && player.onGround) {
    const below = collidesSolid(level, player.x, player.y + 1, player.w, player.h);
    if (!below) player.onGround = false;
  }

  // ---------- 非ソリッドタイルとの接触 (コイン・トゲ・ゴール) ----------
  forEachOverlapTile(level, player.x, player.y, player.w, player.h, (tx, ty, ch) => {
    if (ch === 'o') {
      level.setTile(tx, ty, '.');
      events.coins.push({ tx, ty });
    } else if (ch === 'H') {
      // トゲはタイル下半分のみ危険域
      const spikeTop = ty * TILE + TILE * 0.4;
      if (player.y + player.h > spikeTop) events.spike = true;
    } else if (ch === 'G' || ch === 'g') {
      events.goal = true;
    }
    return false;
  });

  // ---------- 落下ミス ----------
  if (player.y > level.pixelHeight + TILE * 2) {
    events.fellOff = true;
  }

  return events;
}
