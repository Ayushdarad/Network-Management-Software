import { can } from './permissions';

/** First route the current user is allowed to access after login. */
export function getDefaultRoute(): string {
  if (can('dashboard.view')) return '/dashboard';
  if (can('reports.view')) return '/reports';
  if (can('alerts.view')) return '/monitoring/alerts';
  if (can('inventory.view')) return '/inventory/devices';
  if (can('devices.view')) return '/inventory/devices';
  if (can('logs.view')) return '/logs/syslog';
  if (can('settings.view')) return '/settings';
  return '/unauthorized';
}
