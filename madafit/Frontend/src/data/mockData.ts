// Mock data for MadaFit gym management system
export type MemberStatus = "active" | "expired" | "suspended";
export type SubscriptionType = "monthly" | "quarterly" | "annual" | "vip" | "coaching";
export type UserRole = "admin" | "manager" | "coach" | "receptionist";
export type PaymentMethod = "cash" | "mobile_money" | "card";
export type AccessType = "abonnement" | "seance";
export type ActivityType = "musculation" | "cardio" | "danse" | "gym" | "cours_collectif";

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  musculation: "Musculation",
  cardio: "Cardio",
  danse: "Danse",
  gym: "Gym",
  cours_collectif: "Cours collectif",
};

export interface Member {
  id: string;
  memberId: string;
  rfidCard: string;
  photo?: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string;
  dob: string;
  gender: "M" | "F";
  address: string;
  emergencyContact: string;
  emergencyPhone: string;
  medicalNotes?: string;
  joinDate: string;
  subscription: SubscriptionType;
  status: MemberStatus;
  expiryDate: string;
  startDate: string;
  coach?: string;
  program?: string;
  totalPayments: number;
  lastVisit?: string;
  visitCount: number;
  inGym: boolean;
  notes?: string;
  activity: ActivityType;
  accessType: AccessType;
  cardStatus: "active" | "inactive" | "lost";
  promotion?: string;
}

export interface VisitRecord {
  id: string;
  date: string;
  checkIn: string;
  checkOut?: string;
}

export interface PaymentRecord {
  id: string;
  date: string;
  amount: number;
  method: PaymentMethod;
  subscription: SubscriptionType;
  receiptNo: string;
}

export interface AttendanceRecord {
  id: string;
  memberId: string;
  memberName: string;
  rfidCard: string;
  checkIn: string;
  checkOut?: string;
  date: string;
}

export interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  amount: number;
  method: PaymentMethod;
  date: string;
  subscription: SubscriptionType;
  receiptNo: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  type: SubscriptionType;
  duration: number;
  price: number;
  features: string[];
  color: string;
  popular?: boolean;
}

export interface Notification {
  id: string;
  type: "expiry" | "renewal" | "payment" | "access" | "info";
  title: string;
  message: string;
  date: string;
  read: boolean;
  memberId?: string;
  memberName?: string;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: "p1", name: "Mensuel", type: "monthly", duration: 1, price: 35000,
    features: ["Accès musculation", "Vestiaires", "Wifi"],
    color: "blue",
  },
  {
    id: "p2", name: "Trimestriel", type: "quarterly", duration: 3, price: 90000,
    features: ["Accès musculation", "Cours collectifs", "Vestiaires", "Wifi"],
    color: "green", popular: true,
  },
  {
    id: "p3", name: "Annuel", type: "annual", duration: 12, price: 300000,
    features: ["Accès illimité", "Cours collectifs", "1 bilan/mois", "Vestiaires VIP", "Wifi"],
    color: "purple",
  },
  {
    id: "p4", name: "VIP", type: "vip", duration: 12, price: 500000,
    features: ["Accès 24h/7j", "Coach dédié", "Programme personnalisé", "Nutrition", "Spa & Sauna", "Invités (2/mois)"],
    color: "gold",
  },
  {
    id: "p5", name: "Coaching Perso", type: "coaching", duration: 1, price: 120000,
    features: ["10 séances coach", "Bilan complet", "Programme sur mesure", "Suivi nutrition"],
    color: "red",
  },
];

