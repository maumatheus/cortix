"use client";

import * as React from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/* ---------- Tooltip ---------- */

export const TipProvider = TooltipPrimitive.Provider;

export function Tip({ label, children, side = "bottom" }: { label: React.ReactNode; children: React.ReactNode; side?: "top" | "bottom" | "left" | "right" }) {
  return (
    <TooltipPrimitive.Root delayDuration={300}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content side={side} sideOffset={6} className="z-[60] max-w-64 rounded-md border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-xl">
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

/* ---------- Dropdown ---------- */

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;

export function MenuContent({ className, align = "start", children, ...props }: React.ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn("z-[60] min-w-48 overflow-hidden rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-2xl outline-none", className)}
        {...props}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function MenuItem({ className, children, checked, ...props }: React.ComponentProps<typeof DropdownMenu.Item> & { checked?: boolean }) {
  return (
    <DropdownMenu.Item
      className={cn(
        "flex cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none data-[highlighted]:bg-secondary data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    >
      {children}
      {checked ? <Check className="ml-auto size-4 text-primary" /> : null}
    </DropdownMenu.Item>
  );
}

export function MenuLabel({ className, ...props }: React.ComponentProps<typeof DropdownMenu.Label>) {
  return <DropdownMenu.Label className={cn("eyebrow px-2.5 pb-1 pt-2", className)} {...props} />;
}

export function MenuSeparator() {
  return <DropdownMenu.Separator className="my-1 h-px bg-border" />;
}

/* ---------- Popover ---------- */

export const Pop = Popover.Root;
export const PopTrigger = Popover.Trigger;
export const PopAnchor = Popover.Anchor;

export function PopContent({ className, children, ...props }: React.ComponentProps<typeof Popover.Content>) {
  return (
    <Popover.Portal>
      <Popover.Content sideOffset={6} className={cn("z-[60] w-72 rounded-xl border bg-popover p-3 text-popover-foreground shadow-2xl outline-none", className)} {...props}>
        {children}
      </Popover.Content>
    </Popover.Portal>
  );
}

/* ---------- botões de barra ---------- */

export const ToolButton = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }>(({ className, active, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    className={cn(
      "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40 [&_svg]:size-4 cursor-pointer",
      active && "bg-primary/15 text-primary hover:bg-primary/20 hover:text-primary",
      className,
    )}
    {...props}
  />
));
ToolButton.displayName = "ToolButton";
