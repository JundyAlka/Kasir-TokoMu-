import os

LOCAL_TESTSPRITE_ORIGINS = (
    "http://localhost:3001",
    "http://127.0.0.1:3001",
)


def _normalize_base_url(value: str | None) -> str:
    if not value:
        return ""

    normalized = value.strip().rstrip("/")
    if not normalized:
        return ""

    if "://" not in normalized:
        normalized = f"https://{normalized}"

    return normalized


def resolve_base_url() -> str:
    candidates = (
        os.getenv("TESTSPRITE_BASE_URL"),
        os.getenv("TARGET_URL"),
        os.getenv("DEPLOYMENT_URL"),
        os.getenv("URL"),
        os.getenv("VERCEL_BRANCH_URL"),
        os.getenv("VERCEL_URL"),
        os.getenv("VERCEL_PROJECT_PRODUCTION_URL"),
    )

    for candidate in candidates:
        normalized = _normalize_base_url(candidate)
        if normalized:
            return normalized

    return LOCAL_TESTSPRITE_ORIGINS[0]


def remap_url(url: str, base_url: str | None = None) -> str:
    target_base_url = _normalize_base_url(base_url) or resolve_base_url()

    for local_origin in LOCAL_TESTSPRITE_ORIGINS:
        if url.startswith(local_origin):
            return f"{target_base_url}{url[len(local_origin):]}"

    return url


class BaseUrlPage:
    def __init__(self, page):
        self._page = page

    async def goto(self, url: str, *args, **kwargs):
        return await self._page.goto(remap_url(url), *args, **kwargs)

    def __getattr__(self, name):
        return getattr(self._page, name)


def bind_base_url(page):
    return BaseUrlPage(page)
