import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ToastProvider } from "@/components/ui/toast";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const displayName = profile?.display_name || user.email?.split("@")[0] || "User";

  return (
    <div className="min-h-screen bg-muted/30">
      <Sidebar />
      <MobileNav />
      <div className="md:pl-56">
        <header className="hidden md:flex h-14 items-center justify-between border-b bg-card px-6">
          <p className="text-sm text-muted-foreground">
            你好, <span className="font-medium text-foreground">{displayName}</span>
          </p>
        </header>
        <main className="p-4 md:p-6 max-w-[1400px] mx-auto">
          <ToastProvider>{children}</ToastProvider>
        </main>
      </div>
    </div>
  );
}
