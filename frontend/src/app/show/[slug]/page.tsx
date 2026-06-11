export const revalidate = 3600

import { cache } from 'react'
import { api } from '@/lib/api'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Sidebar from '@/components/Sidebar'
import ShowDetailClient from '@/components/ShowDetailClient'

interface Props {
  params: Promise<{ slug: string }>
}

const getShow = cache((slug: string) => api.getShow(slug).catch(() => null))

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const show = await getShow(slug)
  if (!show) return { title: 'TV Show — Movora' }
  return {
    title: `${show.title} — Movora`,
    description: show.synopsis,
    alternates: { canonical: `https://watchmovora.com/show/${slug}` },
    openGraph: {
      title: `${show.title} — Movora`,
      description: show.synopsis,
      images: show.backdropUrl ? [show.backdropUrl] : [],
    },
  }
}

export default async function ShowDetailPage({ params }: Props) {
  const { slug } = await params
  const show = await getShow(slug)
  if (!show) notFound()

  return (
    <>
      <Sidebar />
      <ShowDetailClient show={show} />
    </>
  )
}
