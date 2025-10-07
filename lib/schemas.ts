import { z } from "zod";

const finiteNumber = (message: string) =>
  z.number().refine((value) => Number.isFinite(value), message);

export const bodySpecSchema = z.object({
  height: finiteNumber("身長は数値で入力してください")
    .min(130, "身長は130cm以上で入力してください")
    .max(210, "身長は210cm以下で入力してください"),
  shoulder: finiteNumber("肩幅は数値で入力してください")
    .min(30, "肩幅は30cm以上で入力してください")
    .max(60, "肩幅は60cm以下で入力してください"),
});

export const clothSpecSchema = z.object({
  shoulder: finiteNumber("肩幅は数値で入力してください")
    .min(30, "肩幅は30cm以上で入力してください")
    .max(80, "肩幅は80cm以下で入力してください"),
  length: finiteNumber("着丈は数値で入力してください")
    .min(30, "着丈は30cm以上で入力してください")
    .max(80, "着丈は80cm以下で入力してください"),
});

export const tryOnRequestSchema = z.object({
  userImageB64: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg);base64,/i, "自画像を選択してください"),
  clothImageB64: z
    .string()
    .regex(/^data:image\/(png|jpeg|jpg);base64,/i, "服画像を選択してください"),
  body: bodySpecSchema,
  cloth: clothSpecSchema,
});

export type BodySpecInput = z.infer<typeof bodySpecSchema>;
export type ClothSpecInput = z.infer<typeof clothSpecSchema>;
