import { useMemo, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart3, TrendingUp, TrendingDown, Download, FileText } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
import api from "@/services/api";
import { 
  extractHydraMembers, 
  formatCurrency, 
  computeReportsStats 
} from "@/lib/madafit";

export default function Reports() {
  const revenueChartRef = useRef<HTMLDivElement>(null);
  const membersChartRef = useRef<HTMLDivElement>(null);
  const attendanceChartRef = useRef<HTMLDivElement>(null);
  
  const usersQuery = useQuery({ queryKey: ["users", "reports"], queryFn: () => api.users.getAll({ itemsPerPage: 1000 }) });
  const paymentsQuery = useQuery({ queryKey: ["payments", "reports"], queryFn: () => api.payments.getAll({ itemsPerPage: 1000 }) });
  const attendanceQuery = useQuery({ queryKey: ["attendance", "reports"], queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 1000 }) });
  const productsQuery = useQuery({ queryKey: ["products", "reports"], queryFn: () => api.products.getAll({ itemsPerPage: 1000 }) });
  const transactionsQuery = useQuery({ queryKey: ["transactions", "reports"], queryFn: () => api.transactions.getAll({ itemsPerPage: 1000 }) });

  const users = extractHydraMembers(usersQuery.data);
  const payments = extractHydraMembers(paymentsQuery.data);
  const attendance = extractHydraMembers(attendanceQuery.data);
  const products = extractHydraMembers(productsQuery.data);
  const transactions = extractHydraMembers(transactionsQuery.data);

  const stats = useMemo(() => {
    return computeReportsStats(users, payments, attendance, transactions, products);
  }, [users, payments, attendance, transactions, products]);

  const totalAttendance = attendance.length;

  const captureChart = useCallback(async (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return null;
    const canvas = await html2canvas(ref.current, {
      scale: 2,
      backgroundColor: "#ffffff",
      logging: false,
    });
    return canvas.toDataURL("image/png");
  }, []);

  const exportToPDF = async () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 20; // marge
    const CW = W - M * 2; // content width
    let y = M;

    // FIX: helvetica ne supporte pas les accents UTF-8 ni les espaces insécables → on les retire
    const originalText = pdf.text.bind(pdf);
    pdf.text = function(...args: any[]) {
      if (typeof args[0] === 'string') {
        args[0] = args[0]
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .replace(/\u00A0/g, ' ')
          .replace(/\u202F/g, ' ');
      }
      return originalText.apply(pdf, args);
    };

    // ── COULEURS ──
    const C = {
      primary: [220, 53, 69],      // ← FIX: rouge cohérent (thème)
      dark: [33, 37, 41],           // texte principal
      gray: [108, 117, 125],        // texte secondaire
      light: [248, 249, 250],       // fond alterné
      white: [255, 255, 255],
      border: [222, 226, 230],      // lignes tableau
      green: [40, 167, 69],         // positif
      red: [220, 53, 69],           // négatif
    };

    // ── HELPERS TABLEAUX ──
    const drawTable = (
      headers: string[],
      rows: (string | number)[][],
      colWidths: number[],
      startY: number,
      options?: { foot?: (string | number)[]; headColor?: number[]; align?: ("left" | "center" | "right")[] }
    ) => {
      const rowH = 8;
      const headColor = options?.headColor || C.primary;
      const align = options?.align || headers.map(() => "left" as const);
      let cy = startY;

      // Vérifier page pleine
      const needed = (rows.length + 1 + (options?.foot ? 1 : 0)) * rowH + 5;
      if (cy + needed > H - M) {
        pdf.addPage();
        cy = M;
      }

      // En-tête
      pdf.setFillColor(...headColor);
      pdf.rect(M, cy, CW, rowH, "F");
      pdf.setTextColor(...C.white);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      let cx = M;
      headers.forEach((h, i) => {
        const w = colWidths[i] * CW;
        const text = typeof h === "string" ? h : String(h);
        pdf.text(text, align[i] === "center" ? cx + w / 2 : cx + 3, cy + 5.5, { align: align[i] === "center" ? "center" : "left" });
        cx += w;
      });
      cy += rowH;

      // Lignes
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
          const text = String(cell);
          pdf.text(text, align[i] === "center" ? cx + w / 2 : cx + 3, cy + 5.5, { align: align[i] === "center" ? "center" : "left" });
          cx += w;
        });
        cy += rowH;
      });

      // Pied optionnel
      if (options?.foot) {
        pdf.setFillColor(240, 240, 240);
        pdf.rect(M, cy, CW, rowH, "F");
        pdf.setTextColor(...C.primary);
        pdf.setFont("helvetica", "bold");
        cx = M;
        options.foot.forEach((cell, i) => {
          const w = colWidths[i] * CW;
          pdf.text(String(cell), align[i] === "center" ? cx + w / 2 : cx + 3, cy + 5.5, { align: align[i] === "center" ? "center" : "left" });
          cx += w;
        });
        cy += rowH;
      }

      // Bordure extérieure
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.rect(M, startY, CW, cy - startY);

      return cy + 5;
    };

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 1 : EN-TÊTE + KPI + GRAPHIQUES
    // ═══════════════════════════════════════════════════════════════════════

    // Logo + titre
    pdf.setTextColor(...C.primary);
    pdf.setFontSize(24);
    pdf.setFont("helvetica", "bold");
    pdf.text("MADAFIT", M, y);
    
    pdf.setTextColor(...C.gray);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("Rapport d'activité", M, y + 6);

    pdf.setTextColor(...C.gray);
    pdf.setFontSize(9);
    pdf.text(`Généré le ${new Date().toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`, W - M, y, { align: "right" });

    y += 18;

    // Ligne séparatrice
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, W - M, y);
    y += 10;

    // ── KPI EN LIGNE ──
    const kpiData = [
      { label: "Revenu 6 mois", value: formatCurrency(stats.totalRevenue), trend: `${stats.revenueTrend > 0 ? "+" : ""}${stats.revenueTrend}%`, color: stats.revenueTrend >= 0 ? C.green : C.red },
      { label: "Membres actifs", value: String(stats.activeMembers), trend: `+${stats.currentNewMembers}`, color: C.green },
      { label: "Fréquentation", value: String(totalAttendance), trend: `${stats.attendanceTrend > 0 ? "+" : ""}${stats.attendanceTrend}%`, color: stats.attendanceTrend >= 0 ? C.green : C.red },
      { label: "Rétention", value: `${stats.retentionRate}%`, trend: stats.retentionRate >= 80 ? "Excellent" : "Bon", color: C.primary },
    ];

    const kpiW = (CW - 9) / 4;
    kpiData.forEach((k, i) => {
      const x = M + i * (kpiW + 3);
      // Cadre
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, kpiW, 22, 2, 2, "S");
      // Label
      pdf.setTextColor(...C.gray);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text(k.label.toUpperCase(), x + 4, y + 7);
      // Valeur
      pdf.setTextColor(...C.dark);
      pdf.setFontSize(13);
      pdf.setFont("helvetica", "bold");
      pdf.text(k.value, x + 4, y + 16);
      // Trend
      pdf.setTextColor(...k.color);
      pdf.setFontSize(8);
      pdf.text(k.trend, x + kpiW - 4, y + 16, { align: "right" });
    });
    y += 30;

    // ── GRAPHIQUES (captures ciblées) ──
    const revImg = await captureChart(revenueChartRef);
    if (revImg) {
      pdf.setTextColor(...C.dark);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Revenus mensuels", M, y);
      y += 5;
      pdf.addImage(revImg, "PNG", M, y, CW / 2 - 5, 55);
      y += 60;
    }

    const memImg = await captureChart(membersChartRef);
    if (memImg) {
      pdf.setTextColor(...C.dark);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Évolution des membres", M + CW / 2 + 5, y - 60);
      pdf.addImage(memImg, "PNG", M + CW / 2 + 5, y - 55, CW / 2 - 5, 55);
    }

    const attImg = await captureChart(attendanceChartRef);
    if (attImg) {
      pdf.setTextColor(...C.dark);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "bold");
      pdf.text("Fréquentation hebdomadaire", M, y);
      y += 5;
      pdf.addImage(attImg, "PNG", M, y, CW / 2 - 5, 45);
      y += 55;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // PAGE 2+ : TABLEAUX DE DONNÉES
    // ═══════════════════════════════════════════════════════════════════════
    pdf.addPage();
    y = M;

    // ── REVENUS DÉTAILLÉS ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Détail mensuel des revenus", M, y);
    y += 8;

    y = drawTable(
      ["Mois", "Revenus", "Nouveaux membres", "Total membres"],
      stats.monthlyData.map((r: any) => [r.month, formatCurrency(r.revenue), r.new, r.members]),
      [0.2, 0.3, 0.25, 0.25],
      y,
      {
        foot: ["TOTAL", formatCurrency(stats.totalRevenue), stats.monthlyData.reduce((s: number, r: any) => s + r.new, 0), "-"],
        align: ["left", "right", "center", "center"],
      }
    );

    // ── FRÉQUENTATION HEBDO ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Fréquentation hebdomadaire", M, y);
    y += 8;

    y = drawTable(
      ["Jour", "Passages"],
      stats.weeklyAttendance.map((r: any) => [r.day, r.visits]),
      [0.5, 0.5],
      y,
      {
        foot: ["TOTAL", stats.weeklyAttendance.reduce((s: number, r: any) => s + r.visits, 0)],
        align: ["left", "center"],
      }
    );

    // ── MEMBRES ACTIFS ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Membres actifs", M, y);
    y += 8;

    const activeUsers = users.filter((u: any) => 
      u.status?.toLowerCase() === "active" || u.status?.toLowerCase() === "actif"
    );

    y = drawTable(
      ["ID", "Nom", "Email", "Téléphone", "Abonnement"],
      activeUsers.slice(0, 20).map((u: any) => [
        u.id || "-",
        (u.fullName || `${u.firstName || ""} ${u.lastName || ""}`.trim()) || "Inconnu",
        u.email || "-",
        u.phone || "-",
        u.subscription || "-",
      ]),
      [0.08, 0.27, 0.30, 0.20, 0.15],
      y
    );

    // ── PAIEMENTS RÉCENTS ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Paiements récents", M, y);
    y += 8;

    y = drawTable(
      ["ID", "Membre", "Montant", "Méthode", "Date"],
      [...payments]
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 15)
        .map((p: any) => [
          p.id || "-",
          p.memberName || "-",
          formatCurrency(p.amount),
          p.method || "-",
          p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "-",
        ]),
      [0.08, 0.30, 0.22, 0.20, 0.20],
      y,
      { align: ["left", "left", "right", "left", "center"] }
    );

    // ── INVENTAIRE PRODUITS ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("Inventaire produits", M, y);
    y += 8;

    y = drawTable(
      ["ID", "Nom", "Catégorie", "Prix vente", "Stock", "État"],
      products.map((p: any) => {
        const isLow = p.currentStock <= 5;
        const isOut = p.currentStock === 0;
        return [
          p.id || "-",
          p.name || "-",
          p.category || "-",
          formatCurrency(p.salePrice),
          p.currentStock,
          isOut ? "RUPTURE" : isLow ? "FAIBLE" : "OK",
        ];
      }),
      [0.08, 0.30, 0.20, 0.17, 0.10, 0.15],
      y,
      { align: ["left", "left", "left", "right", "center", "center"] }
    );

    // ── SYNTHÈSE API ──
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(13);
    pdf.setFont("helvetica", "bold");
    pdf.text("État de synchronisation", M, y);
    y += 8;

    y = drawTable(
      ["Endpoint", "Statut", "Enregistrements"],
      [
        ["Utilisateurs", usersQuery.status, users.length],
        ["Paiements", paymentsQuery.status, payments.length],
        ["Fréquentation", attendanceQuery.status, attendance.length],
        ["Produits", productsQuery.status, products.length],
        ["Transactions", transactionsQuery.status, transactions.length],
      ],
      [0.4, 0.3, 0.3],
      y,
      { align: ["left", "center", "center"] }
    );

    // ── PIED DE PAGE ──
    const totalPages = pdf.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.line(M, H - 15, W - M, H - 15);
      pdf.setTextColor(...C.gray);
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "normal");
      pdf.text("MADAFIT - Système de gestion de salle de sport", M, H - 8);
      pdf.text(`Page ${i} / ${totalPages}`, W - M, H - 8, { align: "right" });
    }

    pdf.save(`madafit-rapport-${new Date().toISOString().split("T")[0]}.pdf`);
  };

  const exportToCSV = () => {
    const now = new Date();
    const timestamp = now.toISOString().split("T")[0];
    const filename = `madafit-rapport-${timestamp}.csv`;

    let csv = "\uFEFF";

    csv += "═══════════════════════════════════════════════════════════════════════\n";
    csv += "                        MADAFIT - RAPPORT COMPLET\n";
    csv += "═══════════════════════════════════════════════════════════════════════\n";
    csv += `Généré le;${now.toLocaleDateString("fr-FR")} à ${now.toLocaleTimeString("fr-FR")}\n`;
    csv += `Période;6 derniers mois\n`;
    csv += "═══════════════════════════════════════════════════════════════════════\n\n";

    csv += "┌──────────────────────────────┬──────────────────┬─────────────┐\n";
    csv += "│ INDICATEUR                   │ VALEUR           │ TENDANCE    │\n";
    csv += "├──────────────────────────────┼──────────────────┼─────────────┤\n";
    csv += `│ Revenu total (6 mois)        │ ${formatCurrency(stats.totalRevenue).padEnd(16)} │ ${(stats.revenueTrend > 0 ? "+" : "") + stats.revenueTrend + "%".padEnd(10)} │\n`;
    csv += `│ Membres actifs               │ ${String(stats.activeMembers).padEnd(16)} │ +${String(stats.currentNewMembers).padEnd(9)} │\n`;
    csv += `│ Fréquentation totale         │ ${String(totalAttendance).padEnd(16)} │ ${(stats.attendanceTrend > 0 ? "+" : "") + stats.attendanceTrend + "%".padEnd(10)} │\n`;
    csv += `│ Taux de rétention            │ ${(stats.retentionRate + "%").padEnd(16)} │ ${(stats.retentionRate >= 80 ? "Excellent" : stats.retentionRate >= 60 ? "Bon" : "À surveiller").padEnd(11)} │\n`;
    csv += "└──────────────────────────────┴──────────────────┴─────────────┘\n\n";

    csv += "┌────────────┬──────────────────┬────────────────┬──────────────┐\n";
    csv += "│ MOIS       │ REVENUS          │ NOUVEAUX       │ TOTAL        │\n";
    csv += "├────────────┼──────────────────┼────────────────┼──────────────┤\n";
    stats.monthlyData.forEach((row: any) => {
      csv += `│ ${row.month.padEnd(10)} │ ${formatCurrency(row.revenue).padEnd(16)} │ ${String(row.new).padEnd(14)} │ ${String(row.members).padEnd(12)} │\n`;
    });
    csv += "├────────────┼──────────────────┼────────────────┼──────────────┤\n";
    csv += `│ ${"TOTAL".padEnd(10)} │ ${formatCurrency(stats.totalRevenue).padEnd(16)} │ ${String(stats.monthlyData.reduce((s: number, r: any) => s + r.new, 0)).padEnd(14)} │ ${"-".padEnd(12)} │\n`;
    csv += "└────────────┴──────────────────┴────────────────┴──────────────┘\n\n";

    csv += "┌─────────┬──────────┐\n";
    csv += "│ JOUR    │ PASSAGES │\n";
    csv += "├─────────┼──────────┤\n";
    stats.weeklyAttendance.forEach((row: any) => {
      csv += `│ ${row.day.padEnd(7)} │ ${String(row.visits).padEnd(8)} │\n`;
    });
    csv += "├─────────┼──────────┤\n";
    csv += `│ ${"TOTAL".padEnd(7)} │ ${String(stats.weeklyAttendance.reduce((s: number, r: any) => s + r.visits, 0)).padEnd(8)} │\n`;
    csv += "└─────────┴──────────┘\n\n";

    csv += "MEMBRES ACTIFS\n";
    csv += "ID;Nom;Email;Téléphone;Statut;Abonnement;Inscription;Dernière visite\n";
    users
      .filter((u: any) => u.status?.toLowerCase() === "active" || u.status?.toLowerCase() === "actif")
      .forEach((u: any) => {
        csv += `${u.id || "-"};${(u.fullName || `${u.firstName || ""} ${u.lastName || ""}`.trim()) || "Inconnu"};${u.email || "-"};${u.phone || "-"};${u.status || "-"};${u.subscription || "-"};${u.joinDate ? new Date(u.joinDate).toLocaleDateString("fr-FR") : "-"};${u.lastVisit ? new Date(u.lastVisit).toLocaleDateString("fr-FR") : "-"}\n`;
      });
    csv += "\n";

    csv += "PAIEMENTS RÉCENTS (20 derniers)\n";
    csv += "ID;Membre;Montant;Méthode;Date;Abonnement\n";
    [...payments]
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 20)
      .forEach((p: any) => {
        csv += `${p.id || "-"};${p.memberName || "-"};${formatCurrency(p.amount)};${p.method || "-"};${p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "-"};${p.subscription || "-"}\n`;
      });
    csv += "\n";

    csv += "PRODUITS EN STOCK\n";
    csv += "ID;Nom;Catégorie;Prix achat;Prix vente;Stock initial;Stock actuel;Alerte\n";
    products.forEach((p: any) => {
      const isLow = p.currentStock <= 5;
      const isOut = p.currentStock === 0;
      const alert = isOut ? "🔴 RUPTURE" : isLow ? "🟡 FAIBLE" : "🟢 OK";
      csv += `${p.id || "-"};${p.name || "-"};${p.category || "-"};${formatCurrency(p.purchasePrice)};${formatCurrency(p.salePrice)};${p.initialStock};${p.currentStock};${alert}\n`;
    });
    csv += "\n";

    csv += "TRANSACTIONS PRODUITS\n";
    csv += "ID;Type;Produit;Quantité;Prix unitaire;Date;Note\n";
    transactions.forEach((t: any) => {
      const productName = typeof t.product === "object" && t.product ? t.product.name : t.product || "-";
      csv += `${t.id || "-"};${t.type || "-"};${productName};${t.quantity};${t.unitPrice ? formatCurrency(t.unitPrice) : "-"};${t.date ? new Date(t.date).toLocaleDateString("fr-FR") : "-"};${t.note || "-"}\n`;
    });
    csv += "\n";

    csv += "SYNTHÈSE API\n";
    csv += "Endpoint;Statut;Enregistrements\n";
    csv += `Utilisateurs;${usersQuery.status};${users.length}\n`;
    csv += `Paiements;${paymentsQuery.status};${payments.length}\n`;
    csv += `Fréquentation;${attendanceQuery.status};${attendance.length}\n`;
    csv += `Produits;${productsQuery.status};${products.length}\n`;
    csv += `Transactions;${transactionsQuery.status};${transactions.length}\n`;

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Rapports & Statistiques</h1>
          <p className="page-subtitle">Donnees synchronisees en temps reel avec le backend</p>
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

      <div className="space-y-6">
        {/* KPI Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Revenu total (6 mois)", value: formatCurrency(stats.totalRevenue), trend: `${stats.revenueTrend > 0 ? '+' : ''}${stats.revenueTrend}%`, up: stats.revenueTrend >= 0 },
            { label: "Membres actifs", value: String(stats.activeMembers), trend: `${stats.currentNewMembers > 0 ? '+' : ''}${stats.currentNewMembers}`, up: stats.currentNewMembers >= 0 },
            { label: "Fréquentation totale", value: String(totalAttendance), trend: `${stats.attendanceTrend > 0 ? '+' : ''}${stats.attendanceTrend}%`, up: stats.attendanceTrend >= 0 },
            { label: "Taux de rétention", value: `${stats.retentionRate}%`, trend: `${stats.retentionRate > 50 ? '+' : ''}${stats.retentionRate - 50}%`, up: stats.retentionRate >= 50 },
          ].map((kpi) => (
            <div key={kpi.label} className="stat-card">
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-2xl font-black text-foreground mt-1">{kpi.value}</p>
              <div className="flex items-center gap-1 mt-1">
                {kpi.up
                  ? <TrendingUp size={12} className="text-accent" />
                  : <TrendingDown size={12} className="text-primary" />}
                <span className={`text-xs font-semibold ${kpi.up ? "text-accent" : "text-primary"}`}>{kpi.trend}</span>
                <span className="text-xs text-muted-foreground">vs mois préc.</span>
              </div>
            </div>
          ))}
        </div>

        {/* Revenue & Members */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="stat-card" ref={revenueChartRef}>
            <h3 className="font-bold text-foreground mb-1">Revenus mensuels</h3>
            <p className="text-xs text-muted-foreground mb-4">Derniers mois d'activite</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={stats.monthlyData}>
                <defs>
                  <linearGradient id="revGrad2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v / 1000}K`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  formatter={(v: number) => [formatCurrency(v), "Revenus"]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#revGrad2)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-card" ref={membersChartRef}>
            <h3 className="font-bold text-foreground mb-1">Évolution des membres</h3>
            <p className="text-xs text-muted-foreground mb-4">Total membres et nouveaux inscrits</p>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={stats.monthlyData} barSize={24}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  cursor={{ fill: "hsl(var(--primary) / 0.06)" }}
                />
                <Bar dataKey="members" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} name="Total membres" />
                <Bar dataKey="new" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} name="Nouveaux" />
                <Legend wrapperStyle={{ fontSize: "12px" }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Attendance & Subscription */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="stat-card" ref={attendanceChartRef}>
            <h3 className="font-bold text-foreground mb-1">Fréquentation hebdomadaire</h3>
            <p className="text-xs text-muted-foreground mb-4">Repartitions des entrees par jour</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={stats.weeklyAttendance} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }}
                  cursor={{ fill: "hsl(var(--primary) / 0.06)" }} />
                <Bar dataKey="visits" fill="hsl(220 70% 55%)" radius={[6, 6, 0, 0]} name="Passages" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="stat-card">
            <h3 className="font-bold text-foreground mb-1">Sante du systeme API</h3>
            <p className="text-xs text-muted-foreground mb-4">Etat de la synchronisation</p>
            <div className="space-y-4 pt-2">
              <ApiHealthRow label="Utilisateurs" status={usersQuery.status} count={users.length} />
              <ApiHealthRow label="Paiements" status={paymentsQuery.status} count={payments.length} />
              <ApiHealthRow label="Attendance" status={attendanceQuery.status} count={attendance.length} />
              <ApiHealthRow label="Produits" status={productsQuery.status} count={products.length} />
              <ApiHealthRow label="Transactions" status={transactionsQuery.status} count={transactions.length} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiHealthRow({ label, status, count }: { label: string; status: string; count: number }) {
  const isOk = status === "success";
  return (
    <div className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: isOk ? "hsl(var(--accent) / 0.3)" : "hsl(var(--border))", background: isOk ? "hsl(var(--accent) / 0.05)" : "transparent" }}>
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${isOk ? "bg-accent" : "bg-muted"}`} />
        <span className="text-sm font-semibold text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-xs text-muted-foreground">{count} enregistrements</span>
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${isOk ? "bg-accent/10 text-accent" : "bg-muted text-muted-foreground"}`}>
          {status}
        </span>
      </div>
    </div>
  );
}