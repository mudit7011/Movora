// Cross-origin iframe fullscreen domain interception is blocked by the browser
// (requestFullscreen requires a direct user gesture; async chains lose the trust).
// This hook is intentionally a no-op. The player-wrap CSS class remains so a
// native fullscreen button can be added later if desired.
import { type RefObject } from 'react'

export function useFullscreenCapture(
  _iframeRef: RefObject<HTMLIFrameElement | null>,
  _containerRef: RefObject<HTMLElement | null>,
) {
  // no-op
}
