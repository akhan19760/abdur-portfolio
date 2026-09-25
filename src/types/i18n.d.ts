/**
 * Augments i18next's CustomTypeOptions so that `useTranslation()` returns a
 * fully-typed `t()` function — translation keys are validated at compile time
 * and autocomplete works in the IDE.
 */

import type en from "@/locales/en.json"

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation"
    resources: {
      translation: typeof en
    }
  }
}
