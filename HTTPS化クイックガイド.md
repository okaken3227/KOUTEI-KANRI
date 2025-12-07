# 🔒 HTTPS化クイックガイド

## 最短ルート（推奨）

### VPSサーバーで実行

```bash
# 1. プロジェクトディレクトリに移動
cd /path/to/nouka-map

# 2. スクリプトに実行権限を付与
chmod +x setup-https.sh

# 3. HTTPS化スクリプトを実行
./setup-https.sh
```

スクリプトが以下を自動で実行します：
- ✅ 必要なディレクトリ作成
- ✅ Dockerサービス起動
- ✅ フロントエンドビルド
- ✅ SSL証明書取得
- ✅ HTTPS設定の有効化
- ✅ 自動更新の設定

### 実行時の入力

1. **メールアドレス**: Let's Encryptからの通知用（証明書の期限切れ前など）
2. **確認**: `y` を入力して実行開始

### 完了後

以下のURLでアクセス可能になります：
- ✅ https://koutei-kanrikun.net
- ✅ https://www.koutei-kanrikun.net
- 🔄 http://koutei-kanrikun.net → 自動的にHTTPSにリダイレクト

---

## 事前確認

### 1. DNS設定の確認

VPSサーバー上で実行：
```bash
nslookup koutei-kanrikun.net
```

期待される結果：
```
名前:    koutei-kanrikun.net
Address:  160.251.185.118
```

✅ IPアドレスが `160.251.185.118` であることを確認

### 2. ファイアウォール設定の確認

ConoHaコントロールパネルで以下のポートが開放されていることを確認：
- ✅ ポート 80 (HTTP) - SSL証明書取得に必要
- ✅ ポート 443 (HTTPS) - HTTPS通信に必要

### 3. 環境変数ファイルの確認

```bash
ls -la .env.production
```

`.env.production` ファイルが存在することを確認

---

## 手動での実行手順

自動スクリプトを使わない場合の手順：

### ステップ1: 準備

```bash
# certbotディレクトリを作成
mkdir -p certbot/conf certbot/www

# Dockerサービスを起動
docker compose -f docker-compose.prod.yml up -d db backend

# フロントエンドをビルド
./build-frontend.sh

# Nginxを起動（HTTP のみ）
docker compose -f docker-compose.prod.yml up -d nginx
```

### ステップ2: SSL証明書取得

```bash
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot \
    --webroot-path=/var/www/certbot \
    -d koutei-kanrikun.net \
    -d www.koutei-kanrikun.net \
    --email YOUR_EMAIL@example.com \
    --agree-tos \
    --no-eff-email
```

### ステップ3: Nginx再起動

証明書取得後、nginx設定はすでにHTTPS対応になっているので：

```bash
# Nginxを再起動してHTTPS設定を適用
docker compose -f docker-compose.prod.yml restart nginx

# 自動更新サービスを起動
docker compose -f docker-compose.prod.yml up -d certbot
```

---

## トラブルシューティング

### エラー: DNS解決できない

```bash
# DNS設定を確認
nslookup koutei-kanrikun.net

# お名前.comのコントロールパネルで設定を確認
# Aレコード: koutei-kanrikun.net → 160.251.185.118
# Aレコード: www.koutei-kanrikun.net → 160.251.185.118
```

DNS設定変更後、反映まで数分〜数時間かかる場合があります。

### エラー: ポート80に接続できない

```bash
# ファイアウォール設定を確認
sudo ufw status

# ポート80が開放されていない場合
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

ConoHaのコントロールパネルでもセキュリティグループを確認してください。

### エラー: 証明書取得に失敗

ログを確認：
```bash
docker compose -f docker-compose.prod.yml logs certbot
```

よくある原因：
1. ドメインがこのサーバーを指していない
2. 既にLet's Encryptのレート制限に達している（1週間に5回まで）
3. ポート80がブロックされている

**解決方法:**
- テスト環境で実行する場合は `--staging` フラグを追加
- DNS設定を再確認
- 数時間待ってから再試行

### サービスが起動しない

```bash
# すべてのサービスの状態を確認
docker compose -f docker-compose.prod.yml ps

# ログを確認
docker compose -f docker-compose.prod.yml logs

# 特定のサービスのログを確認
docker compose -f docker-compose.prod.yml logs nginx
docker compose -f docker-compose.prod.yml logs backend
docker compose -f docker-compose.prod.yml logs certbot
```

---

## SSL証明書の管理

### 証明書の有効期限確認

```bash
docker compose -f docker-compose.prod.yml exec certbot certbot certificates
```

### 手動更新

```bash
docker compose -f docker-compose.prod.yml run --rm certbot renew
docker compose -f docker-compose.prod.yml restart nginx
```

### 自動更新の確認

certbotサービスは12時間ごとに証明書の更新をチェックします。
証明書は90日間有効で、期限の30日前から更新可能になります。

```bash
# certbotサービスが実行中か確認
docker compose -f docker-compose.prod.yml ps certbot
```

---

## セキュリティ設定

HTTPS化により、以下のセキュリティ機能が有効になります：

### SSL/TLS設定
- ✅ TLS 1.2 および 1.3 をサポート
- ✅ 強力な暗号スイート（Mozilla推奨）
- ✅ OCSP Stapling 有効

### セキュリティヘッダー
- ✅ `Strict-Transport-Security` (HSTS) - HTTPS強制
- ✅ `X-Frame-Options` - クリックジャッキング対策
- ✅ `X-Content-Type-Options` - MIMEタイプスニッフィング対策
- ✅ `X-XSS-Protection` - XSS攻撃対策

### セキュリティチェック

HTTPSが正しく設定されているか確認：
- [SSL Labs](https://www.ssllabs.com/ssltest/): https://www.ssllabs.com/ssltest/analyze.html?d=koutei-kanrikun.net
- [Security Headers](https://securityheaders.com/): https://securityheaders.com/?q=koutei-kanrikun.net

---

## よくある質問

### Q: HTTPでアクセスするとどうなりますか？

A: 自動的にHTTPSにリダイレクトされます。

### Q: 証明書の更新は本当に自動ですか？

A: はい。certbotサービスが12時間ごとにチェックし、必要に応じて自動更新します。

### Q: wwwありとなしの両方で動作しますか？

A: はい。両方の証明書を取得しており、どちらでもアクセス可能です。

### Q: 費用はかかりますか？

A: いいえ。Let's Encryptは無料のSSL証明書サービスです。

### Q: 証明書の種類は？

A: ドメイン認証（DV）証明書です。個人・小規模サイトには十分です。

---

## サポート

問題が解決しない場合：
- Let's Encryptコミュニティ: https://community.letsencrypt.org/
- Certbotドキュメント: https://eff-certbot.readthedocs.io/

---

**注意事項:**
- 初回の証明書取得には数分かかる場合があります
- Let's Encryptには週5回までのレート制限があります
- テスト時は `--staging` フラグを使用してください

