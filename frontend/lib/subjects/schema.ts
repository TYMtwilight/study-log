import { z } from 'zod'

export const subjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, '科目名を入力してください')
    .max(50, '科目名は50文字以内で入力してください'),
})

export type SubjectInput = z.infer<typeof subjectSchema>
