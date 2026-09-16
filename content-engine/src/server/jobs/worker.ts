import { processOne } from "./runner";
import { listJobTypes } from "./registry";

export async function runWorkerLoop(opts: { pollMs?: number; once?: boolean } = {}) {
  const workerId = `worker-${process.pid}-${Math.random().toString(36).slice(2, 6)}`;
  const pollMs = opts.pollMs ?? 2000;
  console.log(`worker ${workerId} 시작. 핸들러: ${listJobTypes().join(", ")}`);
  let running = true;
  const stop = () => {
    running = false;
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  while (running) {
    const did = await processOne(workerId);
    if (opts.once) break;
    if (!did) await new Promise((r) => setTimeout(r, pollMs));
  }
  console.log("worker 종료");
}
