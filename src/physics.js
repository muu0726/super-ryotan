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
export const JUMP_V_DASH = -7.5; // 走行時の強化ジャンプ初速 (SMB準拠: 速度でジャンプ力が伸びる)
export const STOMP_BOUNCE_V = -4.5; // 踏みつけの小バウンド初速 (ジャンプ入力なしの場合)
export const STOMP_JUMP_V = -8.0;   // 踏む瞬間のタイミング押しで出る大ジャンプ初速 (通常ジャンプより一回り高い ≈114px)
export const STOMP_JUMP_GRACE_FRAMES = 6; // 踏んだ後もジャンプ押下を大ジャンプとして受け付ける猶予フレーム
export const DASH_JUMP_SPEED = 3.5; // この水平速度以上で強化ジャンプが発動
export const MAX_RISE_FRAMES = 24;
export const TERMINAL_V = 8.0;   // 終端速度 (床すり抜け防止)

// ---- 操作の手触り (モダンQoL) ----
export const COYOTE_FRAMES = 5;      // 崖を離れた後もジャンプを受け付ける猶予フレーム
export const JUMP_BUFFER_FRAMES = 6; // 着地前のジャンプ入力の先行受付フレーム

// ---- 敵・アイテム ----
export const SHELL_SPEED = 4.5;          // 蹴られた甲羅の滑走速度
export const SHELL_REVIVE_FRAMES = 300;  // 甲羅から歩行に復帰するまでのフレーム (SMB準拠)
export const ITEM_SPEED = 1.4;           // きのこの自走速度

// ---- 当たり判定 ----
const INSET = 0.2;               // 継ぎ目スタック対策のコライダー縮小量

function isSolid(ch) {
  return ch === '#' || ch === 'B' || ch === '?' || ch === 'U' || ch === 'M';
}

// '=' は一方通行のすり抜け床: 上からのみ着地でき、下・横からは通り抜ける
function isOneWay(ch) {
  return ch === '=';
}

/**
 * すり抜け床への着地判定。落下中に足が床上面をまたいだフレームのみ成立する。
 * body = { x, y, w, h, vy } (プレイヤー・敵で共用)
 */
function oneWayLanding(level, body) {
  const bottom = body.y + body.h;
  const prevBottom = bottom - body.vy;
  const ty = Math.floor((bottom - INSET) / TILE);
  const rowTop = ty * TILE;
  if (bottom < rowTop) return null;
  if (prevBottom > rowTop + INSET * 2) return null; // 前フレームで既に上面より下 → すり抜け
  const x0 = Math.floor((body.x + INSET) / TILE);
  const x1 = Math.floor((body.x + body.w - INSET) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    if (isOneWay(level.tileAt(tx, ty))) return { tx, ty };
  }
  return null;
}

