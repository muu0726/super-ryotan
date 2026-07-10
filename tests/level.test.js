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

    it('M (きのこ入りハテナ) がグリッドにソリッドタイルとして残ること', () => {
      const lvl = new Level(0); // Stage 1 には M が1つある
      let found = 0;
      for (let y = 0; y < lvl.height; y++) {
        for (let x = 0; x < lvl.width; x++) {
          if (lvl.grid[y][x] === 'M') found++;
        }
      }
      expect(found).toBeGreaterThan(0);
      expect(lvl.items).toEqual([]); // アイテムは叩くまで出現しない
    });

    it('K (ノコノコ風) と F (パタパタ風) がタイプ付きで抽出されること', () => {
      const lvl2 = new Level(1); // Stage 2 には K がいる
      expect(lvl2.enemies.some((e) => e.type === 'koopa' && e.state === 'walk')).toBe(true);

      const lvl3 = new Level(2); // Stage 3 には F がいる
      const flyer = lvl3.enemies.find((e) => e.type === 'flyer');
      expect(flyer).toBeDefined();
      expect(flyer.baseY).toBeGreaterThan(0);

      // グリッドからは消えていること
      for (const lvl of [lvl2, lvl3]) {
        for (let y = 0; y < lvl.height; y++) {
          for (let x = 0; x < lvl.width; x++) {
            expect(lvl.grid[y][x]).not.toBe('K');
            expect(lvl.grid[y][x]).not.toBe('F');
          }
        }
      }
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

  describe('1.5 中間チェックポイントと10コインブロック', () => {
    it('EX以外の全ステージに中間チェックポイントが自動配置されること', () => {
      for (let i = 0; i < LEVEL_COUNT - 1; i++) {
        const lvl = new Level(i);
        expect(lvl.checkpointX, `stage ${i + 1} に配置されていない`).toBeDefined();
        // 旗の足元が足場で、上2タイルが空間であること
        const footing = lvl.grid[lvl.checkpointTy][lvl.checkpointX];
        expect(['#', '=', 'B', 'U', 'T']).toContain(footing);
        expect(lvl.grid[lvl.checkpointTy - 1][lvl.checkpointX]).toBe('.');
        expect(lvl.grid[lvl.checkpointTy - 2][lvl.checkpointX]).toBe('.');
      }
    });

    it('EXステージにはチェックポイントが配置されないこと (一発勝負)', () => {
      const ex = new Level(LEVEL_COUNT - 1);
      expect(ex.checkpointX).toBeUndefined();
    });

    it('T (10コインブロック) が残数10で登録され、takeBlockCoin で減っていくこと', () => {
      const lvl = new Level(1); // Stage 2 に T がある
      expect(lvl.blockCoins.size).toBeGreaterThan(0);
      const key = [...lvl.blockCoins.keys()][0];
      const [tx, ty] = key.split(',').map(Number);
      expect(lvl.blockCoins.get(key)).toBe(10);
      for (let left = 9; left >= 0; left--) {
        expect(lvl.takeBlockCoin(tx, ty)).toBe(left);
      }
    });

    it('X (隠しブロック) がグリッドに残ること (ロード時に消えない)', () => {
      const lvl = new Level(0); // Stage 1 に X がある
      let found = 0;
      for (let y = 0; y < lvl.height; y++) {
        for (let x = 0; x < lvl.width; x++) {
          if (lvl.grid[y][x] === 'X') found++;
        }
      }
      expect(found).toBeGreaterThan(0);
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
