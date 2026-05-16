# Scraper Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Python Playwright scraper that extracts movie embed links from target sites, enriches them with TMDB metadata, and upserts them into MongoDB Atlas — triggered nightly via GitHub Actions.

**Architecture:** Each site has a pluggable adapter (`BaseAdapter.scrape() → list[RawMovie]`). A central pipeline takes `RawMovie` objects, calls TMDB to enrich them, then upserts into MongoDB. GitHub Actions cron runs the orchestrator (`scheduler/run.py`) nightly at 2am UTC.

**Tech Stack:** Python 3.11, Playwright (async), playwright-stealth, httpx, pymongo, python-slugify, python-dotenv, pytest + pytest-asyncio + pytest-mock + mongomock

---

## File Map

```
scraper/
├── core/
│   ├── __init__.py
│   ├── browser.py          # Playwright browser manager (stealth + random UA)
│   ├── config.py           # dotenv loader → typed config object
│   ├── db.py               # pymongo connection helper
│   └── pipeline.py         # enrich + upsert + scrape job CRUD
├── adapters/
│   ├── __init__.py
│   ├── base.py             # RawMovie dataclass + BaseAdapter ABC
│   └── streamvaults.py     # Adapter #1: streamvaults.ru
├── tmdb/
│   ├── __init__.py
│   └── client.py           # TMDB API v3 client
├── utils/
│   ├── __init__.py
│   └── slug.py             # make_slug(title, year) → str
├── scheduler/
│   ├── __init__.py
│   └── run.py              # Entry point — runs all adapters
├── tests/
│   ├── __init__.py
│   ├── conftest.py         # mongomock fixture + TMDB fixture data
│   ├── test_slug.py
│   ├── test_tmdb_client.py
│   ├── test_pipeline.py
│   └── test_streamvaults_adapter.py
├── requirements.txt
├── pytest.ini
└── .env.example
.github/
└── workflows/
    └── scraper.yml         # GitHub Actions nightly cron
```

---

### Task 1: Python project scaffold

**Files:**
- Create: `scraper/requirements.txt`
- Create: `scraper/pytest.ini`
- Create: `scraper/.env.example`
- Create: all `__init__.py` files in the directory tree above

- [ ] **Step 1: Create directory tree**

```bash
mkdir -p scraper/core scraper/adapters scraper/tmdb scraper/utils scraper/scheduler scraper/tests
touch scraper/core/__init__.py scraper/adapters/__init__.py scraper/tmdb/__init__.py
touch scraper/utils/__init__.py scraper/scheduler/__init__.py scraper/tests/__init__.py
```

- [ ] **Step 2: Create `scraper/requirements.txt`**

```
playwright==1.44.0
playwright-stealth==1.0.6
httpx==0.27.0
pymongo==4.7.2
python-slugify==8.0.4
python-dotenv==1.0.1

# test
mongomock==4.1.2
pytest==8.2.1
pytest-asyncio==0.23.7
pytest-mock==3.14.0
```

- [ ] **Step 3: Create `scraper/pytest.ini`**

```ini
[pytest]
asyncio_mode = auto
testpaths = tests
```

- [ ] **Step 4: Create `scraper/.env.example`**

```
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/streamingsite
TMDB_API_KEY=CHANGE_ME_get_free_key_from_themoviedb_org
```

- [ ] **Step 5: Install dependencies and Playwright browser**

```bash
cd scraper
pip install -r requirements.txt
playwright install chromium
```

Expected: no errors, chromium downloads successfully.

- [ ] **Step 6: Commit**

```bash
git add scraper/
git commit -m "feat(scraper): python project scaffold with requirements and pytest config"
```

---

### Task 2: Environment config

**Files:**
- Create: `scraper/core/config.py`

- [ ] **Step 1: Create `scraper/core/config.py`**

```python
import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()


@dataclass(frozen=True)
class Config:
    mongodb_uri: str
    tmdb_api_key: str


def load_config() -> Config:
    mongodb_uri = os.environ.get("MONGODB_URI", "")
    tmdb_api_key = os.environ.get("TMDB_API_KEY", "")
    if not mongodb_uri:
        raise ValueError("MONGODB_URI env var is required")
    if not tmdb_api_key:
        raise ValueError("TMDB_API_KEY env var is required")
    return Config(mongodb_uri=mongodb_uri, tmdb_api_key=tmdb_api_key)
```

- [ ] **Step 2: Commit**

```bash
git add scraper/core/config.py
git commit -m "feat(scraper): env config loader"
```

---

### Task 3: Slug utility

