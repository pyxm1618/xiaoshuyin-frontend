export interface ChunkRecord {
  index: number;
  byteLength: number;
  arrivedAtMs: number;
}

export interface ChunkReport {
  chunks: ChunkRecord[];
  totalBytes: number;
  firstArrivalMs: number | null;
  lastArrivalMs: number | null;
  completed: boolean;
  cancelled: boolean;
}

export interface ChunkProbe {
  onChunk(chunk: ArrayBuffer): void;
  complete(): ChunkReport;
  cancel(): ChunkReport;
  readonly report: ChunkReport;
}

export function createChunkProbe(now: () => number): ChunkProbe {
  const chunks: ChunkRecord[] = [];
  let totalBytes = 0;
  let firstArrivalMs: number | null = null;
  let lastArrivalMs: number | null = null;
  let completed = false;
  let cancelled = false;

  const report = (): ChunkReport => ({
    chunks: chunks.map((chunk) => ({ ...chunk })),
    totalBytes,
    firstArrivalMs,
    lastArrivalMs,
    completed,
    cancelled,
  });

  const sealed = (): boolean => completed || cancelled;

  return {
    onChunk(chunk) {
      if (sealed()) return;
      const arrivedAtMs = now();
      if (firstArrivalMs === null) firstArrivalMs = arrivedAtMs;
      lastArrivalMs = arrivedAtMs;
      totalBytes += chunk.byteLength;
      chunks.push({ index: chunks.length, byteLength: chunk.byteLength, arrivedAtMs });
    },
    complete() {
      if (!cancelled) completed = true;
      return report();
    },
    cancel() {
      if (!completed) cancelled = true;
      return report();
    },
    get report() {
      return report();
    },
  };
}