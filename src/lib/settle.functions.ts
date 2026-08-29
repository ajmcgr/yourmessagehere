import { createServerFn } from "@tanstack/react-start";

/**
 * Fire-and-forget from the client. Ensures any auction that has closed gets
 * its winner charged and emailed, without depending on the Rocket project's
 * pg_cron job.
 */
export const settleAuctions = createServerFn({ method: "POST" }).handler(async () => {
  const { settleClosedAuctions } = await import("./settle.server");
  await settleClosedAuctions();
  return { ok: true };
});
