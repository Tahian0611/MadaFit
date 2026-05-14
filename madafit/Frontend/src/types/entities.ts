/**
 * TypeScript types for all backend entities
 * Auto-generated from Symfony backend entities
 * + Notification Premium System
 */

// ============================================================================
// SHARED TYPES
// ============================================================================
export type MemberStatus = "active" | "expired" | "suspended";
export type SubscriptionType = "monthly" | "quarterly" | "annual" | "vip" | "coaching";
export type AccessType = "abonnement" | "seance";
export type CardStatus = "active" | "inactive" | "lost";
export type ActivityType = "musculation" | "cardio" | "danse" | "gym" | "cours_collectif";

// ============================================================================
// NOTIFICATION TYPES (PREMIUM)
// ============================================================================
export type NotificationType = 'member' | 'payment' | 'access' | 'stock' | 'subscription' | 'system';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

// ============================================================================
// ARTICLE TYPE
// ============================================================================
export type ArticleCategory = 'news' | 'promo' | 'event' | 'tips';

// ============================================================================
// USER ENTITY
// ============================================================================
export interface User {
  id?: number;
  email: string;
  roles: string[];
  memberId?: string;
  rfidCard?: string;
  photo?: string;
  firstName: string;
  lastName: string;
  fullName?: string;
  phone?: string;
  dob?: string; // ISO 8601 date
  gender?: string;
  address?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalNotes?: string;
  joinDate?: string; // ISO 8601 date
  subscription?: SubscriptionType;
  status?: MemberStatus;
  expiryDate?: string; // ISO 8601 date
  startDate?: string; // ISO 8601 date
  coach?: string;
  program?: string;
  totalPayments?: number;
  lastVisit?: string; // ISO 8601 date
  visitCount?: number;
  inGym?: boolean;
  notes?: string;
  // ═══════════════════════════════════════════════════════════════════════
  // INJECTION : activities (tableau) + activity conservé pour compatibilité
  // ═══════════════════════════════════════════════════════════════════════
  activities?: ActivityType[];
  activity?: ActivityType;
  // ═══════════════════════════════════════════════════════════════════════
  accessType?: AccessType;
  cardStatus?: CardStatus;
  promotion?: string;
  attendanceRecords?: AttendanceRecord[];
  paymentRecords?: PaymentRecord[];
  visitRecords?: VisitRecord[];
  notifications?: Notification[];
}

// ============================================================================
// ARTICLE ENTITY
// ============================================================================
export interface Article {
  id?: number;
  title: string;
  content: string;
  imageUrl?: string | null;
  category?: ArticleCategory | null;
  isPublished: boolean;
  publishedAt?: string | null;
  createdAt?: string;
  updatedAt?: string | null;
  author?: User | null;
}

// ============================================================================
// PRODUCT ENTITY
// ============================================================================
export interface Product {
  id?: number;
  name: string;
  category: string;
  purchasePrice: number;
  salePrice: number;
  initialStock: number;
  currentStock: number;
  registrationDate?: string; // ISO 8601 date
  transactions?: Transaction[];
}

// ============================================================================
// SUBSCRIPTION PLAN ENTITY
// ============================================================================
export interface SubscriptionPlan {
  id?: number;
  name: string;
  type: string;
  duration: number;
  price: number;
  features?: string[];
  color?: string;
  popular?: boolean;
}

// ============================================================================
// ATTENDANCE RECORD ENTITY
// ============================================================================
export interface AttendanceRecord {
  id?: number;
  memberId?: string;
  memberName?: string;
  rfidCard?: string;
  checkIn?: string; // ISO 8601 time
  checkOut?: string; // ISO 8601 time
  date: string; // ISO 8601 date
  user?: User | string; // IRI ou objet User
}

// ============================================================================
// PAYMENT ENTITY
// ============================================================================
export interface Payment {
  id?: number;
  memberId?: string;
  memberName?: string;
  amount: number;
  method: string;
  date: string; // ISO 8601 date
  subscription?: string;
  receiptNo?: string;
}

// ============================================================================
// PAYMENT RECORD ENTITY
// ============================================================================
export interface PaymentRecord {
  id?: number;
  date: string; // ISO 8601 date
  amount: number;
  method: string;
  subscription?: string;
  receiptNo?: string;
  user?: User;
}

// ============================================================================
// NOTIFICATION ENTITY (PREMIUM - Compatible backend existant)
// ============================================================================
export interface Notification {
  id?: number;
  // Champs legacy (compatibilité backend actuel)
  type: string;
  title: string;
  message: string;
  date: string; // ISO 8601 datetime (legacy)
  read: boolean; // legacy
  
  // Champs premium (nouveau système)
  isRead?: boolean; // alias pour read
  createdAt?: string; // ISO 8601 datetime (nouveau)
  priority?: NotificationPriority;
  link?: string;
  icon?: string;
  actionText?: string;
  actionLink?: string;
  readAt?: string;
  
  // Relations
  memberId?: string;
  memberName?: string;
  user?: User | string; // IRI ou objet User
}

// ============================================================================
// TRANSACTION ENTITY
// ============================================================================
export interface Transaction {
  id?: number;
  type: string;
  quantity: number;
  note?: string;
  date: string; // ISO 8601 datetime
  unitPrice?: number;
  product?: Product | string; // IRI ou objet Product
}

// ============================================================================
// VISIT RECORD ENTITY
// ============================================================================
export interface VisitRecord {
  id?: number;
  date: string; // ISO 8601 date
  checkIn?: string; // ISO 8601 time
  checkOut?: string; // ISO 8601 time
  user?: User;
}

// ============================================================================
// PROMO CODE ENTITY
// ============================================================================
export interface PromoCode {
  id?: number;
  code: string;
  discountPercentage?: number;
  discountAmount?: number;
  expiryDate: string; // ISO 8601 date
  isActive: boolean;
  maxUses?: number;
  currentUses?: number;
}

// ============================================================================
// DAILY SUMMARY ROW ENTITY
// ============================================================================
export interface DailySummaryRow {
  id?: number;
  product?: Product;
  initialStock: number;
  totalEntries: number;
  totalSales: number;
  totalNonSaleExits: number;
  totalExits: number;
  finalStock: number;
  totalCost: number;
  revenue: number;
  profit: number;
}

// ============================================================================
// API RESPONSE TYPES
// ============================================================================

export interface ApiResponse<T> {
  data: T;
  status: number;
  message?: string;
}

export interface ApiListResponse<T> {
  '@context': string;
  '@id': string;
  '@type': string;
  'hydra:member': T[];
  'hydra:totalItems': number;
  'hydra:view': {
    '@id': string;
    '@type': string;
    'hydra:first': string;
    'hydra:last': string;
    'hydra:next'?: string;
  };
}

// ============================================================================
// QUERY PARAMETERS
// ============================================================================

export interface QueryParams {
  page?: number;
  itemsPerPage?: number;
  order?: {
    [key: string]: 'asc' | 'desc';
  };
  search?: string;
  filters?: {
    [key: string]: string | number | boolean | string[];
  };
}

// ============================================================================
// NOTIFICATION SPECIFIC TYPES (PREMIUM)
// ============================================================================

export interface NotificationFilter {
  type?: NotificationType | 'all';
  priority?: NotificationPriority | 'all';
  readStatus?: 'all' | 'read' | 'unread';
}

export interface NotificationStats {
  total: number;
  unread: number;
  urgent: number;
}

export interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  markAsRead: (id: number) => void;
  markAllAsRead: () => void;
  refetch: () => void;
}