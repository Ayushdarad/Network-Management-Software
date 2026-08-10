// Types only — no mock data. All alert data comes from the real API.
export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface Alert {
  id: string;
  severity: AlertSeverity;
  status: AlertStatus;
  title: string;
  description: string;
  device: string;
  deviceIp: string;
  site: string;
  category: string;
  createdAt: string;
  updatedAt?: string;
  acknowledgedBy?: string;
  assignedTo?: string;
  duration: string;
  count: number;
  rca?: string;
}
