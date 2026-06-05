import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Trash2, Filter, Loader2, StickyNote, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import api from '@/services/api';
import { refreshNotifications } from '@/services/api';
import {
  extractHydraMembers,
  formatCurrency,
  extractIdFromIri
} from '@/lib/madafit';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Product, Transaction } from '@/types/entities';

type Period = 'today' | 'week' | 'month' | 'custom';

const periodLabelMap: Record<Period, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois',
  custom: 'Periode personnalisee',
};

function getDateRange(period: Period, from: string, to: string): { from: Date; to: Date } {
  const now = new Date();
  if (period === 'today') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59),
    };
  }
  if (period === 'week') {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday, to: sunday };
  }
  if (period === 'month') {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59),
    };
  }
  return {
    from: from ? new Date(from + 'T00:00:00') : new Date(0),
    to: to ? new Date(to + 'T23:59:59') : new Date(9999, 0),
  };
}

const TX_TYPE_INFO: Record<string, { label: string; badgeClass: string; marker: string }> = {
  entry: { label: 'Entrée', badgeClass: 'bg-success/10 text-success', marker: 'bg-success' },
  charge: { label: 'Charge', badgeClass: 'bg-success/10 text-success', marker: 'bg-success' },
  sale: { label: 'Vente', badgeClass: 'bg-accent/10 text-accent', marker: 'bg-accent' },
  non_sale_exit: { label: 'Sortie S/E', badgeClass: 'bg-destructive/10 text-destructive', marker: 'bg-destructive' },
  credit: { label: 'Crédit', badgeClass: 'bg-amber-500/10 text-amber-600', marker: 'bg-amber-500' },
  other_charge: { label: 'Autre Chrg.', badgeClass: 'bg-destructive/10 text-destructive', marker: 'bg-destructive' },
};

