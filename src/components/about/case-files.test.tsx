import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi } from "vitest"
import { axe } from "vitest-axe"
import { CaseFiles } from "./case-files"

const FILES = [
  {
    id: "line-0-0",
    code: "LOG_01",
    group: "Experience",
    org: "Acme",
    period: "2022 – NOW",
    role: "Frontend Developer",
  },
  {
    id: "line-0-1",
    code: "LOG_02",
    group: "Experience",
    org: "Globex",
    period: "2020 – 2022",
    role: "Junior Developer",
  },
  {
    id: "line-1-0",
    code: "LOG_03",
    group: "Education",
    org: "Uni",
    period: "2016 – 2020",
    role: "BSc",
  },
]

const LABELS = {
  file: "CASE FILE",
  classified: "CLASSIFIED",
  decrypted: "DECRYPTED",
  hold: "Hold your light to decrypt",
  decryptAll: "Decrypt all",
  count: (done: number, total: number) => "DECRYPTED " + done + "/" + total,
  complete: "FIELD LOG DECRYPTED",
}

type Options = {
  decrypted?: string[]
  depth?: boolean
  onDecrypt?: (id: string) => void
  onDecryptAll?: () => void
}

function renderFiles({
  decrypted = [],
  depth = true,
  onDecrypt = vi.fn(),
  onDecryptAll = vi.fn(),
}: Options = {}) {
  return render(
    <CaseFiles
      files={FILES}
      isDecrypted={(id) => decrypted.includes(id)}
      onDecrypt={onDecrypt}
      onDecryptAll={onDecryptAll}
      allDecrypted={decrypted.length === FILES.length}
      labels={LABELS}
      depth={depth}
    />
  )
}

const card = (name: RegExp) => screen.getByRole("button", { name })

describe("CaseFiles", () => {
  it("names every card with its full entry", () => {
    renderFiles()
    expect(
      screen.getByRole("button", {
        name: "Experience: Frontend Developer, Acme, 2022 – NOW",
      })
    ).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Education: BSc, Uni, 2016 – 2020" })
    ).toBeInTheDocument()
  })

  it("makes cards light targets that can be charged until decrypted", () => {
    renderFiles({ decrypted: ["line-0-1"] })
    expect(card(/Acme/)).toHaveAttribute("data-light")
    expect(card(/Acme/)).toHaveAttribute("data-line-id", "line-0-0")
    expect(card(/Acme/)).toHaveAttribute("data-charge")
    expect(card(/Globex/)).not.toHaveAttribute("data-charge")
    expect(card(/Globex/)).toHaveAttribute("data-decrypted")
  })

  it("flips a decrypted card over", () => {
    renderFiles({ decrypted: ["line-0-0"] })
    expect(card(/Acme/).firstElementChild?.className).toContain("rotateY(180deg)")
    expect(card(/Globex/).firstElementChild?.className).not.toContain("rotateY(180deg)")
  })

  it("decrypts a card on click", async () => {
    const user = userEvent.setup()
    const onDecrypt = vi.fn()
    renderFiles({ onDecrypt })
    await user.click(card(/Globex/))
    expect(onDecrypt).toHaveBeenCalledWith("line-0-1")
  })

  it("decrypts a card on keyboard focus", async () => {
    const user = userEvent.setup()
    const onDecrypt = vi.fn()
    renderFiles({ onDecrypt })
    await user.tab()
    expect(onDecrypt).toHaveBeenCalledWith("line-0-0")
  })

  it("fills the encrypted faces with scrambled glyphs", () => {
    const { container } = renderFiles()
    const noise = container.querySelector("[data-scramble]")
    expect(noise?.textContent?.length).toBeGreaterThan(20)
    expect(noise?.closest('[aria-hidden="true"]')).not.toBeNull()
  })

  it("places cards around the carousel in depth mode", () => {
    renderFiles()
    expect(card(/Acme/).style.getPropertyValue("--a")).toBe("-32deg")
    expect(card(/Globex/).style.getPropertyValue("--a")).toBe("0deg")
  })

  it("counts decrypted files, then announces completion", () => {
    const { unmount } = renderFiles({ decrypted: ["line-0-0"] })
    expect(screen.getByText("DECRYPTED 1/3")).toBeInTheDocument()
    unmount()
    renderFiles({ decrypted: FILES.map((f) => f.id) })
    expect(screen.getByText("FIELD LOG DECRYPTED")).toBeInTheDocument()
  })

  it("decrypts everything from the button, which goes once all are open", async () => {
    const user = userEvent.setup()
    const onDecryptAll = vi.fn()
    const { unmount } = renderFiles({ onDecryptAll })
    await user.click(screen.getByRole("button", { name: "Decrypt all" }))
    expect(onDecryptAll).toHaveBeenCalledOnce()
    unmount()
    renderFiles({ decrypted: FILES.map((f) => f.id) })
    expect(screen.queryByRole("button", { name: "Decrypt all" })).not.toBeInTheDocument()
  })

  it("lays cards out in a grid in the flat fallback", () => {
    renderFiles({ depth: false })
    expect(card(/Acme/).style.getPropertyValue("--a")).toBe("")
  })

  it("passes axe accessibility audit", async () => {
    const { container } = renderFiles({ decrypted: ["line-0-0"] })
    expect(await axe(container)).toHaveNoViolations()
  })
})
