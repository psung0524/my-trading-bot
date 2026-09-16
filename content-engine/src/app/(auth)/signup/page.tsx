import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/auth";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "회원가입" };

export default async function SignupPage() {
  if (await getCurrentUser()) redirect("/onboarding");
  return <SignupForm />;
}
