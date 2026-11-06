import { useAuth } from './AuthContext'

// Only VAT-registered stables add VAT or show it.
export function useVatRegistered(): boolean {
  const { profile } = useAuth()
  return profile?.stable?.vat_registered ?? false
}
