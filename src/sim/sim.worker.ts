/// <reference lib="webworker" />
import { runSimulation } from "./solver";
import type { SimRequest, SimResult } from "./types";

let latest: SimRequest | null = null;
let scheduled = false;

function run() {
  scheduled = false;
  const req = latest;
  latest = null;
  if (!req) return;
  let res: SimResult;
  try {
    res = runSimulation(req);
  } catch (e) {
    res = {
      seq: req.seq,
      ok: false,
      message: String(e),
      t: new Float64Array(0),
      data: {},
      op: {},
      stats: { steps: 0, iterations: 0, ms: 0, nodes: 0, unknowns: 0 },
      nodeStats: new Float64Array(0),
      power: {},
    };
  }
  const transfer: Transferable[] = [res.t.buffer as ArrayBuffer, res.nodeStats.buffer as ArrayBuffer];
  for (const k in res.data) transfer.push(res.data[k].buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage(res, transfer);
}

self.onmessage = (e: MessageEvent<SimRequest>) => {
  latest = e.data; // newer requests supersede queued ones
  if (!scheduled) {
    scheduled = true;
    setTimeout(run, 0);
  }
};
