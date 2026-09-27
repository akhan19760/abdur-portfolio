import { cn } from "@/lib/utils"
import { LOG_LINES } from "../constants"

export function TerminalLog() {
  return (
    // Hidden on short screens (a phone on its side), where it would run into the counter
    <div className="absolute bottom-8 left-6 z-20 flex flex-col gap-[3px] [@media(max-height:500px)]:hidden">
      {LOG_LINES.map((line) => (
        <span
          key={line.text}
          className={cn(
            "js-log-line font-mono text-[10px] tracking-wider opacity-0",
            line.isError ? "text-[#ff4444]/80" : "text-accent/50"
          )}
        >
          {line.text}
        </span>
      ))}
    </div>
  )
}
