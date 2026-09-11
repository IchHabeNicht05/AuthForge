import { cn } from "@/lib/utils";

export function CodeBlock({
  children,
  className,
  label,
}: {
  children: string;
  className?: string;
  label?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-card", className)}>
      {label ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-warning/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-success/60" />
          <span className="ml-2 font-mono text-xs text-muted-foreground">{label}</span>
        </div>
      ) : null}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-foreground/90">{children}</code>
      </pre>
    </div>
  );
}
