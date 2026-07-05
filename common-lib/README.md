# ramune-ai common-lib

らむねあいの各ブラウザゲームで共有する共通部品です。
単一HTML哲学はそのまま。共通部品だけを外部JSにして、各ゲームは
`<script src>` で読み込みます（Phaser CDN と同じ方式）。

すべての API は `window.RAMUNE` 名前空間の下にあります。
`RAMUNE` 以外のグローバル変数は一切作りません。

---

## 読み込み順（重要）

`storage` を最初に読み込んでください。sound / ui / titles は storage を利用します。

```html
<!-- 1) 最初に storage -->
<script src="https://ramune-ai.github.io/common-lib/ramune-storage.js"></script>
<!-- 2) 以降は任意の順でOK -->
<script src="https://ramune-ai.github.io/common-lib/ramune-sound.js"></script>
<script src="https://ramune-ai.github.io/common-lib/ramune-ui.js"></script>
<script src="https://ramune-ai.github.io/common-lib/ramune-titles.js"></script>
```

読み込んだら、まずゲーム名で storage を初期化します。
これで以後の localStorage キーが `ゲーム名-xxx` に揃います。

```js
RAMUNE.storage.init('madori');   // → キーは 'madori-xxx'
```

---

## ramune-storage.js

localStorage の安全ラッパー。失敗しても例外を投げません。

| API | 説明 |
|---|---|
| `RAMUNE.storage.init(prefix)` | 以後のキーに `prefix-` を付ける。例: `init('madori')` |
| `RAMUNE.storage.get(key, fallback)` | 文字列取得。未存在／失敗時は fallback（省略時 null） |
| `RAMUNE.storage.set(key, value)` | 文字列保存。成功で true |
| `RAMUNE.storage.getJSON(key, fallback)` | JSON取得。壊れていても fallback |
| `RAMUNE.storage.setJSON(key, obj)` | JSON保存。成功で true |
| `RAMUNE.storage.getNum(key, fallback)` | 数値取得。NaN／未存在なら fallback |
| `RAMUNE.storage.remove(key)` | 削除 |

```js
RAMUNE.storage.init('madori');
RAMUNE.storage.set('player-name', 'あい');       // → 'madori-player-name'
const name = RAMUNE.storage.get('player-name', '');
const list = RAMUNE.storage.getJSON('titles', []);
```

---

## ramune-sound.js

SE / BGM 再生と音量管理。WebAudio 先読み・多重再生防止・自動再生制限対策は
元コードのまま保持しています。

### 初期化

```js
RAMUNE.sound.init({
  dir: 'SE.BGM/',                 // 音源フォルダ
  se: {                          // 使う音だけ書けばOK（元の SOUND オブジェクト形式）
    grab:'grab.mp3', place:'place.mp3', rotate:'rotate.mp3', tap:'tap.mp3',
    spin:'spin.mp3', /* ... */
  },
  bgm: 'カスタードクリームクッキーサンド.mp3',
  defaultSeVol: 0.7,             // 保存値が無いときの初期値
  defaultBgmVol: 0.4,
});
```

`init` の中で「最初の pointerdown で BGM 開始＋全SE先読み」を自動登録します。

### API

| API | 説明 |
|---|---|
| `RAMUNE.sound.playSE(name)` | SEを1回鳴らす |
| `RAMUNE.sound.startLoopSE(name)` | ループ系SE開始（多重再生防止つき） |
| `RAMUNE.sound.stopLoopSE()` | ループ系SE停止 |
| `RAMUNE.sound.startSpinSE()` | 旧API互換。`startLoopSE('spin')` と同じ |
| `RAMUNE.sound.stopSpinSE()` | 旧API互換。`stopLoopSE()` と同じ |
| `RAMUNE.sound.startBGM()` | BGM開始 |
| `RAMUNE.sound.stopBGM()` | BGM停止 |
| `RAMUNE.sound.setSeVol(v)` | SE音量を設定（0〜1）＋保存 |
| `RAMUNE.sound.setBgmVol(v)` | BGM音量を設定（0〜1）＋保存 |
| `RAMUNE.sound.getSeVol()` | 現在のSE音量 |
| `RAMUNE.sound.getBgmVol()` | 現在のBGM音量 |

