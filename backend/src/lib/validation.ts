import { z } from 'zod';

export const deviceCreateSchema = z.object({
  hostname: z.string().min(1).max(100),
  ip: z.string().min(1).max(45),
  type: z.enum(['router', 'switch', 'server', 'firewall', 'ap', 'load-balancer', 'storage', 'camera']),
  vendor: z.string().min(1).max(100),
  model: z.string().min(1).max(100),
  location: z.string().min(1).max(100),
  site: z.string().min(1).max(50),
  os: z.string().max(100).optional().default(''),
  status: z.enum(['online', 'offline', 'warning', 'unknown']).optional(),
  tags: z.array(z.string()).optional(),
});

export const deviceUpdateSchema = deviceCreateSchema.partial();

export const jobCreateSchema = z.object({
  name: z.string().min(1).max(200),
  type: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  targetDevice: z.string().max(100).nullable().optional(),
  frequency: z.string().min(1).max(50),
  cron: z.string().max(50).nullable().optional(),
  owner: z.string().max(100).optional(),
  enabled: z.boolean().optional(),
  status: z.string().optional(),
});

export function parseBody<T>(schema: z.ZodSchema<T>, body: unknown): { data?: T; error?: string } {
  const result = schema.safeParse(body);
  if (!result.success) {
    const msg = result.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ');
    return { error: msg };
  }
  return { data: result.data };
}
