import type { ComponentProps } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const alertVariants = cva("ui-alert", { variants: { variant: { default: "", destructive: "ui-alert-destructive" } }, defaultVariants: { variant: "default" } });

export function Alert({ className, variant, ...props }: ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return <div data-slot="alert" role="alert" className={cn(alertVariants({ variant }), className)} {...props} />;
}
export function AlertTitle({ className, ...props }: ComponentProps<"h2">) {
  return <h2 data-slot="alert-title" className={cn("ui-alert-title", className)} {...props} />;
}
export function AlertDescription({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="alert-description" className={cn("ui-alert-description", className)} {...props} />;
}
