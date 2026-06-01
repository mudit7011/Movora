import { notFound } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import { getPlatformBySlug } from '@/lib/platforms'
import PlatformPageClient from './PlatformPageClient'

interface Props {
  params: { platform: string }
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
