// HTTP エラーをステータスコード付きで表現するカスタムエラークラス
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export async function parseErrorBody(res: Response): Promise<never> {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.message ?? `エラー (${res.status})`)
}