export const MEMBER_VISITS: Record<string, VisitRecord[]> = {
  m1: [
    { id: "v1-1", date: "2025-02-17", checkIn: "06:15", checkOut: "08:30" },
    { id: "v1-2", date: "2025-02-15", checkIn: "06:00", checkOut: "08:00" },
    { id: "v1-3", date: "2025-02-13", checkIn: "06:20", checkOut: "08:45" },
    { id: "v1-4", date: "2025-02-10", checkIn: "07:00", checkOut: "09:00" },
    { id: "v1-5", date: "2025-02-08", checkIn: "06:15", checkOut: "08:30" },
  ],
  m2: [
    { id: "v2-1", date: "2025-02-17", checkIn: "07:30", checkOut: "09:30" },
    { id: "v2-2", date: "2025-02-14", checkIn: "08:00", checkOut: "10:00" },
    { id: "v2-3", date: "2025-02-12", checkIn: "07:45", checkOut: "09:45" },
  ],
  m3: [
    { id: "v3-1", date: "2025-02-16", checkIn: "10:15", checkOut: "12:00" },
    { id: "v3-2", date: "2025-02-14", checkIn: "10:00", checkOut: "12:30" },
    { id: "v3-3", date: "2025-02-12", checkIn: "09:30", checkOut: "11:30" },
    { id: "v3-4", date: "2025-02-10", checkIn: "10:15", checkOut: "12:15" },
  ],
  m5: [
    { id: "v5-1", date: "2025-02-15", checkIn: "09:00", checkOut: "10:30" },
    { id: "v5-2", date: "2025-02-12", checkIn: "09:15", checkOut: "10:45" },
    { id: "v5-3", date: "2025-02-10", checkIn: "09:00", checkOut: "10:30" },
  ],
  m6: [
    { id: "v6-1", date: "2025-02-17", checkIn: "08:45" },
    { id: "v6-2", date: "2025-02-15", checkIn: "09:00", checkOut: "10:30" },
    { id: "v6-3", date: "2025-02-13", checkIn: "08:30", checkOut: "10:00" },
  ],
  m8: [
    { id: "v8-1", date: "2025-02-16", checkIn: "11:00", checkOut: "12:30" },
    { id: "v8-2", date: "2025-02-14", checkIn: "11:15", checkOut: "12:45" },
    { id: "v8-3", date: "2025-02-12", checkIn: "10:30", checkOut: "12:00" },
  ],
};

export const MEMBER_PAYMENTS: Record<string, PaymentRecord[]> = {
  m1: [
    { id: "pm1-1", date: "2024-01-10", amount: 300000, method: "card", subscription: "annual", receiptNo: "REC-2024-001" },
  ],
  m2: [
    { id: "pm2-1", date: "2024-02-05", amount: 90000, method: "cash", subscription: "quarterly", receiptNo: "REC-2024-023" },
    { id: "pm2-2", date: "2024-05-05", amount: 90000, method: "mobile_money", subscription: "quarterly", receiptNo: "REC-2024-087" },
    { id: "pm2-3", date: "2024-12-05", amount: 90000, method: "mobile_money", subscription: "quarterly", receiptNo: "REC-2024-156" },
  ],
  m3: [
    { id: "pm3-1", date: "2024-03-20", amount: 500000, method: "card", subscription: "vip", receiptNo: "REC-2024-078" },
  ],
  m4: [
    { id: "pm4-1", date: "2024-11-01", amount: 35000, method: "cash", subscription: "monthly", receiptNo: "REC-2024-142" },
    { id: "pm4-2", date: "2024-12-01", amount: 35000, method: "cash", subscription: "monthly", receiptNo: "REC-2024-167" },
  ],
  m5: [
    { id: "pm5-1", date: "2024-06-15", amount: 120000, method: "cash", subscription: "coaching", receiptNo: "REC-2024-099" },
    { id: "pm5-2", date: "2024-09-15", amount: 120000, method: "cash", subscription: "coaching", receiptNo: "REC-2024-122" },
    { id: "pm5-3", date: "2024-12-15", amount: 120000, method: "mobile_money", subscription: "coaching", receiptNo: "REC-2024-178" },
  ],
  m6: [
    { id: "pm6-1", date: "2025-01-08", amount: 90000, method: "cash", subscription: "quarterly", receiptNo: "REC-2025-012" },
  ],
  m7: [
    { id: "pm7-1", date: "2025-01-20", amount: 35000, method: "cash", subscription: "monthly", receiptNo: "REC-2025-021" },
  ],
  m8: [
    { id: "pm8-1", date: "2025-02-01", amount: 35000, method: "mobile_money", subscription: "monthly", receiptNo: "REC-2025-034" },
  ],
};

