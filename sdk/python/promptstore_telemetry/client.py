"""Fail-safe telemetry client for promptstore agentic-harness observability.

Design contract (non-negotiable): this SDK must NEVER impact the host
application. Concretely:

* No telemetry call blocks the caller: spans are enqueued to a bounded in-memory
  buffer and flushed by a background daemon thread.
* Nothing raises into user code. Every telemetry operation is wrapped so that a
  bug or an unreachable promptstore surfaces only as a dropped span, never an
  exception. (User exceptions inside a ``with span(...)`` block still propagate
  normally — we record the error status and re-raise.)
* Under backpressure the buffer drops oldest spans rather than growing without
  bound.
* When promptstore is failing, a circuit breaker opens and the SDK stops trying
  (and stops buffering) until a cooldown elapses.

Dependency-free: uses only the Python standard library.
"""

from __future__ import annotations

import atexit
import contextvars
import functools
import hashlib
import json
import logging
import os
import queue
import re
import secrets
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone

__all__ = [
    "configure",
    "trace",
    "span",
    "subagent",
    "conversation",
    "turn",
    "hitl_pause_open",
    "hitl_pause_close",
    "end_conversation",
    "tool",
    "agent",
    "context_event",
    "set_attributes",
    "get_traceparent",
    "derive_trace_id",
    "derive_span_id",
    "flush",
    "shutdown",
    "SpanKind",
    "LinkRel",
    "TelemetryClient",
]

_log = logging.getLogger("promptstore.telemetry")
_SDK_VERSION = "0.1.1"
_USER_AGENT = f"promptstore-telemetry/{_SDK_VERSION}"


class SpanKind:
    HARNESS_RUN = "harness.run"
    LOOP_ITERATION = "loop.iteration"
    MODEL_CALL = "model.call"
    TOOL_CALL = "tool.call"
    SUBAGENT_SPAWN = "subagent.spawn"
    HITL_PAUSE = "hitl.pause"
    COMPOSITION_CALL = "composition.call"
    FUNCTION_CALL = "function.call"
    PROMPT_RENDER = "prompt.render"
    CONTEXT_OP = "context.op"
    RETRIEVAL = "retrieval"
    EVALUATION = "evaluation"
    GUARDRAIL = "guardrail"
    CUSTOM = "custom"


class LinkRel:
    SPAWNS = "spawns"
    SPAWNED_BY = "spawned_by"
    RESUMES = "resumes"
    RETRIES = "retries"
    FOLLOWS_FROM = "follows_from"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _gen_trace_id() -> str:
    return secrets.token_hex(16)  # 128-bit


def _gen_span_id() -> str:
    return secrets.token_hex(8)  # 64-bit


# Deterministic ids derived from a conversation id, so every turn — in any
# process, in any order — opens/closes exactly the right span with no shared
# handoff state (ingest upserts on (trace_id, span_id)).
def _derive_hex(seed: str, nbytes: int) -> str:
    return hashlib.sha256(seed.encode("utf-8")).hexdigest()[: nbytes * 2]


def derive_trace_id(conversation_id: str) -> str:
    return _derive_hex(conversation_id, 16)  # 128-bit, 32 hex chars


def derive_span_id(conversation_id: str, *parts) -> str:
    seed = ":".join([conversation_id, *[str(p) for p in parts]])
    return _derive_hex(seed, 8)  # 64-bit, 16 hex chars


# Active span context — enables automatic parent/child nesting across `with`
# blocks and, via contextvars, across async tasks and threads that copy context.
_current = contextvars.ContextVar("ps_current_span", default=None)


# ---------------------------------------------------------------------------
# Redaction — content capture defaults ON, so a baseline secret scrubber runs by
# default. It masks high-signal credential patterns wherever they appear in
# captured strings; the caller's own `redactor` / `deny_keys` compose on top.
# ---------------------------------------------------------------------------

