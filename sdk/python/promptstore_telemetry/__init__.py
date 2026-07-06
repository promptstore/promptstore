"""promptstore telemetry SDK — fail-safe agentic-harness observability.

Quick start::

    import promptstore_telemetry as ps

    ps.configure(base_url="https://promptstore.example.com",
                 api_key="pst_...")            # or PROMPTSTORE_URL / PROMPTSTORE_TELEMETRY_KEY

    with ps.trace("research-agent") as run:
        for turn in range(max_turns):
            with ps.span(ps.SpanKind.LOOP_ITERATION, f"turn-{turn}"):
                with ps.span(ps.SpanKind.MODEL_CALL, "plan") as m:
                    m.set_model(provider="anthropic", response_model="claude-3-5-sonnet-20241022")
                    m.set_usage(prompt_tokens=1200, completion_tokens=300, cached_tokens=800)
                ps.context_event(ps.ContextEventName.COMPACT,
                                 window_tokens_before=180000, window_tokens_after=90000,
                                 tokens_reclaimed=90000, method="summarize")

The SDK never blocks, never raises into your code, and drops data rather than
grow unbounded or fail your app if promptstore is unavailable.
"""

from .client import (  # noqa: F401
    configure,
    trace,
    span,
    subagent,
    tool,
    agent,
    context_event,
    set_attributes,
    get_traceparent,
    flush,
    shutdown,
    SpanKind,
    TelemetryClient,
)


class ContextEventName:
    ASSEMBLE = "ps.context.assemble"
    RETRIEVE = "ps.context.retrieve"
    COMPACT = "ps.context.compact"
    EVICT = "ps.context.evict"


__version__ = "0.1.0"
