import { describe, expect, test } from 'vitest';
import { createChunkProbe } from '../../apps/miniprogram/probes/chunk';

function clock() {
  let value = 0;
  return {
    now: () => value,
    advance: (ms) => {
      value += ms;
    },
  };
}

function buffer(byteLength) {
  return new ArrayBuffer(byteLength);
}

describe('chunk probe', () => {
  test('records chunk size and arrival order without buffering payload', () => {
    const time = clock();
    const probe = createChunkProbe(time.now);
    probe.onChunk(buffer(3));
    time.advance(7);
    probe.onChunk(buffer(5));
    time.advance(2);
    probe.onChunk(buffer(2));
    const report = probe.report;
    expect(report.chunks.map((chunk) => chunk.index)).toEqual([0, 1, 2]);
    expect(report.chunks.map((chunk) => chunk.byteLength)).toEqual([3, 5, 2]);
    expect(report.chunks.map((chunk) => chunk.arrivedAtMs)).toEqual([0, 7, 9]);
    expect(report.totalBytes).toBe(10);
    expect(report.firstArrivalMs).toBe(0);
    expect(report.lastArrivalMs).toBe(9);
    expect(report.completed).toBe(false);
    expect(report.cancelled).toBe(false);
  });

  test('an empty probe reports no arrival', () => {
    const probe = createChunkProbe(() => 0);
    expect(probe.report.chunks).toEqual([]);
    expect(probe.report.totalBytes).toBe(0);
    expect(probe.report.firstArrivalMs).toBeNull();
    expect(probe.report.lastArrivalMs).toBeNull();
  });

  test('completion seals the probe and ignores later chunks', () => {
    const time = clock();
    const probe = createChunkProbe(time.now);
    probe.onChunk(buffer(4));
    const completed = probe.complete();
    expect(completed.completed).toBe(true);
    expect(completed.cancelled).toBe(false);
    probe.onChunk(buffer(99));
    expect(probe.report.chunks).toHaveLength(1);
    expect(probe.report.totalBytes).toBe(4);
  });

  test('cancellation seals the probe and ignores later chunks', () => {
    const probe = createChunkProbe(() => 5);
    probe.onChunk(buffer(1));
    const cancelled = probe.cancel();
    expect(cancelled.cancelled).toBe(true);
    expect(cancelled.completed).toBe(false);
    probe.onChunk(buffer(100));
    expect(probe.report.chunks).toHaveLength(1);
    expect(probe.report.totalBytes).toBe(1);
  });

  test('the report exposes counts only, never decoded content', () => {
    const probe = createChunkProbe(() => 0);
    probe.onChunk(buffer(3));
    expect(Object.keys(probe.report).sort()).toEqual([
      'cancelled',
      'chunks',
      'completed',
      'firstArrivalMs',
      'lastArrivalMs',
      'totalBytes',
    ]);
    expect(Object.keys(probe.report.chunks[0]).sort()).toEqual(['arrivedAtMs', 'byteLength', 'index']);
  });
});
