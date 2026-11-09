import { AsyncLocalStorage } from "node:async_hooks";

/** Per-request / per-tool-call data carried through async calls (request id, cache stats). */
export interface RequestContext {
  requestId: string;
  cacheHits: number;
  cacheMisses: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export const currentContext = (): RequestContext | undefined => requestContext.getStore();
