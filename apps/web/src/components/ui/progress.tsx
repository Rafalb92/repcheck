import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.ComponentProps<"div"> & { value?: number; max?: number }) {
  const pct = Math.min(100, Math.max(0, ((value ?? 0) / max) * 100))

  return (
    <div
      data-slot="progress"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("relative h-2 w-full overflow-hidden rounded-full bg-secondary", className)}
      {...props}
    >
      <div
        className="h-full w-full flex-1 bg-primary transition-all duration-300 ease-in-out"
        style={{ transform: `translateX(-${100 - pct}%)` }}
      />
    </div>
  )
}

export { Progress }
