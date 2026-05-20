import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import ShowsClient from '@/components/ShowsClient'

export const metadata: Metadata = {
  title: 'TV Shows — Movora',
  description: 'Browse Hindi and English TV shows',
}

interface Props {
  searchParams: Promise<Record<string, string | undefined>>
}

export default async function ShowsPage({ searchParams }: Props) {
  const params = await searchParams
  return (
    <>
      <Sidebar />
      <ShowsClient
        initialGenre={params.genre}
        initialYear={params.year}
        initialLanguage={params.language}
        initialSort={params.sort}
      />
    </>
  )
}
