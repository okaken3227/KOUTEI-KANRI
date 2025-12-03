import express from "express";
import cors from "cors";
import { AppDataSource } from "./data-source";
import { User } from "./entity/User";
import { RiceField } from "./entity/RiceField";
import { WorkRecord } from "./entity/WorkRecord";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { authenticateToken, AuthRequest } from "./middleware/auth";

const app = express();
const PORT = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "your-secret-key-change-in-production";

app.use(cors());
app.use(express.json());

// データベース接続状態を追跡
let isDatabaseReady = false;

AppDataSource.initialize()
  .then(() => {
    console.log("Data Source has been initialized!");
    isDatabaseReady = true;
  })
  .catch((err) => {
    console.error("Error during Data Source initialization:", err);
    // スキーマ同期エラーの場合は、データベースをリセットする必要がある
    if (err.code === '23502' || err.message?.includes('contains null values')) {
      console.error("スキーマ同期エラーが発生しました。データベースをリセットしてください: docker-compose down -v && docker-compose up -d");
    }
  });

// データベース接続を待つミドルウェア
const waitForDatabase = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (!isDatabaseReady) {
    // データベース接続を待つ（最大10秒）
    let attempts = 0;
    while (!isDatabaseReady && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 200));
      attempts++;
    }
    if (!isDatabaseReady) {
      return res.status(503).json({ error: "データベースに接続できません。しばらく待ってから再度お試しください。" });
    }
  }
  next();
};

// ユーザー登録
app.post("/api/register", waitForDatabase, async (req, res) => {
  try {
    const { username, password, phone, email } = req.body;
    
    // パスワードのバリデーション
    if (!password || password.length < 4) {
      return res.status(400).json({ error: "パスワードは4文字以上である必要があります" });
    }
    
    // 電話番号とメールアドレスのバリデーション
    if (!phone && !email) {
      return res.status(400).json({ error: "電話番号またはメールアドレスのいずれかが必要です" });
    }
    
    // メールアドレスの形式チェック
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: "メールアドレスの形式が正しくありません" });
    }
    
    // 電話番号の形式チェック（数字とハイフン、括弧、プラスのみ）
    if (phone && !/^[\d\-+()]+$/.test(phone)) {
      return res.status(400).json({ error: "電話番号の形式が正しくありません" });
    }
    
    // ユーザー名の重複チェック
    const existingUsername = await AppDataSource.manager.findOne(User, { where: { username } });
    if (existingUsername) {
      return res.status(400).json({ error: "ユーザー名が既に使用されています" });
    }
    
    // 電話番号の重複チェック
    if (phone) {
      const existingPhone = await AppDataSource.manager.findOne(User, { where: { phone } });
      if (existingPhone) {
        return res.status(400).json({ error: "この電話番号は既に登録されています" });
      }
    }
    
    // メールアドレスの重複チェック
    if (email) {
      const existingEmail = await AppDataSource.manager.findOne(User, { where: { email } });
      if (existingEmail) {
        return res.status(400).json({ error: "このメールアドレスは既に登録されています" });
      }
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = AppDataSource.manager.create(User, { 
      username, 
      password: hashedPassword,
      phone: phone || null,
      email: email || null
    });
    await AppDataSource.manager.save(user);
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, phone: user.phone, email: user.email } });
  } catch (error: any) {
    console.error("Registration error:", error);
    res.status(500).json({ error: "登録に失敗しました" });
  }
});

// ログイン
app.post("/api/login", waitForDatabase, async (req, res) => {
  try {
    const { login, password } = req.body; // loginは電話番号またはメールアドレス
    if (!login || !password) {
      return res.status(400).json({ error: "電話番号またはメールアドレスとパスワードを入力してください" });
    }
    
    // 電話番号またはメールアドレスでユーザーを検索
    let user = null;
    // メールアドレスの形式チェック（@を含む）
    if (login.includes('@')) {
      // メールアドレスで検索
      user = await AppDataSource.manager.findOne(User, { where: { email: login } });
    } else {
      // 電話番号で検索
      user = await AppDataSource.manager.findOne(User, { where: { phone: login } });
    }
    
    if (!user) {
      return res.status(401).json({ error: "電話番号/メールアドレスまたはパスワードが正しくありません" });
    }
    
    if (!(await bcrypt.compare(password, user.password))) {
      return res.status(401).json({ error: "電話番号/メールアドレスまたはパスワードが正しくありません" });
    }
    
    const token = jwt.sign({ userId: user.id }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username, phone: user.phone, email: user.email } });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "ログインに失敗しました" });
  }
});

