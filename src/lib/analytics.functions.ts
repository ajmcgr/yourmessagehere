import { createServerFn } from "@tanstack/react-start";

export const getTotalVisitors = createServerFn({ method: "GET" }).handler(async () => {
  const { fetchTotalVisitors } = await import("./analytics.server");
  return { visitors: await fetchTotalVisitors() };
});
