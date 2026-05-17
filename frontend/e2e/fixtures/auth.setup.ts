import { test as setup } from '@playwright/test'
import { encode } from '@auth/core/jwt'

import { authFile } from './auth-file'

setup('認証済み状態のセットアップ', async ({ page }) => {
  /* ➀Auth.js と同じ encode() 関数・同じ AUTH_SECRET を使ってセッションクッキーの値を生成する。
   *   Auth.js はクッキーを受け取るたびに AUTH_SECRET で検証するため、
   *   同じ関数・同じ SECRET で生成すれば「本物」として受け入れられる。
   */
  const sessionToken = await encode({
    token: {
      name: 'テストユーザー',
      email: 'test@example.com',
      picture: null, // プロフィール画像URL（テストでは不要なのでnull）
      sub: 'test-user-id', // Auth.jsがユーザーを一意に識別するID
      id: 'test-user-id', // auth.js の jwt コールバックで追加したカスタムフィールド（token.id）
    },
    secret: process.env.AUTH_SECRET!,
    /* Auth.js はセッションクッキーを検証するとき、 クッキーの値だけでなく
     * クッキー名（authjs.session-token）も検証の計算に組み込んでいる。
     * encode() でトークンを生成するときも同じクッキー名を渡さないと
     * 計算結果がずれて Auth.js に偽物と判定される。
     */
    salt: 'authjs.session-token',
  })

  // ➁生成したクッキーをブラウザに直接注入する。これでブラウザが「ログイン済み」の状態になる。
  await page.context().addCookies([
    {
      name: 'authjs.session-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/', // このクッキーを送るパス ※ / はすべてのパスに送ることを意味する
      httpOnly: true, // JavaScript からクッキーを読み取れなくする設定
      secure: false, // true にすると HTTPS通信のときだけクッキーを送る
      sameSite: 'Lax', // Lax にすると別サイトからの POST ではクッキーを送らなくなる
    },
  ])

  /* ➂ブラウザのクッキー状態をファイルに書き出す。
   *   storageState はブラウザが持つデータ（クッキー・localStrage など）の状態をまるごと
   *   ファイルに保存・復元するPlaywright の機能。
   *   auth.setup.ts（事前準備）と logout.spec.ts（テスト本体）は別プロセスで実行されるため、
   *   プロセスをまたいでブラウザの状態を引き継ぐにはいったんファイルに書き出す必要がある。
   *   logout.spec.ts は playwright.config.ts の storageState: authfile の設定によって
   *   このファイルをテスト開始時に自動で読み込むため、最初からログイン済み状態でテストが始まる。
   */
  await page.context().storageState({ path: authFile })
})
