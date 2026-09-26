/**
 * i18n initialisation — react-i18next + i18next.
 *
 * Import this module once at the application entry point (main.tsx) before any
 * component renders. After that, `useTranslation()` is available everywhere
 * without a Provider because i18next is a singleton.
 *
 * Supported locales:
 *   en  — English (default)
 *   ur  — Roman Urdu (Urdu written in Latin script)
 */

import i18next from "i18next"
import { initReactI18next } from "react-i18next"

import en from "@/locales/en.json"
import ur from "@/locales/ur.json"

/**
 * BCP 47 tags for <html lang>. Roman Urdu is Urdu in Latin script, so it is
 * tagged `ur-Latn` — plain `ur` would imply Arabic script to assistive tech.
 */
export const HTML_LANG = {
  en: "en",
  ur: "ur-Latn",
} as const

// Keep <html lang> in sync with the active locale (WCAG 3.1.1 Language of Page).
// Registered before init() so the initial language is applied too.
i18next.on("languageChanged", (lng) => {
  document.documentElement.lang = HTML_LANG[lng as keyof typeof HTML_LANG] ?? lng
})

i18next.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    ur: { translation: ur },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: {
    // React already escapes output — no double-escaping needed
    escapeValue: false,
  },
})

export default i18next
