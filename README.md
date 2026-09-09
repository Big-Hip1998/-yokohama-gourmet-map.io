現在のコード実装（`index_2.html`、`script_2.js`、`style_2.css`）およびSupabaseのデータベース構成（RLS設定含む）に完全に合わせた、最新の **`README.md`** の作成案です。

リポジトリ内の `README.md` を以下の内容に更新してご活用ください。

---

```markdown
# 横浜 グルメMap 取扱説明書

Webブラウザ上で動作する、自分だけのグルメマップを作成・共有できるマップアプリケーションです。  
ログイン機能、店舗情報の管理、特定拠点（特異点）の管理、マップ共有、お気に入りマップの保存機能を搭載しています。

---

## 💡 主な機能

1. **店舗情報の登録・表示・削除**
   - 地図上の好きな場所をクリックして座標をセットし、店舗情報を新規登録できます。
   - 店舗ごとに最大5枚までの画像アップロードに対応しています。
   - 各マップごとに最大 **30件** まで店舗を登録可能です。
   - 店舗ピンをクリックすると、サイドパネルで詳細情報（各種グルメサイトリンク、メモ等）を確認できます。

2. **特異点（マーキングピン）管理機能**
   - 自宅・会社・実家など、よく使う拠点を「特異点」として保存・管理できます。
   - ヘッダーのセレクトボックスやモーダルから、ワンタップで指定した拠点へ地図をスムーズに移動できます。

3. **地図操作と絞り込み**
   - 店名・ジャンル・予算・各種こだわり条件（貸切/コース/飲み放題/食べ放題）によるリアルタイム検索・絞り込みが可能です。

4. **ログイン・ユーザー管理（Supabase Auth）**
   - メールアドレスとパスワードによるログイン / アカウント作成機能。
   - ログインユーザーには、アカウント固有の **マイマップID** が自動割り当てされます。

5. **マップ共有・切り替え機能**
   - マップごとに固有の「マップID（例: `MAP-A3F8B2`）」が割り振られます。
   - 友達のマップIDを入力することで、他の人が作ったマップを簡単に読み込んで閲覧できます。
   - 他人のマップを閲覧している時でも、いつでも「自分のデフォルトマップ」へワンタップで復帰可能です。

6. **お気に入り（ブックマーク）機能**
   - 気に入った他人のマップや特定のテーママップに名前をつけてお気に入りに保存できます。
   - 保存したマップ一覧からいつでもワンタップで切り替え可能です。

---

## 🛠️ データベース・ストレージの設定（Supabase）

本アプリを動作させるには、**Supabase** の SQL エディタで以下の3つのテーブルを作成し、RLSポリシーおよびストレージバケットを設定する必要があります。

### 1. テーブル作成 SQL

```sql
-- ① stores テーブル（店舗データ用）
CREATE TABLE stores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  name TEXT NOT NULL,
  genre TEXT,
  budget TEXT,
  is_charter BOOLEAN DEFAULT false,
  has_course BOOLEAN DEFAULT false,
  has_all_you_can_drink BOOLEAN DEFAULT false,
  has_all_you_can_eat BOOLEAN DEFAULT false,
  phone TEXT,
  official_url TEXT,
  tabelog_url TEXT,
  hotpepper_url TEXT,
  other_url TEXT,
  notes TEXT,
  image_url TEXT,
  image_urls TEXT[],
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ② singularities テーブル（特異点データ用）
CREATE TABLE singularities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ③ favorite_maps テーブル（お気に入りマップ用）
CREATE TABLE favorite_maps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  map_id TEXT NOT NULL,
  map_title TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, map_id)
);

```

### 2. RLS（Row Level Security）ポリシー設定

```sql
-- stores テーブルの RLS
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON stores
  FOR SELECT USING (true);

CREATE POLICY "Allow authenticated insert" ON stores
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Allow owner delete" ON stores
  FOR DELETE USING (auth.uid() = user_id);

-- singularities テーブルの RLS
ALTER TABLE singularities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select their own singularities" ON singularities
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own singularities" ON singularities
  FOR INSERT WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = user_id);

CREATE POLICY "Users can delete their own singularities" ON singularities
  FOR DELETE USING (auth.uid() = user_id);

-- favorite_maps テーブルの RLS
ALTER TABLE favorite_maps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own favorite maps" ON favorite_maps
  FOR ALL USING (auth.uid() = user_id);

```

### 3. Supabase Storage（画像用バケット）の設定

1. Supabaseダッシュボードの **Storage** メニューから、新しいバケットを作成します。
* **Bucket Name**: `store-images`
* **Public bucket**: `ON`（有効にする）


2. 画像のアップロードおよび参照ができるよう、Storageのポリシーを設定してください。

---

## 🚀 開発・動作環境

* **フロントエンド**: HTML5, CSS3, JavaScript (ES6+ / Pure JS)
* **地図ライブラリ**: [Leaflet.js](https://leafletjs.com/) (OpenStreetMap)
* **バックエンド / DB**: [Supabase](https://supabase.com/) (Database, Auth, Storage)
* **ホスティング**: GitHub Pages

```

```