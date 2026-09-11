import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-mono text-sm font-medium tracking-tight", className)}>
      <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-foreground text-background">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M6 0L11 3V7L6 12L1 7V3L6 0Z" fill="currentColor" fillOpacity="0.9" />
          <path d="M6 2.4L4 3.6V6.3L6 9L8 6.3V3.6L6 2.4Z" fill="hsl(var(--background))" />
        </svg>
      </span>
      AuthForge
    </span>
  );
}
