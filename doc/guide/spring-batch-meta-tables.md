# Spring Batch メタテーブル解説

Spring Batch はジョブの実行履歴・状態・再開情報を DB に永続化する。
これはバッチ処理が「**失敗しても途中から再実行できる**」ことを保証するための仕組みであり、Spring Batch の中核設計思想でもある。

## なぜ DB に永続化するのか

バッチ処理はサーバー障害やネットワーク切断、メモリの不足など、**プロセス外からの強制終了**が起こりうる環境で動く。
メモリだけで状態を持つと、プロセスが落ちた瞬間に「どこまで処理したか」が失われる。

DB に永続化することで次の 3 つを実現する。

### 1. 途中再開（Restart）

100 万件処理するジョブが 60 万件で落ちた場合、DB に保存されたチェックポイントを読み取り、**61 万件目から再開**できる。
最初から全件やり直すと二重登録・処理漏れが起きるため、「どこまで書いたか」の記録は必須。

> このプロジェクトの日次集計バッチは件数が少ないため恩恵は薄いが、Spring Batch の設計として常に保証される。

### 2. 二重実行の防止

「同じパラメーターで同じジョブを 2 回起動しない」を DB レベルで保証する。
`BATCH_JOB_INSTANCE` の `(JOB_NAME, JOB_KEY)` にユニーク制約があり、重複起動しようとすると例外が発生する。

> 日次集計バッチに `targetDate=2026-04-26` を渡す設計にすれば、同日の集計を誤って 2 回実行してしまうことを防げる。

### 3. 実行履歴の監査

「いつ・何件・成功/失敗したか」を後から確認できる。
障害対応時に「どのジョブがどこで落ちたか」をログだけで追うのは難しい。DB に構造化データとして残ることで、F-32「バッチ実行履歴」画面のような可視化が可能になる。

---

## テーブル構造の全体像

```
BATCH_JOB_INSTANCE          ←「ジョブの定義」単位
    └── BATCH_JOB_EXECUTION         ←「ジョブの実行」単位（1 Instance に複数あり得る）
            ├── BATCH_JOB_EXECUTION_PARAMS      ← 実行時パラメーター
            ├── BATCH_JOB_EXECUTION_CONTEXT     ← ジョブレベルの実行コンテキスト（再開用）
            └── BATCH_STEP_EXECUTION            ← Step ごとの実行記録
                    └── BATCH_STEP_EXECUTION_CONTEXT    ← Stepレベルの実行コンテキスト（再開用）
```

---

## 各テーブルの役割

### BATCH_JOB_INSTANCE

**役割：ジョブの「論理的な実行単位」を管理する**

ジョブ名（`JOB_NAME`）と識別パラメーター（`JOB_KEY`）の組み合わせで一意なレコードを持つ。
同じジョブを同じパラメーターで 2 回実行しようとすると、Spring Batch はここで重複を検知して例外を投げる。

| カラム            | 役割                                                                        |
| ----------------- | --------------------------------------------------------------------------- |
| `JOB_INSTANCE_ID` | PK（シーケンス生成）                                                        |
| `JOB_NAME`        | ジョブの識別名（例: `dailySummaryJob`）                                     |
| `JOB_KEY`         | 実行パラメーターを MD5 ハッシュ化した値。同一パラメーターでの二重起動を防ぐ |
| `VERSION`         | 楽観的ロック用のバージョン番号                                              |

> **このプロジェクトでの意図**
> 日次集計バッチ（F-30）は「前日分」という日付パラメーターを持つため、同日の重複実行を自然に防げる。

---

### BATCH_JOB_EXECUTION

**役割：ジョブの「物理的な実行」を記録する**

1 つの `BATCH_JOB_INSTANCE` に対して複数の `BATCH_JOB_EXECUTION` が紐づく。
失敗して再実行した場合、同じ `BATCH_JOB_INSTANCE` に新しい `BATCH_JOB_EXECUTION` が追加される。

| カラム                    | 役割                                                             |
| ------------------------- | ---------------------------------------------------------------- |
| `JOB_EXECUTION_ID`        | PK（シーケンス生成）                                             |
| `JOB_INSTANCE_ID`         | どのジョブインスタンスの実行かを示す FK                          |
| `STATUS`                  | 実行状態（`COMPLETED` / `FAILED` / `STARTED` / `STOPPING` など） |
| `EXIT_CODE`               | 終了コード（`COMPLETED` / `FAILED` / `NOOP` など）               |
| `EXIT_MESSAGE`            | エラー時のスタックトレースなど詳細メッセージ                     |
| `START_TIME` / `END_TIME` | 実行時間の計測に使用                                             |
| `CREATE_TIME`             | レコード作成日時（`START_TIME` より前）                          |
| `LAST_UPDATED`            | 最終更新日時                                                     |
| `VERSION`                 | 楽観的ロック用                                                   |

