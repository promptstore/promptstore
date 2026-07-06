# promptstore-telemetry (Python SDK)

Fail-safe agentic-harness observability for [promptstore](../../). Emits canonical
spans (loops, tool calls, sub-agents, model calls, context-lifecycle events) to a
promptstore telemetry endpoint.

## Safety guarantees

This SDK is designed so that **promptstore can never impact your application**:

- **Non-blocking** — spans are enqueued to a bounded in-memory buffer and flushed by a background daemon thread.
- **Never raises into your code** — every telemetry operation is guarded. Your own exceptions inside a `with span(...)` still propagate (and are recorded as an error status).
- **Bounded memory** — under backpressure the buffer drops the oldest spans.
- **Circuit breaker** — repeated failures open a breaker and the SDK stops trying (and stops buffering) until a cooldown elapses.
- **Zero runtime dependencies** — standard library only.

## Install

From PyPI:

```bash
pip install promptstore-telemetry
```

Requires Python 3.10+. The SDK has zero runtime dependencies (standard library only).

Pin a version for reproducible builds:

```bash
pip install "promptstore-telemetry==0.1.0"
```

Or add it to your project:

```toml
# pyproject.toml
dependencies = ["promptstore-telemetry>=0.1.0"]
```

```
# requirements.txt
promptstore-telemetry>=0.1.0
```

### From source

To develop against a checkout of this repo (editable install):

```bash
pip install -e sdk/python          # add [dev] for the test extras: pip install -e "sdk/python[dev]"
```

## Usage

```python
import promptstore_telemetry as ps

ps.configure(base_url="https://promptstore.example.com", api_key="pst_...")
# or set PROMPTSTORE_URL and PROMPTSTORE_TELEMETRY_KEY

with ps.trace("research-agent") as run:
    for turn in range(max_turns):
        with ps.span(ps.SpanKind.LOOP_ITERATION, f"turn-{turn}"):
            with ps.span(ps.SpanKind.MODEL_CALL, "plan") as m:
                m.set_model(provider="anthropic", response_model="claude-3-5-sonnet-20241022")
                m.set_usage(prompt_tokens=1200, completion_tokens=300, cached_tokens=800)

            # context lifecycle — powers the Context view (budget chart,
            # composition, change cards). Include sources=[...] for full
            # per-source attribution; see docs/telemetry-sdk.md
            # ("Instrumenting context") and examples/multi_agent.py.
            ps.context_event(ps.ContextEventName.COMPACT,
                             sources=[{"source": "history", "tokens": 30000,
                                       "label": "summary of earlier turns"}],
                             window_tokens_before=180000, window_tokens_after=90000,
                             window_limit=200000,
                             tokens_reclaimed=90000, method="summarize")

@ps.tool("web_search")
def web_search(q): ...

# sub-agents across processes
with ps.subagent("researcher") as sub:
    traceparent = ps.get_traceparent()   # hand to the child process
```

Get a write-only telemetry key from promptstore:
`POST /api/workspaces/:workspaceId/telemetry-keys`.

## Configuration

`configure(base_url, api_key, *, flush_interval=2.0, max_batch=128, max_buffer=10000,
emit_on_start=True, timeout=5.0, circuit_fail_threshold=5, circuit_cooldown=30.0,
redactor=None, deny_keys=None, enabled=True)`

- `emit_on_start` — also emit a span when it opens (enables the live view). The server upserts start+end into one row.
- `redactor` / `deny_keys` — PII redaction hooks applied to attributes and event payloads **before** they leave the process.
