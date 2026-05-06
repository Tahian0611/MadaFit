import { useQuery } from '@tanstack/react-query';
import api from '@/services/api';

export function useStockReport(from: string, to: string) {
  return useQuery({
    queryKey: ['stock-report', from, to],
    queryFn: () => api.stockReports.getSummary({ from, to }),
    enabled: !!from && !!to, // Ne lance la requête que si les deux dates sont définies
    staleTime: 5 * 60 * 1000, // 5 minutes de cache
    retry: 2, // Réessaie 2 fois en cas d'erreur
  });
}