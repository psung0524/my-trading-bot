import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().email("올바른 이메일을 입력하세요");
export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다")
  .max(128, "비밀번호가 너무 깁니다");

export const signupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력하세요").max(60),
  email: emailSchema,
  password: passwordSchema,
});
export type SignupInput = z.infer<typeof signupSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력하세요"),
});
export type LoginInput = z.infer<typeof loginSchema>;
