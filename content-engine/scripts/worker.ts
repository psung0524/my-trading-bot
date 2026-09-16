// Job 워커. Phase 3에서 핸들러가 등록된다.
import "dotenv/config";

async function main() {
  const { runWorkerLoop } = await import("../src/server/jobs/worker");
  await runWorkerLoop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
