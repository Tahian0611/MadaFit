import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, Users, UserCheck, Bell, TrendingUp, TrendingDown, Clock, Activity,
  Receipt, Package, Calculator, Wallet, X, Search, Calendar, Filter, RotateCcw
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
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

type DashboardTransactionLite = {
  type?: string;
  quantity?: number;
  unitPrice?: number;
  product?: { id?: number; purchasePrice?: number } | string | null;
  cashRegister?: string;
};

type CashRegister = "caisse1" | "caisse2";

function resolveCashRegister(value?: string | null): CashRegister {
  return value === "caisse1" ? "caisse1" : "caisse2";
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
) {
  // calcule:
  // - subscriptionTotal (abonnements) = sum(payments.amount)
  // - sortiesTotal = sum(quantity * unitPrice) for type in sale/credit/non_sale_exit
  // - achatsTotal = sum(quantity * product.purchasePrice) for sale/credit/non_sale_exit
  // - entriesTotal = sum(quantity * product.purchasePrice) for type === entry
  // - depensesTotal = achatsTotal + entriesTotal
  // - caTotal = subscriptionTotal + sortiesTotal
  // - resultat = caTotal - depensesTotal


  // Définition validée avec toi :
  // - abonnements = somme payments.amount
  // - sorties = somme transactions (sale + credit + non_sale_exit) avec montant = quantity * unitPrice
  // - achats (coût) = pour sale/credit/non_sale_exit : quantity * product.purchasePrice
  // - entrée (coût) = pour entry : quantity * unitPrice (ou purchasePrice si unitPrice absent)
  // NOTE: pour achats/entrée, on utilise unitPrice si présent.

  const productMap = (products ?? []).reduce<Record<string, Product>>((acc, product) => {
    if (product.id) acc[String(product.id)] = product;
    return acc;
  }, {});

  const cashierPayments = (payments ?? []).filter((payment) =>
    resolveCashRegister(payment.cashRegister) === cashRegister
  );

  const cashierTransactions = (transactions ?? []).filter((tx) =>
    resolveCashRegister(tx.cashRegister) === cashRegister
  );

  const subscriptionTotal = cashierPayments.reduce((sum, p) => sum + (p.amount ?? 0), 0);

  // sorties chiffre d'affaire : seulement ventes (on ignore credit dans le CA car pas encaissé)
  const salesRevenueTypes = new Set(['sale', 'credit']);
  const sortiesTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesRevenueTypes.has(tx.type)) return sum;
    if (tx.type === 'credit') return sum; // On ignore le montant du crédit dans le CA total
    const qty = Number(tx.quantity ?? 0);
    const unit = Number(tx.unitPrice ?? 0);
    return sum + qty * unit;
  }, 0);

  // coûts d'achats et dépenses (on ignore credit dans le résultat car pas encore de gain/perte réalisé)
  const salesTypes = new Set(['sale', 'credit', 'non_sale_exit']);
  const achatsTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesTypes.has(tx.type)) return sum;
    if (tx.type === 'credit') return sum; // On ignore le coût du crédit dans le calcul du résultat actuel
    const qty = Number(tx.quantity ?? 0);

    // unitPrice contient souvent le prix de vente (donc pour le coût on prend purchasePrice si dispo via product)
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
    // Listes pour les modales
    items: {
      payments: cashierPayments,
      sorties: cashierTransactions.filter(tx => salesRevenueTypes.has(tx.type)),
      depenses: cashierTransactions.filter(tx => expenseTypes.has(tx.type) || salesTypes.has(tx.type)),
      achats: cashierTransactions.filter(tx => salesTypes.has(tx.type)),
      entries: cashierTransactions.filter(tx => expenseTypes.has(tx.type)),
    },
    productMap // Ajouté ici
  };
}

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

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
  });
  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 100 }),
  });
  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
  });
  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.transactions.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 1000 }),
    enabled: showCashierStats,
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

  const caisse1Stats = useMemo(
    () => computeCashierCAStats(payments, transactions, products, "caisse1"),
    [payments, transactions, products],
  );
  const caisse2Stats = useMemo(
    () => computeCashierCAStats(payments, transactions, products, "caisse2"),
    [payments, transactions, products],
  );

  const filteredDetailData = useMemo(() => {
    if (!activeDetail) return [];
    let data = activeDetail.data;
    if (searchTerm) {
      const lower = searchTerm.toLowerCase();
      data = data.filter(item => {
        const designation = activeDetail.type === 'payments' 
          ? item.memberName 
          : (item.productName || (typeof item.product === 'object' ? item.product?.name : null) || 'Charge/Divers');
        return designation?.toLowerCase().includes(lower);
      });
    }
    return data;
  }, [activeDetail, searchTerm]);

  const globalStats = useMemo(() => ({
    caTotal: caisse1Stats.caTotal + caisse2Stats.caTotal,
    depensesTotal: caisse1Stats.depensesTotal + caisse2Stats.depensesTotal,
    resultat: caisse1Stats.resultat + caisse2Stats.resultat,
  }), [caisse1Stats, caisse2Stats]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header flex justify-between items-end">
        <div>
          <h1 className="page-title">Tableau de bord</h1>
          <p className="page-subtitle">Statistiques en temps réel de votre salle</p>
        </div>
        <div className="hidden md:block text-right">
          <p className="text-xs font-bold text-muted-foreground uppercase">Dernière mise à jour</p>
          <p className="text-sm font-bold text-foreground">{new Date().toLocaleTimeString()}</p>
        </div>
      </div>

      {/* ── Résumé Caisse en premier plan ─────────────────────── */}
      {showCashierStats && (
        <div className="mb-8 grid grid-cols-1 md:grid-cols-2 gap-4">
          {isReception && !isAdmin && (
            <div 
              className="p-6 bg-card rounded-2xl border border-border shadow-lg cursor-pointer hover:border-primary/50 transition-all flex items-center justify-between group"
              onClick={() => setActiveCaisseModal("caisse1")}
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

          <div className={`p-5 rounded-2xl border shadow-md flex flex-col justify-center relative overflow-hidden group ${
            globalStats.resultat >= 0 ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
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
              <button
                onClick={() => setActiveCaisseModal(null)}
                className="p-2 hover:bg-muted rounded-full transition-colors"
              >
                <X size={20} />
              </button>
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
                onClick={() => {
                  setActiveDetail(null);
                  setSearchTerm("");
                }}
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
                            {activeDetail.type === 'payments' ? (item as any).memberName : ((item as any).productName || (typeof (item as any).product === 'object' ? (item as any).product?.name : null) || 'Charge/Divers')}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {activeDetail.type === 'payments' ? ((item as any).subscription || 'Abonnement') : `Type: ${(item as any).type}`}
                          </p>
                        </td>
                        <td className="p-4 text-xs font-bold text-muted-foreground">
                          {activeDetail.type === 'payments' ? (item as any).method : `${(item as any).quantity || 1} x ${formatCurrency((item as any).unitPrice)}`}
                        </td>
                        <td className="p-4 text-sm font-black text-primary text-right group-hover:scale-110 transition-transform origin-right">
                          {formatCurrency(activeDetail.type === 'payments' ? (item as any).amount : (((item as any).quantity || 0) * ((item as any).unitPrice || 0)))}
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
                    {formatCurrency(filteredDetailData.reduce((sum, item) => 
                      sum + (activeDetail.type === 'payments' ? ((item as any).amount || 0) : (((item as any).quantity || 0) * ((item as any).unitPrice || 0))), 0)
                    )}
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
            value={formatCurrency(stats.totalRevenue)}
            trend={stats.revenueDiff}
            trendSuffix="%"
          />
        )}
        <StatCard
          icon={UserCheck}
          label="Membres actifs"
          value={String(stats.activeMembers)}
          trend={stats.membersDiff}
          trendSuffix=""
        />
        <StatCard
          icon={Activity}
          label="Fréquentation"
          value={String(stats.totalAttendance)}
          trend={stats.attendanceDiff}
          trendSuffix="%"
        />
        <StatCard
          icon={TrendingUp}
          label="Taux de rétention"
          value={`${stats.retentionRate}%`}
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
                <AreaChart data={stats.monthlyData}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#8884d8" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                  />
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
                {stats.unreadNotifications} NEW
              </span>
            </div>
            <div className="space-y-4">
              {stats.expiredMembers > 0 ? (
                <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                  <p className="text-sm font-semibold text-foreground">Abonnements expirés</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {stats.expiredMembers} membre{stats.expiredMembers > 1 ? "s" : ""} avec abonnement expiré.
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
                      {stats.inGymNow} Personne{stats.inGymNow > 1 ? "s" : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground">Présents en salle</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}



      {!isAdmin && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {/* inGymNow */}
          <div className="stat-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-foreground">Présents en salle</h3>
            </div>
            <div className="flex items-center gap-4 p-4 bg-primary/5 rounded-xl border border-primary/10">
              <Users className="text-primary w-10 h-10" />
              <div>
                <p className="text-4xl font-black text-foreground">{stats.inGymNow}</p>
                <p className="text-sm text-muted-foreground">personnes actuellement</p>
              </div>
            </div>
            {stats.expiredMembers > 0 && (
              <div className="mt-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <p className="text-sm font-semibold text-amber-600">
                  ⚠ {stats.expiredMembers} abonnement{stats.expiredMembers > 1 ? "s" : ""} expiré{stats.expiredMembers > 1 ? "s" : ""}
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
                <span className="font-black text-foreground">{stats.activeMembers}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Expirés</span>
                <span className="font-black text-destructive">{stats.expiredMembers}</span>
              </div>
              <div className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                <span className="text-sm text-muted-foreground">Fréquentation totale</span>
                <span className="font-black text-foreground">{stats.totalAttendance}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sections communes ───────────────────────────────────────────────── */}
      <div className={`grid grid-cols-1 ${isAdmin ? "lg:grid-cols-2" : "lg:grid-cols-1"} gap-6`}>
        {/* Derniers paiements : admin uniquement */}
        {isAdmin && (
          <div className="stat-card">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={18} className="text-primary" />
              <h3 className="font-bold text-foreground">Derniers paiements</h3>
            </div>
            <div className="space-y-3">
              {stats.recentPayments.length > 0 ? (
                stats.recentPayments.map((payment) => (
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
            {stats.recentAttendance.length > 0 ? (
              stats.recentAttendance.map((a) => (
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
    </div>
  );
}

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
  
  // Fonctions de filtrage pour les détails
  // Note: On suppose que computeCashierCAStats stocke les éléments filtrés ou on les refiltre ici
  // Pour plus de simplicité et performance, on va passer les données brutes filtrées
  // Mais comme computeCashierCAStats ne retourne que les totaux, on va devoir re-filtrer ou ajuster Dashboard.tsx
  // ALTERNATIVE: Modifier computeCashierCAStats pour retourner aussi les listes d'objets.

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
             // CA = Subscriptions + Sorties
             onDetail("Chiffre d'Affaires Global", 'payments', [
               ...stats.items.payments, 
               ...stats.items.sorties.map(s => {
                 const pId = extractIdFromIri(s.product);
                 const pName = pId ? (productMap as any)[pId]?.name : (typeof s.product === 'object' ? (s.product as any)?.name : null);
                 return {...s, amount: (s.quantity || 0) * (s.unitPrice || 0), memberName: pName || 'Vente produit'};
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
          onClick={() => onDetail("Détails Sorties (Ventes)", 'transactions', stats.items.sorties)}
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
          onClick={() => onDetail("Total Dépenses", 'transactions', stats.items.depenses)}
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
              onClick={() => onDetail("Coût des Achats", 'transactions', stats.items.achats)}
            />
            <StatCard
              icon={Activity}
              label="Charges/Entrées"
              value={formatCurrency(entriesTotal)}
              sub="Dépenses directes"
              className=""
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
              onClick={() => onDetail("Détails Entrées & Charges", 'transactions', stats.items.entries)}
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
          <div className={`flex items-center gap-1 text-[10px] font-black px-2.5 py-1 rounded-full ${
            isPositive ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
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
