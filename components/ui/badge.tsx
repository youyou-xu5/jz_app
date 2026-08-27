"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type Variant = "default" | "success" | "destructive" | "warning" | "outline" | "secondary";

const variantClasses: Record<Variant, string> = {
  default: "bg-primary text-primary-foreground",
  success: "bg-success text-success-foreground",
  destructive: "bg-destructive text-destructive-foreground",
  warning: "bg-warning text-warning-foreground",
  outline: "border border-input text-foreground",
  secondary: "bg-secondary text-secondary-foreground",
};

const Badge = ({
  className,
  variant = "default",
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { variant?: Variant }) => (
  <span
    className={cn(
      "inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium",
      variantClasses[variant],
      className
    )}
    {...props}
  />
);

export { Badge };
