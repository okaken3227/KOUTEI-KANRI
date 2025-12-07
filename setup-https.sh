#!/bin/bash

# koutei-kanrikun.net のHTTPS化スクリプト
# このスクリプトをVPSサーバー上のプロジェクトディレクトリで実行してください

set -e

echo "🔒 koutei-kanrikun.net HTTPS化スクリプト"
echo "========================================="
echo ""

# 環境変数を読み込む
if [ -f .env.production ]; then
    echo "✅ .env.production を読み込みました"
else
    echo "⚠️  警告: .env.production が見つかりません"
    echo "   先に .env.production を作成してください"
    exit 1
fi

# メールアドレスを入力
read -p "Let's Encrypt用のメールアドレスを入力してください: " email

if [ -z "$email" ]; then
    echo "❌ エラー: メールアドレスは必須です"
    exit 1
fi

echo ""
echo "📝 設定内容:"
echo "  ドメイン: koutei-kanrikun.net"
echo "  メール: $email"
echo ""

# 確認
read -p "この内容で実行しますか？ (y/n): " confirm
if [ "$confirm" != "y" ]; then
    echo "キャンセルしました"
    exit 0
fi

echo ""
echo "==================================="
echo "ステップ 1/5: certbotディレクトリ作成"
echo "==================================="
mkdir -p certbot/conf
mkdir -p certbot/www
echo "✅ ディレクトリを作成しました"

echo ""
echo "==================================="
echo "ステップ 2/5: Dockerサービス起動"
echo "==================================="
docker compose -f docker-compose.prod.yml up -d db backend
echo "✅ データベースとバックエンドを起動しました"

# バックエンドの起動を待つ
echo "⏳ バックエンドの起動を待っています..."
sleep 10

# フロントエンドをビルド
echo ""
echo "==================================="
echo "ステップ 3/5: フロントエンドビルド"
echo "==================================="
if [ -f ./build-frontend.sh ]; then
    chmod +x ./build-frontend.sh
    ./build-frontend.sh
    echo "✅ フロントエンドをビルドしました"
else
    echo "⚠️  build-frontend.sh が見つかりません"
    echo "   手動でフロントエンドをビルドしてください"
fi

# Nginxを起動（HTTPのみ、証明書取得用）
echo ""
echo "==================================="
echo "ステップ 4/5: Nginx起動とSSL証明書取得"
echo "==================================="

# 一時的にHTTPのみの設定でNginxを起動
echo "▶️  Nginxを起動中..."
cat > nginx/conf.d/default.conf.temp << 'EOF'
server {
    listen 80;
    server_name koutei-kanrikun.net www.koutei-kanrikun.net;
    
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        root /usr/share/nginx/html;
        try_files $uri $uri/ /index.html;
    }

    location /api/ {
        proxy_pass http://backend:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
EOF

# 一時設定でNginxを起動
cp nginx/conf.d/default.conf nginx/conf.d/default.conf.backup
cp nginx/conf.d/default.conf.temp nginx/conf.d/default.conf
docker compose -f docker-compose.prod.yml up -d nginx

echo ""
echo "🔐 SSL証明書を取得中..."
echo "   ドメイン: koutei-kanrikun.net, www.koutei-kanrikun.net"
echo ""

# SSL証明書を取得
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d koutei-kanrikun.net \
    -d www.koutei-kanrikun.net \
    --email "$email" \
    --agree-tos \
    --no-eff-email

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ SSL証明書の取得に成功しました！"
    
    # 元の設定（HTTPS対応版）に戻す
    echo ""
    echo "==================================="
    echo "ステップ 5/5: HTTPS設定を有効化"
    echo "==================================="
    cp nginx/conf.d/default.conf.backup nginx/conf.d/default.conf
    rm nginx/conf.d/default.conf.temp nginx/conf.d/default.conf.backup
    
    # Nginxを再起動
    echo "♻️  Nginxを再起動中..."
    docker compose -f docker-compose.prod.yml restart nginx
    
    # certbotサービスを起動（自動更新用）
    docker compose -f docker-compose.prod.yml up -d certbot
    
    echo ""
    echo "========================================="
    echo "✅ HTTPS化が完了しました！"
    echo "========================================="
    echo ""
    echo "📍 以下のURLでアクセスできます:"
    echo "   https://koutei-kanrikun.net"
    echo "   https://www.koutei-kanrikun.net"
    echo ""
    echo "🔄 HTTPアクセスは自動的にHTTPSにリダイレクトされます"
    echo ""
    echo "📋 SSL証明書は90日ごとに自動更新されます"
    echo ""
    echo "🔍 サービス状態を確認:"
    echo "   docker compose -f docker-compose.prod.yml ps"
    echo ""
    
else
    echo ""
    echo "❌ SSL証明書の取得に失敗しました"
    echo ""
    echo "考えられる原因:"
    echo "  1. ドメインのDNS設定が完了していない"
    echo "  2. ポート80がファイアウォールでブロックされている"
    echo "  3. ドメインがこのサーバーを正しく指していない"
    echo ""
    echo "🔍 トラブルシューティング:"
    echo ""
    echo "DNS確認:"
    echo "  nslookup koutei-kanrikun.net"
    echo "  # 160.251.185.118 が返ってくることを確認"
    echo ""
    echo "ログ確認:"
    echo "  docker compose -f docker-compose.prod.yml logs certbot"
    echo ""
    
    # 元の設定に戻す
    if [ -f nginx/conf.d/default.conf.backup ]; then
        cp nginx/conf.d/default.conf.backup nginx/conf.d/default.conf
        rm nginx/conf.d/default.conf.backup nginx/conf.d/default.conf.temp
    fi
    
    exit 1
fi

