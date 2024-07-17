import { Tracer } from './Tracer';

export interface TraceCallbackParams {
  workspaceId: number;
  username: string;
  tracesService: any;
  tracer?: Tracer;
  debug?: boolean;
}
