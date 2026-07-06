// Model pricing + context-window sizes, sourced from LiteLLM's maintained
// `model_prices_and_context_window.json`. Replaces the stale hardcoded COSTS
// table in CreditCalculatorService for telemetry cost computation.
//
// Loading is lazy and non-blocking: the map is fetched in the background and
// cached (in Redis when available, else in-process). Until it loads, a small
// bundled fallback covers current common models so cost is never zero-by-default
// and ingestion never blocks on the network.

const LITELLM_PRICES_URL =
  'https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json';

const REDIS_KEY = 'ps:telemetry:pricing-map';
const REFRESH_MS = 24 * 60 * 60 * 1000; // 24h

// Prices are per-token (LiteLLM convention). Minimal current-model fallback.
const FALLBACK = {
  'gpt-4o': { input_cost_per_token: 0.0000025, output_cost_per_token: 0.00001, cache_read_input_token_cost: 0.00000125, max_input_tokens: 128000 },
  'gpt-4o-mini': { input_cost_per_token: 0.00000015, output_cost_per_token: 0.0000006, cache_read_input_token_cost: 0.000000075, max_input_tokens: 128000 },
  'o1': { input_cost_per_token: 0.000015, output_cost_per_token: 0.00006, cache_read_input_token_cost: 0.0000075, max_input_tokens: 200000 },
  'claude-3-5-sonnet-20241022': { input_cost_per_token: 0.000003, output_cost_per_token: 0.000015, cache_read_input_token_cost: 0.0000003, max_input_tokens: 200000 },
  'claude-3-5-haiku-20241022': { input_cost_per_token: 0.0000008, output_cost_per_token: 0.000004, cache_read_input_token_cost: 0.00000008, max_input_tokens: 200000 },
  'claude-3-opus-20240229': { input_cost_per_token: 0.000015, output_cost_per_token: 0.000075, cache_read_input_token_cost: 0.0000015, max_input_tokens: 200000 },
};

export function PricingService({ logger, rc, services } = {}) {

  const modelsService = services?.modelsService;
  let priceMap = { ...FALLBACK };
  let loadedAt = 0;
  let loading = null;

  function normalizeModel(model) {
    if (!model) return model;
    // strip a provider prefix (e.g. 'anthropic/claude-...', 'bedrock/anthropic.claude-...')
    let m = model;
    if (m.includes('/')) m = m.split('/').pop();
    return m;
  }

  async function fetchMap() {
    // network fetch guarded — failure just keeps the current map
    try {
      const res = await fetch(LITELLM_PRICES_URL, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = await res.json();
      delete json.sample_spec; // LiteLLM includes a non-model spec entry
      priceMap = { ...FALLBACK, ...json };
      loadedAt = Date.now();
      if (rc) {
        try { await rc.set(REDIS_KEY, JSON.stringify(priceMap)); } catch (e) { /* non-fatal */ }
      }
      logger?.info?.(`PricingService: loaded ${Object.keys(priceMap).length} model prices`);
    } catch (err) {
      logger?.warn?.('PricingService: could not fetch LiteLLM price map, using cached/fallback:', err.message);
    }
  }

  async function ensureLoaded() {
    if (Date.now() - loadedAt < REFRESH_MS && loadedAt > 0) return;
    if (loading) return loading;
    loading = (async () => {
      if (rc && loadedAt === 0) {
        try {
          const cached = await rc.get(REDIS_KEY);
          if (cached) { priceMap = { ...FALLBACK, ...JSON.parse(cached) }; loadedAt = Date.now(); }
        } catch (e) { /* ignore */ }
      }
      await fetchMap();
      loading = null;
    })();
    return loading;
  }

  // Kick off a background load without blocking construction.
  ensureLoaded().catch(() => { });

  // Resolve pricing for a model. Precedence: workspace custom model costs ->
  // LiteLLM map -> null.
  async function getPricing(model, { workspaceId } = {}) {
    const key = normalizeModel(model);
    if (workspaceId != null && modelsService?.getModelByKey) {
      try {
        const custom = await modelsService.getModelByKey(workspaceId, model);
        const c = custom?.costs?.[0];
        if (c && (c.inputPer1kTokens != null || c.outputPer1kTokens != null)) {
          return {
            input_cost_per_token: (c.inputPer1kTokens || 0) / 1000,
            output_cost_per_token: (c.outputPer1kTokens || 0) / 1000,
            cache_read_input_token_cost: c.cachedInputPer1kTokens != null ? c.cachedInputPer1kTokens / 1000 : undefined,
            max_input_tokens: custom.contextWindow,
            _source: 'workspace',
          };
        }
      } catch (e) { /* fall through to map */ }
    }
    return priceMap[key] || priceMap[model] || null;
  }

  // Compute cost for a model.call span given its usage. cached prompt tokens are
  // billed at the (cheaper) cache-read rate; completion_tokens already includes
  // reasoning tokens per OpenAI/Anthropic accounting, so we do not double count.
  async function computeCost({ model, usage, workspaceId }) {
    if (!usage) return null;
    const pricing = await getPricing(model, { workspaceId });
    if (!pricing) return null;
    const promptTokens = usage.prompt_tokens || 0;
    const cached = Math.min(usage.cached_tokens || 0, promptTokens);
    const uncached = promptTokens - cached;
    const inRate = pricing.input_cost_per_token || 0;
    const cacheRate = pricing.cache_read_input_token_cost != null ? pricing.cache_read_input_token_cost : inRate;
    const outRate = pricing.output_cost_per_token || 0;
    const costInput = uncached * inRate + cached * cacheRate;
    const costOutput = (usage.completion_tokens || 0) * outRate;
    return {
      cost_input: round8(costInput),
      cost_output: round8(costOutput),
      cost_total: round8(costInput + costOutput),
      currency: 'USD',
    };
  }

  async function getContextWindow(model, { workspaceId } = {}) {
    const pricing = await getPricing(model, { workspaceId });
    return pricing?.max_input_tokens || pricing?.max_tokens || null;
  }

  function round8(n) {
    return Math.round(n * 1e8) / 1e8;
  }

  return {
    ensureLoaded,
    getPricing,
    computeCost,
    getContextWindow,
  };
}
