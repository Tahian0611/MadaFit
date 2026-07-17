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

export type MemberStatus = "active" | "expired" | "suspended" | "pending";
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
  pending: "En attente",
};

export function extractHydraMembers<T = any>(response?: any): T[] {
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
  if (["pending", "en attente"].includes(value)) return "pending";
  return "suspended";
}

/**
 * Vérifie si l'accès est autorisé pour un membre.
 * Gère une marge de tolérance de 5 jours après l'expiration.
 */
export function isMemberAccessAuthorized(user: User): boolean {
  const status = normalizeMemberStatus(user.status);
  
  if (status === "active") return true;
  
  if (status === "expired" && user.expiryDate) {
    const expiry = new Date(user.expiryDate);
    const now = new Date();
    
    const gracePeriodEnd = new Date(expiry);
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + 5);
    
    if (now <= gracePeriodEnd) {
      return true;
    }
  }
  
  return false;
}

/**
 * Calcule le pourcentage de progression d'un abonnement.
 * Retourne une valeur entre 0 et 1.
 */
export function calculateSubscriptionProgress(startDate?: string | Date | null, expiryDate?: string | Date | null): number {
  if (!startDate || !expiryDate) return 0;
  
  const start = new Date(startDate);
  const end = new Date(expiryDate);
  const now = new Date();
  
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const total = end.getTime() - start.getTime();
  if (total <= 0) return 0;
  
  const elapsed = now.getTime() - start.getTime();
  const progress = elapsed / total;
  
  return Math.min(Math.max(progress, 0), 1);
}

export function normalizeSubscriptionType(subscription?: string | null): string {
  const value = (subscription ?? "").toLowerCase().trim();
  if (["monthly", "mensuel", "abonnement mensuel", "session"].includes(value)) return "monthly";
  if (["quarterly", "trimestriel"].includes(value)) return "quarterly";
  if (["annual", "annuel", "yearly", "abonnement annuel"].includes(value)) return "annual";
  if (["vip"].includes(value)) return "vip";
  if (["coaching", "coaching perso"].includes(value)) return "coaching";
  
  return subscription ?? "standard";
}

/* ═══════════════════════════════════════════════════════════════════════
   SUPPRIMÉ : calculateGracePeriodStartDate
   Remplacée par les fonctions ci-dessous
   ═══════════════════════════════════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════
   CORRIGÉ : calculateNewSubscriptionStartDate
   Avant : utilisait new Date() + setHours(0,0,0,0) + toISOString()
   Après : parsing manuel YYYY-MM-DD sans objet Date, zero conversion UTC
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Parse une string YYYY-MM-DD en {year, month, day} sans créer d'objet Date.
 */
function parseDateString(dateStr: string): { year: number; month: number; day: number } {
  const parts = dateStr.split("-").map(Number);
  return { year: parts[0], month: parts[1], day: parts[2] };
}

/**
 * Formate {year, month, day} en string YYYY-MM-DD.
 */
