import { createContext, useContext, useState, type ReactNode } from 'react'
import { en } from './i18n/en'
import { no } from './i18n/no'
import {
  formatCurrency as formatCurrencyPure,
  formatDate as formatDatePure,
} from './format'

export type Language = 'en' | 'no'
export type Currency = 'EUR' | 'NOK' | 'SEK' | 'GBP'

const dictionaries = { en, no }
const LOCALES: Record<Language, string> = { en: 'en-GB', no: 'nb-NO' }
const LANG_KEY = 'stable-manager:language'
const CURRENCY_KEY = 'stable-manager:currency'

type Dict = typeof en
type Vars = Record<string, string | number>

function resolve(key: string, dict: Dict): string | undefined {
  return key.split('.').reduce<unknown>((node, part) => {
    if (node && typeof node === 'object' && part in node) {
      return (node as Record<string, unknown>)[part]
    }
    return undefined
  }, dict) as string | undefined
}

type PreferencesContextValue = {
  language: Language
  setLanguage: (lang: Language) => void
  currency: Currency
  setCurrency: (currency: Currency) => void
  t: (key: string, vars?: Vars) => string
  formatCurrency: (amount: number) => string
  formatDate: (dateStr: string | null) => string
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(LANG_KEY) as Language | null) || 'en',
  )
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(CURRENCY_KEY) as Currency | null) || 'EUR',
  )

  function setLanguage(lang: Language) {
    setLanguageState(lang)
    localStorage.setItem(LANG_KEY, lang)
  }

  function setCurrency(nextCurrency: Currency) {
    setCurrencyState(nextCurrency)
    localStorage.setItem(CURRENCY_KEY, nextCurrency)
  }

  function t(key: string, vars: Vars = {}): string {
    const template =
      resolve(key, dictionaries[language]) ?? resolve(key, dictionaries.en)
    if (typeof template !== 'string') return key
    return template.replace(/\{(\w+)\}/g, (match, name: string) =>
      vars[name] !== undefined ? String(vars[name]) : match,
    )
  }

  const locale = LOCALES[language]

  return (
    <PreferencesContext.Provider
      value={{
        language,
        setLanguage,
        currency,
        setCurrency,
        t,
        formatCurrency: (amount) =>
          formatCurrencyPure(amount, currency, locale),
        formatDate: (dateStr) => formatDatePure(dateStr, locale),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  )
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext)
  if (!ctx)
    throw new Error('usePreferences must be used within PreferencesProvider')
  return ctx
}
