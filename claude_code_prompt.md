# Claude Code 用マリオ風ゲーム実装プロンプト

このファイルをコピーし、Claude Code に入力してゲーム開発を開始してください。

---

## Claude Code への指示プロンプト

```markdown
あなたは優秀なゲームデベロッパーです。
現在、カレントディレクトリにある `キャラクター.png` をプレイヤーキャラクター画像として使用し、HTML5 CanvasとVanilla TypeScript/JavaScript（Viteビルドツールを使用）で、マリオ風の2D横スクロールアクションゲームを作成してください。

以下の要件を完全に満たし、**エラーなく一発で動作し、本番公開（GitHubへの保存およびVercelへのデプロイ）が可能なコード**を記述してください。途中で「// ...既存の処理」のように省略せず、すべてのファイルを最後まで書ききってください。

### 1. プロジェクト構成とセットアップ
- **ビルドツール**: Vite (Vanilla TypeScript または Vanilla JavaScript)。Viteでビルドして `dist` ディレクトリに出力する構成。
- **フォルダ構成**:
  - `./index.html` (ゲーム画面、Canvas、モバイル用操作UI)
  - `./src/main.js` (または `main.ts` - エントリーポイント、ゲームループ)
  - `./src/physics.js` (物理演算、衝突判定ロジック)
  - `./src/input.js` (キーボード・タッチ操作の入力処理)
  - `./src/level.js` (10個のステージデータと生成ロジック)
  - `./src/style.css` (スタイリング、横画面強制レイアウト)
  - `./public/キャラクター.png` (または直下に配置された `キャラクター.png` をロードして使用)
  - `./vercel.json` (Vercelデプロイ用の設定)

### 2. キャラクター（プレイヤー）の描画とロード
- `./public/` ディレクトリ（またはプロジェクトルート）から `キャラクター.png` を `Image` オブジェクトとしてロードします。
- **アニメーションの扱い**:
  - 画像が単一の立ち絵の場合：進行方向（左右）に応じて左右反転して描画する。
  - 画像がスプライトシートの場合：歩行アニメーション（フレーム切り替え）に対応できるように、スプライト切り出し用のクラス変数 `frameX`, `frameY`, `spriteWidth`, `spriteHeight` を設け、画像読み込み時にサイズを自動検出、またはパラメータ調整できるようにする。

### 3. マリオ物理の完全再現とコアロジック (Fixed Timestep 制御)
マリオ特有の「慣性」と「可変ジャンプ」を再現するため、以下の数式と定数パラメータをゲームの物理演算（更新間隔 16.67ms 固定）に適用してください。

- **水平方向の物理 (60FPS基準のピクセル数)**:
  - **歩行時の最大速度 ($V_{\\text{walk\\_max}}$)**: `2.5` px/frame (秒速 150px)
  - **ダッシュ時の最大速度 ($V_{\\text{dash\\_max}}$)**: `4.5` px/frame (秒速 270px)
  - **水平加速度 ($A_x$)**: `0.1` px/frame²
  - **地面摩擦（減速度 $F_x$）**: キー入力が途切れた時、毎フレーム `0.15` px/frame ずつ減衰させ、スッと止まらず滑る挙動を再現する。
  - **ブレーキ減速度 ($D_x$）**: 進行方向と逆キーを入力した場合、通常の加速度の3倍（`0.3` px/frame²）の強さで急減速（スリップアニメーション状態）をトリガーする。

- **垂直方向の物理（可変ジャンプと重力変速）**:
  - **ジャンプ高度の定義**: 最大ジャンプ高度 $\\alpha = 80$ ピクセル (2.5タイル分)、頂点到達時間 $t = 0.4$ 秒（24フレーム相当）。
  - **上昇時の重力 ($\\gamma_{\\text{rise}}$)**: $\\gamma_{\\text{rise}} = \\frac{2\\alpha}{t^2} \\approx 0.28$ px/frame²
  - **初期ジャンプ速度 ($j$)**: $j = -\\sqrt{2\\alpha\\gamma_{\\text{rise}}} \\approx -6.7$ px/frame
  - **可変ジャンプ制御**:
    - ジャンプボタン長押し時（最大 24フレーム）は上昇重力（`0.28`）を適用する。
    - ボタンを早期に離した瞬間、Y軸上昇速度を `50%`（`vy *= 0.5`）に減衰し、惰性上昇フェーズ（重力 `G_FALL`）に移行する。
  - **落下時の重力増加**: 落下中、またはボタンを離した後は、上昇時の2倍の重力 $\\gamma_{\\text{fall}} = 0.56$ px/frame² を適用し、キビキビと鋭く落下させる。
  - **終端速度 (Terminal Velocity)**: 最大落下速度を `8.0` px/frame にクランプし、床のすり抜けを防止する。

- **当たり判定（Tilemap Collision）**:
  - タイルグリッド（例：32x32ピクセル）で衝突判定を行います。
  - **X軸・Y軸の独立更新（絶対原則）**:
    1. プレイヤーのX座標を更新し、周囲の衝突対象タイルとAABB衝突を検証。衝突時は押し戻しを行って $v_x = 0$ にする。
    2. プレイヤーのY座標を更新し、再度衝突判定を検証。下方向の衝突時は床の上に押し戻して $v_y = 0$、`onGround = true` にする。天井衝突時は押し下げて $v_y = 0$ にし落下へ移行する。
  - **継ぎ目の引っかかり対策**: 角でプレイヤーがスタックするのを防ぐため、コライダーの判定矩形を幅・高さともに `0.2` ピクセル程度内側に縮小（インセット）して判定を行う。

- **カメラのスクロール**:
  - プレイヤーのX座標が画面の1/3を超えたら、カメラが右にスクロールする。
  - 画面左端に戻れない制限を適用。

### 4. モバイル対応・マルチタッチUI設計
- **画面回転強制とレイアウト**:
  - アスペクト比を 16:9（例: 800x450）に固定し、CSSの `transform` または `viewport` で画面いっぱいにスケーリングする。
  - 縦向き時は「端末を横向きにしてください」というオーバレイ画面をCSS `@media (orientation: portrait)` で表示する。
- **マルチタッチ入力の追跡**:
  - `touchstart`, `touchend`, `touchmove`, `touchcancel` の各イベントを使用する。
  - 同時押し（右とダッシュを押したまま、ジャンプをタップ）を実現するため、`touch.identifier` をキーに各指のタッチ先ボタン（Left, Right, Dash, Jump）を追跡・マップ管理する。
  - ボタンのヒットエリア（タッチ判定領域）は、視覚ボタン画像の **1.5倍から2倍** の範囲を確保する。
  - イベントハンドラ内で `preventDefault()` を呼び出し、ダブルタップでのブラウザズームや長押し時のメニュー、画面バウンススクロールを抑止する。

### 5. ゲームループ (蓄積型 Fixed Timestep)
処理負荷の変動による壁抜けやジャンプのばらつきを防ぐため、以下のタイムステップ蓄積型ループを実装してください。

```javascript
let lastTime = 0;
let accumulator = 0;
const fixedTimeStep = 1000 / 60; // 16.67ms (60FPS固定)

