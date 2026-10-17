import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import { en } from './i18n/en'
import { no } from './i18n/no'
import {
  formatCurrency as formatCurrencyPure,
  formatDate as formatDatePure,
} from './format'

export type Language = 'en' | 'no'
export type Currency = 'EUR' | 'NOK' | 'SEK' | 'GBP'
export type Theme = 'light' | 'dark' | 'system'

const dictionaries = { en, no }
const LOCALES: Record<Language, string> = { en: 'en-GB', no: 'nb-NO' }
const LANG_KEY = 'stable-manager:language'
const CURRENCY_KEY = 'stable-manager:currency'
const THEME_KEY = 'stable-manager:theme'

function systemPrefersDark(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

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
  theme: Theme
  setTheme: (theme: Theme) => void
  t: (key: string, vars?: Vars) => string
  formatCurrency: (amount: number) => string
  formatDate: (dateStr: string | null) => string
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(
  undefined,
)

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem(LANG_KEY) as Language | null) || 'no',
  )
  const [currency, setCurrencyState] = useState<Currency>(
    () => (localStorage.getItem(CURRENCY_KEY) as Currency | null) || 'NOK',
  )
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(THEME_KEY) as Theme | null) || 'system',
  )

  function setLanguage(lang: Language) {
    setLanguageState(lang)
    localStorage.setItem(LANG_KEY, lang)
  }

  function setCurrency(nextCurrency: Currency) {
    setCurrencyState(nextCurrency)
    localStorage.setItem(CURRENCY_KEY, nextCurrency)
  }

  function setTheme(nextTheme: Theme) {
    setThemeState(nextTheme)
    localStorage.setItem(THEME_KEY, nextTheme)
  }

  useEffect(() => {
    function applyTheme() {
      const isDark = theme === 'dark' || (theme === 'system' && systemPrefersDark())
      document.documentElement.classList.toggle('dark', isDark)
    }
    applyTheme()
    if (theme !== 'system') return
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', applyTheme)
    return () => media.removeEventListener('change', applyTheme)
  }, [theme])

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
        theme,
        setTheme,
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
