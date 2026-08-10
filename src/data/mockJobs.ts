// Types only — no mock data. All data comes from the real API.
export interface Job {
  id: string;
  name: string;
  type: string;
  description?: string;
  targetDevice?: string | null;
  frequency: string;
  cron?: string;
  owner?: string;
  lastRun?: string;
  nextRun?: string;
  status: 'running' | 'success' | 'failed' | 'paused' | 'scheduled' | 'enabled' | 'disabled';
  enabled: boolean;
  progress?: number;
  duration?: string;
}
