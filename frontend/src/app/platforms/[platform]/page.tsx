import { notFound } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { PLATFORMS, getPlatformBySlug } from '@/lib/platforms'
import PlatformPageClient from './PlatformPageClient'

interface Props {
  params: Promise<{ platform: string }>
}

// All 6 platform slugs are static — pre-build them all at deploy time.
// Unknown slugs hit notFound() at request time (default dynamicParams behaviour).
export function generateStaticParams() {
  return PLATFORMS.map(p => ({ platform: p.slug }))
}

export default async function PlatformPage({ params }: Props) {
  const { platform: platformSlug } = await params
  const platform = getPlatformBySlug(platformSlug)
  if (!platform) notFound()
  return (
    <>
      <Sidebar />
      <PlatformPageClient platform={platform} />
    </>
  )
}