音量は storage 経由で `se-vol` / `bgm-vol` に保存されます
（`init('madori')` なら実キーは `madori-se-vol` / `madori-bgm-vol`）。

---

## ramune-ui.js

ゲーム風トースト・確認ダイアログ・画面切替。
**必要なCSSとDOMは初回呼び出し時にJSが自動注入**するので、HTML側に
トーストやダイアログの記述は不要です。

| API | 説明 |
|---|---|
| `RAMUNE.ui.toast(msg, options)` | トースト表示。`options.duration`(ms) で表示時間変更可（既定2400） |
| `RAMUNE.ui.confirm(msg, ok, cancel)` | 確認ダイアログ。**Promise&lt;boolean&gt; を返す**（OKでtrue） |
| `RAMUNE.ui.alert(msg)` | OKのみのお知らせ。Promise を返す |
| `RAMUNE.ui.showScreen(id)` | `.screen` の `.active` を切り替え＋スクロール位置リセット |

`confirm` は元コードと同じ **Promise 型**です。ラベルもコールバックも使えます。

```js
// Promise 型（元コード踏襲）
const ok = await RAMUNE.ui.confirm('削除しますか？', '削除する', 'やめる');
if(ok){ /* ... */ }

// コールバック型でも書ける（第2/第3引数に関数を渡す）
RAMUNE.ui.confirm('削除しますか？', ()=>doDelete(), ()=>{});
```

色を上書きしたいときは CSS 変数で。未指定なら元の色で表示されます。

```css
:root{
  --ramune-toast-bg: rgba(58,42,26,.94);
  --ramune-dialog-bg: #f5f0e8;
  --ramune-dialog-accent: #3a2a1a;
}
```

> **移行時の注意**：`showScreen` は汎用の画面切替のみです。
> 間取りすと固有の bottom-bar / top-bar の表示制御と紙吹雪(`fireConfetti`)は
> **ゲーム側に残します**（このライブラリには含めていません）。
> P2 でゲーム側に薄いラッパーを置いてください。例：
> ```js
> function showScreen(id){
>   RAMUNE.ui.showScreen(id);
>   const bar=document.getElementById('game-bottom-bar');
>   const top=document.getElementById('game-top-bar');
>   const on=(id==='screen-game');
>   bar.classList.toggle('active',on);
>   if(top) top.classList.toggle('active',on);
> }
> ```

---

## ramune-titles.js

称号システムの「枠組み」だけ（獲得判定・所持/既読管理・クリーニング）。
称号マスターデータと一覧グリッドの描画はゲーム固有なので**含みません**。
マスターはゲーム側が `init` で渡します。

### 初期化

```js
RAMUNE.titles.init({
  master: ALL_TITLES_MASTER,   // 称号マスター配列
  storageKey: 'titles',        // 所持リスト保存キー → 'madori-titles'
  seenKey: 'titles-seen',      // 既読キー         → 'madori-titles-seen'
  idKey: 'title',              // ★識別子フィールド（下の互換メモ参照）
  condKey: 'check',           // ★判定関数フィールド
});
```

`init` の中で「マスターに存在しない古い称号id」を所持リストから自動除去します
（改定前の旧称号の掃除。元コード踏襲）。

### API

