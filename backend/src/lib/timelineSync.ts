import { db } from '../db/connection.js';
import { deviceTimeline } from '../db/schema.js';
import { eq, and, isNull } from 'drizzle-orm';

/** Map device.status → timeline segment state (matches pingMonitor logic). */
export function deviceStatusToTimelineState(status: string): 'online' | 'offline' {
  return status === 'online' ? 'online' : 'offline';
}

type DeviceRef = {
  id: string;
  hostname: string;
  status: string;
  updatedAt?: Date | string | null;
};

/**
 * Align the open device_timeline segment with devices.status.
 * Used when status is changed manually in the DB or via the API without a ping cycle.
 */
export async function syncDeviceTimelineFromStatus(device: DeviceRef): Promise<boolean> {
  const expectedState = deviceStatusToTimelineState(device.status);
  const rawTransition = device.updatedAt ? new Date(device.updatedAt) : new Date();
  const transitionAt = Number.isNaN(rawTransition.getTime()) ? new Date() : rawTransition;

  const [openSegment] = await db
    .select()
    .from(deviceTimeline)
    .where(and(eq(deviceTimeline.deviceId, device.id), isNull(deviceTimeline.endedAt)))
    .limit(1);

  if (!openSegment) {
    await db.insert(deviceTimeline).values({
      deviceId: device.id,
      hostname: device.hostname,
      state: expectedState,
      startedAt: transitionAt,
      summary: expectedState === 'online'
        ? 'OK - host online (status sync).'
        : `CRITICAL - host ${device.status} (status sync).`,
    });
    return true;
  }

  if (openSegment.state === expectedState) {
    return false;
  }

  const segStartMs = new Date(openSegment.startedAt).getTime();
  const endAt = new Date(); // always close at now when status changes on sync
  const durationSecs = Math.max(0, Math.floor((endAt.getTime() - segStartMs) / 1000));

  await db.update(deviceTimeline)
    .set({ endedAt: endAt, durationSecs })
    .where(eq(deviceTimeline.id, openSegment.id));

  await db.insert(deviceTimeline).values({
    deviceId: device.id,
    hostname: device.hostname,
    state: expectedState,
    startedAt: endAt,
    summary: expectedState === 'online'
      ? 'OK - host back online (status sync).'
      : `CRITICAL - host ${device.status} (status sync).`,
  });

  return true;
}
