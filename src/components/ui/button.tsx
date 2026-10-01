import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-2 disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-[#dc2626] text-white hover:bg-[#b91c1c]",
        outline: "border border-border bg-white text-[#212121] hover:bg-accent",
        secondary: "bg-[#f7f7f7] text-[#212121] hover:bg-[#ebebeb]",
        ghost: "hover:bg-[#f5f5f5] text-[#212121]",
        link: "text-primary underline-offset-4 hover:underline",
        success: "bg-[#16a34a] text-white hover:bg-[#15803d]",
        warning: "bg-[#ea580c] text-white hover:bg-[#c2410c]",
      },
      size: {
        default: "h-8 px-3 text-[12px]",
        sm: "h-7 px-2.5 text-[11px]",
        lg: "h-9 px-4 text-[13px]",
        icon: "h-8 w-8",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
