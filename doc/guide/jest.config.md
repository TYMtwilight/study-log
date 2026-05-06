# Jest 設定ファイル解説

対象ファイル: `frontend/jest.config.ts`

---

## 1. Jest とは

**Jest** は Meta（旧 Facebook）が開発した JavaScript / TypeScript 向けのテストフレームワークです。関数やコンポーネントが「期待通りに動くか」を自動で確認します。

| テスト種別     | 何をテストするか       | 例                                                      |
| -------------- | ---------------------- | ------------------------------------------------------- |
| **単体テスト** | 関数 1 つの動作        | `formatDate('2026-05-01')` が `'2026年5月1日'` を返すか |
| **統合テスト** | 複数モジュールの連携   | フォームが送信されたとき API が呼ばれるか               |
| **E2E テスト** | ユーザー操作の流れ全体 | ブラウザでログインして一覧に表示されるか                |

Jest は**単体テスト・統合テスト**を担います。E2E テストは Playwright が担います。

`jest.config.ts` は「どのファイルをテスト対象とするか」「どんな環境で動かすか」などのルールを定義するファイルです。

---

## 2. 設定ファイル全体

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'

const createJestConfig = nextJest({
  dir: './',
})

const config: Config = {
  coverageProvider: 'v8',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['**/*.test.{ts,tsx}'],
  collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts'],
}

export default createJestConfig(config)
```

---

## 3. 各設定の解説

### インポート

```ts
import type { Config } from 'jest'
import nextJest from 'next/jest.js'
```

**`Config`** は Jest の設定オブジェクトに型を付けるための型定義です。`const config: Config = { ... }` のように使うと、VSCode がオプション名の候補を表示したり、タイポや存在しないオプションをその場でエラー表示したりします。

```ts
const config: Config = {
  testEnvironment: "jsdom", // ← 候補として表示される
  testEnviornment: "jsdom", // ← タイポをエラーで検出してくれる
};
```

> `import type` は「型情報だけインポートする」指定です。コンパイル後の JS ファイルには何も出力されません。

**`nextJest`** は `next/jest.js` パッケージが公開する関数で、呼び出すと `createJestConfig` という別の関数を返します（詳細は次節）。

> **`next/jest.js` と `next/jest` の違い：** ESM（`"type": "module"`）プロジェクトでは拡張子なしの `next/jest` だとモジュール解決に失敗するケースがあります。公式ドキュメントでも `.js` 付きで記載されているため、`next/jest.js` を使います。

---

### `nextJest` と `createJestConfig` — Next.js 設定との統合

`nextJest` は「関数を返す関数」で、2 段階の構造になっています。

```ts
// 第 1 段階: nextJest を呼び出して createJestConfig を受け取る
const createJestConfig = nextJest({ dir: "./" });