| API | 説明 |
|---|---|
| `RAMUNE.titles.init(cfg)` | 初期化＋所持リストのクリーニング |
| `RAMUNE.titles.check(context)` | 各条件に context を渡し、**新規獲得したマスター項目の配列**を返す＋保存 |
| `RAMUNE.titles.getOwned()` | 所持id配列 |
| `RAMUNE.titles.isOwned(id)` | 所持しているか |
| `RAMUNE.titles.markSeen(id)` | 既読にする（id は単体でも配列でもOK） |
| `RAMUNE.titles.getUnseen()` | 所持かつ未読のid配列（NEW!表示用） |

```js
const newly = RAMUNE.titles.check({age:0, walk:3, rent:80, n:{...}, st:12, cc:5});
// newly = 今回はじめて獲得したマスター項目の配列
```

> **rar順ソートや「1件も無いときのフォールバック称号（駆け出しマドリスト）」は
> 間取りすと固有のため含めていません。** 必要なら `check` の戻り値をゲーム側で加工してください。

---

## 間取りすと 移行対応表（旧 → 新）

| 旧（puzzle_252.html 内） | 新（common-lib） |
|---|---|
| `localStorage.getItem/setItem(...)` の各所 | `RAMUNE.storage.get/set/getJSON/setJSON/getNum/remove` |
| `playSE('tap')` | `RAMUNE.sound.playSE('tap')` |
| `startSpinSE()` / `stopSpinSE()` | `RAMUNE.sound.startLoopSE('spin')` / `stopLoopSE()`（旧名の互換あり） |
| `startBGM()` | `RAMUNE.sound.startBGM()` |
| （`setBgmVol` 内のBGM停止処理） | `RAMUNE.sound.stopBGM()` |
| `setSeVol(v)` / `setBgmVol(v)` | `RAMUNE.sound.setSeVol(v)` / `setBgmVol(v)` |
| `seVol` / `bgmVol`（直接参照） | `RAMUNE.sound.getSeVol()` / `getBgmVol()` |
| `showGameToast(msg)` | `RAMUNE.ui.toast(msg)` |
| `showGameConfirm(msg,ok,cancel)` | `RAMUNE.ui.confirm(msg,ok,cancel)`（同じくPromise型） |
| `showGameAlert(msg)` | `RAMUNE.ui.alert(msg)` |
| `showScreen(id)` | `RAMUNE.ui.showScreen(id)` ＋ ゲーム側にbar制御ラッパー |
| 称号 所持/既読の localStorage 読み書き | `RAMUNE.titles.getOwned/isOwned/markSeen/getUnseen` |
| `generateTitles(...)` の獲得判定＋保存 | `RAMUNE.titles.check(context)` |
| 所持リストのクリーニング処理 | `RAMUNE.titles.init(...)` が自動で実施 |

### ゲーム側に残すもの（ライブラリに入れていない）

- 音量設定モーダル `openSoundSettings` / `closeSoundSettings`
- ボタン共通タップ音の click ハンドラ（固有セレクタに依存）
- 紙吹雪 `fireConfetti`、`showScreen` の bottom-bar/top-bar 制御
- 称号マスターデータの中身、一覧グリッドのDOM描画、rar順ソート、空時フォールバック
- 物件ガチャ・ルーレット・結果画面・画像シェア・Phaser本体

---

## ★ 既存プレイヤーのデータ互換について（最重要）

**localStorage のキー名が 1 文字でも変わると、既存プレイヤーの称号・セーブが
消えたように見えます。** 間取りすとの既存データはこうなっています：

- 音量：`madori-se-vol` / `madori-bgm-vol`
- 称号(所持)：`madori-titles`（**称号名の文字列**の配列で保存）
- 称号(既読)：`madori-titles-seen`

このライブラリは `storage.init('madori')` 前提で、これらの実キーに完全一致します。
称号については、既存データが「称号名の文字列」で入っているため、
`titles.init` で **`idKey:'title'`** を指定して、マスターの `title` を識別子として使ってください
（そうしないと `check` / クリーニングが既存所持を別物とみなし、掃除で消えます）。
`check` は元コード同様、新規称号を配列の先頭に追加（unshift）します。
