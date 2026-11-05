import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { auth0 } from "@/lib/auth0";

export const metadata: Metadata = { title: "Dashboard" };

async function DashboardContent() {
  const session = await auth0.getSession();
  if (!session) redirect("/sign-in");

  return <h1 className="text-xl font-medium tracking-tight">Coming soon</h1>;
}

export default function DashboardPage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-black px-6 text-zinc-100" style={{ fontFamily: "var(--font-geist-sans), sans-serif" }}>
      <Suspense fallback={null}>
        <DashboardContent />
      </Suspense>
    </main>
  );
}
