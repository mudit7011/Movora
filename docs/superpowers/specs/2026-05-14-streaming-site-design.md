# Streaming Site Design Spec
**Date:** 2026-05-14
**Status:** Approved

---

## 1. Project Summary

A Netflix-style streaming link aggregator for movies across three language categories: **English**, **Hindi originals**, and **Hindi dubbed** (international films dubbed in Hindi). The platform scrapes video embed links from multiple sites, enriches them with TMDB metadata, and serves them through a polished public frontend. No video files are hosted — only links and iframes. Movies ship first; TV shows added in a later phase.

**User model:** Fully anonymous — no accounts required to browse or watch.

---

## 2. Repository Structure

Monorepo with three independently deployable packages:

```
StreamingSite/
├── frontend/           # Next.js 14 (App Router), TailwindCSS, Framer Motion
├── backend/            # Node.js + Express REST API
├── scraper/            # Python + Playwright scraping engine
├── packages/
│   └── shared/         # Shared TypeScript types (Movie, Source, etc.)
└── docker-compose.yml  # Local dev: MongoDB + Redis
```

---

## 3. Infrastructure Stack

| Service | Purpose | Tier |
|---|---|---|
| Vercel | Frontend hosting (Next.js) | Free Hobby |
| Render | Backend API hosting | Free → $7/mo Starter at launch |
| MongoDB Atlas | Primary database | Free M0 (512MB) |
| Upstash Redis | Response caching | Free (500K cmds/month) |
| GitHub Actions | Nightly scraper cron | Free (public repo = unlimited minutes) |
| Cloudflare | CDN, DDoS protection, origin IP masking | Free |
| TMDB API | Movie metadata, posters, cast, trailers | Free |

**Action required:** Keep repo public on GitHub so GitHub Actions minutes are unlimited.

**Render sleep note:** Render free tier sleeps after 15 minutes of inactivity (~30-60s cold start). Upgrade to Render Starter ($7/mo) before public launch.

---

## 4. Database Schema

### `movies` collection
```json
{
  "_id": "ObjectId",
  "tmdbId": "12345",
  "title": "Pushpa: The Rise",
  "titleHindi": "पुष्पा: द राइज़",
  "slug": "pushpa-the-rise-2021",
  "type": "movie",
  "language": ["English", "Hindi", "Telugu", "Hindi Dubbed"],
  "genres": ["Action", "Drama"],
  "releaseYear": 2021,
  "rating": 7.6,
  "runtime": 179,
  "synopsis": "...",
  "posterUrl": "https://image.tmdb.org/...",
  "backdropUrl": "https://image.tmdb.org/...",
  "trailerKey": "youtube-video-key",
  "cast": [{ "name": "Allu Arjun", "character": "Pushpa", "photo": "..." }],
  "sources": [
    {
      "serverName": "Server 1",
      "url": "https://embed-host.com/watch/abc",
      "type": "iframe",
      "quality": "1080p",
      "isWorking": true,
      "lastChecked": "2026-05-14T00:00:00Z"
    }
  ],
  "scrapedFrom": "streamvaults.ru",
  "createdAt": "2026-05-14T00:00:00Z",
  "updatedAt": "2026-05-14T00:00:00Z"
}
```

### `admins` collection
```json
{
  "_id": "ObjectId",
  "email": "admin@example.com",
  "passwordHash": "bcrypt-hash",
  "role": "superadmin"
}
```

### `scrape_jobs` collection
```json
{
  "_id": "ObjectId",
  "site": "streamvaults.ru",
  "status": "completed",
  "moviesFound": 42,
  "errors": [],
  "startedAt": "...",
  "completedAt": "..."
}
```

**Indexes:** text index on `title` + `synopsis` for search; secondary indexes on `genres`, `language`, `releaseYear`, `rating`, `tmdbId`.

---

## 5. REST API Endpoints

### Public (no auth)
```
GET  /api/movies                → paginated list (filter: genre, year, language, rating)
GET  /api/movies/trending       → top 10 by rating + recency score
GET  /api/movies/latest         → most recently added
GET  /api/movies/search?q=...   → full-text search
GET  /api/movies/:slug          → full movie detail + sources
```

