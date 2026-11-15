import { redirect } from 'next/navigation'
import { BRANDS, brandSlug } from '@/lib/metrics'

export default function BrandIndex() {
  redirect(`/brand/${brandSlug(BRANDS[0])}`)
}
