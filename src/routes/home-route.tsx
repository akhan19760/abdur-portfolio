import { HomePage } from "@/pages/home-page"
import { usePageTitle } from "@/lib/use-page-title"

export function HomeRoute() {
  usePageTitle("Abdur | Portfolio")

  return <HomePage />
}
