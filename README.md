# PBPM タスク管理（OmniStep）

ブラウザだけで動く静的ファイル構成です（`OmniStep.html` が本体）。GitHub に置くと **GitHub Pages** で URL から開けます。

---

## 事前に用意するもの

1. **GitHub アカウント**（無料で可）  
   https://github.com/join  
2. **Git**（パソコンに未インストールの場合）  
   https://git-scm.com/download/win  
   インストール後、一度ターミナル（PowerShell）を開き直し、`git --version` と打ってバージョンが表示されれば OK です。

---

## 手順 1 — GitHub 上で空のリポジトリを作る

1. GitHub にログインする。  
2. 右上の **「+」→ New repository**。  
3. **Repository name** に例: `pbpm-task-manager`（英数字とハイフン推奨）。  
4. **Public** を選ぶ（無料の GitHub Pages で一般公開する場合）。  
5. 「Add a README」などは**付けず**空で作成して **Create repository**。

作成後、画面上に表示される **HTTPS の URL**（例: `https://github.com/あなたのユーザー名/pbpm-task-manager.git`）をメモしておきます。

---

## 手順 2 — このフォルダで Git を初期化する

**PowerShell** を開き、プロジェクトのフォルダへ移動します（パスは環境に合わせてください）。

```powershell
cd "c:\Users\fd3sr\OneDrive\デスクトップ\タスク管理ツール20260429CLver"
```

初回だけ、ユーザー名とメールを設定します（GitHub に登録したメールで可）。

```powershell
git config --global user.name "あなたの名前"
git config --global user.email "you@example.com"
```

リポジトリを初期化します。

```powershell
git init
git branch -M main
git add .
git commit -m "Initial commit: PBPM task manager for GitHub Pages"
```

---

## 手順 3 — GitHub に接続して push する

`YOUR_USER` と `YOUR_REPO` を、手順 1 で作ったユーザー名とリポジトリ名に置き換えて実行します。

```powershell
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
git push -u origin main
```

初回は GitHub のログイン（ブラウザまたは Personal Access Token）を求められることがあります。  
**Personal Access Token** の作り方: GitHub → Settings → Developer settings → Personal access tokens（Classic）で `repo` にチェックして生成し、パスワードの代わりに貼り付けます。

---

## 手順 4 — GitHub Pages を有効にする

1. GitHub 上でそのリポジトリを開く。  
2. **Settings**（設定）タブ。  
3. 左メニュー **Pages**。  
4. **Build and deployment** の **Source** で **Deploy from a branch** を選ぶ。  
5. **Branch** を **main**、フォルダを **/ (root)** にして **Save**。

数十秒〜数分待つと、同じ Pages 画面に **Your site is live at `https://YOUR_USER.github.io/YOUR_REPO/`** のような URL が表示されます。

- トップの `index.html` が **すぐ `OmniStep.html` にリダイレクト**するので、最終的にはアプリ本体が開きます。  
- 直接 `https://YOUR_USER.github.io/YOUR_REPO/OmniStep.html` を開いても動作します。

---

## 手順 5 — 更新を反映するとき

ファイルを直したあと、同じフォルダで:

```powershell
git add .
git commit -m "変更内容の短い説明"
git push
```

数分以内にサイト側も更新されます（キャッシュで古い表示のときは Ctrl+F5 で再読み込み）。

---

## 同梱ファイルの説明

| ファイル | 説明 |
|----------|------|
| `OmniStep.html` | アプリ本体の HTML |
| `OmniStep.js` / `OmniStep.css` | ロジック・スタイル |
| `index.html` | Pages のトップ用。`OmniStep.html` へリダイレクト |
| `.nojekyll` | Jekyll を無効化（将来 `_` で始まるファイルを置いても壊れにくい） |
| `.gitignore` | 不要なファイルを push 対象から外す |
| `OShtml.txt` など | バックアップ用。**`.gitignore` で `*.txt` として除外**（ローカルには残る） |

---

## すでに push したあとで、`.txt` や `制作工程.csv` をリポジトリから外す

**一度コミット／push に含めてしまった場合**、次のように **Git の管理対象からだけ外します**（フォルダ内の実ファイルは消えません）。

プロジェクトのフォルダで PowerShell を開き、**1行ずつ**実行します。

```powershell
cd "c:\Users\fd3sr\OneDrive\デスクトップ\タスク管理ツール20260429CLver"
```

```powershell
git rm --cached OShtml.txt OSjs.txt OScss.txt
```

```powershell
git rm --cached "制作工程.csv"
```

（他にも `.txt` を追加していた場合は、ファイル名を足すか、`git rm --cached *.txt` でまとめて外せます。）

そのあとコミットして push します。

```powershell
git add .gitignore
git commit -m "Remove backup txt and CSV from repo; update gitignore"
git push
```

これで **GitHub 上の最新のツリーからは消えます**。  
**まだ一度も push していない**場合は、`.gitignore` に書いてあるだけで次回の `git add` から自動的に除外されるので、`git rm --cached` は不要です。

---

## 注意（セキュリティ・運用）

- **無料の公開リポジトリ**は、誰でもコードと履歴を見られます。社外秘のメモや CSV を同梱しないでください。  
- データは基本的に **ブラウザの localStorage** にあります。GitHub に上がるのは **HTML/JS/CSS などのソースだけ**です。  
- **プライベートリポジトリ + Pages** は GitHub の有料プランが必要です。無料で非公開にしたい場合は、別ホスト（例: 社内サーバーや有料の静的ホスティング）を検討してください。

---

## トラブルシュート

| 現象 | 確認すること |
|------|----------------|
| `git` が認識されない | Git for Windows をインストールし、ターミナルを開き直す |
| push が拒否される | リポジトリ URL・権限（Token）・ブランチ名 `main` |
| Pages が 404 | Settings → Pages で Branch が `main` / `(root)` か、数分待ってから再アクセス |
| 画面は出るが動かない | ブラウザの開発者ツール（F12）の Console にエラーがないか確認 |
