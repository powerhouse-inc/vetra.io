import type { Metadata } from 'next'
import { LegalDocument } from '@/modules/shared/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Terms & Conditions',
  description: 'The terms that apply when you use Vetra, Vetra Studio and Vetra Cloud.',
}

export default function TermsAndConditionsPage() {
  return <LegalDocument />
}