### Admin (JWT required — httpOnly cookie)
```
POST   /api/admin/auth/login
GET    /api/admin/movies              → full list with source status
POST   /api/admin/movies              → manually add a movie
PATCH  /api/admin/movies/:id          → edit movie / toggle source isWorking
DELETE /api/admin/movies/:id          → remove movie
POST   /api/admin/scrape/trigger      → manually trigger a scrape job
GET    /api/admin/scrape/jobs         → view scrape history
```

---

## 6. Frontend Pages

```
/                          → Homepage
/movies                    → Browse all movies
/search?q=...              → Search results
/movie/[slug]              → Movie detail
/watch/[slug]              → Video player
/admin                     → Admin login (hidden, not linked publicly)
/admin/dashboard           → Admin panel (JWT-protected route group)
```

### Design Philosophy

**Inspired by:** Netflix (dark cinematic feel) + JioHotstar (vibrant Indian content energy) + Prime Video (clean information density)
**Goal:** A visitor should feel they've landed on a premium, paid streaming service — not a link aggregator. Unique identity, not a Netflix clone.

**Visual identity:**
- **Color palette:** Deep black base (`#0A0A0F`) + deep crimson (`#C41E3A`) for CTAs and active states + gold (`#F5A623`) for ratings, highlights, and hover glows. Glassmorphism cards use `rgba(255,255,255,0.05)` + `backdrop-blur`. Secondary text `#A1A1AA`.
- **Typography:** `Inter` for UI, `Bebas Neue` or `Playfair Display` for hero titles — cinematic weight
- **Glassmorphism cards:** Frosted glass effect on movie cards, nav, and overlays (`backdrop-blur + bg-white/5`)
- **Grain texture overlay:** Subtle film grain on hero sections for a premium cinematic feel
- **Gradients everywhere:** Bottom-fade on hero images, gradient borders on hover states

**Framer Motion usage:**
- Hero section: staggered fade-up on title, synopsis, and buttons on load
- Carousels: smooth spring-physics drag scrolling
- Movie cards: `whileHover` scale + glow ring animation, `layoutId` for shared element transitions to detail page
- Page transitions: `AnimatePresence` slide transitions between routes
- Filter drawer: spring slide-in from left
- Player: fade-in with scale-up on mount

### Page Designs

**Homepage**
- Full-bleed cinematic hero (90vh): backdrop with gradient overlay, animated title, genre chips, rating badge, "▶ Play Now" + "ℹ More Info" buttons with glassmorphism styling
- Sticky frosted-glass navbar with search icon, language filter toggle
- Carousels: "Trending Now", "Latest Releases", "Hindi Movies", "Hindi Dubbed", "English Movies", per-genre rows
- Movie cards: poster with gradient bottom fade, title, IMDb-style rating badge, language tag — glow + scale on hover
- Spotlight section: hand-picked "Editor's Choice" movie with wide cinematic card

**Movie Detail (`/movie/[slug]`)**
- Full-bleed backdrop with deep gradient overlay (not a plain header — immersive)
- Floating poster card on left, metadata on right: title in display font, genre chips, runtime, release year, language badges
- Star rating display + IMDb score
- Cast horizontal scroll with avatar cards
- YouTube trailer embedded (click to reveal, lazy loaded)
- "Watch Now" primary CTA — large, gradient button with pulse animation

**Watch Page (`/watch/[slug]`)**
- Dark, distraction-free layout — player takes 70% of viewport
- Auto-detects source type by URL extension:
  - URL ends in `.m3u8` or `.mp4` → Video.js + HLS.js custom player with custom skin
  - Any other URL (embed, iframe link) → sandboxed `<iframe>`
- Server switcher tabs below player (Server 1, Server 2…) with working/broken status indicator
- Movie info panel below player (synopsis, cast chips)