**Files:**
- Create: `scraper/utils/slug.py`
- Create: `scraper/tests/test_slug.py`

- [ ] **Step 1: Write failing test — `scraper/tests/test_slug.py`**

```python
from utils.slug import make_slug


def test_basic_title():
    assert make_slug("Pushpa: The Rise", 2021) == "pushpa-the-rise-2021"


def test_special_characters():
    assert make_slug("Don't Look Up!", 2021) == "dont-look-up-2021"


def test_hindi_title_transliterated():
    assert make_slug("RRR", 2022) == "rrr-2022"


def test_extra_spaces():
    assert make_slug("  Inception  ", 2010) == "inception-2010"
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scraper && python -m pytest tests/test_slug.py -v
```

Expected: `ImportError: No module named 'utils.slug'`

- [ ] **Step 3: Implement `scraper/utils/slug.py`**

```python
from slugify import slugify


def make_slug(title: str, year: int) -> str:
    return f"{slugify(title.strip())}-{year}"
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd scraper && python -m pytest tests/test_slug.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scraper/utils/slug.py scraper/tests/test_slug.py
git commit -m "feat(scraper): slug utility with tests"
```

---

### Task 4: RawMovie dataclass + BaseAdapter ABC

**Files:**
- Create: `scraper/adapters/base.py`

- [ ] **Step 1: Create `scraper/adapters/base.py`**

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field


@dataclass
class RawSource:
    server_name: str
    url: str
    source_type: str   # 'iframe' or 'direct'
    quality: str = "HD"
    is_working: bool = True

    def to_mongo(self) -> dict:
        return {
            "serverName": self.server_name,
            "url": self.url,
            "type": self.source_type,
            "quality": self.quality,
            "isWorking": self.is_working,
        }


@dataclass
class RawMovie:
    title: str
    source: RawSource
    source_site: str           # e.g. "streamvaults.ru"
    year: int | None = None
    language_hint: list[str] = field(default_factory=list)


class BaseAdapter(ABC):
    site_name: str = ""

    @abstractmethod
    async def scrape(self) -> list[RawMovie]:
        """Scrape the target site and return raw movie data."""
```

- [ ] **Step 2: Verify import works**

```bash
cd scraper && python -c "from adapters.base import RawMovie, RawSource, BaseAdapter; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scraper/adapters/base.py
git commit -m "feat(scraper): RawMovie dataclass and BaseAdapter ABC"
```

---

### Task 5: Browser manager

**Files:**
- Create: `scraper/core/browser.py`

- [ ] **Step 1: Create `scraper/core/browser.py`**

```python
import asyncio
import random
from contextlib import asynccontextmanager
from playwright.async_api import async_playwright, Page
from playwright_stealth import stealth_async

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:125.0) Gecko/20100101 Firefox/125.0",
]


