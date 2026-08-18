// Contact form submission service — stub.
// Wire this up to a real integration (e.g. Resend, Formspree) when the Contact
// section is built. Kept as an explicit seam so the section component depends
// on an interface here rather than a concrete provider.
export async function sendContactMessage(): Promise<void> {
  throw new Error("sendContactMessage is not implemented yet.")
}
