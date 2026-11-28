import { useCallback, useEffect, useState } from 'react';
import { getAslabDashboard, type AslabDashboardData } from '@/services/laboratoryMembershipService';

export function useAslabDashboard(courseId: string, period: 'day' | 'week' | 'month', date: string) {
  const [data, setData] = useState<AslabDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!courseId) { setData(null); setError('Pilih mata kuliah yang dikelola.'); return; }
    setRefreshing(true);
    try {
      const next = await getAslabDashboard({ courseId, period, date });
      setData(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Dashboard gagal dimuat.');
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [courseId, period, date]);

  useEffect(() => { setLoading(true); void refresh(); }, [refresh]);
  return { data, loading, refreshing, error, refresh };
}
