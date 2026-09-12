# Telemetry SDK — installing & integrating harness observability

The **promptstore telemetry SDK** (`sdk/python/`) instruments an agentic harness
in another project and streams canonical spans (loops, tool calls, sub-agents,
model calls, and context-lifecycle events) to promptstore, where you can view
the run under **Observability → Harness Traces**.

The SDK is **fail-safe by design**: it never blocks your app, never raises into
your code, drops data under backpressure rather than growing unbounded, and
trips a circuit breaker when promptstore is unreachable. Adding it to a project
cannot slow that project down or crash it.

- Package: `promptstore-telemetry` (Python ≥ 3.10, **zero runtime dependencies**)
- Ingest endpoint: `POST <base_url>/v1/telemetry/spans`
- Auth: a **write-only telemetry key** (`pst_...`) scoped to one workspace

---

## 1. Issue a telemetry key

The SDK authenticates with a telemetry key, which can *only* write telemetry —
it cannot read traces or invoke functions, so it is safe to ship inside a client
deployment. Creating a key is a privileged action, so authenticate the creation
call with a normal login token or the master `PROMPTSTORE_API_KEY`:

```bash
curl -X POST https://your-promptstore/api/workspaces/<WORKSPACE_ID>/telemetry-keys \
  -H "apikey: $PROMPTSTORE_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label": "my-agent-prod"}'
# → { "key": "pst_abc123...", "record": { "id": 1, "type": "telemetry", ... } }
```

Copy the `key` value — the raw key is returned **once** and only its hash is
stored. To list or revoke keys:

```bash
curl https://your-promptstore/api/workspaces/<WORKSPACE_ID>/telemetry-keys -H "apikey: $PROMPTSTORE_API_KEY"
curl -X DELETE https://your-promptstore/api/telemetry-keys/<KEY_ID>       -H "apikey: $PROMPTSTORE_API_KEY"
```

---

## 2. Install the SDK

The SDK is not published to a package index yet, so install it from the
promptstore repo (it has no third-party dependencies):

```bash
# from a checkout of the promptstore repo
pip install -e /path/to/promptstore/sdk/python

# or reference it directly from git in your project's requirements
pip install "git+https://your-git-host/promptstore.git#subdirectory=sdk/python"
```

---

## 3. Configure

Configure once at startup. Pass values explicitly, or set the environment
variables `PROMPTSTORE_URL` and `PROMPTSTORE_TELEMETRY_KEY`:

```python
import promptstore_telemetry as ps

ps.configure(
    base_url="https://your-promptstore",   # promptstore root; SDK appends /v1/telemetry/spans
    api_key="pst_abc123...",               # your telemetry key
)
```

`base_url` is the promptstore root URL. If either `base_url` or `api_key` is
missing, the SDK **silently disables itself** — your app runs unchanged.

Useful configuration options (all optional):