function formatDateParts(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * Retourne la date du jour en YYYY-MM-DD selon le fuseau Indian/Antananarivo.
 */
function getTodayString(): string {
  return new Date().toLocaleDateString("fr-CA", { timeZone: "Indian/Antananarivo" });
}

/**
 * Calcule la date de début pour une NOUVELLE offre (première activation).
 * La date de début = date de validation/paiement (aujourd'hui).
 */
export function calculateNewSubscriptionStartDate(paymentDate: string | Date = new Date()): string {
  if (typeof paymentDate === "string") {
    // Si c'est déjà une string YYYY-MM-DD, la retourner telle quelle
    if (/^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
      return paymentDate;
    }
  }
  // Sinon, utiliser le fuseau Madagascar pour obtenir YYYY-MM-DD
  return getTodayString();
}

/* ═══════════════════════════════════════════════════════════════════════
   CORRIGÉ : calculateRenewalStartDate
   Avant : utilisait new Date(lastExpiryDate) + setHours(0,0,0,0) + toISOString()
   Après : parsing manuel des strings YYYY-MM-DD, comparaison en jours,
           construction de la string résultat sans objet Date
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Calcule la date de début pour un RENOUVELLEMENT d'offre.
 * 
 * Règle :
 * - Si renouvellement dans les 10j après expiration → continuité (début = date d'expiration)
 * - Si renouvellement après 10j → nouveau cycle (début = date du renouvellement)
 */
export function calculateRenewalStartDate(
  lastExpiryDate: string | Date,
  paymentDate: string | Date = new Date()
): string {
  // Normaliser en strings YYYY-MM-DD sans jamais créer d'objet Date
  let expiryStr: string;
  let paymentStr: string;

  if (typeof lastExpiryDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(lastExpiryDate)) {
    expiryStr = lastExpiryDate;
  } else if (lastExpiryDate instanceof Date) {
    expiryStr = lastExpiryDate.toLocaleDateString("fr-CA", { timeZone: "Indian/Antananarivo" });
  } else {
    expiryStr = String(lastExpiryDate).split("T")[0];
  }

  if (typeof paymentDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(paymentDate)) {
    paymentStr = paymentDate;
  } else if (paymentDate instanceof Date) {
    paymentStr = paymentDate.toLocaleDateString("fr-CA", { timeZone: "Indian/Antananarivo" });
  } else {
    paymentStr = getTodayString();
  }

  const expiry = parseDateString(expiryStr);
  const payment = parseDateString(paymentStr);

  // Convertir en timestamps (nombre de jours depuis une référence) pour comparaison
  const expiryDays = expiry.year * 365 + expiry.month * 30 + expiry.day;
  const paymentDays = payment.year * 365 + payment.month * 30 + payment.day;
  const diffDays = paymentDays - expiryDays;

  if (diffDays <= 10) {
    // Dans les 10 jours : continuité, pas de trou
    return expiryStr;
  } else {
    // Après 10 jours : nouveau cycle
    return paymentStr;
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   CORRIGÉ : calculateExpiryDate
   Avant : utilisait new Date(startDate) + setHours(0,0,0,0) + setMonth() + toISOString()
   Après : parsing manuel YYYY-MM-DD, ajout de mois, gestion fin de mois,
           construction string sans objet Date
   ═══════════════════════════════════════════════════════════════════════ */

/**
 * Calcule la date d'expiration à partir d'une date de début et d'une durée en mois.
 */
export function calculateExpiryDate(startDate: string | Date, durationMonths: number): string {
  // Normaliser en string YYYY-MM-DD
  let startStr: string;
  if (typeof startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
    startStr = startDate;
  } else if (startDate instanceof Date) {
    startStr = startDate.toLocaleDateString("fr-CA", { timeZone: "Indian/Antananarivo" });
  } else {
    startStr = String(startDate).split("T")[0];
  }

  const { year, month, day } = parseDateString(startStr);

  // Ajouter les mois
  let newMonth = month + durationMonths;
  let newYear = year;

  while (newMonth > 12) {
    newMonth -= 12;
    newYear += 1;
  }

  // Gérer les jours qui n'existent pas dans le mois cible (ex: 31 janvier + 1 mois = 28/29 février)
  const daysInMonth = new Date(newYear, newMonth, 0).getDate();
  const newDay = Math.min(day, daysInMonth);

  return formatDateParts(newYear, newMonth, newDay);
}

/**
 * Vérifie si un planName a déjà été activé pour un membre.
 * Retourne la dernière souscription active/expirée de ce plan, ou null.
 */
export function getLastSubscriptionForPlan(
  member: User,
  planName: string
): { expiryDate: string | null; status: string } | null {
  const userSubs = member.userSubscriptions ?? [];
  
  /* ═══════════════════════════════════════════════════════════════════════
     CORRIGÉ : Comparaison des dates sans new Date() pour éviter 
     les conversions UTC qui causent le décalage d'un jour.
     On compare les strings YYYY-MM-DD directement.
     ═══════════════════════════════════════════════════════════════════════ */
  const matchingSubs = userSubs
    .filter((sub) => sub.planName === planName && (sub.status === "active" || sub.status === "expired"))
    .sort((a, b) => {
      // Parser les dates YYYY-MM-DD manuellement en nombres pour comparaison
      const parseDateToNumber = (dateStr: string | null | undefined): number => {
        if (!dateStr) return 0;
        const parts = dateStr.split("-").map(Number);
        // Format : AAAAMMJJ pour comparaison numérique simple
        return parts[0] * 10000 + parts[1] * 100 + parts[2];
      };
      const dateA = parseDateToNumber(a.expiryDate);
      const dateB = parseDateToNumber(b.expiryDate);
      return dateB - dateA; // Plus récent d'abord
    });
  
  if (matchingSubs.length === 0) return null;
  
  const lastSub = matchingSubs[0];
  return {
    expiryDate: lastSub.expiryDate || null,
    status: lastSub.status,
  };
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

export function formatTime(timeStr?: string | null) {
  if (!timeStr || timeStr === "00:00" || timeStr === "00:00:00") return "--:--:--";

  if (timeStr.includes("-") || timeStr.includes("T")) {
    let isoStr = timeStr.replace(" ", "T");
    
    if (isoStr.includes("T")) {
      const timePart = isoStr.split("T")[1].substring(0, 8);
      if (timePart && timePart.includes(":")) return timePart;
    }

    const d = new Date(isoStr);
    if (!isNaN(d.getTime())) {
      if (d.getFullYear() <= 1970 && d.getHours() === 0 && d.getMinutes() === 0) {
         return "--:--:--";
      }
      return d.toLocaleTimeString("fr-FR", { 
        timeZone: "Indian/Antananarivo",
        hour: "2-digit", 
        minute: "2-digit", 
        second: "2-digit",
        hour12: false 
      });
    }
  }

  if (/^\d{1,2}:\d{2}/.test(timeStr) && !timeStr.includes("-")) {
    return timeStr.length >= 8 ? timeStr.substring(0, 8) : timeStr.substring(0, 5);
  }

  if (timeStr.length >= 5 && timeStr.includes(":")) {
    return timeStr.length >= 8 ? timeStr.substring(0, 8) : timeStr.substring(0, 5);
  }

  return (timeStr.startsWith("1970") && timeStr.includes("00:00")) ? "--:--:--" : timeStr;
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

  const productMap: Record<number, Product> = {};
  products.forEach((p) => { if (p.id !== undefined) productMap[p.id] = p; });

  const getMovementRevenueForMonth = (monthVal: number, yearVal: number): number => {
    return transactions
      .filter((tx) => {
        if (tx.type !== "sale") return false;
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

  const activeMembers = users.filter((user) => normalizeMemberStatus(user.status) === "active").length;
  const membersLastMonth = users.filter((user) => {
    if (!user.joinDate) return false;
    const d = new Date(user.joinDate);
    return d.getMonth() <= lastMonth && d.getFullYear() <= lastMonthYear;
  }).length;
  const membersDiff = activeMembers - (membersLastMonth || activeMembers);

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

  const totalAttendance = attendance.length;
  const attendanceCurrentMonth = attendance.filter((a) => { const d = new Date(a.date); return d.getMonth() === currentMonth && d.getFullYear() === currentYear; }).length;
  const attendanceLastMonth = attendance.filter((a) => { const d = new Date(a.date); return d.getMonth() === lastMonth && d.getFullYear() === lastMonthYear; }).length;
  const attendanceDiff = attendanceLastMonth === 0 ? 100 : Math.round(((attendanceCurrentMonth - attendanceLastMonth) / attendanceLastMonth) * 100);

  const retentionRate = users.length === 0 ? 0 : Math.round((activeMembers / users.length) * 100);

  const latestByMember = new Map<number, AttendanceRecord>();
  attendance.forEach(a => {
    const userId = extractIdFromIri(a.user);
    if (userId && !latestByMember.has(userId)) {
      latestByMember.set(userId, a);
    }
  });

  let inGymNow = 0;
  latestByMember.forEach((a) => {
    if (a.checkOut) return;
    const recordDate = new Date(a.date);
    const recordTime = a.checkIn || "00:00:00";
    if (recordTime.includes(":")) {
       const [h, m, s] = recordTime.split(":").map(Number);
       recordDate.setHours(h || 0, m || 0, s || 0);
    }
    const diffHours = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60);
    if (diffHours >= 0 && diffHours < 15) inGymNow++;
  });

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
  
  const retentionRate = users.length === 0 ? 0 : Math.round((activeMembers / users.length) * 100);

  const productMap: Record<number, Product> = {};
  products.forEach((p) => { if (p.id !== undefined) productMap[p.id] = p; });

  const getMovementRevenueForMonth = (monthVal: number, yearVal: number): number => {
    return transactions
      .filter((tx) => {
        if (tx.type !== "sale") return false;
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

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

  const monthlyRevenue: Record<string, number> = {};
  const monthlyNewMembers: Record<string, number> = {};
  const monthlyTotalMembers: Record<string, number> = {};
  const monthlyAttendance: Record<string, number> = {};

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    monthlyRevenue[key] = 0;
    monthlyNewMembers[key] = 0;
    monthlyTotalMembers[key] = 0;
    monthlyAttendance[key] = 0;
  }

  payments.forEach((p) => {
    const d = new Date(p.date);
    if (d >= sixMonthsAgo) {
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      if (monthlyRevenue[key] !== undefined) monthlyRevenue[key] += p.amount ?? 0;
    }
  });

  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
    const monthVal = d.getMonth();
    const yearVal = d.getFullYear();
    if (monthlyRevenue[key] !== undefined) {
      monthlyRevenue[key] += getMovementRevenueForMonth(monthVal, yearVal);
    }
  }

  users.forEach((u) => {
    if (u.joinDate) {
      const d = new Date(u.joinDate);
      if (d >= sixMonthsAgo) {
        const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
        if (monthlyNewMembers[key] !== undefined) monthlyNewMembers[key]++;
      }
    }
  });

  attendance.forEach((a) => {
    const d = new Date(a.date);
    if (d >= sixMonthsAgo) {
      const key = d.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
      if (monthlyAttendance[key] !== undefined) monthlyAttendance[key]++;
    }
  });

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

  const totalRevenue = Object.values(monthlyRevenue).reduce((a, b) => a + b, 0);

  const currentMonthKey = new Date(now.getFullYear(), currentMonth, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  const lastMonthKey = new Date(lastMonthYear, lastMonth, 1).toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });

  const currentRevenue = monthlyRevenue[currentMonthKey] || 0;
  const prevRevenue = monthlyRevenue[lastMonthKey] || 0;
  const revenueTrend = prevRevenue === 0 ? (currentRevenue > 0 ? 100 : 0) : Math.round(((currentRevenue - prevRevenue) / prevRevenue) * 100);

  const currentNew = monthlyNewMembers[currentMonthKey] || 0;
  const prevNew = monthlyNewMembers[lastMonthKey] || 0;
  const membersTrend = prevNew === 0 ? (currentNew > 0 ? 100 : 0) : Math.round(((currentNew - prevNew) / prevNew) * 100);

  const currentAtt = monthlyAttendance[currentMonthKey] || 0;
  const prevAtt = monthlyAttendance[lastMonthKey] || 0;
  const attendanceTrend = prevAtt === 0 ? (currentAtt > 0 ? 100 : 0) : Math.round(((currentAtt - prevAtt) / prevAtt) * 100);

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

function getMonthIndex(monthName: string): number {
  const months = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
  return months.indexOf(monthName.toLowerCase());
}