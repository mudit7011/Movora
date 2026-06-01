'use client'

import { useEffect } from 'react'

export default function HideScrollbar() {
  useEffect(() => {
    document.documentElement.classList.add('no-scrollbar')
    return () => document.documentElement.classList.remove('no-scrollbar')
  }, [])
  return null
}
