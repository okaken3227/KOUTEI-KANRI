#!/bin/bash

# エラーが発生したら停止
set -e

echo "🚀 工程管理くん デプロイスクリプト"
echo "=================================="

# 環境変数ファイルの確認
if [ ! -f .env.production ]; then
    echo "❌ エラー: .env.production ファイルが見つかりません"
    echo "env.production.example をコピーして .env.production を作成し、設定を行ってください"
    exit 1
fi

# 環境変数を読み込む
export $(cat .env.production | grep -v '^#' | xargs)

echo "✅ 環境変数を読み込みました"

# Gitから最新の変更を取得
echo "📥 Gitから最新の変更を取得中..."
git pull origin master

# フロントエンドをビルド
echo "🔨 フロントエンドをビルド中..."
chmod +x build-frontend.sh
./build-frontend.sh

# 古いコンテナを停止・削除
echo "🛑 既存のコンテナを停止中..."
docker compose -f docker-compose.prod.yml down

# バックエンドイメージをビルド
echo "🔨 バックエンドDockerイメージをビルド中..."
docker compose -f docker-compose.prod.yml build --no-cache backend

# コンテナを起動
echo "▶️  コンテナを起動中..."
docker compose -f docker-compose.prod.yml up -d

# ヘルスチェック
echo "🏥 ヘルスチェック中..."
sleep 10

# データベースの状態確認
if docker compose -f docker-compose.prod.yml ps | grep -q "db.*Up"; then
    echo "✅ データベースが起動しました"
else
    echo "❌ データベースの起動に失敗しました"
    docker compose -f docker-compose.prod.yml logs db
    exit 1
fi

# バックエンドの状態確認
if docker compose -f docker-compose.prod.yml ps | grep -q "backend.*Up"; then
    echo "✅ バックエンドが起動しました"
else
    echo "❌ バックエンドの起動に失敗しました"
    docker compose -f docker-compose.prod.yml logs backend
    exit 1
fi

# フロントエンドの状態確認
if docker compose -f docker-compose.prod.yml ps | grep -q "frontend.*Up"; then
    echo "✅ フロントエンドが起動しました"
else
    echo "❌ フロントエンドの起動に失敗しました"
    docker compose -f docker-compose.prod.yml logs frontend
    exit 1
fi

# Nginxの状態確認
if docker compose -f docker-compose.prod.yml ps | grep -q "nginx.*Up"; then
    echo "✅ Nginxが起動しました"
else
    echo "❌ Nginxの起動に失敗しました"
    docker compose -f docker-compose.prod.yml logs nginx
    exit 1
fi

echo ""
echo "🎉 デプロイが完了しました！"
echo "=================================="
echo "アプリケーションは以下のURLでアクセスできます:"
echo "http://your-domain.com"
echo ""
echo "ログを確認する場合:"
echo "docker compose -f docker-compose.prod.yml logs -f"
echo ""
echo "コンテナの状態を確認する場合:"
echo "docker compose -f docker-compose.prod.yml ps"

