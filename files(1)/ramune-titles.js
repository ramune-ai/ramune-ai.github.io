/* ============================================================
   ramune-titles.js  ―  称号システムの「枠組み」（データ管理のみ）
   ------------------------------------------------------------
   元コード（間取りすと puzzle_252.html 1980〜2268行ほか）から、
   称号の「獲得判定ループ・所持/既読管理・クリーニング」だけを移植。
   ・称号マスターデータの中身（条件式など）は間取りすと固有 → 含めない。
     ゲーム側が init で master を渡す。
   ・一覧グリッドのDOM描画も固有CSSに強依存 → 含めない（データ管理のみ）。
   依存：ramune-storage.js を先に読み込むこと（無くても素の localStorage で動く）。
   ============================================================ */
window.RAMUNE = window.RAMUNE || {};
(function(){
  'use strict';

  let _master = [];
  let _storageKey = 'titles';        // 所持リスト保存キー
  let _seenKey    = 'titles-seen';   // 既読管理キー
  // ── 互換性のためのキー指定 ──
  // 間取りすとの既存データは「称号名の文字列」で保存されている。
  // マスター側の識別子フィールド名を idKey で指定できるようにして、
  // 既存の madori-titles データをそのまま使えるようにする（例: idKey:'title'）。
  let _idKey   = 'id';               // マスター項目の識別子フィールド
  let _condKey = 'condition';        // マスター項目の判定関数フィールド

  function _store(){ return (window.RAMUNE && RAMUNE.storage) ? RAMUNE.storage : null; }
  function _getArr(key){
    const s = _store();
    if(s) return s.getJSON(key, []) || [];
    try{ return JSON.parse(localStorage.getItem(key) || '[]'); }catch(e){ return []; }
  }
  function _setArr(key, arr){
    const s = _store();
    if(s){ s.setJSON(key, arr); return; }
    try{ localStorage.setItem(key, JSON.stringify(arr)); }catch(e){}
  }
  function _idOf(m){ return m[_idKey]; }

  // cfg = { master:[...], storageKey, seenKey, idKey, condKey }
  function init(cfg){
    cfg = cfg || {};
    _master = cfg.master || [];
    if(cfg.storageKey !== undefined) _storageKey = cfg.storageKey;
    if(cfg.seenKey    !== undefined) _seenKey    = cfg.seenKey;
    if(cfg.idKey      !== undefined) _idKey      = cfg.idKey;
    if(cfg.condKey    !== undefined) _condKey    = cfg.condKey;
    // 所持リストのクリーニング：マスターに存在しないidを除去（改定前の旧称号の掃除）
    try{
      const masterSet = new Set(_master.map(_idOf));
      const owned = _getArr(_storageKey);
      const cleaned = owned.filter(t=>masterSet.has(t));
      if(cleaned.length !== owned.length){ _setArr(_storageKey, cleaned); }
    }catch(e){}
  }

  // 各マスターの condition(context) を評価し、
  // 「新規に獲得した称号」のマスター項目配列を返す＋所持リストに保存する。
  // ※新規は先頭に追加（元コードの saved.unshift 踏襲）。
  // ※rar順ソートや「1件も無いときのフォールバック称号」は間取りすと固有なので
  //   ここでは行わない。必要ならゲーム側で戻り値を加工すること。
  function check(context){
    const owned = _getArr(_storageKey);
    const newlyAwarded = [];
    for(const m of _master){
      const cond = m[_condKey];
      let pass = false;
      try{ pass = !!(typeof cond === 'function' && cond(context)); }catch(e){ pass = false; }
      if(!pass) continue;
      const id = _idOf(m);
      if(owned.indexOf(id) === -1){
        owned.unshift(id);      // 新規は先頭へ
        newlyAwarded.push(m);
      }
    }
    _setArr(_storageKey, owned);
    return newlyAwarded;
  }

  function getOwned(){ return _getArr(_storageKey); }
  function isOwned(id){ return _getArr(_storageKey).indexOf(id) !== -1; }

  // 既読にする。id は単体でも配列でもOK（一覧ページ表示時の一括既読に対応）。
  function markSeen(id){
    const seen = _getArr(_seenKey);
    const ids = Array.isArray(id) ? id : [id];
    let changed = false;
    ids.forEach(i=>{ if(seen.indexOf(i) === -1){ seen.push(i); changed = true; } });
    if(changed) _setArr(_seenKey, seen);
    return changed;
  }
  // 所持しているが未読の称号id配列（＝NEW!表示の対象）
  function getUnseen(){
    const owned = _getArr(_storageKey);
    const seen = new Set(_getArr(_seenKey));
    return owned.filter(id=>!seen.has(id));
  }

  RAMUNE.titles = { init, check, getOwned, isOwned, markSeen, getUnseen };
})();
