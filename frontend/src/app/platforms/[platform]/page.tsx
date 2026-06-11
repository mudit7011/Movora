import { notFound } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { PLATFORMS, getPlatformBySlug } from '@/lib/platforms'
import PlatformPageClient from './PlatformPageClient'

interface Props {
  params: { platform: string }
}

// All 6 platform slugs are static — pre-build them all at deploy time.
// Unknown slugs hit notFound() at request time (default dynamicParams behaviour).
export function generateStaticParams() {
  return PLATFORMS.map(p => ({ platform: p.slug }))
}

export default function PlatformPage({ params }: Props) {
  const platform = getPlatformBySlug(params.platform)
  if (!platform) notFound()
  return (
    <>
      <Sidebar />
      <PlatformPageClient platform={platform} />
    </>
  )
}
