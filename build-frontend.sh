#!/bin/bash

# フロントエンドビルドスクリプト

set -e

echo "🔨 フロントエンドをビルド中..."

# 環境変数を読み込む
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | grep VITE_API_URL | xargs)
else
    echo "❌ エラー: .env.production ファイルが見つかりません"
    exit 1
fi

# frontendディレクトリに移動
cd frontend

# node_modulesが存在しない場合はインストール
if [ ! -d "node_modules" ]; then
    echo "📦 依存関係をインストール中..."
    docker run --rm -v $(pwd):/app -w /app node:18-alpine npm ci
fi

# ビルド
echo "🏗️  ビルド実行中..."
docker run --rm \
    -v $(pwd):/app \
    -w /app \
    -e VITE_API_URL=$VITE_API_URL \
    node:18-alpine \
    npm run build

echo "✅ フロントエンドのビルドが完了しました"
echo "📁 ビルド成果物: frontend/dist/"

cd ..

