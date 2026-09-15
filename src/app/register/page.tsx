import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { licenseEnabled } from "@/lib/license";

export default async function RegisterPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  if (licenseEnabled()) redirect("/login"); // no desktop as contas são criadas pelo administrador
  return (
    <Suspense>
      <AuthForm mode="register" />
    </Suspense>
  );
}
