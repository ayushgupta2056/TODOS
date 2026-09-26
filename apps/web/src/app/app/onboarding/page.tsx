import { Logo } from "@glimpse/ui";
import { redirect } from "next/navigation";
import { getStudio, getUser } from "@/lib/auth";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  if (!(await getUser())) redirect("/login");
  if (await getStudio()) redirect("/app");
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-10 px-4 py-12">
      <Logo />
      <div className="grid gap-3">
        <p className="eyebrow">Step 1 of 2</p>
        <h1 className="font-display text-5xl leading-none">What&rsquo;s your studio called?</h1>
        <p className="text-muted">Guests see this name on your event pages. You can change it later.</p>
      </div>
      <OnboardingForm />
    </main>
  );
}