let prevX = 0, prevY = 0;
let currentX = 0, currentY = 0;

function gameLoop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    let deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    // スパイク防止（100ms以上のラグはクランプし、フリーズ死のスパイラルを防ぐ）
    if (deltaTime > 100) deltaTime = fixedTimeStep;

    accumulator += deltaTime;

    // 固定時間ステップごとに物理演算と衝突判定を実行
    let updateCount = 0;
    while (accumulator >= fixedTimeStep) {
        prevX = player.x;
        prevY = player.y;

        updatePhysics(fixedTimeStep); // 物理・衝突判定

        currentX = player.x;
        currentY = player.y;

        accumulator -= fixedTimeStep;
        
        // 最大更新回数のパニック制限
        updateCount++;
        if (updateCount > 5) {
            accumulator = 0;
            break;
        }
    }

    // 描画補間値 alpha の算出
    const alpha = accumulator / fixedTimeStep;
    const renderX = prevX * (1 - alpha) + currentX * alpha;
    const renderY = prevY * (1 - alpha) + currentY * alpha;

    // 補間された座標でプレイヤーを描画
    draw(renderX, renderY);

    requestAnimationFrame(gameLoop);
}
requestAnimationFrame(gameLoop);
```

### 6. 10ステージ構成とセーブ
- 配列（または文字列テンプレート）で10ステージ分のマップデータを管理する（例: `#`=地面, `?`=ハテナブロック, `G`=ゴールフラッグ, `H`=トゲ, `.`=空間）。
- ゴール到達時に `localStorage` にアンロック状況（最大到達ステージ数）を保存する。
- スタート画面で「最初から」「ステージ選択（解放済みのみ）」を選べるUIを構築する。

### 7. 演出および効果音
- Web Audio API の `OscillatorNode` を使って、外部ファイルなしでレトロ効果音を動的生成・再生する。
  - ジャンプ音（高音への周波数スイープ）
  - ブロック衝突・ミス音（減衰するノイズ/低音）
  - ステージクリア音（メロディライン）
- プレイヤーのミス時、上に小さく跳ね上がってから画面下に回転落下する演出。
- プレミアムなダークモード/レトロモダン配色を用いたスタイリッシュなUI。

### 8. Vercel デプロイ対応
- 静的ルーティングを安全に行う `./vercel.json`。
- `package.json` に `vite build` などのビルド設定。
```
---

## Claude Code での開発の進め方

1. **Vite プロジェクトの作成**
   ターミナルで `npm create vite@latest . -- --template vanilla` などのコマンドを使用して、現在のフォルダにテンプレートを初期化させます。
2. **コードファイルの生成と編集**
   上記のプロンプトを Claude Code に渡し、必要な各ファイルの作成と実装を依頼します。
3. **ローカルサーバーでの動作確認**
   `npm run dev` でローカルサーバーを起動し、PCおよびスマホ（ブラウザのデベロッパーツールによるモバイルエミュレーション）で挙動をテストさせます。
4. **Gitへの保存とデプロイ**
   問題がなければGitにコミットし、Vercelへデプロイさせます。
