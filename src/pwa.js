// ============================================
// PWA: Service Worker 登録 + インストールゲート
// モバイルではホーム画面に追加したアプリ (スタンドアロン起動) からのみ
// プレイ可能とし、ブラウザ起動時はインストール案内でブロックする。
// ============================================

// スタンドアロン (ホーム画面のアイコンから起動) かどうか
function isStandalone() {
  return (
    matchMedia('(display-mode: standalone)').matches ||
    matchMedia('(display-mode: fullscreen)').matches ||
    navigator.standalone === true // iOS Safari
  );
}

function isIOS() {
  return (
    /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    // iPadOS はデスクトップ UA を名乗るため taps で判別
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function initPWA() {
  // Service Worker 登録 (インストール可能条件 + オフライン動作)
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register(import.meta.env.BASE_URL + 'sw.js')
        .catch(() => { /* 未対応・失敗時もゲームは続行 */ });
    });
  }

  initInstallGate();
}

function initInstallGate() {
  const gate = document.getElementById('install-gate');
  if (!gate) return;

  const installBtn = document.getElementById('btn-install');
  const stepsIOS = document.getElementById('install-steps-ios');
  const stepsAndroid = document.getElementById('install-steps-android');

  // ゲート対象はタッチ主体の端末のみ (デスクトップに「ホーム画面」は無い)。
  // 開発時は localhost または ?nogate=1 でスキップできる。
  const isMobile = matchMedia('(pointer: coarse)').matches;
  const skip =
    new URLSearchParams(location.search).has('nogate') ||
    ['localhost', '127.0.0.1'].includes(location.hostname);

  // Android Chrome 等: インストールプロンプトを保持してボタンで発火
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    refresh();
  });

  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    deferredPrompt = null;
    refresh();
  });

  function refresh() {
    const blocked = isMobile && !skip && !isStandalone();
    gate.classList.toggle('hidden', !blocked);
    if (!blocked) return;

    // ワンタップインストールが使える場合はボタン、無ければ手動手順を表示
    installBtn.classList.toggle('hidden', !deferredPrompt);
    stepsIOS.classList.toggle('hidden', !(isIOS() && !deferredPrompt));
    stepsAndroid.classList.toggle('hidden', !(!isIOS() && !deferredPrompt));
  }

  // インストール完了・表示モード変化 (アプリとして再起動) で再判定
  window.addEventListener('appinstalled', refresh);
  matchMedia('(display-mode: standalone)').addEventListener('change', refresh);

  refresh();
}