@asynccontextmanager
async def get_page():
    """Async context manager that yields a stealth Playwright page."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=random.choice(USER_AGENTS),
            viewport={"width": 1280, "height": 800},
            java_script_enabled=True,
        )
        page = await context.new_page()
        await stealth_async(page)
        try:
            yield page
        finally:
            await browser.close()


async def random_delay(min_s: float = 2.0, max_s: float = 5.0) -> None:
    await asyncio.sleep(random.uniform(min_s, max_s))
```

- [ ] **Step 2: Verify import works**

```bash
cd scraper && python -c "from core.browser import get_page, random_delay; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scraper/core/browser.py
git commit -m "feat(scraper): playwright browser manager with stealth and random delays"
```

---

### Task 6: MongoDB connection + scrape job helpers

**Files:**
- Create: `scraper/core/db.py`

- [ ] **Step 1: Create `scraper/core/db.py`**

```python
from datetime import datetime, timezone
from pymongo import MongoClient
from pymongo.database import Database


def get_db(mongodb_uri: str) -> Database:
    client = MongoClient(mongodb_uri, serverSelectionTimeoutMS=5000)
    db_name = mongodb_uri.split("/")[-1].split("?")[0] or "streamingsite"
    return client[db_name]


def start_scrape_job(db: Database, site: str) -> str:
    result = db["scrapejobs"].insert_one({
        "site": site,
        "status": "running",
        "moviesFound": 0,
        "scrapeErrors": [],
        "startedAt": datetime.now(timezone.utc),
        "completedAt": None,
    })
    return str(result.inserted_id)


def finish_scrape_job(db: Database, job_id: str, movies_found: int, errors: list[str]) -> None:
    from bson import ObjectId
    db["scrapejobs"].update_one(
        {"_id": ObjectId(job_id)},
        {"$set": {
            "status": "completed" if not errors else "failed",
            "moviesFound": movies_found,
            "scrapeErrors": errors,
            "completedAt": datetime.now(timezone.utc),
        }},
    )
```

- [ ] **Step 2: Verify import works**

```bash
cd scraper && python -c "from core.db import get_db, start_scrape_job, finish_scrape_job; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scraper/core/db.py
git commit -m "feat(scraper): mongodb connection helper and scrape job CRUD"
```

---

### Task 7: TMDB client

**Files:**
- Create: `scraper/tmdb/client.py`
- Create: `scraper/tests/test_tmdb_client.py`

- [ ] **Step 1: Write failing test — `scraper/tests/test_tmdb_client.py`**

```python
import pytest
from tmdb.client import TmdbClient

TMDB_SEARCH_FIXTURE = {
    "results": [
        {
            "id": 831462,
            "title": "Pushpa: The Rise - Part 1",
            "release_date": "2021-12-17",
            "poster_path": "/poster.jpg",
            "backdrop_path": "/backdrop.jpg",
            "vote_average": 7.6,
            "genre_ids": [28, 80, 18],
            "original_language": "te",
        }
    ]
}

TMDB_DETAIL_FIXTURE = {
    "id": 831462,
    "title": "Pushpa: The Rise - Part 1",
    "overview": "A labourer rises through the ranks of a red sandalwood smuggling syndicate.",
    "release_date": "2021-12-17",
    "runtime": 179,
    "poster_path": "/poster.jpg",
    "backdrop_path": "/backdrop.jpg",
    "vote_average": 7.6,
    "genres": [{"id": 28, "name": "Action"}, {"id": 80, "name": "Crime"}],
    "spoken_languages": [{"name": "Telugu"}, {"name": "Hindi"}],
    "credits": {
        "cast": [
            {"name": "Allu Arjun", "character": "Pushpa Raj", "profile_path": "/profile.jpg"},
            {"name": "Fahadh Faasil", "character": "Bhanwar Singh", "profile_path": None},
        ]
    },
    "videos": {
        "results": [
            {"type": "Trailer", "site": "YouTube", "key": "abc123"},
            {"type": "Teaser", "site": "YouTube", "key": "xyz789"},
        ]
    },
}


@pytest.mark.asyncio
async def test_search_movie_returns_first_result(mocker):
    client = TmdbClient(api_key="testkey")
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = TMDB_SEARCH_FIXTURE
    mock_resp.raise_for_status = mocker.MagicMock()
    mocker.patch.object(client._http, "get", new=mocker.AsyncMock(return_value=mock_resp))

    result = await client.search_movie("Pushpa", 2021)
    assert result["id"] == 831462


@pytest.mark.asyncio
async def test_search_movie_returns_none_when_no_results(mocker):
    client = TmdbClient(api_key="testkey")
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = {"results": []}
    mock_resp.raise_for_status = mocker.MagicMock()
    mocker.patch.object(client._http, "get", new=mocker.AsyncMock(return_value=mock_resp))

    result = await client.search_movie("ZZZNotAMovie", None)
    assert result is None


@pytest.mark.asyncio
async def test_get_movie_detail_maps_fields(mocker):
    client = TmdbClient(api_key="testkey")
    mock_resp = mocker.MagicMock()
    mock_resp.json.return_value = TMDB_DETAIL_FIXTURE
    mock_resp.raise_for_status = mocker.MagicMock()
    mocker.patch.object(client._http, "get", new=mocker.AsyncMock(return_value=mock_resp))

    detail = await client.get_movie_detail(831462)
    assert detail["runtime"] == 179
    assert detail["trailer_key"] == "abc123"
    assert detail["genres"] == ["Action", "Crime"]
    assert detail["cast"][0]["name"] == "Allu Arjun"
    assert detail["poster_url"] == "https://image.tmdb.org/t/p/w500/poster.jpg"
    assert detail["backdrop_url"] == "https://image.tmdb.org/t/p/original/backdrop.jpg"


@pytest.mark.asyncio
async def test_close_shuts_down_http_client(mocker):
    client = TmdbClient(api_key="testkey")
    mock_close = mocker.AsyncMock()
    mocker.patch.object(client._http, "aclose", mock_close)
    await client.close()
    mock_close.assert_awaited_once()
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd scraper && python -m pytest tests/test_tmdb_client.py -v
```

Expected: `ImportError: No module named 'tmdb.client'`

- [ ] **Step 3: Implement `scraper/tmdb/client.py`**

```python
from __future__ import annotations
import httpx

TMDB_BASE = "https://api.themoviedb.org/3"
IMG_W500 = "https://image.tmdb.org/t/p/w500"
IMG_ORIGINAL = "https://image.tmdb.org/t/p/original"


class TmdbClient:
    def __init__(self, api_key: str) -> None:
        self._key = api_key
        self._http = httpx.AsyncClient(timeout=15)

    async def search_movie(self, title: str, year: int | None) -> dict | None:
        params: dict = {"api_key": self._key, "query": title, "include_adult": "false"}
        if year:
            params["year"] = year
        resp = await self._http.get(f"{TMDB_BASE}/search/movie", params=params)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        return results[0] if results else None

    async def get_movie_detail(self, tmdb_id: int) -> dict:
        resp = await self._http.get(
            f"{TMDB_BASE}/movie/{tmdb_id}",
            params={"api_key": self._key, "append_to_response": "videos,credits"},
        )
        resp.raise_for_status()
        data = resp.json()

        trailer_key = next(
            (v["key"] for v in data.get("videos", {}).get("results", [])
             if v["type"] == "Trailer" and v["site"] == "YouTube"),
            None,
        )
        genres = [g["name"] for g in data.get("genres", [])]
        languages = [lang["name"] for lang in data.get("spoken_languages", [])]
        cast = [
            {
                "name": m["name"],
                "character": m.get("character"),
                "photo": f"{IMG_W500}{m['profile_path']}" if m.get("profile_path") else None,
            }
            for m in data.get("credits", {}).get("cast", [])[:10]
        ]
        poster_path = data.get("poster_path", "")
        backdrop_path = data.get("backdrop_path", "")

        return {
            "tmdb_id": str(data["id"]),
            "title": data.get("title", ""),
            "overview": data.get("overview", ""),
            "release_date": data.get("release_date", ""),
            "runtime": data.get("runtime") or 0,
            "vote_average": data.get("vote_average") or 0.0,
            "genres": genres,
            "languages": languages,
            "cast": cast,
            "trailer_key": trailer_key,
            "poster_url": f"{IMG_W500}{poster_path}" if poster_path else "",
            "backdrop_url": f"{IMG_ORIGINAL}{backdrop_path}" if backdrop_path else "",
        }

    async def close(self) -> None:
        await self._http.aclose()
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd scraper && python -m pytest tests/test_tmdb_client.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add scraper/tmdb/client.py scraper/tests/test_tmdb_client.py
git commit -m "feat(scraper): TMDB API v3 client with search, detail, and field mapping"
```

---

### Task 8: Pipeline (enrich + upsert)

**Files:**
- Create: `scraper/core/pipeline.py`
- Create: `scraper/tests/conftest.py`
- Create: `scraper/tests/test_pipeline.py`

- [ ] **Step 1: Create `scraper/tests/conftest.py`**

```python
import pytest
import mongomock

TMDB_DETAIL_FIXTURE = {
    "tmdb_id": "tt831462",
    "title": "Pushpa: The Rise - Part 1",
    "overview": "A labourer rises through the ranks of a red sandalwood smuggling syndicate.",
    "release_date": "2021-12-17",
    "runtime": 179,
    "vote_average": 7.6,
    "genres": ["Action", "Crime"],
    "languages": ["Telugu", "Hindi"],
    "cast": [{"name": "Allu Arjun", "character": "Pushpa Raj", "photo": None}],
    "trailer_key": "abc123",
    "poster_url": "https://image.tmdb.org/t/p/w500/poster.jpg",
    "backdrop_url": "https://image.tmdb.org/t/p/original/backdrop.jpg",
}


@pytest.fixture
def mock_db():
    client = mongomock.MongoClient()
    db = client["streamingsite"]
    yield db
    client.close()
```

- [ ] **Step 2: Write failing test — `scraper/tests/test_pipeline.py`**

```python
import pytest
from adapters.base import RawMovie, RawSource
from core.pipeline import Pipeline


@pytest.mark.asyncio
async def test_process_inserts_movie(mock_db, mocker):
    from tests.conftest import TMDB_DETAIL_FIXTURE

    raw = RawMovie(
        title="Pushpa: The Rise",
        year=2021,
        source=RawSource(server_name="Server 1", url="https://example.com/embed/123", source_type="iframe"),
        source_site="streamvaults.ru",
        language_hint=["Hindi Dubbed"],
    )

    pipeline = Pipeline(db=mock_db, tmdb_api_key="testkey")
    mocker.patch.object(pipeline._tmdb, "search_movie", new=mocker.AsyncMock(
        return_value={"id": 831462, "release_date": "2021-12-17"}
    ))
    mocker.patch.object(pipeline._tmdb, "get_movie_detail", new=mocker.AsyncMock(
        return_value=TMDB_DETAIL_FIXTURE
    ))

    count, errors = await pipeline.process([raw])
    assert count == 1
    assert errors == []
    doc = mock_db["movies"].find_one({"tmdbId": "tt831462"})
    assert doc is not None
    assert doc["title"] == "Pushpa: The Rise - Part 1"
    assert doc["runtime"] == 179
    assert len(doc["sources"]) == 1
    assert doc["sources"][0]["serverName"] == "Server 1"


@pytest.mark.asyncio
async def test_process_upserts_source_on_duplicate(mock_db, mocker):
    from tests.conftest import TMDB_DETAIL_FIXTURE

    raw = RawMovie(
        title="Pushpa: The Rise",
        year=2021,
        source=RawSource(server_name="Server 2", url="https://example.com/embed/456", source_type="iframe"),
        source_site="streamvaults.ru",
    )

    pipeline = Pipeline(db=mock_db, tmdb_api_key="testkey")
    mocker.patch.object(pipeline._tmdb, "search_movie", new=mocker.AsyncMock(
        return_value={"id": 831462, "release_date": "2021-12-17"}
    ))
    mocker.patch.object(pipeline._tmdb, "get_movie_detail", new=mocker.AsyncMock(
        return_value=TMDB_DETAIL_FIXTURE
    ))

    # Insert once
    await pipeline.process([raw])

    # Run again with different server — should add second source
    raw2 = RawMovie(
        title="Pushpa: The Rise",
        year=2021,
        source=RawSource(server_name="Server 3", url="https://example.com/embed/789", source_type="iframe"),
        source_site="streamvaults.ru",
    )
    mocker.patch.object(pipeline._tmdb, "search_movie", new=mocker.AsyncMock(
        return_value={"id": 831462, "release_date": "2021-12-17"}
    ))
    mocker.patch.object(pipeline._tmdb, "get_movie_detail", new=mocker.AsyncMock(
        return_value=TMDB_DETAIL_FIXTURE
    ))
    await pipeline.process([raw2])

    doc = mock_db["movies"].find_one({"tmdbId": "tt831462"})
    assert len(doc["sources"]) == 2


@pytest.mark.asyncio
async def test_process_skips_movie_when_tmdb_not_found(mock_db, mocker):
    raw = RawMovie(
        title="ZZZNotAMovie",
        year=None,
        source=RawSource(server_name="Server 1", url="https://example.com/embed/999", source_type="iframe"),
        source_site="streamvaults.ru",
    )
    pipeline = Pipeline(db=mock_db, tmdb_api_key="testkey")
    mocker.patch.object(pipeline._tmdb, "search_movie", new=mocker.AsyncMock(return_value=None))

    count, errors = await pipeline.process([raw])
    assert count == 0
    assert len(errors) == 1
    assert "ZZZNotAMovie" in errors[0]
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd scraper && python -m pytest tests/test_pipeline.py -v
```

Expected: `ImportError: No module named 'core.pipeline'`

- [ ] **Step 4: Implement `scraper/core/pipeline.py`**

```python
from __future__ import annotations
from datetime import datetime, timezone
from pymongo.database import Database
from adapters.base import RawMovie
from tmdb.client import TmdbClient
from utils.slug import make_slug


class Pipeline:
    def __init__(self, db: Database, tmdb_api_key: str) -> None:
        self._db = db
        self._tmdb = TmdbClient(api_key=tmdb_api_key)

    async def process(self, raw_movies: list[RawMovie]) -> tuple[int, list[str]]:
        count = 0
        errors: list[str] = []
        for raw in raw_movies:
            try:
                search_result = await self._tmdb.search_movie(raw.title, raw.year)
                if not search_result:
                    errors.append(f"TMDB not found: {raw.title}")
                    continue

                detail = await self._tmdb.get_movie_detail(search_result["id"])
                release_date = detail.get("release_date") or search_result.get("release_date", "")
                year = int(release_date[:4]) if release_date else (raw.year or 0)

                # Use language from TMDB; append language_hint tags that aren't already present
                languages = detail["languages"] or []
                for hint in raw.language_hint:
                    if hint not in languages:
                        languages.append(hint)

                movie_doc = {
                    "tmdbId": detail["tmdb_id"],
                    "title": detail["title"],
                    "slug": make_slug(detail["title"], year),
                    "type": "movie",
                    "language": languages,
                    "genres": detail["genres"],
                    "releaseYear": year,
                    "rating": detail["vote_average"],
                    "runtime": detail["runtime"],
                    "synopsis": detail["overview"],
                    "posterUrl": detail["poster_url"],
                    "backdropUrl": detail["backdrop_url"],
                    "trailerKey": detail["trailer_key"],
                    "cast": detail["cast"],
                    "scrapedFrom": raw.source_site,
                    "updatedAt": datetime.now(timezone.utc),
                }
                source_doc = raw.source.to_mongo()

                self._upsert(movie_doc, source_doc)
                count += 1
            except Exception as exc:
                errors.append(f"{raw.title}: {exc}")

        return count, errors

    def _upsert(self, movie_doc: dict, source_doc: dict) -> None:
        movies = self._db["movies"]
        existing = movies.find_one({"tmdbId": movie_doc["tmdbId"]})
        if existing is None:
            movies.insert_one({
                **movie_doc,
                "sources": [source_doc],
                "createdAt": datetime.now(timezone.utc),
            })
        else:
            # Add source only if serverName not already present
            existing_names = {s["serverName"] for s in existing.get("sources", [])}
            update: dict = {"$set": movie_doc}
            if source_doc["serverName"] not in existing_names:
                update["$push"] = {"sources": source_doc}
            movies.update_one({"tmdbId": movie_doc["tmdbId"]}, update)

    async def close(self) -> None:
        await self._tmdb.close()
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd scraper && python -m pytest tests/test_pipeline.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add scraper/core/pipeline.py scraper/tests/conftest.py scraper/tests/test_pipeline.py
git commit -m "feat(scraper): enrichment pipeline — TMDB match, upsert, source dedup"
```

---

### Task 9: streamvaults.ru adapter

**Files:**
- Create: `scraper/adapters/streamvaults.py`
- Create: `scraper/tests/test_streamvaults_adapter.py`

> **Note:** CSS selectors below are based on common patterns for such sites. Run the site inspection script in Step 1 to verify them before full implementation, then adjust selectors in `streamvaults.py` to match the live site structure.

- [ ] **Step 1: Inspect the live site structure (run this manually)**

```python
# Run once to print page HTML for selector discovery
# Save as scraper/inspect_site.py (do NOT commit)
import asyncio
from core.browser import get_page

async def inspect():
    async with get_page() as page:
        await page.goto("https://streamvaults.ru/movies/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3000)
        # Print the first movie card HTML to find selectors
        card = await page.query_selector(".movies-list .movie-item, article.item, .post, .ml-item")
        if card:
            print(await card.inner_html())
        else:
            print(await page.content())

asyncio.run(inspect())
```

Run: `cd scraper && python inspect_site.py`

Use the output to identify: (a) the CSS selector for movie cards, (b) the link element, (c) the title element. Update selectors in `streamvaults.py` accordingly.

- [ ] **Step 2: Write failing test — `scraper/tests/test_streamvaults_adapter.py`**

```python
import pytest
from adapters.streamvaults import StreamvaultsAdapter
from adapters.base import RawMovie


@pytest.mark.asyncio
async def test_parse_movie_cards_returns_raw_movies(mocker):
    """Unit test: adapter parses pre-loaded HTML without real browser."""
    adapter = StreamvaultsAdapter()

    sample_cards = [
        {"title": "Pushpa: The Rise", "year": 2021, "detail_url": "https://streamvaults.ru/pushpa-the-rise/"},
        {"title": "RRR", "year": 2022, "detail_url": "https://streamvaults.ru/rrr/"},
    ]

    async def fake_get_cards(page, url):
        return sample_cards

    async def fake_get_source(page, detail_url):
        return "https://embedhost.com/play/abc123"

    mocker.patch.object(adapter, "_get_movie_cards", new=fake_get_cards)
    mocker.patch.object(adapter, "_get_embed_url", new=fake_get_source)

    # Mock the browser so no real Playwright launch happens
    mock_page = mocker.AsyncMock()
    mock_cm = mocker.AsyncMock()
    mock_cm.__aenter__ = mocker.AsyncMock(return_value=mock_page)
    mock_cm.__aexit__ = mocker.AsyncMock(return_value=False)
    mocker.patch("adapters.streamvaults.get_page", return_value=mock_cm)

    results = await adapter.scrape()
    assert len(results) == 2
    assert isinstance(results[0], RawMovie)
    assert results[0].title == "Pushpa: The Rise"
    assert results[0].source.url == "https://embedhost.com/play/abc123"
    assert results[0].source.source_type == "iframe"
    assert results[0].source_site == "streamvaults.ru"


@pytest.mark.asyncio
async def test_skips_card_when_no_embed_found(mocker):
    adapter = StreamvaultsAdapter()

    async def fake_get_cards(page, url):
        return [{"title": "Some Movie", "year": 2023, "detail_url": "https://streamvaults.ru/some-movie/"}]

    async def fake_get_source(page, detail_url):
        return None  # No embed found

    mocker.patch.object(adapter, "_get_movie_cards", new=fake_get_cards)
    mocker.patch.object(adapter, "_get_embed_url", new=fake_get_source)

    mock_page = mocker.AsyncMock()
    mock_cm = mocker.AsyncMock()
    mock_cm.__aenter__ = mocker.AsyncMock(return_value=mock_page)
    mock_cm.__aexit__ = mocker.AsyncMock(return_value=False)
    mocker.patch("adapters.streamvaults.get_page", return_value=mock_cm)

    results = await adapter.scrape()
    assert results == []
```

- [ ] **Step 3: Run test to verify it fails**

```bash
cd scraper && python -m pytest tests/test_streamvaults_adapter.py -v
```

Expected: `ImportError: No module named 'adapters.streamvaults'`

- [ ] **Step 4: Implement `scraper/adapters/streamvaults.py`**

```python
"""
streamvaults.ru adapter.

