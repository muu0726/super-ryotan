import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  Level,
  LEVEL_COUNT,
  LEVEL_NAMES,
  loadProgress,
  saveProgress,
  loadBestTime,
  saveBestTime
} from '../src/level.js';

describe('level.js - ステージデータのロードとタイム記録', () => {
  beforeEach(() => {
    // LocalStorage のモックを作成・登録
    const store = {};
    const mockLocalStorage = {
      getItem: (key) => store[key] || null,
      setItem: (key, value) => { store[key] = String(value); },
      removeItem: (key) => { delete store[key]; },
      clear: () => { for (const k in store) delete store[k]; },
    };
    vi.stubGlobal('localStorage', mockLocalStorage);
  });

  describe('1. ステージデータの解析', () => {
    it('ステージ1を正常にロードでき、サイズや要素が正しいこと', () => {
      const lvl = new Level(0); // Stage 1 (index 0)
      
      expect(lvl.height).toBe(14);
      expect(lvl.width).toBeGreaterThan(50);
      expect(lvl.pixelWidth).toBe(lvl.width * 32);
      expect(lvl.pixelHeight).toBe(14 * 32);
    });

    it('マップ上の S (スタート) を座標に抽出し、セルは空気（.）に置換されていること', () => {
      const lvl = new Level(0);
      expect(lvl.startX).toBeGreaterThan(0);
      expect(lvl.startY).toBeGreaterThan(0);
      
      // スタート位置のグリッドが '.' でクリアされていること
      const startTx = Math.floor(lvl.startX / 32);
      const startTy = Math.floor(lvl.startY / 32) + 1; // スタートより1タイル下を基準に補正
      expect(lvl.grid[startTy][startTx]).not.toBe('S');
    });

    it('マップ上の E (敵キャラ) を抽出し、enemies 配列に追加された上でグリッドから消えていること', () => {
      const lvl = new Level(0); // Stage 1
      
      expect(lvl.enemies.length).toBeGreaterThan(0);
      // 配列の要素検証
      const enemy = lvl.enemies[0];
      expect(enemy.x).toBeGreaterThan(0);
      expect(enemy.y).toBeGreaterThan(0);
      expect(enemy.w).toBe(24);
      expect(enemy.h).toBe(24);
      expect(enemy.dead).toBe(false);
      
      // マップグリッドから 'E' が完全に消去されて '.' になっていること
      for (let y = 0; y < lvl.height; y++) {
        for (let x = 0; x < lvl.width; x++) {
          expect(lvl.grid[y][x]).not.toBe('E');
        }
      }
    });
  });

  describe('2. セーブデータとベストタイム管理', () => {
    it('ステージの進捗状況を正しく localStorage にロード・セーブできること', () => {
      expect(loadProgress()).toBe(1); // 初期状態はステージ1

      saveProgress(3); // ステージ3クリア
      expect(loadProgress()).toBe(3);

      saveProgress(2); // 退行は無視されること
      expect(loadProgress()).toBe(3);
    });

    it('タイムアタックのクリアタイムを記録し、自己ベストのみを上書き保存できること', () => {
      const stage = 1;
      expect(loadBestTime(stage)).toBeNull();

      // 初回記録
      const record1 = saveBestTime(stage, 45.5);
      expect(record1).toBe(true); // 新記録
      expect(loadBestTime(stage)).toBe(45.5);

      // 遅いタイムは保存されないこと
      const record2 = saveBestTime(stage, 50.2);
      expect(record2).toBe(false); // 新記録ではない
      expect(loadBestTime(stage)).toBe(45.5);

      // 速いタイム（自己ベスト更新）は上書き保存されること
      const record3 = saveBestTime(stage, 38.9);
      expect(record3).toBe(true); // 新記録
      expect(loadBestTime(stage)).toBe(38.9);
    });
  });
});
