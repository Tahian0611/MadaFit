import type {
  ApiListResponse,
  AttendanceRecord,
  Notification,
  Payment,
  Product,
  SubscriptionPlan,
  Transaction,
  User,
} from "@/types/entities";

export type MemberStatus = "active" | "expired" | "suspended";
export type SubscriptionType = "monthly" | "quarterly" | "annual" | "vip" | "coaching";
export type ActivityType = "musculation" | "cardio" | "danse" | "gym" | "cours_collectif";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  musculation: "Musculation",
  cardio: "Cardio",
  danse: "Danse",
  gym: "Gym",
  cours_collectif: "Cours collectif",
};

export const SUBSCRIPTION_LABELS: Record<SubscriptionType, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
  vip: "VIP",
  coaching: "Coaching Perso",
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  active: "Actif",
  expired: "Expire",
  suspended: "Suspendu",
};

export function extractHydraMembers<T>(response?: any): T[] {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (response["hydra:member"]) return response["hydra:member"];
  if (response.member) return response.member;
  if (response.data && Array.isArray(response.data)) return response.data;
  return [];
}

export function normalizeMemberStatus(status?: string | null): MemberStatus {
  const value = (status ?? "").toLowerCase();
  if (["actif", "active"].includes(value)) return "active";
  if (["expire", "expired", "expiré", "expirée"].includes(value)) return "expired";
  return "suspended";
}

export function normalizeSubscriptionType(subscription?: string | null): string {
  const value = (subscription ?? "").toLowerCase().trim();
  if (["monthly", "mensuel", "abonnement mensuel", "session"].includes(value)) return "monthly";
  if (["quarterly", "trimestriel"].includes(value)) return "quarterly";
  if (["annual", "annuel", "yearly", "abonnement annuel"].includes(value)) return "annual";
  if (["vip"].includes(value)) return "vip";
  if (["coaching", "coaching perso"].includes(value)) return "coaching";
  
  // Si on ne connaît pas le mot-clé, on garde la valeur brute (ex: "Offre 2026")
  return subscription ?? "standard";
}

export function formatCurrency(amount?: number | null) {
  return new Intl.NumberFormat("fr-MG", {
    style: "currency",
    currency: "MGA",
    maximumFractionDigits: 0,
  }).format(amount ?? 0);
}

