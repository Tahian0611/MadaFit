import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DollarSign, Users, UserCheck, Bell, TrendingUp, TrendingDown, Clock, Activity } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { refreshNotifications } from '@/services/api';
import api from "@/services/api";
import {
  computeDashboardStats,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  getFullName,
} from "@/lib/madafit";

export default function Dashboard() {
  const usersQuery = useQuery({ queryKey: ["users"], queryFn: () => api.users.getAll({ itemsPerPage: 100 }) });
  const paymentsQuery = useQuery({ queryKey: ["payments"], queryFn: () => api.payments.getAll({ itemsPerPage: 100 }) });
  const attendanceQuery = useQuery({ queryKey: ["attendance"], queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 100 }) });
  const plansQuery = useQuery({ queryKey: ["subscription-plans"], queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }) });
  const transactionsQuery = useQuery({ queryKey: ["transactions"], queryFn: () => api.transactions.getAll({ itemsPerPage: 500 }) });
  const productsQuery = useQuery({ queryKey: ["products"], queryFn: () => api.products.getAll({ itemsPerPage: 100 }) });

  const [sessionUser, setSessionUser] = useState<unknown | null>(() => {
      try { 
        return JSON.parse(localStorage.getItem("madafit_user") || "null"); 
      } catch { 
        return null; 
      }
    });
  
    useEffect(() => {
      const handler = () => {
        try { 
          setSessionUser(JSON.parse(localStorage.getItem("madafit_user") || "null")); 
        } catch { 
          setSessionUser(null); 
        }
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    }, []);

  const userRole = sessionUser?.roles || "ROLE_ADMIN";
  // Une seule fois au montage
  useEffect(() => {
    refreshNotifications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  console.log(userRole)
  const stats = useMemo(() => {
    return computeDashboardStats(
      extractHydraMembers(usersQuery.data),
      extractHydraMembers(paymentsQuery.data),
      extractHydraMembers(attendanceQuery.data),
      extractHydraMembers(plansQuery.data),
      [],
      extractHydraMembers(transactionsQuery.data),
      extractHydraMembers(productsQuery.data)
    );
  }, [usersQuery.data, paymentsQuery.data, attendanceQuery.data, plansQuery.data, transactionsQuery.data, productsQuery.data]);
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {userRole[0] == "ROLE_ADMIN" ?
          <StatCard 
            icon={DollarSign} 
            label="Revenu (6 mois)" 
            value={formatCurrency(stats.totalRevenue)} 
            trend={stats.revenueDiff}
            trendSuffix="%"
          /> : <></>
        }
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

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {userRole[0] == "ROLE_ADMIN" ? <div className="xl:col-span-2 stat-card overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-bold text-foreground">Revenus mensuels</h3>
              <p className="text-xs text-muted-foreground">Abonnements + bénéfice produits — 6 derniers mois</p>
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
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorAtt" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8884d8" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8884d8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <YAxis
                  yAxisId="left"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                  tickFormatter={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : value >= 1000 ? `${(value / 1000).toFixed(0)}k` : String(value)}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
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
        </div> : <></>
        }

        <div className="stat-card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-foreground">Alertes & Rappels</h3>
            <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded-full">{stats.unreadNotifications} NEW</span>
          </div>
          <div className="space-y-4">
            {stats.expiredMembers > 0 ? (
              <div className="p-4 rounded-2xl bg-muted/50 border border-border">
                <p className="text-sm font-semibold text-foreground">Abonnements expirés</p>
                <p className="text-xs text-muted-foreground mt-1">{stats.expiredMembers} membre{stats.expiredMembers > 1 ? 's' : ''} avec abonnement expiré.</p>
              </div>
            ) : (
              <div className="text-center py-10 opacity-30">
                <Bell size={40} className="mx-auto mb-2" />
                <p className="text-xs font-bold uppercase">Aucune alerte</p>
              </div>
            )}
            
            <div className="pt-4 border-t border-border">
              <h4 className="text-[10px] font-bold text-muted-foreground uppercase mb-3">Occupations LIVE</h4>
              <div className="flex items-center gap-3 p-3 bg-primary/5 rounded-xl border border-primary/10">
                <Users className="text-primary" size={20} />
                <div>
                  <p className="text-sm font-bold text-foreground">{stats.inGymNow} Personne{stats.inGymNow > 1 ? 's' : ''}</p>
                  <p className="text-[10px] text-muted-foreground">Présents actuellement en salle</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Derniers paiements</h3>
          </div>
          <div className="space-y-3">
            {stats.recentPayments.length > 0 ? stats.recentPayments.map((payment) => (
              <div key={payment.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-500">
                    <TrendingUp size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{payment.memberName || "Membre"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{formatDate(payment.date)} · {payment.method}</p>
                  </div>
                </div>
                <p className="text-sm font-black text-primary">{formatCurrency(payment.amount)}</p>
              </div>
            )) : (
              <p className="text-center py-6 text-sm text-muted-foreground italic">Aucun paiement récent</p>
            )}
          </div>
        </div>

        <div className="stat-card">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={18} className="text-primary" />
            <h3 className="font-bold text-foreground">Accès récents</h3>
          </div>
          <div className="space-y-3">
            {stats.recentAttendance.length > 0 ? stats.recentAttendance.map((attendance) => (
              <div key={attendance.id} className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <UserCheck size={14} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">{attendance.memberName || "Membre"}</p>
                    <p className="text-[10px] text-muted-foreground uppercase">{attendance.rfidCard || "Badge RFID"}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{attendance.checkIn ? String(attendance.checkIn).substring(0,5) : "—"}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{formatDate(attendance.date)}</p>
                </div>
              </div>
            )) : (
              <p className="text-center py-6 text-sm text-muted-foreground italic">Aucun accès récent</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  trendSuffix = "%"
}: {
  icon: any;
  label: string;
  value: string;
  trend?: number;
  trendSuffix?: string;
}) {
  const isPositive = trend !== undefined && trend > 0;
  
  return (
    <div className="stat-card group hover:border-primary/30 transition-all">
      <div className="flex justify-between items-start mb-2">
        <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary group-hover:text-white transition-colors">
          <Icon size={18} className="text-primary group-hover:text-white" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${isPositive ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
            {isPositive ? '+' : ''}{trend}{trendSuffix}
          </div>
        )}
      </div>
      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-black text-foreground mt-1 tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground mt-2">vs mois précédent</p>
    </div>
  );
}