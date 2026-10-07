import type { FinishTurn, TurnContext, TurnDecision } from './types';

export interface HarnessLimits {
  /** Maximum number of model turns. */
  maxTurns?: number;
  /** Wall-clock budget for the run; the run is aborted when exceeded. */
  maxDurationMs?: number;
  /** Cost budget (sum of assistant usage.cost) for the run. */
  maxCostUsd?: number;
}

export interface LimitsHandle {
  finishTurn: FinishTurn;
  /** Signal that aborts when the duration limit (or the parent signal) fires. */
  signal: AbortSignal;
  /** Why the run was stopped by a limit, if it was. */
  readonly stoppedBy?: 'maxTurns' | 'maxDurationMs' | 'maxCostUsd';
  dispose(): void;
}

/**
 * pi has no turn limit; a server-side harness needs one. Composes the limit
 * checks into a FinishTurn hook (wrapping `inner`) plus an abort timer.
 */
export function withLimits(
  limits: HarnessLimits,
  inner?: FinishTurn,
  parentSignal?: AbortSignal,
): LimitsHandle {
  const controller = new AbortController();
  let stoppedBy: LimitsHandle['stoppedBy'];
  let timer: ReturnType<typeof setTimeout> | undefined;

  const onParentAbort = () => controller.abort(parentSignal?.reason);
  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener('abort', onParentAbort, { once: true });
  }
  if (limits.maxDurationMs && limits.maxDurationMs > 0) {
    timer = setTimeout(() => {
      stoppedBy = 'maxDurationMs';
      controller.abort(new Error(`Harness exceeded maxDurationMs (${limits.maxDurationMs})`));
    }, limits.maxDurationMs);
  }

  const finishTurn: FinishTurn = async (turn: TurnContext, signal?: AbortSignal): Promise<TurnDecision | void> => {
    const decision = (inner ? await inner(turn, signal) : undefined) as TurnDecision | undefined;
    if (decision?.action === 'end') return decision;
    if (limits.maxTurns && turn.turn >= limits.maxTurns) {
      stoppedBy = 'maxTurns';
      return { action: 'end', reason: 'maxTurns' };
    }
    if (limits.maxCostUsd) {
      let cost = 0;
      for (const m of turn.newMessages) {
        if (m.role === 'assistant') cost += m.usage?.cost || 0;
      }
      if (cost >= limits.maxCostUsd) {
        stoppedBy = 'maxCostUsd';
        return { action: 'end', reason: 'maxCostUsd' };
      }
    }
    return decision;
  };

  return {
    finishTurn,
    signal: controller.signal,
    get stoppedBy() { return stoppedBy; },
    dispose() {
      if (timer) clearTimeout(timer);
      parentSignal?.removeEventListener('abort', onParentAbort);
    },
  };
}
