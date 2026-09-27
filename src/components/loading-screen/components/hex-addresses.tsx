import { HEX_ADDRESSES } from "../constants"

export function HexAddresses() {
  return (
    <div className="absolute bottom-[160px] right-6 z-20 hidden flex-col items-end gap-[2px] sm:flex">
      {HEX_ADDRESSES.map((addr) => (
        <span key={addr} className="font-mono text-[9px] tracking-wider text-text/15">
          {addr}
        </span>
      ))}
    </div>
  )
}