// 第 2 段階: 自分の config を渡して Next.js 設定とマージする
export default createJestConfig(config);
```

**なぜ 2 段階か？**

`next.config.ts` の読み込みは非同期処理です。Jestの設定を「オブジェクト」として export すると、`next.config.ts` の読み込みが終わる前にJestの設定が確定してしまいます。「関数」として export することで Jest がその関数を呼び出して結果を await できます。

> **まとめ:** `next.config.ts` の実行完了を待ったうえで、その結果を自分の Jest 設定とマージするために `createJestConfig` で順序を調整しています。

**`dir: './'` について**

`dir` は「Jest が Next.js の設定（`next.config.ts` や `.env` 系ファイル）を読みに行く場所」を教えるオプションです。`jest.config.ts` と `next.config.ts` は同じ `frontend/` 直下に並んでいるため、`'./'` で「ここ」と指定しています。

```
frontend/
├── jest.config.ts   ← ここで dir: './' と書く（「ここを見て」と教える）
├── next.config.ts   ← これを読み込む
├── .env.local       ← これも読み込む（.env / .env.test も同様）
└── ...
```

`dir` を省略したり間違えたりすると Next.js の設定が読み込めず、Jest が正しく動きません。たとえばソースコード内で `process.env.NEXT_PUBLIC_API_URL` を参照しているコンポーネントをテストすると、値が `undefined` になってテストが失敗します。

---

### `coverageProvider` — カバレッジ計測エンジン

```ts
coverageProvider: 'v8',
```

`jest --coverage` でカバレッジを計測するときに使うエンジンを指定します。

| 値 | エンジン | 特徴 |
|---|---|---|
| `'babel'` | Babel（デフォルト） | 互換性が高いが低速 |
| `'v8'` | Node.js 内蔵の V8 | 高速・軽量。Next.js でも推奨 |

`'v8'` は Node.js に内蔵されているため追加インストール不要で、`'babel'` より高速にカバレッジを計測できます。

---

### `testEnvironment` — テスト実行環境

```ts
testEnvironment: 'jsdom',
```

Jest でテストを実行する仮想環境の種類を指定します。

| 値      | 環境                     | 用途                           |
| ------- | ------------------------ | ------------------------------ |
| `jsdom` | ブラウザを模した仮想 DOM | React コンポーネントのテスト   |
| `node`  | Node.js（デフォルト）    | サーバーサイドロジックのテスト |

Jest は Node.js 上で動きますが、React コンポーネントのテストでは `document` や `window` などのブラウザ専用 API が必要です。`jsdom` を指定することでこれらが使えるようになります。

> **「仮想 DOM」とは：** 実際のブラウザを起動せずに、ブラウザの API を Node.js 上で再現するライブラリ（`jest-environment-jsdom`）です。本物のブラウザより速い反面、CSS の適用や実際の描画は行われません。

---

### `setupFilesAfterEnv` — セットアップファイル

```ts
setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
```

「`jsdom` や `node` などのテスト環境（Env）が**セットアップされた後（After）**、かつテストファイルが実行される前に読み込まれるファイル」を指定します。`<rootDir>` は `jest.config.ts` があるディレクトリ（`frontend/`）を指す Jest の組み込み変数です。

> **`setupFiles` との違い：** Jest には似た名前の設定が 2 つあります。`setupFiles` はテスト環境が作られる**前**に実行され、`setupFilesAfterEnv` はテスト環境が作られた**後**に実行されます。`@testing-library/jest-dom` は Jest のマッチャーを追加する処理のため、Jest 本体が起動済みでないと動作しません。そのため `setupFiles` ではなく `setupFilesAfterEnv` に指定します。

`jest.setup.ts` で `@testing-library/jest-dom` を読み込むことで、次のようなマッチャーが使えるようになります。

> **マッチャーとは：** `expect(値).toXxx(期待値)` の形で書く「検証メソッド」のことです。`expect` で「何を検査するか」を宣言し、マッチャーで「どうあるべきか」を表現します。Jest は `toBe` / `toEqual` などの標準マッチャーを内蔵していますが、DOM 要素の検証に特化したマッチャーは含まれていません。
>
> ```ts
> // Jest 標準マッチャーの例
> expect(1 + 1).toBe(2)           // 値が 2 か
> expect([1, 2]).toHaveLength(2)  // 長さが 2 か
> ```

`@testing-library/jest-dom` が追加する DOM 専用マッチャーの例：

```ts
expect(element).toBeInTheDocument(); // DOM に存在するか
expect(button).toBeDisabled();       // disabled 状態か
expect(input).toHaveValue("hello");  // value が一致するか
```

これらは Jest の標準マッチャーには含まれておらず、`jest.setup.ts` で読み込まないと使えません。

---

### `moduleNameMapper` — パスエイリアスの解決（`next/jest` が自動処理）

`moduleNameMapper` は `import` 文で使うパスの別名（エイリアス）を Jest に教える設定です。

```ts
import { Button } from "@/components/Button";
// → Jest は <rootDir>/components/Button として解決する
```

`@/` は `tsconfig.json` で定義したパスエイリアスです。

```json
// tsconfig.json（抜粋）
"paths": {
  "@/*": ["./*"]
}
```

**`createJestConfig` はこの `paths` を自動で読み込み、`moduleNameMapper` への変換を行います。** そのため `jest.config.ts` に手動で `'^@/(.*)$'` を追記する必要はありません。

手動で `moduleNameMapper` を記述するのは、tsconfig paths 以外の変換が必要な場合（サードパーティモジュールをモックに差し替えるなど）に限ります。

```ts
// 手動追記が必要な例
moduleNameMapper: {
  '^lodash$': '<rootDir>/__mocks__/lodash.ts',
},
```

> **正規表現キーの読み方：** `moduleNameMapper` のキーは正規表現です。`'^@/(.*)$'` を 1 文字ずつ分解すると次の通りです。
>
> | 記号 | 意味 |
> |---|---|
> | `^` | 文字列の先頭 |
> | `@/` | `@/` というリテラル文字列 |
> | `(` `)` | キャプチャグループ。括弧内にマッチした文字列を `$1` として後から参照できる |
> | `.` | 改行以外の**任意の 1 文字** |
> | `*` | 直前の文字（`.`）が**0 回以上**繰り返す |
> | `$` | 文字列の末尾 |
>
> まとめると `^@/(.*)$` は「`@/` で始まり、その後に何が続いてもよい文字列全体」にマッチします。括弧でくくられた `(.*)` の部分（`@/` より後ろ）が `$1` として取り出され、置換先の `<rootDir>/$1` に埋め込まれます。
>
> ```
> 入力:  @/components/Button
>         ^^^^^^^^^^^^^^^^
>         ^   = 先頭
>         @/  = リテラル
>         (.*)= "components/Button" → $1 に入る
>
> 出力:  <rootDir>/components/Button
> ```

---

### `testMatch` — テストファイルの場所

```ts
testMatch: ['**/*.test.{ts,tsx}'],
```

glob（ファイルパスのワイルドカード）パターンで、どのファイルをテストとして実行するかを指定します。パターンを分解すると次の通りです。

**`**`**

`*` は「任意の 1 文字以上」、`**` は「任意の深さのディレクトリ」を意味します。`**` は「どの階層にあってもよい」という指定です。`__tests__/` のような特定フォルダへの制限はなく、ソースファイルと同じ場所にテストを置くコロケーション配置も使えます。

```
frontend/app/Button.test.tsx             ← ✅ マッチ（コロケーション）
frontend/__tests__/Button.test.tsx       ← ✅ マッチ（専用フォルダ）
frontend/app/ui/__tests__/Button.test.tsx ← ✅ マッチ（ネスト）
```

**`*.test.{ts,tsx}`**

- `*` — 任意のファイル名
- `.test.` — ファイル名に `.test.` を含む
- `{ts,tsx}` — 拡張子が `ts` または `tsx`（`{` `}` で OR を表す）

```
Button.test.tsx       ← ✅ マッチ（React コンポーネントのテスト）
formatDate.test.ts    ← ✅ マッチ（ユーティリティ関数のテスト）
Button.tsx            ← ❌ マッチしない（テストファイルでない）
Button.spec.tsx       ← ❌ マッチしない（.spec. は対象外）
```

**まとめ**

```
frontend/
├── app/
│   ├── Button.tsx
│   └── Button.test.tsx             ← **/*.test.{ts,tsx} にマッチ ✅（コロケーション）
└── __tests__/
    └── formatDate.test.ts          ← **/*.test.{ts,tsx} にマッチ ✅（専用フォルダ）
