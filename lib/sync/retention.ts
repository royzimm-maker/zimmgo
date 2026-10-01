import { prisma } from "@/lib/db";
import { inBackground } from "@/lib/background";

// How long a device's synced trips are kept after they last changed. The
// device cookie lasts the same time and is renewed on every visit, so an
// active traveller never hits this; it only removes copies nobody has
// touched in a year (a cleared browser, a device no longer used). The
// privacy page states this — keep them in step.
export const DEVICE_RETENTION_DAYS = 365;
export const DEVICE_COOKIE_MAX_AGE_S = DEVICE_RETENTION_DAYS * 24 * 60 * 60;

// Opportunistic cleanup instead of a cron job, like the rate limiter's —
// run on ~1% of sync reads, never awaited.
export function sweepInactiveDevices(sampleRate = 0.01): Promise<void> | undefined {
  if (Math.random() >= sampleRate) return undefined;
  const cutoff = new Date(Date.now() - DEVICE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return inBackground("retention", () => prisma.device.deleteMany({ where: { updatedAt: { lt: cutoff } } }));
}
