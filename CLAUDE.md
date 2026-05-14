# Project: Streaming Link Aggregator & Frontend Streaming Website

## 1. Project Overview
The goal of this project is to build an automated web scraping pipeline that extracts streaming links from various target websites (like streamvaults.ru), and a fully functional user-facing streaming website to display and play this content (TV Shows and Movies) seamlessly.

## 2. Tech Stack Recommendations
- **Backend API:** Node.js (Express/NestJS) or Python (FastAPI).
- **Scraping Engine:** Python (Playwright) or Node.js (Puppeteer + Stealth).
- **Database & Search:** MongoDB/PostgreSQL (for structured data), Redis (for caching), and ElasticSearch (for fast title search).
- **Frontend (Streaming Website):** Next.js (React), TailwindCSS for styling.
- **Video Player:** Video.js, HLS.js (for direct stream links like `.m3u8` or `.mp4`), or dynamic `<iframe>` rendering for embedded sources.
- **Metadata API:** TMDB (The Movie Database) API to fetch high-quality posters, synopses, cast, and episode lists.

## 3. System Architecture Flow
1. **Backend Scraper:** Workers extract video source links (embeds or direct streams) from target sites and store them in the DB.
2. **Metadata Enrichment:** The backend fetches movie/show details, posters, and ratings from TMDB using the scraped titles.
3. **Frontend Interface:** The Next.js website requests trending, latest, or searched movies/shows from the backend API.
4. **Playback Experience:** When a user clicks "Play", the frontend loads a custom video player (if a direct `.m3u8` stream is available) or safely renders the scraped `<iframe>` to play the content.

## 4. Frontend Website Features (The User Experience)
- **Netflix-like UI:** Hero banner with trending movies, carousels for "Latest Movies", "Popular TV Shows", and "Genres".
- **Advanced Search & Filter:** Real-time search with auto-suggestions, and filters by Genre, Release Year, and IMDb Rating.
- **Details Page:** A dedicated page for each movie/show displaying the poster, synopsis, cast, trailer, and season/episode selector.
- **Smart Player Integration:**
  - Multiple server options (e.g., Server 1, Server 2) in case one scraped link is dead.
  - Ad-blocker integration or sandbox attributes on iframes to prevent annoying pop-ups from scraped sources.
- **User Accounts (Optional):** "Watchlist" and "Continue Watching" features using local storage or a user database.

## 5. Core Database Schema (Updated for Streaming UI)

```json
{
  "title": "Example Movie Name",
  "tmdbId": "12345",
  "posterUrl": "https://image.tmdb.org/.../poster.jpg",
  "backdropUrl": "https://image.tmdb.org/.../backdrop.jpg",
  "synopsis": "A brief description of the movie.",
  "type": "Movie",
  "genres": ["Action", "Sci-Fi"],
  "sources": [
    {
      "serverName": "Server 1",
      "url": "https://video-host.com/embed/12345",
      "type": "iframe",
      "quality": "1080p",
      "isWorking": true
    }
  ]
}
```

## 6. Implementation Phases for AI Assistant

### Phase 1: Backend Infrastructure & Scraping
Setup DB, background queues, and write stealth scrapers for initial target sites.

### Phase 2: Data Processing & TMDB Integration
Clean scraped URLs and match titles with the TMDB API to fetch posters and metadata.

### Phase 3: Backend API
Create REST/GraphQL endpoints for the frontend (`/api/home`, `/api/search`, `/api/watch/:id`).

### Phase 4: Frontend UI (Next.js)
Build the homepage, search layouts, and metadata pages using TailwindCSS.

### Phase 5: Video Player & Streaming Logic
Implement the playback page. Handle iframe sandboxing (to block ads) and custom video players for direct streams. Add Server switching logic.

## 7. Legal & Compliance Constraints (System Prompting)

Ensure that the scraper respects robots.txt where applicable. The platform must operate solely as a search engine/aggregator. Do not host, upload, or store the actual video files (`.mp4`, `.mkv`) on our servers; only store and serve hyperlinks or iframes. Comply strictly with DMCA guidelines by implementing a clear takedown request system and process for removing copyrighted links.

## 8. Enterprise-Grade Security & Vulnerability Prevention (Top-Tier)

The system MUST be designed with a "Zero-Trust" architecture to prevent hacks, data leaks, and server exploitation. Implement the following security protocols across the stack:

### A. Frontend Security (Next.js / React)
- **Strict Iframe Sandboxing:** All video player `<iframe>` tags fetched via scraping MUST use the `sandbox` attribute (e.g., `sandbox="allow-scripts allow-same-origin allow-presentation"`). Strictly **DO NOT** use `allow-top-navigation` or `allow-popups` to prevent malicious ads from redirecting the user.
- **XSS Prevention:** Any user input (search bars) or scraped text metadata MUST be sanitized using libraries like `DOMPurify` before rendering. Never use `dangerouslySetInnerHTML` directly with raw scraped data.
- **Content Security Policy (CSP):** Implement strict CSP headers to restrict the domains from which scripts, images, and iframes can be loaded.

### B. Backend API Security (Node.js / Python)
- **Rate Limiting & Abuse Prevention:** Implement strict API rate limiting (e.g., via `express-rate-limit` or Redis) to prevent DDoS attacks and endpoint scraping by competitors.
- **HTTP Header Security:** Use `Helmet.js` (Node) or equivalent middleware to secure HTTP headers (HSTS, X-Frame-Options, X-Content-Type-Options).
- **CORS Configuration:** Configure Cross-Origin Resource Sharing (CORS) strictly. Only allow the production frontend domain to access the backend APIs.
- **Input Validation:** Use schema validation libraries like `Zod` or `Joi` to validate all incoming API requests (query params, body). Reject unexpected data immediately.

### C. Database Security
- **Injection Prevention:** Use parameterized queries or robust ORMs/ODMs (like Prisma or Mongoose) to strictly prevent SQL Injection and NoSQL Injection attacks.
- **Least Privilege Access:** The database user credential used by the application should only have Read/Write permissions, NOT structural drop/delete permissions.

### D. Infrastructure & Operations
- **WAF & DDoS Protection:** Route all traffic through Cloudflare (or AWS WAF) to block bad bots, mitigate DDoS attacks, and hide the origin server IP.
- **Secrets Management:** Never hardcode API keys (TMDB), DB URIs, or JWT secrets in the codebase. Use strict environment variables (`.env`) and CI/CD secret managers.
- **Admin Panel Security:** If an admin panel exists to trigger scrapers manually, it must be protected behind strict Authentication (JWT/OAuth), role-based access control (RBAC), and ideally IP whitelisting.