| Option | Default | Purpose |
|---|---|---|
| `flush_interval` | `2.0` | Seconds between background flushes. |
| `max_batch` | `128` | Max spans per HTTP request. |
| `max_buffer` | `10000` | Bounded buffer size; oldest spans drop when full. |
| `emit_on_start` | `True` | Also emit a span when it opens (enables the live view). Start + end are merged server-side into one row. |
| `timeout` | `5.0` | HTTP request timeout (seconds). |
| `circuit_fail_threshold` | `5` | Consecutive failures before the breaker opens. |
| `circuit_cooldown` | `30.0` | Seconds the breaker stays open. |
| `redactor` | `None` | Callable applied to captured attributes / event payloads / content before they leave the process. |
| `deny_keys` | `None` | Keys to replace with `"[redacted]"`, recursively (nested too). |
| `capture_content` | `True` | Capture model/tool input & output via `set_content` (see below). Set `False` to disable entirely. |
| `default_redaction` | `True` | Run the built-in secret scrubber over everything captured. |
| `content_max_bytes` | `200000` | Per-span content cap; larger content is replaced by a truncation marker + preview. |
| `session_id` | `None` | Default conversation/session id stamped on every span. Usually set per-conversation via `ps.conversation(...)` instead (see [Conversations](#conversations-multi-turn-human-in-the-loop)). |

Example with redaction:

```python
ps.configure(
    base_url="https://your-promptstore",
    api_key="pst_abc123...",
    deny_keys=["api_key", "authorization", "ssn"],
    redactor=lambda obj: obj,   # or a custom regex scrubber
)
```

---

## 4. Instrument your harness

Spans nest automatically via the enclosing `with` block, so you only describe
the structure of your loop:

```python
import promptstore_telemetry as ps

ps.configure(base_url="https://your-promptstore", api_key="pst_abc123...")

with ps.trace("research-agent") as run:            # root harness.run span
    for turn in range(max_turns):
        with ps.span(ps.SpanKind.LOOP_ITERATION, f"turn-{turn}"):

            # a model call — record the model and token usage; cost is computed
            # server-side from these numbers using the LiteLLM price map
            with ps.span(ps.SpanKind.MODEL_CALL, "plan") as m:
                resp = call_model(...)
                m.set_model(provider="anthropic",
                            response_model="claude-3-5-sonnet-20241022")
                m.set_usage(
                    prompt_tokens=resp.usage.input_tokens,
                    completion_tokens=resp.usage.output_tokens,
                    cached_tokens=resp.usage.cache_read_input_tokens,   # discounted in cost
                )

            # a tool call
            with ps.span(ps.SpanKind.TOOL_CALL, "web_search") as t:
                results = web_search(query)
                t.set_attributes(query=query, num_results=len(results))

            # context lifecycle — powers the token-budget / compaction views
            ps.context_event(
                ps.ContextEventName.COMPACT,
                window_tokens_before=180000,
                window_tokens_after=90000,
                tokens_reclaimed=90000,
                window_limit=200000,
                method="summarize",
            )
```

### Decorators

Wrap functions instead of using `with` blocks:

```python
@ps.tool("web_search")
def web_search(query): ...

@ps.agent("planner")          # defaults to a loop.iteration span
def plan(state): ...
```

### Attributes and events

```python
m.set_attributes(temperature=0.7, top_p=0.95)
m.add_event("retry", {"attempt": 2, "cause": "rate_limit"})
ps.set_attributes(user_tier="pro")   # on the current span
```

### Capturing content (the Content panel)

To read the *actual* prompt messages, model output, and tool IO in a trace,
attach them with `set_content`. It appears in the span detail's **Content**
panel — model input rendered as role-labeled messages, output below; tool input
args and output as JSON.

```python
with ps.span(ps.SpanKind.MODEL_CALL, "plan") as m:
    m.set_content(
        input=[{"role": "system", "content": system_prompt},
               {"role": "user", "content": user_msg}],
        output=response_text,
    )

with ps.span(ps.SpanKind.TOOL_CALL, "web_search") as t:
    t.set_content(input={"query": q}, output=results)
```

**Capture is ON by default, with redaction.** Two things protect you:

- **Built-in secret scrubber** (`default_redaction=True`) masks credential
  patterns — OpenAI/Anthropic keys, bearer tokens, AWS/GitHub/Slack tokens,
  PEM private-key blocks — anywhere they appear in captured strings, replacing
  them with `[redacted-secret]`. Your own `redactor` / `deny_keys` compose on top
  (scrub → deny-keys → your redactor).
- **Content never touches the hot span row.** The server offloads it to a
  separate payload store, keeping only a reference; the Content panel fetches it
  lazily. Oversized content (> `content_max_bytes`) is dropped to a truncation
  marker + short preview, so a giant prompt can't bloat the pipeline.

To capture nothing at all, set `capture_content=False`. The scrubber is a safety
net, **not** a guarantee for free-form PII (names, emails in prose) — use
`deny_keys` / a custom `redactor` for that, or disable capture on sensitive spans.

Content reads are served only over the authenticated `/api` surface, so
write-only telemetry keys can never read back what they wrote.

### Instrumenting context (the Context view)

The **Context** tab in a harness trace shows what was in the model's context
window at every step, where it came from, and how each operation transformed it:
a token-budget-over-steps chart with the window limit, a per-step composition
bar and source table, and "what changed" cards for compactions and evictions.

promptstore **cannot infer any of this** — it renders exactly the events your
context-management code emits. Instrument the four moments where your harness
touches the window:

| Event | Emit when | Typical payload focus |
|---|---|---|
| `ContextEventName.ASSEMBLE` | you build (or rebuild) the prompt for a turn — also for appending tool results | full `sources` composition |
| `ContextEventName.RETRIEVE` | RAG / search / memory injects content | `sources` + `added_ids`, `window_tokens_before` |
| `ContextEventName.COMPACT` | you summarize/truncate/dedupe to reclaim budget | `tokens_reclaimed`, `method`, `summarized_from/into` |
| `ContextEventName.EVICT` | you drop content to fit the budget | `tokens_evicted`, `policy`, `reason`, `dropped_ids` |

Call `ps.context_event(name, **payload)` **inside the span the operation belongs
to** — usually the enclosing `LOOP_ITERATION` span (or a dedicated
`CONTEXT_OP` span for out-of-turn operations like pruning before a hand-off).
The event is attributed to that span's turn and agent, which is what drives the
"where am I" breadcrumb (`agent › turn › step`); turn attribution never crosses
a sub-agent boundary.

#### Mapping harness mechanisms to context events

Real harnesses rarely have neat "RAG retrieve" / "compact" methods — they have
their own mechanisms, and it isn't always obvious which event each one is. The
rule that resolves most cases is **pull vs. push**:

> `RETRIEVE` is for content the harness **pulls from a store** into the window
> (RAG/search results, memory lookups, paging archived content back). Content
> that arrives from **outside, pushed in** — a user message injected mid-run, an
> external event appended — is not a retrieval; it's the window being
> re-composed, so it's an `ASSEMBLE`.

Two mechanisms commonly get miscategorised:

| Harness mechanism | Event | Why |
|---|---|---|
| Live steering — user messages injected mid-run | **`ASSEMBLE`** | External input *pushed* in; the harness didn't fetch it. Bucket it into `instructions` (directive) or `history` (a conversation turn), with a content-free label. |
| Paging previously-evicted tool output back into context (e.g. `read_tool_result`) | **`RETRIEVE`** | A genuine *pull* from a store — and the **counterpart to `EVICT`**: content dropped under budget pressure, fetched back when needed again. |

That `read_tool_result ↔ EVICT` pairing is worth instrumenting deliberately: set
the `added_ids` on the read-back `RETRIEVE` to the **same ids** the earlier
`EVICT` reported in `dropped_ids`. In the timeline the two render as mirror
arrows (green `＋` up for the retrieve, orange `−` down for the evict), and the
shared ids let a reader — and a future "where did this come from" link — connect
"evicted at step N → paged back at step M".

**If your harness does no true retrieval at all**, don't force a `RETRIEVE`:
instrument only the events that reflect what actually happens — typically
`ASSEMBLE` (each turn's prompt build, plus any pushed-in content) and, if you do
budget management, `EVICT` / `COMPACT`. An absent event type simply doesn't
appear in the view; that's correct, not a gap.

`sdk/python/examples/multi_agent.py` demonstrates all of the above in one run:
RAG-style `RETRIEVE` for search results, `ASSEMBLE` for a live-steering
injection, an `EVICT` of raw tool output under pressure, and a
`read_tool_result` `RETRIEVE` that pages it back with matching ids.

#### Payload reference

```python
ps.context_event(
    ps.ContextEventName.COMPACT,
    # window state — send these on every event
    sources=[                       # full composition AFTER the op (see below)
        {"source": "system",  "tokens": 1800,  "label": "summarizer system prompt"},
        {"source": "history", "tokens": 30000, "label": "summary of earlier turns"},
    ],
    window_tokens_before=179800,    # total before the op
    window_tokens_after=81800,      # total after the op
    window_limit=200000,            # the model's context window
    # op-specific detail — include what applies
    tokens_reclaimed=98000,         # compact
    tokens_evicted=15000,           # evict
    items_evicted=3,                # evict
    method="summarize",             # compact: summarize | truncate | dedupe
    policy="lru",                   # evict: lru | relevance | age
    reason="over budget",           # human-readable why
    summarized_from=["msg-1", "msg-2"],   # ids collapsed by a compaction
    summarized_into="turn-summary",       # id of the produced summary
    added_ids=["doc-1", "doc-2"],   # retrieve/assemble additions
    dropped_ids=["tool-raw-0"],     # removals
)
```

Every field is optional, but each one powers something specific in the UI:
`sources` → the stacked budget chart, composition bar, and source table;
`window_tokens_before/after` → the red/green **before → after delta** on the
change card; `window_limit` → the limit line and utilization %;
`tokens_reclaimed` / `method` / `summarized_from/into` → the compaction card;
`policy` / `reason` / `dropped_ids` → the eviction card.

#### The `sources` contract

`sources` is the **full composition of the window after the operation** — one
entry per segment: `{"source": <name>, "tokens": <int>, "label": <short human
description>}` (an optional `"preview"` string is shown in the source table).
Six standard source names get fixed colors throughout the UI:

| source | meaning |
|---|---|
| `system` | system prompt |
| `instructions` | task brief / developer instructions |
| `history` | conversation turns (and their summaries) |
| `retrieved` | RAG / search / memory content |
| `tool_result` | tool output appended to the window |
| `scratchpad` | working notes / plans |

Any other name is still recorded and listed in the source table, but is folded
into a gray *unattributed* band on the budget chart — prefer the standard six.

**If you omit `sources`** the view degrades gracefully: the previous
composition is carried forward and scaled to your reported
`window_tokens_after`, and the step is marked *"composition carried forward"*.
Totals stay truthful, but per-source attribution is an estimate — sending the
full composition on every event is strongly preferred, and cheap (it is a
handful of integers and short labels, not the content itself).

#### A working pattern

Keep one small tracker beside your context manager that mirrors the window's
composition and emits events as it mutates — see the complete version in
`sdk/python/examples/multi_agent.py` (`ContextTracker`):

```python
class ContextTracker:
    def __init__(self, **sources):
        self.sources = dict(sources)          # source -> {tokens, label}

    def total(self):
        return sum(s["tokens"] for s in self.sources.values())

    def emit(self, name, **extra):
        ps.context_event(
            name,
            sources=[{"source": k, **v} for k, v in self.sources.items() if v["tokens"] > 0],
            window_tokens_after=self.total(),
            window_limit=WINDOW_LIMIT,
            **extra,
        )

# each turn:
with ps.span(ps.SpanKind.LOOP_ITERATION, f"turn-{n}"):
    ctx.emit(ps.ContextEventName.ASSEMBLE)
    ...
    ctx.sources["retrieved"]["tokens"] += doc_tokens
    ctx.emit(ps.ContextEventName.RETRIEVE, window_tokens_before=before, added_ids=doc_ids)
```

#### Privacy

`label` and `preview` strings leave your process and are stored in promptstore.
Keep them descriptive but content-free ("search results: Q3 filings", not the
filings), or route them through the SDK's `redactor` / `deny_keys` hooks
(configured in `ps.configure`) like any other attribute.

### Sub-agents across processes

A sub-agent gets its **own trace id** (so it is independently viewable) that the
parent's spawn span links to. In the parent, capture a traceparent inside the
`subagent()` block and hand it to the child; in the child, adopt it:

```python
# --- parent process ---
with ps.subagent("summarizer"):
    traceparent = ps.get_traceparent()      # child trace: "00-<child_trace_id>-<spawn_span_id>-01"
    launch_subprocess(env={"PS_TRACEPARENT": traceparent, ...})

# --- child process ---
import os, promptstore_telemetry as ps
ps.configure(base_url="https://your-promptstore", api_key="pst_...")
with ps.trace("summarizer", parent_traceparent=os.environ.get("PS_TRACEPARENT")):
    ...   # this run adopts the child trace id the parent linked to
```

For a sub-agent running **in the same process**, just nest it — no traceparent
needed:

```python
with ps.subagent("summarizer"):
    with ps.span(ps.SpanKind.MODEL_CALL, "summarize") as m:
        ...
```

### Conversations (multi-turn, human-in-the-loop)

A conversation — a chat that spans several user turns, with the harness waiting
on the human between them — is modelled as **one run**, not one run per turn.
Each turn is a `LOOP_ITERATION`; the wait for the user's next message is a
first-class `HITL_PAUSE` span whose duration is the user's think-time. In the UI
the whole conversation is a **single row** (turns, tokens, cost and duration roll
up), its status is **active / awaiting user / done**, and the waterfall shows each
turn separated by a "waiting for user" pause.

Because each turn may run in a **separate process or request**, the SDK derives
the run's ids deterministically from your conversation id, so any turn — in any
process, in any order — resolves to the same run with no handoff state to persist:

```python
import promptstore_telemetry as ps
ps.configure(base_url="https://your-promptstore", api_key="pst_...")

# On each incoming user message for conversation `conv_id`, at turn index `n`:
with ps.conversation(conv_id, close_on_exit=False):   # adopt the conversation's run
    ps.hitl_pause_close(index=n - 1)                   # the user just replied → end the previous pause
    with ps.turn(index=n):                             # a loop.iteration for this turn
        with ps.span(ps.SpanKind.MODEL_CALL, "respond") as m:
            m.set_usage(prompt_tokens=1000, completion_tokens=120)
        reply_to_user(...)
    ps.hitl_pause_open(index=n)                        # yield back to the user → start a pause

# When the conversation truly ends (resolved / closed / timed out):
ps.end_conversation(conv_id)
```

- `conversation(conversation_id, name=None, close_on_exit=True)` — opens or
  re-adopts the conversation's root `harness.run` span. The raw id is stored as
  the span's `session_id`, which is searchable and shown as the **Conversation**
  column in the traces list. Pass **`close_on_exit=False`** in the
  turn-per-process pattern above so an intermediate turn leaves the run open; the
  default `True` closes the run when the block exits (right for a single
  long-lived loop process — see below).
- `turn(index)` — a `LOOP_ITERATION` for turn `index`, parented to the
  conversation root. Turn *n* links to turn *n-1* with `rel="resumes"`.
- `hitl_pause_open(index)` / `hitl_pause_close(index)` — open the pause after
  turn `index` when you yield to the user, and close the same pause when their
  next message arrives. On the first turn, `hitl_pause_close(index=-1)` is a
  harmless no-op (that pause was never opened); you can also just skip it.
- `end_conversation(conversation_id)` — closes the run's root span. Only needed
  with `close_on_exit=False`.

**Single long-lived loop.** If a conversation runs inside one process (e.g. a
durable workflow that suspends on a signal), keep the block open for the whole
conversation and let the default `close_on_exit=True` close it:

```python
with ps.conversation(conv_id) as run:          # closes automatically at the end
    for n in itertools.count():
        msg = await wait_for_user_message()     # the loop is suspended on the human here
        ps.hitl_pause_close(index=n - 1)
        with ps.turn(index=n):
            respond(msg)
        if done:
            break
        ps.hitl_pause_open(index=n)             # bracket the wait so it shows on the waterfall
```

> **The stale-run reaper leaves suspended conversations alone.** promptstore
> closes runs that go silent past a TTL (assumed crashed). A conversation parked
> on an **open `HITL_PAUSE`** is exempt — a long user think-time is never mistaken
> for a dead run. A run left open with *no* open pause is still reaped, so call
> `hitl_pause_open` whenever you actually yield to the user, and
> `end_conversation` (or let the block close) when it ends.

### Span kinds

`ps.SpanKind` values: `HARNESS_RUN`, `LOOP_ITERATION`, `MODEL_CALL`, `TOOL_CALL`,
`SUBAGENT_SPAWN`, `HITL_PAUSE`, `COMPOSITION_CALL`, `FUNCTION_CALL`,
`PROMPT_RENDER`, `CONTEXT_OP`, `RETRIEVAL`, `EVALUATION`, `GUARDRAIL`, `CUSTOM`.

### Flushing on exit

A background thread flushes automatically, and `atexit` drains on normal
shutdown. Force a flush before a hard exit if needed:

```python
ps.flush(timeout=5.0)     # block up to 5s for the buffer to drain
ps.shutdown()             # stop the worker (also runs at exit)
```

---

## 5. View the run

Once spans arrive, open **Observability → Harness Traces** (`/harness`) in the
promptstore UI for the same workspace and click a run to see the span tree and
waterfall timeline.

---

## Notes & current limitations

- **Cost accuracy depends on the model id.** `response_model` (or
  `request_model`) is matched against the LiteLLM price map to compute cost.
  Use the model id LiteLLM knows (e.g. `claude-3-5-sonnet-20241022`,
  `gpt-4o`); unknown models record spans but skip cost. `cached_tokens` are
  billed at the cheaper cache-read rate; `completion_tokens` already include
  reasoning tokens, so don't add them twice.
- **Live streaming works out of the box.** With `emit_on_start` enabled (the
  default), a running trace appears in the Harness Traces list and its tree /
  waterfall update live as spans stream in. Context events power the **Context**
  view (token-budget-over-steps chart, per-step composition, and change cards) —
  include `sources=[...]` on your events for the richest rendering; see
  `sdk/python/examples/multi_agent.py` for a complete instrumented run.
- **Content capture is on by default, with redaction.** Attach model/tool IO
  with `set_content` to read it in the Content panel; the built-in scrubber masks
  known secret patterns and content is offloaded off the span row. Set
  `capture_content=False` to disable. The scrubber does not catch free-form PII —
  use `deny_keys` / a custom `redactor` for that. Content is currently stored in
  Postgres (`span_payloads`); a MinIO-backed store is the intended swap at scale.
- **Failure behavior.** If promptstore is slow or down, spans buffer, then drop
  oldest, then the circuit breaker opens — your app is never blocked or errored.
  Your own exceptions inside a `with ps.span(...)` block still propagate; the
  span is simply marked `error` with the message.
