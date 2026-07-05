/* ============================================================
   ramune-sound.js  ―  サウンド管理（SE / BGM）
   ------------------------------------------------------------
   元コード（間取りすと puzzle_252.html 900〜1063行）のロジックを
   一切変えずに移植。変更点は「設定を init で外から渡せるようにした」
   ことと「音量の永続化を RAMUNE.storage 経由にした」ことだけ。
   依存：ramune-storage.js を先に読み込むこと。
   ============================================================ */
window.RAMUNE = window.RAMUNE || {};
(function(){
  'use strict';

  // ── 設定（init で差し替え。使うまではダミー値）──
  let SND_DIR = 'SE.BGM/';   // 音源フォルダ
  let SOUND   = {};          // 「呼び名 : ファイル名」。使う音だけ書けばOK
  let BGM_FILE = '';         // BGMファイル名（SND_DIR 内）
  let seVol  = 0.7;
  let bgmVol = 0.4;

  // storage が読み込まれていればそれを使う。無ければ素の localStorage で代替。
  function _store(){ return (window.RAMUNE && RAMUNE.storage) ? RAMUNE.storage : null; }
  function _loadVol(key, def){
    const s = _store();
    if(s) return s.getNum(key, def);
    try{ const v = parseFloat(localStorage.getItem(key)); return isNaN(v) ? def : v; }
    catch(e){ return def; }
  }
  function _saveVol(key, val){
    const s = _store();
    if(s){ s.set(key, String(val)); return; }
    try{ localStorage.setItem(key, String(val)); }catch(e){}
  }

  // WebAudio方式：先読みした音をミリ秒遅延なしで重ねて鳴らせる
  let _actx = null;
  const _seBuf = {};     // 読み込み済みの音データ
  const _seLoading = {};
  function _audioCtx(){
    if(!_actx){
      const AC = window.AudioContext || window.webkitAudioContext;
      if(!AC) return null;
      _actx = new AC();
    }
    if(_actx.state === 'suspended'){ _actx.resume().catch(()=>{}); }
    return _actx;
  }
  function _loadSE(name){
    if(_seBuf[name]) return Promise.resolve(_seBuf[name]);
    if(_seLoading[name]) return _seLoading[name];
    const f = SOUND[name];
    if(!f) return Promise.resolve(null);
    const ctx = _audioCtx();
    if(!ctx) return Promise.resolve(null);
    _seLoading[name] = fetch(encodeURI(SND_DIR + f))
      .then(r=>{ if(!r.ok) throw 0; return r.arrayBuffer(); })
      .then(ab=>new Promise((res,rej)=>ctx.decodeAudioData(ab,res,rej)))
      .then(buf=>{ _seBuf[name] = buf; return buf; })
      .catch(()=>null);
    return _seLoading[name];
  }

  function playSE(name){
    if(seVol <= 0) return;
    _loadSE(name).then(buf=>{
      if(!buf) return;
      const ctx = _audioCtx(); if(!ctx) return;
      try{
        const src = ctx.createBufferSource();
        src.buffer = buf;
        const g = ctx.createGain();
        g.gain.value = seVol;
        src.connect(g); g.connect(ctx.destination);
        src.start();
      }catch(e){}
    });
  }

  // ループ系SE（旧 startSpinSE）。名前を引数で受け取れるように汎用化。
  // ※元コード同様、実際には loop はせず「鳴らして途中で止められる」方式。
  //   多重再生は _loopNode で防止する。
  let _loopNode = null;
  function startLoopSE(name){
    stopLoopSE();
    if(seVol <= 0) return;
    _loadSE(name).then(buf=>{
      if(!buf || _loopNode) return;
      const ctx = _audioCtx(); if(!ctx) return;
      try{
        const src = ctx.createBufferSource();
        src.buffer = buf; // ループはしない（鳴り終わったらそのまま）
        const g = ctx.createGain(); g.gain.value = seVol;
        src.connect(g); g.connect(ctx.destination);
        src.onended = ()=>{ if(_loopNode && _loopNode.src === src) _loopNode = null; };
        src.start();
        _loopNode = { src, g };
      }catch(e){}
    });
  }
  function stopLoopSE(){
    if(_loopNode){ try{ _loopNode.src.stop(); }catch(e){} _loopNode = null; }
  }
  // 旧API互換エイリアス（移行中に既存の呼び出しを壊さないため）
  function startSpinSE(){ startLoopSE('spin'); }
  function stopSpinSE(){ stopLoopSE(); }

  // ── BGM ──
  let _bgm = null;
  function startBGM(){
    if(_bgm || bgmVol <= 0 || !BGM_FILE) return;
    try{
      const a = new Audio(encodeURI(SND_DIR + BGM_FILE));
      a.loop = true; a.volume = bgmVol;
      a.onerror = ()=>{ if(_bgm === a) _bgm = null; };
      a.play().then(()=>{}).catch(()=>{ if(_bgm === a) _bgm = null; });
      _bgm = a;
    }catch(e){ _bgm = null; }
  }
  function stopBGM(){
    if(_bgm){ try{ _bgm.pause(); }catch(e){} _bgm = null; }
  }

  function setSeVol(v){
    seVol = Math.max(0, Math.min(1, v));
    _saveVol('se-vol', seVol);
  }
  function setBgmVol(v){
    bgmVol = Math.max(0, Math.min(1, v));
    _saveVol('bgm-vol', bgmVol);
    if(bgmVol <= 0){ stopBGM(); }        // 元コードの「pause して null」と同じ挙動
    else if(_bgm){ _bgm.volume = bgmVol; }
    else startBGM();
  }
  function getSeVol(){ return seVol; }
  function getBgmVol(){ return bgmVol; }

  // ブラウザの自動再生制限：最初のタップでBGM開始＋全SE先読み
  let _kickRegistered = false;
  function _registerBgmKick(){
    if(_kickRegistered) return;
    _kickRegistered = true;
    document.addEventListener('pointerdown', function _bgmKick(){
      document.removeEventListener('pointerdown', _bgmKick);
      startBGM();
      Object.keys(SOUND).forEach(k=>_loadSE(k)); // 全SEを先読み
    });
  }

  // ── 初期化 ──
  // cfg = { dir, se:{呼び名:ファイル名,...}, bgm:'ファイル名.mp3',
  //         defaultSeVol, defaultBgmVol }
  function init(cfg){
    cfg = cfg || {};
    if(cfg.dir !== undefined) SND_DIR = cfg.dir;
    if(cfg.se)  SOUND = cfg.se;
    if(cfg.bgm !== undefined) BGM_FILE = cfg.bgm;
    const defSe  = (cfg.defaultSeVol  !== undefined) ? cfg.defaultSeVol  : 0.7;
    const defBgm = (cfg.defaultBgmVol !== undefined) ? cfg.defaultBgmVol : 0.4;
    seVol  = _loadVol('se-vol',  defSe);  if(isNaN(seVol))  seVol  = defSe;
    bgmVol = _loadVol('bgm-vol', defBgm); if(isNaN(bgmVol)) bgmVol = defBgm;
    _registerBgmKick();
  }

  RAMUNE.sound = {
    init,
    playSE,
    startLoopSE, stopLoopSE,
    startSpinSE, stopSpinSE,   // 互換エイリアス
    startBGM, stopBGM,
    setSeVol, setBgmVol,
    getSeVol, getBgmVol,
  };
})();
