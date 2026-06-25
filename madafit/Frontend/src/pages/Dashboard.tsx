import { useMemo, useEffect, useState, useCallback, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DollarSign, Users, UserCheck, Bell, TrendingUp, TrendingDown, Clock, Activity,
  Receipt, Package, Calculator, Wallet, X, Search, Calendar, Filter, RotateCcw,
  BarChart3, Download, FileText, ChevronLeft, ChevronRight
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar
} from "recharts";
import { refreshNotifications } from "@/services/api";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import type { User, Payment, AttendanceRecord, SubscriptionPlan, Product } from "@/types/entities";
import {
  computeDashboardStats,
  extractIdFromIri,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  formatTime,
} from "@/lib/madafit";
import { toast } from "sonner";

type DashboardTransactionLite = {
  id?: number;
  type?: string;
  quantity?: number;
  unitPrice?: number;
  amount?: number;
  product?: { id?: number; purchasePrice?: number; name?: string } | string | null;
  cashRegister?: string;
  date?: string;
  memberName?: string;
  method?: string;
  subscription?: string;
};

type CashRegister = "caisse1" | "caisse2";

type PeriodMode = "month" | "day" | "interval";

type ReportTransaction = {
  date: string;
  type: string;
  designation: string;
  detail: string;
  entree: number;
  sortie: number;
  caisse: string;
};

// ============================================================================
// OPTIONS REACT QUERY PARTAGÉES
// ============================================================================

const COMMON_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
  placeholderData: (previousData: any) => previousData,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 10000),
} as const;

// ============================================================================
// HOOK DEBOUNCE
// ============================================================================

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// ============================================================================
// FONCTIONS UTILITAIRES (inchangées)
// ============================================================================

function resolveCashRegister(value?: string | null): CashRegister {
  const normalized = (value ?? "").toLowerCase().replace(/\s/g, "");
  return normalized === "caisse1" ? "caisse1" : "caisse2";
}

function getTransactionPurchasePrice(tx: DashboardTransactionLite, productMap: Record<string, Product>) {
  if (tx.product && typeof tx.product === "object" && typeof tx.product.purchasePrice === "number") {
    return tx.product.purchasePrice;
  }

  const productId = typeof tx.product === "string"
    ? extractIdFromIri(tx.product)
    : tx.product?.id
      ? String(tx.product.id)
      : null;

  return productId ? productMap[productId]?.purchasePrice : undefined;
}

function computeCashierCAStats(
  payments: Payment[],
  transactions: DashboardTransactionLite[],
  products: Product[],
  cashRegister: CashRegister,
  resetMonth: string | null,
) {
  const productMap = (products ?? []).reduce<Record<string, Product>>((acc, product) => {
    if (product.id) acc[String(product.id)] = product;
    return acc;
  }, {});

  const cashierPayments = (payments ?? []).filter((payment) => {
    if (resolveCashRegister(payment.cashRegister) !== cashRegister) return false;
    if (!resetMonth) return true;
    const paymentMonth = typeof payment.date === 'string' ? payment.date.substring(0, 7) : '';
    return paymentMonth >= resetMonth;
  });

  const cashierTransactions = (transactions ?? []).filter((tx) => {
    if (resolveCashRegister(tx.cashRegister) !== cashRegister) return false;
    if (!resetMonth) return true;
    const txMonth = typeof tx.date === 'string' ? tx.date.substring(0, 7) : '';
    return txMonth >= resetMonth;
  });

  const subscriptionTotal = cashierPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  const salesRevenueTypes = new Set(['sale', 'credit']);
  const sortiesTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesRevenueTypes.has(tx.type)) return sum;
    if (tx.type === 'credit') return sum;
    const qty = Number(tx.quantity ?? 0);
    const unit = Number(tx.unitPrice ?? 0);
    return sum + qty * unit;
  }, 0);

  const salesTypes = new Set(['sale', 'credit', 'non_sale_exit']);
  const achatsTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesTypes.has(tx.type)) return sum;
    if (tx.type === 'credit') return sum;
    const qty = Number(tx.quantity ?? 0);
    const productPurchase = getTransactionPurchasePrice(tx, productMap);
    const unitCost = Number(productPurchase ?? tx.unitPrice ?? 0);
    return sum + qty * unitCost;
  }, 0);

  const expenseTypes = new Set(['entry', 'charge', 'other_charge']);
  const entriesTotal = cashierTransactions.reduce((sum, tx) => {
    if (!expenseTypes.has(tx.type)) return sum;
    const qty = Number(tx.quantity ?? 0);
    const productPurchase = getTransactionPurchasePrice(tx, productMap);
    const unitCost = Number(productPurchase ?? tx.unitPrice ?? 0);
    return sum + qty * unitCost;
  }, 0);

  const depensesTotal = achatsTotal + entriesTotal;
  const caTotal = subscriptionTotal + sortiesTotal;
  const resultat = caTotal - depensesTotal;

  return {
    caTotal,
    subscriptionTotal,
    sortiesTotal,
    depensesTotal,
    achatsTotal,
    entriesTotal,
    resultat,
    items: {
      payments: cashierPayments,
      sorties: cashierTransactions.filter(tx => salesRevenueTypes.has(tx.type)),
      depenses: cashierTransactions.filter(tx => expenseTypes.has(tx.type) || salesTypes.has(tx.type)),
      achats: cashierTransactions.filter(tx => salesTypes.has(tx.type)),
      entries: cashierTransactions.filter(tx => expenseTypes.has(tx.type)),
    },
    productMap
  };
}

/* ═══════════════════════════════════════════════════════════════════════════
   HELPERS POUR LE CALENDRIER DES RAPPORTS
   ═══════════════════════════════════════════════════════════════════════════ */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(year: number, month: number): string {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
}

function getMonthYearKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   COMPOSANT HORLOGE EN TEMPS RÉEL — MÉMOÏSÉ
   ═══════════════════════════════════════════════════════════════════════════ */
