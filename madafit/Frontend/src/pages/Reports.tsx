import { useMemo, useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  Download,
  FileText,
  Users,
  CreditCard,
  Package,
  AlertTriangle,
  Clock,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/services/api";
import {
  extractHydraMembers,
  formatCurrency,
  extractIdFromIri,
} from "@/lib/madafit";
import type {
  User,
  UserSubscription,
  SubscriptionPlan,
  Payment,
  Transaction,
  Product,
  AttendanceRecord,
} from "@/types/entities";

// ═══════════════════════════════════════════════════════════════════════════
// OPTIONS COMMUNES REACT QUERY (alignées avec Subscriptions.tsx)
// ═══════════════════════════════════════════════════════════════════════════

const COMMON_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  placeholderData: (previousData: any) => previousData,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// TYPES LOCAUX
// ═══════════════════════════════════════════════════════════════════════════

type Period = "6months" | "3months" | "year";

interface MonthlyRevenue {
  month: string;
  label: string;
  subscriptions: number;
  products: number;
  total: number;
}

interface HourlyAttendance {
  hour: string;
  label: string;
  visits: number;
}

interface CohortData {
  cohortMonth: string;
  month0: number;
  month1: number;
  month2: number;
  month3: number;
  month6: number;
  month12: number;
  churnRate: number;
}

interface TopProduct {
  id: number;
  name: string;
  category: string;
  revenue: number;
  margin: number;
  salesCount: number;
}

interface AlertItem {
  type: "expiry" | "inactive" | "stock" | "credit";
  severity: "high" | "medium" | "low";
  message: string;
  detail: string;
  count?: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// COULEURS DU THEME
// ═══════════════════════════════════════════════════════════════════════════

const THEME = {
  primary: "hsl(var(--primary))",
  accent: "hsl(var(--accent))",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  muted: "hsl(var(--muted-foreground))",
  border: "hsl(var(--border))",
  card: "hsl(var(--card))",
  foreground: "hsl(var(--foreground))",
};

const PIE_COLORS = [THEME.primary, THEME.accent, THEME.success];

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DE CALCUL
// ═══════════════════════════════════════════════════════════════════════════

function getMonthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getMonthLabel(date: Date): string {
  return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function diffInMonths(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function isSameMonth(d1: Date, d2: Date): boolean {
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth();
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export default function Report() {
  const [period, setPeriod] = useState<Period>("6months");

  // ── Refs pour export PDF ───────────────────────────────────────────────
  const revenueChartRef = useRef<HTMLDivElement>(null);
  const hourlyChartRef = useRef<HTMLDivElement>(null);
  const cohortTableRef = useRef<HTMLDivElement>(null);
  const revenuePieRef = useRef<HTMLDivElement>(null);

  // ── Queries avec options communes unifiées ─────────────────────────────
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["user-subscriptions"],
    queryFn: () => api.userSubscriptions.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.transactions.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 1000 }),
    ...COMMON_QUERY_OPTIONS,
  });

  // ── Extraction des données ─────────────────────────────────────────────
  const users = extractHydraMembers(usersQuery.data) as User[];
  const subscriptions = extractHydraMembers(subscriptionsQuery.data) as UserSubscription[];
  const plans = extractHydraMembers(plansQuery.data) as SubscriptionPlan[];
  const payments = extractHydraMembers(paymentsQuery.data) as Payment[];
  const transactions = extractHydraMembers(transactionsQuery.data) as Transaction[];
  const products = extractHydraMembers(productsQuery.data) as Product[];
  const attendance = extractHydraMembers(attendanceQuery.data) as AttendanceRecord[];

  // ── Map des plans pour lookup rapide ─────────────────────────────────
  const planMap = useMemo(() => {
    const map: Record<string, SubscriptionPlan> = {};
    plans.forEach((p) => {
      map[p.name] = p;
    });
    return map;
  }, [plans]);

  // ═══════════════════════════════════════════════════════════════════════
  // CALCULS DES INDICATEURS
  // ═══════════════════════════════════════════════════════════════════════

  const now = new Date();

  // ── MRR (Revenu Recurrent Mensuel) ─────────────────────────────────────
  const mrr = useMemo(() => {
    return subscriptions
      .filter((sub) => sub.status === "active")
      .reduce((sum, sub) => {
        const plan = planMap[sub.planName];
        return sum + (plan?.price || 0);
      }, 0);
  }, [subscriptions, planMap]);

  // ── MRR mois precedent (pour tendance) ─────────────────────────────────
  const mrrPrev = useMemo(() => {
    const firstDayPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    
    return subscriptions
      .filter((sub) => {
        const start = sub.startDate ? new Date(sub.startDate) : null;
        const expiry = sub.expiryDate ? new Date(sub.expiryDate) : null;
        if (!start || !expiry) return false;
        return start <= lastDayPrevMonth && expiry >= firstDayPrevMonth;
      })
      .reduce((sum, sub) => {
        const plan = planMap[sub.planName];
        return sum + (plan?.price || 0);
      }, 0);
  }, [subscriptions, planMap, now]);

  const mrrTrend = mrrPrev > 0 ? ((mrr - mrrPrev) / mrrPrev) * 100 : 0;

  // ── Membres actifs ─────────────────────────────────────────────────────
  const activeMembers = useMemo(() => {
    return users.filter(
      (u) =>
        u.status === "active" ||
        (u.userSubscriptions?.some((s) => s.status === "active") ?? false)
    ).length;
  }, [users]);

  // ── Nouveaux ce mois ────────────────────────────────────────────────────
  const newThisMonth = useMemo(() => {
    return users.filter((u) => {
      if (!u.joinDate) return false;
      return isSameMonth(new Date(u.joinDate), now);
    }).length;
  }, [users, now]);

  // ── Panier moyen ───────────────────────────────────────────────────────
  const avgBasket = useMemo(() => {
    const monthCount = period === "3months" ? 3 : period === "6months" ? 6 : 12;
    const periodStartDate = addMonths(now, -monthCount);
    
    const periodPayments = payments.filter((p) => {
      if (!p.date) return false;
      return new Date(p.date) >= periodStartDate;
    });
    
    const periodTransactions = transactions.filter((t) => {
      if (!t.date || t.type !== "sale") return false;
      return new Date(t.date) >= periodStartDate;
    });
    
    const totalRevenue =
      periodPayments.reduce((s, p) => s + (p.amount || 0), 0) +
      periodTransactions.reduce((s, t) => s + (t.quantity || 0) * (t.unitPrice || 0), 0);
    
    return activeMembers > 0 ? totalRevenue / activeMembers : 0;
  }, [payments, transactions, activeMembers, period, now]);

  // ── Panier moyen periode precedente ──────────────────────────────────────
  const avgBasketPrev = useMemo(() => {
    const monthCount = period === "3months" ? 3 : period === "6months" ? 6 : 12;
    const prevPeriodStart = addMonths(now, -monthCount * 2);
    const prevPeriodEnd = addMonths(now, -monthCount);
    
    const prevPayments = payments.filter((p) => {
      if (!p.date) return false;
      const d = new Date(p.date);
      return d >= prevPeriodStart && d < prevPeriodEnd;
    });
    
    const prevTransactions = transactions.filter((t) => {
      if (!t.date || t.type !== "sale") return false;
      const d = new Date(t.date);
      return d >= prevPeriodStart && d < prevPeriodEnd;
    });
    
    const prevRevenue =
      prevPayments.reduce((s, p) => s + (p.amount || 0), 0) +
      prevTransactions.reduce((s, t) => s + (t.quantity || 0) * (t.unitPrice || 0), 0);
    
    const prevActive = users.filter((u) => {
      if (!u.joinDate) return false;
      return new Date(u.joinDate) <= prevPeriodEnd;
    }).length;
    
    return prevActive > 0 ? prevRevenue / prevActive : 0;
  }, [payments, transactions, users, period, now]);

  const basketTrend = avgBasketPrev > 0 ? ((avgBasket - avgBasketPrev) / avgBasketPrev) * 100 : 0;

  // ── Churn cohorte ──────────────────────────────────────────────────────
  const churnRate = useMemo(() => {
    const cohorts: Record<string, { total: number; active: number }> = {};
    subscriptions.forEach((sub) => {
      if (!sub.startDate) return;
      const cohortKey = getMonthKey(new Date(sub.startDate));
      if (!cohorts[cohortKey]) cohorts[cohortKey] = { total: 0, active: 0 };
      cohorts[cohortKey].total += 1;
      if (sub.status === "active") cohorts[cohortKey].active += 1;
    });
    
    const cohortEntries = Object.values(cohorts);
    if (cohortEntries.length === 0) return 0;
    
    const totalMembers = cohortEntries.reduce((s, c) => s + c.total, 0);
    const totalActive = cohortEntries.reduce((s, c) => s + c.active, 0);
    
    return totalMembers > 0 ? ((totalMembers - totalActive) / totalMembers) * 100 : 0;
  }, [subscriptions]);

  // ═══════════════════════════════════════════════════════════════════════
  // DONNEES DES GRAPHIQUES
  // ═══════════════════════════════════════════════════════════════════════

  // ── Revenus mensuels ───────────────────────────────────────────────────
  const monthlyRevenue = useMemo((): MonthlyRevenue[] => {
    const months: MonthlyRevenue[] = [];
    const monthCount = period === "3months" ? 3 : period === "6months" ? 6 : 12;
    for (let i = monthCount - 1; i >= 0; i--) {
      const d = addMonths(now, -i);
      const key = getMonthKey(d);
      months.push({
        month: key,
        label: getMonthLabel(d),
        subscriptions: 0,
        products: 0,
        total: 0,
      });
    }

    payments.forEach((p) => {
      if (!p.date) return;
      const pKey = p.date.substring(0, 7);
      const entry = months.find((m) => m.month === pKey);
      if (entry) entry.subscriptions += p.amount || 0;
    });

    transactions.forEach((t) => {
      if (!t.date || t.type !== "sale") return;
      const tKey = t.date.substring(0, 7);
      const entry = months.find((m) => m.month === tKey);
      if (entry) entry.products += (t.quantity || 0) * (t.unitPrice || 0);
    });

    months.forEach((m) => {
      m.total = m.subscriptions + m.products;
    });

    return months;
  }, [payments, transactions, period, now]);

  // ── Heures de pointe ───────────────────────────────────────────────────
  const hourlyAttendance = useMemo((): HourlyAttendance[] => {
    const hours: Record<number, number> = {};
    for (let h = 6; h <= 22; h++) hours[h] = 0;

    attendance.forEach((a) => {
      if (!a.checkIn) return;
      const timePart = a.checkIn.includes("T") 
        ? a.checkIn.split("T")[1] 
        : a.checkIn;
      const hour = parseInt(timePart.split(":")[0]);
      if (hour >= 6 && hour <= 22) hours[hour] += 1;
    });

    return Object.entries(hours).map(([h, visits]) => ({
      hour: `${h}h`,
      label: `${h}h-${parseInt(h) + 1}h`,
      visits,
    }));
  }, [attendance]);

  // ── Donnees cohortes ─────────────────────────────────────────────────────
  const cohortData = useMemo((): CohortData[] => {
    const cohorts: Record<string, UserSubscription[]> = {};
    subscriptions.forEach((sub) => {
      if (!sub.startDate) return;
      const key = getMonthKey(new Date(sub.startDate));
      if (!cohorts[key]) cohorts[key] = [];
      cohorts[key].push(sub);
    });

    return Object.entries(cohorts)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6)
      .map(([cohortMonth, subs]) => {
        const total = subs.length;
        const active = subs.filter((s) => s.status === "active").length;
        const churn = total > 0 ? ((total - active) / total) * 100 : 0;

        const cohortDate = new Date(cohortMonth + "-01");
        const nowDate = new Date();

        const getRetentionAt = (monthsElapsed: number): number => {
          const targetDate = addMonths(cohortDate, monthsElapsed);
          if (targetDate > nowDate) return -1;
          const stillActive = subs.filter((s) => {
            if (!s.expiryDate) return false;
            return new Date(s.expiryDate) >= targetDate;
          }).length;
          return total > 0 ? Math.round((stillActive / total) * 100) : 0;
        };

        return {
          cohortMonth: new Date(cohortMonth + "-01").toLocaleDateString("fr-FR", {
            month: "short",
            year: "2-digit",
          }),
          month0: 100,
          month1: getRetentionAt(1),
          month2: getRetentionAt(2),
          month3: getRetentionAt(3),
          month6: getRetentionAt(6),
          month12: getRetentionAt(12),
          churnRate: Math.round(churn),
        };
      });
  }, [subscriptions]);

  // ── Top produits ─────────────────────────────────────────────────────────
  const topProducts = useMemo((): TopProduct[] => {
    const productStats: Record<number, { revenue: number; margin: number; count: number }> = {};
    transactions
      .filter((t) => t.type === "sale")
      .forEach((t) => {
        const pId = extractIdFromIri(t.product);
        if (!pId) return;
        const product = products.find((p) => String(p.id) === pId);
        if (!product) return;
        const revenue = (t.quantity || 0) * (t.unitPrice || product.salePrice);
        const cost = (t.quantity || 0) * product.purchasePrice;
        if (!productStats[product.id!]) {
          productStats[product.id!] = { revenue: 0, margin: 0, count: 0 };
        }
        productStats[product.id!].revenue += revenue;
        productStats[product.id!].margin += revenue - cost;
        productStats[product.id!].count += t.quantity || 0;
      });

    return Object.entries(productStats)
      .map(([id, stats]) => {
        const product = products.find((p) => p.id === Number(id));
        if (!product) return null;
        return {
          id: product.id!,
          name: product.name,
          category: product.category,
          revenue: stats.revenue,
          margin: stats.margin,
          salesCount: stats.count,
        };
      })
      .filter(Boolean)
      .sort((a, b) => (b?.revenue || 0) - (a?.revenue || 0))
      .slice(0, 5) as TopProduct[];
  }, [transactions, products]);

  // ── Repartition revenus (donut) ──────────────────────────────────────────
  const revenueSplit = useMemo(() => {
    const subRevenue = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const prodRevenue = transactions
      .filter((t) => t.type === "sale")
      .reduce((s, t) => s + (t.quantity || 0) * (t.unitPrice || 0), 0);
    const total = subRevenue + prodRevenue;
    return [
      { name: "Abonnements", value: subRevenue, percentage: total > 0 ? (subRevenue / total) * 100 : 0 },
      { name: "Produits", value: prodRevenue, percentage: total > 0 ? (prodRevenue / total) * 100 : 0 },
    ];
  }, [payments, transactions]);

  // ── Alertes ──────────────────────────────────────────────────────────────
  const alerts = useMemo((): AlertItem[] => {
    const items: AlertItem[] = [];

    const in7Days = new Date();
    in7Days.setDate(in7Days.getDate() + 7);
    const expiringSoon = subscriptions.filter((sub) => {
      if (!sub.expiryDate || sub.status !== "active") return false;
      const expiry = new Date(sub.expiryDate);
      return expiry <= in7Days && expiry >= now;
    });
    if (expiringSoon.length > 0) {
      items.push({
        type: "expiry",
        severity: "high",
        message: "Abonnements expirant bientot",
        detail: `${expiringSoon.length} membre(s) concerne(s)`,
        count: expiringSoon.length,
      });
    }

    const inactive30 = users.filter((u) => {
      if (!u.lastVisit) return false;
      const lastVisit = new Date(u.lastVisit);
      const daysDiff = (now.getTime() - lastVisit.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff > 30 && (u.status === "active" || u.userSubscriptions?.some((s) => s.status === "active"));
    });
    if (inactive30.length > 0) {
      items.push({
        type: "inactive",
        severity: "medium",
        message: "Membres inactifs (+30 jours)",
        detail: `${inactive30.length} membre(s) sans passage`,
        count: inactive30.length,
      });
    }

    const lowStock = products.filter((p) => p.currentStock <= 5 && p.currentStock > 0);
    if (lowStock.length > 0) {
      items.push({
        type: "stock",
        severity: "medium",
        message: "Stock faible",
        detail: `${lowStock.length} produit(s) a reapprovisionner`,
        count: lowStock.length,
      });
    }

    const outOfStock = products.filter((p) => p.currentStock === 0);
    if (outOfStock.length > 0) {
      items.push({
        type: "stock",
        severity: "high",
        message: "Rupture de stock",
        detail: `${outOfStock.length} produit(s) en rupture`,
        count: outOfStock.length,
      });
    }

    const unpaidCredits = transactions.filter((t) => t.type === "credit");
    if (unpaidCredits.length > 0) {
      items.push({
        type: "credit",
        severity: "medium",
        message: "Credits impayes",
        detail: `${unpaidCredits.length} transaction(s) a solder`,
        count: unpaidCredits.length,
      });
    }

    return items;
  }, [subscriptions, users, products, transactions, now]);

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT PDF COMPLET
  // ═══════════════════════════════════════════════════════════════════════

  const exportToPDF = useCallback(async () => {
    const pdfExportDate = new Date();
    const pdf = new jsPDF("p", "mm", "a4");
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 15;
    const CW = W - M * 2;
    let y = M;

    // Helper pour nettoyer les accents
    const clean = (str: string): string => {
      return str
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\u00A0/g, " ");
    };

    // Helper pour ecrire du texte propre
    const writeText = (text: string, x: number, lineY: number, options?: { align?: "left" | "center" | "right"; fontSize?: number; font?: string; style?: string; color?: [number, number, number] }) => {
      const opts = options || {};
      const fontSize = opts.fontSize || 10;
      const font = opts.font || "helvetica";
      const style = opts.style || "normal";
      const color = opts.color || [33, 37, 41];
      const align = opts.align || "left";

      pdf.setTextColor(...color);
      pdf.setFontSize(fontSize);
      pdf.setFont(font, style);
      pdf.text(clean(text), x, lineY, { align });
    };

    // Helper pour tracer une ligne
    const drawLine = (fromX: number, fromY: number, toX: number, toY: number, color: [number, number, number] = [222, 226, 230], width: number = 0.3) => {
      pdf.setDrawColor(...color);
      pdf.setLineWidth(width);
      pdf.line(fromX, fromY, toX, toY);
    };

    // Helper pour tracer un rectangle plein
    const fillRect = (x: number, lineY: number, w: number, h: number, color: [number, number, number]) => {
      pdf.setFillColor(...color);
      pdf.rect(x, lineY, w, h, "F");
    };

    // Helper pour tracer un rectangle bordure
    const strokeRect = (x: number, lineY: number, w: number, h: number, color: [number, number, number] = [222, 226, 230], width: number = 0.3) => {
      pdf.setDrawColor(...color);
      pdf.setLineWidth(width);
      pdf.rect(x, lineY, w, h, "S");
    };

    // Couleurs du theme PDF
    const C = {
      primary: [99, 102, 241],
      dark: [15, 23, 42],
      gray: [100, 116, 139],
      lightGray: [241, 245, 249],
      white: [255, 255, 255],
      border: [226, 232, 240],
      green: [34, 197, 94],
      red: [239, 68, 68],
      amber: [245, 158, 11],
      blue: [59, 130, 246],
    };

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 1 : EN-TETE + KPIs + GRAPHIQUES
    // ═════════════════════════════════════════════════════════════════════

    // Fond blanc
    fillRect(0, 0, W, H, C.white);

    // Logo + titre
    fillRect(M, y, 8, 8, C.primary);
    writeText("MADAFIT", M + 12, y + 6, { fontSize: 18, font: "helvetica", style: "bold", color: C.dark });
    writeText("RAPPORT D'ACTIVITE", M + 12, y + 11, { fontSize: 8, color: C.gray });
    writeText(
      `Genere le ${pdfExportDate.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`,
      W - M,
      y + 6,
      { align: "right", fontSize: 8, color: C.gray }
    );
    y += 22;

    // Ligne separateire
    drawLine(M, y, W - M, y, C.border, 0.5);
    y += 10;

    // Periode
    const periodLabel = period === "3months" ? "3 derniers mois" : period === "6months" ? "6 derniers mois" : "12 derniers mois";
    writeText(`Periode analysee : ${periodLabel}`, M, y, { fontSize: 9, color: C.gray, style: "italic" });
    y += 12;

    // Section KPIs
    writeText("INDICATEURS CLES", M, y, { fontSize: 12, font: "helvetica", style: "bold", color: C.dark });
    y += 8;

    const kpiData = [
      { label: "MRR", value: formatCurrency(mrr), trend: `${mrrTrend > 0 ? "+" : ""}${mrrTrend.toFixed(1)}%`, positive: mrrTrend >= 0 },
      { label: "MEMBRES ACTIFS", value: String(activeMembers), trend: `+${newThisMonth} ce mois`, positive: true },
      { label: "PANIER MOYEN", value: formatCurrency(avgBasket), trend: `${basketTrend > 0 ? "+" : ""}${basketTrend.toFixed(1)}%`, positive: basketTrend >= 0 },
      { label: "CHURN COHORTE", value: `${churnRate.toFixed(1)}%`, trend: churnRate > 10 ? "Alerte" : "Stable", positive: churnRate <= 10 },
    ];

    const kpiW = (CW - 9) / 4;
    kpiData.forEach((k, i) => {
      const x = M + i * (kpiW + 3);
      strokeRect(x, y, kpiW, 28, C.border, 0.5);
      fillRect(x, y, kpiW, 6, k.positive ? C.green : C.red);
      writeText(k.label, x + 3, y + 12, { fontSize: 7, color: C.gray, style: "bold" });
      writeText(k.value, x + 3, y + 22, { fontSize: 14, font: "helvetica", style: "bold", color: C.dark });
      writeText(k.trend, x + kpiW - 3, y + 22, { align: "right", fontSize: 8, color: k.positive ? C.green : C.red });
    });
    y += 36;

    // ═════════════════════════════════════════════════════════════════════
    // GRAPHIQUES : captures des elements DOM
    // ═════════════════════════════════════════════════════════════════════

    const captureElement = async (ref: React.RefObject<HTMLDivElement | null>): Promise<string | null> => {
      if (!ref.current) return null;
      const canvas = await html2canvas(ref.current, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
      });
      return canvas.toDataURL("image/png");
    };

    // Revenus mensuels
    const revImg = await captureElement(revenueChartRef);
    if (revImg) {
      writeText("REVENUS MENSUELS", M, y, { fontSize: 11, font: "helvetica", style: "bold", color: C.dark });
      y += 5;
      pdf.addImage(revImg, "PNG", M, y, CW / 2 - 5, 55);
      y += 60;
    }

    // Heures de pointe
    const hourImg = await captureElement(hourlyChartRef);
    if (hourImg) {
      writeText("HEURES DE POINTE", M + CW / 2 + 5, y - 60, { fontSize: 11, font: "helvetica", style: "bold", color: C.dark });
      pdf.addImage(hourImg, "PNG", M + CW / 2 + 5, y - 55, CW / 2 - 5, 55);
    }

    // Repartition revenus
    const pieImg = await captureElement(revenuePieRef);
    if (pieImg) {
      writeText("REPARTITION DES REVENUS", M, y, { fontSize: 11, font: "helvetica", style: "bold", color: C.dark });
      y += 5;
      pdf.addImage(pieImg, "PNG", M, y, CW, 55);
      y += 62;
    }

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 2 : TABLEAU COHORTES
    // ═════════════════════════════════════════════════════════════════════

    pdf.addPage();
    fillRect(0, 0, W, H, C.white);
    y = M;

    writeText("RETENTION PAR COHORTE", M, y, { fontSize: 12, font: "helvetica", style: "bold", color: C.dark });
    y += 10;

    // Tableau cohortes
    const cohortHeaders = ["Cohorte", "M0", "M1", "M2", "M3", "M6", "M12", "Churn"];
    const colW = [0.15, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.13];
    const rowH = 8;

    // En-tete tableau
    fillRect(M, y, CW, rowH, C.primary);
    let cx = M;
    cohortHeaders.forEach((h, i) => {
      const w = colW[i] * CW;
      writeText(h, cx + 2, y + 5.5, { fontSize: 8, color: C.white, style: "bold" });
      cx += w;
    });
    y += rowH;

    // Lignes tableau
    cohortData.forEach((c, idx) => {
      if (idx % 2 === 0) {
        fillRect(M, y, CW, rowH, C.lightGray);
      }
      drawLine(M, y + rowH, M + CW, y + rowH, C.border, 0.2);
      
      const rowValues = [
        c.cohortMonth,
        `${c.month0}%`,
        c.month1 >= 0 ? `${c.month1}%` : "-",
        c.month2 >= 0 ? `${c.month2}%` : "-",
        c.month3 >= 0 ? `${c.month3}%` : "-",
        c.month6 >= 0 ? `${c.month6}%` : "-",
        c.month12 >= 0 ? `${c.month12}%` : "-",
        `${c.churnRate}%`,
      ];

      cx = M;
      rowValues.forEach((cell, i) => {
        const w = colW[i] * CW;
        writeText(String(cell), cx + 2, y + 5.5, { fontSize: 8, color: C.dark });
        cx += w;
      });
      y += rowH;
    });

    strokeRect(M, y - cohortData.length * rowH - rowH, CW, (cohortData.length + 1) * rowH, C.border, 0.5);
    y += 10;

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 3 : TOP PRODUITS + ALERTES + TABLEAU PRODUITS DETAILLE
    // ═════════════════════════════════════════════════════════════════════

    pdf.addPage();
    fillRect(0, 0, W, H, C.white);
    y = M;

    // Top produits
    writeText("TOP PRODUITS", M, y, { fontSize: 12, font: "helvetica", style: "bold", color: C.dark });
    y += 10;

    if (topProducts.length === 0) {
      writeText("Aucune vente enregistree sur cette periode.", M, y, { fontSize: 9, color: C.gray, style: "italic" });
      y += 10;
    } else {
      const prodHeaders = ["Rang", "Produit", "Categorie", "CA", "Marge", "Ventes"];
      const prodColW = [0.08, 0.30, 0.20, 0.17, 0.17, 0.08];
      const prodRowH = 7;

      // En-tete
      fillRect(M, y, CW, prodRowH, C.primary);
      cx = M;
      prodHeaders.forEach((h, i) => {
        const w = prodColW[i] * CW;
        writeText(h, cx + 2, y + 5, { fontSize: 8, color: C.white, style: "bold" });
        cx += w;
      });
      y += prodRowH;

      // Lignes
      topProducts.forEach((p, idx) => {
        if (idx % 2 === 0) {
          fillRect(M, y, CW, prodRowH, C.lightGray);
        }
        drawLine(M, y + prodRowH, M + CW, y + prodRowH, C.border, 0.2);

        const prodValues = [
          String(idx + 1),
          p.name,
          p.category,
          formatCurrency(p.revenue),
          formatCurrency(p.margin),
          String(p.salesCount),
        ];

        cx = M;
        prodValues.forEach((cell, i) => {
          const w = prodColW[i] * CW;
          writeText(String(cell), cx + 2, y + 5, { fontSize: 8, color: C.dark });
          cx += w;
        });
        y += prodRowH;
      });

      strokeRect(M, y - topProducts.length * prodRowH - prodRowH, CW, (topProducts.length + 1) * prodRowH, C.border, 0.5);
      y += 12;
    }

    // Alertes
    writeText("ALERTES ET ACTIONS REQUISES", M, y, { fontSize: 12, font: "helvetica", style: "bold", color: C.dark });
    y += 10;

    if (alerts.length === 0) {
      writeText("Aucune alerte pour le moment.", M, y, { fontSize: 9, color: C.gray, style: "italic" });
      y += 10;
    } else {
      alerts.forEach((alert, idx) => {
        const alertColor = alert.severity === "high" ? C.red : alert.severity === "medium" ? C.amber : C.blue;
        
        strokeRect(M, y, CW, 14, [alertColor[0], alertColor[1], alertColor[2]], 0.8);
        fillRect(M, y, 3, 14, alertColor);
        
        writeText(alert.message.toUpperCase(), M + 6, y + 5, { fontSize: 8, color: C.dark, style: "bold" });
        writeText(alert.detail, M + 6, y + 10, { fontSize: 7, color: C.gray });
        
        if (alert.count) {
          fillRect(W - M - 20, y + 3, 18, 8, alertColor);
          writeText(String(alert.count), W - M - 11, y + 8, { align: "center", fontSize: 7, color: C.white, style: "bold" });
        }
        
        y += 16;
      });
    }

    // ═════════════════════════════════════════════════════════════════════
    // PAGE 4 : TABLEAU DETAILLE DES PRODUITS
    // ═════════════════════════════════════════════════════════════════════

    if (products.length > 0) {
      pdf.addPage();
      fillRect(0, 0, W, H, C.white);
      y = M;

      writeText("PERFORMANCE DETAILLEE DES PRODUITS", M, y, { fontSize: 12, font: "helvetica", style: "bold", color: C.dark });
      y += 10;

      const detailHeaders = ["Produit", "Categorie", "Stock", "Ventes", "CA", "Marge", "Rentabilite"];
      const detailColW = [0.22, 0.15, 0.10, 0.10, 0.15, 0.15, 0.13];
      const detailRowH = 7;

      // En-tete
      fillRect(M, y, CW, detailRowH, C.primary);
      cx = M;
      detailHeaders.forEach((h, i) => {
        const w = detailColW[i] * CW;
        writeText(h, cx + 2, y + 5, { fontSize: 8, color: C.white, style: "bold" });
        cx += w;
      });
      y += detailRowH;

      // Donnees produits avec stats calculees
      const productsWithStats = [...products]
        .map((product) => {
          const productTransactions = transactions.filter(
            (t) =>
              t.type === "sale" &&
              extractIdFromIri(t.product) === String(product.id)
          );
          const salesCount = productTransactions.reduce(
            (s, t) => s + (t.quantity || 0),
            0
          );
          const revenue = productTransactions.reduce(
            (s, t) =>
              s + (t.quantity || 0) * (t.unitPrice || product.salePrice),
            0
          );
          const cost = salesCount * product.purchasePrice;
          const margin = revenue - cost;
          const profitability = revenue > 0 ? (margin / revenue) * 100 : 0;

          return {
            ...product,
            salesCount,
            revenue,
            margin,
            profitability,
          };
        })
        .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

      productsWithStats.forEach((product, idx) => {
        if (idx % 2 === 0) {
          fillRect(M, y, CW, detailRowH, C.lightGray);
        }
        drawLine(M, y + detailRowH, M + CW, y + detailRowH, C.border, 0.2);

        const stockStatus = product.currentStock === 0
          ? "RUPTURE"
          : product.currentStock <= 5
          ? "FAIBLE"
          : "OK";

        const stockColor = product.currentStock === 0
          ? C.red
          : product.currentStock <= 5
          ? C.amber
          : C.green;

        const detailValues = [
          product.name,
          product.category,
          stockStatus,
          String(product.salesCount),
          formatCurrency(product.revenue),
          formatCurrency(product.margin),
          `${product.profitability.toFixed(1)}%`,
        ];

        cx = M;
        detailValues.forEach((cell, i) => {
          const w = detailColW[i] * CW;
          if (i === 2) {
            // Colonne stock avec couleur
            fillRect(cx + 1, y + 1, w - 2, detailRowH - 2, stockColor);
            writeText(String(cell), cx + w / 2, y + 5, { align: "center", fontSize: 7, color: C.white, style: "bold" });
          } else {
            const textColor = i === 5 && product.margin < 0 ? C.red : C.dark;
            writeText(String(cell), cx + 2, y + 5, { fontSize: 8, color: textColor });
          }
          cx += w;
        });
        y += detailRowH;

        // Saut de page si necessaire
        if (y > H - M - 20) {
          strokeRect(M, y - (idx + 1) * detailRowH - detailRowH, CW, (idx + 2) * detailRowH, C.border, 0.5);
          pdf.addPage();
          fillRect(0, 0, W, H, C.white);
          y = M;
          
          // Re-en-tete
          fillRect(M, y, CW, detailRowH, C.primary);
          cx = M;
          detailHeaders.forEach((h, i) => {
            const w = detailColW[i] * CW;
            writeText(h, cx + 2, y + 5, { fontSize: 8, color: C.white, style: "bold" });
            cx += w;
          });
          y += detailRowH;
        }
      });

      strokeRect(M, y - productsWithStats.length * detailRowH - detailRowH, CW, (productsWithStats.length + 1) * detailRowH, C.border, 0.5);
    }

    // ═════════════════════════════════════════════════════════════════════
    // PIED DE PAGE SUR TOUTES LES PAGES
    // ═════════════════════════════════════════════════════════════════════

    try {
      const pageCount = (pdf as any).internal.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        drawLine(M, H - 12, W - M, H - 12, C.border, 0.3);
        writeText("MADAFIT - Systeme de gestion de salle de sport", M, H - 6, { fontSize: 7, color: C.gray });
        writeText(`Page ${i} / ${pageCount}`, W - M, H - 6, { align: "right", fontSize: 7, color: C.gray });
      }
    } catch {
      // Fallback silencieux
    }

    pdf.save(`madafit-rapport-complet-${pdfExportDate.toISOString().split("T")[0]}.pdf`);
  }, [period, mrr, mrrTrend, activeMembers, newThisMonth, avgBasket, basketTrend, churnRate, monthlyRevenue, hourlyAttendance, cohortData, topProducts, revenueSplit, alerts, products, transactions]);

  // ═══════════════════════════════════════════════════════════════════════
  // EXPORT CSV COMPLET
  // ═══════════════════════════════════════════════════════════════════════

  const exportToCSV = useCallback(() => {
    const csvDate = new Date();
    let csv = "\uFEFF";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 1 : METADONNEES
    // ═════════════════════════════════════════════════════════════════

    csv += "MADAFIT;RAPPORT D'ACTIVITE COMPLET\n";
    csv += `Date de generation;${csvDate.toLocaleDateString("fr-FR")}\n`;
    csv += `Heure de generation;${csvDate.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}\n`;
    csv += `Periode analysee;${period === "3months" ? "3 derniers mois" : period === "6months" ? "6 derniers mois" : "12 derniers mois"}\n`;
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 2 : INDICATEURS CLES (KPIs)
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 1;INDICATEURS CLES DE PERFORMANCE\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Indicateur;Valeur;Tendance;Statut\n";
    csv += `MRR (Revenu Recurrent Mensuel);${formatCurrency(mrr)};${mrrTrend > 0 ? "+" : ""}${mrrTrend.toFixed(1)}%;${mrrTrend >= 0 ? "POSITIF" : "NEGATIF"}\n`;
    csv += `Membres actifs;${activeMembers};+${newThisMonth} nouveaux ce mois;ACTIF\n`;
    csv += `Panier moyen;${formatCurrency(avgBasket)};${basketTrend > 0 ? "+" : ""}${basketTrend.toFixed(1)}%;${basketTrend >= 0 ? "POSITIF" : "NEGATIF"}\n`;
    csv += `Taux de churn (cohortes);${churnRate.toFixed(1)}%;-;${churnRate <= 10 ? "STABLE" : churnRate <= 25 ? "ATTENTION" : "ALERTE"}\n`;
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 3 : REVENUS MENSUELS
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 2;EVOLUTION DES REVENUS MENSUELS\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Mois;Abonnements;Produits;Total;Part abonnements;Part produits\n";
    monthlyRevenue.forEach((m) => {
      const subPct = m.total > 0 ? ((m.subscriptions / m.total) * 100).toFixed(1) : "0.0";
      const prodPct = m.total > 0 ? ((m.products / m.total) * 100).toFixed(1) : "0.0";
      csv += `${m.label};${formatCurrency(m.subscriptions)};${formatCurrency(m.products)};${formatCurrency(m.total)};${subPct}%;${prodPct}%\n`;
    });
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 4 : HEURES DE POINTE
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 3;HEURES DE POINTE (PASSAGES PAR TRANCHE HORAIRE)\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Tranche horaire;Nombre de passages;Pourcentage\n";
    const totalVisits = hourlyAttendance.reduce((s, h) => s + h.visits, 0);
    hourlyAttendance.forEach((h) => {
      const pct = totalVisits > 0 ? ((h.visits / totalVisits) * 100).toFixed(1) : "0.0";
      csv += `${h.label};${h.visits};${pct}%\n`;
    });
    csv += `TOTAL;${totalVisits};100.0%\n`;
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 5 : RETENTION PAR COHORTE
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 4;RETENTION DES MEMBRES PAR COHORTE\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Cohorte;M0;M1;M2;M3;M6;M12;Taux de churn\n";
    cohortData.forEach((c) => {
      csv += `${c.cohortMonth};${c.month0}%;${c.month1 >= 0 ? c.month1 + "%" : "N/A"};${c.month2 >= 0 ? c.month2 + "%" : "N/A"};${c.month3 >= 0 ? c.month3 + "%" : "N/A"};${c.month6 >= 0 ? c.month6 + "%" : "N/A"};${c.month12 >= 0 ? c.month12 + "%" : "N/A"};${c.churnRate}%\n`;
    });
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 6 : REPARTITION DES REVENUS
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 5;REPARTITION DES REVENUS (ABONNEMENTS VS PRODUITS)\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Source de revenu;Montant;Pourcentage du total\n";
    revenueSplit.forEach((item) => {
      csv += `${item.name};${formatCurrency(item.value)};${item.percentage.toFixed(1)}%\n`;
    });
    csv += `TOTAL;${formatCurrency(revenueSplit.reduce((s, r) => s + r.value, 0))};100.0%\n`;
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 7 : TOP PRODUITS
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 6;TOP 5 PRODUITS PAR CHIFFRE D'AFFAIRES\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "Rang;Produit;Categorie;Chiffre d'affaires;Marge;Nombre de ventes;Rentabilite\n";
    topProducts.forEach((p, idx) => {
      const renta = p.revenue > 0 ? ((p.margin / p.revenue) * 100).toFixed(1) : "0.0";
      csv += `${idx + 1};${p.name};${p.category};${formatCurrency(p.revenue)};${formatCurrency(p.margin)};${p.salesCount};${renta}%\n`;
    });
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 8 : ALERTES
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 7;ALERTES ET ACTIONS REQUISES\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    if (alerts.length === 0) {
      csv += "Aucune alerte;Tout va bien;-;-\n";
    } else {
      csv += "Type;Severite;Message;Detail;Nombre concerne\n";
      alerts.forEach((a) => {
        csv += `${a.type};${a.severity.toUpperCase()};${a.message};${a.detail};${a.count || 0}\n`;
      });
    }
    csv += "\n";

    // ═════════════════════════════════════════════════════════════════
    // SECTION 9 : INVENTAIRE COMPLET DES PRODUITS
    // ═════════════════════════════════════════════════════════════════

    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "SECTION 8;INVENTAIRE COMPLET DES PRODUITS\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "ID;Nom;Categorie;Prix d'achat;Prix de vente;Stock actuel;Statut stock;Ventes;CA;Marge;Rentabilite\n";

    const allProductsWithStats = [...products]
      .map((product) => {
        const productTransactions = transactions.filter(
          (t) =>
            t.type === "sale" &&
            extractIdFromIri(t.product) === String(product.id)
        );
        const salesCount = productTransactions.reduce(
          (s, t) => s + (t.quantity || 0),
          0
        );
        const revenue = productTransactions.reduce(
          (s, t) =>
            s + (t.quantity || 0) * (t.unitPrice || product.salePrice),
          0
        );
        const cost = salesCount * product.purchasePrice;
        const margin = revenue - cost;
        const profitability = revenue > 0 ? (margin / revenue) * 100 : 0;

        const stockStatus = product.currentStock === 0
          ? "RUPTURE"
          : product.currentStock <= 5
          ? "FAIBLE"
          : "OK";

        return {
          ...product,
          salesCount,
          revenue,
          margin,
          profitability,
          stockStatus,
        };
      })
      .sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

    allProductsWithStats.forEach((p) => {
      csv += `${p.id};${p.name};${p.category};${formatCurrency(p.purchasePrice)};${formatCurrency(p.salePrice)};${p.currentStock};${p.stockStatus};${p.salesCount};${formatCurrency(p.revenue)};${formatCurrency(p.margin)};${p.profitability.toFixed(1)}%\n`;
    });

    csv += "\n";
    csv += "═══════════════════════════════════════════════════════════════\n";
    csv += "FIN DU RAPPORT;MADAFIT - Systeme de gestion de salle de sport\n";
    csv += "═══════════════════════════════════════════════════════════════\n";

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `madafit-rapport-complet-${csvDate.toISOString().split("T")[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [period, mrr, mrrTrend, activeMembers, newThisMonth, avgBasket, basketTrend, churnRate, monthlyRevenue, hourlyAttendance, cohortData, topProducts, revenueSplit, alerts, products, transactions]);

  // ═══════════════════════════════════════════════════════════════════════
  // RENDU
  // ═══════════════════════════════════════════════════════════════════════

  const isLoading =
    usersQuery.isLoading ||
    subscriptionsQuery.isLoading ||
    plansQuery.isLoading ||
    paymentsQuery.isLoading ||
    transactionsQuery.isLoading ||
    productsQuery.isLoading ||
    attendanceQuery.isLoading;

  const hasError =
    usersQuery.isError ||
    subscriptionsQuery.isError ||
    plansQuery.isError ||
    paymentsQuery.isError ||
    transactionsQuery.isError ||
    productsQuery.isError ||
    attendanceQuery.isError;

  if (hasError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-rose-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-8 h-8 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Erreur de chargement</h2>
          <p className="text-sm text-muted-foreground">Impossible de recuperer les donnees. Veuillez reessayer.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Recharger
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="h-10 w-64 bg-muted rounded-2xl animate-pulse" />
              <div className="h-5 w-48 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="h-12 w-40 bg-muted rounded-xl animate-pulse" />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-32 bg-muted/60 rounded-2xl animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-72 bg-muted/40 rounded-2xl animate-pulse" />
            <div className="h-72 bg-muted/40 rounded-2xl animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <style>{`
        @keyframes fade-in-up {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bar-fill {
          from { width: 0%; }
          to { width: var(--target-width); }
        }
        .animate-fade-in-up {
          animation: fade-in-up 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
          opacity: 0;
        }
        .animate-bar-fill {
          animation: bar-fill 1s cubic-bezier(0.23, 1, 0.32, 1) forwards;
        }
        .glass-card {
          background: rgba(255, 255, 255, 0.7);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(255, 255, 255, 0.3);
        }
        .dark .glass-card {
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }
        .premium-shadow {
          box-shadow: 0 4px 24px -4px rgba(0, 0, 0, 0.08), 0 8px 48px -8px rgba(0, 0, 0, 0.04);
        }
        .premium-shadow-hover {
          transition: all 0.5s cubic-bezier(0.23, 1, 0.32, 1);
        }
        .premium-shadow-hover:hover {
          box-shadow: 0 8px 40px -4px rgba(0, 0, 0, 0.12), 0 16px 64px -16px rgba(0, 0, 0, 0.08);
          transform: translateY(-2px);
        }
      `}</style>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* HEADER */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 animate-fade-in-up">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
                  Rapport d'activite
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground/80 font-medium ml-[52px]">
              Performance globale de votre salle
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-background border border-border rounded-xl p-1">
              {([
                { value: "3months", label: "3 mois" },
                { value: "6months", label: "6 mois" },
                { value: "year", label: "1 an" },
              ] as const).map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPeriod(p.value)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                    period === p.value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <button
              onClick={exportToCSV}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-muted transition-colors"
              style={{ borderColor: "hsl(var(--border))" }}
            >
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">CSV</span>
            </button>
            <button
              onClick={exportToPDF}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            >
              <FileText className="w-4 h-4" />
              <span className="hidden sm:inline">PDF</span>
            </button>
          </div>
        </header>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* KPIs */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <KpiCard
            label="MRR"
            value={formatCurrency(mrr)}
            trend={{
              value: `${mrrTrend > 0 ? "+" : ""}${mrrTrend.toFixed(1)}%`,
              positive: mrrTrend >= 0,
            }}
            icon={CreditCard}
            color="text-violet-600"
            bgGradient="bg-gradient-to-br from-violet-50/80 to-fuchsia-50/80 dark:from-violet-950/20 dark:to-fuchsia-950/20"
            delay={0}
          />
          <KpiCard
            label="Membres actifs"
            value={String(activeMembers)}
            trend={{
              value: `+${newThisMonth} ce mois`,
              positive: true,
            }}
            icon={Users}
            color="text-sky-600"
            bgGradient="bg-gradient-to-br from-sky-50/80 to-cyan-50/80 dark:from-sky-950/20 dark:to-cyan-950/20"
            delay={100}
          />
          <KpiCard
            label="Panier moyen"
            value={formatCurrency(avgBasket)}
            trend={{
              value: `${basketTrend > 0 ? "+" : ""}${basketTrend.toFixed(1)}%`,
              positive: basketTrend >= 0,
            }}
            icon={ArrowUpRight}
            color="text-emerald-600"
            bgGradient="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20"
            delay={200}
          />
          <KpiCard
            label="Churn cohorte"
            value={`${churnRate.toFixed(1)}%`}
            trend={{
              value: churnRate > 10 ? "Alerte" : "Stable",
              positive: churnRate <= 10,
            }}
            icon={TrendingDown}
            color={churnRate > 10 ? "text-rose-600" : "text-emerald-600"}
            bgGradient={
              churnRate > 10
                ? "bg-gradient-to-br from-rose-50/80 to-red-50/80 dark:from-rose-950/20 dark:to-red-950/20"
                : "bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20"
            }
            delay={300}
          />
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* GRAPHIQUES : Revenus + Heures de pointe */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenus mensuels */}
          <div
            ref={revenueChartRef}
            className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up"
            style={{ animationDelay: "150ms" }}
          >
            <div className="px-6 py-5 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Revenus mensuels</h2>
                  <p className="text-xs text-muted-foreground">Abonnements et ventes produits</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={monthlyRevenue}>
                    <defs>
                      <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.primary} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={THEME.primary} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gradProd" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={THEME.accent} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={THEME.accent} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: THEME.muted, fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: THEME.muted, fontSize: 11 }}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v))}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: THEME.card,
                        borderRadius: "12px",
                        border: `1px solid ${THEME.border}`,
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string) => [formatCurrency(value), name]}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "16px" }} />
                    <Area
                      type="monotone"
                      dataKey="subscriptions"
                      stroke={THEME.primary}
                      strokeWidth={2.5}
                      fill="url(#gradSub)"
                      name="Abonnements"
                    />
                    <Area
                      type="monotone"
                      dataKey="products"
                      stroke={THEME.accent}
                      strokeWidth={2.5}
                      fill="url(#gradProd)"
                      name="Produits"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Heures de pointe */}
          <div
            ref={hourlyChartRef}
            className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up"
            style={{ animationDelay: "250ms" }}
          >
            <div className="px-6 py-5 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-500" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Heures de pointe</h2>
                  <p className="text-xs text-muted-foreground">Passages par tranche horaire</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-[260px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hourlyAttendance}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={THEME.border} />
                    <XAxis
                      dataKey="label"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: THEME.muted, fontSize: 11 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: THEME.muted, fontSize: 11 }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: THEME.card,
                        borderRadius: "12px",
                        border: `1px solid ${THEME.border}`,
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number) => [String(value), "Passages"]}
                    />
                    <Bar
                      dataKey="visits"
                      fill={THEME.primary}
                      radius={[6, 6, 0, 0]}
                      name="Passages"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* GRAPHIQUES : Repartition revenus + Tableau cohortes */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Repartition revenus */}
          <div
            ref={revenuePieRef}
            className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up lg:col-span-1"
            style={{ animationDelay: "350ms" }}
          >
            <div className="px-6 py-5 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 flex items-center justify-center">
                  <Package className="w-4 h-4 text-emerald-500" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Repartition des revenus</h2>
                  <p className="text-xs text-muted-foreground">Abonnements vs produits</p>
                </div>
              </div>
            </div>
            <div className="p-6">
              <div className="h-[220px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={revenueSplit}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                      stroke="none"
                    >
                      {revenueSplit.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: THEME.card,
                        borderRadius: "12px",
                        border: `1px solid ${THEME.border}`,
                        boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number, name: string, props: any) => [
                        `${formatCurrency(value)} (${props?.payload?.percentage?.toFixed(1)}%)`,
                        name,
                      ]}
                    />
                    <Legend
                      verticalAlign="bottom"
                      height={36}
                      wrapperStyle={{ fontSize: "12px", paddingTop: "8px" }}
                      formatter={(value: string) => (
                        <span style={{ color: THEME.foreground }}>{value}</span>
                      )}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Tableau de cohortes */}
          <div
            ref={cohortTableRef}
            className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up lg:col-span-2"
            style={{ animationDelay: "450ms" }}
          >
            <div className="px-6 py-5 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center">
                  <Users className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Retention par cohorte</h2>
                  <p className="text-xs text-muted-foreground">Taux de retention mensuel</p>
                </div>
              </div>
            </div>
            <div className="p-6 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Cohorte
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M0
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M1
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M2
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M3
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M6
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      M12
                    </th>
                    <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                      Churn
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {cohortData.map((c, idx) => (
                    <tr
                      key={c.cohortMonth}
                      className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                    >
                      <td className="py-3 px-3 font-semibold text-foreground">
                        {c.cohortMonth}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span className="inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600">
                          {c.month0}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.month1 >= 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                              c.month1 >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.month1 >= 50
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {c.month1}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.month2 >= 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                              c.month2 >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.month2 >= 50
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {c.month2}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.month3 >= 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                              c.month3 >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.month3 >= 50
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {c.month3}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.month6 >= 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                              c.month6 >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.month6 >= 50
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {c.month6}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        {c.month12 >= 0 ? (
                          <span
                            className={`inline-flex items-center justify-center w-10 h-6 rounded-full text-xs font-bold ${
                              c.month12 >= 80
                                ? "bg-emerald-500/10 text-emerald-600"
                                : c.month12 >= 50
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {c.month12}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center justify-center w-12 h-6 rounded-full text-xs font-bold ${
                            c.churnRate <= 10
                              ? "bg-emerald-500/10 text-emerald-600"
                              : c.churnRate <= 25
                              ? "bg-amber-500/10 text-amber-600"
                              : "bg-rose-500/10 text-rose-600"
                          }`}
                        >
                          {c.churnRate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* TOP PRODUITS */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up" style={{ animationDelay: "550ms" }}>
          <div className="px-6 py-5 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-amber-500/5 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Top produits</h2>
                <p className="text-xs text-muted-foreground">Performance par chiffre d'affaires</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {topProducts.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Aucune vente enregistree sur cette periode</p>
              </div>
            ) : (
              <div className="space-y-4">
                {topProducts.map((product, idx) => {
                  const maxRevenue = topProducts[0]?.revenue || 1;
                  const widthPct = (product.revenue / maxRevenue) * 100;
                  const rentability = product.revenue > 0 ? (product.margin / product.revenue) * 100 : 0;

                  return (
                    <div key={product.id} className="group">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                              idx === 0
                                ? "bg-amber-500/15 text-amber-600"
                                : idx === 1
                                ? "bg-slate-400/15 text-slate-500"
                                : idx === 2
                                ? "bg-orange-700/15 text-orange-700"
                                : "bg-muted text-muted-foreground"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{product.name}</p>
                            <p className="text-[11px] text-muted-foreground">{product.category}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-sm text-foreground">{formatCurrency(product.revenue)}</p>
                          <p className="text-[11px] text-muted-foreground">{product.salesCount} ventes</p>
                        </div>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60 animate-bar-fill"
                          style={{ "--target-width": `${widthPct}%` } as React.CSSProperties}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-[11px] text-muted-foreground">
                          Marge: {formatCurrency(product.margin)}
                        </span>
                        <span
                          className={`text-[11px] font-semibold ${
                            rentability >= 30
                              ? "text-emerald-600"
                              : rentability >= 15
                              ? "text-amber-600"
                              : "text-rose-600"
                          }`}
                        >
                          {rentability.toFixed(1)}% rentabilite
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* ALERTES */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up" style={{ animationDelay: "650ms" }}>
          <div className="px-6 py-5 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-rose-500/20 to-rose-500/5 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Alertes et actions requises</h2>
                <p className="text-xs text-muted-foreground">Points d'attention immediats</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            {alerts.length === 0 ? (
              <div className="flex items-center gap-3 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
                <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <Minus className="w-5 h-5 text-emerald-500" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-emerald-700">Tout va bien</p>
                  <p className="text-xs text-emerald-600/80">Aucune alerte pour le moment</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {alerts.map((alert, idx) => {
                  const severityConfig = {
                    high: {
                      border: "border-rose-500/30",
                      bg: "bg-rose-500/5",
                      iconBg: "bg-rose-500/10",
                      iconColor: "text-rose-500",
                      badgeBg: "bg-rose-500",
                      badgeText: "text-white",
                    },
                    medium: {
                      border: "border-amber-500/30",
                      bg: "bg-amber-500/5",
                      iconBg: "bg-amber-500/10",
                      iconColor: "text-amber-500",
                      badgeBg: "bg-amber-500",
                      badgeText: "text-white",
                    },
                    low: {
                      border: "border-sky-500/30",
                      bg: "bg-sky-500/5",
                      iconBg: "bg-sky-500/10",
                      iconColor: "text-sky-500",
                      badgeBg: "bg-sky-500",
                      badgeText: "text-white",
                    },
                  };

                  const sc = severityConfig[alert.severity];

                  return (
                    <div
                      key={idx}
                      className={`flex items-start gap-3 p-4 rounded-xl border ${sc.border} ${sc.bg} transition-all hover:scale-[1.01]`}
                    >
                      <div className={`w-10 h-10 rounded-full ${sc.iconBg} flex items-center justify-center shrink-0`}>
                        {alert.type === "expiry" && <Calendar className={`w-5 h-5 ${sc.iconColor}`} />}
                        {alert.type === "inactive" && <Clock className={`w-5 h-5 ${sc.iconColor}`} />}
                        {alert.type === "stock" && <Package className={`w-5 h-5 ${sc.iconColor}`} />}
                        {alert.type === "credit" && <CreditCard className={`w-5 h-5 ${sc.iconColor}`} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-semibold text-sm text-foreground">{alert.message}</p>
                          {alert.count !== undefined && (
                            <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${sc.badgeBg} ${sc.badgeText}`}>
                              {alert.count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{alert.detail}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* TABLEAU DETAILLE DES PRODUITS */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up" style={{ animationDelay: "750ms" }}>
          <div className="px-6 py-5 border-b border-border/30">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500/20 to-violet-500/5 flex items-center justify-center">
                <Package className="w-4 h-4 text-violet-500" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Performance detaillee des produits</h2>
                <p className="text-xs text-muted-foreground">Inventaire complet avec rentabilite</p>
              </div>
            </div>
          </div>
          <div className="p-6 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-left py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Produit
                  </th>
                  <th className="text-left py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Categorie
                  </th>
                  <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Stock
                  </th>
                  <th className="text-center py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Ventes
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    CA
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Marge
                  </th>
                  <th className="text-right py-3 px-3 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Rentabilite
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...products]
                  .map((product) => {
                    const productTransactions = transactions.filter(
                      (t) =>
                        t.type === "sale" &&
                        extractIdFromIri(t.product) === String(product.id)
                    );
                    const salesCount = productTransactions.reduce(
                      (s, t) => s + (t.quantity || 0),
                      0
                    );
                    const revenue = productTransactions.reduce(
                      (s, t) =>
                        s + (t.quantity || 0) * (t.unitPrice || product.salePrice),
                      0
                    );
                    const cost = salesCount * product.purchasePrice;
                    const margin = revenue - cost;
                    const profitability = revenue > 0 ? (margin / revenue) * 100 : 0;

                    return {
                      ...product,
                      salesCount,
                      revenue,
                      margin,
                      profitability,
                    };
                  })
                  .sort((a, b) => (b.revenue || 0) - (a.revenue || 0))
                  .map((product) => {
                    const stockStatus =
                      product.currentStock === 0
                        ? { label: "RUPTURE", className: "bg-rose-500 text-white" }
                        : product.currentStock <= 5
                        ? { label: "FAIBLE", className: "bg-amber-500 text-white" }
                        : { label: "OK", className: "bg-emerald-500 text-white" };

                    return (
                      <tr
                        key={product.id}
                        className="border-b border-border/20 last:border-0 hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <p className="font-semibold text-foreground">{product.name}</p>
                        </td>
                        <td className="py-3 px-3 text-muted-foreground">{product.category}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-[10px] font-bold ${stockStatus.className}`}
                          >
                            {stockStatus.label}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-medium text-foreground">
                          {product.salesCount}
                        </td>
                        <td className="py-3 px-3 text-right font-medium text-foreground">
                          {formatCurrency(product.revenue)}
                        </td>
                        <td
                          className={`py-3 px-3 text-right font-medium ${
                            product.margin < 0 ? "text-rose-600" : "text-foreground"
                          }`}
                        >
                          {formatCurrency(product.margin)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <span
                            className={`inline-flex items-center justify-center w-14 h-6 rounded-full text-xs font-bold ${
                              product.profitability >= 30
                                ? "bg-emerald-500/10 text-emerald-600"
                                : product.profitability >= 15
                                ? "bg-amber-500/10 text-amber-600"
                                : "bg-rose-500/10 text-rose-600"
                            }`}
                          >
                            {product.profitability.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        {/* ═════════════════════════════════════════════════════════════════ */}
        {/* FOOTER */}
        {/* ═════════════════════════════════════════════════════════════════ */}
        <footer className="text-center py-8 text-xs text-muted-foreground/60 animate-fade-in-up" style={{ animationDelay: "850ms" }}>
          <p>MADAFIT — Rapport genere automatiquement</p>
          <p className="mt-1">
            {new Date().toLocaleDateString("fr-FR", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </footer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SOUS-COMPOSANT : KPI CARD
// ═══════════════════════════════════════════════════════════════════════════

interface KpiCardProps {
  label: string;
  value: string;
  trend: {
    value: string;
    positive: boolean;
  };
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bgGradient: string;
  delay: number;
}

function KpiCard({ label, value, trend, icon: Icon, color, bgGradient, delay }: KpiCardProps) {
  return (
    <div
      className={`${bgGradient} rounded-2xl p-5 border border-white/40 dark:border-white/5 premium-shadow premium-shadow-hover animate-fade-in-up`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl bg-white/60 dark:bg-white/5 backdrop-blur-sm flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${color}`} />
        </div>
        <div
          className={`flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold ${
            trend.positive
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-rose-500/10 text-rose-600"
          }`}
        >
          {trend.positive ? (
            <ArrowUpRight className="w-3 h-3" />
          ) : (
            <ArrowDownRight className="w-3 h-3" />
          )}
          {trend.value}
        </div>
      </div>
      <p className="text-2xl font-black text-foreground tracking-tight">{value}</p>
      <p className="text-xs text-muted-foreground font-medium mt-1">{label}</p>
    </div>
  );
}