import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border border-[#E5E0DF] bg-white px-2.5 py-0.5 text-sm text-[#2A161B] transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-xs/relaxed file:font-medium file:text-[#2A161B] placeholder:text-[#8B8481] focus-visible:border-[#6B132B] focus-visible:ring-2 focus-visible:ring-[#6B132B]/20 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-[#6B132B] aria-invalid:ring-2 aria-invalid:ring-[#6B132B]/20 md:text-xs/relaxed",
        className
      )}
      {...props}
    />
  )
}

export { Input }
