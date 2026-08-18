import { HomePage } from "@/pages/home-page"
import { usePageTitle } from "@/hooks/shared/use-page-title"
import { SITE_CONFIG } from "@/constants/site-config"

export function HomeRoute() {
  usePageTitle(SITE_CONFIG.title)

  return <HomePage />
}
