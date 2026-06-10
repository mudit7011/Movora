// Extracts real playback position from embed-player postMessage events.
// Supports Videasy (JSON string with timestamp/duration), StreamVault (timeupdate),
// Vidlink (MEDIA_DATA), and EmbedMaster (PlayerJS-style events). Returns null for
// unrecognized messages so callers can fall back to wall-clock estimation.

export interface Playback { time: number; duration: number }

// Only trust progress messages coming from players we actually embed.
export const PLAYER_ORIGINS = ['player.videasy.to', 'vidlink.pro', 'embedmaster.link', 'embdmstrplayer.com', 'nhdapi.com', 'ezvidapi.com']

export function isKnownPlayerOrigin(origin: string): boolean {
  return PLAYER_ORIGINS.some(h => origin.includes(h))
}

export function extractPlayback(
  raw: unknown,
  rawId: string,
  season?: number,
  episode?: number,
): Playback | null {
  let d: any = raw
  if (typeof d === 'string') {
    try { d = JSON.parse(d) } catch { return null }
  }
  if (!d || typeof d !== 'object') return null

  const topType = String(d.type ?? '').toLowerCase()

  // Videasy: { type:'PLAYER_EVENT', data:{ event:'timeupdate', timestamp|currentTime, duration } }
  if (topType === 'player_event' && d.data && typeof d.data === 'object') {
    const inner = d.data
    const ev = String(inner.event ?? '').toLowerCase()
    if (ev === 'timeupdate' || ev === 'time' || ev === 'pause' || ev === 'seeked') {
      const t = inner.timestamp ?? inner.currentTime ?? inner.seconds
      if (typeof t === 'number') {
        return { time: t, duration: typeof inner.duration === 'number' ? inner.duration : 0 }
      }
    }
    return null
  }

  // Videasy / Vidlink: { type:'MEDIA_DATA', data: <string|object keyed by "movie-<id>"/"tv-<id>"/<id>> }
  if (topType === 'media_data') {
    let map: any = d.data
    if (typeof map === 'string') { try { map = JSON.parse(map) } catch { return null } }
    if (map && typeof map === 'object') {
      const item =
        map[`movie-${rawId}`] ?? map[`tv-${rawId}`] ?? map[rawId] ??
        Object.values(map).find((v: any) => String(v?.id) === String(rawId))
      if (item && typeof item === 'object') {
        if (season != null && episode != null && item.show_progress && typeof item.show_progress === 'object') {
          const ep = item.show_progress[`${season}.${episode}`] ?? item.show_progress[`s${season}e${episode}`]
          if (ep?.progress && typeof ep.progress.watched === 'number') {
            return { time: ep.progress.watched, duration: typeof ep.progress.duration === 'number' ? ep.progress.duration : 0 }
          }
        }
        if (item.progress && typeof item.progress.watched === 'number') {
          return { time: item.progress.watched, duration: typeof item.progress.duration === 'number' ? item.progress.duration : 0 }
        }
      }
    }
    return null
  }

  const type = String(d.type ?? d.event ?? d.action ?? '').toLowerCase()

  // StreamVault: { type:'timeupdate', data:{ time, duration? } }
  if (type === 'timeupdate' && typeof d.data?.time === 'number') {
    return { time: d.data.time, duration: typeof d.data.duration === 'number' ? d.data.duration : 0 }
  }

  // Generic flat: { timestamp, duration }
  if (typeof d.timestamp === 'number' && typeof d.duration === 'number') {
    return { time: d.timestamp, duration: d.duration }
  }

  // EmbedMaster: { source:'embedmaster_player', event:'time', info:'<seconds>' }
  // info is a STRING holding the current playback time; no duration is provided.
  if (d.source === 'embedmaster_player') {
    const ev = String(d.event ?? '').toLowerCase()
    if (ev === 'time' || ev === 'timeupdate') {
      let t: number | undefined
      if (typeof d.info === 'number') t = d.info
      else if (typeof d.info === 'string') t = parseFloat(d.info)
      else if (d.info && typeof d.info === 'object') t = d.info.time ?? d.info.seconds ?? d.info.currentTime
      if (typeof t === 'number' && !isNaN(t)) {
        const dur = (d.info && typeof d.info === 'object' && typeof d.info.duration === 'number') ? d.info.duration : 0
        return { time: t, duration: dur }
      }
    }
    return null
  }

  return null
}

export function isEndedEvent(raw: unknown): boolean {
  let d: any = raw
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return false } }
  const type = String(d?.type ?? d?.event ?? d?.action ?? '').toLowerCase()
  return ['ended', 'end', 'finish', 'complete', 'videoend', 'finished'].includes(type)
}

// EmbedMaster resumes only by being sent a command, so we wait for it to signal
// ready/play, then post a seek back to the player window (event.source).
export function isEmbedMasterReady(raw: unknown): boolean {
  let d: any = raw
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { return false } }
  if (!d || d.source !== 'embedmaster_player') return false
  const ev = String(d.event ?? '').toLowerCase()
  // 'time' fires once playback is live — the safest moment to send a resume-seek.
  return ev === 'ready' || ev === 'play' || ev === 'time'
}

export function seekEmbedMaster(win: Window | null | undefined, seconds: number) {
  win?.postMessage({ source: 'embedmaster_player_command', command: 'seek', value: Math.floor(seconds) }, '*')
}
