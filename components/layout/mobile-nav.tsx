"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  ArrowLeftRight,
  Calculator,
  BarChart3,
  Settings,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logoutAction } from "@/app/(dashboard)/actions";

const navItems = [
  { href: "/dashboard", label: "概览", icon: LayoutDashboard },
  { href: "/transactions", label: "账单", icon: Receipt },
  { href: "/accounts", label: "账户", icon: Wallet },
  { href: "/exchange", label: "换汇", icon: ArrowLeftRight },
  { href: "/converter", label: "换算器", icon: Calculator },
  { href: "/statistics", label: "统计", icon: BarChart3 },
  { href: "/settings", label: "设置", icon: Settings },
];

export function MobileNav() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <div className="flex h-14 items-center border-b px-4 bg-card">
        <button
          onClick={() => setOpen(!open)}
          className="p-2 -ml-2 text-foreground"
          aria-label="Toggle menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="ml-2 text-lg font-semibold">Money Book</span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-0 top-0 h-full w-64 bg-card shadow-lg">
            <div className="flex h-14 items-center justify-between border-b px-4">
              <span className="text-lg font-semibold">Money Book</span>
              <button
                onClick={() => setOpen(false)}
                className="p-2 -mr-2 text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="space-y-1 p-3">
              {navItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-accent"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent"
                >
                  <LogOut className="h-4 w-4" />
                  登出
                </button>
              </form>
            </nav>
          </div>
        </div>
      )}
    </div>
  );
}
