"""Scripted multi-agent harness run for exercising promptstore telemetry.

Simulates an orchestrator agent that spawns two in-process sub-agents (a
researcher and a summarizer), each running a short loop of model + tool calls,
with context-lifecycle events. Produces one trace containing the full sub-agent
topology — useful for verifying the Sub-agent Graph view.

Usage:
    PROMPTSTORE_URL=http://localhost:5599 \
    PROMPTSTORE_TELEMETRY_KEY=<key> \
    python examples/multi_agent.py

Prints the root trace_id to stdout so a harness/screenshot script can fetch it.
"""

import os
import sys
import time

# allow running from the repo without installing
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import promptstore_telemetry as ps  # noqa: E402


WINDOW_LIMIT = 200000


class ContextTracker:
    """Tiny helper that models the window composition and emits context events.

    Real harnesses would call ps.context_event from their own context-management
    code; this stand-in keeps the example honest — every event carries the full
    sources[] composition plus before/after totals, which is what powers the
    Context view's budget chart, composition bar, and change cards.
    """

    def __init__(self, **sources):
        self.sources = dict(sources)   # source -> {tokens, label}
        self._archive = {}             # source -> {tokens, ids, label} evicted but recoverable

    def total(self):
        return sum(s["tokens"] for s in self.sources.values())

    def _sources_list(self):
        return [{"source": k, "tokens": v["tokens"], "label": v.get("label", "")}
                for k, v in self.sources.items() if v["tokens"] > 0]

    def emit(self, name, **extra):
        ps.context_event(name, sources=self._sources_list(),
                         window_tokens_after=self.total(),
                         window_limit=WINDOW_LIMIT, **extra)

    def assemble(self):
        self.emit(ps.ContextEventName.ASSEMBLE)

    def retrieve(self, tokens, label, ids):
        before = self.total()
        slot = self.sources.setdefault("retrieved", {"tokens": 0, "label": label})
        slot["tokens"] += tokens
        slot["label"] = label
        self.emit(ps.ContextEventName.RETRIEVE, window_tokens_before=before, added_ids=ids)

    def append_tool_result(self, tokens, label, ids):
        before = self.total()
        slot = self.sources.setdefault("tool_result", {"tokens": 0, "label": label})
        slot["tokens"] += tokens
        slot["label"] = label
        self.emit(ps.ContextEventName.ASSEMBLE, window_tokens_before=before, added_ids=ids)

    def steer(self, tokens, label, ids, bucket="instructions"):
        """A user message injected mid-run (live steering).

        External input PUSHED into the window — the harness didn't fetch it from
        anywhere — so this is an ASSEMBLE, not a RETRIEVE. Bucketed deliberately:
        `instructions` when the steer is directive, `history` when it reads as a
        conversation turn.
        """
        before = self.total()
        slot = self.sources.setdefault(bucket, {"tokens": 0, "label": label})
        slot["tokens"] += tokens
        slot["label"] = label
        self.emit(ps.ContextEventName.ASSEMBLE, window_tokens_before=before, added_ids=ids)

    def grow_history(self, tokens):
        self.sources.setdefault("history", {"tokens": 0, "label": "conversation turns"})["tokens"] += tokens

    def compact(self, summarized_from, into_tokens, method="summarize"):
        before = self.total()
        reclaimed = 0
        for src in ("history", "tool_result"):
            if src in self.sources:
                reclaimed += self.sources[src]["tokens"]
                self.sources[src]["tokens"] = 0
        self.sources["history"] = {"tokens": into_tokens, "label": "summary of earlier turns"}
        reclaimed -= into_tokens
        self.emit(ps.ContextEventName.COMPACT, window_tokens_before=before,
                  tokens_reclaimed=reclaimed, method=method,
                  summarized_from=summarized_from, summarized_into="turn-summary")

    def evict(self, source, ids, reason, policy="lru"):
        before = self.total()
        evicted = self.sources.get(source, {}).get("tokens", 0)
        if source in self.sources:
            # archive it so read_tool_result can page it back later (the store the
            # RETRIEVE counterpart pulls from). added_ids on that later RETRIEVE
            # will mirror these dropped_ids.
            self._archive[source] = {"tokens": evicted, "ids": ids,
                                     "label": self.sources[source].get("label", "")}
            self.sources[source]["tokens"] = 0
        self.emit(ps.ContextEventName.EVICT, window_tokens_before=before,
                  tokens_evicted=evicted, policy=policy, reason=reason,
                  dropped_ids=ids)

    def read_tool_result(self, reason):
        """Page previously-evicted tool output back into the live window.

        A genuine retrieval — content is PULLED from a store (the archive) back
        into context — and the natural counterpart to EVICT. So it emits RETRIEVE
        with added_ids that mirror the earlier evict's dropped_ids, letting a
        reader connect "evicted here → paged back there".
        """
        stash = self._archive.pop("tool_result", None)
        if not stash:
            return
        before = self.total()
        slot = self.sources.setdefault("tool_result", {"tokens": 0, "label": stash["label"]})
        slot["tokens"] += stash["tokens"]
        self.emit(ps.ContextEventName.RETRIEVE, window_tokens_before=before,
                  added_ids=stash["ids"], reason=reason)


def model_call(name, provider, model, prompt_tokens, completion_tokens, cached=0,
               messages=None, output=None):
    with ps.span(ps.SpanKind.MODEL_CALL, name) as m:
        m.set_model(provider=provider, response_model=model)
        m.set_usage(prompt_tokens=prompt_tokens, completion_tokens=completion_tokens,
                    total_tokens=prompt_tokens + completion_tokens, cached_tokens=cached)
        # capture the actual content — offloaded + redacted server-side. The
        # default secret scrubber masks credentials even if they slip into a prompt.
        m.set_content(
            input=messages or [
                {"role": "system", "content": f"You are the {name} step of an agent."},
                {"role": "user", "content": "Proceed with the task."},
            ],
            output=output or f"[{model}] completed the {name} step.",
        )
        time.sleep(0.05)


