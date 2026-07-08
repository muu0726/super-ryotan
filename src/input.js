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

// キーボード由来 / タッチ由来を別々に持ち、OR して論理状態を作る
const kbState = { left: false, right: false, jump: false, dash: false };
const touchCount = { left: 0, right: 0, jump: 0, dash: 0 };

function refresh() {
  for (const k of ['left', 'right', 'jump', 'dash']) {
    input[k] = kbState[k] || touchCount[k] > 0;
  }
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

  // フォーカス喪失時は全キー解除(押しっぱなし事故防止)
  window.addEventListener('blur', () => {
    for (const k in kbState) kbState[k] = false;
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
  touchCount[action]++;
  el.classList.add('pressed');
  refresh();
}

function release(identifier) {
  const owned = touchOwner.get(identifier);
  if (!owned) return;
  touchOwner.delete(identifier);
  touchCount[owned.action] = Math.max(0, touchCount[owned.action] - 1);
  if (touchCount[owned.action] === 0) owned.el.classList.remove('pressed');
  refresh();
}

function initTouch() {
  const ui = document.getElementById('touch-ui');
  if (!ui) return;

  const opts = { passive: false };

  ui.addEventListener('touchstart', (e) => {
    e.preventDefault(); // ダブルタップズーム・長押しメニュー抑止
    for (const t of e.changedTouches) {
      const hit = hitTest(t.clientX, t.clientY);
      if (hit) {
        touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
        press(hit.action, hit.el);
      }
    }
  }, opts);

  ui.addEventListener('touchmove', (e) => {
    e.preventDefault(); // バウンススクロール抑止
    for (const t of e.changedTouches) {
      const owned = touchOwner.get(t.identifier);
      const hit = hitTest(t.clientX, t.clientY);
      if (owned && (!hit || hit.action !== owned.action)) {
        // 指がボタン外へスライドした → 離した扱い、別ボタンなら押し替え
        release(t.identifier);
        if (hit) {
          touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
          press(hit.action, hit.el);
        }
      } else if (!owned && hit) {
        touchOwner.set(t.identifier, { action: hit.action, el: hit.el });
        press(hit.action, hit.el);
      }
    }
  }, opts);

  const end = (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) release(t.identifier);
  };
  ui.addEventListener('touchend', end, opts);
  ui.addEventListener('touchcancel', end, opts);

  // ゲーム画面自体のタッチでもズーム等を抑止
  const canvas = document.getElementById('game');
  canvas.addEventListener('touchstart', (e) => e.preventDefault(), opts);
  canvas.addEventListener('touchmove', (e) => e.preventDefault(), opts);
}
