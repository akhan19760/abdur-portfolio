import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { axe } from "vitest-axe"
import { ContactDetails } from "./contact-details"

const labels = {
  copy: "Copy email",
  copied: "Email address copied",
  copyFailed: "Couldn't copy it.",
  links: "Elsewhere",
  newTab: "opens in a new tab",
}
const links = [
  { id: "linkedin", name: "LinkedIn", href: "https://linkedin.com/in/someone" },
  { id: "github", name: "GitHub", href: "https://github.com/someone" },
]

function renderDetails(centered = false) {
  return render(
    <ContactDetails
      intro="Want to say hello?"
      email="someone@example.com"
      links={links}
      labels={labels}
      centered={centered}
    />
  )
}

describe("ContactDetails", () => {
  afterEach(() => vi.restoreAllMocks())

  it("invites people in, with the address as a mail link", () => {
    renderDetails()
    expect(screen.getByText("Want to say hello?")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "someone@example.com" })).toHaveAttribute(
      "href",
      "mailto:someone@example.com"
    )
  })

  it("lists the other places, each opening safely in a new tab", () => {
    renderDetails()
    const list = screen.getByRole("list", { name: "Elsewhere" })
    const items = within(list).getAllByRole("link")
    expect(items).toHaveLength(2)
    items.forEach((link, i) => {
      expect(link).toHaveAttribute("href", links[i].href)
      expect(link).toHaveAttribute("target", "_blank")
      expect(link).toHaveAttribute("rel", "noopener noreferrer")
      expect(link).toHaveAccessibleName(`${links[i].name} (opens in a new tab)`)
    })
  })

  it("copies the address and announces it", async () => {
    const user = userEvent.setup()
    // user-event installs its own clipboard; watch it
    renderDetails()
    const writeText = vi.spyOn(navigator.clipboard, "writeText")
    await user.click(screen.getByRole("button", { name: "Copy email" }))
    expect(writeText).toHaveBeenCalledWith("someone@example.com")
    expect(screen.getByRole("status")).toHaveTextContent("Email address copied")
  })

  it("says so when it can't copy", async () => {
    const user = userEvent.setup()
    renderDetails()
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"))
    await user.click(screen.getByRole("button", { name: "Copy email" }))
    expect(screen.getByRole("status")).toHaveTextContent("Couldn't copy it.")
  })

  it("keeps the status empty until something's been copied", () => {
    renderDetails()
    expect(screen.getByRole("status")).toBeEmptyDOMElement()
  })

  it("can be centred", () => {
    const { container, rerender } = renderDetails()
    expect(container.firstElementChild).not.toHaveClass("text-center")
    rerender(
      <ContactDetails
        intro="Want to say hello?"
        email="someone@example.com"
        links={links}
        labels={labels}
        centered
      />
    )
    expect(container.firstElementChild).toHaveClass("text-center")
  })

  it("reaches everything by keyboard, in order", async () => {
    const user = userEvent.setup()
    renderDetails()
    await user.tab()
    expect(screen.getByRole("link", { name: "someone@example.com" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("button", { name: "Copy email" })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("link", { name: /LinkedIn/ })).toHaveFocus()
    await user.tab()
    expect(screen.getByRole("link", { name: /GitHub/ })).toHaveFocus()
  })

  it("has no accessibility violations", async () => {
    const { container } = renderDetails(true)
    expect(await axe(container)).toHaveNoViolations()
  })
})
