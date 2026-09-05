"use client"

import * as React from "react"
import * as SliderPrimitive from "@radix-ui/react-slider"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const sliderVariants = cva(
  "relative flex w-full touch-none select-none items-center",
  {
    variants: {
      variant: {
        default: "group",
        timetrack: "group [&_.thumb]:opacity-0 [&_.thumb]:group-hover:opacity-100 [&_.thumb]:transition-opacity",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

interface SliderProps
  extends React.ComponentPropsWithoutRef<typeof SliderPrimitive.Root>,
    VariantProps<typeof sliderVariants> {}

const Slider = React.forwardRef<
  React.ElementRef<typeof SliderPrimitive.Root>,
  SliderProps
>(({ className, variant, ...props }, ref) => (
  <SliderPrimitive.Root
    ref={ref}
    className={cn(sliderVariants({ variant, className }))}
    {...props}
  >
    <SliderPrimitive.Track className="relative h-1 w-full grow overflow-hidden rounded-full bg-[var(--tl-hint-strong)]">
      <SliderPrimitive.Range className="absolute h-full bg-[#8a8a8a]" />
    </SliderPrimitive.Track>
    <SliderPrimitive.Thumb className="thumb block h-4 w-4 rounded-full bg-white shadow-[0_0_0_1px_rgba(0,0,0,0.12),0_1px_3px_rgba(0,0,0,0.2)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" />
  </SliderPrimitive.Root>
))
Slider.displayName = SliderPrimitive.Root.displayName

export { Slider }