const LiveClock = memo(function LiveClock() {
  const [time, setTime] = useState(() => new Date().toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(new Date().toLocaleTimeString('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hidden md:block text-right">
      <p className="text-xs font-bold text-muted-foreground uppercase">Dernière mise à jour</p>
      <p className="text-sm font-bold text-foreground">{time}</p>
    </div>
  );
});

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function Dashboard() {
  const { isAdmin, isReception } = useAuth();
  const showCashierStats = isAdmin || isReception;
  const [activeCaisseModal, setActiveCaisseModal] = useState<"caisse1" | "caisse2" | null>(null);
  const [activeDetail, setActiveDetail] = useState<{
    title: string;
    type: 'payments' | 'transactions';
    data: any[];
  } | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const queryClient = useQueryClient();

  /* ── États pour Rapports & Calendrier ─────────────────────────────────── */
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCaisse, setReportCaisse] = useState<CashRegister | null>(null);
  const [reportPeriodMode, setReportPeriodMode] = useState<PeriodMode>("month");
  const [reportMonthYear, setReportMonthYear] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [reportDay, setReportDay] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [reportIntervalStart, setReportIntervalStart] = useState(() => {
    const now = new Date();
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    return firstDay.toISOString().split('T')[0];
  });
  const [reportIntervalEnd, setReportIntervalEnd] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [reportSelectedDay, setReportSelectedDay] = useState<number | null>(null);

  // -------------------------------------------------------------------------
  // QUERIES AVEC OPTIONS OPTIMISÉES
  // -------------------------------------------------------------------------

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
    ...COMMON_QUERY_OPTIONS,
  });
  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });
  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.transactions.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
    ...COMMON_QUERY_OPTIONS,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
    ...COMMON_QUERY_OPTIONS,
  });

  useEffect(() => {
    refreshNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stats = useMemo(() => {
    return computeDashboardStats(
      extractHydraMembers<User>(usersQuery.data),
      extractHydraMembers<Payment>(paymentsQuery.data),
      extractHydraMembers<AttendanceRecord>(attendanceQuery.data),
      extractHydraMembers<SubscriptionPlan>(plansQuery.data),
      [],
      extractHydraMembers<any>(transactionsQuery.data),
      extractHydraMembers<any>(productsQuery.data)
    );
  }, [
    usersQuery.data,
    paymentsQuery.data,
    attendanceQuery.data,
    plansQuery.data,
    transactionsQuery.data,
    productsQuery.data,
  ]);

  const payments = extractHydraMembers<Payment>(paymentsQuery.data);
  const transactions = extractHydraMembers<DashboardTransactionLite>(transactionsQuery.data);
  const products = extractHydraMembers<Product>(productsQuery.data);

  /* ═══════════════════════════════════════════════════════════════════════
     RÉCUPÉRATION DU RESET MONTH — UNIQUEMENT POUR L'ADMIN (CAISSE 1)
     ═══════════════════════════════════════════════════════════════════════ */
  const caisse1ResetQuery = useQuery({
    queryKey: ["cashier-reset", "caisse1"],
    queryFn: () => api.cashierResets.getLatest('caisse1'),
    enabled: showCashierStats && isAdmin,
    ...COMMON_QUERY_OPTIONS,
  });

  const caisse1ResetMonth = caisse1ResetQuery.data?.month ?? null;

  /* ═══════════════════════════════════════════════════════════════════════
     POUR LA CAISSE 2 : PAS DE RESET (null = tout l'historique visible)
     ═══════════════════════════════════════════════════════════════════════ */
  const caisse2ResetMonth = null;

  const caisse1Stats = useMemo(
    () => computeCashierCAStats(payments, transactions, products, "caisse1", caisse1ResetMonth),
    [payments, transactions, products, caisse1ResetMonth],
  );
  const caisse2Stats = useMemo(
    () => computeCashierCAStats(payments, transactions, products, "caisse2", caisse2ResetMonth),
    [payments, transactions, products],
  );

  /* ═══════════════════════════════════════════════════════════════════════
     MUTATION POUR CRÉER UN RESET — ADMIN UNIQUEMENT
     ═══════════════════════════════════════════════════════════════════════ */
  const createResetMutation = useMutation({
    mutationFn: async (month: string) => {
      try {
        return await api.cashierResets.create(month);
      } catch (err: any) {
        if (err.name === 'AbortError' || err.message?.includes('aborted')) {
          return { month } as { month: string };
        }
        throw err;
      }
    },
    onSuccess: (data) => {
      toast.success("Mois précédents effacés avec succès");
      queryClient.invalidateQueries({ queryKey: ["cashier-reset", "caisse1"], exact: true });
      setShowResetConfirm(false);
    },
    onError: (err: any) => {
      toast.error(err.message || "Erreur lors de l'effacement");
      setShowResetConfirm(false);
    },
  });

  // -------------------------------------------------------------------------
  // MÉMOÏSATION DES CALCULS DÉRIVÉS
  // -------------------------------------------------------------------------

  const filteredDetailData = useMemo(() => {
    if (!activeDetail) return [];
    let data = activeDetail.data;
    if (debouncedSearchTerm) {
      const lower = debouncedSearchTerm.toLowerCase();
      data = data.filter(item => {
        const designation = activeDetail.type === 'payments'
          ? item.memberName
          : (item.productName || (typeof item.product === 'object' ? item.product?.name : null) || 'Charge/Divers');
        return designation?.toLowerCase().includes(lower);
      });
    }
    return data;
  }, [activeDetail, debouncedSearchTerm]);

  const globalStats = useMemo(() => ({
    caTotal: caisse1Stats.caTotal + caisse2Stats.caTotal,
    depensesTotal: caisse1Stats.depensesTotal + caisse2Stats.depensesTotal,
    resultat: caisse1Stats.resultat + caisse2Stats.resultat,
  }), [caisse1Stats, caisse2Stats]);

  // -------------------------------------------------------------------------
  // HANDLERS MÉMOÏSÉS
  // -------------------------------------------------------------------------

  const handleResetPreviousMonths = useCallback(() => {
    setShowResetConfirm(true);
  }, []);

  const confirmReset = useCallback(() => {
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    createResetMutation.mutate(currentMonth);
  }, []);

  const openReportModal = useCallback((caisse: CashRegister) => {
    setReportCaisse(caisse);
    setReportPeriodMode("month");
    setReportSelectedDay(null);
    const now = new Date();
    setReportMonthYear({ year: now.getFullYear(), month: now.getMonth() });
    setReportDay(now.toISOString().split('T')[0]);
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    setReportIntervalStart(firstDay.toISOString().split('T')[0]);
    setReportIntervalEnd(now.toISOString().split('T')[0]);
    setShowReportModal(true);
  }, []);

  const handleCloseCaisseModal = useCallback(() => setActiveCaisseModal(null), []);
  const handleCloseReportModal = useCallback(() => {
    setShowReportModal(false);
    setReportSelectedDay(null);
  }, []);
  const handleCloseDetailModal = useCallback(() => {
    setActiveDetail(null);
    setSearchTerm("");
  }, []);

  const prevMonth = useCallback(() => {
    setReportMonthYear(prev => {
      if (prev.month === 0) return { year: prev.year - 1, month: 11 };
      return { year: prev.year, month: prev.month - 1 };
    });
    setReportSelectedDay(null);
  }, []);

  const nextMonth = useCallback(() => {
    setReportMonthYear(prev => {
      if (prev.month === 11) return { year: prev.year + 1, month: 0 };
      return { year: prev.year, month: prev.month + 1 };
    });
    setReportSelectedDay(null);
  }, []);

  // -------------------------------------------------------------------------
  // MÉMOÏSATION DES DONNÉES DE RAPPORT (CRITIQUE)
  // -------------------------------------------------------------------------

  /* ── Données des rapports filtrées par caisse et période ──────────────── */
  const reportData = useMemo(() => {
    if (!reportCaisse) return [];

    const allPayments = payments.filter(p => resolveCashRegister(p.cashRegister) === reportCaisse);
    const allTransactions = transactions.filter(t => resolveCashRegister(t.cashRegister) === reportCaisse);

    let filteredPayments: Payment[] = [];
    let filteredTransactions: DashboardTransactionLite[] = [];

    if (reportPeriodMode === "month") {
      const monthKey = getMonthYearKey(reportMonthYear.year, reportMonthYear.month);
      filteredPayments = allPayments.filter(p => typeof p.date === 'string' && p.date.startsWith(monthKey));
      filteredTransactions = allTransactions.filter(t => typeof t.date === 'string' && t.date.startsWith(monthKey));
    } else if (reportPeriodMode === "day") {
      filteredPayments = allPayments.filter(p => typeof p.date === 'string' && p.date.startsWith(reportDay));
      filteredTransactions = allTransactions.filter(t => typeof t.date === 'string' && t.date.startsWith(reportDay));
    } else if (reportPeriodMode === "interval") {
      filteredPayments = allPayments.filter(p => typeof p.date === 'string' && p.date >= reportIntervalStart && p.date <= reportIntervalEnd);
      filteredTransactions = allTransactions.filter(t => typeof t.date === 'string' && t.date >= reportIntervalStart && t.date <= reportIntervalEnd);
    }

    const result: ReportTransaction[] = [];

    /* Paiements = entrées d'argent */
    filteredPayments.forEach(p => {
      result.push({
        date: p.date || '',
        type: 'Abonnement',
        designation: p.memberName || 'Membre',
        detail: p.subscription || p.method || 'Paiement',
        entree: p.amount || 0,
        sortie: 0,
        caisse: reportCaisse,
      });
    });

    /* Transactions = entrées ou sorties selon le type */
    filteredTransactions.forEach(t => {
      const salesRevenueTypes = new Set(['sale', 'credit']);
      const expenseTypes = new Set(['entry', 'charge', 'other_charge']);
      const isRevenue = salesRevenueTypes.has(t.type || '');
      const isExpense = expenseTypes.has(t.type || '') || t.type === 'non_sale_exit';

      let designation = 'Charge/Divers';
      if (t.memberName) {
        designation = t.memberName;
      } else if (t.product && typeof t.product === 'object' && t.product.name) {
        designation = t.product.name;
      } else if (typeof t.product === 'string') {
        const pId = extractIdFromIri(t.product);
        const pName = pId ? (products.find(p => String(p.id) === pId)?.name) : null;
        designation = pName || 'Produit';
      }

      let amount = 0;
      if (isRevenue && t.type !== 'credit') {
        amount = (t.quantity || 0) * (t.unitPrice || 0);
      } else if (isExpense) {
        amount = (t.quantity || 0) * (t.unitPrice || 0);
      }

      result.push({
        date: t.date || '',
        type: t.type || 'Inconnu',
        designation,
        detail: `${t.quantity || 1} x ${formatCurrency(t.unitPrice || 0)}`,
        entree: isRevenue && t.type !== 'credit' ? amount : 0,
        sortie: isExpense ? amount : 0,
        caisse: reportCaisse,
      });
    });

    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [reportCaisse, reportPeriodMode, reportMonthYear, reportDay, reportIntervalStart, reportIntervalEnd, payments, transactions, products]);

  /* ── Données par jour pour le calendrier mensuel ──────────────────────── */
  const calendarDayData = useMemo(() => {
    if (reportPeriodMode !== "month" || !reportCaisse) return {};

    const monthKey = getMonthYearKey(reportMonthYear.year, reportMonthYear.month);
    const days: Record<number, { entree: number; sortie: number; count: number }> = {};

    const allPayments = payments.filter(p =>
      resolveCashRegister(p.cashRegister) === reportCaisse &&
      typeof p.date === 'string' && p.date.startsWith(monthKey)
    );
    const allTransactions = transactions.filter(t =>
      resolveCashRegister(t.cashRegister) === reportCaisse &&
      typeof t.date === 'string' && t.date.startsWith(monthKey)
    );

    allPayments.forEach(p => {
      const day = parseInt(p.date!.split('T')[0].split('-')[2]);
      if (!days[day]) days[day] = { entree: 0, sortie: 0, count: 0 };
      days[day].entree += p.amount || 0;
      days[day].count += 1;
    });

    const salesRevenueTypes = new Set(['sale', 'credit']);
    const expenseTypes = new Set(['entry', 'charge', 'other_charge', 'non_sale_exit']);

    allTransactions.forEach(t => {
      const day = parseInt(t.date!.split('T')[0].split('-')[2]);
      if (!days[day]) days[day] = { entree: 0, sortie: 0, count: 0 };

      const isRevenue = salesRevenueTypes.has(t.type || '') && t.type !== 'credit';
      const isExpense = expenseTypes.has(t.type || '');

      const amount = (t.quantity || 0) * (t.unitPrice || 0);

      if (isRevenue) {
        days[day].entree += amount;
      } else if (isExpense) {
        days[day].sortie += amount;
      }
      days[day].count += 1;
    });

    return days;
  }, [reportPeriodMode, reportCaisse, reportMonthYear, payments, transactions]);

  /* ── Données du graphique de flux ────────────────────────────────────── */
  const chartData = useMemo(() => {
    if (reportPeriodMode === "month") {
      const daysInMonth = getDaysInMonth(reportMonthYear.year, reportMonthYear.month);
      const data = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const dayInfo = calendarDayData[d] || { entree: 0, sortie: 0 };
        data.push({
          name: `${d}`,
          entrees: dayInfo.entree,
          sorties: dayInfo.sortie,
        });
      }
      return data;
    } else if (reportPeriodMode === "day") {
      const hourlyData: Record<string, { entrees: number; sorties: number }> = {};
      for (let h = 0; h < 24; h++) {
        const key = `${String(h).padStart(2, '0')}h`;
        hourlyData[key] = { entrees: 0, sorties: 0 };
      }

      reportData.forEach(r => {
        const hour = r.date.split('T')[1]?.substring(0, 2) || '00';
        const key = `${hour}h`;
        if (!hourlyData[key]) hourlyData[key] = { entrees: 0, sorties: 0 };
        hourlyData[key].entrees += r.entree;
        hourlyData[key].sorties += r.sortie;
      });

      return Object.entries(hourlyData).map(([name, val]) => ({ name, ...val }));
    } else {
      /* Intervalle : grouper par jour */
      const dailyData: Record<string, { entrees: number; sorties: number }> = {};
      reportData.forEach(r => {
        const day = r.date.split('T')[0];
        if (!dailyData[day]) dailyData[day] = { entrees: 0, sorties: 0 };
        dailyData[day].entrees += r.entree;
        dailyData[day].sorties += r.sortie;
      });
      return Object.entries(dailyData).map(([name, val]) => ({ name, ...val }));
    }
  }, [reportPeriodMode, reportMonthYear, calendarDayData, reportData]);

  /* ── Données du jour sélectionné dans le calendrier ───────────────────── */
  const selectedDayData = useMemo(() => {
    if (reportSelectedDay === null || reportPeriodMode !== "month") return [];
    const dayStr = String(reportSelectedDay).padStart(2, '0');
    const monthKey = getMonthYearKey(reportMonthYear.year, reportMonthYear.month);
    const fullDayPrefix = `${monthKey}-${dayStr}`;

    return reportData.filter(r => r.date.startsWith(fullDayPrefix));
  }, [reportSelectedDay, reportPeriodMode, reportMonthYear, reportData]);

  // -------------------------------------------------------------------------
  // EXPORTS MÉMOÏSÉS
  // -------------------------------------------------------------------------

  /* ── Export CSV ───────────────────────────────────────────────────────── */
  const exportCSV = useCallback(() => {
    if (reportData.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const headers = ["Date", "Type", "Désignation", "Détail", "Entrée (Ar)", "Sortie (Ar)", "Caisse"];
    const rows = reportData.map(r => [
      r.date,
      r.type,
      r.designation,
      r.detail,
      r.entree.toString(),
      r.sortie.toString(),
      r.caisse,
    ]);

    const csvContent = [
      headers.join(";"),
      ...rows.map(r => r.join(";"))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    const periodLabel = reportPeriodMode === "month"
      ? getMonthYearKey(reportMonthYear.year, reportMonthYear.month)
      : reportPeriodMode === "day"
        ? reportDay
        : `${reportIntervalStart}_to_${reportIntervalEnd}`;
    link.setAttribute("download", `rapport_${reportCaisse}_${periodLabel}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Export CSV téléchargé");
  }, [reportData, reportPeriodMode, reportMonthYear, reportDay, reportIntervalStart, reportIntervalEnd, reportCaisse]);

  /* ── Export PDF ───────────────────────────────────────────────────────── */
  const exportPDF = useCallback(() => {
    if (reportData.length === 0) {
      toast.error("Aucune donnée à exporter");
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error("Impossible d'ouvrir la fenêtre d'impression");
      return;
    }

    const periodLabel = reportPeriodMode === "month"
      ? formatMonthYear(reportMonthYear.year, reportMonthYear.month)
      : reportPeriodMode === "day"
        ? `Jour: ${reportDay}`
        : `Du ${reportIntervalStart} au ${reportIntervalEnd}`;

    const totalEntrees = reportData.reduce((s, r) => s + r.entree, 0);
    const totalSorties = reportData.reduce((s, r) => s + r.sortie, 0);
    const solde = totalEntrees - totalSorties;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Rapport ${reportCaisse}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; color: #333; }
          h1 { font-size: 24px; margin-bottom: 8px; }
          .subtitle { color: #666; font-size: 14px; margin-bottom: 24px; }
          .summary { display: flex; gap: 24px; margin-bottom: 24px; }
          .summary-box { padding: 16px 24px; border-radius: 8px; text-align: center; flex: 1; }
          .summary-box.entree { background: #dcfce7; color: #166534; }
          .summary-box.sortie { background: #fee2e2; color: #991b1b; }
          .summary-box.solde { background: #dbeafe; color: #1e40af; }
          .summary-box .label { font-size: 12px; text-transform: uppercase; font-weight: bold; margin-bottom: 4px; }
          .summary-box .value { font-size: 20px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; }
          th { background: #f3f4f6; padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; font-weight: bold; border-bottom: 2px solid #e5e7eb; }
          td { padding: 10px 12px; border-bottom: 1px solid #e5e7eb; font-size: 13px; }
          tr:hover { background: #f9fafb; }
          .text-right { text-align: right; }
          .text-green { color: #166534; font-weight: bold; }
          .text-red { color: #991b1b; font-weight: bold; }
          .footer { margin-top: 32px; text-align: center; font-size: 11px; color: #9ca3af; }
        </style>
      </head>
      <body>
        <h1>Rapport de Caisse — ${reportCaisse === "caisse1" ? "Caisse 1 (Réception)" : "Caisse 2 (Admin)"}</h1>
        <p class="subtitle">Période : ${periodLabel} | Généré le ${new Date().toLocaleString('fr-FR')}</p>

        <div class="summary">
          <div class="summary-box entree">
            <div class="label">Total Entrées</div>
            <div class="value">${formatCurrency(totalEntrees)}</div>
          </div>
          <div class="summary-box sortie">
            <div class="label">Total Sorties</div>
            <div class="value">${formatCurrency(totalSorties)}</div>
          </div>
          <div class="summary-box solde">
            <div class="label">Solde</div>
            <div class="value">${formatCurrency(solde)}</div>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Désignation</th>
              <th>Détail</th>
              <th class="text-right">Entrée</th>
              <th class="text-right">Sortie</th>
            </tr>
          </thead>
          <tbody>
            ${reportData.map(r => `
              <tr>
                <td>${r.date.replace('T', ' ')}</td>
                <td>${r.type}</td>
                <td>${r.designation}</td>
                <td>${r.detail}</td>
                <td class="text-right ${r.entree > 0 ? 'text-green' : ''}">${r.entree > 0 ? formatCurrency(r.entree) : '-'}</td>
                <td class="text-right ${r.sortie > 0 ? 'text-red' : ''}">${r.sortie > 0 ? formatCurrency(r.sortie) : '-'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <p class="footer">Document généré automatiquement par Madafit Dashboard</p>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 500);
    toast.success("PDF prêt à l'impression");
  }, [reportData, reportPeriodMode, reportMonthYear, reportDay, reportIntervalStart, reportIntervalEnd, reportCaisse]);

  // -------------------------------------------------------------------------
  // RENDU
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex justify-between items-end">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Statistiques en temps réel de votre salle</p>
        </div>
        <LiveClock />
      </div>

      {/* ── Résumé Caisse en premier plan ─────────────────────── */}
      {showCashierStats && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {isReception && !isAdmin && (
            <div
              className="p-6 bg-card rounded-2xl border border-border shadow-lg cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between group"
              onClick={() => setActiveCaisseModal("caisse1")}
              style={{ willChange: "transform" }}
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                  <Wallet size={24} />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">Caisse 1</h2>
                  <p className="text-sm text-muted-foreground">Reception</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Chiffre d'affaires</p>
                <p className="font-black text-xl text-primary">{formatCurrency(caisse1Stats.caTotal)}</p>
              </div>
            </div>
          )}

          {isAdmin && (
            <>
              <div
                className="p-6 bg-card rounded-2xl border border-border shadow-lg cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between group"
                onClick={() => setActiveCaisseModal("caisse2")}
                style={{ willChange: "transform" }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground text-lg">Caisse 2</h2>
                    <p className="text-sm text-muted-foreground">Admin</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Chiffre d'affaires</p>
                  <p className="font-black text-xl text-primary">{formatCurrency(caisse2Stats.caTotal)}</p>
                </div>
              </div>

              <div
                className="p-6 bg-card rounded-2xl border border-border shadow-lg cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between group"
                onClick={() => setActiveCaisseModal("caisse1")}
                style={{ willChange: "transform" }}
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                    <Wallet size={24} />
                  </div>
                  <div>
                    <h2 className="font-bold text-foreground text-lg">Caisse 1</h2>
                    <p className="text-sm text-muted-foreground">Reception</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Chiffre d'affaires</p>
                  <p className="font-black text-xl text-primary">{formatCurrency(caisse1Stats.caTotal)}</p>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Totaux Globaux (Admin Uniquement) ─────────────────── */}
      {isAdmin && (
        <div className="mb-8 grid grid-cols-1 sm:grid-cols-3 gap-4 animate-in slide-in-from-bottom-4 duration-500 delay-150">
          <div className="p-5 bg-primary/5 rounded-2xl border border-primary/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform">
              <TrendingUp size={48} className="text-primary" />
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Chiffres d'affaires Global</p>
            <p className="font-black text-2xl text-primary">{formatCurrency(globalStats.caTotal)}</p>
          </div>

          <div className="p-5 bg-destructive/5 rounded-2xl border border-destructive/20 shadow-sm flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform">
              <TrendingDown size={48} className="text-destructive" />
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Dépenses Totales</p>
            <p className="font-black text-2xl text-destructive">{formatCurrency(globalStats.depensesTotal)}</p>
          </div>

          <div className={`p-5 rounded-2xl border shadow-md flex flex-col justify-center relative overflow-hidden group ${globalStats.resultat >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
            }`}>
            <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:scale-125 transition-transform">
              <Calculator size={48} className={globalStats.resultat >= 0 ? "text-green-500" : "text-red-500"} />
            </div>
            <p className="text-[10px] uppercase font-bold text-muted-foreground mb-1">Résultat Global</p>
            <p className={`font-black text-2xl ${globalStats.resultat >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatCurrency(globalStats.resultat)}
            </p>
          </div>
        </div>
      )}

      {/* ── Modal Caisse ────────────────────────────────────────── */}
      {activeCaisseModal && (
        <div className="fixed inset-0 z-[9999] h-full flex items-center justify-center bg-black/50 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in !mt-0">
          <div className="bg-card w-full max-w-6xl h-full sm:h-auto rounded-none sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-none sm:max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Wallet className="text-primary" />
                {activeCaisseModal === "caisse1" ? "Détails Caisse 1 (Reception)" : "Détails Caisse 2 (Admin)"}
              </h2>

              <div className="flex items-center gap-2 sm:gap-3">
                {isAdmin && activeCaisseModal === "caisse1" && (
                  <button
                    onClick={handleResetPreviousMonths}
                    disabled={createResetMutation.isPending}
                    className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shrink-0 sm:w-auto sm:px-4 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100">
                    <RotateCcw size={16} />
                    {createResetMutation.isPending ? "Effacement..." : "Effacer les mois précédents"}
                  </button>
                )}

                {isAdmin && (
                  <button
                    onClick={() => openReportModal(activeCaisseModal)}
                    className="flex items-center justify-center gap-2 h-11 rounded-xl bg-accent text-accent-foreground font-semibold text-sm shrink-0 px-4 hover:bg-accent/90 transition-all hover:scale-105 active:scale-95">
                    <BarChart3 size={16} />
                    Rapports & Calendrier
                  </button>
                )}

                <button
                  onClick={handleCloseCaisseModal}
                  className="p-2 hover:bg-muted rounded-full transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto">
              <CashierCards
                title={activeCaisseModal === "caisse1" ? "Caisse 1 - Reception" : "Caisse 2 - Admin"}
                stats={activeCaisseModal === "caisse1" ? caisse1Stats : caisse2Stats}
                isAdmin={isAdmin}
                onDetail={(title, type, data) => setActiveDetail({ title, type, data })}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Rapports & Calendrier ────────────────────────────────────── */}
      {showReportModal && reportCaisse && (
        <div className="fixed inset-0 z-[10002] h-full flex items-center justify-center bg-black/60 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in !mt-0">
          <div className="bg-card w-full max-w-6xl h-full sm:h-auto rounded-none sm:rounded-2xl shadow-xl border border-border flex flex-col max-h-none sm:max-h-[95vh]">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-primary/10 rounded-xl">
                  <BarChart3 size={20} className="text-primary" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Rapports & Calendrier — {reportCaisse === "caisse1" ? "Caisse 1" : "Caisse 2"}
                  </h2>
                  <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest">
                    Flux d'argent filtré par période
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3">
                <button
                  onClick={exportCSV}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-muted transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <Download size={16} /> CSV
                </button>
                <button
                  onClick={exportPDF}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <FileText size={16} /> PDF
                </button>
                <button
                  onClick={handleCloseReportModal}
                  className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Sélecteur de période */}
            <div className="p-4 border-b border-border bg-muted/20">
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
                  {(['month', 'day', 'interval'] as PeriodMode[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setReportPeriodMode(mode);
                        setReportSelectedDay(null);
                      }}
                      className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${reportPeriodMode === mode
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                    >
                      {mode === "month" ? "Mois" : mode === "day" ? "Jour" : "Intervalle"}
                    </button>
                  ))}
                </div>

                {reportPeriodMode === "month" && (
                  <div className="flex items-center gap-2">
                    <button onClick={prevMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-sm font-bold text-foreground min-w-[140px] text-center">
                      {formatMonthYear(reportMonthYear.year, reportMonthYear.month)}
                    </span>
                    <button onClick={nextMonth} className="p-2 hover:bg-muted rounded-lg transition-colors">
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}

                {reportPeriodMode === "day" && (
                  <input
                    type="date"
                    value={reportDay}
                    onChange={(e) => setReportDay(e.target.value)}
                    className="bg-background border border-border rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                )}

                {reportPeriodMode === "interval" && (
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={reportIntervalStart}
                      onChange={(e) => setReportIntervalStart(e.target.value)}
                      className="bg-background border border-border rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                    <span className="text-muted-foreground font-bold">→</span>
                    <input
                      type="date"
                      value={reportIntervalEnd}
                      onChange={(e) => setReportIntervalEnd(e.target.value)}
                      className="bg-background border border-border rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>
            </div>

            {/* Contenu principal */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Graphique de flux */}
              <div className="stat-card overflow-hidden">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-foreground">Flux d'argent</h3>
                    <p className="text-xs text-muted-foreground">
                      Entrées vs Sorties — {reportPeriodMode === "month" ? "Par jour" : reportPeriodMode === "day" ? "Par heure" : "Par jour"}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-green-500"></div>
                      <span className="text-muted-foreground">Entrées</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500"></div>
                      <span className="text-muted-foreground">Sorties</span>
                    </div>
                  </div>
                </div>
                <div className="h-[240px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderRadius: "12px",
                          border: "1px solid hsl(var(--border))",
                          boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        }}
                      />
                      <Bar dataKey="entrees" fill="#22c55e" radius={[4, 4, 0, 0]} name="Entrées" />
                      <Bar dataKey="sorties" fill="#ef4444" radius={[4, 4, 0, 0]} name="Sorties" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Calendrier mensuel */}
              {reportPeriodMode === "month" && (
                <div className="stat-card">
                  <h3 className="font-bold text-foreground mb-4">Calendrier — {formatMonthYear(reportMonthYear.year, reportMonthYear.month)}</h3>
                  <div className="grid grid-cols-7 gap-1">
                    {['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'].map(d => (
                      <div key={d} className="text-center text-[10px] font-black uppercase text-muted-foreground py-2">
                        {d}
                      </div>
                    ))}
                    {Array.from({ length: getFirstDayOfMonth(reportMonthYear.year, reportMonthYear.month) }).map((_, i) => (
                      <div key={`empty-${i}`} className="aspect-square"></div>
                    ))}
                    {Array.from({ length: getDaysInMonth(reportMonthYear.year, reportMonthYear.month) }).map((_, i) => {
                      const day = i + 1;
                      const dayInfo = calendarDayData[day];
                      const isSelected = reportSelectedDay === day;
                      const hasData = !!dayInfo && dayInfo.count > 0;

                      return (
                        <button
                          key={day}
                          onClick={() => setReportSelectedDay(isSelected ? null : day)}
                          className={`aspect-square rounded-xl border p-1 flex flex-col items-center justify-center gap-0.5 transition-all ${isSelected
                            ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                            : hasData
                              ? "border-border hover:border-primary/40 hover:bg-primary/5"
                              : "border-transparent hover:border-border/50"
                            }`}
                        >
                          <span className={`text-xs font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>{day}</span>
                          {hasData && (
                            <>
                              <span className="text-[8px] font-bold text-green-500 leading-none">
                                +{formatCurrency(dayInfo.entree).replace('Ar', '').trim()}
                              </span>
                              <span className="text-[8px] font-bold text-red-500 leading-none">
                                -{formatCurrency(dayInfo.sortie).replace('Ar', '').trim()}
                              </span>
                            </>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Détail du jour sélectionné (calendrier) */}
              {reportPeriodMode === "month" && reportSelectedDay !== null && selectedDayData.length > 0 && (
                <div className="stat-card border-primary/20">
                  <h3 className="font-bold text-foreground mb-4">
                    Détail du {reportSelectedDay} {formatMonthYear(reportMonthYear.year, reportMonthYear.month)}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="p-3 text-[10px] font-black uppercase text-muted-foreground">Heure</th>
                          <th className="p-3 text-[10px] font-black uppercase text-muted-foreground">Type</th>
                          <th className="p-3 text-[10px] font-black uppercase text-muted-foreground">Désignation</th>
                          <th className="p-3 text-[10px] font-black uppercase text-muted-foreground text-right">Entrée</th>
                          <th className="p-3 text-[10px] font-black uppercase text-muted-foreground text-right">Sortie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {selectedDayData.map((r, idx) => (
                          <tr key={idx} className="hover:bg-primary/5 transition-colors">
                            <td className="p-3 text-xs font-bold text-muted-foreground">
                              {r.date.split('T')[1]?.substring(0, 5) || '--:--'}
                            </td>
                            <td className="p-3 text-xs font-bold text-foreground">{r.type}</td>
                            <td className="p-3 text-xs text-foreground">{r.designation}</td>
                            <td className="p-3 text-xs font-bold text-green-500 text-right">
                              {r.entree > 0 ? formatCurrency(r.entree) : '-'}
                            </td>
                            <td className="p-3 text-xs font-bold text-red-500 text-right">
                              {r.sortie > 0 ? formatCurrency(r.sortie) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tableau récapitulatif des transactions */}
              <div className="stat-card">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-foreground">Transactions détaillées</h3>
                  <span className="text-xs font-bold text-muted-foreground uppercase">
                    {reportData.length} opération{reportData.length > 1 ? 's' : ''}
                  </span>
                </div>

                {reportData.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
                        <tr>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Date</th>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Type</th>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Désignation</th>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Détail</th>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border text-right">Entrée</th>
                          <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border text-right">Sortie</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {reportData.map((r, idx) => (
                          <tr key={idx} className="hover:bg-primary/5 transition-colors group">
                            <td className="p-4 text-xs font-bold text-muted-foreground whitespace-nowrap">
                              {r.date.replace('T', ' ')}
                            </td>
                            <td className="p-4 text-xs font-bold text-foreground">{r.type}</td>
                            <td className="p-4 text-xs text-foreground">{r.designation}</td>
                            <td className="p-4 text-xs text-muted-foreground">{r.detail}</td>
                            <td className="p-4 text-xs font-bold text-green-500 text-right">
                              {r.entree > 0 ? formatCurrency(r.entree) : '-'}
                            </td>
                            <td className="p-4 text-xs font-bold text-red-500 text-right">
                              {r.sortie > 0 ? formatCurrency(r.sortie) : '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="text-center py-12 opacity-40">
                    <Calendar size={48} className="mx-auto mb-3" />
                    <p className="text-sm font-bold">Aucune transaction pour cette période</p>
                  </div>
                )}

                {/* Totaux */}
                {reportData.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-border grid grid-cols-3 gap-4">
                    <div className="text-center p-3 bg-green-500/5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-green-600">Total Entrées</p>
                      <p className="text-lg font-black text-green-600">
                        {formatCurrency(reportData.reduce((s, r) => s + r.entree, 0))}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-red-500/5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-red-600">Total Sorties</p>
                      <p className="text-lg font-black text-red-600">
                        {formatCurrency(reportData.reduce((s, r) => s + r.sortie, 0))}
                      </p>
                    </div>
                    <div className="text-center p-3 bg-primary/5 rounded-xl">
                      <p className="text-[10px] font-bold uppercase text-primary">Solde</p>
                      <p className="text-lg font-black text-primary">
                        {formatCurrency(reportData.reduce((s, r) => s + r.entree - r.sortie, 0))}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Détail (Compostition des chiffres) ──────────────── */}
      {activeDetail && (
        <div className="fixed inset-0 z-[10000] h-full flex items-center justify-center bg-black/40 backdrop-blur-md p-0 sm:p-4 animate-in zoom-in !mt-0">
          <div className="bg-card w-full max-w-4xl h-full sm:h-auto rounded-md sm:rounded-2xl border border-primary/20 flex flex-col max-h-none sm:max-h-[85vh]">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/30">
              <div>
                <h2 className="text-xl font-black flex items-center gap-2 text-foreground">
                  {activeDetail.title}
                </h2>
                <p className="text-xs text-muted-foreground uppercase font-bold tracking-widest mt-1">
                  Composition du montant
                </p>
              </div>

              {/* Barre de recherche uniquement */}
              <div className="flex-1 max-w-md mx-6 hidden md:block">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou désignation..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-background border border-border rounded-xl pl-10 pr-10 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all shadow-sm hover:border-primary/30"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 hover:bg-muted rounded-full transition-colors"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              <button
                onClick={handleCloseDetailModal}
                className="p-2 hover:bg-destructive/10 hover:text-destructive rounded-full transition-all"
              >
                <X size={24} />
              </button>
            </div>

            {/* Barre de recherche uniquement (Mobile) */}
            <div className="p-4 border-b border-border bg-muted/10 md:hidden">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                <input
                  type="text"
                  placeholder="Rechercher..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-background border border-border rounded-xl pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
                {searchTerm && (
                  <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2">
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>

            <div className="p-0 overflow-y-auto">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-muted/90 backdrop-blur-md z-10">
                  <tr>
                    <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Date</th>
                    <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Désignation</th>
                    <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border">Détails</th>
                    <th className="p-4 text-[10px] font-black uppercase text-muted-foreground border-b border-border text-right">Montant</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {filteredDetailData.length > 0 ? (
                    filteredDetailData.map((item, idx) => (
                      <tr key={idx} className="hover:bg-primary/5 transition-colors group">
                        <td className="p-4 text-xs font-bold text-muted-foreground whitespace-nowrap">
                          {formatDate((item as any).date)}
                        </td>
                        <td className="p-4">
                          <p className="text-sm font-black text-foreground">
                            {(item as any).memberName || (item as any).productName || 'Charge/Divers'}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {activeDetail.type === 'payments' ? ((item as any).subscription || 'Abonnement') : `Type: ${(item as any).type}`}
                          </p>
                        </td>
                        <td className="p-4 text-xs font-bold text-muted-foreground">
                          {activeDetail.type === 'payments' ? (item as any).method : `${(item as any).quantity || 1} x ${formatCurrency((item as any).unitPrice)}`}
                        </td>
                        <td className="p-4 text-sm font-black text-primary text-right group-hover:scale-110 transition-transform origin-right">
                          {formatCurrency((item as any).amount)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="p-12 text-center text-muted-foreground">
                        <div className="flex flex-col items-center gap-2 opacity-50">
                          <Search size={40} className="mb-2" />
                          <p className="font-bold">Aucun résultat trouvé</p>
                          <p className="text-xs">Essayez d'autres mots-clés ou vérifiez l'orthographe.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="p-6 border-t border-border bg-muted/30 flex justify-between items-center">
              <span className="text-xs font-bold text-muted-foreground uppercase">Total calculé ({filteredDetailData.length})</span>
              <div className="text-right">
                {searchTerm && (
                  <p className="text-[9px] text-muted-foreground uppercase font-black mb-1">Sur les résultats filtrés</p>
                )}
                <span className="text-2xl font-black text-primary">
                  {formatCurrency(filteredDetailData.reduce((sum, item) => sum + ((item as any).amount || 0), 0))}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenu : admin uniquement */}
        {isAdmin && (
          <StatCard
            icon={DollarSign}
            label="Chiffres d'Affaires"
            value={formatCurrency(stats.totalRevenue ?? 0)}
            trend={stats.revenueDiff}
            trendSuffix="%"
          />
        )}
        <StatCard
          icon={UserCheck}
          label="Membres actifs"
          value={String(stats.activeMembers ?? 0)}
          trend={stats.membersDiff}
          trendSuffix=""
        />
        <StatCard
          icon={Activity}
          label="Fréquentation"
          value={String(stats.totalAttendance ?? 0)}
          trend={stats.attendanceDiff}
          trendSuffix="%"
        />
        <StatCard
          icon={TrendingUp}
          label="Taux de rétention"
          value={`${stats.retentionRate ?? 0}%`}
          trend={2}
          trendSuffix="%"
        />
      </div>

      {/* ── Graphique revenus + alertes (admin uniquement) ─────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Graphique */}
          <div className="xl:col-span-2 stat-card overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="font-bold text-foreground">Revenus mensuels</h3>
                <p className="text-xs text-muted-foreground">
                  Abonnements + Ventes produits — 6 derniers mois
                </p>
              </div>
              <div className="p-2 bg-primary/10 rounded-lg">
                <TrendingUp size={16} className="text-primary" />
              </div>
            </div>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats.monthlyData ?? []}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                                      <YAxis
                    yAxisId="left"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                    tickFormatter={(v) =>
                      v >= 1_000_000
                        ? `${(v / 1_000_000).toFixed(1)}M`
                        : v >= 1000
                          ? `${(v / 1000).toFixed(0)}k`
                          : String(v)
                    }
                  />
                  <YAxis
                    yAxisId="right"
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderRadius: "12px",
                      border: "1px solid hsl(var(--border))",
                      boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                    }}
                  />
                  <Area
                    yAxisId="left"
                    type="monotone"
                    dataKey="revenue"
                    stroke="hsl(var(--primary))"
                    strokeWidth={3}
                    fillOpacity={1}
                    fill="url(#colorRev)"
                    name="Revenus (Ar)"
                  />
                  <Area
                    yAxisId="right"
                    type="monotone"
                    dataKey="attendance"
                    stroke="#8884d8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#colorAtt)"
                    name="Passages"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Alertes */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Alertes & Rappels</h3>
              <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded-full">
                {stats.unreadNotifications ?? 0} NEW
              </span>
            </div>
            <div className="space-y-4">
              {(stats.expiredMembers ?? 0) > 0 ? (
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <p className="text-sm font-semibold text-foreground">Abonnements expirés</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.expiredMembers} membre{(stats.expiredMembers ?? 0) > 1 ? "s" : ""} avec abonnement expiré.
                  </p>
                </div>
              ) : (
                <div className="text-center py-10 opacity-30">
                  <Bell size={40} className="mx-auto mb-2" />
                  <p className="text-xs font-bold uppercase">Aucune alerte</p>
                </div>
              )}
              <div className="pt-4 border-t border-border">
                <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-3">
                  Occupations LIVE
                </h4>
                <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <Users className="text-primary" size={20} />
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {stats.inGymNow ?? 0} Personne{(stats.inGymNow ?? 0) > 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Présents en salle</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sections réceptionniste (non-admin) ────────────────────────────── */}
      {!isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* Présents en salle */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Présents en salle</h3>
            </div>
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <Users className="text-primary w-10 h-10" />
              <div>
                <p className="text-4xl font-black text-foreground">{stats.inGymNow ?? 0}</p>
                <p className="text-sm text-muted-foreground">personnes actuellement</p>
              </div>
            </div>
            {(stats.expiredMembers ?? 0) > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm font-semibold text-amber-600">
                  ⚠ {stats.expiredMembers} abonnement{(stats.expiredMembers ?? 0) > 1 ? "s" : ""} expiré{(stats.expiredMembers ?? 0) > 1 ? "s" : ""}
                </p>
              </div>
            )}
          </div>

          {/* Membres */}
          <div className="stat-card">
            <h3 className="font-bold text-foreground mb-4">Membres</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Actifs</span>
                <span className="font-black text-foreground">{stats.activeMembers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Expirés</span>
                <span className="font-black text-destructive">{stats.expiredMembers ?? 0}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Fréquentation totale</span>
                <span className="font-black text-foreground">{stats.totalAttendance ?? 0}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sections communes ──────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
        {/* Derniers paiements : admin uniquement */}
        {isAdmin && (
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">Derniers paiements</h3>
            </div>
            <div className="space-y-3">
              {(stats.recentPayments ?? []).length > 0 ? (
                (stats.recentPayments ?? []).map((payment) => (
                  <div
                    key={payment.id}
                    className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                        <TrendingUp size={14} />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-foreground">
                          {payment.memberName || "Membre"}
                        </p>
                        <p className="text-[10px] text-muted-foreground uppercase">
                          {formatDate(payment.date)} · {payment.method}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm font-black text-primary">
                      {formatCurrency(payment.amount)}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-center py-6 text-sm text-muted-foreground italic">
                  Aucun paiement récent
                </p>
              )}
            </div>
          </div>
        )}

        {/* Accès récents */}
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Accès récents</h3>
          </div>
          <div className="space-y-3">
            {(stats.recentAttendance ?? []).length > 0 ? (
              (stats.recentAttendance ?? []).map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <UserCheck size={14} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {a.memberName || "Membre"}
                      </p>
                      <p className="text-[10px] text-muted-foreground uppercase">
                        {a.rfidCard || "Badge RFID"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">
                      {formatTime(a.checkIn)}
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {formatDate(a.date)}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-center py-6 text-sm text-muted-foreground italic">
                Aucun accès récent
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Modal Confirmation Reset ───────────────────────────────────────── */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in !mt-0">
          <div className="bg-card w-full max-w-md rounded-2xl shadow-xl border border-border p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-destructive/10 rounded-full">
                <RotateCcw size={20} className="text-destructive" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Confirmer l'effacement</h3>
                <p className="text-xs text-muted-foreground">Caisse 1 — Action irréversible</p>
              </div>
            </div>
            
            <p className="text-sm text-muted-foreground leading-relaxed">
              Vous êtes sur le point de masquer tous les mois précédents pour la Caisse 1. 
              Seul le mois en cours restera visible.
            </p>

            <div className="flex gap-3 justify-end pt-2">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold text-foreground hover:bg-muted transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={confirmReset}
                disabled={createResetMutation.isPending}
                className="px-4 py-2.5 rounded-xl bg-destructive text-destructive-foreground text-sm font-semibold hover:bg-destructive/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                {createResetMutation.isPending ? "Effacement..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANT : CASHIER CARDS (DÉTAIL CAISSE)
   ═══════════════════════════════════════════════════════════════════════════ */
function CashierCards({
  title,
  stats,
  isAdmin = false,
  onDetail,
}: {
  title: string;
  stats: ReturnType<typeof computeCashierCAStats>;
  isAdmin?: boolean;
  onDetail: (title: string, type: 'payments' | 'transactions', data: any[]) => void;
}) {
  const { caTotal, subscriptionTotal, sortiesTotal, depensesTotal, achatsTotal, entriesTotal, resultat, productMap } = stats;

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-6 bg-primary rounded-full"></div>
          <h2 className="text-sm font-black uppercase tracking-wide text-foreground">{title}</h2>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {/* Ligne Revenus */}
        <StatCard
          icon={Wallet}
          label="Chiffre d'affaires"
          value={formatCurrency(caTotal)}
          sub="Abonnements + ventes"
          className="sm:col-span-2 md:col-span-1 bg-success/5 border-success/20 hover:border-success/50"
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
          onClick={() => {
            onDetail("Chiffre d'Affaires Global", 'payments', [
              ...stats.items.payments,
              ...stats.items.sorties.map(s => {
                const pId = extractIdFromIri(s.product);
                const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
                return { ...s, amount: (s.quantity || 0) * (s.unitPrice || 0), memberName: pName || 'Vente produit' };
              })
            ]);
          }}
        />
        <StatCard
          icon={Receipt}
          label="Abonnements"
          value={formatCurrency(subscriptionTotal)}
          sub="Paiements validés"
          className=""
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
          onClick={() => onDetail("Détails Abonnements", 'payments', stats.items.payments)}
        />
        <StatCard
          icon={TrendingUp}
          label="Sorties"
          value={formatCurrency(sortiesTotal)}
          sub="Ventes produits"
          className=""
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
          onClick={() => {
            onDetail("Détails Sorties (Ventes)", 'transactions', stats.items.sorties.map(s => {
              const pId = extractIdFromIri(s.product);
              const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
              return { ...s, amount: (s.quantity || 0) * (s.unitPrice || 0), productName: pName || 'Vente produit' };
            }));
          }}
        />

        {/* Ligne Dépenses — visible par tous */}
        <StatCard
          icon={TrendingDown}
          label="Total dépenses"
          value={formatCurrency(depensesTotal)}
          sub="Achats + charges"
          className="sm:col-span-2 md:col-span-1 bg-destructive/5 border-destructive/20 hover:border-destructive/50"
          iconColorClass="text-destructive"
          iconBgClass="bg-destructive/10 group-hover:bg-destructive"
          onClick={() => {
            onDetail("Total Dépenses", 'transactions', stats.items.depenses.map(s => {
              const pId = extractIdFromIri(s.product);
              const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
              return { ...s, amount: (s.quantity || 0) * (s.unitPrice || 0), productName: pName || 'Charge/Divers' };
            }));
          }}
        />

        {/* Détail dépenses — admin uniquement */}
        {isAdmin && (
          <>
            <StatCard
              icon={Package}
              label="Coût d'achats"
              value={formatCurrency(achatsTotal)}
              sub="Valeur purchasePrice"
              className=""
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
              onClick={() => {
                onDetail("Coût des Achats", 'transactions', stats.items.achats.map(s => {
                  const pId = extractIdFromIri(s.product);
                  const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
                  const pPurchase = pId ? (productMap as any)[pId]?.purchasePrice : (typeof s.product === 'object' ? (s.product as any)?.purchasePrice : s.unitPrice);
                  return { ...s, amount: (s.quantity || 0) * (pPurchase || 0), productName: pName || 'Coût produit' };
                }));
              }}
            />
            <StatCard
              icon={Activity}
              label="Charges/Entrées"
              value={formatCurrency(entriesTotal)}
              sub="Dépenses directes"
              className=""
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
              onClick={() => {
                onDetail("Détails Entrées & Charges", 'transactions', stats.items.entries.map(s => {
                  const pId = extractIdFromIri(s.product);
                  const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
                  return { ...s, amount: (s.quantity || 0) * (s.unitPrice || 0), productName: pName || 'Charge Directe' };
                }));
              }}
            />
          </>
        )}

        {/* Ligne Résultat — visible par tous */}
        <StatCard
          icon={Calculator}
          label="Résultat Net"
          value={formatCurrency(resultat)}
          sub="Bénéfice calculé"
          className={`${isAdmin ? "sm:col-span-2 md:col-span-3" : "sm:col-span-2 md:col-span-2"} bg-gradient-to-r from-primary/10 via-accent/5 to-background border-primary/30 shadow-sm hover:shadow-md`}
          iconColorClass={resultat >= 0 ? "text-success" : "text-destructive"}
          iconBgClass={resultat >= 0 ? "bg-success/10 group-hover:bg-success" : "bg-destructive/10 group-hover:bg-destructive"}
        />
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SOUS-COMPOSANT : STAT CARD (RÉUTILISABLE)
   ═══════════════════════════════════════════════════════════════════════════ */
function StatCard({
  icon: Icon, label, value, trend, trendSuffix = "%", sub = "vs mois précédent",
  className = "",
  iconColorClass = "text-primary",
  iconBgClass = "bg-primary/10 group-hover:bg-primary",
  onClick,
}: {
  icon: any;
  label: string;
  value: string;
  trend?: number;
  trendSuffix?: string;
  sub?: string;
  className?: string;
  iconColorClass?: string;
  iconBgClass?: string;
  onClick?: () => void;
}) {
  const isPositive = trend !== undefined && trend > 0;
  return (
    <div
      className={`stat-card group hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ${onClick ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      <div className="flex justify-between items-start mb-3">
        <div className={`p-2.5 rounded-xl transition-all duration-300 ${iconBgClass}`}>
          <Icon size={20} className={`${iconColorClass} group-hover:text-white transition-colors`} />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${isPositive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
            }`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? "+" : ""}{trend}{trendSuffix}
          </div>
        )}
      </div>
      <div>
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-2xl font-black text-foreground mt-1 tabular-nums tracking-tight">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-2 font-medium">{sub}</p>
      </div>
    </div>
  );
}