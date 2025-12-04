# ConoHa VPS デプロイガイド - 工程管理くん

初めての方でも安心！ConoHa VPSでアプリを公開する完全ガイドです。

## 📋 目次

1. [事前準備](#事前準備)
2. [ConoHa VPSの契約とセットアップ](#conoha-vpsの契約とセットアップ)
3. [ドメインの設定](#ドメインの設定)
4. [サーバーの初期設定](#サーバーの初期設定)
5. [アプリケーションのデプロイ](#アプリケーションのデプロイ)
6. [SSL証明書の取得](#ssl証明書の取得)
7. [動作確認](#動作確認)
8. [メンテナンス](#メンテナンス)

---

## 事前準備

### 必要なもの

- [ ] ConoHaアカウント（https://www.conoha.jp/ で作成）
- [ ] クレジットカードまたは銀行口座
- [ ] ドメイン名（独自ドメイン）
  - お名前.com、ムームードメインなどで取得
  - 費用: 年間1,000円〜
- [ ] SSH接続用のクライアント
  - Windows: PowerShell（標準搭載）
  - Mac/Linux: ターミナル（標準搭載）

### 推奨スペック

**ConoHa VPS**
- メモリ: 2GB以上（1GBでも可）
- ディスク: 100GB SSD
- 費用: 月額 約1,000円〜

---

## ConoHa VPSの契約とセットアップ

### ステップ1: ConoHa VPSの申し込み

1. https://www.conoha.jp/vps/ にアクセス
2. 「今すぐお申し込み」をクリック
3. プランを選択:
   - **メモリ**: 2GB（推奨）または1GB
   - **OS**: Ubuntu 22.04
   - **リージョン**: 東京
   - **rootパスワード**: 強固なパスワードを設定（メモ必須！）

4. 支払い情報を入力して申し込み完了

### ステップ2: サーバー情報の確認

申し込み完了後、以下の情報を確認・メモ:

- **IPアドレス**: 例) 123.456.789.012
- **rootパスワード**: 設定したパスワード

---

## ドメインの設定

### ステップ1: ドメインのDNS設定

1. ドメイン管理画面（お名前.comなど）にログイン
2. DNS設定画面を開く
3. 以下のAレコードを追加:

```
タイプ: A
ホスト名: @
値: [ConoHa VPSのIPアドレス]
TTL: 3600

タイプ: A
ホスト名: www
値: [ConoHa VPSのIPアドレス]
TTL: 3600
```

4. 設定を保存

⚠️ **注意**: DNS設定の反映には最大48時間かかる場合があります（通常は1〜2時間）

---

## サーバーの初期設定

### ステップ1: サーバーにSSH接続

PowerShellまたはターミナルを開いて、以下のコマンドを実行:

```bash
ssh root@[あなたのIPアドレス]
```

パスワードを聞かれたら、ConoHaで設定したrootパスワードを入力。

### ステップ2: システムのアップデート

```bash
# パッケージリストを更新
apt update

# すべてのパッケージをアップグレード
apt upgrade -y
```

### ステップ3: 必要なソフトウェアのインストール

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

# インストール確認
docker --version
docker compose version
```

### ステップ4: ファイアウォールの設定

```bash
# SSH（22番ポート）を許可
ufw allow 22/tcp

# HTTP（80番ポート）を許可
ufw allow 80/tcp

# HTTPS（443番ポート）を許可
ufw allow 443/tcp

# ファイアウォールを有効化
ufw enable

# 設定確認
ufw status
```

### ステップ5: 作業用ユーザーの作成（推奨）

```bash
# ユーザーを作成
adduser deploy

# sudoグループに追加
usermod -aG sudo deploy
usermod -aG docker deploy

# deployユーザーに切り替え
su - deploy
```

---

## アプリケーションのデプロイ

### ステップ1: GitHubからコードを取得

```bash
# ホームディレクトリに移動
cd ~

# リポジトリをクローン
git clone https://github.com/okaken3227/KOUTEI-KANRI.git
cd KOUTEI-KANRI
```

### ステップ2: 環境変数ファイルの作成

```bash
# サンプルファイルをコピー
cp env.production.example .env.production

# 環境変数ファイルを編集
nano .env.production
```

以下のように編集（nanoエディタの操作: Ctrl+O で保存、Ctrl+X で終了）:

```env
# データベース設定
POSTGRES_USER=nouka_user
POSTGRES_PASSWORD=your_secure_password_123  # ← 強固なパスワードに変更
POSTGRES_DB=nouka_map

# JWT Secret（以下のコマンドで生成: openssl rand -base64 32）
JWT_SECRET=your_generated_jwt_secret_key_here  # ← ランダムな文字列に変更

# バックエンドAPI URL（あなたのドメインに変更）
VITE_API_URL=https://your-domain.com/api  # ← あなたのドメインに変更
```

**JWT Secretの生成方法:**
```bash
openssl rand -base64 32
```
この出力をコピーして `JWT_SECRET` に設定してください。

### ステップ3: Nginx設定ファイルの編集

```bash
# Nginx設定ファイルを編集
nano nginx/conf.d/default.conf
```

`YOUR_DOMAIN.com` をすべてあなたのドメインに置換してください。

例: `example.com` の場合
- `server_name YOUR_DOMAIN.com www.YOUR_DOMAIN.com;`
  → `server_name example.com www.example.com;`

### ステップ4: アプリケーションのビルドと起動

```bash
# 環境変数を読み込む
export $(cat .env.production | grep -v '^#' | xargs)

# Dockerイメージをビルド
docker compose -f docker-compose.prod.yml build

# コンテナを起動
docker compose -f docker-compose.prod.yml up -d

# 起動状態を確認
docker compose -f docker-compose.prod.yml ps
```

すべてのサービスが `Up` 状態になっていればOK！

### ステップ5: ログの確認

```bash
# すべてのログを表示
docker compose -f docker-compose.prod.yml logs

# 特定のサービスのログを表示
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs frontend
docker compose -f docker-compose.prod.yml logs nginx

# リアルタイムでログを表示
docker compose -f docker-compose.prod.yml logs -f
```

---

## SSL証明書の取得

HTTPSでアクセスできるようにSSL証明書を取得します（無料）。

### ステップ1: DNS設定の確認

まず、ドメインが正しくサーバーを指しているか確認:

```bash
# 別のPCまたはスマホで確認
nslookup your-domain.com
```

IPアドレスがConoHa VPSのIPと一致していればOK！

### ステップ2: SSL証明書の取得

```bash
# スクリプトに実行権限を付与
chmod +x init-letsencrypt.sh

# スクリプトを実行
./init-letsencrypt.sh
```

プロンプトに従って入力:
- **ドメイン名**: your-domain.com
- **メールアドレス**: your-email@example.com
- **テスト環境で実行**: n（本番環境）

### ステップ3: Nginx設定の更新

証明書取得後、HTTPS設定を有効化:

```bash
nano nginx/conf.d/default.conf
```

以下の変更を行う:

1. **HTTPSサーバーブロックのコメントを解除**
   - `# server {` の`#`を削除
   - `# }` までのすべての`#`を削除

2. **HTTPリダイレクトを有効化**
   - HTTPサーバーブロックの中で:
   ```nginx
   # location / {
   #     return 301 https://$server_name$request_uri;
   # }
   ```
   のコメントを解除

3. HTTPサーバーブロックの一時的なフロントエンド表示部分を削除またはコメントアウト

### ステップ4: Nginxを再起動

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

---

## 動作確認

### ステップ1: HTTPSでアクセス

ブラウザで以下のURLにアクセス:

```
https://your-domain.com
```

🎉 アプリケーションが表示されれば成功です！

### ステップ2: 機能テスト

1. ユーザー登録
2. ログイン
3. 田んぼの登録
4. 作業記録の追加

すべて正常に動作すればデプロイ完了です！

---

## メンテナンス

### アプリケーションの更新

コードを変更してGitHubにプッシュした後:

```bash
# サーバーにSSH接続
ssh deploy@[あなたのIPアドレス]

# プロジェクトディレクトリに移動
cd ~/KOUTEI-KANRI

# デプロイスクリプトを実行
chmod +x deploy.sh
./deploy.sh
```

### ログの確認

```bash
# すべてのログを表示
docker compose -f docker-compose.prod.yml logs

# 特定期間のログを表示（過去1時間）
docker compose -f docker-compose.prod.yml logs --since 1h

# リアルタイムでログを監視
docker compose -f docker-compose.prod.yml logs -f
```

### データベースのバックアップ

```bash
# バックアップディレクトリを作成
mkdir -p ~/backups

# データベースをバックアップ
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U nouka_user nouka_map > ~/backups/backup_$(date +%Y%m%d_%H%M%S).sql
```

### データベースのリストア

```bash
# バックアップファイルからリストア
cat ~/backups/backup_YYYYMMDD_HHMMSS.sql | docker compose -f docker-compose.prod.yml exec -T db psql -U nouka_user nouka_map
```

### SSL証明書の自動更新

Certbotコンテナが12時間ごとに証明書の更新をチェックします。
特に手動での操作は不要ですが、手動で更新する場合:

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

### コンテナの再起動

```bash
# すべてのコンテナを再起動
docker compose -f docker-compose.prod.yml restart

# 特定のコンテナのみ再起動
docker compose -f docker-compose.prod.yml restart backend
docker compose -f docker-compose.prod.yml restart frontend
docker compose -f docker-compose.prod.yml restart nginx
```

### ディスク使用量の確認

```bash
# ディスク使用量を確認
df -h

# Dockerが使用している容量を確認
docker system df
```

### 不要なDockerイメージの削除

```bash
# 使用していないイメージを削除
docker system prune -a

# 使用していないボリュームも含めて削除
docker system prune -a --volumes
```

---

## トラブルシューティング

### コンテナが起動しない

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs

# 特定のコンテナのログを詳しく見る
docker compose -f docker-compose.prod.yml logs backend --tail=100
```

### データベースに接続できない

```bash
# データベースコンテナの状態を確認
docker compose -f docker-compose.prod.yml ps db

# データベースコンテナの中に入って確認
docker compose -f docker-compose.prod.yml exec db psql -U nouka_user nouka_map
```

### Nginxが起動しない

```bash
# Nginx設定ファイルの文法チェック
docker compose -f docker-compose.prod.yml exec nginx nginx -t

# 設定ファイルを確認
docker compose -f docker-compose.prod.yml exec nginx cat /etc/nginx/conf.d/default.conf
```

### SSL証明書の取得に失敗

- ドメインのDNS設定を確認
- ポート80と443が開いているか確認: `ufw status`
- Let's Encryptのレート制限に引っかかっていないか確認

---

## セキュリティ推奨事項

### 1. SSHポートの変更

```bash
sudo nano /etc/ssh/sshd_config
# Port 22 を Port 2222 など別のポートに変更
sudo systemctl restart sshd

# ファイアウォール設定を更新
sudo ufw allow 2222/tcp
sudo ufw delete allow 22/tcp
```

### 2. SSH鍵認証の設定

パスワード認証よりも安全です。

### 3. 定期的なアップデート

```bash
# 毎週、セキュリティアップデートを実行
sudo apt update && sudo apt upgrade -y
```

### 4. 自動バックアップの設定

cronで毎日自動バックアップを設定することを推奨します。

---

## 費用の目安

| 項目 | 月額費用 |
|------|---------|
| ConoHa VPS (2GB) | 約1,000円 |
| ドメイン | 約100円（年間1,000円÷12） |
| **合計** | **約1,100円/月** |

---

## サポート

問題が発生した場合:

1. ログを確認: `docker compose -f docker-compose.prod.yml logs`
2. GitHub Issuesで質問
3. ConoHaサポートに問い合わせ

---

## おめでとうございます！🎉

これで「工程管理くん」が本番環境で公開されました！
農作業の記録を効率的に管理できるようになりました。🌾

