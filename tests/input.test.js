// ============================================
// タッチ入力のテスト: ダッシュのトグルと拡張ヒットエリア
// window / document をスタブして input.js のイベント処理を直接検証する。
// ============================================

import { describe, it, expect, beforeAll, beforeEach } from 'vitest';

// ---- DOM スタブ ----
const handlers = {}; // type -> [fn]

function fakeClassList() {
  const set = new Set();
  return {
    add: (c) => set.add(c),
    remove: (c) => set.delete(c),
    toggle: (c, force) => (force ? set.add(c) : set.delete(c)),
    contains: (c) => set.has(c),
  };
}

function fakeBtn(key, rect) {
  return {
    dataset: { key },
    classList: fakeClassList(),
    getBoundingClientRect: () => ({
      ...rect,
      width: rect.right - rect.left,
      height: rect.bottom - rect.top,
    }),
    addEventListener: () => {},
  };
}

// 実機に近い配置 (64px ボタン、拡張ヒットエリアは 1.75倍 = 各辺 +24px)
const btnLeft = fakeBtn('left', { left: 12, right: 76, top: 300, bottom: 364 });
const btnRight = fakeBtn('right', { left: 86, right: 150, top: 300, bottom: 364 });
const btnDash = fakeBtn('dash', { left: 600, right: 664, top: 300, bottom: 364 });
const btnJump = fakeBtn('jump', { left: 680, right: 756, top: 288, bottom: 364 });

let input;

function dispatch(type, touches) {
  const e = {
    changedTouches: touches.map(([identifier, clientX, clientY]) => ({ identifier, clientX, clientY })),
    defaultPrevented: false,
    preventDefault() { this.defaultPrevented = true; },
  };
  for (const fn of handlers[type] ?? []) fn(e);
  return e;
}

const tap = (id, x, y) => {
  dispatch('touchstart', [[id, x, y]]);
  dispatch('touchend', [[id, x, y]]);
};

beforeAll(async () => {
  globalThis.window = {
    addEventListener: (type, fn) => (handlers[type] ??= []).push(fn),
  };
  globalThis.document = {
    getElementById: (id) => {
      if (id === 'touch-ui') return { addEventListener: () => {} };
      if (id === 'tc-dash') return btnDash;
      if (id === 'game') return { addEventListener: () => {} };
      return null;
    },
    querySelectorAll: () => [btnLeft, btnRight, btnDash, btnJump],
  };
  const mod = await import('../src/input.js');
  input = mod.input;
  mod.initInput();
});

beforeEach(() => {
  // ダッシュ ON なら OFF に戻し、押下中の指をすべて離す
  dispatch('touchcancel', [[0, 0, 0], [1, 0, 0], [2, 0, 0]]);
  if (input.dash) tap(9, 632, 332);
  expect(input.dash).toBe(false);
});

describe('ダッシュボタンのトグル', () => {
  it('ボタン中心のタップで ON、再タップで OFF になる', () => {
    tap(1, 632, 332);
    expect(input.dash).toBe(true); // 指を離しても維持 (トグル)
    tap(2, 632, 332);
    expect(input.dash).toBe(false);
  });

  it('拡張ヒットエリア (ボタン外周 24px) のタップでもトグルする', () => {
    // 旧実装は #touch-ui (pointer-events:none) にリスナーがあり、
    // この近接タップがハンドラに届かず取りこぼされていた (実機バグ)
    tap(1, 590, 332); // ボタン左端 600px の 10px 外側
    expect(input.dash).toBe(true);
    tap(2, 632, 380); // ボタン下端 364px の 16px 外側
    expect(input.dash).toBe(false);
  });

  it('タップ中の指ぶれ (touchmove) で二重トグルしない', () => {
    dispatch('touchstart', [[1, 632, 332]]);
    dispatch('touchmove', [[1, 634, 334]]);
    dispatch('touchmove', [[1, 640, 338]]);
    dispatch('touchend', [[1, 640, 338]]);
    expect(input.dash).toBe(true);
  });

  it('他ボタンからのスライド流入では誤爆しない', () => {
    dispatch('touchstart', [[1, 718, 326]]); // ジャンプを押す
    expect(input.jump).toBe(true);
    dispatch('touchmove', [[1, 632, 332]]);  // ダッシュ上へスライド
    dispatch('touchend', [[1, 632, 332]]);
    expect(input.dash).toBe(false);
    expect(input.jump).toBe(false); // スライドで離した扱い
  });
});

describe('移動・ジャンプボタン', () => {
  it('押している間だけ ON になる (ホールド式)', () => {
    dispatch('touchstart', [[1, 44, 332]]);
    expect(input.left).toBe(true);
    dispatch('touchend', [[1, 44, 332]]);
    expect(input.left).toBe(false);
  });

  it('拡張ヒットエリアの押下も受け付ける', () => {
    dispatch('touchstart', [[1, 160, 332]]); // 右ボタン右端 150px の 10px 外側
    expect(input.right).toBe(true);
    dispatch('touchend', [[1, 160, 332]]);
    expect(input.right).toBe(false);
  });

  it('ボタン間のスライドで押し替えできる', () => {
    dispatch('touchstart', [[1, 44, 332]]);   // 左
    dispatch('touchmove', [[1, 118, 332]]);   // 右へスライド
    expect(input.left).toBe(false);
    expect(input.right).toBe(true);
    dispatch('touchend', [[1, 118, 332]]);
    expect(input.right).toBe(false);
  });
});

describe('preventDefault の選択適用', () => {
  it('ボタンに当たったタッチは preventDefault される', () => {
    const e = dispatch('touchstart', [[1, 632, 332]]);
    expect(e.defaultPrevented).toBe(true);
    dispatch('touchend', [[1, 632, 332]]);
  });

  it('ボタン外のタッチは preventDefault されない (メニューの click 合成を阻害しない)', () => {
    const e = dispatch('touchstart', [[1, 400, 100]]);
    expect(e.defaultPrevented).toBe(false);
    const e2 = dispatch('touchend', [[1, 400, 100]]);
    expect(e2.defaultPrevented).toBe(false);
  });
});
