import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";

export default async function RegisterPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
