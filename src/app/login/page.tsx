import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { AuthForm } from "@/components/auth-form";
import { licenseEnabled } from "@/lib/license";

export default async function LoginPage() {
  if (await getSessionUserId()) redirect("/dashboard");
  return (
    <Suspense>
      <AuthForm mode="login" desktop={licenseEnabled()} />
    </Suspense>
  );
}
