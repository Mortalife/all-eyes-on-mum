import { Sidequest } from "sidequest";
import { env } from "./env.ts";
import { DailyReminderJob } from "./jobs/daily-reminder-job.ts";

/**
 * Initializes and starts the Sidequest background job runner.
 * Uses SQLite for job storage and schedules recurring jobs.
 */
export const startJobRunner = async () => {
  await Sidequest.start({
    backend: {
      driver: "@sidequest/sqlite-backend",
      config: {
        client: "better-sqlite3",
        connection: {
          filename: `${env.DATABASE_PATH ?? "./data/"}sidequest.sqlite`,
        },
        pool: {
          afterCreate: (
            conn: unknown,
            cb: (err: Error | null, conn: unknown) => void,
          ) => {
            const connection = conn as {
              prepare: (sql: string) => { run: () => void };
            };
            connection.prepare("PRAGMA journal_mode = WAL").run();
            connection.prepare("PRAGMA busy_timeout = 5000").run();
            connection.prepare("PRAGMA synchronous = NORMAL").run();
            connection.prepare("PRAGMA cache_size = 2000").run();
            cb(null, conn);
          },
        },
      },
    },
    logger: {
      level: "info",
      json: false,
    },
    minThreads: 1,
    maxThreads: 2,
    releaseStaleJobsIntervalMin: 1,
    releaseStaleJobsMaxClaimedMs: 60_000,
    queues: [
      { name: "default", concurrency: 2, priority: 50 },
      { name: "reminders", concurrency: 1, priority: 100 },
    ],
  });

  console.log("Sidequest job runner started");

  // Schedule daily reminder job to run at 8am
  await Sidequest.build(DailyReminderJob)
    .queue("reminders")
    .schedule("0 8 * * *")
    .catch((err) =>
      console.error("Failed to schedule daily reminder job", err),
    );

  console.log("Daily reminder job scheduled for 8am");
};

export { Sidequest };
