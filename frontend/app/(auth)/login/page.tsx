import { redirect } from "next/navigation"
import { FaGoogle } from "react-icons/fa"

import { auth, signIn } from "@/auth"

/*
    Google認証が失敗した場合、Auth.js は /login?error=OAuthCallbackError へ 302 リダイレクトする。
    その後、ブラウザが /login?error=OAuthCallbackeError を開く際に URLのクエリパラメータを受け取れるよう、
    searchParamsの型として { error?: string } の Promise オブジェクトを指定している。
 */
export default async function LoginPage({
    searchParams,
}: {
    searchParams: Promise<{ error?: string}>
}) {
    const session = await auth()

    // ログイン済みならダッシュボードへ
    if(session) redirect("/")

    const { error } = await searchParams
    const hasError = !!error

    return (
        <div className="flex min-h-screen items-center justify-center bg-gray-200">
            <div className="w-full max-w-sm rounded-2xl p-8 shadow-md bg-white">
                <h1 className="text-center text-2xl font-bold text-gray-900">
                    STUDY LOG
                </h1>
                <p className="text-center text-xl mb-2">ログイン</p>
                <p className="mb-8 text-center text-sm text-gray-500">
                    Google アカウントでログインしてアプリにアクセスします
                </p>
                {hasError && (
                    <p className="mb-4 text-center text-sm text-red-500">
                        ログインに失敗しました。もう一度お試しください
                    </p>
                )}
                {/* Server Action でサインインを呼び出す */}
                <form
                    action={async()=> {
                        "use server"
                        await signIn("google", { redirectTo: "/" })
                    }}
                >
                    <button
                        type="submit"
                        className="flex w-full items-center justify-center gap-3 rounded-lg border
                        border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-600 
                        shadow-sm hover:bg-gray-500 hover:text-white transition-colors cursor-pointer"
                    >
                        <FaGoogle className="h-5 w-5"/>
                        Google でログイン
                    </button>
                </form>
            </div>
        </div>
    )
}