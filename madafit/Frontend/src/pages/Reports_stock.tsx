import { useMemo, useState } from 'react';
import { useStockReport } from '@/hooks/useStockReport';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart3, 
  TrendingUp, 
  ShoppingCart, 
  Package, 
  ArrowDown, 
  Loader2, 
  AlertCircle,
  Calendar,
  Filter,
  Download,
  FileText,
  Sparkles,
  ChevronRight,
  TrendingDown,
  Percent,
  Boxes,
  ArrowUpRight,
  Clock,
  CreditCard,
} from 'lucide-react';
import jsPDF from 'jspdf';
import type { StockReportSummary } from '@/services/api';

type Period = 'today' | 'week' | 'month' | 'custom';

// ── FIX : formatDate en temps local ──────
function formatLocalDate(d: Date): string {
  const year  = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day   = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getPeriodRange(period: Period, from: string, to: string): { from: string; to: string } {
  const now = new Date();

  if (period === 'today') {
    const today = formatLocalDate(now);
    return { from: today, to: today };
  }
  if (period === 'week') {
    const day    = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return { from: formatLocalDate(monday), to: formatLocalDate(sunday) };
  }
  if (period === 'month') {
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay  = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: formatLocalDate(firstDay), to: formatLocalDate(lastDay) };
  }
  return { from, to };
}

