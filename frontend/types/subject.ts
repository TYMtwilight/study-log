// 科目マスター
// API仕様書 セクション5の Subject に対応する
export type Subject = {
  id: string // UUID
  name: string // 科目名（1～50文字）
  createdAt: string // 作成日時
}
