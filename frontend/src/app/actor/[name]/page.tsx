import { api } from '@/lib/api'
import Sidebar from '@/components/Sidebar'
import type { Metadata } from 'next'
import ActorClient from './ActorClient'

interface Props {
  params: Promise<{ name: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { name } = await params
  const decoded = decodeURIComponent(name)
  return { title: `${decoded} — Movora` }
}

export default async function ActorPage({ params }: Props) {
  const { name } = await params
  const decoded = decodeURIComponent(name)

  const data = await api.searchByActor(decoded).catch(() => ({ person: null, results: [] }))

  return (
    <>
      <Sidebar />
      <ActorClient person={data.person} results={data.results} actorName={decoded} />
    </>
  )
}
