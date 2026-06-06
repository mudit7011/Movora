"""
mitmproxy filter — logs only video embed/player URLs.
Run: mitmproxy -s scripts/mitm-filter.py --listen-port 8080
"""
import re
from mitmproxy import http

VIDEO_PATTERNS = [
    r'/embed/', r'/player/', r'/stream/',
    r'vidsrc', r'2embed', r'vidlink', r'autoembed',
    r'multiembed', r'embed\.su', r'videasy',
    r'\.m3u8', r'streamtape', r'doodstream',
    r'mixdrop', r'filemoon', r'rabbitstream',
    r'upcloud', r'megacloud', r'moonplayer',
    r'gogoplay', r'closeload', r'chillx',
    r'moviesapi', r'smashystream', r'vidmoly',
    r'vidcloud', r'nova\.cool', r'frembed',
]

seen = set()

def request(flow: http.HTTPFlow) -> None:
    url = flow.request.pretty_url
    for pattern in VIDEO_PATTERNS:
        if re.search(pattern, url, re.IGNORECASE):
            if url not in seen:
                seen.add(url)
                print(f"\n{'='*60}")
                print(f"  🎯 EMBED FOUND: {url}")
                print(f"{'='*60}")
            break
