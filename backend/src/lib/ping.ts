import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/** Cross-platform ICMP ping — returns true if the host responds. */
export async function pingHost(ip: string): Promise<boolean> {
  const args = process.platform === 'win32'
    ? `-n 1 -w 1000 ${ip}`
    : `-c 1 -W 1 ${ip}`;
  try {
    await execAsync(`ping ${args}`);
    return true;
  } catch {
    return false;
  }
}
