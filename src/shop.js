// ============================================
// ショップ: 累計コインで髪色 (金髪部分の色替え) を購入・付け替える
// 所持アイテムと選択中の髪色は localStorage に保存される
// ============================================

import { loadTotalCoins, saveTotalCoins } from './level.js';

// hue は髪 (金髪側 + 黒髪側の全頭) に適用する色相
// (null = 原色の金×黒ツートンのまま、'rainbow' = 虹色グラデーション)
export const HAIR_COLORS = [
  { id: 'gold', name: 'オリジナル', price: 0, hue: null, swatch: '#d9a441' },
  { id: 'pink', name: 'さくらピンク', price: 30, hue: 330, swatch: '#f472b6' },
  { id: 'blue', name: 'そらのブルー', price: 30, hue: 210, swatch: '#5aa7f0' },
  { id: 'green', name: 'わかばグリーン', price: 60, hue: 130, swatch: '#4ade80' },
  { id: 'purple', name: 'よるのパープル', price: 60, hue: 270, swatch: '#a78bfa' },
  { id: 'red', name: 'ほのおレッド', price: 100, hue: 0, swatch: '#f05a5a' },
  {
    id: 'rainbow', name: 'にじいろ', price: 1000, hue: 'rainbow',
    swatch: 'linear-gradient(135deg, #f05a5a, #ffd23f, #4ade80, #5aa7f0, #a78bfa)',
  },
];

const OWNED_KEY = 'super-ryotan-shop-owned-v1';
const HAIR_KEY = 'super-ryotan-hair-v1';

export function loadOwnedItems() {
  try {
    const raw = JSON.parse(localStorage.getItem(OWNED_KEY));
    const owned = Array.isArray(raw) ? raw.filter((id) => HAIR_COLORS.some((c) => c.id === id)) : [];
    if (!owned.includes('gold')) owned.unshift('gold'); // 初期色は常に所持
    return owned;
  } catch {
    return ['gold'];
  }
}

function saveOwnedItems(owned) {
  try {
    localStorage.setItem(OWNED_KEY, JSON.stringify(owned));
  } catch {
    // localStorage 不可でもセッション中は動作を継続
  }
}

export function loadSelectedHair() {
  try {
    const id = localStorage.getItem(HAIR_KEY);
    return loadOwnedItems().includes(id) ? id : 'gold';
  } catch {
    return 'gold';
  }
}

export function selectHair(id) {
  if (!loadOwnedItems().includes(id)) return false;
  try {
    localStorage.setItem(HAIR_KEY, id);
  } catch {
    // 保存失敗時もセッション中の切替は呼び出し側で反映される
  }
  return true;
}

// 累計コインで購入する。成功時は所持リストに追加して true を返す
export function buyHairColor(id) {
  const item = HAIR_COLORS.find((c) => c.id === id);
  if (!item) return { ok: false, reason: 'unknown' };
  const owned = loadOwnedItems();
  if (owned.includes(id)) return { ok: false, reason: 'owned' };
  const coins = loadTotalCoins();
  if (coins < item.price) return { ok: false, reason: 'coins' };
  saveTotalCoins(coins - item.price);
  owned.push(id);
  saveOwnedItems(owned);
  return { ok: true };
}
