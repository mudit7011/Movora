'use client'

import { useRouter } from 'next/navigation'

interface Props {
  className?: string
  children: React.ReactNode
}

export default function BackButton({ className, children }: Props) {
  const router = useRouter()
  return (
    <button onClick={() => router.back()} className={className}>
      {children}
    </button>
  )
}
