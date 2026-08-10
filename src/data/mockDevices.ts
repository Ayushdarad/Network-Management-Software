// Types only — no mock data. All device data comes from the real API.
export interface Device {
  id: string;
  hostname: string;
  ip: string;
  type: 'router' | 'switch' | 'server' | 'firewall' | 'ap' | 'load-balancer' | 'storage';
  vendor: string;
  model: string;
  location: string;
  site: string;
  status: 'online' | 'offline' | 'warning' | 'unknown';
  os: string;
  uptime: string;
  lastSeen: string;
  interfaces: number;
  tags: string[];
}