// すり抜け床の上に立っているか (接地維持の確認用)
function oneWaySupport(level, body) {
  const footY = body.y + body.h + 1;
  const ty = Math.floor(footY / TILE);
  if (body.y + body.h > ty * TILE + 4) return false; // 上面付近にいる時のみ
  const x0 = Math.floor((body.x + INSET) / TILE);
  const x1 = Math.floor((body.x + body.w - INSET) / TILE);
  for (let tx = x0; tx <= x1; tx++) {
    if (isOneWay(level.tileAt(tx, ty))) return true;
  }
  return false;
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

  // 被弾後の無敵時間 (点滅中は敵・トゲのダメージを受けない)
  if (player.invincible > 0) player.invincible--;

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

  // ---------- ジャンプ (可変ジャンプ + コヨーテタイム + 先行入力) ----------
  // コヨーテタイム: 崖を離れた直後もしばらくジャンプ可能
  if (player.onGround) {
    player.coyoteFrames = COYOTE_FRAMES;
    player.stompGraceFrames = 0;
  } else {
    player.coyoteFrames = Math.max(0, (player.coyoteFrames || 0) - 1);
    player.stompGraceFrames = Math.max(0, (player.stompGraceFrames || 0) - 1);
  }
  // 先行入力: 押した瞬間から一定フレーム、着地時のジャンプとして受け付ける
  if (input.jump && !player.jumpHeldPrev) {
    player.jumpBufferFrames = JUMP_BUFFER_FRAMES;
  } else {
    player.jumpBufferFrames = Math.max(0, (player.jumpBufferFrames || 0) - 1);
  }

  if (player.jumpBufferFrames > 0 && !player.jumping &&
      (player.onGround || player.coyoteFrames > 0 || player.stompGraceFrames > 0)) {
    if (!player.onGround && player.coyoteFrames <= 0) {
      // 踏みつけ直後のタイミング押し → 大ジャンプに変換
      player.vy = STOMP_JUMP_V;
    } else {
      // 走行速度に応じてジャンプ初速を強化 (SMB準拠)
      player.vy = Math.abs(player.vx) >= DASH_JUMP_SPEED ? JUMP_V_DASH : JUMP_V;
    }
    player.onGround = false;
    player.jumping = true;
    player.riseFrames = 0;
    player.jumpCut = false;
    player.coyoteFrames = 0;
    player.jumpBufferFrames = 0;
    player.stompGraceFrames = 0;
    events.jumped = true;
  } else if (!input.jump && player.jumping && !player.jumpCut && player.vy < 0) {
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
        // 頭上のブロックを叩く (ハテナブロック or レンガ)
        const headX = player.x + player.w / 2;
        const cx = Math.floor(headX / TILE);
        for (const tx of [cx, cx - 1, cx + 1]) {
          const tile = level.tileAt(tx, hit.ty);
          if (tile === '?') {
            level.setTile(tx, hit.ty, 'U');
            events.bumped.push({ tx, ty: hit.ty, kind: 'item' });
            break;
          } else if (tile === 'M') {
            // きのこ入りハテナブロック
            level.setTile(tx, hit.ty, 'U');
            events.bumped.push({ tx, ty: hit.ty, kind: 'mushroom' });
            break;
          } else if (tile === 'B') {
            events.bumped.push({ tx, ty: hit.ty, kind: 'bump' });
            break;
          }
        }
        if (events.bumped.length === 0) events.headBonk = true;
      }
    } else if (player.vy > 0) {
      // すり抜け床への着地 (上からのみ)
      const ow = oneWayLanding(level, player);
      if (ow) {
        player.y = ow.ty * TILE - player.h - INSET;
        player.vy = 0;
        player.onGround = true;
        player.jumping = false;
      } else {
        player.onGround = false;
      }
    }
  }

  // 接地確認 (足元1px下にソリッド or すり抜け床上面があるか)
  if (player.vy === 0 && player.onGround) {
    const below = collidesSolid(level, player.x, player.y + 1, player.w, player.h) ||
      oneWaySupport(level, player);
    if (!below) player.onGround = false;
  }

  // ---------- 敵の更新と衝突判定 ----------
  for (const e of level.enemies) {
    if (e.dead) {
      if (e.deadTimer > 0) e.deadTimer--;
      continue;
    }

    e.animTime++;
    const type = e.type || 'walker';

    if (type === 'flyer') {
      // パタパタ風: 基準点を中心に上下へふわふわ浮遊 (重力・地形の影響なし)
      e.y = e.baseY + Math.sin(e.animTime * 0.04) * 28;
    } else {
      // 甲羅状態のノコノコは一定時間で歩行に復帰する (SMB準拠)
      if (type === 'koopa' && e.state === 'shell') {
        e.shellTimer++;
        if (e.shellTimer > SHELL_REVIVE_FRAMES) {
          e.state = 'walk';
          e.y -= 10;
          e.h = 30;
          e.vx = -0.6;
        }
      }

      // 敵の重力適用
      e.vy += G_FALL;
      if (e.vy > TERMINAL_V) e.vy = TERMINAL_V;

      // X軸移動と衝突判定
      e.x += e.vx;
      let hitX = collidesSolid(level, e.x, e.y, e.w, e.h);
      if (hitX) {
        if (e.vx > 0) {
          e.x = hitX.tx * TILE - e.w - INSET;
        } else {
          e.x = (hitX.tx + 1) * TILE + INSET;
        }
        e.vx *= -1; // 反転
      }

      // Y軸移動と衝突判定 (すり抜け床にも上からは着地する)
      e.y += e.vy;
      let hitY = collidesSolid(level, e.x, e.y, e.w, e.h);
      if (hitY) {
        if (e.vy > 0) {
          e.y = hitY.ty * TILE - e.h - INSET;
          e.vy = 0;
          e.onGround = true;
        } else {
          e.y = (hitY.ty + 1) * TILE + INSET;
          e.vy = 0;
        }
      } else {
        const ow = e.vy > 0 ? oneWayLanding(level, e) : null;
        if (ow) {
          e.y = ow.ty * TILE - e.h - INSET;
          e.vy = 0;
          e.onGround = true;
        } else {
          e.onGround = false;
        }
      }

      // 崖の手前で反転するAI (クリボー風のみ。ノコノコ・甲羅はSMB準拠で崖から落ちる)
      if (type === 'walker' && e.onGround) {
        const checkY = e.y + e.h + 2; // 足元少し下
        const edgeX = e.vx > 0 ? (e.x + e.w + 4) : (e.x - 4);
        const tileBelow = collidesSolid(level, edgeX, checkY, 2, 2) ||
          isOneWay(level.tileAt(Math.floor(edgeX / TILE), Math.floor(checkY / TILE)));
        if (!tileBelow) {
          e.vx *= -1; // 崖っぷちで反転
        }
      }

      // 滑走中の甲羅は他の敵を連鎖撃破する
      if (type === 'koopa' && e.state === 'slide') {
        for (const other of level.enemies) {
          if (other === e || other.dead) continue;
          if (other.x + other.w > e.x && other.x < e.x + e.w &&
              other.y + other.h > e.y && other.y < e.y + e.h) {
            other.dead = true;
            other.deadTimer = 30;
            other.vx = 0;
            events.shellKills = events.shellKills || [];
            events.shellKills.push({ x: other.x + other.w / 2, y: other.y + other.h / 2 });
          }
        }
      }
    }

    // 踏みつけ・蹴り直後の接触猶予 (跳ね返り中の再ヒットによる自傷を防ぐ)
    if (e.touchCooldown > 0) {
      e.touchCooldown--;
      continue;
    }

    // プレイヤーとの衝突判定
    // SMB準拠で見た目より甘め: 横方向は互いに数px食い込んで初めて接触扱い
    const HIT_MARGIN_X = 4;
    const HIT_MARGIN_TOP = 4;
    if (player.x + player.w - HIT_MARGIN_X > e.x + HIT_MARGIN_X &&
        player.x + HIT_MARGIN_X < e.x + e.w - HIT_MARGIN_X &&
        player.y + player.h > e.y && player.y + HIT_MARGIN_TOP < e.y + e.h) {
      const isFalling = player.vy > 0;
      // 落下中なら足が敵の2/3の高さより上にあれば踏みつけ成立 (SMB準拠でプレイヤー有利に解決)
      const feetAboveMiddle = (player.y + player.h - player.vy) <= (e.y + e.h * 0.66);
      const kickDir = (player.x + player.w / 2) < (e.x + e.w / 2) ? 1 : -1;

      if (isFalling && feetAboveMiddle) {
        // 踏みつけ: タイプごとに応答が異なる
        if (type === 'koopa') {
          if (e.state === 'walk') {
            // 甲羅にこもる
            e.state = 'shell';
            e.shellTimer = 0;
            e.vx = 0;
            e.y += 10;
            e.h = 20;
          } else if (e.state === 'slide') {
            // 滑走中の甲羅を踏むと停止
            e.state = 'shell';
            e.shellTimer = 0;
            e.vx = 0;
          } else {
            // 静止甲羅を踏むと蹴り出す
            e.state = 'slide';
            e.shellTimer = 0;
            e.vx = kickDir * SHELL_SPEED;
          }
        } else if (type === 'flyer') {
          // 羽を失って歩行型に落ちる (パタパタ→クリボー風)
          e.type = 'walker';
          e.w = 24;
          e.h = 24;
          e.vx = -0.7;
          e.vy = 0;
        } else {
          e.dead = true;
          e.deadTimer = 30; // 30フレーム表示
          e.vx = 0;
        }
        // 跳ね返り: 踏む直前にジャンプを押していれば大ジャンプ、
        // そうでなければ小バウンド (直後の押下も猶予フレーム内なら大ジャンプに変換)
        if (player.jumpBufferFrames > 0) {
          player.vy = STOMP_JUMP_V;
          player.jumping = true;
          player.riseFrames = 0;
          player.jumpCut = false;
          player.jumpBufferFrames = 0;
          player.stompGraceFrames = 0;
        } else {
          player.vy = STOMP_BOUNCE_V;
          player.jumping = false;
          player.stompGraceFrames = STOMP_JUMP_GRACE_FRAMES;
        }
        player.onGround = false;
        e.touchCooldown = 10; // 跳ね返り中に再接触してダメージを受けないようにする
        events.stomped = true;
      } else if (type === 'koopa' && e.state === 'shell') {
        // 静止甲羅に横から触れると蹴り出す (ダメージなし)
        e.state = 'slide';
        e.shellTimer = 0;
        e.vx = kickDir * SHELL_SPEED;
        e.touchCooldown = 12; // 蹴った直後の甲羅に轢かれないようにする
        events.kicked = true;
      } else if (!(player.invincible > 0)) {
        events.spike = true; // 被ダメージ (スーパー時は縮小、スモール時はミス)
      }
    }
  }
  // 踏み潰し表示が終わった敵を取り除く
  level.enemies = level.enemies.filter((e) => !e.dead || e.deadTimer > 0);

  // ---------- きのこアイテムの更新 ----------
  if (level.items && level.items.length > 0) {
    for (const it of level.items) {
      if (it.state === 'rising') {
        // 叩かれたブロックの上面からせり上がる (この間は衝突なし)
        it.y -= 0.5;
        if (it.y <= it.targetY) {
          it.y = it.targetY;
          it.state = 'move';
          it.vx = ITEM_SPEED;
        }
        continue;
      }

      // 自走: 重力あり・壁で反転・崖からはSMB準拠でそのまま落ちる
      it.vy += G_FALL;
      if (it.vy > TERMINAL_V) it.vy = TERMINAL_V;

      it.x += it.vx;
      const hx = collidesSolid(level, it.x, it.y, it.w, it.h);
      if (hx) {
        if (it.vx > 0) {
          it.x = hx.tx * TILE - it.w - INSET;
        } else {
          it.x = (hx.tx + 1) * TILE + INSET;
        }
        it.vx *= -1;
      }

      it.y += it.vy;
      const hy = collidesSolid(level, it.x, it.y, it.w, it.h);
      if (hy) {
        if (it.vy > 0) {
          it.y = hy.ty * TILE - it.h - INSET;
          it.vy = 0;
        } else {
          it.y = (hy.ty + 1) * TILE + INSET;
          it.vy = 0;
        }
      } else if (it.vy > 0) {
        const ow = oneWayLanding(level, it);
        if (ow) {
          it.y = ow.ty * TILE - it.h - INSET;
          it.vy = 0;
        }
      }

      // 画面外落下で消滅
      if (it.y > level.pixelHeight + TILE * 2) it.collected = true;

      // プレイヤーの取得判定
      if (player.x + player.w > it.x && player.x < it.x + it.w &&
          player.y + player.h > it.y && player.y < it.y + it.h) {
        it.collected = true;
        events.powerup = true;
      }
    }
    level.items = level.items.filter((it) => !it.collected);
  }

  // ---------- 非ソリッドタイルとの接触 (コイン・トゲ・ゴール) ----------
  forEachOverlapTile(level, player.x, player.y, player.w, player.h, (tx, ty, ch) => {
    if (ch === 'o') {
      level.setTile(tx, ty, '.');
      events.coins.push({ tx, ty });
    } else if (ch === 'H') {
      // トゲは下半分×横方向5px内側のみ危険域 (かすっただけでは死なない)
      const spikeTop = ty * TILE + TILE * 0.5;
      const sx0 = tx * TILE + 5;
      const sx1 = (tx + 1) * TILE - 5;
      if (player.y + player.h > spikeTop &&
          player.x + player.w > sx0 && player.x < sx1 &&
          !(player.invincible > 0)) events.spike = true;
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