> **このプロジェクトでの意図**
> F-32「バッチ実行履歴」画面では `STATUS`・`START_TIME`・`END_TIME`・`EXIT_MESSAGE` を表示する。
> アプリ独自の `BATCH_JOB_HISTORY` テーブルと役割が重なるため、設計段階でどちらに寄せるか検討が必要。

---

### BATCH_JOB_EXECUTION_PARAMS

**役割：実行時に渡したパラメーターを保存する**

ジョブ起動時に渡した `JobParameters` を 1 パラメーター 1 行で保存する。
`IDENTIFYING = 'Y'` のパラメーターだけが `JOB_KEY`（ハッシュ）の計算に含まれる。

| カラム             | 役割                                |
| ------------------ | ----------------------------------- |
| `JOB_EXECUTION_ID` | 対応する実行の FK                   |
| `PARAMETER_NAME`   | パラメーター名（例: `targetDate`）  |
| `PARAMETER_TYPE`   | 型名（例: `java.lang.String`）      |
| `PARAMETER_VALUE`  | パラメーターの値                    |
| `IDENTIFYING`      | `Y` のとき JOB_KEY の計算対象になる |

> **このプロジェクトでの意図**
> 日次集計バッチに `targetDate=2026-04-26` のようなパラメーターを渡すことで、
> どの日付分の集計を実行したかを後から確認できる。

#### なぜ BATCH_JOB_INSTANCE ではなく BATCH_JOB_EXECUTION に紐づくのか

まず Instance と Execution の違いを整理する。

```
BATCH_JOB_INSTANCE  ＝「この仕事の依頼書」
BATCH_JOB_EXECUTION ＝「実際に作業した記録」
```

1 つの Instance に対して、Execution は複数紐づく可能性がある。
ジョブが失敗して再実行した場合が典型例で、依頼書（Instance）は同じでも作業の記録（Execution）は 2 つ残る。

```
BATCH_JOB_INSTANCE
  └─ jobName=dailySummaryJob, targetDate=2026-04-26

      BATCH_JOB_EXECUTION #1（1回目）→ FAILED
      BATCH_JOB_EXECUTION #2（再実行）→ COMPLETED
```

パラメーターは「**どの作業で使われたか**」の記録なので、作業（Execution）側に紐づける。
仮に Instance 側に紐づけると、1回目と2回目でどんなパラメーターが渡されたかを区別できなくなる。
障害調査で「失敗した実行ではどのパラメーターが渡っていたか」を追いたいとき、Execution に紐づいていないと追えない。

---

### BATCH_STEP_EXECUTION

**役割：Step ごとの処理件数・状態を記録する**

Spring Batch のジョブは複数の Step から構成される。
各 Step の `READ_COUNT`・`WRITE_COUNT`・`SKIP_COUNT` などを記録し、部分失敗時の診断に役立てる。

| カラム                 | 役割                                   |
| ---------------------- | -------------------------------------- |
| `STEP_EXECUTION_ID`    | PK                                     |
| `STEP_NAME`            | Step の識別名（例: `aggregateStep`）   |
| `JOB_EXECUTION_ID`     | 親の実行 ID（FK）                      |
| `STATUS` / `EXIT_CODE` | Step 単体の実行状態                    |
| `READ_COUNT`           | ItemReader が読み込んだ件数            |
| `WRITE_COUNT`          | ItemWriter が書き込んだ件数            |
| `FILTER_COUNT`         | ItemProcessor がフィルタした件数       |
| `COMMIT_COUNT`         | コミット回数（chunk 処理の場合に増加） |
| `ROLLBACK_COUNT`       | ロールバック回数                       |
| `READ_SKIP_COUNT`      | 読み込みスキップ件数                   |
| `WRITE_SKIP_COUNT`     | 書き込みスキップ件数                   |
| `PROCESS_SKIP_COUNT`   | 処理スキップ件数                       |

#### 各カラムの役割と意図

Spring Batch の chunk 処理は **Read → Process → Write** の 3 ステップを一定件数ずつ繰り返す。
各カラムはそれぞれのステップで何件を処理したかを記録し、障害調査や性能分析に使う。

```
[ItemReader]        [ItemProcessor]     [ItemWriter]
  READ_COUNT  →  (FILTER / SKIP)  →   WRITE_COUNT
                                           ↓
                                       COMMIT_COUNT（chunk ごとに +1）
```

