import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("motion-shimmer rounded-2xl bg-muted", className)}
      {...props}
    />
  )
}

export { Skeleton }
