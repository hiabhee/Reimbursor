import * as React from "react"
import { cn } from "@/lib/utils"

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-8 w-full px-2 text-[13px] text-foreground placeholder:text-muted-foreground bg-background border border-border rounded-md focus:border-ring focus:ring-2 focus:ring-ring/15 focus-visible:outline-2 focus-visible:outline-ring transition-colors",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
