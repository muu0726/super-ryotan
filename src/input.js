// ============================================
// 入力処理: キーボード + マルチタッチ
// ============================================

// ゲームが参照する論理入力状態
export const input = {
  left: false,
  right: false,
  jump: false,
  dash: false,
};

const KEY_MAP = {
  ArrowLeft: 'left',
  KeyA: 'left',
  ArrowRight: 'right',
  KeyD: 'right',
  KeyZ: 'jump',
  Space: 'jump',
  ArrowUp: 'jump',
  KeyW: 'jump',
  KeyX: 'dash',
  ShiftLeft: 'dash',
  ShiftRight: 'dash',
};

// キーボード由来 / タッチ由来を別々に持ち、OR して論理状態を作る。
// キーボードはホールド式、モバイルタッチはトグル式とする。
const kbState = { left: false, right: false, jump: false, dash: false };
const touchCount = { left: 0, right: 0, jump: 0 };
let dashOn = false;

function refresh() {
  for (const k of ['left', 'right', 'jump']) {
    input[k] = kbState[k] || touchCount[k] > 0;
  }
  input.dash = kbState.dash || dashOn;
}

function toggleDash() {
  dashOn = !dashOn;
  const btn = document.getElementById('tc-dash');
  if (btn) btn.classList.toggle('pressed', dashOn);
  refresh();
}

export function initInput() {
  window.addEventListener('keydown', (e) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    e.preventDefault();
    kbState[action] = true;
    refresh();
  });

  window.addEventListener('keyup', (e) => {
    const action = KEY_MAP[e.code];
    if (!action) return;
    kbState[action] = false;
    refresh();
  });

  // フォーカス喪失時は移動・ジャンプ・ダッシュを解除
  window.addEventListener('blur', () => {
    for (const k in kbState) kbState[k] = false;
    dashOn = false;
    const btn = document.getElementById('tc-dash');
    if (btn) btn.classList.remove('pressed');
    refresh();
  });

  initTouch();
}


// ---- マルチタッチ ----
// touch.identifier をキーに「どの指がどのボタンを押しているか」を追跡する。
// ヒットエリアは視覚ボタン矩形の約1.75倍に拡張して判定する。
const HIT_SCALE = 1.75;
const touchOwner = new Map(); // identifier -> action

function buttonRects() {
  const rects = [];
  for (const el of document.querySelectorAll('.tc-btn')) {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) continue; // タッチUI非表示 (デスクトップ等)
    const exW = (r.width * (HIT_SCALE - 1)) / 2;
    const exH = (r.height * (HIT_SCALE - 1)) / 2;
    rects.push({
      action: el.dataset.key,
      el,
      left: r.left - exW,
      right: r.right + exW,
      top: r.top - exH,
      bottom: r.bottom + exH,
    });
  }
  return rects;
}

function hitTest(x, y) {
  for (const r of buttonRects()) {
    if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return r;
  }
  return null;
}

function press(action, el) {
  if (action === 'dash') {
    // ダッシュはタップごとの切り替え (点灯状態は toggleDash が管理)
    toggleDash();
    return;
  }
  touchCount[action]++;
  el.classList.add('pressed');
  refresh();
}

function release(identifier) {
  const owned = touchOwner.get(identifier);
  if (!owned) return;
  touchOwner.delete(identifier);
  if (owned.action === 'dash') return; // トグルなので離しても状態維持
  touchCount[owned.action] = Math.max(0, touchCount[owned.action] - 1);
  if (touchCount[owned.action] === 0) owned.el.classList.remove('pressed');
  refresh();
}

function initTouch() {
  const ui = document.getElementById('touch-ui');
  if (!ui) return;

  const opts = { passive: false };

  // リスナーは #touch-ui ではなく window に置く。
  // #touch-ui は pointer-events: none のため、ボタン矩形の外周に広げた
  // 拡張ヒットエリア (HIT_SCALE) へのタッチはコンテナに届かず取りこぼされる
  // (実機でダッシュのトグルタップが無反応になる原因)。
  // window で受けてヒット判定し、ボタンに関わるタッチのみ preventDefault する
  // (無関係なタッチまで止めるとメニューボタンの click 合成が阻害されるため)。
  window.addEventListener('touchstart', (e) => {
    let consumed = false;
    for (const t of e.changedTouches) {
      const hit = hitTest(t.clientX, t.clientY);
      if (hit) {
        consumed = true;
        touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
        press(hit.action, hit.el);
      }
    }
    if (consumed) e.preventDefault(); // ダブルタップズーム・長押しメニュー抑止
  }, opts);

  window.addEventListener('touchmove', (e) => {
    let consumed = false;
    for (const t of e.changedTouches) {
      const owned = touchOwner.get(t.identifier);
      const hit = hitTest(t.clientX, t.clientY);
      if (owned) consumed = true;
      if (owned && (!hit || hit.action !== owned.action)) {
        // 指がボタン外へスライドした → 離した扱い、別ボタンなら押し替え。
        // ダッシュ(トグル)への誤爆を防ぐため、スライド流入では発火しない
        release(t.identifier);
        if (hit && hit.action !== 'dash') {
          touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
          press(hit.action, hit.el);
        }
      } else if (!owned && hit && hit.action !== 'dash') {
        consumed = true;
        touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
        press(hit.action, hit.el);
      }
    }
    if (consumed) e.preventDefault(); // バウンススクロール抑止
  }, opts);

  const end = (e) => {
    let consumed = false;
    for (const t of e.changedTouches) {
      if (touchOwner.has(t.identifier)) consumed = true;
      release(t.identifier);
    }
    if (consumed) e.preventDefault();
  };
  window.addEventListener('touchend', end, opts);
  window.addEventListener('touchcancel', end, opts);

  // ゲーム画面自体のタッチでもズーム等を抑止
  const canvas = document.getElementById('game');
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), opts);
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), opts);
}
