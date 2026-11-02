import * as React from "react"

import { cn } from "@/lib/utils"

/** Keys that make a number input hold something that is not a number (exponent, sign). */
const BLOCKED_NUMBER_KEYS = new Set(["e", "E", "+", "-"])

/**
 * `type="number"` inputs are hardened (#222, ADR-0005): the type stays "number" so `.value` is
 * period-normalised, but `e`, `E`, `+` and `-` cannot be typed and the mouse wheel cannot change
 * the value (a wheel over the field drops its focus, which is what stops the browser stepping it).
 * Pass `min`, `max` and `step` from the field rules. Invalid state is `aria-invalid` (red) and a
 * warning is `data-warning` (amber) -- see `FieldError` / `FieldWarning` in ./field.
 */
function Input({ className, type, onKeyDown, onWheel, ...props }: React.ComponentProps<"input">) {
  const hardened =
    type === "number"
      ? {
          onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => {
            onKeyDown?.(e)
            if (BLOCKED_NUMBER_KEYS.has(e.key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
              e.preventDefault()
            }
          },
          onWheel: (e: React.WheelEvent<HTMLInputElement>) => {
            onWheel?.(e)
            e.currentTarget.blur()
          },
        }
      : { onKeyDown, onWheel }

  return (
    <input
      type={type}
      {...hardened}
      data-slot="input"
      className={cn(
        "h-10 w-full min-w-0 border border-transparent border-b-input bg-transparent px-0 py-1 text-base transition-[color,border-color] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-b-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-b-destructive data-[warning=true]:border-b-amber-500 md:text-sm dark:aria-invalid:border-b-destructive/50 dark:data-[warning=true]:border-b-amber-400",
        className
      )}
      {...props}
    />
  )
}

export { Input }
