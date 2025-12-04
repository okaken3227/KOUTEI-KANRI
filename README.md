# 工程管理くん 🌾

農作業の工程管理を簡単に！田んぼごとの作業履歴を地図上で管理できるWebアプリケーションです。

## ✨ 主な機能

- 🗺️ **地図上で田んぼを管理** - 地図をクリックして田んぼの位置を登録
- 📝 **作業履歴の記録** - 田植え、施肥、農薬散布、収穫などの作業を記録
- 🏠 **自宅位置の設定** - 自宅からの距離を確認
- 📊 **ステータス管理** - 各田んぼの現在の状態を一目で把握
- 🔐 **ユーザー認証** - 安全にデータを管理

## 🚀 デプロイ方法

### 開発環境（ローカル）

```bash
# リポジトリをクローン
git clone https://github.com/okaken3227/KOUTEI-KANRI.git
cd KOUTEI-KANRI

# Dockerで起動
docker compose up -d

# ブラウザでアクセス
open http://localhost:5173
```

### 本番環境（ConoHa VPS）

**初めての方向け - クイックスタート:**
📘 [QUICK_START.md](./QUICK_START.md) - 最短45分でデプロイ

**詳細なガイド:**
📚 [CONOHA_VPS_DEPLOY_GUIDE.md](./CONOHA_VPS_DEPLOY_GUIDE.md) - 完全デプロイガイド

#### 概要

1. ConoHa VPSを契約（2GB推奨、月額約1,000円）
2. Ubuntu 22.04をインストール
3. Dockerをセットアップ
4. アプリをデプロイ
5. SSL証明書を取得（無料）

詳細は上記ガイドをご覧ください。

## 🛠️ 技術スタック

### フロントエンド
- React 18
- TypeScript
- Vite
- Leaflet（地図表示）
- React Leaflet

### バックエンド
- Node.js
- Express
- TypeScript
- TypeORM
- PostgreSQL + PostGIS

### インフラ
- Docker / Docker Compose
- Nginx（リバースプロキシ）
- Let's Encrypt（SSL証明書）

## 📁 プロジェクト構造

```
KOUTEI-KANRI/
├── frontend/              # Reactフロントエンド
│   ├── src/
│   │   ├── App.tsx       # メインアプリケーション
│   │   ├── components/   # コンポーネント
│   │   └── contexts/     # 認証コンテキスト
│   ├── Dockerfile        # 開発用
│   └── Dockerfile.prod   # 本番用
├── backend/              # Node.jsバックエンド
│   ├── src/
│   │   ├── index.ts      # エントリーポイント
│   │   ├── entity/       # データベースエンティティ
│   │   └── middleware/   # 認証ミドルウェア
│   ├── Dockerfile        # 開発用
│   └── Dockerfile.prod   # 本番用
├── nginx/                # Nginx設定
│   ├── nginx.conf
│   └── conf.d/
│       └── default.conf
├── docker-compose.yml           # 開発環境用
├── docker-compose.prod.yml      # 本番環境用
├── deploy.sh                    # デプロイスクリプト
├── build-frontend.sh            # フロントエンドビルド
└── init-letsencrypt.sh          # SSL証明書取得
```

## 🔧 環境変数

本番環境では `.env.production` ファイルを作成:

```env
# データベース設定
POSTGRES_USER=nouka_user
POSTGRES_PASSWORD=your_secure_password
POSTGRES_DB=nouka_map

# JWT Secret（ランダムな文字列）
JWT_SECRET=your_jwt_secret_key

# バックエンドAPI URL
VITE_API_URL=https://your-domain.com/api
```

## 📊 データベーススキーマ

### users（ユーザー）
- id
- username
- password（ハッシュ化）
- created_at

### rice_fields（田んぼ）
- id
- name
- polygon（地理情報）
- area（面積）
- user_id
- status（ステータス）
- created_at
- updated_at

### work_records（作業履歴）
- id
- field_id
- work_date（作業日）
- worker_name（作業者）
- work_type（作業種類）
- notes（メモ）
- created_at

## 🔒 セキュリティ

- パスワードはbcryptでハッシュ化
- JWT認証による安全なAPI
- HTTPS通信（SSL/TLS）
- CORS設定
- SQL injection対策（TypeORM）

## 🌐 ブラウザ対応

- Google Chrome（推奨）
- Firefox
- Safari
- Edge

## 📱 レスポンシブ対応

- PC
- タブレット（iPad）
- スマートフォン

## 🐛 トラブルシューティング

### ローカル開発環境

**ポートが使用中:**
```bash
# 別のポートを使用
docker compose down
# docker-compose.ymlのポート設定を変更
docker compose up -d
```

**データベース接続エラー:**
```bash
# コンテナの状態確認
docker compose ps
docker compose logs db
```

### 本番環境

詳細は [CONOHA_VPS_DEPLOY_GUIDE.md](./CONOHA_VPS_DEPLOY_GUIDE.md) のトラブルシューティングセクションを参照。

## 📝 ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 👨‍💻 作者

okaken3227

## 🙏 謝辞

- [Leaflet](https://leafletjs.com/) - 地図ライブラリ
- [React Leaflet](https://react-leaflet.js.org/) - React用Leafletラッパー
- [OpenStreetMap](https://www.openstreetmap.org/) - 地図データ
- [PostGIS](https://postgis.net/) - 地理空間データベース拡張

## 📮 お問い合わせ

問題や質問がある場合は、[GitHub Issues](https://github.com/okaken3227/KOUTEI-KANRI/issues)でお知らせください。

---

**Happy Farming! 🌾✨**