export const MEMBERS: Member[] = [
  {
    id: "m1", memberId: "MF-2024-0001", rfidCard: "RF001234",
    firstName: "Andry", lastName: "Rakoto", fullName: "Andry Rakoto",
    email: "andry.rakoto@gmail.com", phone: "+261 34 12 345 67",
    dob: "1995-03-15", gender: "M", address: "Antananarivo, Analakely",
    emergencyContact: "Hery Rakoto", emergencyPhone: "+261 34 99 876 54",
    medicalNotes: "Aucune", joinDate: "2024-01-10", startDate: "2024-01-10",
    subscription: "annual", status: "active", expiryDate: "2025-01-10",
    coach: "Coach Fidy", program: "Renforcement musculaire",
    totalPayments: 300000, lastVisit: "2025-02-17", visitCount: 187, inGym: true,
    activity: "musculation", accessType: "abonnement", cardStatus: "active",
  },
  {
    id: "m2", memberId: "MF-2024-0002", rfidCard: "RF001235",
    firstName: "Miora", lastName: "Rasoamahenina", fullName: "Miora Rasoamahenina",
    email: "miora.r@yahoo.fr", phone: "+261 33 78 901 23",
    dob: "1998-07-22", gender: "F", address: "Antananarivo, Tanjombato",
    emergencyContact: "Lova Rasoamahenina", emergencyPhone: "+261 33 45 678 90",
    joinDate: "2024-02-05", startDate: "2024-12-05", subscription: "quarterly", status: "active", expiryDate: "2025-03-05",
    totalPayments: 180000, lastVisit: "2025-02-17", visitCount: 64, inGym: true,
    program: "Fitness & Cardio", activity: "cardio", accessType: "abonnement", cardStatus: "active",
    promotion: "-25000",
  },
  {
    id: "m3", memberId: "MF-2024-0003", rfidCard: "RF001236",
    firstName: "Tovo", lastName: "Andriantsoa", fullName: "Tovo Andriantsoa",
    email: "tovo.a@gmail.com", phone: "+261 32 56 789 01",
    dob: "1990-11-08", gender: "M", address: "Antananarivo, Ankadifotsy",
    emergencyContact: "Nirina Andriantsoa", emergencyPhone: "+261 32 11 222 33",
    joinDate: "2024-03-20", startDate: "2024-03-20", subscription: "vip", status: "active", expiryDate: "2025-03-20",
    coach: "Coach Mamy", program: "VIP Full Body",
    totalPayments: 500000, lastVisit: "2025-02-16", visitCount: 201, inGym: false,
    activity: "musculation", accessType: "abonnement", cardStatus: "active",
  },
  {
    id: "m4", memberId: "MF-2024-0004", rfidCard: "RF001237",
    firstName: "Lalaina", lastName: "Randriamahefa", fullName: "Lalaina Randriamahefa",
    email: "lalaina.r@gmail.com", phone: "+261 34 23 456 78",
    dob: "2000-05-12", gender: "F", address: "Antananarivo, Ampefiloha",
    emergencyContact: "Haja Randriamahefa", emergencyPhone: "+261 34 87 654 32",
    joinDate: "2024-11-01", startDate: "2024-12-01", subscription: "monthly", status: "expired", expiryDate: "2024-12-01",
    totalPayments: 70000, lastVisit: "2024-11-28", visitCount: 22, inGym: false,
    activity: "danse", accessType: "seance", cardStatus: "inactive",
  },
  {
    id: "m5", memberId: "MF-2024-0005", rfidCard: "RF001238",
    firstName: "Faniry", lastName: "Rabemananjara", fullName: "Faniry Rabemananjara",
    email: "faniry.r@gmail.com", phone: "+261 33 34 567 89",
    dob: "1988-09-30", gender: "M", address: "Antananarivo, Ivandry",
    emergencyContact: "Zo Rabemananjara", emergencyPhone: "+261 33 76 543 21",
    joinDate: "2024-06-15", startDate: "2025-02-15", subscription: "coaching", status: "active", expiryDate: "2025-03-15",
    coach: "Coach Fidy", program: "Coaching Perso Perte de poids",
    totalPayments: 360000, lastVisit: "2025-02-15", visitCount: 45, inGym: false,
    activity: "gym", accessType: "seance", cardStatus: "active",
  },
  {
    id: "m6", memberId: "MF-2025-0006", rfidCard: "RF001239",
    firstName: "Soa", lastName: "Andrianarivo", fullName: "Soa Andrianarivo",
    email: "soa.a@gmail.com", phone: "+261 32 45 678 90",
    dob: "1993-12-18", gender: "F", address: "Antananarivo, Faravohitra",
    emergencyContact: "Narivo Andrianarivo", emergencyPhone: "+261 32 22 333 44",
    joinDate: "2025-01-08", startDate: "2025-01-08", subscription: "quarterly", status: "active", expiryDate: "2025-04-08",
    totalPayments: 90000, lastVisit: "2025-02-17", visitCount: 28, inGym: true,
    program: "Yoga & Zumba", activity: "cours_collectif", accessType: "abonnement", cardStatus: "active",
    promotion: "-35000",
  },
  {
    id: "m7", memberId: "MF-2025-0007", rfidCard: "RF001240",
    firstName: "Haja", lastName: "Rasoa", fullName: "Haja Rasoa",
    email: "haja.r@gmail.com", phone: "+261 34 56 789 01",
    dob: "1985-04-25", gender: "M", address: "Antananarivo, Ambodivona",
    emergencyContact: "Vola Rasoa", emergencyPhone: "+261 34 98 765 43",
    joinDate: "2025-01-20", startDate: "2025-01-20", subscription: "monthly", status: "suspended", expiryDate: "2025-02-20",
    totalPayments: 35000, lastVisit: "2025-02-01", visitCount: 8, inGym: false,
    notes: "Suspension temporaire - voyage professionnel",
    activity: "cardio", accessType: "abonnement", cardStatus: "inactive",
  },
  {
    id: "m8", memberId: "MF-2025-0008", rfidCard: "RF001241",
    firstName: "Vero", lastName: "Ramiandrisoa", fullName: "Vero Ramiandrisoa",
    email: "vero.ram@gmail.com", phone: "+261 33 67 890 12",
    dob: "1997-08-14", gender: "F", address: "Antananarivo, Andohatapenaka",
    emergencyContact: "Tiana Ramiandrisoa", emergencyPhone: "+261 33 11 234 56",
    joinDate: "2025-02-01", startDate: "2025-02-01", subscription: "monthly", status: "active", expiryDate: "2025-03-01",
    totalPayments: 35000, lastVisit: "2025-02-16", visitCount: 12, inGym: false,
    activity: "musculation", accessType: "abonnement", cardStatus: "active",
  },
];

