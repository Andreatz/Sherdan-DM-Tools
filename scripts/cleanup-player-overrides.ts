import "dotenv/config";

import { cleanupOrphanPlayerVisibilityOverrides } from "@/lib/security/player-override-cleanup";

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const result = await cleanupOrphanPlayerVisibilityOverrides({ dryRun });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
