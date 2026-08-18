import { STATUS_BARS } from "../constants"

export function SignalStatus() {
  return (
    <div
      className="pointer-events-none absolute z-20 flex flex-col gap-[5px]"
      style={{ left: "7%", top: "52%" }}
    >
      {STATUS_BARS.map(({ label, pct }) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-7 font-mono text-[7px] text-text/20">{label}</span>
          <div className="relative h-[2px] w-14 bg-text/5">
            <div
              className="js-status-bar absolute inset-y-0 left-0 bg-accent/35"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
