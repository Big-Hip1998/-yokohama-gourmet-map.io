# 横浜 グルメMap 取扱説明書

Webブラウザ上で動作する、自分だけのグルメマップを作成・共有できるマップアプリケーションです。  
ログイン機能、店舗情報の管理、マップ共有、お気に入りマップの保存機能を搭載しています。

---

## 💡 主な機能

1. **店舗情報の登録・表示・削除**
   - 地図上の好きな場所をクリックして座標をセットし、店舗情報を新規登録できます。
   - 各マップごとに最大 **30件** まで店舗を登録可能です。
   - 店舗ピンをクリックすると、サイドパネルで詳細情報（各種グルメサイトリンク等）を確認できます。

2. **地図操作と絞り込み**
   - **横浜駅へ移動** ボタンでいつでも初期位置（ズームレベル17）へスムーズに移動。
   - 店名・ジャンル・予算・各種こだわり条件（貸し切り/コース/飲み放題/食べ放題）によるリアルタイム検索・絞り込み。

3. **ログイン・ユーザー管理（Supabase Auth）**
   - メールアドレスとパスワードによるログイン / アカウント作成機能。
   - ログインユーザーには、アカウント固有の **マイマップID** が自動割り当てされます。

4. **マップ共有・切り替え機能**
   - マップごとに固有の「マップID（例: `MAP-A3F8B2`）」が割り振られます。
   - 友達のマップIDを入力することで、他の人が作ったマップを簡単に読み込んで閲覧できます。
   - 他人のマップを閲覧している時でも、いつでも「自分のデフォルトマップ」へワンタップで復帰可能。

5. **お気に入り（ブックマーク）機能**
   - 気に入った他人のマップや特定のテーママップに名前をつけてお気に入りに保存。
   - 保存したマップ一覧からいつでもワンタップで切り替え可能です。

---

## 🛠️ 事前準備（データベースの設定）

本アプリを動作させるには、**Supabase** の SQL エディタで以下の2つのテーブルを作成しておく必要があります。

### 1. `stores` テーブル（店舗データ用）

```sql
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
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS（Row Level Security）の設定
ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

-- 全ユーザー（未ログイン含む）がデータを参照可能
CREATE POLICY "Allow public read access" ON stores
  FOR SELECT USING (true);

-- ログイン済みユーザーが店舗を追加可能
CREATE POLICY "Allow authenticated insert" ON stores
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- 自分が作成したデータ（または無所属データ）のみ削除可能
CREATE POLICY "Allow owner delete" ON stores
  FOR DELETE USING (auth.uid() = user_id OR user_id IS NULL);