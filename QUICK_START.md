# クイックスタートガイド - ConoHa VPS

## 📝 概要

このガイドは、ConoHa VPSで「工程管理くん」を公開するための**最短手順**をまとめたものです。
詳細は `CONOHA_VPS_DEPLOY_GUIDE.md` を参照してください。

---

## ⏱️ 所要時間

- ConoHa VPS契約: 10分
- サーバーセットアップ: 20分
- アプリデプロイ: 10分
- SSL証明書取得: 5分

**合計: 約45分**

---

## 📋 事前チェックリスト

- [ ] ConoHaアカウント（https://www.conoha.jp/）
- [ ] ドメイン取得済み
- [ ] クレジットカード

---

## 🚀 デプロイ手順

### 1. ConoHa VPS契約 (10分)

1. https://www.conoha.jp/vps/ で申し込み
2. プラン選択:
   - メモリ: **2GB**
   - OS: **Ubuntu 22.04**
   - リージョン: **東京**
3. rootパスワードを設定してメモ
4. IPアドレスをメモ

### 2. ドメイン設定 (5分)

ドメイン管理画面でAレコードを追加:

```
タイプ: A, ホスト名: @, 値: [VPSのIPアドレス]
タイプ: A, ホスト名: www, 値: [VPSのIPアドレス]
```

### 3. サーバー接続 (1分)

```bash
ssh root@[VPSのIPアドレス]
```

### 4. 初期セットアップ (10分)

以下のコマンドをコピペで実行:

```bash
# システム更新
apt update && apt upgrade -y

# 必要なツールをインストール
apt install -y curl wget git vim ufw

# Dockerインストール
curl -fsSL https://get.docker.com -o get-docker.sh && sh get-docker.sh
apt install -y docker-compose-plugin
systemctl start docker && systemctl enable docker

# ファイアウォール設定
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp
echo "y" | ufw enable
```

### 5. アプリをデプロイ (10分)

```bash
# コードを取得
cd ~
git clone https://github.com/okaken3227/KOUTEI-KANRI.git
cd KOUTEI-KANRI

# 環境変数ファイルを作成
cp env.production.example .env.production

# JWT Secretを生成
openssl rand -base64 32

# 環境変数ファイルを編集
nano .env.production
```

以下を設定:
- `POSTGRES_PASSWORD`: 強固なパスワード
- `JWT_SECRET`: 上で生成した文字列
- `VITE_API_URL`: `https://your-domain.com/api`

Ctrl+O で保存、Ctrl+X で終了

```bash
# Nginx設定を編集
nano nginx/conf.d/default.conf
# YOUR_DOMAIN.com を自分のドメインに置き換え

# フロントエンドをビルド
chmod +x build-frontend.sh
export $(cat .env.production | grep -v '^#' | xargs)
./build-frontend.sh

# アプリを起動
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# 状態確認
docker compose -f docker-compose.prod.yml ps
```

### 6. HTTPで動作確認 (2分)

ブラウザで `http://your-domain.com` にアクセスして動作確認

### 7. SSL証明書取得 (5分)

```bash
chmod +x init-letsencrypt.sh
./init-letsencrypt.sh
```

プロンプトに従って入力:
- ドメイン名
- メールアドレス
- テスト環境: n

証明書取得後:

```bash
# Nginx設定を編集してHTTPSを有効化
nano nginx/conf.d/default.conf
# HTTPSサーバーブロックのコメント（#）を削除
# HTTPリダイレクトのコメント（#）を削除

# Nginxを再起動
docker compose -f docker-compose.prod.yml restart nginx
```

### 8. 完了！(1分)

ブラウザで `https://your-domain.com` にアクセス

🎉 デプロイ完了です！

---

## 📱 今後の更新方法

コードを更新したら:

```bash
ssh root@[VPSのIPアドレス]
cd ~/KOUTEI-KANRI
./deploy.sh
```

---

## 🆘 トラブルシューティング

### サイトにアクセスできない

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs

# ファイアウォール確認
ufw status

# DNS確認
nslookup your-domain.com
```

### データベースエラー

```bash
# データベースコンテナの状態確認
docker compose -f docker-compose.prod.yml ps db

# データベースログ確認
docker compose -f docker-compose.prod.yml logs db
```

### SSL証明書エラー

- DNSが正しく設定されているか確認
- ポート80, 443が開いているか確認: `ufw status`
- 数分待ってから再試行

---

## 📚 詳細ドキュメント

より詳しい説明は `CONOHA_VPS_DEPLOY_GUIDE.md` をご覧ください。

---

## 💰 費用

- ConoHa VPS (2GB): 約1,000円/月
- ドメイン: 約1,000円/年
- **合計: 約1,100円/月**

