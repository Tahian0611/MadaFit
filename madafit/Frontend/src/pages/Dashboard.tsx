import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign, Users, UserCheck, Bell, TrendingUp, TrendingDown, Clock, Activity,
  Receipt, Package, Calculator, Wallet, X
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

  // sorties chiffre d'affaire
  const salesTypes = new Set(['sale', 'credit', 'non_sale_exit']);
  const sortiesTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesTypes.has(tx.type)) return sum;
    const qty = Number(tx.quantity ?? 0);
    const unit = Number(tx.unitPrice ?? 0);
    return sum + qty * unit;
  }, 0);

  // coûts d'achats et dépenses
  const achatsTotal = cashierTransactions.reduce((sum, tx) => {
    if (!salesTypes.has(tx.type)) return sum;
    const qty = Number(tx.quantity ?? 0);

    // unitPrice contient souvent le prix de vente (donc pour le coût on prend purchasePrice si dispo via product)
    const productPurchase = getTransactionPurchasePrice(tx, productMap);
    const unitCost = Number(productPurchase ?? tx.unitPrice ?? 0);
    return sum + qty * unitCost;
  }, 0);

  const entriesTotal = cashierTransactions.reduce((sum, tx) => {
    if (tx.type !== 'entry' && tx.type !== 'charge') return sum;
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
  };
}

export default function Dashboard() {
  const { isAdmin, isReception } = useAuth();
  const showCashierStats = isAdmin || isReception;
  const [activeCaisseModal, setActiveCaisseModal] = useState<"caisse1" | "caisse2" | null>(null);

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
    [paymentsQuery.data, transactionsQuery.data, productsQuery.data],
  );
  const caisse2Stats = useMemo(
    () => computeCashierCAStats(payments, transactions, products, "caisse2"),
    [paymentsQuery.data, transactionsQuery.data, productsQuery.data],
  );

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

      {/* ── Modal Caisse ────────────────────────────────────────── */}
      {activeCaisseModal && (
        <div className="fixed inset-0 z-[9999] h-full flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in !mt-0">
          <div className="bg-card w-full max-w-6xl rounded-2xl shadow-xl border border-border flex flex-col max-h-[90vh]">
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
              />
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
}: {
  title: string;
  stats: ReturnType<typeof computeCashierCAStats>;
  isAdmin?: boolean;
}) {
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
          value={formatCurrency(stats.caTotal)}
          sub="Abonnements + sorties"
          className="sm:col-span-2 md:col-span-1 bg-success/5 border-success/20 hover:border-success/50"
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
        />
        <StatCard
          icon={Receipt}
          label="Abonnements"
          value={formatCurrency(stats.subscriptionTotal)}
          sub="Paiements"
          className=""
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
        />
        <StatCard
          icon={TrendingUp}
          label="Sorties"
          value={formatCurrency(stats.sortiesTotal)}
          sub="Caisse"
          className=""
          iconColorClass="text-success"
          iconBgClass="bg-success/10 group-hover:bg-success"
        />

        {/* Ligne Dépenses */}
        {isAdmin && (
          <>
            <StatCard
              icon={TrendingDown}
              label="Total dépenses"
              value={formatCurrency(stats.depensesTotal)}
              sub="Achats + entrées"
              className="sm:col-span-2 md:col-span-1 bg-destructive/5 border-destructive/20 hover:border-destructive/50"
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
            />
            <StatCard
              icon={Package}
              label="Coût d'achats"
              value={formatCurrency(stats.achatsTotal)}
              sub="Ventes"
              className=""
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
            />
            <StatCard
              icon={Activity}
              label="Entrées"
              value={formatCurrency(stats.entriesTotal)}
              sub="Stock"
              className=""
              iconColorClass="text-destructive"
              iconBgClass="bg-destructive/10 group-hover:bg-destructive"
            />

            {/* Ligne Résultat */}
            <StatCard
              icon={Calculator}
              label="Résultat Net"
              value={formatCurrency(stats.resultat)}
              sub="Chiffre d'affaires ; Dépenses"
              className="sm:col-span-2 md:col-span-3 bg-gradient-to-r from-primary/10 via-accent/5 to-background border-primary/30 shadow-sm hover:shadow-md"
            />
          </>
        )}
      </div>
    </section>
  );
}

function StatCard({
  icon: Icon, label, value, trend, trendSuffix = "%", sub = "vs mois précédent",
  className = "",
  iconColorClass = "text-primary",
  iconBgClass = "bg-primary/10 group-hover:bg-primary",
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
}) {
  const isPositive = trend !== undefined && trend > 0;
  return (
    <div className={`stat-card group hover:-translate-y-1 hover:border-primary/40 transition-all duration-300 ${className}`}>
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
