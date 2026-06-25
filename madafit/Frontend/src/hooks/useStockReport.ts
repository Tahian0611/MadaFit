import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function useStockReport(from: string, to: string) {
  return useQuery({
    queryKey: ['stock-report', from, to],
    queryFn: () => api.stockReports.getSummary({ from, to }),
    enabled: !!from && !!to,
    // ✅ FIX staleTime 0 : le rapport est toujours considéré périmé.
    // Avant : staleTime = 5 minutes → après un mouvement, le rapport
    // restait figé 5 minutes même après invalidation.
    staleTime: 0,
    retry: 2,
  });
}