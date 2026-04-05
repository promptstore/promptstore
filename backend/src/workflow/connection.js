const ENV = process.env.ENV?.toLowerCase();
const TEMPORAL_URL = process.env.TEMPORAL_URL;
const TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE;
const TEMPORAL_TLS = process.env.TEMPORAL_TLS;
const TEMPORAL_API_KEY = process.env.TEMPORAL_API_KEY;

function isTruthy(value) {
  return typeof value === 'string' && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getTemporalNamespace() {
  return TEMPORAL_NAMESPACE || 'promptstore';
}

export function getTemporalConnectionOptions() {
  const connectionOptions = {
    address: TEMPORAL_URL,
  };

  const useTls = TEMPORAL_TLS != null ? isTruthy(TEMPORAL_TLS) : ENV !== 'dev' || TEMPORAL_URL?.includes('.tmprl.cloud');
  if (useTls) {
    connectionOptions.tls = true;
  }

  if (TEMPORAL_API_KEY) {
    connectionOptions.apiKey = TEMPORAL_API_KEY;
  }

  return connectionOptions;
}
