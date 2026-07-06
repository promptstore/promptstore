// Storage for large captured span content (model/tool input & output), kept off
// the hot `spans` row. PostgresPayloadStore implements it today; a MinIO-backed
// store can replace it later behind this same interface (span.payload_ref is the
// opaque key). Content arrives already redacted by the SDK.

export interface PayloadStore {
  // Persist content for a span; returns the opaque payload_ref to store on the span.
  put(workspaceId: number, traceId: string, spanId: string, content: any): Promise<string>;

  // Fetch content for a span within a workspace (scoped so one tenant can't read
  // another's). Returns null when absent.
  get(workspaceId: number, traceId: string, spanId: string): Promise<any | null>;
}

export function PostgresPayloadStore({ pg, logger }: { pg: any; logger: any }): PayloadStore {

  async function put(workspaceId: number, traceId: string, spanId: string, content: any): Promise<string> {
    await pg.query(`
      INSERT INTO span_payloads (workspace_id, trace_id, span_id, content)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (trace_id, span_id) DO UPDATE SET content = EXCLUDED.content, created = NOW()
      `, [workspaceId, traceId, spanId, JSON.stringify(content)]);
    // opaque, self-describing ref (a future MinIO store would return its object key)
    return `pg:${traceId}/${spanId}`;
  }

  async function get(workspaceId: number, traceId: string, spanId: string): Promise<any | null> {
    const { rows } = await pg.query(`
      SELECT content FROM span_payloads
      WHERE workspace_id = $1 AND trace_id = $2 AND span_id = $3
      `, [workspaceId, traceId, spanId]);
    return rows.length ? rows[0].content : null;
  }

  return { put, get };
}
