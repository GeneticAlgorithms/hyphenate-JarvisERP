"""Optional Claude layer. JarvisERP works without a key (deterministic templates); with a key, Claude
writes the narration, plays the personas, defends decisions under questioning and parses free-text
scenarios. Claude never produces a number that the code does not recompute."""
from __future__ import annotations

import json

from jarvis import config

_client = None


_llm_test_result = None  # cache: None = not tested, True = live, False = failed


def available() -> bool:
    return bool(config.ANTHROPIC_API_KEY)


def client():
    global _client
    if _client is None:
        import anthropic
        _client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY, base_url=config.ANTHROPIC_URL)
    return _client


def complete(system: str, user: str, fast: bool = False, max_tokens: int = 700) -> str | None:
    if not available():
        return None
    try:
        msg = client().messages.create(
            model=config.MODEL_FAST if fast else config.MODEL_REASONING, max_tokens=max_tokens,
            system=system, messages=[{"role": "user", "content": user}])
        return "".join(b.text for b in msg.content if getattr(b, "type", "") == "text").strip()
    except Exception as e:  # network / quota - fall back to templates
        return None


def complete_json(system: str, user: str, fast: bool = True) -> dict | None:
    out = complete(system + "\nRespond with a single JSON object and nothing else.", user, fast=fast)
    if not out:
        return None
    try:
        start, end = out.index("{"), out.rindex("}") + 1
        return json.loads(out[start:end])
    except Exception:
        return None


def test_live() -> dict:
    """Test if LLM is actually working with a real call. Returns status dict."""
    global _llm_test_result
    
    if _llm_test_result is not None:
        return {"status": "live" if _llm_test_result else "fallback", "tested": True, "cached": True}
    
    if not available():
        _llm_test_result = False
        return {"status": "fallback", "tested": True, "reason": "no API key", "cached": False}
    
    try:
        result = complete("You are a test system.", "Respond with exactly: OK", fast=True, max_tokens=10)
        _llm_test_result = (result is not None)
        if _llm_test_result:
            return {"status": "live", "tested": True, "model": config.MODEL_FAST, "cached": False}
        else:
            return {"status": "fallback", "tested": True, "reason": "API call failed", "cached": False}
    except Exception as e:
        _llm_test_result = False
        return {"status": "fallback", "tested": True, "reason": str(e)[:100], "cached": False}
