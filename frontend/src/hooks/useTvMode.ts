'use client'
import { useEffect, useState } from 'react'

// UA patterns covering all major Smart TV platforms:
// Samsung Tizen, LG WebOS, Android TV / Google TV, Apple TV (tvOS Safari),
// Roku, Amazon Fire TV, HbbTV (European broadcast TVs), Chromecast,
// Sony/Philips/Hisense/TCL/Skyworth/Vizio built-in browsers
const TV_UA = /SMART-TV|SmartTV|Tizen|WebOS|HbbTV|CrKey|NetCast|NETTV|googletv|Google TV|AndroidTV|Android TV|TV Safari|AppleTV|BRAVIA|Roku|AmazonWebAppPlatform|AFT[BSM]?[0-9]|Vizio|PhilipsTV|SonyDTV|LOEWE|Hisense|TCL|Skyworth|TVBro|TV\s?Bro|SMART_TV/i

const LS_KEY = 'movora_tv_mode'

export function useTvMode(): boolean {
  const [isTV, setIsTV] = useState(false)

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const byParam  = params.get('tv') === '1'
    const byOff    = params.get('tv') === '0'  // ?tv=0 force-disables
    const byStored = localStorage.getItem(LS_KEY) === '1'
    const byUA     = TV_UA.test(navigator.userAgent)

    // pointer:none = no pointing device at all (D-pad only remotes)
    const byPointer = window.matchMedia('(pointer: none)').matches

    // Large screen + coarse/no pointer = likely a TV (not a phone/tablet)
    const byCoarse  = window.screen.width >= 1280 && window.matchMedia('(pointer: coarse) and (hover: none)').matches
    const bySize    = window.screen.width >= 1280 && window.matchMedia('(hover: none)').matches

    if (byOff) {
      localStorage.removeItem(LS_KEY)
      return
    }

    const detected = byParam || byUA || byPointer || byCoarse || bySize || byStored
    if (byParam) localStorage.setItem(LS_KEY, '1')
    if (detected) setIsTV(true)
  }, [])

  return isTV
}
