/* ============================================================
   ramune-storage.js  ―  localStorage 安全ラッパー
   ------------------------------------------------------------
   元コード全体に散らばっていた
     try{ localStorage.setItem(...) }catch(e){}
   というパターンを 1 か所に集約する。
   すべて window.RAMUNE.storage の下に生える。
   読み込み順：これを最初に読むこと（sound / ui / titles が依存する）。
   ============================================================ */
window.RAMUNE = window.RAMUNE || {};
(function(){
  'use strict';

  // ゲームごとのキープレフィックス（例: 'madori'）。
  // init 未呼び出しなら空＝プレフィックスなしで動く（後方互換）。
  let _prefix = '';

  // 実際に localStorage へ渡すキー名を組み立てる
  function _k(key){ return _prefix ? (_prefix + '-' + key) : key; }

  // prefix を設定。以後すべてのキーが 'prefix-xxx' になる
  function init(prefix){ _prefix = prefix || ''; }

  // 文字列取得。未存在／失敗時は fallback（未指定なら null）
  function get(key, fallback){
    const def = (fallback !== undefined) ? fallback : null;
    try{
      const v = localStorage.getItem(_k(key));
      return (v === null || v === undefined) ? def : v;
    }catch(e){ return def; }
  }

  // 文字列保存。失敗しても例外を投げない。成功で true
  function set(key, value){
    try{ localStorage.setItem(_k(key), String(value)); return true; }
    catch(e){ return false; }
  }

  // JSON.parse 込みの取得。壊れた JSON でも fallback を返す
  function getJSON(key, fallback){
    try{
      const v = localStorage.getItem(_k(key));
      if(v === null || v === undefined) return fallback;
      return JSON.parse(v);
    }catch(e){ return fallback; }
  }

  // JSON.stringify 込みの保存。成功で true
  function setJSON(key, obj){
    try{ localStorage.setItem(_k(key), JSON.stringify(obj)); return true; }
    catch(e){ return false; }
  }

  // parseFloat 込みの取得。NaN／未存在なら fallback
  function getNum(key, fallback){
    try{
      const v = localStorage.getItem(_k(key));
      if(v === null || v === undefined) return fallback;
      const n = parseFloat(v);
      return isNaN(n) ? fallback : n;
    }catch(e){ return fallback; }
  }

  // 削除。失敗しても握りつぶす
  function remove(key){
    try{ localStorage.removeItem(_k(key)); return true; }
    catch(e){ return false; }
  }

  RAMUNE.storage = { init, get, set, getJSON, setJSON, getNum, remove };
})();
