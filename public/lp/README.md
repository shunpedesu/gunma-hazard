# グンマハザード LP — 公開用ファイル一式

群馬ホラーコメディ・ブラウザゲーム「グンマハザード」のランディングページ（静的サイト）です。
このフォルダの中身をそのまま Web サーバー（GitHub Pages 等）に置けば公開できます。

## ファイル構成

```
publish/
├── index.html        ← LP本体（このファイルがトップページ）
├── support.js        ← 描画ランタイム（index.html が読み込む。必須）
├── image-slot.js     ← 画像枠コンポーネント（必須）
└── assets/
    ├── shot-title.jpg     ゲーム画面：タイトル
    ├── shot-entrance.jpg  ゲーム画面：玄関ホール
    ├── shot-key.jpg       ゲーム画面：鍵入手
    └── shot-quiz.jpg      ゲーム画面：群馬クイズ
```

- フォント（Yuji Syuku / Shippori Mincho B1 / Zen Kaku Gothic New / DotGothic16）は
  Google Fonts の CDN を参照しています。オンライン公開なので追加ファイルは不要です。
- 外部リンク先：
  - ゲーム本体: https://shunpedesu.github.io/gunma-hazard/
  - X（シェア投稿）/ note（https://note.com/shunpedesu）
- OGP 画像は `https://shunpedesu.github.io/gunma-hazard/ogp.png` を参照しています。

## ローカル確認

`file://` で直接開くとブラウザのセキュリティ制限でうまく動かない場合があります。
簡易サーバーで確認してください。

```bash
cd publish
python3 -m http.server 8000
# → http://localhost:8000 を開く
```

## GitHub Pages で公開する手順（例）

### A. 既存のゲームリポジトリ（gunma-hazard）の中に LP ページとして置く場合

例：LP を `https://shunpedesu.github.io/gunma-hazard/lp/` で公開する。

```bash
# リポジトリのルートで
mkdir -p lp
cp -r /path/to/publish/* lp/
git add lp
git commit -m "Add landing page"
git push
```

公開URL: `https://shunpedesu.github.io/gunma-hazard/lp/`

### B. LP 専用の新しいリポジトリを作って公開する場合

1. GitHub で新規リポジトリ（例: `gunma-hazard-lp`）を作成
2. このフォルダの中身をルートに置いて push

```bash
git init
git add .
git commit -m "Initial commit: グンマハザード LP"
git branch -M main
git remote add origin https://github.com/shunpedesu/gunma-hazard-lp.git
git push -u origin main
```

3. リポジトリの **Settings → Pages** で
   - Source: `Deploy from a branch`
   - Branch: `main` / `/ (root)`
   を選んで保存

公開URL: `https://shunpedesu.github.io/gunma-hazard-lp/`

## 注意

- `index.html` / `support.js` / `image-slot.js` / `assets/` は**同じ階層関係のまま**置いてください
  （index.html が `./support.js` と `assets/...` を相対参照しています）。
- 公開後、OGP のプレビューが古い場合は X / Facebook のキャッシュをクリアしてください。
