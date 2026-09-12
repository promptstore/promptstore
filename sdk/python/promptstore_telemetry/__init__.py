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

Conversations (HITL long-running loop). A conversation is one run; each user
turn is a loop iteration, and waiting on the user is a first-class ``hitl.pause``
span. Ids are derived from the conversation id, so turns in separate
processes/requests resolve to the same run with no shared handle::

    # turn N's request
    with ps.conversation(conversation_id, close_on_exit=False):
        ps.hitl_pause_close(index=n - 1)          # the user just replied
        with ps.turn(index=n):
            with ps.span(ps.SpanKind.MODEL_CALL, "respond") as m:
                m.set_usage(prompt_tokens=1000, completion_tokens=120)
        ps.hitl_pause_open(index=n)               # yield back to the user
    # ...and once the conversation is truly done:
    ps.end_conversation(conversation_id)

The SDK never blocks, never raises into your code, and drops data rather than
grow unbounded or fail your app if promptstore is unavailable.
"""

from .client import (  # noqa: F401
    configure,
    trace,
    span,
    subagent,
    conversation,
    turn,
    hitl_pause_open,
    hitl_pause_close,
    end_conversation,
    tool,
    agent,
    context_event,
    set_attributes,
    get_traceparent,
    derive_trace_id,
    derive_span_id,
    flush,
    shutdown,
    SpanKind,
    LinkRel,
    TelemetryClient,
)


class ContextEventName:
    ASSEMBLE = "ps.context.assemble"
    RETRIEVE = "ps.context.retrieve"
    COMPACT = "ps.context.compact"
    EVICT = "ps.context.evict"


__version__ = "0.1.1"
