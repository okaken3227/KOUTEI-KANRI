# HTTPS化手順

## 前提条件
- ドメイン: koutei-kanrikun.net
- VPS IP: 160.251.185.118
- ドメインのDNS設定が完了していること（AレコードでVPSのIPを指定）

## 手順

### 1. VPSサーバーにSSH接続

```bash
ssh root@160.251.185.118
# または適切なユーザー名でログイン
```

### 2. プロジェクトディレクトリに移動

```bash
cd /path/to/nouka-map
# 実際のプロジェクトパスに移動してください
```

### 3. nginx設定ファイルを更新

まず、ドメイン名をnginx設定に反映させます：

```bash
# YOUR_DOMAIN.com を koutei-kanrikun.net に置換
sed -i 's/YOUR_DOMAIN\.com/koutei-kanrikun.net/g' nginx/conf.d/default.conf
```

### 4. SSL証明書を取得

自動スクリプトを実行：

```bash
# スクリプトに実行権限を付与
chmod +x init-letsencrypt.sh

# スクリプトを実行
./init-letsencrypt.sh
```

スクリプト実行時に入力する内容：
- ドメイン名: `koutei-kanrikun.net`
- メールアドレス: あなたのメールアドレス
- テスト環境で実行: `n` (本番環境で実行)

**または手動で実行する場合：**

```bash
# certbotディレクトリを作成
mkdir -p certbot/conf certbot/www

# nginx設定を更新
sed -i 's/YOUR_DOMAIN\.com/koutei-kanrikun.net/g' nginx/conf.d/default.conf

# Dockerサービスを起動
docker compose -f docker-compose.prod.yml up -d nginx

# SSL証明書を取得
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d koutei-kanrikun.net \
    -d www.koutei-kanrikun.net \
    --email YOUR_EMAIL@example.com \
    --agree-tos \
    --no-eff-email
```

### 5. nginx設定でHTTPSを有効化

`nginx/conf.d/default.conf` を編集して、HTTPSサーバーブロックのコメントを解除します：

```bash
nano nginx/conf.d/default.conf
# または vi nginx/conf.d/default.conf
```

以下の変更を行います：

1. **HTTPサーバーブロック（11-14行目）のリダイレクトを有効化：**
```nginx
# コメントを解除
location / {
    return 301 https://$server_name$request_uri;
}
```

2. **一時的なフロントエンド表示（17-20行目）をコメントアウト：**
```nginx
# SSL設定前は一時的にフロントエンドを表示
# location / {
#     root /usr/share/nginx/html;
#     try_files $uri $uri/ /index.html;
# }
```

3. **HTTPSサーバーブロック全体（39-93行目）のコメントを解除**

### 6. Nginxを再起動

```bash
docker compose -f docker-compose.prod.yml restart nginx
```

### 7. 動作確認

ブラウザで以下にアクセス：
- https://koutei-kanrikun.net （HTTPSで表示されることを確認）
- http://koutei-kanrikun.net （HTTPSにリダイレクトされることを確認）

## トラブルシューティング

### 証明書取得エラーの場合

```bash
# ログを確認
docker compose -f docker-compose.prod.yml logs certbot

# よくある原因：
# 1. ドメインのDNS設定が完了していない（浸透に時間がかかる場合がある）
# 2. ポート80がブロックされている（ファイアウォール設定を確認）
# 3. nginxが起動していない
```

### DNS設定の確認

```bash
nslookup koutei-kanrikun.net
# 160.251.185.118 が返ってくることを確認
```

### ファイアウォール設定（ConoHa VPS）

ConoHaのコントロールパネルで以下のポートが開放されていることを確認：
- ポート 80 (HTTP)
- ポート 443 (HTTPS)

## SSL証明書の自動更新

設定されたcertbotサービスは、12時間ごとに証明書の更新をチェックします。
証明書は90日間有効で、自動的に更新されます。

## セキュリティヘッダーの確認

HTTPS化後、以下のセキュリティヘッダーが設定されます：
- Strict-Transport-Security (HSTS)
- X-Frame-Options
- X-Content-Type-Options
- X-XSS-Protection

## 参考資料

- Let's Encrypt: https://letsencrypt.org/
- Certbot: https://certbot.eff.org/
- Mozilla SSL Configuration Generator: https://ssl-config.mozilla.org/

