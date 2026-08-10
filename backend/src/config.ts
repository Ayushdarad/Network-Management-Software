/** Allowed CORS / WebSocket origins for the API. */
export function getAllowedOrigins(): string[] {
  const isProd = process.env.NODE_ENV === 'production';
  const devDefaults = isProd ? [] : [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:5174',
  ];
  const extra = [
    process.env.FRONTEND_URL,
    ...(process.env.CORS_ORIGINS?.split(',').map(s => s.trim()) ?? []),
  ].filter(Boolean) as string[];
  return [...new Set([...devDefaults, ...extra])];
}

/** JWT secret — required in production. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret && process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET environment variable must be set in production');
  }
  if (!secret) {
    console.warn('[Config] JWT_SECRET not set — using development fallback. Do not use in production.');
  }
  return secret || 'secret';
}