export default function History() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<Period>('today');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [productFilter, setProductFilter] = useState<string>('all');
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const productsQuery = useQuery({ queryKey: ['products'], queryFn: () => api.products.getAll({ itemsPerPage: 1000 }) });
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: () => api.transactions.getAll({ itemsPerPage: 1000 }) });

  const products = extractHydraMembers<Product>(productsQuery.data);
  const allTransactions = extractHydraMembers<Transaction>(transactionsQuery.data);

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      toast.success("Transaction supprimee");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      refreshNotifications();
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  const { from, to } = getDateRange(period, fromDate, toDate);

  const transactions = useMemo(() => {
    return allTransactions
      .filter((t) => {
        const d = new Date(t.date);
        const inRange = d >= from && d <= to;
        const typeMatch = typeFilter === 'all' || t.type === typeFilter;

        const productId = extractIdFromIri(t.product);
        const productMatch = productFilter === 'all' || String(productId) === productFilter;

        return inRange && typeMatch && productMatch;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allTransactions, period, from, to, typeFilter, productFilter]);

  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[p.id!] = p));
    return m;
  }, [products]);

  const stats = useMemo(() => {
    let revenue = 0;
    let cost = 0;
    let entries = 0;
    let exits = 0;
    transactions.forEach((t) => {
      const productId = extractIdFromIri(t.product);
      const p = productId ? productMap[productId] : null;
      if (!p) return;

      if (t.type === 'entry' || t.type === 'charge') entries += t.quantity;
      else if (t.type !== 'other_charge') exits += t.quantity;

      if (t.type === 'sale' || t.type === 'credit') {
        revenue += t.quantity * (t.unitPrice ?? p.salePrice);
        cost += t.quantity * p.purchasePrice;
      }
    });
    return { revenue, cost, profit: revenue - cost, entries, exits };
  }, [transactions, productMap]);

  // ── Export CSV ────────────────────────────────────────────────────────────────
  const exportToCSV = () => {
    if (transactions.length === 0) {
      toast.error("Aucune transaction a exporter");
      return;
    }

    // FIX: normaliser les montants pour CSV (virgule comme separateur decimal, espace simple comme separateur de milliers)
    const formatCSV = (v: number) => {
      const abs = Math.abs(v);
      const intPart = Math.floor(abs);
      const decPart = Math.round((abs - intPart) * 100);
      const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
      const decStr = decPart.toString().padStart(2, '0');
      return (v < 0 ? '-' : '') + intStr + (decPart > 0 ? ',' + decStr : '') + ' Ar';
    };

    const headers = ['Date', 'Produit', 'Type', 'Quantite', 'Prix unitaire', 'Montant', 'Note'];

    const rows = transactions.map((tx) => {
      const productId = extractIdFromIri(tx.product);
      const product = productId ? productMap[productId] : null;
      const info = TX_TYPE_INFO[tx.type] || { label: tx.type };

      let unitPrice = 0;
      let amount = 0;
      let amountLabel = '';

      if (product) {
        if (tx.type === 'sale' || tx.type === 'credit') {
          unitPrice = tx.unitPrice ?? product.salePrice;
          amount = tx.quantity * unitPrice;
          amountLabel = 'CA';
        } else if (tx.type === 'entry' || tx.type === 'charge') {
          unitPrice = tx.unitPrice ?? product.purchasePrice;
          amount = tx.quantity * unitPrice;
          amountLabel = 'Investissement';
        } else if (tx.type === 'non_sale_exit' || tx.type === 'other_charge') {
          unitPrice = tx.unitPrice ?? product.purchasePrice;
          amount = tx.quantity * unitPrice;
          amountLabel = 'Perte';
        }
      }

      return [
        new Date(tx.date).toLocaleDateString('fr-FR'),
        product?.name || 'Inconnu',
        info.label,
        (tx.type === 'entry' || tx.type === 'charge' ? '+' : '-') + tx.quantity,
        unitPrice > 0 ? formatCSV(unitPrice) : '-',
        amount > 0 ? formatCSV(amount) + (amountLabel ? ` (${amountLabel})` : '') : '-',
        tx.note || '',
      ];
    });

    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

    // Lignes de synthese
    const totalEntriesCost = transactions
      .filter((t) => t.type === 'entry' || t.type === 'charge')
      .reduce((sum, t) => {
        const pid = extractIdFromIri(t.product);
        const p = pid ? productMap[pid] : null;
        return sum + (p ? t.quantity * (t.unitPrice ?? p.purchasePrice) : 0);
      }, 0);

    const totalSalesRevenue = transactions
      .filter((t) => t.type === 'sale' || t.type === 'credit')
      .reduce((sum, t) => {
        const pid = extractIdFromIri(t.product);
        const p = pid ? productMap[pid] : null;
        return sum + (p ? t.quantity * (t.unitPrice ?? p.salePrice) : 0);
      }, 0);

    const totalLoss = transactions
      .filter((t) => t.type === 'non_sale_exit' || t.type === 'other_charge')
      .reduce((sum, t) => {
        const pid = extractIdFromIri(t.product);
        const p = pid ? productMap[pid] : null;
        return sum + (p ? t.quantity * (t.unitPrice ?? p.purchasePrice) : 0);
      }, 0);

    const totalCost = transactions
      .filter((t) => t.type === 'sale' || t.type === 'credit')
      .reduce((sum, t) => {
        const pid = extractIdFromIri(t.product);
        const p = pid ? productMap[pid] : null;
        return sum + (p ? t.quantity * p.purchasePrice : 0);
      }, 0);

    const lines = [
      [escape('MADAFIT - Historique des transactions')],
      [escape(`Periode : ${period === 'custom' ? `${fromDate} au ${toDate}` : periodLabelMap[period]}`)],
      [escape(`Genere le : ${new Date().toLocaleDateString('fr-FR')} a ${new Date().toLocaleTimeString('fr-FR')}`)],
      [escape(`Transactions : ${transactions.length}`)],
      [],
      headers.map(escape),
      ...rows.map((r) => r.map(escape)),
      [],
      [escape(''), escape(''), escape(''), escape(''), escape('SYNTHESE'), escape(''), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Total entrees (investissement)'), escape(formatCSV(totalEntriesCost)), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Total sorties S/E (pertes)'), escape(formatCSV(totalLoss)), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Total ventes + credits (CA)'), escape(formatCSV(totalSalesRevenue)), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Cout des marchandises vendues'), escape(formatCSV(totalCost)), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Benefice net'), escape(formatCSV(totalSalesRevenue - totalCost)), escape('')],
      [],
      [escape(''), escape(''), escape(''), escape(''), escape('Nombre total d entrees'), escape(String(stats.entries) + ' u.'), escape('')],
      [escape(''), escape(''), escape(''), escape(''), escape('Nombre total de sorties'), escape(String(stats.exits) + ' u.'), escape('')],
    ];

    // FIX: BOM explicite + saut de ligne CRLF pour compatibilite Excel
    const csv = '\uFEFF' + lines.map((l) => l.join(';')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historique-transactions_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("CSV exporte");
  };

  // ── Export PDF ────────────────────────────────────────────────────────────────
  const exportToPDF = () => {
    if (transactions.length === 0) {
      toast.error("Aucune transaction a exporter");
      return;
    }

    const pdf = new jsPDF('p', 'mm', 'a4');
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 15;
    const CW = W - M * 2;
    let y = M;

    // FIX: helvetica ne supporte pas les accents UTF-8 ni les espaces insecables
    const originalText = pdf.text.bind(pdf);
    pdf.text = function (...args: any[]) {
      if (typeof args[0] === 'string') {
        args[0] = args[0]
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\u00A0/g, ' ')
          .replace(/\u202F/g, ' ');
      }
      return originalText.apply(pdf, args);
    };

    const C: Record<string, [number, number, number]> = {
      primary: [220, 53, 69],
      dark: [33, 37, 41],
      gray: [108, 117, 125],
      light: [248, 249, 250],
      white: [255, 255, 255],
      border: [222, 226, 230],
      green: [40, 167, 69],
      red: [220, 53, 69],
      amber: [245, 158, 11],
    };

    const drawTable = (
      headers: string[],
      rows: (string | number)[][],
      colWidths: number[],
      startY: number,
      options?: { foot?: (string | number)[]; headColor?: [number, number, number]; align?: ("left" | "center" | "right")[] }
    ) => {
      const rowH = 7;
      const headColor: [number, number, number] = options?.headColor || C.primary;
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

    // En-tete
    pdf.setTextColor(...C.primary);
    pdf.setFontSize(20);
    pdf.setFont("helvetica", "bold");
    pdf.text("MADAFIT", M, y);

    pdf.setTextColor(...C.gray);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Historique des transactions", M, y + 6);

    const fromStr = from.toLocaleDateString('fr-FR');
    const toStr = to.toLocaleDateString('fr-FR');
    pdf.text(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, W - M, y, { align: "right" });
    pdf.text(`${periodLabelMap[period]} — ${fromStr} au ${toStr}`, W - M, y + 5, { align: "right" });

    y += 14;
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, W - M, y);
    y += 8;

    // KPIs
    const kpiW = (CW - 9) / 4;
    const kpis: { label: string; value: string; color: [number, number, number] }[] = [
      { label: "ENTREES", value: `${stats.entries} u.`, color: C.green },
      { label: "SORTIES", value: `${stats.exits} u.`, color: C.red },
      { label: "CA PERIODE", value: formatCurrency(stats.revenue), color: C.primary },
      { label: "BENEFICE", value: formatCurrency(stats.profit), color: stats.profit >= 0 ? C.green : C.red },
    ];
    kpis.forEach((k, i) => {
      const x = M + i * (kpiW + 3);
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, kpiW, 18, 2, 2, "S");
      pdf.setTextColor(...C.gray);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(k.label, x + 3, y + 5);
      pdf.setTextColor(...k.color);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(k.value, x + 3, y + 13);
    });
    y += 24;

    // Tableau detaille
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Details des transactions", M, y);
    y += 6;

    y = drawTable(
      ["Date", "Produit", "Type", "Qte", "Montant", "Note"],
      transactions.map((tx) => {
        const productId = extractIdFromIri(tx.product);
        const product = productId ? productMap[productId] : null;
        const info = TX_TYPE_INFO[tx.type] || { label: tx.type };
        let amount = '-';
        if (product) {
          if (tx.type === 'sale' || tx.type === 'credit') {
            amount = formatCurrency(tx.quantity * (tx.unitPrice ?? product.salePrice));
          } else if (tx.type === 'entry' || tx.type === 'charge') {
            amount = 'Inv. ' + formatCurrency(tx.quantity * (tx.unitPrice ?? product.purchasePrice));
          } else if (tx.type === 'non_sale_exit' || tx.type === 'other_charge') {
            amount = 'Perte ' + formatCurrency(tx.quantity * (tx.unitPrice ?? product.purchasePrice));
          }
        }
        return [
          new Date(tx.date).toLocaleDateString('fr-FR'),
          product?.name || 'Inconnu',
          info.label,
          (tx.type === 'entry' || tx.type === 'charge' ? '+' : '-') + tx.quantity,
          amount,
          tx.note || '',
        ];
      }),
      [0.14, 0.22, 0.14, 0.10, 0.20, 0.20],
      y,
      { align: ["left", "left", "left", "center", "right", "left"] }
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
      pdf.text("MADAFIT - Systeme de gestion de salle de sport", M, H - 6);
      pdf.text(`Page ${i} / ${totalPages}`, W - M, H - 6, { align: "right" });
    }

    pdf.save(`historique-transactions_${new Date().toISOString().split('T')[0]}.pdf`);
  };

  function handleDelete() {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Historique des transactions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {transactionsQuery.isLoading ? "Chargement..." : `${transactions.length} mouvement${transactions.length > 1 ? 's' : ''} trouve(s) en base`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exportToCSV}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold border hover:bg-muted transition-colors"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <Download size={16} /> CSV
          </button>
          <button
            onClick={exportToPDF}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <FileText size={16} /> PDF
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-card rounded-xl border border-border shadow-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Filtres</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Période</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Aujourd'hui</SelectItem>
                <SelectItem value="week">Cette semaine</SelectItem>
                <SelectItem value="month">Ce mois</SelectItem>
                <SelectItem value="custom">Intervalle personnalisé</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Type</Label>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les types</SelectItem>
                <SelectItem value="entry">Entrées</SelectItem>
                <SelectItem value="charge">Charges</SelectItem>
                <SelectItem value="sale">Ventes</SelectItem>
                <SelectItem value="credit">Crédits</SelectItem>
                <SelectItem value="non_sale_exit">Sorties S/E</SelectItem>
                <SelectItem value="other_charge">Autres Charges</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Produit</Label>
            <Select value={productFilter} onValueChange={setProductFilter}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous les produits</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {period === 'custom' && (
            <div className="col-span-2 md:col-span-1 grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Du</Label>
                <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Au</Label>
                <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats for period */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Entrées', value: `${stats.entries} u.`, color: 'text-success' },
          { label: 'Sorties', value: `${stats.exits} u.`, color: 'text-destructive' },
          { label: "CA période", value: formatCurrency(stats.revenue), color: 'text-accent' },
          { label: 'Bénéfice', value: formatCurrency(stats.profit), color: stats.profit >= 0 ? 'text-success' : 'text-destructive' },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border shadow-card px-4 py-3">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Transactions list */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/60">
                {['Date', 'Produit', 'Type', 'Quantité', 'Montant', 'Note', ''].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(transactionsQuery.isLoading || productsQuery.isLoading) ? (
                <tr><td colSpan={7} className="text-center py-12"><Loader2 className="animate-spin mx-auto text-muted-foreground" /></td></tr>
              ) : transactions.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Aucune transaction pour cette période</td></tr>
              ) : (
                transactions.map((tx) => {
                  const productId = extractIdFromIri(tx.product);
                  const product = productId ? productMap[productId] : null;
                  const info = TX_TYPE_INFO[tx.type] || { label: tx.type, badgeClass: 'bg-muted', marker: 'bg-muted' };

                  // ═══════════════════════════════════════════════════════════════
                  // INJECTION : calcul du montant pour TOUS les types
                  // ═══════════════════════════════════════════════════════════════
                  let amount: number | null = null;
                  let amountClass = 'text-muted-foreground';
                  let amountPrefix = '';

                  if (product) {
                    if (tx.type === 'sale' || tx.type === 'credit') {
                      amount = tx.quantity * (tx.unitPrice ?? product.salePrice);
                      amountClass = tx.type === 'sale' ? 'text-accent' : 'text-amber-600';
                    } else if (tx.type === 'entry' || tx.type === 'charge') {
                      amount = tx.quantity * (tx.unitPrice ?? product.purchasePrice);
                      amountClass = 'text-sky-600';
                      amountPrefix = '';
                    } else if (tx.type === 'non_sale_exit' || tx.type === 'other_charge') {
                      amount = tx.quantity * (tx.unitPrice ?? product.purchasePrice);
                      amountClass = 'text-rose-500';
                      amountPrefix = 'Perte ';
                    }
                  }

                  const hasNote = tx.note && tx.note.trim().length > 0;
                  // ═══════════════════════════════════════════════════════════════

                  return (
                    <tr key={tx.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                        {new Date(tx.date).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{product?.name || 'Inconnu'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${info.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${info.marker}`} />
                          {info.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">
                        {tx.type === 'entry' || tx.type === 'charge' ? '+' : '−'}{tx.quantity}
                      </td>
                      <td className="px-4 py-3">
                        {amount !== null && amount > 0 ? (
                          <span className={`font-medium ${amountClass}`}>
                            {amountPrefix}{formatCurrency(amount)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        {hasNote ? (
                          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/60 px-2 py-1 rounded-md">
                            <StickyNote className="w-3 h-3 shrink-0 text-amber-500" />
                            <span className="truncate">{tx.note}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => setDeleteId(tx.id!)}
                          className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette transaction ?</AlertDialogTitle>
            <AlertDialogDescription>L'action est irreversible et affectera le stock.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground">
              {deleteMutation.isPending ? "Suppression..." : "Confirmer"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}