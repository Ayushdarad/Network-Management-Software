import { useState, useEffect, useCallback, useMemo } from 'react';
import { devicesApi, alertsApi, jobsApi, logsApi, assetsApi, usersApi } from '../lib/api';
import { buildSearchIndex, filterSearchResults, type SearchResult } from '../lib/globalSearch';

export function useGlobalSearch(query: string) {
  const [items, setItems] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [devicesRes, alertsRes, jobsRes, logsRes, assetsRes, usersRes] = await Promise.all([
        devicesApi.list().catch(() => ({ data: [] })),
        alertsApi.list().catch(() => ({ data: [] })),
        jobsApi.list().catch(() => ({ data: [] })),
        logsApi.list({ limit: '50' }).catch(() => ({ data: [] })),
        assetsApi.list().catch(() => []),
        usersApi.list().catch(() => ({ data: [] })),
      ]);

      setItems(buildSearchIndex({
        devices: devicesRes.data ?? [],
        alerts: alertsRes.data ?? [],
        jobs: jobsRes.data ?? [],
        logs: logsRes.data ?? [],
        assets: Array.isArray(assetsRes) ? assetsRes : [],
        users: usersRes.data ?? [],
      }));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const results = useMemo(
    () => filterSearchResults(items, query),
    [items, query],
  );

  return { results, loading, reload: load };
}
