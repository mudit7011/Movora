'use client'
import { useEffect, useState } from 'react'

const TV_UA = /SMART-TV|SmartTV|Tizen|WebOS|HbbTV|CrKey|NetCast|NETTV|googletv|Android.*TV|TV Safari|BRAVIA|Roku|AmazonWebAppPlatform|AFT|AFTS|AFTB|Vizio|PhilipsTV|SonyDTV|LOEWE|Hisense|TCL|Skyworth/i

export function useTvMode(): boolean {
  const [isTV, setIsTV] = useState(false)

  useEffect(() => {
    const byParam   = new URLSearchParams(window.location.search).get('tv') === '1'
    const byUA      = TV_UA.test(navigator.userAgent)
    const byPointer = window.matchMedia('(pointer: none)').matches
    const byCoarse  = window.screen.width >= 1280 && window.matchMedia('(pointer: coarse) and (hover: none)').matches
    const bySize    = window.screen.width >= 1280 && window.matchMedia('(hover: none)').matches
    if (byParam || byUA || byPointer || byCoarse || bySize) setIsTV(true)
  }, [])

  return isTV
}