export const NOTIFICATIONS: Notification[] = [
  { id: "n1", type: "expiry", title: "Abonnement expirant", message: "Haja Rasoa — abonnement expire dans 1 jour", date: "2025-02-19", read: false, memberId: "m7", memberName: "Haja Rasoa" },
  { id: "n2", type: "expiry", title: "Abonnement expirant", message: "Andry Rakoto — abonnement expiré depuis 40 jours", date: "2025-02-17", read: false, memberId: "m1", memberName: "Andry Rakoto" },
  { id: "n3", type: "renewal", title: "Renouvellement disponible", message: "Lalaina Randriamahefa — abonnement expiré le 01/12/2024", date: "2025-02-16", read: false, memberId: "m4", memberName: "Lalaina Randriamahefa" },
  { id: "n4", type: "payment", title: "Paiement enregistré", message: "Faniry Rabemananjara — 120 000 Ar — Coaching", date: "2025-02-15", read: true, memberId: "m5", memberName: "Faniry Rabemananjara" },
  { id: "n5", type: "access", title: "Accès refusé", message: "Carte RF001237 — Abonnement expiré", date: "2025-02-14", read: true },
  { id: "n6", type: "info", title: "Nouveau membre inscrit", message: "Vero Ramiandrisoa — Abonnement mensuel activé", date: "2025-02-01", read: true, memberId: "m8", memberName: "Vero Ramiandrisoa" },
  { id: "n7", type: "expiry", title: "Renouvellement à prévoir", message: "Vero Ramiandrisoa — abonnement expire dans 10 jours", date: "2025-02-19", read: false, memberId: "m8", memberName: "Vero Ramiandrisoa" },
];