// 田んぼ一覧取得
app.get("/api/fields", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const queryRunner = AppDataSource.manager.connection.createQueryRunner();
    await queryRunner.connect();
    
    try {
      const results = await queryRunner.query(
        `SELECT id, name, owner, area, status, "userId",
         ST_AsGeoJSON(polygon)::json as polygon
         FROM rice_field 
         WHERE "userId" = $1`,
        [req.userId]
      );
      
      const fields = results.map((row: any) => ({
        id: row.id,
        name: row.name,
        owner: row.owner,
        area: row.area,
        status: row.status,
        userId: row.userId,
        polygon: row.polygon
      }));
      
      res.json(fields);
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "田んぼの取得に失敗しました" });
  }
});

// 田んぼ作成
app.post("/api/fields", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { name, owner, polygon, area } = req.body;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    
    // PostGIS用のWKT形式に変換（経度 緯度の順序）
    const coords = polygon.coordinates[0];
    // GeoJSONのPolygonは閉じていることが前提だが、念のため確認
    const isClosed = coords.length > 0 && 
                     coords[0][0] === coords[coords.length - 1][0] && 
                     coords[0][1] === coords[coords.length - 1][1];
    
    const points = isClosed ? coords : [...coords, coords[0]];
    const coordinates = points.map((c: number[]) => `${c[0]} ${c[1]}`).join(", ");
    const wktPolygon = `POLYGON((${coordinates}))`;
    
    // PostGISのST_GeomFromTextを使って保存
    const queryRunner = AppDataSource.manager.connection.createQueryRunner();
    await queryRunner.connect();
    
    try {
      const result = await queryRunner.query(
        `INSERT INTO rice_field (name, owner, polygon, area, status, "userId") 
         VALUES ($1, $2, ST_GeomFromText($3, 4326), $4, $5, $6) 
         RETURNING id, name, owner, area, status, "userId"`,
        [name, owner || null, wktPolygon, area || null, "未着手", req.userId]
      );
      
      // 結果を整形して返す
      const field = {
        id: result[0].id,
        name: result[0].name,
        owner: result[0].owner,
        area: result[0].area,
        status: result[0].status,
        userId: result[0].userId,
        polygon: {
          type: "Polygon",
          coordinates: polygon.coordinates
        }
      };
      
      res.json(field);
    } finally {
      await queryRunner.release();
    }
  } catch (error: any) {
    console.error("Field creation error:", error);
    res.status(500).json({ error: "田んぼの作成に失敗しました: " + (error.message || "不明なエラー") });
  }
});

// 田んぼ更新
app.put("/api/fields/:id", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const { name, owner, area } = req.body;
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: parseInt(id), userId: req.userId } });
    if (!field) {
      return res.status(404).json({ error: "田んぼが見つかりません" });
    }
    field.name = name;
    field.owner = owner;
    field.area = area;
    await AppDataSource.manager.save(field);
    res.json(field);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "田んぼの更新に失敗しました" });
  }
});

// 田んぼ削除
app.delete("/api/fields/:id", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: parseInt(id), userId: req.userId } });
    if (!field) {
      return res.status(404).json({ error: "田んぼが見つかりません" });
    }
    // 関連する作業履歴を削除
    await AppDataSource.manager.delete(WorkRecord, { fieldId: field.id });
    // 田んぼを削除
    await AppDataSource.manager.remove(field);
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "田んぼの削除に失敗しました" });
  }
});

// ステータス更新
app.put("/api/fields/:id/status", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const { status, worker, weather, temperature } = req.body; // date, yearはバックエンドで生成
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: parseInt(id), userId: req.userId } });
    if (!field) {
      return res.status(404).json({ error: "田んぼが見つかりません" });
    }
    field.status = status;
    await AppDataSource.manager.save(field);

    // 作業履歴を追加
    const record = AppDataSource.manager.create(WorkRecord, {
      date: new Date(), // 現在の日時（分秒まで）を記録
      workType: status,
      year: new Date().getFullYear(), // 現在の年を記録
      worker,
      weather,
      temperature,
      fieldId: parseInt(id),
    });
    await AppDataSource.manager.save(record);

    res.json({ field, record });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "ステータスの更新に失敗しました" });
  }
});