**Browse Page (`/movies`)**
- Masonry-style or uniform grid layout (toggle between views)
- Filter sidebar with animated slide-in (Genre, Year, Language: English / Hindi / Hindi Dubbed, Rating range slider)
- "No results" state with animated illustration

**Search Page (`/search`)**
- Full-screen search overlay with animated backdrop blur
- Debounced real-time results as user types
- Results grid with staggered card entrance animations

**Admin Panel (`/admin/dashboard`)**
- Minimal dark dashboard — separate aesthetic from public site (clean, data-focused)
- Movies table with source status badges (working/broken)
- Edit/delete per movie
- "Trigger Scrape" button + live job status feed
- Scrape history log

---

## 7. Scraper Architecture

**Stack:** Python 3.11 + Playwright + playwright-stealth

```
scraper/
├── core/
│   ├── browser.py          # Playwright browser manager (stealth, random UA)
│   ├── pipeline.py         # Scrape → clean → TMDB match → upsert flow
│   └── db.py               # MongoDB connection (pymongo)
├── adapters/
│   ├── base.py             # Abstract base: implement scrape() → list[RawMovie]
│   └── streamvaults.py     # Adapter #1
├── tmdb/
│   └── client.py           # TMDB search + detail fetch
├── scheduler/
│   └── run.py              # GitHub Actions entry point
└── requirements.txt
```

**Pipeline flow:**
1. GitHub Actions cron triggers `run.py` nightly (or via admin panel manual trigger)
2. All registered adapters run in sequence
3. Each adapter returns `list[RawMovie]` (title + source URL)
4. TMDB client matches title → fetches poster, backdrop, synopsis, cast, trailer, rating
5. Document upserted into MongoDB using `tmdbId` as dedup key
6. Scrape job result written to `scrape_jobs`

**Adding a new site:** Create `adapters/new_site.py` extending `base.py`, implement `scrape() → list[RawMovie]`.

**Anti-detection:** `playwright-stealth`, randomized delays (2–5s between requests), rotating user-agent strings.

---

## 8. Security Architecture

### Frontend
- All `<iframe>` sources: `sandbox="allow-scripts allow-same-origin allow-presentation"` — blocks popups and top-navigation
- All scraped text sanitized with `DOMPurify` before render
- Strict CSP headers via `next.config.js`
- No `dangerouslySetInnerHTML` with raw scraped data

### Backend
- `helmet.js` — HSTS, X-Frame-Options, X-Content-Type-Options
- `express-rate-limit` — 100 req/15min per IP (public), 5 login attempts/15min (admin login)
- CORS restricted to production frontend domain only
- All inputs validated with `Zod` — unknown fields rejected
- Admin JWT: 24h expiry, stored in `httpOnly` cookie (not localStorage)
- Bcrypt password hashing (salt rounds: 12)

### Database
- Mongoose ODM — parameterized queries throughout
- Atlas DB user: Read/Write only (no drop permissions)
- All secrets in `.env` — never committed; `.env.example` committed with placeholders

### Infrastructure
- Cloudflare in front of everything — hides origin server IP
- GitHub Actions secrets for TMDB API key and MongoDB URI
- Admin panel URL not publicly linked or indexed

---

## 9. Implementation Phases

| Phase | Scope |
|---|---|
| 1 | Monorepo scaffold, MongoDB + Redis local dev setup, shared types |
| 2 | Backend API (Express, Mongoose models, all endpoints, JWT auth) |
| 3 | Scraper engine (Playwright core, streamvaults.ru adapter, TMDB client) |
| 4 | Frontend — Homepage, Browse, Search, Movie Detail pages |
| 5 | Watch page — Video.js/HLS.js player + iframe fallback + server switcher |
| 6 | Admin panel — login, movie management, scrape trigger |
| 7 | Deploy — Vercel + Render + Atlas + Cloudflare wiring + GitHub Actions scraper workflow |

---

## 10. Out of Scope (Phase 1)

- TV Shows / seasons / episodes
- User accounts, watchlists, continue watching
- ElasticSearch (MongoDB text indexes used instead)
- Mobile app
- Payment / subscription