export const ATTENDANCE_TODAY: AttendanceRecord[] = [
  { id: "a1", memberId: "m1", memberName: "Andry Rakoto", rfidCard: "RF001234", checkIn: "06:15", date: "2025-02-17" },
  { id: "a2", memberId: "m2", memberName: "Miora Rasoamahenina", rfidCard: "RF001235", checkIn: "07:30", date: "2025-02-17" },
  { id: "a3", memberId: "m6", memberName: "Soa Andrianarivo", rfidCard: "RF001239", checkIn: "08:45", date: "2025-02-17" },
  { id: "a4", memberId: "m5", memberName: "Faniry Rabemananjara", rfidCard: "RF001238", checkIn: "09:00", checkOut: "10:30", date: "2025-02-17" },
  { id: "a5", memberId: "m3", memberName: "Tovo Andriantsoa", rfidCard: "RF001236", checkIn: "10:15", checkOut: "12:00", date: "2025-02-17" },
  { id: "a6", memberId: "m8", memberName: "Vero Ramiandrisoa", rfidCard: "RF001241", checkIn: "11:00", checkOut: "12:30", date: "2025-02-17" },
];

export const RECENT_PAYMENTS: Payment[] = [
  { id: "pay1", memberId: "m1", memberName: "Andry Rakoto", amount: 300000, method: "card", date: "2024-01-10", subscription: "annual", receiptNo: "REC-2024-001" },
  { id: "pay2", memberId: "m2", memberName: "Miora Rasoamahenina", amount: 90000, method: "mobile_money", date: "2024-12-05", subscription: "quarterly", receiptNo: "REC-2024-156" },
  { id: "pay3", memberId: "m3", memberName: "Tovo Andriantsoa", amount: 500000, method: "card", date: "2024-03-20", subscription: "vip", receiptNo: "REC-2024-078" },
  { id: "pay4", memberId: "m6", memberName: "Soa Andrianarivo", amount: 90000, method: "cash", date: "2025-01-08", subscription: "quarterly", receiptNo: "REC-2025-012" },
  { id: "pay5", memberId: "m8", memberName: "Vero Ramiandrisoa", amount: 35000, method: "mobile_money", date: "2025-02-01", subscription: "monthly", receiptNo: "REC-2025-034" },
  { id: "pay6", memberId: "m5", memberName: "Faniry Rabemananjara", amount: 120000, method: "cash", date: "2025-02-15", subscription: "coaching", receiptNo: "REC-2025-041" },
];

export const WEEKLY_ATTENDANCE = [
  { day: "Lun", visits: 32 },
  { day: "Mar", visits: 28 },
  { day: "Mer", visits: 45 },
  { day: "Jeu", visits: 38 },
  { day: "Ven", visits: 51 },
  { day: "Sam", visits: 67 },
  { day: "Dim", visits: 43 },
];

export const MONTHLY_REVENUE = [
  { month: "Sep", revenue: 1250000 },
  { month: "Oct", revenue: 1480000 },
  { month: "Nov", revenue: 1320000 },
  { month: "Déc", revenue: 1750000 },
  { month: "Jan", revenue: 1600000 },
  { month: "Fév", revenue: 890000 },
];

export const SUBSCRIPTION_DISTRIBUTION = [
  { name: "Mensuel", value: 45, color: "#3B82F6" },
  { name: "Trimestriel", value: 28, color: "#10B981" },
  { name: "Annuel", value: 18, color: "#8B5CF6" },
  { name: "VIP", value: 6, color: "#F59E0B" },
  { name: "Coaching", value: 3, color: "#EF4444" },
];

export const SUBSCRIPTION_LABELS: Record<SubscriptionType, string> = {
  monthly: "Mensuel",
  quarterly: "Trimestriel",
  annual: "Annuel",
  vip: "VIP",
  coaching: "Coaching Perso",
};

export const getStatusLabel = (status: MemberStatus) => {
  const labels: Record<MemberStatus, string> = {
    active: "Actif",
    expired: "Expiré",
    suspended: "Suspendu",
  };
  return labels[status];
};

export const formatCurrency = (amount: number) =>
  new Intl.NumberFormat("fr-MG", { style: "currency", currency: "MGA", maximumFractionDigits: 0 }).format(amount);

export const formatDate = (dateStr: string) =>
  new Date(dateStr).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });

export const formatDateTime = (date: string, time: string) =>
  `${new Date(date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" })} à ${time}`;
