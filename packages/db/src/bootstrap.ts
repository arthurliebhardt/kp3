import { createDb } from "./client";
import { platformSettings } from "./schema";

const db = createDb();

async function main() {
  const platformBaseDomain = process.env.PLATFORM_BASE_DOMAIN ?? "localhost";
  const installerVersion = process.env.INSTALLER_VERSION ?? "dev";

  await db
    .insert(platformSettings)
    .values({ key: "setup_completed", value: false })
    .onConflictDoNothing();
  await db
    .insert(platformSettings)
    .values({ key: "platform_base_domain", value: platformBaseDomain })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: platformBaseDomain, updatedAt: new Date() } });
  await db
    .insert(platformSettings)
    .values({ key: "installer_version", value: installerVersion })
    .onConflictDoUpdate({ target: platformSettings.key, set: { value: installerVersion, updatedAt: new Date() } });

}

main()
  .then(() => {
    console.log("Database bootstrap complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
