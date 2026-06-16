import type { Metadata } from 'next'
import { LegalDocument } from '@/modules/shared/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
}

export default function TermsAndConditionsPage() {
  return <LegalDocument />
}