**READ_COUNT**
ItemReader が DB やファイルから読み込んだ総件数。
`READ_COUNT` から後続のカウントを引いた差分が「実際に書き込まれなかった件数」の手がかりになる。

**WRITE_COUNT**
ItemWriter が DB などへ書き込んだ総件数。
F-32「処理件数」として画面に表示する値の取得元はここ。
`READ_COUNT` と一致していれば全件正常に処理されたと判断できる。

**FILTER_COUNT**
ItemProcessor が `null` を返してスキップした件数。
「読んだが書かなかった」件数であり、意図的な除外。
`READ_COUNT = WRITE_COUNT + FILTER_COUNT + *_SKIP_COUNT` が成立する。

**COMMIT_COUNT**
chunk のコミットが何回行われたかの回数。件数ではなくコミット回数である点に注意。
chunk サイズが 100 で 350 件処理した場合、`COMMIT_COUNT = 4`（100 + 100 + 100 + 50）になる。
異常に少ない場合は途中でロールバックが多発していた可能性がある。

**ROLLBACK_COUNT**
トランザクションがロールバックされた回数。
`0` であれば全 chunk が正常にコミットされている。
`ROLLBACK_COUNT > 0` の場合は `EXIT_MESSAGE` に記録されたスタックトレースと合わせて原因を調査する。

**READ_SKIP_COUNT / WRITE_SKIP_COUNT / PROCESS_SKIP_COUNT**
各ステップで例外が発生したがスキップ設定により処理を続行した件数。
`FILTER_COUNT` との違いは「例外が起きたが握りつぶした件数」であること。
スキップ件数が多い場合はデータ品質の問題を疑う。

> **このプロジェクトでの意図**
> `WRITE_COUNT` が F-32 の「処理件数」として表示する値の取得元になる。
> `ROLLBACK_COUNT > 0` の場合はバッチの一部が失敗しているサインとして活用できる。

---

### BATCH_STEP_EXECUTION_CONTEXT

**役割：Step の再開ポイント（チェックポイント）を保存する**

chunk 指向の Step では、一定件数処理するたびにコンテキスト（読み取り位置など）をここに保存する。
ジョブが途中で失敗した場合、このコンテキストを読み取って途中から再開できる。

| カラム                | 役割                                                                         |
| --------------------- | ---------------------------------------------------------------------------- |
| `STEP_EXECUTION_ID`   | PK（BATCH_STEP_EXECUTION への FK）                                           |
| `SHORT_CONTEXT`       | 2500 文字以内に収まる場合のコンテキスト JSON                                 |
| `SERIALIZED_CONTEXT` | 2500 文字を超える場合のシリアライズ済みコンテキスト |

---

### BATCH_JOB_EXECUTION_CONTEXT

**役割：ジョブ全体で共有するコンテキストを保存する**

`BATCH_STEP_EXECUTION_CONTEXT` が Step 単位なのに対し、こちらはジョブ全体で共有されるデータを保存する。
複数 Step 間でデータを受け渡す `ExecutionContext` がここに保存される。

| カラム               | 役割                                          |
| -------------------- | --------------------------------------------- |
| `JOB_EXECUTION_ID`   | PK（BATCH_JOB_EXECUTION への FK）             |
| `SHORT_CONTEXT`      | コンテキスト JSON（2500 文字以内）            |
| `SERIALIZED_CONTEXT` | 2500 文字を超える場合のシリアライズ済みデータ |

---

## シーケンスの役割

| シーケンス                 | 対象テーブルの PK                        |
| -------------------------- | ---------------------------------------- |
| `BATCH_JOB_SEQ`            | `BATCH_JOB_INSTANCE.JOB_INSTANCE_ID`     |
| `BATCH_JOB_EXECUTION_SEQ`  | `BATCH_JOB_EXECUTION.JOB_EXECUTION_ID`   |
| `BATCH_STEP_EXECUTION_SEQ` | `BATCH_STEP_EXECUTION.STEP_EXECUTION_ID` |

Spring Batch は起動時にこれらのシーケンスから ID を払い出す。
PostgreSQL のシーケンスを使うことで、MySQL/Oracle との差異を吸収している。

---

## テーブルの自動生成について

`spring.batch.jdbc.initialize-schema` を `always` に設定すると Spring Batch がテーブルを自動生成するが、
このプロジェクトでは **Flyway で明示的に管理する**（`V2__spring_batch_schema.sql`）。

理由：

- Flyway によるスキーマのバージョン管理と一元化
- `always` は本番環境では危険なため、`never` に固定して Flyway に委ねる方が安全