_SECRET_PATTERNS = [
    re.compile(r"sk-ant-[A-Za-z0-9_\-]{20,}"),                 # Anthropic keys
    re.compile(r"sk-[A-Za-z0-9_\-]{20,}"),                     # OpenAI-style keys
    re.compile(r"(?i)bearer\s+[A-Za-z0-9._\-]{10,}"),          # bearer tokens
    re.compile(r"AKIA[0-9A-Z]{16}"),                           # AWS access key id
    re.compile(r"gh[pousr]_[A-Za-z0-9]{20,}"),                 # GitHub tokens
    re.compile(r"xox[baprs]-[A-Za-z0-9\-]{10,}"),              # Slack tokens
    re.compile(r"-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----"),
]


def _scrub_secret_string(s):
    try:
        for pat in _SECRET_PATTERNS:
            s = pat.sub("[redacted-secret]", s)
    except Exception:  # pragma: no cover
        pass
    return s


def _scrub_deep(obj):
    if isinstance(obj, str):
        return _scrub_secret_string(obj)
    if isinstance(obj, dict):
        return {k: _scrub_deep(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_scrub_deep(v) for v in obj]
    return obj


def _apply_deny(obj, deny):
    if isinstance(obj, dict):
        return {k: ("[redacted]" if k in deny else _apply_deny(v, deny)) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return [_apply_deny(v, deny) for v in obj]
    return obj


class _SpanHandle:
    """Represents an open span. Returned by the ``span`` context manager."""

    def __init__(self, client, trace_id, span_id, parent_span_id, kind, name, session_id=None):
        self._client = client
        self.trace_id = trace_id
        self.span_id = span_id
        self.parent_span_id = parent_span_id
        self.kind = kind
        self.name = name
        self.session_id = session_id
        self.start_time = _now_iso()
        self.end_time = None
        self.status = "unset"
        self.status_message = None
        self.attributes: dict = {}
        self.events: list = []
        self.links: list = []
        self.usage: dict | None = None
        self.provider = None
        self.request_model = None
        self.response_model = None
        self.content: dict | None = None    # captured input/output (offloaded server-side)

    # ---- fluent setters (all guarded, never raise) ----
    def set_attributes(self, **attrs):
        try:
            self.attributes.update(attrs)
        except Exception:  # pragma: no cover - defensive
            pass
        return self

    def set_usage(self, prompt_tokens=None, completion_tokens=None, total_tokens=None,
                  cached_tokens=None, reasoning_tokens=None):
        try:
            self.usage = {
                "prompt_tokens": prompt_tokens,
                "completion_tokens": completion_tokens,
                "total_tokens": total_tokens,
                "cached_tokens": cached_tokens,
                "reasoning_tokens": reasoning_tokens,
            }
        except Exception:  # pragma: no cover
            pass
        return self

    def set_model(self, provider=None, request_model=None, response_model=None):
        self.provider = provider
        self.request_model = request_model
        self.response_model = response_model
        return self

    def add_event(self, name, attributes=None):
        try:
            self.events.append({
                "name": name,
                "time": _now_iso(),
                "attributes": self._client._redact(attributes or {}),
            })
        except Exception:  # pragma: no cover
            pass
        return self

    def set_content(self, input=None, output=None, **extra):
        """Attach the span's actual content — for a model.call the input messages
        and output text; for a tool.call the input args and output. Captured by
        default (subject to redaction) and offloaded server-side, so it does not
        bloat the span row. Pass capture_content=False to ps.configure to disable.
        """
        try:
            content = {}
            if input is not None:
                content["input"] = input
            if output is not None:
                content["output"] = output
            content.update(extra)
            self.content = content
        except Exception:  # pragma: no cover
            pass
        return self

    def _to_payload(self, closing: bool) -> dict:
        return {
            "trace_id": self.trace_id,
            "span_id": self.span_id,
            "parent_span_id": self.parent_span_id,
            "span_kind": self.kind,
            "name": self.name,
            "start_time": self.start_time,
            "end_time": self.end_time if closing else None,
            "status": self.status,
            "status_message": self.status_message,
            "provider": self.provider,
            "request_model": self.request_model,
            "response_model": self.response_model,
            "usage": self.usage,
            "attributes": self._client._redact(self.attributes),
            "events": self.events,
            "links": self.links,
            "content": (self._client._prepare_content(self.content)
                        if (self._client.capture_content and self.content is not None) else None),
            "session_id": self.session_id if self.session_id is not None else self._client.session_id,
            "sdk_version": _SDK_VERSION,
        }


class TelemetryClient:

    def __init__(
        self,
        base_url: str,
        api_key: str,
        *,
        flush_interval: float = 2.0,
        max_batch: int = 128,
        max_buffer: int = 10000,
        emit_on_start: bool = True,
        timeout: float = 5.0,
        circuit_fail_threshold: int = 5,
        circuit_cooldown: float = 30.0,
        redactor=None,
        deny_keys=None,
        capture_content: bool = True,
        default_redaction: bool = True,
        content_max_bytes: int = 200_000,
        enabled: bool = True,
        session_id=None,
    ):
        self.base_url = base_url.rstrip("/") if base_url else ""
        self.api_key = api_key or ""
        self.session_id = session_id
        self.endpoint = self.base_url + "/v1/telemetry/spans"
        self.flush_interval = flush_interval
        self.max_batch = max_batch
        self.emit_on_start = emit_on_start
        self.timeout = timeout
        self.circuit_fail_threshold = circuit_fail_threshold
        self.circuit_cooldown = circuit_cooldown
        self._redactor = redactor
        self._deny_keys = set(deny_keys or [])
        self.capture_content = capture_content
        self.default_redaction = default_redaction
        self.content_max_bytes = content_max_bytes
        self.enabled = enabled and bool(self.base_url) and bool(self.api_key)

        self._q: "queue.Queue[dict]" = queue.Queue(maxsize=max_buffer)
        self._seq_lock = threading.Lock()
        self._seq_by_trace: dict = {}
        self._consecutive_failures = 0
        self._circuit_open_until = 0.0
        self._stop = threading.Event()
        self._dropped = 0

        if self.enabled:
            self._worker = threading.Thread(target=self._run, name="ps-telemetry", daemon=True)
            self._worker.start()
            atexit.register(self.shutdown)
        else:
            self._worker = None
            _log.info("promptstore telemetry disabled (missing base_url/api_key)")

    # ---- redaction ----
    # Order: baseline secret scrub (deep) → deny-keys (deep) → caller's redactor.
    def _redact(self, obj):
        try:
            if self.default_redaction:
                obj = _scrub_deep(obj)
            if self._deny_keys:
                obj = _apply_deny(obj, self._deny_keys)
            if self._redactor:
                obj = self._redactor(obj)
            return obj
        except Exception:  # pragma: no cover - redaction must never break emit
            return {}

    # Redact + size-cap captured content. Oversized content is dropped to a
    # small marker so a huge prompt/response can never blow the buffer or batch.
    def _prepare_content(self, content):
        if content is None:
            return None
        redacted = self._redact(content)
        try:
            encoded = json.dumps(redacted)
        except Exception:  # pragma: no cover - non-serializable content
            return {"_error": "content not serializable"}
        if len(encoded) > self.content_max_bytes:
            return {"_truncated": True, "_bytes": len(encoded), "preview": encoded[:2000]}
        return redacted

    def _next_seq(self, trace_id: str) -> int:
        with self._seq_lock:
            n = self._seq_by_trace.get(trace_id, 0)
            self._seq_by_trace[trace_id] = n + 1
            return n

    # ---- enqueue (non-blocking, drop-oldest under backpressure) ----
    def _enqueue(self, payload: dict):
        if not self.enabled:
            return
        try:
            payload["seq"] = self._next_seq(payload["trace_id"])
            try:
                self._q.put_nowait(payload)
            except queue.Full:
                # drop oldest to make room, then retry once
                try:
                    self._q.get_nowait()
                    self._dropped += 1
                    self._q.put_nowait(payload)
                except queue.Empty:
                    pass
                except queue.Full:
                    self._dropped += 1
        except Exception:  # pragma: no cover - never raise into caller
            pass

    # ---- background worker ----
    def _run(self):
        while not self._stop.is_set():
            batch = self._drain(self.max_batch, self.flush_interval)
            if batch:
                self._send(batch)
        # final drain on shutdown
        remaining = self._drain(self.max_batch, 0)
        while remaining:
            self._send(remaining)
            remaining = self._drain(self.max_batch, 0)

    def _drain(self, max_items, wait):
        batch = []
        deadline = time.monotonic() + wait
        try:
            first = self._q.get(timeout=max(0.0, wait)) if wait else self._q.get_nowait()
            batch.append(first)
        except queue.Empty:
            return batch
        while len(batch) < max_items:
            timeout = deadline - time.monotonic()
            if timeout <= 0:
                break
            try:
                batch.append(self._q.get_nowait())
            except queue.Empty:
                break
        return batch

    def _circuit_open(self) -> bool:
        return time.monotonic() < self._circuit_open_until

    def _send(self, batch):
        if self._circuit_open():
            # while the breaker is open, discard rather than pile up
            self._dropped += len(batch)
            return
        body = json.dumps({"spans": batch}).encode("utf-8")
        req = urllib.request.Request(
            self.endpoint,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "apikey": self.api_key,
                # Identify ourselves. urllib's default (``Python-urllib/3.x``) is
                # blocked outright by common WAF bot rules — Cloudflare answers it
                # with 403 ``error code: 1010`` — which silently drops every batch
                # for any promptstore deployment sitting behind one.
                "User-Agent": _USER_AGENT,
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                resp.read()
            self._consecutive_failures = 0
        except Exception as err:  # network, HTTP, timeout — all non-fatal
            self._consecutive_failures += 1
            self._dropped += len(batch)
            if self._consecutive_failures >= self.circuit_fail_threshold:
                self._circuit_open_until = time.monotonic() + self.circuit_cooldown
                self._consecutive_failures = 0
                _log.warning("promptstore telemetry circuit opened for %ss: %s",
                             self.circuit_cooldown, err)

    # ---- public span API ----
    def start_span(self, kind, name=None, *, trace_id=None, span_id=None, parent_span_id=None,
                   attributes=None, links=None, session_id=None) -> _SpanHandle:
        parent = _current.get()
        if trace_id is None:
            trace_id = parent.trace_id if parent else _gen_trace_id()
        if parent_span_id is None and parent is not None:
            parent_span_id = parent.span_id
        if session_id is None and parent is not None:
            session_id = parent.session_id
        h = _SpanHandle(self, trace_id, span_id or _gen_span_id(), parent_span_id, kind, name,
                        session_id=session_id)
        if attributes:
            h.attributes.update(attributes)
        if links:
            h.links.extend(links)
        if self.emit_on_start:
            self._enqueue(h._to_payload(closing=False))
        return h

    def end_span(self, h: _SpanHandle, status=None, status_message=None):
        try:
            h.end_time = _now_iso()
            if status:
                h.status = status
            elif h.status == "unset":
                h.status = "ok"
            if status_message:
                h.status_message = status_message
            self._enqueue(h._to_payload(closing=True))
        except Exception:  # pragma: no cover
            pass

    # ---- deterministic, handle-free emits (cross-process HITL conversations) ----
    # These build a span from ids derived from the conversation id and enqueue it
    # directly, so a later turn (in another process) can open/close exactly the
    # same span with no shared in-memory handle. Ingest upserts on
    # (trace_id, span_id): LEAST keeps the true earlier start, the later end wins.
    def emit_hitl_pause(self, conversation_id, index, *, closing,
                        name=None, status=None, status_message=None):
        try:
            h = _SpanHandle(
                self,
                derive_trace_id(conversation_id),
                derive_span_id(conversation_id, "pause", index),
                derive_span_id(conversation_id, "root"),
                SpanKind.HITL_PAUSE,
                name or "awaiting user input",
                session_id=conversation_id,
            )
            if closing:
                h.end_time = _now_iso()
                h.status = status or "ok"
                h.status_message = status_message
            self._enqueue(h._to_payload(closing=closing))
        except Exception:  # pragma: no cover - never raise into caller
            pass

    def emit_conversation_end(self, conversation_id, *, status="ok",
                              status_message=None, name=None):
        try:
            h = _SpanHandle(
                self,
                derive_trace_id(conversation_id),
                derive_span_id(conversation_id, "root"),
                None,
                SpanKind.HARNESS_RUN,
                name or "conversation",
                session_id=conversation_id,
            )
            h.end_time = _now_iso()
            h.status = status
            h.status_message = status_message
            self._enqueue(h._to_payload(closing=True))
        except Exception:  # pragma: no cover
            pass

    def flush(self, timeout: float = 5.0):
        deadline = time.monotonic() + timeout
        while not self._q.empty() and time.monotonic() < deadline:
            time.sleep(0.02)

    def shutdown(self, timeout: float = 5.0):
        if not self.enabled or self._stop.is_set():
            return
        self._stop.set()
        if self._worker:
            self._worker.join(timeout=timeout)


# ---------------------------------------------------------------------------
# Module-level singleton + ergonomic helpers
# ---------------------------------------------------------------------------

_client: TelemetryClient | None = None


def configure(base_url=None, api_key=None, **kwargs) -> TelemetryClient:
    """Configure the global telemetry client. Never raises."""
    global _client
    try:
        base_url = base_url or os.environ.get("PROMPTSTORE_URL", "")
        api_key = api_key or os.environ.get("PROMPTSTORE_TELEMETRY_KEY", "")
        _client = TelemetryClient(base_url, api_key, **kwargs)
    except Exception as err:  # pragma: no cover
        _log.warning("promptstore telemetry failed to configure (disabled): %s", err)
        _client = TelemetryClient("", "", enabled=False)
    return _client


def _get() -> TelemetryClient:
    global _client
    if _client is None:
        configure()
    return _client


class _SpanCtx:
    """Context manager that also usable as a decorator target internally."""

    def __init__(self, kind, name=None, **kw):
        self.kind = kind
        self.name = name
        self.kw = kw
        self._h = None
        self._token = None
        self._child_trace = None   # set by subagent() for cross-process handoff

    def __enter__(self) -> _SpanHandle:
        try:
            self._h = _get().start_span(self.kind, self.name, **self.kw)
            self._token = _current.set(self._h)
        except Exception:  # pragma: no cover
            self._h = _SpanHandle(_get(), _gen_trace_id(), _gen_span_id(), None, self.kind, self.name)
        # expose the spawned child trace so get_traceparent() hands the child's
        # id to the sub-agent process (the parent span links to it as 'spawns').
        self._h._child_trace = self._child_trace
        return self._h

    def __exit__(self, exc_type, exc, tb):
        try:
            if exc_type is not None:
                _get().end_span(self._h, status="error", status_message=str(exc))
            else:
                _get().end_span(self._h)
        except Exception:  # pragma: no cover
            pass
        finally:
            try:
                if self._token is not None:
                    _current.reset(self._token)
            except Exception:  # pragma: no cover
                pass
        return False  # never suppress the user's exception


def _parse_traceparent(tp):
    """Parse '00-<trace_id>-<span_id>-<flags>' -> (trace_id, span_id) or None."""
    try:
        parts = tp.split("-")
        if len(parts) >= 3 and parts[1] and parts[2]:
            return parts[1], parts[2]
    except Exception:  # pragma: no cover
        pass
    return None


def trace(name=None, parent_traceparent=None, **kw):
    """Start a top-level harness run (root span).

    Pass ``parent_traceparent`` (from a parent process's ``get_traceparent()``
    inside a ``subagent()`` block) to make this run adopt the child trace id the
    parent allocated, so the two traces stitch together.
    """
    if parent_traceparent:
        parsed = _parse_traceparent(parent_traceparent)
        if parsed:
            child_trace, parent_span = parsed
            kw.setdefault("trace_id", child_trace)
            attrs = kw.get("attributes") or {}
            attrs.setdefault("ps.parent_traceparent", parent_traceparent)
            attrs.setdefault("ps.parent_span_id", parent_span)
            kw["attributes"] = attrs
    return _SpanCtx(SpanKind.HARNESS_RUN, name, **kw)


def span(kind=SpanKind.CUSTOM, name=None, **kw):
    """Open a span of any kind, auto-parented to the enclosing span."""
    return _SpanCtx(kind, name, **kw)


def subagent(name=None, **kw):
    """Open a subagent.spawn span linked to a fresh child trace.

    Returns the context manager; inside it, ``get_traceparent()`` yields the
    child trace's traceparent to hand to the sub-agent process. The spawn span
    links to that child trace with rel='spawns'.
    """
    child_trace = _gen_trace_id()
    links = [{"trace_id": child_trace, "rel": LinkRel.SPAWNS}]
    ctx = _SpanCtx(SpanKind.SUBAGENT_SPAWN, name, links=links, **kw)
    ctx._child_trace = child_trace  # exposed to get_traceparent via the handle
    return ctx


def _current_session_id():
    try:
        cur = _current.get()
        return getattr(cur, "session_id", None) if cur is not None else None
    except Exception:  # pragma: no cover
        return None


class _ConversationCtx:
    """Context manager for a conversation modelled as one long-running run.

    Opens (or re-adopts, across processes) the conversation's ``harness.run``
    root — trace_id and root span_id are derived from ``conversation_id`` so
    every turn resolves to the same root with no shared handle. The raw id is
    stored in ``session_id``.

    ``close_on_exit=True`` (default) closes the root when the block exits — right
    for a single long-lived loop process. For the turn-per-process case, pass
    ``close_on_exit=False`` so intermediate turns leave the root open, and call
    ``end_conversation(conversation_id)`` on the final turn.
    """

    def __init__(self, conversation_id, name=None, close_on_exit=True, **kw):
        self.cid = conversation_id
        self.name = name or "conversation"
        self.close_on_exit = close_on_exit
        self.kw = kw
        self._h = None
        self._token = None

    def __enter__(self) -> _SpanHandle:
        try:
            self._h = _get().start_span(
                SpanKind.HARNESS_RUN, self.name,
                trace_id=derive_trace_id(self.cid),
                span_id=derive_span_id(self.cid, "root"),
                parent_span_id=None,
                session_id=self.cid,
                **self.kw,
            )
            self._token = _current.set(self._h)
        except Exception:  # pragma: no cover
            self._h = _SpanHandle(_get(), derive_trace_id(self.cid),
                                  derive_span_id(self.cid, "root"), None,
                                  SpanKind.HARNESS_RUN, self.name, session_id=self.cid)
        return self._h

    def __exit__(self, exc_type, exc, tb):
        try:
            if self.close_on_exit:
                if exc_type is not None:
                    _get().end_span(self._h, status="error", status_message=str(exc))
                else:
                    _get().end_span(self._h)
        except Exception:  # pragma: no cover
            pass
        finally:
            try:
                if self._token is not None:
                    _current.reset(self._token)
            except Exception:  # pragma: no cover
                pass
        return False  # never suppress the user's exception


def conversation(conversation_id, name=None, close_on_exit=True, **kw):
    """Open/adopt the ``harness.run`` root for a conversation (see _ConversationCtx)."""
    return _ConversationCtx(conversation_id, name=name, close_on_exit=close_on_exit, **kw)


def turn(index, name=None, conversation_id=None, **kw):
    """Open a ``loop.iteration`` for turn ``index`` under the current conversation.

    The span id is derived from (conversation_id, 'turn', index); turn N links to
    turn N-1 with rel='resumes'. Auto-parents to the conversation root.
    """
    cid = conversation_id or _current_session_id()
    links = list(kw.pop("links", None) or [])
    if cid and index and index > 0:
        links.append({
            "trace_id": derive_trace_id(cid),
            "span_id": derive_span_id(cid, "turn", index - 1),
            "rel": LinkRel.RESUMES,
        })
    span_id = derive_span_id(cid, "turn", index) if cid else None
    return _SpanCtx(SpanKind.LOOP_ITERATION, name or f"turn {index}",
                    span_id=span_id, links=links, **kw)


def hitl_pause_open(index, name=None, conversation_id=None):
    """Open the HITL pause span for the gap after turn ``index`` (fire-and-forget)."""
    cid = conversation_id or _current_session_id()
    if cid:
        _get().emit_hitl_pause(cid, index, closing=False, name=name)


def hitl_pause_close(index, conversation_id=None, status="ok"):
    """Close the HITL pause span for turn ``index`` when the next message arrives."""
    cid = conversation_id or _current_session_id()
    if cid:
        _get().emit_hitl_pause(cid, index, closing=True, status=status)


def end_conversation(conversation_id=None, status="ok", status_message=None):
    """Close the conversation root run. Use with ``conversation(..., close_on_exit=False)``."""
    cid = conversation_id or _current_session_id()
    if cid:
        _get().emit_conversation_end(cid, status=status, status_message=status_message)


def context_event(name, **payload):
    """Record a context-lifecycle event (assemble/retrieve/compact/evict) on the
    current span. Payload fields: window_tokens_before/after, window_limit,
    tokens_reclaimed, sources, method, policy, reason, etc."""
    try:
        cur = _current.get()
        if cur is not None:
            cur.add_event(name, payload)
    except Exception:  # pragma: no cover
        pass


def set_attributes(**attrs):
    try:
        cur = _current.get()
        if cur is not None:
            cur.set_attributes(**attrs)
    except Exception:  # pragma: no cover
        pass


def get_traceparent() -> str | None:
    """W3C-style traceparent for the current span, for cross-process propagation.

    Inside a ``subagent()`` block this yields the *child* trace id the parent
    allocated (which the parent span links to), so the sub-agent process can
    adopt it via ``trace(..., parent_traceparent=...)``.
    """
    try:
        cur = _current.get()
        if cur is None:
            return None
        tid = getattr(cur, "_child_trace", None) or cur.trace_id
        return f"00-{tid}-{cur.span_id}-01"
    except Exception:  # pragma: no cover
        return None


def tool(name=None):
    """Decorator: wrap a callable as a tool.call span."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with span(SpanKind.TOOL_CALL, name or getattr(fn, "__name__", "tool")):
                return fn(*args, **kwargs)
        return wrapper
    return deco


def agent(name=None, kind=SpanKind.LOOP_ITERATION):
    """Decorator: wrap a callable as an agent loop iteration (or given kind)."""
    def deco(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            with span(kind, name or getattr(fn, "__name__", "agent")):
                return fn(*args, **kwargs)
        return wrapper
    return deco


def flush(timeout: float = 5.0):
    _get().flush(timeout)


def shutdown(timeout: float = 5.0):
    if _client is not None:
        _client.shutdown(timeout)