// ── Export CSV ────────────────────────────────────────────────────────────────
function exportToCSV(report: StockReportSummary, periodLabel: string, from: string, to: string) {
  const headers = [
    'Produit', 'Catégorie',
    'Stock initial', 'Entrées',
    'Ventes', 'Crédits', 'Sorties S/E',
    'Total sorties', 'Stock final',
    'Coût total (Ar)', 'CA (Ar)', 'Bénéfice (Ar)',
  ];

  const escapeCell = (v: string | number) =>
    `"${String(v).replace(/"/g, '""')}"`;

  const dataRows = report.rows.map((row) => [
    row.product.name,
    row.product.category,
    row.initialStock,
    row.totalEntries,
    row.totalSales,
    row.totalCredits ?? 0,
    row.totalNonSaleExits,
    row.totalExits,
    row.finalStock,
    row.totalCost,
    row.revenue,
    row.profit,
  ]);

  const t = report.totals;
  const totalsRow = [
    'TOTAL', '',
    t.initialStock, t.totalEntries,
    t.totalSales, t.totalCredits ?? 0, t.totalNonSaleExits,
    t.totalExits, t.finalStock,
    t.totalCost, t.revenue, t.profit,
  ];

  const csvLines = [
    [escapeCell(`Rapport de stock — ${periodLabel}`)],
    [escapeCell(`Période : du ${from} au ${to}`)],
    [],
    headers.map(escapeCell),
    ...dataRows.map((row) => row.map(escapeCell)),
    [],
    totalsRow.map(escapeCell),
  ]
    .map((line) => line.join(';'))
    .join('\r\n');

  const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href     = url;
  link.download = `rapport-stock_${from}_${to}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ── Export PDF ────────────────────────────────────────────────────────────────
function exportToPDF(report: StockReportSummary, periodLabel: string, from: string, to: string) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const M = 15;
  const CW = W - M * 2;
  let y = M;

  // FIX: helvetica ne supporte pas les accents UTF-8 → on les retire
  const originalText = pdf.text.bind(pdf);
  pdf.text = function(...args: any[]) {
    if (typeof args[0] === 'string') {
      args[0] = args[0].normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    }
    return originalText.apply(pdf, args);
  };

  const C = {
    primary: [220, 53, 69],   // ← FIX: rouge (thème cohérent)
    dark: [33, 37, 41],
    gray: [108, 117, 125],
    light: [248, 249, 250],
    white: [255, 255, 255],
    border: [222, 226, 230],
    green: [40, 167, 69],
    red: [220, 53, 69],
    amber: [245, 158, 11],
  };

  // FIX: éviter les espaces insécables de Intl.NumberFormat dans le PDF
  const formatMGA_PDF = (v: number) =>
    Math.round(v).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ' Ar';

  const drawTable = (
    headers: string[],
    rows: (string | number)[][],
    colWidths: number[],
    startY: number,
    options?: { foot?: (string | number)[]; headColor?: number[]; align?: ("left" | "center" | "right")[] }
  ) => {
    const rowH = 7;
    const headColor = options?.headColor || C.primary;
    const align = options?.align || headers.map(() => "left" as const);
    let cy = startY;

    const needed = (rows.length + 1 + (options?.foot ? 1 : 0)) * rowH + 5;
    if (cy + needed > H - M) {
      pdf.addPage();
      cy = M;
    }

    pdf.setFillColor(...headColor);
    pdf.rect(M, cy, CW, rowH, "F");
    pdf.setTextColor(...C.white);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    let cx = M;
    headers.forEach((h, i) => {
      const w = colWidths[i] * CW;
      pdf.text(String(h), align[i] === "center" ? cx + w / 2 : cx + 2, cy + 5, { align: align[i] === "center" ? "center" : "left" });
      cx += w;
    });
    cy += rowH;

    rows.forEach((row, idx) => {
      if (idx % 2 === 0) {
        pdf.setFillColor(...C.light);
        pdf.rect(M, cy, CW, rowH, "F");
      }
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.2);
      pdf.line(M, cy + rowH, M + CW, cy + rowH);

      pdf.setTextColor(...C.dark);
      pdf.setFont("helvetica", "normal");
      cx = M;
      row.forEach((cell, i) => {
        const w = colWidths[i] * CW;
        pdf.text(String(cell), align[i] === "center" ? cx + w / 2 : cx + 2, cy + 5, { align: align[i] === "center" ? "center" : "left" });
        cx += w;
      });
      cy += rowH;
    });

    if (options?.foot) {
      pdf.setFillColor(240, 240, 240);
      pdf.rect(M, cy, CW, rowH, "F");
      pdf.setTextColor(...C.primary);
      pdf.setFont("helvetica", "bold");
      cx = M;
      options.foot.forEach((cell, i) => {
        const w = colWidths[i] * CW;
        pdf.text(String(cell), align[i] === "center" ? cx + w / 2 : cx + 2, cy + 5, { align: align[i] === "center" ? "center" : "left" });
        cx += w;
      });
      cy += rowH;
    }

    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.rect(M, startY, CW, cy - startY);

    return cy + 4;
  };

  // En-tête
  pdf.setTextColor(...C.primary);
  pdf.setFontSize(20);
  pdf.setFont("helvetica", "bold");
  pdf.text("MADAFIT", M, y);

  pdf.setTextColor(...C.gray);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text("Rapport de stock", M, y + 6);

  pdf.setTextColor(...C.gray);
  pdf.setFontSize(8);
  pdf.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, W - M, y, { align: "right" });
  pdf.text(`${periodLabel} — ${from} au ${to}`, W - M, y + 5, { align: "right" });

  y += 14;
  pdf.setDrawColor(...C.border);
  pdf.setLineWidth(0.5);
  pdf.line(M, y, W - M, y);
  y += 8;

  // KPIs
  const t = report.totals;
  const totalArticlesVendus = t.totalSales + (t.totalCredits ?? 0);

  const kpis = [
    { label: "CHIFFRE D'AFFAIRES", value: formatMGA_PDF(t.revenue), color: C.primary },
    { label: "COÛT TOTAL", value: formatMGA_PDF(t.totalCost), color: C.gray },
    { label: "BÉNÉFICE NET", value: formatMGA_PDF(t.profit), color: t.profit >= 0 ? C.green : C.red },
    { label: "ARTICLES VENDUS", value: `${totalArticlesVendus} u.`, color: C.amber },
  ];

  const kpiW = (CW - 9) / 4;
  kpis.forEach((k, i) => {
    const x = M + i * (kpiW + 3);
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.roundedRect(x, y, kpiW, 20, 2, 2, "S");
    pdf.setTextColor(...C.gray);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text(k.label, x + 3, y + 6);
    pdf.setTextColor(...k.color);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(k.value, x + 3, y + 15);
  });
  y += 26;

  // Tableau détaillé
  pdf.setTextColor(...C.dark);
  pdf.setFontSize(11);
  pdf.setFont("helvetica", "bold");
  pdf.text("Détail par produit", M, y);
  y += 6;

  y = drawTable(
    ["Produit", "Cat.", "Stk init", "Entr.", "Ventes", "Créd.", "S/E", "Stk fin", "Coût", "CA", "Bénéf."],
    report.rows.map((r) => [
      r.product.name,
      r.product.category,
      r.initialStock,
      r.totalEntries,
      r.totalSales,
      r.totalCredits ?? 0,
      r.totalNonSaleExits,
      r.finalStock,
      formatMGA_PDF(r.totalCost),
      formatMGA_PDF(r.revenue),
      formatMGA_PDF(r.profit),
    ]),
    [0.18, 0.10, 0.07, 0.07, 0.07, 0.07, 0.06, 0.07, 0.10, 0.10, 0.11],
    y,
    {
      foot: [
        "TOTAL", "", t.initialStock, t.totalEntries, t.totalSales, t.totalCredits ?? 0,
        t.totalNonSaleExits, t.finalStock, formatMGA_PDF(t.totalCost), formatMGA_PDF(t.revenue), formatMGA_PDF(t.profit),
      ],
      align: ["left", "left", "center", "center", "center", "center", "center", "center", "right", "right", "right"],
    }
  );

  // Pied de page
  const totalPages = pdf.internal.pages.length - 1;
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(M, H - 12, W - M, H - 12);
    pdf.setTextColor(...C.gray);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("MADAFIT - Système de gestion de salle de sport", M, H - 6);
    pdf.text(`Page ${i} / ${totalPages}`, W - M, H - 6, { align: "right" });
  }

  pdf.save(`madafit-stock-${from}_${to}.pdf`);
}

function formatMGA(v: number) {
  return new Intl.NumberFormat('fr-MG').format(Math.round(v)) + ' Ar';
}

// ============================================================================
// ANIMATIONS CSS INJECTÉES
// ============================================================================

const GlobalStyles = () => (
  <style>{`
    @keyframes fade-in-up {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fade-in-left {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scale-in {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes count-up {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes slide-in-right {
      from { opacity: 0; transform: translateX(30px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes bar-fill {
      from { width: 0%; }
      to { width: var(--target-width); }
    }
    .animate-fade-in-up {
      animation: fade-in-up 0.6s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      opacity: 0;
    }
    .animate-fade-in-left {
      animation: fade-in-left 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      opacity: 0;
    }
    .animate-scale-in {
      animation: scale-in 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
      opacity: 0;
    }
    .animate-slide-in-right {
      animation: slide-in-right 0.5s cubic-bezier(0.23, 1, 0.32, 1) forwards;
      opacity: 0;
    }
    .animate-count-up {
      animation: count-up 0.8s cubic-bezier(0.23, 1, 0.32, 1) forwards;
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
    .gradient-text {
      background: linear-gradient(135deg, hsl(var(--foreground)) 0%, hsl(var(--muted-foreground)) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .table-row-anim {
      transition: all 0.3s cubic-bezier(0.23, 1, 0.32, 1);
    }
    .table-row-anim:hover {
      background: hsl(var(--muted) / 0.6);
      transform: scale(1.002);
      box-shadow: 0 2px 12px -2px rgba(0,0,0,0.05);
    }
  `}</style>
);

// ============================================================================
// COMPOSANTS PREMIUM INTERNES
// ============================================================================

function PremiumKPI({ 
  label, value, icon: Icon, color, bgGradient, delay = 0, trend
}: { 
  label: string; value: string; icon: React.ElementType; color: string; bgGradient: string;
  delay?: number; trend?: { value: string; positive: boolean };
}) {
  return (
    <div 
      className={`relative overflow-hidden rounded-2xl p-6 premium-shadow premium-shadow-hover animate-fade-in-up ${bgGradient}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
      <div className="relative">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 rounded-xl bg-white/80 dark:bg-slate-800/80 flex items-center justify-center shadow-lg ${color}`}>
            <Icon className="w-6 h-6" strokeWidth={2} />
          </div>
          {trend && (
            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
              trend.positive 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' 
                : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'
            }`}>
              {trend.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend.value}
            </span>
          )}
        </div>
        <p className="text-sm font-medium text-muted-foreground/80 mb-1">{label}</p>
        <p className="text-2xl font-black text-foreground tracking-tight animate-count-up" style={{ animationDelay: `${delay + 200}ms` }}>
          {value}
        </p>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, icon: Icon, delay = 0 }: { 
  label: string; value: string; sub: string; icon: React.ElementType; delay?: number;
}) {
  return (
    <div 
      className="relative overflow-hidden rounded-xl p-4 bg-muted/40 border border-border/50 animate-fade-in-up premium-shadow-hover"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          <p className="text-lg font-bold text-foreground">{value}</p>
          <p className="text-[10px] text-muted-foreground/60">{sub}</p>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ icon: Icon, title, subtitle }: { 
  icon: React.ElementType; title: string; subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center animate-scale-in">
      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-muted/80 to-muted/40 flex items-center justify-center mb-5 shadow-inner">
        <Icon className="w-10 h-10 text-muted-foreground/30" />
      </div>
      <p className="text-sm font-bold text-muted-foreground">{title}</p>
      <p className="text-xs text-muted-foreground/60 mt-1.5 max-w-[240px] leading-relaxed">{subtitle}</p>
    </div>
  );
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function Reports() {
  const [period, setPeriod]     = useState<Period>('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate]     = useState('');

  const { from, to } = getPeriodRange(period, fromDate, toDate);
  
  const { data: report, isLoading, isError, error } = useStockReport(from, to);

  const summary = report?.rows ?? [];
  const totals  = report?.totals ?? {
    initialStock: 0, totalEntries: 0, totalSales: 0, totalCredits: 0,
    totalNonSaleExits: 0, totalExits: 0, finalStock: 0,
    totalCost: 0, revenue: 0, profit: 0,
  };

  const periodLabel: Record<Period, string> = {
    today:  "Aujourd'hui",
    week:   'Cette semaine',
    month:  'Ce mois',
    custom: 'Période personnalisée',
  };

  const activeProducts = summary.filter((r) => r.totalEntries > 0 || r.totalExits > 0 || r.revenue > 0);
  const topProducts    = [...activeProducts].sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  const totalArticlesVendus = totals.totalSales + (totals.totalCredits ?? 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
        <GlobalStyles />
        <div className="max-w-7xl mx-auto space-y-8">
          <div className="flex items-center justify-between">
            <div className="space-y-3">
              <div className="h-10 w-64 bg-muted rounded-2xl animate-pulse" />
              <div className="h-5 w-48 bg-muted rounded-xl animate-pulse" />
            </div>
            <div className="h-12 w-40 bg-muted rounded-xl animate-pulse" />
          </div>
          <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-36 bg-muted/60 rounded-2xl animate-pulse" />)}
          </div>
          <div className="h-96 bg-muted/40 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6 flex items-center justify-center">
        <GlobalStyles />
        <div className="text-center max-w-md animate-scale-in">
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-rose-100 to-rose-50 dark:from-rose-900/20 dark:to-rose-800/10 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-rose-500/10">
            <AlertCircle className="w-12 h-12 text-rose-500" />
          </div>
          <h2 className="text-xl font-bold text-foreground mb-2">Erreur de chargement</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            {error instanceof Error ? error.message : 'Une erreur est survenue lors du calcul du rapport'}
          </p>
          <button 
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:scale-105 active:scale-95 transition-all duration-300 shadow-lg shadow-primary/25"
          >
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 p-6">
      <GlobalStyles />
      <div className="max-w-7xl mx-auto space-y-8 animate-fade-in-up">
        
        {/* HEADER */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/25">
                <BarChart3 className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight gradient-text">
                  Rapports analytiques
                </h1>
              </div>
            </div>
            <p className="text-sm text-muted-foreground/80 font-medium ml-[52px]">
              {report?.period?.fromFormatted && report?.period?.toFormatted ? (
                <span className="inline-flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5" />
                  Du {report.period.fromFormatted} au {report.period.toFormatted}
                </span>
              ) : (
                'Performance par période'
              )}
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="flex flex-col w-full gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
                <SelectTrigger className="w-full h-11 rounded-xl border-border/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
                  <Filter className="w-4 h-4 text-muted-foreground mr-2 shrink-0" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-xl">
                  <SelectItem value="today" className="rounded-lg">
                    <span className="flex items-center gap-2"><Clock className="w-4 h-4" />Aujourd'hui</span>
                  </SelectItem>
                  <SelectItem value="week" className="rounded-lg">
                    <span className="flex items-center gap-2"><Calendar className="w-4 h-4" />Cette semaine</span>
                  </SelectItem>
                  <SelectItem value="month" className="rounded-lg">
                    <span className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />Ce mois</span>
                  </SelectItem>
                  <SelectItem value="custom" className="rounded-lg">
                    <span className="flex items-center gap-2"><Filter className="w-4 h-4" />Intervalle personnalisé</span>
                  </SelectItem>
                </SelectContent>
              </Select>

              {period === 'custom' && (
                <div className="flex flex-col w-full gap-2 animate-fade-in-left sm:flex-row sm:w-auto">
                  <Input 
                    type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} 
                    className="w-full h-11 rounded-xl border-border/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sm:w-40" 
                  />
                  <span className="hidden text-muted-foreground/50 sm:flex sm:items-center">
                    <ChevronRight className="w-4 h-4" />
                  </span>
                  <Input 
                    type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} 
                    className="w-full h-11 rounded-xl border-border/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm sm:w-40" 
                  />
                </div>
              )}

              {/* Bouton Export CSV */}
              <button
                onClick={() => {
                  if (report) exportToCSV(report, periodLabel[period], from, to);
                }}
                disabled={!report || summary.length === 0}
                title="Exporter en CSV"
                className="flex items-center justify-center w-full h-11 rounded-xl border border-border/60 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm shrink-0 sm:w-11 hover:shadow-md transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <Download className="w-4 h-4 text-muted-foreground" />
              </button>

              {/* Bouton Export PDF */}
              <button
                onClick={() => {
                  if (report) exportToPDF(report, periodLabel[period], from, to);
                }}
                disabled={!report || summary.length === 0}
                title="Exporter en PDF"
                className="flex items-center justify-center gap-2 w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold text-sm shrink-0 sm:w-auto sm:px-4 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <FileText className="w-4 h-4" />
                <span className="hidden sm:inline">PDF</span>
              </button>
            </div>
          </div>
        </header>

        {/* KPIs */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-5">
          <PremiumKPI 
            label="Chiffre d'affaires" 
            value={formatMGA(totals.revenue)} 
            icon={ShoppingCart} 
            color="text-violet-600"
            bgGradient="bg-gradient-to-br from-violet-50/80 to-fuchsia-50/80 dark:from-violet-950/20 dark:to-fuchsia-950/20"
            delay={0}
          />
          <PremiumKPI 
            label="Coût total" 
            value={formatMGA(totals.totalCost)} 
            icon={ArrowDown} 
            color="text-slate-600"
            bgGradient="bg-gradient-to-br from-slate-50/80 to-gray-50/80 dark:from-slate-900/30 dark:to-gray-900/20"
            delay={100}
          />
          <PremiumKPI 
            label="Bénéfice net" 
            value={formatMGA(totals.profit)} 
            icon={TrendingUp} 
            color="text-emerald-600"
            bgGradient="bg-gradient-to-br from-emerald-50/80 to-teal-50/80 dark:from-emerald-950/20 dark:to-teal-950/20"
            delay={200}
          />
          <PremiumKPI 
            label="Articles vendus" 
            value={`${totalArticlesVendus} u.`}
            icon={Package} 
            color="text-sky-600"
            bgGradient="bg-gradient-to-br from-sky-50/80 to-cyan-50/80 dark:from-sky-950/20 dark:to-cyan-950/20"
            delay={300}
          />
        </div>

        {/* GRILLE STATS + TOP PRODUITS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Top produits */}
          <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up" style={{ animationDelay: '200ms' }}>
            <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-accent" />
                </div>
                <h2 className="font-bold text-foreground">Top produits</h2>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-accent/10 text-accent">Par CA</span>
            </div>
            <div className="p-6 space-y-4">
              {topProducts.length === 0 ? (
                <EmptyState 
                  icon={BarChart3}
                  title="Aucune vente"
                  subtitle="Aucune vente n'a été enregistrée sur cette période"
                />
              ) : (
                topProducts.map((row, i) => {
                  const pct = totals.revenue > 0 ? (row.revenue / totals.revenue) * 100 : 0;
                  return (
                    <div key={row.product.id} className="space-y-2 animate-fade-in-left" style={{ animationDelay: `${i * 80}ms` }}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground">
                            {i + 1}
                          </span>
                          <span className="font-semibold text-sm text-foreground truncate max-w-[140px]">
                            {row.product.name}
                          </span>
                        </div>
                        <span className="text-sm font-bold text-accent">{formatMGA(row.revenue)}</span>
                      </div>
                      <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-accent to-accent/70 animate-bar-fill"
                          style={{ '--target-width': `${pct}%` } as React.CSSProperties}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 text-right">{pct.toFixed(1)}% du CA</p>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Summary stats */}
          <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden lg:col-span-2 animate-fade-in-up" style={{ animationDelay: '300ms' }}>
            <div className="px-6 py-5 border-b border-border/30">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h2 className="font-bold text-foreground">Récapitulatif — {periodLabel[period]}</h2>
              </div>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <StatCard label="Produits en catalogue"   value={String(report?.rows?.length ?? 0)}         sub="total"                  icon={Boxes}        delay={0}   />
                <StatCard label="Produits mouvementés"    value={String(report?.activeProductsCount ?? 0)}  sub="sur la période"         icon={TrendingUp}   delay={50}  />
                <StatCard label="Total entrées"           value={`${totals.totalEntries} u.`}               sub="approvisionnement"      icon={ArrowDown}    delay={100} />
                <StatCard label="Total ventes"            value={`${totals.totalSales} u.`}                 sub="avec encaissement"      icon={ShoppingCart} delay={150} />
                <StatCard label="Total crédits"           value={`${totals.totalCredits ?? 0} u.`}          sub="ventes à crédit"        icon={CreditCard}   delay={200} />
                <StatCard label="Marge brute"             value={totals.revenue > 0 ? `${((totals.profit / totals.revenue) * 100).toFixed(1)}%` : '—'} sub="bénéfice / CA" icon={Percent} delay={250} />
              </div>
            </div>
          </div>
        </div>

        {/* TABLEAU DÉTAILLÉ */}
        <div className="glass-card rounded-2xl premium-shadow premium-shadow-hover overflow-hidden animate-fade-in-up" style={{ animationDelay: '400ms' }}>
          <div className="px-6 py-5 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Package className="w-4 h-4 text-primary" />
              </div>
              <h2 className="font-bold text-foreground">Tableau détaillé — {periodLabel[period]}</h2>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {summary.length} ligne{summary.length > 1 ? 's' : ''}
            </span>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/20 bg-muted/30">
                  {[
                    { label: 'Produit',      icon: Package    },
                    { label: 'Catégorie',    icon: Filter     },
                    { label: 'Stk. initial', icon: Boxes      },
                    { label: 'Entrées',      icon: ArrowDown  },
                    { label: 'Ventes',       icon: ShoppingCart },
                    { label: 'Crédits',      icon: CreditCard },
                    { label: 'S/E',          icon: ArrowUpRight },
                    { label: 'Stk. final',   icon: Boxes      },
                    { label: 'Coût',         icon: ArrowDown  },
                    { label: 'CA',           icon: TrendingUp },
                    { label: 'Bénéfice',     icon: Percent    },
                  ].map((col) => (
                    <th key={col.label} className="text-left px-4 py-4 text-[11px] font-bold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      <span className="flex items-center gap-1.5">
                        <col.icon className="w-3 h-3 opacity-50" />
                        {col.label}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/20">
                {summary.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="py-16 text-center">
                      <EmptyState
                        icon={Package}
                        title="Aucune donnée"
                        subtitle="Aucun mouvement enregistré sur cette période"
                      />
                    </td>
                  </tr>
                ) : (
                  summary.map((row, index) => (
                    <tr 
                      key={row.product.id} 
                      className="table-row-anim animate-fade-in-up"
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center text-xs font-bold text-primary">
                            {row.product.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-foreground">{row.product.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-muted/60 text-muted-foreground text-[11px] font-medium">
                          {row.product.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-foreground font-mono text-xs">{row.initialStock}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-semibold text-xs">
                          <ArrowDown className="w-3 h-3" />{row.totalEntries}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sky-600 font-semibold text-xs">
                          <ShoppingCart className="w-3 h-3" />{row.totalSales}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-amber-600 font-semibold text-xs">
                          <CreditCard className="w-3 h-3" />{row.totalCredits ?? 0}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-rose-600 font-semibold text-xs">
                          <ArrowUpRight className="w-3 h-3" />{row.totalNonSaleExits}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${
                          row.finalStock === 0 
                            ? 'bg-destructive/10 text-destructive' 
                            : row.finalStock <= 5 
                              ? 'bg-amber-500/10 text-amber-600' 
                              : 'bg-emerald-500/10 text-emerald-600'
                        }`}>
                          {row.finalStock}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{formatMGA(row.totalCost)}</td>
                      <td className="px-4 py-3 text-sky-600 font-semibold font-mono text-xs">{formatMGA(row.revenue)}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-bold ${
                          row.profit > 0 ? 'text-emerald-600' : row.profit < 0 ? 'text-rose-600' : 'text-muted-foreground'
                        }`}>
                          {row.profit > 0 && <TrendingUp className="w-3 h-3" />}
                          {row.profit < 0 && <TrendingDown className="w-3 h-3" />}
                          {formatMGA(row.profit)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {summary.length > 0 && (
                <tfoot>
                  <tr className="bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-t-2 border-primary/20">
                    <td className="px-4 py-4 font-black text-foreground" colSpan={2}>
                      <span className="flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" />TOTAL</span>
                    </td>
                    <td className="px-4 py-4 font-black text-foreground font-mono text-xs">{totals.initialStock}</td>
                    <td className="px-4 py-4 font-black text-emerald-600 text-xs">+{totals.totalEntries}</td>
                    <td className="px-4 py-4 font-black text-sky-600 text-xs">{totals.totalSales}</td>
                    <td className="px-4 py-4 font-black text-amber-600 text-xs">{totals.totalCredits ?? 0}</td>
                    <td className="px-4 py-4 font-black text-rose-600 text-xs">{totals.totalNonSaleExits}</td>
                    <td className="px-4 py-4 font-black text-foreground text-xs">{totals.finalStock}</td>
                    <td className="px-4 py-4 font-black text-foreground font-mono text-xs">{formatMGA(totals.totalCost)}</td>
                    <td className="px-4 py-4 font-black text-sky-600 font-mono text-xs">{formatMGA(totals.revenue)}</td>
                    <td className="px-4 py-4 font-black text-xs">
                      <span className={totals.profit > 0 ? 'text-emerald-600' : totals.profit < 0 ? 'text-rose-600' : 'text-muted-foreground'}>
                        {formatMGA(totals.profit)}
                      </span>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}