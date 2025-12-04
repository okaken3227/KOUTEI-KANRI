# ドメイン取得からデプロイまでの完全ガイド

## 📋 全体の流れ

1. ✅ GitHubへのアップロード（完了）
2. 🌐 お名前.comでドメイン取得
3. 🖥️ ConoHa VPSの契約
4. 🔧 サーバーのセットアップ
5. 🚀 アプリのデプロイ
6. 🔒 SSL証明書の取得

---

## 🌐 ステップ1: お名前.comでドメイン取得

### 推奨ドメイン名

- `koutei-kanri.com`
- `koutei-kanri.net`
- `koutei-manager.com`
- `noukamap.com`

### 取得手順

1. **お名前.comにアクセス**
   - https://www.onamae.com/

2. **ドメイン検索**
   - トップページの検索ボックスに希望のドメイン名を入力
   - 例: `koutei-kanri`
   - 「検索」をクリック

3. **ドメインを選択**
   - 利用可能なドメインが表示される
   - `.com` または `.net` を選択（推奨）
   - 価格: 初年度 約1円〜1,500円、2年目以降 約1,400円/年

4. **カートに追加して購入**
   - 「お申込みへ進む」をクリック
   - オプションは基本的に不要（Whois情報公開代行は有効にする）
   - 支払い方法を選択して決済

5. **購入完了**
   - ドメインが取得できたらメモする
   - 例: `koutei-kanri.com`

⏱️ **所要時間: 約5〜10分**

---

## 🖥️ ステップ2: ConoHa VPSの契約

### 推奨プラン

- **メモリ**: 2GB（月額 約1,000円）
- **ディスク**: 100GB SSD
- **リージョン**: 東京

### 契約手順

1. **ConoHa VPSにアクセス**
   - https://www.conoha.jp/vps/

2. **アカウント作成**
   - 「今すぐお申し込み」をクリック
   - メールアドレス・パスワードを設定

3. **プラン選択**
   - リージョン: **東京**
   - プラン: **2GB**（推奨） または 1GB
   - イメージタイプ: **アプリケーション** → **Ubuntu 22.04**
   - root パスワード: **強固なパスワードを設定**（必ずメモ！）

4. **支払い情報入力**
   - クレジットカード情報を入力

5. **申し込み完了**
   - サーバーが作成される（2〜3分）
   - **IPアドレス**をメモ
   - 例: `123.456.789.012`

⏱️ **所要時間: 約10分**

---

## 🔌 ステップ3: ドメインとサーバーを接続

### お名前.comのDNS設定

1. **お名前.comにログイン**
   - https://www.onamae.com/

2. **ドメイン設定画面を開く**
   - 「ドメイン設定」→ 「DNS設定」

3. **DNSレコード設定**
   - 「DNSレコード設定を利用する」を選択
   - 取得したドメインを選択
   - 「次へ」

4. **Aレコードを追加**

   **レコード1:**
   ```
   ホスト名: (空欄または@)
   TYPE: A
   VALUE: [ConoHa VPSのIPアドレス]
   TTL: 3600
   ```

   **レコード2:**
   ```
   ホスト名: www
   TYPE: A
   VALUE: [ConoHa VPSのIPアドレス]
   TTL: 3600
   ```

5. **設定を保存**

⚠️ **注意**: DNS設定の反映には30分〜2時間かかります

⏱️ **所要時間: 約5分**

---

## 🔧 ステップ4: サーバーの初期セットアップ

### 4-1. サーバーに接続

PowerShellを開いて以下を実行:

```powershell
ssh root@[ConoHa VPSのIPアドレス]
```

パスワードを聞かれたら、ConoHaで設定したrootパスワードを入力。

### 4-2. システムのアップデート

```bash
apt update && apt upgrade -y
```

### 4-3. 必要なソフトウェアのインストール

```bash
# 基本ツール
apt install -y curl wget git vim ufw

# Dockerのインストール
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Docker Composeのインストール
apt install -y docker-compose-plugin

# Dockerの起動と自動起動設定
systemctl start docker
systemctl enable docker

# 確認
docker --version
docker compose version
```

### 4-4. ファイアウォール設定

```bash
# SSH、HTTP、HTTPSを許可
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp

# ファイアウォールを有効化
ufw enable
# 「y」と入力してEnter

# 確認
ufw status
```

⏱️ **所要時間: 約10分**

---

## 🚀 ステップ5: アプリケーションのデプロイ

### 5-1. コードを取得

```bash
cd ~
git clone https://github.com/okaken3227/KOUTEI-KANRI.git
cd KOUTEI-KANRI
```

### 5-2. 環境変数ファイルを作成

```bash
# サンプルをコピー
cp env.production.example .env.production

# JWT Secretを生成
openssl rand -base64 32
```

**生成された文字列をコピーしてメモ**（例: `abc123XYZ...`）

```bash
# 環境変数ファイルを編集
nano .env.production
```

以下のように編集:

```env
# データベース設定
POSTGRES_USER=nouka_user
POSTGRES_PASSWORD=MySecurePass123!  # ← 強固なパスワードに変更

POSTGRES_DB=nouka_map

# JWT Secret
JWT_SECRET=abc123XYZ...  # ← 先ほど生成した文字列をペースト

# バックエンドAPI URL
VITE_API_URL=https://koutei-kanri.com/api  # ← あなたのドメインに変更
```

