#!/usr/bin/env python3
"""Local-only ScrapeGraphAI sidecar. Bind 127.0.0.1 — never expose this."""

from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

from dotenv import load_dotenv
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

os.environ.setdefault("SCRAPEGRAPHAI_TELEMETRY_ENABLED", "false")

HOST = "127.0.0.1"
PORT = int(os.environ.get("SCRAPEGRAPH_PORT", "8765"))
DEFAULT_PROMPT = (
    "Extract publicly listed people and contacts from this page. "
    "For each person include first name, last name, job title, email (only if shown), "
    "company, phone, city, and LinkedIn URL. Prefer team, about, leadership, and contact info. "
    "Do not invent emails or phone numbers."
)


class Person(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    title: str | None = None
    email: str | None = None
    company: str | None = None
    phone: str | None = None
    city: str | None = None
    state: str | None = None
    country: str | None = None
    linkedin: str | None = None


class PeopleResult(BaseModel):
    company: str | None = None
    people: list[Person] = Field(default_factory=list)


def llm_config() -> dict[str, Any]:
    provider = os.environ.get("SCRAPEGRAPH_LLM", "anthropic").strip().lower()
    if provider == "ollama":
        model = os.environ.get("SCRAPEGRAPH_MODEL", "ollama/llama3.2")
        if "/" not in model:
            model = f"ollama/{model}"
        return {
            "llm": {
                "model": model,
                "temperature": 0,
                "format": "json",
                "base_url": os.environ.get("OLLAMA_BASE_URL", "http://127.0.0.1:11434"),
                "model_tokens": 8192,
            },
            "verbose": False,
            "headless": True,
            "html_mode": True,
            "cut": False,
        }

    model = os.environ.get("SCRAPEGRAPH_MODEL") or os.environ.get(
        "ANTHROPIC_MODEL", "claude-sonnet-5"
    )
    if not model.startswith("anthropic/"):
        model = f"anthropic/{model}"
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise RuntimeError("ANTHROPIC_API_KEY is not set (or switch SCRAPEGRAPH_LLM=ollama)")
    return {
        "llm": {
            "model": model,
            "api_key": api_key,
            "model_tokens": 8192,
        },
        "verbose": False,
        "headless": True,
        "html_mode": True,
        "cut": False,
    }


def _as_people_result(result: Any) -> dict[str, Any]:
    if isinstance(result, PeopleResult):
        return result.model_dump()
    if isinstance(result, list):
        return PeopleResult.model_validate({"people": result}).model_dump()
    if isinstance(result, dict):
        if "people" in result:
            return PeopleResult.model_validate(result).model_dump()
        # Single-person or oddly keyed payloads
        if any(key in result for key in ("email", "first_name", "name")):
            return PeopleResult.model_validate({"people": [result]}).model_dump()
        for value in result.values():
            if isinstance(value, list):
                try:
                    return PeopleResult.model_validate({"people": value}).model_dump()
                except Exception:
                    continue
    return PeopleResult(people=[]).model_dump()


def scrape(url: str, prompt: str) -> dict[str, Any]:
    from scrapegraphai.graphs import SmartScraperGraph

    graph = SmartScraperGraph(
        prompt=prompt,
        source=url,
        config=llm_config(),
        schema=PeopleResult,
    )
    return _as_people_result(graph.run())


class Handler(BaseHTTPRequestHandler):
    def log_message(self, format: str, *args: Any) -> None:
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))

    def _json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:
        if self.path.rstrip("/") != "/health":
            self._json(404, {"error": "Not found"})
            return
        provider = os.environ.get("SCRAPEGRAPH_LLM", "anthropic")
        self._json(
            200,
            {
                "ok": True,
                "local": True,
                "llm": provider,
                "model": os.environ.get("SCRAPEGRAPH_MODEL")
                or os.environ.get("ANTHROPIC_MODEL", "claude-sonnet-5"),
            },
        )

    def do_POST(self) -> None:
        if self.path.rstrip("/") != "/scrape":
            self._json(404, {"error": "Not found"})
            return
        length = int(self.headers.get("Content-Length") or 0)
        if length > 200_000:
            self._json(413, {"error": "Payload too large"})
            return
        try:
            raw = json.loads(self.rfile.read(length) or b"{}")
        except json.JSONDecodeError:
            self._json(400, {"error": "Invalid JSON"})
            return

        url = str(raw.get("url") or "").strip()
        prompt = str(raw.get("prompt") or DEFAULT_PROMPT).strip() or DEFAULT_PROMPT
        parsed = urlparse(url)
        if parsed.scheme not in ("http", "https") or not parsed.netloc:
            self._json(400, {"error": "url must be http(s)"})
            return

        try:
            result = scrape(url, prompt)
        except Exception as exc:
            self._json(502, {"error": str(exc)})
            return
        self._json(200, {"source": url, **result})


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"ScrapeGraphAI local sidecar on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
