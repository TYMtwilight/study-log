# Next.js プロジェクト初期セットアップ 実装手順

**対応 Issue:** [#1 \[セットアップ\] Next.js プロジェクト初期セットアップ](https://github.com/TYMtwilight/study-log/issues/1)  
**作成日:** 2026年4月28日

---

## Step 1 — `create-next-app` でプロジェクト作成

```bash
npx create-next-app@latest frontend \
  --typescript \
  --eslint \
  --tailwind \
  --app \
  --no-src-dir \
  --import-alias "@/*"
```

`--no-src-dir` を選ぶ理由: ディレクトリ構成が `app/` 直下になるためです（画面定義書 §2 と合わせる）。

---

## Step 2 — ディレクトリ構成の整備

`create-next-app` 生成後、以下のディレクトリを手動で作成します。  
**ファイルは各 Issue の実装時に作成します。空ファイルを置かないこと**（Next.js 16 はビルド時にルートファイルのエクスポートを型チェックするため、空の `page.tsx` / `route.ts` はエラーになります）。

```
frontend/
├── app/
│   ├── (auth)/
│   │   └── login/              # page.tsx は Issue #5（Auth.js）実装時に作成
│   ├── api/
│   │   └── auth/
│   │       └── [...nextauth]/  # route.ts は Issue #5（Auth.js）実装時に作成
│   ├── layout.tsx              # create-next-app が生成済み
│   └── page.tsx               # create-next-app が生成済み（ダッシュボード）
├── components/
│   ├── ui/                    # Issue #8 実装時にファイルを追加
│   └── layout/                # Issue #8 実装時に Header.tsx を作成
├── hooks/                     # Issue #9 実装時に useToast.ts を作成
├── lib/                       # Issue #5 実装時に auth.ts・api.ts を作成
└── types/                     # 型定義が必要になったタイミングで index.ts を作成
```

`(auth)` を Route Group にすることで、ログイン画面だけレイアウトを切り離せます。

---

## Step 3 — ESLint 設定の拡張

`create-next-app` が生成する `eslint.config.mjs`（ESLint v9 フラット設定）に追加ルールを足します。  
フラット設定では `eslint-plugin-import` の代わりに、flat config に対応したフォーク `eslint-plugin-import-x` を使います。

```bash
npm install -D eslint-plugin-import-x
```

`eslint.config.mjs` を以下のように更新します:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { importX } from "eslint-plugin-import-x";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      "no-console": "warn",
      "prefer-const": "error",
      "import-x/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
    },
  },
]);

export default eslintConfig;
```

---

## Step 4 — Prettier 設定

```bash
npm install -D prettier eslint-config-prettier
```

`.prettierrc` を作成:

```json
{
  "semi": false,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

`.prettierignore` を作成:

```
.next/
node_modules/
public/
```

`eslint-config-prettier` を `eslint.config.mjs` の末尾に追加して ESLint との競合を解消します:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import { importX } from "eslint-plugin-import-x";
import prettier from "eslint-config-prettier";  // 追加

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    plugins: {
      "import-x": importX,
    },
    rules: {
      "no-console": "warn",
      "prefer-const": "error",
      "import-x/order": [
        "warn",
        {
          groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
          "newlines-between": "always",
        },
      ],
    },
  },
  prettier,  // 末尾に追加（他のルールを上書きするため必ず最後）
]);

export default eslintConfig;
```

---

## Step 5 — tsconfig.json のパスエイリアス確認

`create-next-app --import-alias "@/*"` を指定していれば自動設定されますが、確認します。

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

---

## Step 6 — .env.local.example の作成

Phase 1〜4 で必要な環境変数をすべて列挙します。

```bash
# Auth.js v5
AUTH_SECRET=your_secret_here
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret

# Spring Boot API（バックエンド）
NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
```

実際の値は `.env.local`（`.gitignore` 済み）に記載し、`.env.local.example` のみをコミットします。

---

## Step 7 — package.json scripts の整備

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

---

## Step 8 — 動作確認

```bash
npm run dev           # localhost:3000 で起動確認
npm run lint          # ESLint エラーなし
npm run format        # Prettier フォーマット適用
npm run build         # ビルドが通ること
```

---

## 完了条件チェック

| 完了条件 | 対応ステップ |
|---------|------------|
| `create-next-app` で TypeScript / App Router / Tailwind CSS 構成 | Step 1 |
| ESLint（`eslint-config-next`）・Prettier の設定 | Step 3, 4 |
| ディレクトリ構成の定義 | Step 2 |
| パスエイリアス `@/` の設定 | Step 5 |
| `.env.local.example` の作成 | Step 6 |
| `npm run dev` でローカル起動 | Step 8 |
