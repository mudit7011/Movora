'use client'
import { useEffect, useState } from 'react'

const TV_UA = /SMART-TV|SmartTV|Tizen|WebOS|HbbTV|CrKey|NetCast|NETTV|googletv|Android.*TV|TV Safari|BRAVIA|Roku|AmazonWebAppPlatform|AFT|AFTS|AFTB|Vizio|PhilipsTV|SonyDTV|LOEWE|Hisense|TCL|Skyworth/i
const LS_KEY = 'movora_tv_mode'

export function useTvMode(): boolean {
  const [isTV, setIsTV] = useState(false)

  useEffect(() => {
    const params    = new URLSearchParams(window.location.search)
    const byParam   = params.get('tv') === '1'
    const byOff     = params.get('tv') === '0'          // ?tv=0 to force-disable
    const byStored  = localStorage.getItem(LS_KEY) === '1'
    const byUA      = TV_UA.test(navigator.userAgent)
    const byPointer = window.matchMedia('(pointer: none)').matches
    const byCoarse  = window.screen.width >= 1280 && window.matchMedia('(pointer: coarse) and (hover: none)').matches
    const bySize    = window.screen.width >= 1280 && window.matchMedia('(hover: none)').matches

    if (byOff) {
      localStorage.removeItem(LS_KEY)
      return
    }

    const detected = byParam || byUA || byPointer || byCoarse || bySize || byStored
    if (byParam) localStorage.setItem(LS_KEY, '1')  // persist ?tv=1
    if (detected) setIsTV(true)
  }, [])

  return isTV
}