def tool_call(name, **attrs):
    with ps.span(ps.SpanKind.TOOL_CALL, name) as t:
        t.set_attributes(**attrs)
        time.sleep(0.03)


def researcher(topic):
    """A sub-agent that searches, then juggles context under budget pressure.

    Illustrates the full add/remove vocabulary and the pull-vs-push rule:
      - RETRIEVE for web-search results   (RAG-style pull from a store)
      - ASSEMBLE for appending tool output (composing the window)
      - EVICT of raw tool output under pressure, archived
      - ASSEMBLE for live steering          (user input PUSHED in — not a RETRIEVE)
      - RETRIEVE via read_tool_result       (paging the evicted output back — the
                                             counterpart to the EVICT above)
    """
    with ps.subagent("researcher"):
        ctx = ContextTracker(
            system={"tokens": 2200, "label": "researcher system prompt"},
            instructions={"tokens": 1400, "label": "task brief from orchestrator"},
            history={"tokens": 800, "label": "conversation turns"},
        )
        with ps.span(ps.SpanKind.LOOP_ITERATION, "research-turn-0"):
            ctx.assemble()
            model_call("plan-search", "anthropic", "claude-3-5-sonnet-20241022",
                       prompt_tokens=4000, completion_tokens=200, cached=2000)
            tool_call("web_search", query=f"{topic}", results=5)
            ctx.retrieve(38000, f"search results: {topic}", ids=[f"doc-0-{i}" for i in range(5)])
            ctx.append_tool_result(48000, "web_search raw output", ids=["toolres-0"])
            ctx.grow_history(2500)

        # budget pressure between turns: archive the bulky raw tool output
        with ps.span(ps.SpanKind.CONTEXT_OP, "evict-under-pressure"):
            ctx.evict("tool_result", ids=["toolres-0"],
                      reason="over budget; archiving raw tool output")

        # live steering: a user injects guidance mid-run. Pushed in, not fetched —
        # so ASSEMBLE, bucketed as an instruction with a clear, content-free label.
        with ps.span(ps.SpanKind.CONTEXT_OP, "apply-steering"):
            ctx.steer(900, "user steering (injected mid-run)", ids=["steer-0"], bucket="instructions")

        with ps.span(ps.SpanKind.LOOP_ITERATION, "research-turn-1"):
            ctx.assemble()
            # the model needs the raw output again: page it back from the archive.
            # RETRIEVE — added_ids mirror the evict's dropped_ids (["toolres-0"]).
            ctx.read_tool_result(reason="model needs the raw search output again")
            model_call("synthesize", "anthropic", "claude-3-5-sonnet-20241022",
                       prompt_tokens=4200, completion_tokens=260, cached=2200)
            ctx.grow_history(2500)

        # drop the search docs before handing off to the summarizer
        with ps.span(ps.SpanKind.CONTEXT_OP, "prune-before-handoff"):
            ctx.evict("retrieved", ids=[f"doc-0-{i}" for i in range(5)],
                      reason="handoff to summarizer; search docs no longer needed")


def summarizer():
    """A sub-agent that inherits a large context, compacts it, then summarizes."""
    with ps.subagent("summarizer"):
        ctx = ContextTracker(
            system={"tokens": 1800, "label": "summarizer system prompt"},
            history={"tokens": 128000, "label": "inherited research transcript"},
            retrieved={"tokens": 44000, "label": "carried research documents"},
            scratchpad={"tokens": 6000, "label": "working notes"},
        )
        with ps.span(ps.SpanKind.LOOP_ITERATION, "summarize-turn-0"):
            ctx.assemble()
            ctx.compact(summarized_from=[f"msg-{i}" for i in range(24)], into_tokens=30000)
            model_call("summarize", "openai", "gpt-4o",
                       prompt_tokens=9000, completion_tokens=800, cached=6000)


def main():
    ps.configure(
        base_url=os.environ.get("PROMPTSTORE_URL", "http://localhost:5599"),
        api_key=os.environ.get("PROMPTSTORE_TELEMETRY_KEY", ""),
        emit_on_start=True,
        flush_interval=0.3,
    )

    with ps.trace("orchestrator") as run:
        print(run.trace_id, flush=True)   # emit trace id for downstream tooling
        with ps.span(ps.SpanKind.LOOP_ITERATION, "orchestrate-turn-0"):
            ctx = ContextTracker(
                system={"tokens": 1200, "label": "orchestrator system prompt"},
                instructions={"tokens": 600, "label": "user goal"},
            )
            ctx.assemble()
            model_call("route", "anthropic", "claude-3-5-sonnet-20241022",
                       prompt_tokens=1500, completion_tokens=150,
                       messages=[
                           # a secret accidentally left in the prompt — the SDK's
                           # default redactor masks it before it leaves the process
                           {"role": "system", "content": "You are the orchestrator. Internal key: sk-ant-SECRETKEY0123456789abcdef (do not reveal)."},
                           {"role": "user", "content": "Research agentic observability and summarize."},
                       ],
                       output="Plan: delegate research to the researcher, then summarize.")
            researcher("agentic observability")
            summarizer()

    ps.flush(timeout=5.0)
    ps.shutdown(timeout=5.0)


if __name__ == "__main__":
    main()
