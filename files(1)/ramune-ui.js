/* ============================================================
   ramune-ui.js  ―  ゲーム風トースト / 確認ダイアログ / 画面管理
   ------------------------------------------------------------
   元コード（間取りすと puzzle_252.html 1064〜1228行）から
   トースト・確認ダイアログ・画面切替を移植。
   ・必要なCSSとDOMは初回呼び出し時にJSから自動注入する
     （HTMLへのCSSコピペ／DOM記述を不要にするため）。
   ・確認ダイアログは元コードが Promise<boolean> 型なので、それに合わせる。
     （加えて第2/第3引数に関数を渡せば onYes/onNo コールバックとしても動く）
   依存：ramune-storage.js（直接は使わないが読み込み順は storage → ui 推奨）。
   ============================================================ */
window.RAMUNE = window.RAMUNE || {};
(function(){
  'use strict';

  // ── CSS の動的注入（初回のみ）──
  // 色は元のハードコード値をフォールバックにしたCSS変数化。
  //   var(--ramune-xxx, 〈ゲームの変数〉, 〈元の値〉) の順で解決。
  let _cssInjected = false;
  function _injectCSS(){
    if(_cssInjected) return;
    _cssInjected = true;
    const css =
      '#game-toast{'+
        'position:fixed;left:50%;top:calc(env(safe-area-inset-top, 0px) + 16px);'+
        'transform:translateX(-50%) translateY(-24px);'+
        'background:var(--ramune-toast-bg, rgba(58,42,26,.94));'+
        'color:var(--ramune-toast-fg, #f5f0e8);'+
        "font-family:'Noto Sans JP',sans-serif;font-size:14px;letter-spacing:.04em;"+
        'padding:13px 24px;border-radius:30px;z-index:400;'+
        'box-shadow:0 6px 24px rgba(58,42,26,.35);'+
        'opacity:0;pointer-events:none;transition:opacity .3s,transform .3s;white-space:nowrap;'+
      '}'+
      '#game-toast.show{opacity:1;transform:translateX(-50%) translateY(0);}'+
      '#game-confirm-overlay{'+
        'display:none;position:fixed;inset:0;z-index:500;'+
        'background:var(--ramune-overlay-bg, rgba(58,42,26,.55));'+
        'align-items:center;justify-content:center;padding:24px;'+
      '}'+
      '#game-confirm-overlay.active{display:flex;}'+
      '#game-confirm-box{'+
        'background:var(--ramune-dialog-bg, var(--cream, #f5f0e8));'+
        'border:2px solid var(--ramune-dialog-border, #c8a060);border-radius:16px;'+
        'max-width:340px;width:100%;padding:26px 22px 20px;text-align:center;'+
        'box-shadow:0 12px 40px rgba(58,42,26,.4);animation:ramunePopIn .3s ease both;'+
      '}'+
      '#game-confirm-msg{'+
        "font-family:'Noto Sans JP',sans-serif;font-size:14px;line-height:1.7;"+
        'color:var(--ramune-dialog-fg, var(--brown-dark, #3a2a1a));'+
        'letter-spacing:.03em;margin-bottom:20px;white-space:pre-line;'+
      '}'+
      '#game-confirm-btns{display:flex;gap:10px;}'+
      '.gc-btn{flex:1;padding:12px 0;border-radius:10px;'+
        "font-family:'Noto Serif JP',serif;font-size:14px;letter-spacing:.08em;"+
        'cursor:pointer;border:none;transition:transform .15s;}'+
      '.gc-btn:hover{transform:translateY(-2px);}'+
      '.gc-cancel{background:#fff;border:1px solid rgba(90,74,58,.25);'+
        'color:var(--ramune-dialog-fg-sub, var(--brown-light, #8a7060));}'+
      '.gc-ok{background:var(--ramune-dialog-accent, var(--brown-dark, #3a2a1a));color:#f5f0e8;}'+
      // 元の @keyframes popIn 相当。名前を ramunePopIn にしてゲーム側と衝突させない
      '@keyframes ramunePopIn{0%{transform:scale(.8);opacity:0;}70%{transform:scale(1.05);}100%{transform:scale(1);opacity:1;}}';
    const st = document.createElement('style');
    st.id = 'ramune-ui-style';
    st.textContent = css;
    document.head.appendChild(st);
  }

  // ── トースト ──
  function _ensureToastEl(){
    let el = document.getElementById('game-toast');
    if(!el){
      el = document.createElement('div');
      el.id = 'game-toast';
      document.body.appendChild(el);
    }
    return el;
  }
  let _toastTimer = null;
  // options.duration（ms）で表示時間を変更可。省略時は元コードと同じ 2400ms。
  function toast(msg, options){
    _injectCSS();
    const el = _ensureToastEl();
    if(!el) return;
    el.textContent = msg;
    el.classList.add('show');
    if(_toastTimer) clearTimeout(_toastTimer);
    const dur = (options && typeof options.duration === 'number') ? options.duration : 2400;
    _toastTimer = setTimeout(()=>{ el.classList.remove('show'); }, dur);
  }

  // ── 確認ダイアログ用DOMの用意 ──
  function _ensureConfirmEl(){
    let ov = document.getElementById('game-confirm-overlay');
    if(!ov){
      ov = document.createElement('div');
      ov.id = 'game-confirm-overlay';
      ov.innerHTML =
        '<div id="game-confirm-box">'+
          '<div id="game-confirm-msg"></div>'+
          '<div id="game-confirm-btns">'+
            '<button id="game-confirm-cancel" class="gc-btn gc-cancel">やめる</button>'+
            '<button id="game-confirm-ok" class="gc-btn gc-ok">OK</button>'+
          '</div>'+
        '</div>';
      document.body.appendChild(ov);
    }
    return ov;
  }

  // 確認ダイアログ。Promise<boolean> を返す（OKでtrue）。＝元コードと同じ型。
  //   第2/第3引数が文字列 → OK/キャンセルのラベルとして使う
  //   第2/第3引数が関数   → onYes/onNo コールバックとして使う（それでも Promise は返る）
  function confirm(msg, arg1, arg2){
    const onYes = (typeof arg1 === 'function') ? arg1 : null;
    const onNo  = (typeof arg2 === 'function') ? arg2 : null;
    const okLabel     = (typeof arg1 === 'string') ? arg1 : 'OK';
    const cancelLabel = (typeof arg2 === 'string') ? arg2 : 'やめる';
    _injectCSS();
    const ov = _ensureConfirmEl();
    const p = new Promise((resolve)=>{
      const msgEl = document.getElementById('game-confirm-msg');
      const okBtn = document.getElementById('game-confirm-ok');
      const cancelBtn = document.getElementById('game-confirm-cancel');
      if(!ov || !msgEl || !okBtn || !cancelBtn){ resolve(window.confirm(msg)); return; }
      msgEl.textContent = msg;
      okBtn.textContent = okLabel;
      cancelBtn.textContent = cancelLabel;
      cancelBtn.style.display = ''; // alert でnoneにされている可能性に備える
      ov.classList.add('active');
      const cleanup = (val)=>{
        ov.classList.remove('active');
        okBtn.onclick = null; cancelBtn.onclick = null;
        resolve(val);
      };
      okBtn.onclick = ()=>cleanup(true);
      cancelBtn.onclick = ()=>cleanup(false);
    });
    if(onYes || onNo){
      p.then(ok=>{ if(ok){ if(onYes) onYes(); } else { if(onNo) onNo(); } });
    }
    return p;
  }

  // お知らせだけのダイアログ（OKのみ）。Promise を返す。＝元コード showGameAlert 相当。
  function alert(msg){
    _injectCSS();
    const ov = _ensureConfirmEl();
    return new Promise((resolve)=>{
      const msgEl = document.getElementById('game-confirm-msg');
      const okBtn = document.getElementById('game-confirm-ok');
      const cancelBtn = document.getElementById('game-confirm-cancel');
      if(!ov || !msgEl || !okBtn || !cancelBtn){ window.alert(msg); resolve(); return; }
      msgEl.textContent = msg;
      okBtn.textContent = 'OK';
      cancelBtn.style.display = 'none';
      ov.classList.add('active');
      okBtn.onclick = ()=>{
        ov.classList.remove('active');
        cancelBtn.style.display = ''; okBtn.onclick = null;
        resolve();
      };
    });
  }

  // ── 画面管理 ──
  // .screen 要素の .active を切り替える汎用版。
  // （元コードの bottom-bar / top-bar 制御は間取りすと固有なので含めない。
  //   スクロール位置リセットは全ゲームで有用なので残す＝iOS Safari対策込み）
  function showScreen(id){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
    // 前の画面のスクロール位置を引きずらない
    try{
      if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
      const _rst = ()=>{
        window.scrollTo(0,0);
        document.documentElement.scrollTop = 0;
        document.body.scrollTop = 0;
      };
      _rst();
      requestAnimationFrame(_rst);
      setTimeout(_rst, 120); // iOS Safariが後からスクロール位置を復元するケース対策
    }catch(e){}
  }

  RAMUNE.ui = { toast, confirm, alert, showScreen };
})();
