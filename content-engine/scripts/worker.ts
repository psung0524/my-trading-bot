import "dotenv/config";

async function main() {
  const { runWorkerLoop } = await import("../src/server/jobs/worker");
  await runWorkerLoop({ once: process.argv.includes("--once") });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
