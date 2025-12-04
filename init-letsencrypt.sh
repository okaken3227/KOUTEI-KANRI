#!/bin/bash

# Let's Encrypt SSL証明書取得スクリプト

# エラーが発生したら停止
set -e

echo "🔒 Let's Encrypt SSL証明書取得スクリプト"
echo "========================================="

# ドメイン名を入力
read -p "ドメイン名を入力してください (例: example.com): " domain
read -p "メールアドレスを入力してください: " email

if [ -z "$domain" ] || [ -z "$email" ]; then
    echo "❌ エラー: ドメイン名とメールアドレスは必須です"
    exit 1
fi

# ステージング環境かどうか（テスト用）
read -p "テスト環境で実行しますか？ (y/n): " staging

if [ "$staging" = "y" ]; then
    staging_arg="--staging"
    echo "⚠️  テスト環境で実行します"
else
    staging_arg=""
    echo "✅ 本番環境で実行します"
fi

# certbotディレクトリを作成
mkdir -p certbot/conf
mkdir -p certbot/www

echo ""
echo "📝 nginx設定ファイルを更新中..."

# nginx設定ファイルのYOUR_DOMAINを置換
sed -i "s/YOUR_DOMAIN.com/$domain/g" nginx/conf.d/default.conf

echo "✅ nginx設定ファイルを更新しました"

# Nginxを起動（証明書取得用）
echo ""
echo "▶️  Nginxを起動中..."
docker compose -f docker-compose.prod.yml up -d nginx

# 証明書を取得
echo ""
echo "🔐 SSL証明書を取得中..."
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d $domain \
    -d www.$domain \
    --email $email \
    --agree-tos \
    --no-eff-email \
    $staging_arg

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL証明書の取得に成功しました！"
    echo ""
    echo "📝 次のステップ:"
    echo "1. nginx/conf.d/default.conf を編集"
    echo "2. HTTPSサーバーブロックのコメントを解除"
    echo "3. HTTPサーバーブロックのリダイレクトを有効化"
    echo "4. 以下のコマンドでNginxを再起動:"
    echo "   docker compose -f docker-compose.prod.yml restart nginx"
else
    echo ""
    echo "❌ SSL証明書の取得に失敗しました"
    echo "ログを確認してください:"
    echo "docker compose -f docker-compose.prod.yml logs certbot"
    exit 1
fi