```

> **`[]` は JavaScript の配列。glob かどうかは関係ない**  
> `testMatch: ['...']` の `[]` は JavaScript の配列リテラルで、glob とは無関係です。中身が glob か正規表現かはその設定項目の仕様によって決まります。
>
> | 設定項目 | 中身の種類 | なぜその記法か |
> |---|---|---|
> | `testMatch` | glob | **ファイルパス**を対象にするため。パス照合には glob が業界標準（`.gitignore` や shell と同じ記法） |
> | `collectCoverageFrom` | glob | 同上 |
> | `moduleNameMapper` のキー | 正規表現 | **`import` 文の文字列**を対象にするため。マッチした部分を `$1` で取り出して置換先に埋め込む必要があり、glob にはその機能がない |
> | `setupFilesAfterEnv` | ファイルパス | 特定ファイルを 1 つ指定するだけなので、パターン記法は不要 |

> **glob の `*` と正規表現の `.*` は別物**  
> 見た目が似ているため混同しやすいですが、使われる文脈が異なります。
>
> | 記号 | 文脈 | 意味 |
> |---|---|---|
> | `*` | glob（`testMatch` など） | 任意のファイル名・文字列 |
> | `.*` | 正規表現（`moduleNameMapper` など） | 任意の 1 文字（`.`）が 0 回以上（`*`） |
>
> glob の `*` は単体で「何でも」を表しますが、正規表現の `*` は「直前の文字の繰り返し回数」を意味するため、必ず `.` などと組み合わせて `.*` として使います。

---

### `collectCoverageFrom` — カバレッジ対象

```ts
collectCoverageFrom: ['app/**/*.{ts,tsx}', '!app/**/*.d.ts'],
```

`jest --coverage` を実行したときにカバレッジ（テストで通過したコードの割合）を計測するファイルの範囲を指定します。`!` で始まるパターンは除外を意味します。`.d.ts` は型情報だけで実行コードを含まないため対象外にします。

このプロジェクトはソースコードが `app/` ディレクトリに置かれるため `app/**` を指定します。`src/` ディレクトリを使うプロジェクトでは `src/**` になります。ここが実際のソースディレクトリと一致していないと、カバレッジが常に 0% になるので注意してください。

---

## 4. `next/jest` が自動設定するもの

`createJestConfig` でラップすることで、以下の設定が自動で追加されます。手動で書く必要はありません。

| 項目                     | 内容                                                    |
| ------------------------ | ------------------------------------------------------- |
| トランスパイル           | SWC で `.ts` / `.tsx` / `.js` / `.jsx` を変換           |
| CSS / 画像のモック       | `.css`, `.module.css`, `next/font` 等をスタブに差し替え |
| 環境変数                 | `.env` / `.env.local` 等を自動でロード                  |
| 除外パス                 | `node_modules/` と `.next/` をテスト対象から除外        |
| パスエイリアス解決       | `tsconfig.json` の `paths` を読み込み `moduleNameMapper` へ自動変換 |

> **SWC について：** Rust 製の JS/TS コンパイラで、Next.js 12 から Babel の代替として採用されました。ファイル単位のコンパイル速度が最大 17 倍高速です。詳細は [`doc/impl/issue-34-github-actions-ci.md`](../impl/issue-34-github-actions-ci.md) の「SWC コンパイラについて」を参照してください。

---

## 5. まとめ

```
「__tests__/ 配下の .test.ts / .test.tsx を」
「jsdom（ブラウザ模擬）環境で」
「@/ エイリアスを解決しながら」
「SWC で高速にトランスパイルして実行する」
```
