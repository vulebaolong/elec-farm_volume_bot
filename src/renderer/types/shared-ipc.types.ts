// shared-ipc.types.ts
export interface WorkerRpcRequest {
  requestId: number;
}

export interface WorkerRpcResponse<T> extends WorkerRpcRequest {
  ok: boolean;
  body: T | null;
  error: string | null;
}