export function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function formatDateTime(dateStr?: string | null) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function getFullName(user: Partial<User>) {
  return user.fullName || [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email || "Inconnu";
}

export function getUserIri(user: Pick<User, "id">) {
  return `/api/users/${user.id}`;
}

export function extractIdFromIri(value?: string | { "@id"?: string; id?: number } | Product | User | null) {
  if (!value) return null;
  if (typeof value === "object" && "id" in value && typeof value.id === "number") return value.id;
  const iri = typeof value === "string" ? value : typeof value === "object" && "@id" in value ? value["@id"] : null;
  if (!iri) return null;
  const parts = iri.split("/");
  const lastPart = parts[parts.length - 1];
  const parsed = Number(lastPart);
  return Number.isNaN(parsed) ? null : parsed;
}

export function computeDashboardStats(
  users: User[],
  payments: Payment[],
  attendance: AttendanceRecord[],
  plans: SubscriptionPlan[],
  notifications: Notification[],
  transactions: Transaction[] = [],
  products: Product[] = []
) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  // Map produits pour lookup rapide
  const productMap: Record<number, Product> = {};
  products.forEach((p) => { if (p.id !== undefined) productMap[p.id] = p; });

  // Calcule le revenu total des ventes de produits pour un mois donné
  const getMovementRevenueForMonth = (monthVal: number, yearVal: number): number => {
    return transactions
      .filter((tx) => {
        if (tx.type !== "sale" && tx.type !== "credit") return false;
        const d = new Date(tx.date);
        return d.getMonth() === monthVal && d.getFullYear() === yearVal;
      })
      .reduce((sum, tx) => {
        const productId = extractIdFromIri(tx.product);
        const product = productId !== null ? productMap[productId] : null;
        if (!product) return sum;
        const unitPrice = tx.unitPrice ?? product.salePrice ?? 0;
        return sum + (unitPrice * tx.quantity);
      }, 0);
  };

  // Membres Actifs
  const activeMembers = users.filter((user) => normalizeMemberStatus(user.status) === "active").length;
  const membersLastMonth = users.filter((user) => {
    if (!user.joinDate) return false;
    const d = new Date(user.joinDate);
    return d.getMonth() <= lastMonth && d.getFullYear() <= lastMonthYear;
  }).length;
  const membersDiff = activeMembers - (membersLastMonth || activeMembers);

  // Revenus 6 mois : paiements + bénéfice produits
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 6, 1);
  const paymentRevenue6m = payments
    .filter((p) => new Date(p.date) >= sixMonthsAgo)
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);

  let movementRevenue6m = 0;
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    movementRevenue6m += getMovementRevenueForMonth(d.getMonth(), d.getFullYear());
  }

  const totalRevenue = paymentRevenue6m + movementRevenue6m;

  const revenueCurrentMonth =
    payments.filter((p) => { const d = new Date(p.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; })
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
    + getMovementRevenueForMonth(currentMonth, currentYear);

  const revenueLastMonth =
    payments.filter((p) => { const d = new Date(p.date); return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear; })
    .reduce((sum, p) => sum + (p.amount ?? 0), 0)
    + getMovementRevenueForMonth(lastMonth, lastMonthYear);

  const revenueDiff = revenueLastMonth === 0 ? 100 : Math.round(((revenueCurrentMonth - revenueLastMonth) / revenueLastMonth) * 100);

  // Fréquentation
  const totalAttendance = attendance.length;
  const attendanceCurrentMonth = attendance.filter((a) => { const d = new Date(a.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length;
  const attendanceLastMonth = attendance.filter((a) => { const d = new Date(a.date); return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear; }).length;
  const attendanceDiff = attendanceLastMonth === 0 ? 100 : Math.round(((attendanceCurrentMonth - attendanceLastMonth) / attendanceLastMonth) * 100);

  const retentionRate = users.length === 0 ? 0 : Math.round((activeMembers / users.length) * 100);

  // inGymNow : seulement aujourd'hui, sans checkout
  const todayStr = now.toISOString().split("T")[0];
  const inGymNow = attendance.filter((a) => {
    const aDate = typeof a.date === "string" ? a.date.substring(0, 10) : new Date(a.date).toISOString().split("T")[0];
    return aDate === todayStr && !a.checkOut;
  }).length;

  // Données graphiques 6 mois
  const monthlyData: any[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthName = d.toLocaleDateString("fr-FR", { month: "short" });
    const monthVal = d.getMonth();
    const yearVal = d.getFullYear();

    const rev = payments
      .filter((p) => { const pd = new Date(p.date); return pd.getMonth() === monthVal && pd.getFullYear() === yearVal; })
      .reduce((sum, p) => sum + (p.amount ?? 0), 0)
      + getMovementRevenueForMonth(monthVal, yearVal);

    const att = attendance.filter((a) => { const ad = new Date(a.date); return ad.getMonth() === monthVal && ad.getFullYear() === yearVal; }).length;

    monthlyData.push({ name: monthName, revenue: rev, attendance: att });
  }

  const subscriptionCounts = plans.map((plan) => ({
    name: plan.name,
    value: users.filter((user) => normalizeSubscriptionType(user.subscription) === normalizeSubscriptionType(plan.type)).length,
    color: plan.color || "#8884d8",
  }));

  const recentPayments = [...payments]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const recentAttendance = [...attendance]
    .sort((a, b) => {
      const left = new Date(`${a.date}T${a.checkIn ?? "00:00:00"}`).getTime();
      const right = new Date(`${b.date}T${b.checkIn ?? "00:00:00"}`).getTime();
      return right - left;
    })
    .slice(0, 5);

  const unreadNotifications = notifications.filter((notification) => !notification.isRead).length;

  return {
    activeMembers,
    membersDiff,
    totalRevenue,
    revenueDiff,
    totalAttendance,
    attendanceDiff,
    retentionRate,
    monthlyData,
    expiredMembers: users.filter((user) => normalizeMemberStatus(user.status) === "expired").length,
    inGymNow,
    recentPayments,
    recentAttendance,
    subscriptionCounts,
    unreadNotifications,
  };
}

export function computeProductMetrics(products: Product[], transactions: Transaction[]) {
  const lowStockCount = products.filter((product) => product.currentStock <= 5).length;
  const outOfStockCount = products.filter((product) => product.currentStock === 0).length;
  const transactionCount = transactions.length;
  return { lowStockCount, outOfStockCount, transactionCount };
}

export function computeReportsStats(
  users: User[],
  payments: Payment[],
  attendance: AttendanceRecord[],
  transactions: Transaction[] = [],
  products: Product[] = []
) {
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  const lastMonth = currentMonth === 0 ? 11 : currentMonth - 1;
  const lastMonthYear = currentMonth === 0 ? currentYear - 1 : currentYear;

  const activeMembers = users.filter((u) => normalizeMemberStatus(u.status) === "active").length;
  
  // Taux de rétention réel
  const retentionRate = users.length === 0 ? 0 : Math.round((activeMembers / users.length) * 100);

  // Map produits pour lookup rapide (bénéfice produit)
  const productMap: Record<number, Product> = {};
  products.forEach((p) => { if (p.id !== undefined) productMap[p.id] = p; });

  // Calcule le revenu total des ventes de produits pour un mois donné
  const getMovementRevenueForMonth = (monthVal: number, yearVal: number): number => {
    return transactions
      .filter((tx) => {
        if (tx.type !== "sale" && tx.type !== "credit") return false;
        const d = new Date(tx.date);
        return d.getMonth() === monthVal && d.getFullYear() === yearVal;
      })
      .reduce((sum, tx) => {
        const productId = extractIdFromIri(tx.product);
        const product = productId !== null ? productMap[productId] : null;
        if (!product) return sum;
        const unitPrice = tx.unitPrice ?? product.salePrice ?? 0;
        return sum + (unitPrice * tx.quantity);
      }, 0);
  };

  // Période des 6 derniers mois
  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  // Maps pour données mensuelles
  const monthlyRevenue: Record<string, number> = {};
  const monthlyNewMembers: Record<string, number> = {};
  const monthlyTotalMembers: Record<string, number> = {};
  const monthlyAttendance: Record<string, number> = {};

  // Initialiser les 6 derniers mois
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    monthlyRevenue[key] = 0;
    monthlyNewMembers[key] = 0;
    monthlyTotalMembers[key] = 0;
    monthlyAttendance[key] = 0;
  }

  // Revenus par mois (6 derniers mois) : paiements + bénéfice produits
  payments.forEach((p) => {
    const d = new Date(p.date);
    if (d >= sixMonthsAgo) {
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += p.amount ?? 0;
    }
  });

  // Ajouter le bénéfice produit aux revenus mensuels
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const monthVal = d.getMonth();
    const yearVal = d.getFullYear();
    if (monthlyRevenue[key] !== undefined) {
      monthlyRevenue[key] += getMovementRevenueForMonth(monthVal, yearVal);
    }
  }

  // Nouveaux membres par mois (6 derniers mois)
  users.forEach((u) => {
    if (u.joinDate) {
      const d = new Date(u.joinDate);
      if (d >= sixMonthsAgo) {
        const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        if (monthlyNewMembers[key] !== undefined) monthlyNewMembers[key]++;
      }
    }
  });

  // Fréquentation par mois (6 derniers mois)
  attendance.forEach((a) => {
    const d = new Date(a.date);
    if (d >= sixMonthsAgo) {
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      if (monthlyAttendance[key] !== undefined) monthlyAttendance[key]++;
    }
  });

  // Calcul du total cumulé de membres par mois (évolution réelle)
  const sortedKeys = Object.keys(monthlyRevenue).sort((a, b) => {
    const [monthA, yearA] = a.split(' ');
    const [monthB, yearB] = b.split(' ');
    const dateA = new Date(parseInt('20' + yearA), getMonthIndex(monthA), 1);
    const dateB = new Date(parseInt('20' + yearB), getMonthIndex(monthB), 1);
    return dateA.getTime() - dateB.getTime();
  });

  let runningTotal = 0;
  sortedKeys.forEach((key) => {
    runningTotal += monthlyNewMembers[key];
    monthlyTotalMembers[key] = runningTotal;
  });

  // Ajouter les membres existants avant la période
  const existingMembersBefore = users.filter((u) => {
    if (!u.joinDate) return true;
    return new Date(u.joinDate) < sixMonthsAgo;
  }).length;

  sortedKeys.forEach((key) => {
    monthlyTotalMembers[key] += existingMembersBefore;
  });

  const monthlyData = sortedKeys.map((month) => ({
    month,
    revenue: monthlyRevenue[month],
    new: monthlyNewMembers[month],
    members: monthlyTotalMembers[month],
  }));

  // Total revenu 6 mois = paiements + bénéfice produits
  const totalRevenue = Object.values(monthlyRevenue).reduce((a, b) => a + b, 0);

  // Calcul des trends réels
  const currentMonthKey = new Date(now.getFullYear(), currentMonth, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  const lastMonthKey = new Date(lastMonthYear, lastMonth, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

  // Trend revenus (inclut bénéfice produit)
  const currentRevenue = monthlyRevenue[currentMonthKey] || 0;
  const prevRevenue = monthlyRevenue[lastMonthKey] || 0;
  const revenueTrend = prevRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);

  // Trend membres (nouveaux inscrits ce mois vs mois dernier)
  const currentNew = monthlyNewMembers[currentMonthKey] || 0;
  const prevNew = monthlyNewMembers[lastMonthKey] || 0;
  const membersTrend = prevNew === 0 ? (currentNew > 0 ? 100 : 0) : Math.round(((currentNew - prevNew) / prevNew) * 100);

  // Trend fréquentation
  const currentAtt = monthlyAttendance[currentMonthKey] || 0;
  const prevAtt = monthlyAttendance[lastMonthKey] || 0;
  const attendanceTrend = prevAtt === 0 ? (currentAtt > 0 ? 100 : 0) : Math.round(((currentAtt - prevAtt) / prevAtt) * 100);

  // Fréquentation hebdomadaire réelle
  const dayLabels = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  
  attendance.forEach((a) => {
    const d = new Date(a.date);
    const dayIndex = d.getDay() === 0 ? 6 : d.getDay() - 1;
    dayCounts[dayIndex]++;
  });

  const weeklyAttendance = dayLabels.map((day, idx) => ({
    day,
    visits: dayCounts[idx],
  }));

  return { 
    activeMembers, 
    totalRevenue, 
    monthlyData, 
    weeklyAttendance,
    retentionRate,
    revenueTrend,
    membersTrend,
    attendanceTrend,
    currentNewMembers: currentNew,
  };
}

// Helper pour convertir nom de mois abrégé fr vers index
function getMonthIndex(monthName: string): number {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return months.indexOf(monthName.toLowerCase());
}