// 作業履歴取得
app.get("/api/fields/:id/records", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    // 田んぼがユーザーのものか確認
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: parseInt(id), userId: req.userId } });
    if (!field) {
      return res.status(404).json({ error: "田んぼが見つかりません" });
    }
    const records = await AppDataSource.manager.find(WorkRecord, {
      where: { fieldId: parseInt(id) },
      order: { date: "DESC" },
    });
    res.json(records);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "作業履歴の取得に失敗しました" });
  }
});

// 作業履歴更新
app.put("/api/records/:id", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const { date: newDateStr, workType, worker, weather, temperature } = req.body; // dateはフロントエンドからYYYY-MM-DD形式で来る
    
    const record = await AppDataSource.manager.findOne(WorkRecord, { 
      where: { id: parseInt(id) },
      relations: ["field"]
    });
    if (!record) {
      return res.status(404).json({ error: "作業履歴が見つかりません" });
    }
    
    // 田んぼがユーザーのものか確認
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: record.fieldId, userId: req.userId } });
    if (!field) {
      return res.status(403).json({ error: "この作業履歴を更新する権限がありません" });
    }
    
    // 履歴を更新
    record.date = new Date(); // 更新時の日時（分秒まで）を記録
    record.workType = workType;
    record.year = new Date(newDateStr).getFullYear(); // フロントエンドから来た日付の年を使用
    record.worker = worker || null;
    record.weather = weather || null;
    record.temperature = temperature || null;
    await AppDataSource.manager.save(record);
    
    // 最新の作業履歴を取得して田んぼのステータスを更新
    const latestRecord = await AppDataSource.manager.findOne(WorkRecord, {
      where: { fieldId: record.fieldId },
      order: { date: "DESC" }, // 日時が分秒まで記録されることで、同じ日の履歴も正しく最新のものを判定
    });
    if (latestRecord) {
      field.status = latestRecord.workType;
    } else {
      field.status = "未着手";
    }
    await AppDataSource.manager.save(field);
    
    // フィールドの最新更新日を取得
    const queryRunner = AppDataSource.manager.connection.createQueryRunner();
    await queryRunner.connect();
    try {
      const result = await queryRunner.query(
        `SELECT rf.id, rf.name, rf.owner, rf.area, rf.status, rf."userId",
        ST_AsGeoJSON(rf.polygon)::json as polygon,
        MAX(wr.date) as "lastUpdated"
        FROM rice_field rf
        LEFT JOIN work_record wr ON wr."fieldId" = rf.id
        WHERE rf.id = $1
        GROUP BY rf.id, rf.name, rf.owner, rf.area, rf.status, rf."userId", rf.polygon`,
        [record.fieldId]
      );
      const updatedFieldWithLastUpdated = result.length > 0 ? result[0] : field;
      res.json({ field: updatedFieldWithLastUpdated, record });
    } finally {
      await queryRunner.release();
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "作業履歴の更新に失敗しました" });
  }
});

// 作業履歴削除
app.delete("/api/records/:id", waitForDatabase, authenticateToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    if (!req.userId) {
      return res.status(401).json({ error: "認証が必要です" });
    }
    const record = await AppDataSource.manager.findOne(WorkRecord, { 
      where: { id: parseInt(id) },
      relations: ["field"]
    });
    if (!record) {
      return res.status(404).json({ error: "作業履歴が見つかりません" });
    }
    // 田んぼがユーザーのものか確認
    const field = await AppDataSource.manager.findOne(RiceField, { where: { id: record.fieldId, userId: req.userId } });
    if (!field) {
      return res.status(403).json({ error: "この作業履歴を削除する権限がありません" });
    }
    await AppDataSource.manager.remove(record);
    
    // 最新の作業履歴を取得して田んぼのステータスを更新
    const latestRecord = await AppDataSource.manager.findOne(WorkRecord, {
      where: { fieldId: record.fieldId },
      order: { date: "DESC" },
    });
    if (latestRecord) {
      field.status = latestRecord.workType;
    } else {
      field.status = "未着手";
    }
    await AppDataSource.manager.save(field);
    
    res.json({ success: true, field });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "作業履歴の削除に失敗しました" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