**保存方法**: `Ctrl + O` → `Enter` → `Ctrl + X`

### 5-3. Nginx設定を編集

```bash
nano nginx/conf.d/default.conf
```

`YOUR_DOMAIN.com` をすべて自分のドメインに置き換える:

例: `koutei-kanri.com` の場合
- `server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;`
  → `server_name koutei-kanri.com www.koutei-kanri.com;`

**保存**: `Ctrl + O` → `Enter` → `Ctrl + X`

### 5-4. フロントエンドをビルド

```bash
# 実行権限を付与
chmod +x build-frontend.sh

# 環境変数を読み込む
export $(cat .env.production | grep -v '^#' | xargs)

# ビルド実行
./build-frontend.sh
```

### 5-5. アプリケーションを起動

```bash
# Dockerイメージをビルド
docker compose -f docker-compose.prod.yml build

# コンテナを起動
docker compose -f docker-compose.prod.yml up -d

# 状態確認
docker compose -f docker-compose.prod.yml ps
```

すべてが「Up」になっていればOK！

### 5-6. ログ確認

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs

# リアルタイムでログを表示
docker compose -f docker-compose.prod.yml logs -f
# (Ctrl+C で終了)
```

⏱️ **所要時間: 約15分**

---

## 🌍 ステップ6: HTTPで動作確認

ブラウザで以下にアクセス:

```
http://koutei-kanri.com
```

（あなたのドメインに置き換え）

アプリが表示されればOK！🎉

⚠️ **注意**: この時点ではHTTPのみで、まだHTTPSではありません

---

## 🔒 ステップ7: SSL証明書の取得（HTTPS化）

### 7-1. DNS設定の確認

まず、ドメインが正しく設定されているか確認:

```bash
# サーバー上で実行
nslookup koutei-kanri.com
```

ConoHa VPSのIPアドレスが表示されればOK

### 7-2. SSL証明書取得スクリプトを実行

```bash
# 実行権限を付与
chmod +x init-letsencrypt.sh

# スクリプトを実行
./init-letsencrypt.sh
```

プロンプトに従って入力:
- **ドメイン名**: `koutei-kanri.com`（あなたのドメイン）
- **メールアドレス**: あなたのメールアドレス
- **テスト環境で実行**: `n`（本番環境）

### 7-3. HTTPS設定を有効化

証明書取得後、Nginx設定を更新:

```bash
nano nginx/conf.d/default.conf
```

以下の変更を行う:

1. **HTTPSサーバーブロックのコメントを解除**
   - `# server {` から最後の `# }` まで
   - すべての行の先頭の `#` を削除

2. **HTTPリダイレクトを有効化**
   - HTTPサーバーブロック内の以下のコメントを解除:
   ```nginx
   # location / {
   #     return 301 https://$server_name$request_uri;
   # }
   ```
   ↓
   ```nginx
   location / {
       return 301 https://$server_name$request_uri;
   }
   ```

3. **HTTPサーバーブロックの一時的なフロントエンド表示を削除/コメントアウト**
   ```nginx
   # 以下の部分を削除またはコメントアウト
   # location / {
   #     root /usr/share/nginx/html;
   #     try_files $uri $uri/ /index.html;
   # }
   ```

**保存**: `Ctrl + O` → `Enter` → `Ctrl + X`

### 7-4. Nginxを再起動

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

⏱️ **所要時間: 約5分**

---

## 🎉 完了！

ブラウザで以下にアクセス:

```
https://koutei-kanri.com
```

🔒 鍵マークが表示されていればHTTPS化成功です！

---

## 📊 今後の更新方法

コードを変更してGitHubにプッシュした後:

```bash
# サーバーにSSH接続
ssh root@[IPアドレス]

# プロジェクトディレクトリに移動
cd ~/KOUTEI-KANRI

# デプロイスクリプトを実行
./deploy.sh
```

---

## 💰 月額費用

| 項目 | 費用 |
|------|------|
| ConoHa VPS (2GB) | 約1,000円 |
| ドメイン (.com) | 約117円（年1,400円÷12） |
| **合計** | **約1,117円/月** |

---

## 🆘 トラブルシューティング

### サイトにアクセスできない

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs

# コンテナの状態確認
docker compose -f docker-compose.prod.yml ps

# ファイアウォール確認
ufw status
```

### SSL証明書取得に失敗

- DNS設定を確認（nslookupで確認）
- ポート80と443が開いているか確認
- 10〜20分待ってから再試行

### データベース接続エラー

```bash
# データベースログ確認
docker compose -f docker-compose.prod.yml logs db

# 環境変数を確認
cat .env.production
```

---

## ✅ チェックリスト

デプロイ前:
- [ ] GitHubにコードをプッシュ済み
- [ ] お名前.comでドメインを取得
- [ ] ConoHa VPSを契約
- [ ] DNS設定を完了

デプロイ後:
- [ ] HTTPでアクセスできる
- [ ] HTTPSでアクセスできる
- [ ] ユーザー登録・ログインが動作
- [ ] 田んぼ登録が動作
- [ ] 作業記録が保存される

---

頑張ってください！🌾✨

