/** Encode/decode job ping targets for API storage. */

export type TargetScope = 'all' | 'device' | 'site';

export function encodeTarget(scope: TargetScope, value?: string): string | null {
  if (scope === 'all') return null;
  if (scope === 'site' && value) return `site:${value}`;
  if (scope === 'device' && value) return value;
  return null;
}

export function decodeTarget(targetDevice: string | null | undefined): { scope: TargetScope; value?: string } {
  if (!targetDevice) return { scope: 'all' };
  if (targetDevice.startsWith('site:')) return { scope: 'site', value: targetDevice.slice(5) };
  return { scope: 'device', value: targetDevice };
}

export function formatTargetLabel(targetDevice: string | null | undefined): string {
  const { scope, value } = decodeTarget(targetDevice);
  if (scope === 'all') return 'All devices';
  if (scope === 'site') return `Site: ${value}`;
  return `Device: ${value}`;
}

export const JOB_TYPES = [
  'Device Ping Check',
  'Log Cleanup',
  'Uptime Report',
] as const;

export const JOB_FREQUENCIES = [
  'Every minute',
  'Every 5 minutes',
  'Every 15 minutes',
  'Every 30 minutes',
  'Hourly',
  'Every 6 hours',
  'Every 12 hours',
  'Daily',
  'Weekly',
  'Monthly',
] as const;
