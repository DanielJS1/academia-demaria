import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

export function FieldSet({ className, ...props }: ComponentProps<"fieldset">) {
  return <fieldset data-slot="field-set" className={cn("ui-field-set", className)} {...props} />;
}
export function FieldLegend({ className, ...props }: ComponentProps<"legend">) {
  return <legend data-slot="field-legend" className={cn("ui-field-legend", className)} {...props} />;
}
export function FieldGroup({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field-group" className={cn("ui-field-group", className)} {...props} />;
}
export function Field({ className, ...props }: ComponentProps<"div">) {
  return <div data-slot="field" className={cn("ui-field", className)} {...props} />;
}
export function FieldLabel({ className, ...props }: ComponentProps<"label">) {
  return <label data-slot="field-label" className={cn("ui-field-label", className)} {...props} />;
}
export function FieldDescription({ className, ...props }: ComponentProps<"p">) {
  return <p data-slot="field-description" className={cn("ui-field-description", className)} {...props} />;
}
