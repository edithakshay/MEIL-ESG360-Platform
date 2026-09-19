import app from "./app";
import { logger } from "./lib/logger";
import { seedDemoData } from "./lib/demo-data";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function start(): Promise<void> {
  try {
    await seedDemoData();
    logger.info("Demo data ready");
  } catch (error) {
    logger.warn(
      { err: error },
      "Demo data was not seeded; run the database schema push before using product routes",
    );
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }

    logger.info({ port }, "Server listening");
  });
}

void start();