IMPORTANT: CSS selectors below were written based on common site patterns.
Run inspect_site.py first and update CARD_SELECTOR, TITLE_SELECTOR,
YEAR_SELECTOR, LINK_SELECTOR, and IFRAME_SELECTOR to match the live site.
"""
from __future__ import annotations
import re
from playwright.async_api import Page
from core.browser import get_page, random_delay
from adapters.base import BaseAdapter, RawMovie, RawSource

BASE_URL = "https://streamvaults.ru"
LISTING_URL = f"{BASE_URL}/movies/"
MAX_PAGES = 5  # scrape first 5 pages per run

# Update these after inspecting live site with inspect_site.py
CARD_SELECTOR = ".ml-item, article.item, .movie-item"
TITLE_SELECTOR = ".movie-title, h2, .title"
YEAR_SELECTOR = ".year, .release-year"
LINK_SELECTOR = "a"
IFRAME_SELECTOR = "iframe[src]"


class StreamvaultsAdapter(BaseAdapter):
    site_name = "streamvaults.ru"

    async def scrape(self) -> list[RawMovie]:
        results: list[RawMovie] = []
        async with get_page() as page:
            for page_num in range(1, MAX_PAGES + 1):
                url = LISTING_URL if page_num == 1 else f"{LISTING_URL}page/{page_num}/"
                cards = await self._get_movie_cards(page, url)
                if not cards:
                    break

                for card in cards:
                    await random_delay(1.5, 3.5)
                    embed_url = await self._get_embed_url(page, card["detail_url"])
                    if not embed_url:
                        continue
                    results.append(RawMovie(
                        title=card["title"],
                        year=card.get("year"),
                        source=RawSource(
                            server_name="Server 1",
                            url=embed_url,
                            source_type="iframe",
                        ),
                        source_site=self.site_name,
                    ))

                await random_delay(2.0, 4.0)

        return results

    async def _get_movie_cards(self, page: Page, url: str) -> list[dict]:
        await page.goto(url, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(2000)

        cards = await page.query_selector_all(CARD_SELECTOR)
        results = []
        for card in cards:
            link_el = await card.query_selector(LINK_SELECTOR)
            title_el = await card.query_selector(TITLE_SELECTOR)
            year_el = await card.query_selector(YEAR_SELECTOR)

            if not link_el or not title_el:
                continue

            href = await link_el.get_attribute("href") or ""
            title = (await title_el.inner_text()).strip()
            year_text = (await year_el.inner_text()).strip() if year_el else ""
            year_match = re.search(r"(19|20)\d{2}", year_text)
            year = int(year_match.group()) if year_match else None

            if href and title:
                detail_url = href if href.startswith("http") else f"{BASE_URL}{href}"
                results.append({"title": title, "year": year, "detail_url": detail_url})

        return results

    async def _get_embed_url(self, page: Page, detail_url: str) -> str | None:
        try:
            await page.goto(detail_url, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(2000)
            iframe = await page.query_selector(IFRAME_SELECTOR)
            if iframe:
                return await iframe.get_attribute("src")
            return None
        except Exception:
            return None
```

- [ ] **Step 5: Run test to verify it passes**

```bash
cd scraper && python -m pytest tests/test_streamvaults_adapter.py -v
```

Expected: 2 passed.

- [ ] **Step 6: Run all scraper tests**

```bash
cd scraper && python -m pytest -v
```

Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add scraper/adapters/streamvaults.py scraper/tests/test_streamvaults_adapter.py
git commit -m "feat(scraper): streamvaults.ru adapter with listing + embed extraction"
```

---

### Task 10: Orchestrator + GitHub Actions workflow

**Files:**
- Create: `scraper/scheduler/run.py`
- Create: `.github/workflows/scraper.yml`

- [ ] **Step 1: Create `scraper/scheduler/run.py`**

```python
import asyncio
import sys
from core.config import load_config
from core.db import get_db, start_scrape_job, finish_scrape_job
from core.pipeline import Pipeline
from adapters.streamvaults import StreamvaultsAdapter

ADAPTERS = [StreamvaultsAdapter]


async def main() -> None:
    config = load_config()
    db = get_db(config.mongodb_uri)
    pipeline = Pipeline(db=db, tmdb_api_key=config.tmdb_api_key)

    total_errors: list[str] = []

    for AdapterClass in ADAPTERS:
        adapter = AdapterClass()
        print(f"[scraper] Starting {AdapterClass.site_name}")
        job_id = start_scrape_job(db, AdapterClass.site_name)
        try:
            raw_movies = await adapter.scrape()
            print(f"[scraper] Found {len(raw_movies)} raw movies from {AdapterClass.site_name}")
            count, errors = await pipeline.process(raw_movies)
            finish_scrape_job(db, job_id, count, errors)
            print(f"[scraper] Upserted {count} movies. Errors: {len(errors)}")
            total_errors.extend(errors)
        except Exception as exc:
            finish_scrape_job(db, job_id, 0, [str(exc)])
            print(f"[scraper] Adapter {AdapterClass.site_name} failed: {exc}", file=sys.stderr)
            total_errors.append(str(exc))

    await pipeline.close()

    if total_errors:
        print(f"\n[scraper] Total errors: {len(total_errors)}")
        for err in total_errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)
    else:
        print("[scraper] Done — no errors.")


if __name__ == "__main__":
    asyncio.run(main())
```

- [ ] **Step 2: Create `.github/workflows/scraper.yml`**

```yaml
name: Nightly Scraper

on:
  schedule:
    - cron: '0 2 * * *'   # 2:00 AM UTC every day
  workflow_dispatch:        # allow manual trigger from GitHub UI

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
          cache: pip
          cache-dependency-path: scraper/requirements.txt

      - name: Install Python dependencies
        working-directory: scraper
        run: pip install -r requirements.txt

      - name: Install Playwright browser
        working-directory: scraper
        run: playwright install chromium --with-deps

      - name: Run scraper
        working-directory: scraper
        env:
          MONGODB_URI: ${{ secrets.MONGODB_URI }}
          TMDB_API_KEY: ${{ secrets.TMDB_API_KEY }}
        run: python -m scheduler.run
```

- [ ] **Step 3: Add GitHub Actions secrets**

In the GitHub repo (`github.com/mudit7011/Movora`) → Settings → Secrets and variables → Actions → New repository secret:

- `MONGODB_URI` → paste the full Atlas connection string from `.env`
- `TMDB_API_KEY` → `40d8ca341d59df01b499e95d345af75c`

- [ ] **Step 4: Commit and push**

```bash
git add scraper/scheduler/run.py .github/workflows/scraper.yml
git commit -m "feat(scraper): orchestrator entry point and GitHub Actions nightly cron"
git push
```

- [ ] **Step 5: Verify GitHub Actions workflow appears**

Go to `github.com/mudit7011/Movora` → Actions tab. The "Nightly Scraper" workflow should appear. Click "Run workflow" to trigger a manual test run.

---

## Self-Review

**Spec coverage check:**
- Playwright + stealth browser manager ✓
- Pluggable adapter pattern (`BaseAdapter` → `StreamvaultsAdapter`) ✓
- TMDB metadata enrichment (posters, backdrops, trailers, cast) ✓
- MongoDB upsert with source dedup by `serverName` ✓
- `scrape_jobs` collection with `scrapeErrors` field ✓
- GitHub Actions nightly cron at 2am UTC ✓
- Manual trigger via `workflow_dispatch` ✓
- Random delays + randomized UA for anti-detection ✓
- Language hint support (e.g. "Hindi Dubbed" tag from adapter) ✓

**Known limitation:** streamvaults.ru CSS selectors require manual verification via `inspect_site.py` (Task 9, Step 1) before the adapter will work on the live site. This is intentional — selectors change as sites update their HTML.
