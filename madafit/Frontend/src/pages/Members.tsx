import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState, useCallback, useRef, memo } from "react";
import { Link } from "react-router-dom";
import { refreshNotifications } from '@/services/api';
import { Search, Trash2, UserPlus, Wifi, RefreshCw, CreditCard, Loader2, RotateCcw, AlertCircle } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/hooks/useAuth";
import PromptModal from "@/components/PromptModal";
import {
  ACTIVITY_LABELS,
  STATUS_LABELS,
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  getFullName,
  normalizeMemberStatus,
  normalizeSubscriptionType,
  calculateSubscriptionProgress,
  type MemberStatus,
  type SubscriptionType,
  calculateGracePeriodStartDate,
} from "@/lib/madafit";
import type { User, SubscriptionPlan, PromoCode, UserSubscription } from "@/types/entities";

const STATUS_FILTERS: { value: "all" | MemberStatus; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "pending", label: "En attente" },
  { value: "expired", label: "Expires" },
  { value: "suspended", label: "Suspendus" },
];

/* ─── Hook utilitaire : debounce ───────────────────────────────────────── */
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

/* ─── Options communes React Query (cache, retry, pas de flash) ─────────── */
const COMMON_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  placeholderData: (previousData: any) => previousData,
} as const;

/* ─── Fonction utilitaire : calculer la date d'expiration ─────────────── */
function computeExpiryDateForMember(
  member: User | null,
  plans: SubscriptionPlan[]
): string | null {
  if (!member || plans.length === 0) return member?.expiryDate ?? null;

  const normalizedSub = normalizeSubscriptionType(member.subscription);

  const start = member.startDate
    ? new Date(member.startDate)
    : member.joinDate
    ? new Date(member.joinDate)
    : null;
  const end = member.expiryDate ? new Date(member.expiryDate) : null;
  let currentDuration = 1;
  if (start && end) {
    const diffMonths =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth());
    currentDuration = Math.max(1, Math.round(diffMonths));
  }

  let matchedPlan = plans.find(
    (p) =>
      normalizeSubscriptionType(p.type) === normalizedSub &&
      Number(p.duration) === currentDuration
  );
  if (!matchedPlan) {
    matchedPlan = plans.find(
      (p) => normalizeSubscriptionType(p.type) === normalizedSub
    );
  }

  const base = member.startDate || member.joinDate;
  if (!matchedPlan?.duration || !base) return member.expiryDate ?? null;

  const expiry = new Date(base);
  expiry.setMonth(expiry.getMonth() + Number(matchedPlan.duration));
  return expiry.toISOString().split("T")[0];
}

/* ═══════════════════════════════════════════════════════════════════════
   NOUVEAU : Déterminer le statut effectif d'un membre basé sur ses offres
   ═══════════════════════════════════════════════════════════════════════ */
function getMemberEffectiveStatus(member: User): MemberStatus {
  const userSubs = member.userSubscriptions ?? [];
  if (userSubs.length === 0) {
    return normalizeMemberStatus(member.status);
  }
  const hasActive = userSubs.some((sub) => sub.status === "active");
  if (hasActive) return "active";
  const hasPending = userSubs.some((sub) => sub.status === "pending");
  if (hasPending) return "pending";
  const hasExpired = userSubs.some((sub) => sub.status === "expired");
  if (hasExpired) return "expired";
  return "suspended";
}

/* ═══════════════════════════════════════════════════════════════════════
   NOUVEAU : Formater l'affichage des offres pour la colonne
   ═══════════════════════════════════════════════════════════════════════ */
function formatSubscriptionsDisplay(member: User): string {
  const userSubs = member.userSubscriptions ?? [];
  if (userSubs.length === 0) return "Aucune";
  const activeCount = userSubs.filter((s) => s.status === "active").length;
  const pendingCount = userSubs.filter((s) => s.status === "pending").length;
  const expiredCount = userSubs.filter((s) => s.status === "expired").length;
  const suspendedCount = userSubs.filter((s) => s.status === "suspended").length;
  const parts: string[] = [];
  if (activeCount > 0) parts.push(`${activeCount} active${activeCount > 1 ? "s" : ""}`);
  if (pendingCount > 0) parts.push(`${pendingCount} en attente`);
  if (expiredCount > 0) parts.push(`${expiredCount} expirée${expiredCount > 1 ? "s" : ""}`);
  if (suspendedCount > 0) parts.push(`${suspendedCount} suspendue${suspendedCount > 1 ? "s" : ""}`);
  return parts.join(", ");
}

/* ═══════════════════════════════════════════════════════════════════════
   NOUVEAU : Vérifier si un membre actif a des offres en attente
   ═══════════════════════════════════════════════════════════════════════ */
function hasPendingWhileActive(member: User): boolean {
  const userSubs = member.userSubscriptions ?? [];
  if (userSubs.length === 0) return false;
  const hasActive = userSubs.some((s) => s.status === "active");
  const hasPending = userSubs.some((s) => s.status === "pending");
  return hasActive && hasPending;
}

/* ─── Ligne de tableau mémoïsée ───────────────────────────────────────── */
interface MemberTableRowProps {
  member: User;
  isSelected: boolean;
  onSelect: (member: User) => void;
  onRequestDelete: (member: User) => void;
}

const MemberTableRow = memo(function MemberTableRow({
  member,
  isSelected,
  onSelect,
  onRequestDelete,
}: MemberTableRowProps) {
  const status = getMemberEffectiveStatus(member);

  const getSubscriptionDisplay = (member: User): string => {
    const userSubs = member.userSubscriptions ?? [];
    if (userSubs.length > 0) {
      const activeOrPending = userSubs
        .filter((sub) => sub.status === 'pending' || sub.status === 'active')
        .map((sub) => sub.planName);
      if (activeOrPending.length > 0) {
        return activeOrPending.join(', ');
      }
    }
    const subscription = normalizeSubscriptionType(member.subscription);
    return SUBSCRIPTION_LABELS[subscription as SubscriptionType] ?? subscription ?? '—';
  };

  const handleClick = useCallback(() => onSelect(member), [onSelect, member]);
  const handleDelete = useCallback(
    (event: React.MouseEvent) => {
      event.stopPropagation();
      onRequestDelete(member);
    },
    [onRequestDelete, member]
  );

  return (
    <tr
      className={`cursor-pointer hover:bg-muted/20 ${isSelected ? "bg-primary/5" : ""}`}
      onClick={handleClick}
    >
      <td>
        <div>
          <p className="font-semibold text-sm text-foreground">{getFullName(member)}</p>
          <p className="text-xs text-muted-foreground">{member.email}</p>
          <p className="text-xs text-muted-foreground">{member.memberId || "Sans numéro"}</p>
        </div>
      </td>
      <td>{getSubscriptionDisplay(member)}</td>
      {/* ═══════════════════════════════════════════════════════════════════════
          NOUVEAU : Colonne Offres
          ═══════════════════════════════════════════════════════════════════════ */}
      <td>
        <span className="text-xs text-muted-foreground">{formatSubscriptionsDisplay(member)}</span>
      </td>
      <td>
        {member.activities && member.activities.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {member.activities.map((act) => (
              <span key={act} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                {ACTIVITY_LABELS[act as keyof typeof ACTIVITY_LABELS] ?? act}
              </span>
            ))}
          </div>
        ) : member.activity ? (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
            {ACTIVITY_LABELS[member.activity as keyof typeof ACTIVITY_LABELS] ?? member.activity}
          </span>
        ) : (
          "—"
        )}
      </td>
      <td>
        {/* ═══════════════════════════════════════════════════════════════════════
            MODIFIÉ : Badge avec indicateur visuel si actif + pending
            ═══════════════════════════════════════════════════════════════════════ */}
        <span className="inline-flex items-center gap-1.5">
          <span className={status === "active" ? "badge-active" : status === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : status === "expired" ? "badge-expired" : "badge-suspended"}>
            {STATUS_LABELS[status]}
          </span>
          {hasPendingWhileActive(member) && (
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-orange-500"></span>
            </span>
          )}
        </span>
      </td>
      <td>
        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
          <Wifi size={12} />
          {member.rfidCard || "Non assignée"}
        </span>
      </td>
      <td>
        <div className="flex flex-col gap-1">
          <span>{formatDate(member.expiryDate)}</span>
          {member.startDate && member.expiryDate && (
            <span className="text-[10px] text-muted-foreground font-medium">
              {Math.round(calculateSubscriptionProgress(member.startDate, member.expiryDate) * 100)}% utilisé
            </span>
          )}
        </div>
      </td>
      <td>
        <button
          className="p-2 rounded-lg hover:bg-destructive/10 text-destructive"
          onClick={handleDelete}
        >
          <Trash2 size={14} />
        </button>
      </td>
    </tr>
  );
});

/* ─── Composant principal ─────────────────────────────────────────────── */
export default function Members() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? "caisse2" : "caisse1";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 250);

  const [statusFilter, setStatusFilter] = useState<"all" | MemberStatus>("all");
  const [promptConfig, setPromptConfig] = useState<{
    isOpen: boolean;
    type: "confirm" | "prompt";
    title: string;
    message: string;
    defaultValue?: any;
    inputType?: string;
    confirmText?: string;
    confirmColor?: string;
    promoCode?: string;
    onConfirm: (val?: any) => void;
  }>({
    isOpen: false,
    type: "confirm",
    title: "",
    message: "",
    onConfirm: () => { },
  });

  /* ── Requêtes API (optimisées : cache, retry, pas de flash) ───────── */
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });

  const promoCodesQuery = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => api.promoCodes.getAll({ itemsPerPage: 100 }),
    ...COMMON_QUERY_OPTIONS,
  });

  /* ── Données dérivées (mémorisées) ────────────────────────────────── */
  const members = useMemo(() => extractHydraMembers<User>(usersQuery.data), [usersQuery.data]);
  const plans = useMemo(() => extractHydraMembers<SubscriptionPlan>(plansQuery.data), [plansQuery.data]);
  const promoCodes = useMemo(() => extractHydraMembers<PromoCode>(promoCodesQuery.data), [promoCodesQuery.data]);

  const promoCodeMap = useMemo(() => {
    const map = new Map<string, PromoCode>();
    promoCodes.forEach((p) => map.set(p.code.toUpperCase(), p));
    return map;
  }, [promoCodes]);

  const getAmountWithPromo = useCallback(
    (member: User, originalPrice: number) => {
      if (!member.promotion) return originalPrice;
      const promo = promoCodeMap.get(member.promotion.toUpperCase());
      if (!promo) return originalPrice;
      let discounted = originalPrice;
      if (promo.discountPercentage) {
        discounted -= originalPrice * (promo.discountPercentage / 100);
      } else if (promo.discountAmount) {
        discounted -= promo.discountAmount;
      }
      return Math.max(0, discounted);
    },
    [promoCodeMap]
  );

  /* ── Mutations avec Optimistic Update (UI instantanée) ───────────── */
  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.users.delete(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.filter((m: any) => m.id !== id) ?? [],
          "hydra:totalItems": Math.max(0, (previousData["hydra:totalItems"] || 0) - 1),
        });
      }
      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) queryClient.setQueryData(["users"], context.previousData);
      toast.error(err.message);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onSuccess: () => {
      toast.success("Membre supprimé");
      setSelectedMember(null);
    },
  });

  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const computeAndGetExpiryDate = useCallback(
    (member: User | null): string | null => {
      return computeExpiryDateForMember(member, plans);
    },
    [plans]
  );

  const validerMutation = useMutation({
    mutationFn: async (id: number) => {
      const today = new Date().toISOString().split("T")[0];
      const member = members.find((m) => m.id === id);
      const expiryDate = computeAndGetExpiryDate(member);
      return api.users.update(id, {
        status: "active",
        startDate: today,
        ...(expiryDate ? { expiryDate } : {}),
      });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      const member = members.find((m) => m.id === id);
      const expiryDate = computeAndGetExpiryDate(member);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.map((m: any) =>
            m.id === id
              ? {
                  ...m,
                  status: "active",
                  startDate: new Date().toISOString().split("T")[0],
                  ...(expiryDate ? { expiryDate } : {}),
                }
              : m
          ) ?? [],
        });
      }
      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) queryClient.setQueryData(["users"], context.previousData);
      toast.error("Erreur lors de la validation");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onSuccess: () => {
      toast.success("Abonnement validé avec succès");
      setSelectedMember(null);
    },
  });

  const payerMutation = useMutation({
    mutationFn: async ({
      id,
      amount,
      userIri,
      subscription,
    }: {
      id: number;
      amount: number;
      userIri: string;
      subscription: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = members.find((m) => m.id === id);
      const originalStart = currentUser?.startDate || currentUser?.joinDate || today;
      const actualStartDate = calculateGracePeriodStartDate(originalStart);

      await api.paymentRecords.create({
        user: userIri,
        amount: amount,
        date: today,
        method: "Espèces",
        receiptNo: `VAL-${Date.now()}`,
        subscription: subscription,
      });

      await api.payments.create({
        memberId: currentUser?.memberId,
        memberName: currentUser ? getFullName(currentUser) : undefined,
        amount,
        date: today,
        method: "cash",
        receiptNo: `VAL-${Date.now()}`,
        subscription,
        cashRegister: currentCashRegister,
      });

      const newTotal = (currentUser?.totalPayments || 0) + amount;
      const expiryDate = computeAndGetExpiryDate(currentUser);

      return api.users.update(id, {
        status: "active",
        startDate: actualStartDate,
        ...(expiryDate ? { expiryDate } : {}),
        totalPayments: newTotal,
      });
    },
    onMutate: async ({ id, amount }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      const currentUser = members.find((m) => m.id === id);
      const expiryDate = computeAndGetExpiryDate(currentUser);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.map((m: any) =>
            m.id === id
              ? {
                  ...m,
                  status: "active",
                  startDate: new Date().toISOString().split("T")[0],
                  ...(expiryDate ? { expiryDate } : {}),
                  totalPayments: (m.totalPayments || 0) + amount,
                }
              : m
          ) ?? [],
        });
      }
      return { previousData };
    },
    onError: (err, vars, context) => {
      if (context?.previousData) queryClient.setQueryData(["users"], context.previousData);
      toast.error("Erreur lors du paiement");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré et abonnement validé");
      setSelectedMember(null);
    },
  });

  const enregistrerPaiementMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: number; amount: number }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = members.find((m) => m.id === id);
      await api.payments.create({
        memberId: currentUser?.memberId,
        memberName: currentUser ? getFullName(currentUser) : undefined,
        amount,
        date: today,
        method: "cash",
        receiptNo: `PAY-${Date.now()}`,
        subscription: currentUser?.subscription || "",
        cashRegister: currentCashRegister,
      });
      const newTotal = (currentUser?.totalPayments || 0) + amount;
      return api.users.update(id, { totalPayments: newTotal });
    },
    onMutate: async ({ id, amount }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.map((m: any) =>
            m.id === id ? { ...m, totalPayments: (m.totalPayments || 0) + amount } : m
          ) ?? [],
        });
      }
      return { previousData };
    },
    onError: (err, vars, context) => {
      if (context?.previousData) queryClient.setQueryData(["users"], context.previousData);
      toast.error("Erreur lors de l'enregistrement du paiement");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré avec succès");
      setSelectedMember(null);
    },
  });

  const resilierMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended" }),
    onSuccess: () => {
      toast.success("Abonnement résilié");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de la résiliation"),
  });

  const refuserMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended", subscription: null }),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.map((m: any) =>
            m.id === id ? { ...m, status: "suspended", subscription: null } : m
          ) ?? [],
        });
      }
      return { previousData };
    },
    onError: (err, id, context) => {
      if (context?.previousData) queryClient.setQueryData(["users"], context.previousData);
      toast.error("Erreur lors du refus");
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
    onSuccess: () => {
      toast.success("Demande refusée");
      setSelectedMember(null);
    },
  });

  /* ── Mutations pour UserSubscription ─────────────────────── */
  const validateSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, validatedBy }: { subscriptionId: number; validatedBy: string }) => {
      const today = new Date().toISOString().split("T")[0];
      return api.userSubscriptions.update(subscriptionId, {
        status: "active",
        startDate: today,
        validatedBy,
        validatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Offre validée avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de la validation de l'offre"),
  });

  const paySubscriptionMutation = useMutation({
    mutationFn: async ({
      subscriptionId,
      amount,
      userIri,
      planName,
      validatedBy,
    }: {
      subscriptionId: number;
      amount: number;
      userIri: string;
      planName: string;
      validatedBy: string;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      
      await api.paymentRecords.create({
        user: userIri,
        amount,
        date: today,
        method: "Espèces",
        receiptNo: `VAL-${Date.now()}`,
        subscription: planName,
        userSubscription: `/api/user_subscriptions/${subscriptionId}`,
      });

      await api.payments.create({
        memberId: selectedMember?.memberId,
        memberName: selectedMember ? getFullName(selectedMember) : undefined,
        amount,
        date: today,
        method: "cash",
        receiptNo: `VAL-${Date.now()}`,
        subscription: planName,
        cashRegister: currentCashRegister,
        userSubscription: `/api/user_subscriptions/${subscriptionId}`,
      });

      return api.userSubscriptions.update(subscriptionId, {
        status: "active",
        startDate: today,
        totalPaid: amount,
        validatedBy,
        validatedAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré et offre validée");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors du paiement de l'offre"),
  });

  const payActiveSubscriptionMutation = useMutation({
    mutationFn: async ({
      subscriptionId,
      amount,
      userIri,
      planName,
      currentTotalPaid,
    }: {
      subscriptionId: number;
      amount: number;
      userIri: string;
      planName: string;
      currentTotalPaid: number;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      const newTotalPaid = currentTotalPaid + amount;
      
      await api.paymentRecords.create({
        user: userIri,
        amount,
        date: today,
        method: "Espèces",
        receiptNo: `PAY-${Date.now()}`,
        subscription: planName,
        userSubscription: `/api/user_subscriptions/${subscriptionId}`,
      });

      await api.payments.create({
        memberId: selectedMember?.memberId,
        memberName: selectedMember ? getFullName(selectedMember) : undefined,
        amount,
        date: today,
        method: "cash",
        receiptNo: `PAY-${Date.now()}`,
        subscription: planName,
        cashRegister: currentCashRegister,
        userSubscription: `/api/user_subscriptions/${subscriptionId}`,
      });

      return api.userSubscriptions.update(subscriptionId, {
        totalPaid: newTotalPaid,
      });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement du paiement"),
  });

  /* ═══════════════════════════════════════════════════════════════════════
     MODIFIÉ : Synchronisation active de member.status lors du refus
     ═══════════════════════════════════════════════════════════════════════ */
  const refuseSubscriptionMutation = useMutation({
    mutationFn: async (subscriptionId: number) => {
      await api.userSubscriptions.update(subscriptionId, {
        status: "suspended",
      });
      if (selectedMember?.id) {
        const freshSubs = selectedMember.userSubscriptions?.filter((s) => s.id !== subscriptionId) ?? [];
        const hasRemainingActive = freshSubs.some((s) => s.status === "active");
        const hasRemainingPending = freshSubs.some((s) => s.status === "pending");
        if (hasRemainingActive) {
          await api.users.update(selectedMember.id, { status: "active" });
        } else if (hasRemainingPending) {
          await api.users.update(selectedMember.id, { status: "pending" });
        } else {
          await api.users.update(selectedMember.id, { status: "suspended" });
        }
      }
    },
    onSuccess: () => {
      toast.success("Offre refusée");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors du refus de l'offre"),
  });

  /* ═══════════════════════════════════════════════════════════════════════
     MODIFIÉ : Filtre basé sur le statut effectif des membres
     ═══════════════════════════════════════════════════════════════════════ */
  const filteredMembers = useMemo(() => {
    const needle = debouncedSearch.toLowerCase();
    return members.filter((member) => {
      const effectiveStatus = getMemberEffectiveStatus(member);
      if (statusFilter !== "all" && effectiveStatus !== statusFilter) return false;
      if (!debouncedSearch) return true;

      const haystack = [
        getFullName(member),
        member.memberId,
        member.rfidCard,
        member.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [members, debouncedSearch, statusFilter]);

  /* ── Date d'expiration calculée (pour affichage uniquement) ───────── */
  const computedExpiryDate = useMemo(() => {
    return computeExpiryDateForMember(selectedMember, plans);
  }, [selectedMember, plans]);

  /* ── SOLUTION 1 : Débouncer pour synchro auto (sans boucle) ───────── */
  const [stableExpiryDate, setStableExpiryDate] = useState<string | null>(null);

  useEffect(() => {
    if (
      !selectedMember?.id ||
      !computedExpiryDate ||
      computedExpiryDate === selectedMember.expiryDate
    ) {
      setStableExpiryDate(null);
      return;
    }
    const timer = setTimeout(() => {
      setStableExpiryDate(computedExpiryDate);
    }, 2000);
    return () => clearTimeout(timer);
  }, [computedExpiryDate, selectedMember?.expiryDate, selectedMember?.id]);

  const updateExpiryMutation = useMutation({
    mutationFn: ({ id, expiryDate }: { id: number; expiryDate: string }) =>
      api.users.update(id, { expiryDate }),
    onSuccess: () => {
      toast.success("Date de fin synchronisée en base ✓");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setStableExpiryDate(null);
    },
    onError: (error: any) => {
      console.error("Erreur sync date:", error?.message || error);
      setStableExpiryDate(null);
    },
  });

  useEffect(() => {
    if (
      !selectedMember?.id ||
      !stableExpiryDate ||
      stableExpiryDate === selectedMember.expiryDate ||
      updateExpiryMutation.isPending
    )
      return;

    updateExpiryMutation.mutate({
      id: selectedMember.id,
      expiryDate: stableExpiryDate,
    });
  }, [stableExpiryDate, selectedMember?.id, selectedMember?.expiryDate]);

  /* ── Synchronise selectedMember avec les données fraîches du cache ─── */
  const selectedMemberRef = useRef(selectedMember);
  useEffect(() => {
    selectedMemberRef.current = selectedMember;
  });

  useEffect(() => {
    if (selectedMemberRef.current && members.length > 0) {
      const fresh = members.find((m) => m.id === selectedMemberRef.current!.id);
      if (fresh) {
        const cur = selectedMemberRef.current;
        if (
          fresh.status !== cur.status ||
          fresh.totalPayments !== cur.totalPayments ||
          fresh.expiryDate !== cur.expiryDate ||
          fresh.startDate !== cur.startDate
        ) {
          setSelectedMember(fresh);
        }
      }
    }
  }, [members]);

  /* ── Helpers d'affichage ───────────────────────────────────────────── */
  const isActiveButUnpaid = useCallback((member: User | null): boolean => {
    if (!member) return false;
    const status = getMemberEffectiveStatus(member);
    return status === "active" && (member.totalPayments == null || member.totalPayments === 0);
  }, []);

  /* ── Helpers pour UserSubscription ──────────────────────── */
  const getPendingSubscriptions = useCallback((member: User | null): UserSubscription[] => {
    if (!member?.userSubscriptions) return [];
    return member.userSubscriptions.filter((sub) => sub.status === "pending");
  }, []);

  const getActiveSubscriptions = useCallback((member: User | null): UserSubscription[] => {
    if (!member?.userSubscriptions) return [];
    return member.userSubscriptions.filter((sub) => sub.status === "active");
  }, []);

  const getPlanPrice = useCallback((planName: string): number => {
    const plan = plans.find((p) => p.name === planName);
    return plan?.price || 0;
  }, [plans]);

  /* ── Handlers stables pour éviter les re-rendus des lignes ────────── */
  const handleSelectMember = useCallback((member: User) => {
    setSelectedMember(member);
  }, []);

  const handleRequestDelete = useCallback(
    (member: User) => {
      setPromptConfig({
        isOpen: true,
        type: "confirm",
        title: "Supprimer le membre",
        message: `Voulez-vous vraiment supprimer ${getFullName(member)} ?`,
        confirmText: "Oui, supprimer",
        confirmColor: "bg-destructive",
        onConfirm: () => {
          if (member.id) deleteMutation.mutate(member.id);
          setPromptConfig((prev) => ({ ...prev, isOpen: false }));
        },
      });
    },
    [deleteMutation]
  );

  /* ── Rendu du panneau de détail (mémorisé) ────────────────────────── */
  const detailPanel = useMemo(() => {
    if (!selectedMember) {
      return (
        <p className="text-sm text-muted-foreground text-center py-10">
          Sélectionnez un membre pour voir ses informations.
        </p>
      );
    }

    const status = getMemberEffectiveStatus(selectedMember);
    const pendingSubs = getPendingSubscriptions(selectedMember);
    const activeSubs = getActiveSubscriptions(selectedMember);
    
    const normalizedSub = normalizeSubscriptionType(selectedMember.subscription);
    const start = selectedMember.startDate ? new Date(selectedMember.startDate) : (selectedMember.joinDate ? new Date(selectedMember.joinDate) : null);
    const end = selectedMember.expiryDate ? new Date(selectedMember.expiryDate) : null;
    let currentDuration = 1;
    if (start && end) {
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      currentDuration = Math.max(1, Math.round(diffMonths));
    }

    let matchedPlan = plans.find(p => normalizeSubscriptionType(p.type) === normalizedSub && Number(p.duration) === currentDuration);
    if (!matchedPlan) {
      matchedPlan = plans.find(p => normalizeSubscriptionType(p.type) === normalizedSub);
    }

    const defaultPrice = matchedPlan ? getAmountWithPromo(selectedMember, matchedPlan.price) : 0;

    /* ═══════════════════════════════════════════════════════════════════════
       MODIFIÉ : Déterminer les offres actives/pending pour affichage
       ═══════════════════════════════════════════════════════════════════════ */
    const getActiveOffersDisplay = (): string => {
      const userSubs = selectedMember.userSubscriptions ?? [];
      if (userSubs.length === 0) {
        const subLabel = SUBSCRIPTION_LABELS[normalizeSubscriptionType(selectedMember.subscription) as SubscriptionType] ??
          normalizeSubscriptionType(selectedMember.subscription);
        return subLabel || "Aucune";
      }
      const activeOrPending = userSubs
        .filter((sub) => sub.status === "active" || sub.status === "pending")
        .map((sub) => sub.planName);
      if (activeOrPending.length > 0) return activeOrPending.join(", ");
      return "Aucune";
    };

    return (
      <div className="space-y-6 text-sm">
        <div
          className="flex flex-col items-center text-center space-y-3 pb-4 border-b"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="w-24 h-24 rounded-2xl bg-muted border-2 border-primary/20 overflow-hidden shadow-lg">
            <img
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedMember.email}`}
              alt="Avatar"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <p className="font-black text-lg text-foreground leading-tight">{getFullName(selectedMember)}</p>
            <p className="text-muted-foreground font-medium">{selectedMember.memberId}</p>
          </div>
          <div className="p-3 bg-white rounded-2xl border border-border shadow-md">
            <QRCodeSVG value={`MADAFIT:${selectedMember.memberId}`} size={160} className="w-40 h-40" />
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <InfoRow label="Email" value={selectedMember.email} />
          <InfoRow label="Téléphone" value={selectedMember.phone} />
          <InfoRow label="Carte RFID" value={selectedMember.rfidCard} />
          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">Activités</span>
            <div className="flex flex-wrap gap-1 justify-end">
              {selectedMember.activities && selectedMember.activities.length > 0 ? (
                selectedMember.activities.map((act) => (
                  <span key={act} className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                    {ACTIVITY_LABELS[act as keyof typeof ACTIVITY_LABELS] ?? act}
                  </span>
                ))
              ) : selectedMember.activity ? (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary">
                  {ACTIVITY_LABELS[selectedMember.activity as keyof typeof ACTIVITY_LABELS] ?? selectedMember.activity}
                </span>
              ) : (
                <span className="text-foreground font-medium">—</span>
              )}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              MODIFIÉ : "Offres actives" au lieu de "Abonnement", valeur dynamique
              ═══════════════════════════════════════════════════════════════════════ */}
          <InfoRow
            label="Offres actives"
            value={getActiveOffersDisplay()}
          />

          {selectedMember.promotion && (
            <div className="flex items-start justify-between gap-4">
              <span className="text-muted-foreground">Code Promo</span>
              <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                {selectedMember.promotion}
              </span>
            </div>
          )}

          <InfoRow label="Date début" value={formatDate(selectedMember.startDate || selectedMember.joinDate)} />

          <div className="flex items-start justify-between gap-4">
            <span className="text-muted-foreground">Date fin</span>
            <div className="flex items-center gap-2 text-right">
              <span className="text-foreground font-medium">{formatDate(computedExpiryDate)}</span>
              {updateExpiryMutation.isPending ? (
                <RefreshCw size={12} className="text-primary animate-spin shrink-0" />
              ) : stableExpiryDate ? (
                <span className="text-[9px] font-bold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                  SYNC...
                </span>
              ) : null}
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════════════════
              MODIFIÉ : "Récapitulatif paiements" avec détail par offre
              ═══════════════════════════════════════════════════════════════════════ */}
          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground text-sm">Récapitulatif paiements</span>
            {(selectedMember.userSubscriptions ?? []).length > 0 ? (
              <div className="space-y-2">
                {selectedMember.userSubscriptions!.map((sub) => {
                  const planPrice = getPlanPrice(sub.planName);
                  const finalPrice = sub.promotion
                    ? getAmountWithPromo({ ...selectedMember, promotion: sub.promotion }, planPrice)
                    : planPrice;
                  const totalPaid = sub.totalPaid || 0;
                  const remaining = Math.max(0, finalPrice - totalPaid);
                  const isFullyPaid = totalPaid >= finalPrice;

                  return (
                    <div key={sub.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/50 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-foreground">{sub.planName}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                          sub.status === "active"
                            ? "bg-green-500/10 text-green-600"
                            : sub.status === "pending"
                            ? "bg-orange-500/10 text-orange-500"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {sub.status === "active" ? "Actif" : sub.status === "pending" ? "En attente" : sub.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Prix total</span>
                        <span className="font-medium text-foreground">{formatCurrency(finalPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Payé</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                      </div>
                      {!isFullyPaid && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Reste dû</span>
                          <span className="font-bold text-orange-500">{formatCurrency(remaining)}</span>
                        </div>
                      )}
                      {isFullyPaid && (
                        <p className="text-[9px] font-bold text-green-600">✓ Paiement complet</p>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Total payé</span>
                  <span className="font-medium text-foreground">
                    {selectedMember.totalPayments != null
                      ? formatCurrency(selectedMember.totalPayments)
                      : formatCurrency(0)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {(() => {
            if (!matchedPlan) return null;
            const finalPrice = getAmountWithPromo(selectedMember, matchedPlan.price);
            if (finalPrice === matchedPlan.price) return null;
            return (
              <div className="flex items-start justify-between gap-4">
                <span className="text-muted-foreground">Prix réduit</span>
                <span className="text-primary font-black">{formatCurrency(finalPrice)}</span>
              </div>
            );
          })()}

          {/* ═══════════════════════════════════════════════════════════════════════
              SUPPRIMÉ : La ligne InfoRow "Notes" a été retirée
              ═══════════════════════════════════════════════════════════════════════ */}

          {/* ═══════════════════════════════════════════════════════════════════════
              NOUVEAU : Bandeau d'alerte si actif avec offres en attente
              ═══════════════════════════════════════════════════════════════════════ */}
          {hasPendingWhileActive(selectedMember) && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/30 flex items-start gap-2">
              <AlertCircle size={16} className="text-orange-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-orange-600">
                  Offres en attente
                </p>
                <p className="text-xs text-orange-500/80">
                  Ce client a {pendingSubs.length} offre{pendingSubs.length > 1 ? "s" : ""} en attente de traitement.
                </p>
              </div>
            </div>
          )}

          {/* ── Offres en attente ── */}
          {pendingSubs.length > 0 && (
            <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <p className="text-sm font-bold text-foreground">Offres en attente ({pendingSubs.length})</p>
              {pendingSubs.map((sub) => {
                const planPrice = getPlanPrice(sub.planName);
                const finalPrice = sub.promotion ? getAmountWithPromo({ ...selectedMember, promotion: sub.promotion }, planPrice) : planPrice;
                
                return (
                  <div key={sub.id} className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{sub.planName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-orange-500/20 text-orange-500">
                        EN ATTENTE
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatCurrency(finalPrice)}</p>
                    <div className="flex flex-col gap-2">
                      <button
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "confirm",
                            title: "Valider l'offre",
                            message: `Valider "${sub.planName}" sans enregistrer de paiement ?`,
                            confirmText: "Oui, valider",
                            onConfirm: () => {
                              if (sub.id) {
                                validateSubscriptionMutation.mutate({
                                  subscriptionId: sub.id,
                                  validatedBy: isAdmin ? "admin" : "reception",
                                });
                              }
                              setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Valider & Commencer
                      </button>
                      <button
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "prompt",
                            title: `Payer "${sub.planName}"`,
                            message: "Saisissez le montant payé par le membre :",
                            defaultValue: String(finalPrice),
                            inputType: "number",
                            confirmText: "Valider le paiement",
                            confirmColor: "bg-green-600",
                            promoCode: sub.promotion,
                            onConfirm: (amountValue) => {
                              let amount = Number(amountValue);
                              if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                              if (amount > 0) {
                                if (sub.id && selectedMember.id) {
                                  paySubscriptionMutation.mutate({
                                    subscriptionId: sub.id,
                                    amount,
                                    userIri: `/api/users/${selectedMember.id}`,
                                    planName: sub.planName,
                                    validatedBy: isAdmin ? "admin" : "reception",
                                  });
                                }
                                setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                              } else {
                                toast.error("Montant invalide");
                              }
                            },
                          });
                        }}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Payer & Valider
                      </button>
                      <button
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "confirm",
                            title: "Refuser l'offre",
                            message: `Refuser l'offre "${sub.planName}" ?`,
                            confirmText: "Oui, refuser",
                            confirmColor: "bg-destructive",
                            onConfirm: () => {
                              if (sub.id) refuseSubscriptionMutation.mutate(sub.id);
                              setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="w-full py-2 px-4 bg-destructive text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Offres actives avec paiement partiel ── */}
          {activeSubs.length > 0 && (
            <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <p className="text-sm font-bold text-foreground">Offres actives ({activeSubs.length})</p>
              {activeSubs.map((sub) => {
                const planPrice = getPlanPrice(sub.planName);
                const finalPrice = sub.promotion ? getAmountWithPromo({ ...selectedMember, promotion: sub.promotion }, planPrice) : planPrice;
                const totalPaid = sub.totalPaid || 0;
                const remaining = Math.max(0, finalPrice - totalPaid);
                const isFullyPaid = totalPaid >= finalPrice;
                
                return (
                  <div key={sub.id} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-foreground">{sub.planName}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-500">
                        ACTIF
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Du {formatDate(sub.startDate)} au {formatDate(sub.expiryDate)}
                    </p>
                    
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Prix total :</span>
                        <span className="font-medium text-foreground">{formatCurrency(finalPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Payé :</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                      </div>
                      {!isFullyPaid && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Reste :</span>
                          <span className="font-bold text-orange-500">{formatCurrency(remaining)}</span>
                        </div>
                      )}
                      {isFullyPaid && (
                        <p className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full w-fit">
                          ✓ Paiement complet
                        </p>
                      )}
                    </div>

                    {!isFullyPaid && (
                      <button
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "prompt",
                            title: `Enregistrer un paiement — ${sub.planName}`,
                            message: `Montant restant : ${formatCurrency(remaining)}\nSaisissez le montant payé par le membre :`,
                            defaultValue: String(remaining),
                            inputType: "number",
                            confirmText: "Enregistrer le paiement",
                            confirmColor: "bg-green-600",
                            promoCode: sub.promotion,
                            onConfirm: (amountValue) => {
                              let amount = Number(amountValue);
                              if (isNaN(amount) || amount <= 0) {
                                toast.error("Montant invalide");
                                return;
                              }
                              if (amount > remaining) amount = remaining;
                              if (sub.id && selectedMember.id) {
                                payActiveSubscriptionMutation.mutate({
                                  subscriptionId: sub.id,
                                  amount,
                                  userIri: `/api/users/${selectedMember.id}`,
                                  planName: sub.planName,
                                  currentTotalPaid: totalPaid,
                                });
                              }
                              setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                      >
                        <CreditCard size={16} />
                        Enregistrer un paiement
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════════
              MODIFIÉ : Boutons legacy masqués si userSubscriptions existent
              ═══════════════════════════════════════════════════════════════════════ */}
          {selectedMember.userSubscriptions?.length === 0 && status === "pending" && (
            <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <p className="text-sm font-bold text-foreground">Actions sur la demande</p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() => {
                    setPromptConfig({
                      isOpen: true,
                      type: "confirm",
                      title: "Valider l'abonnement",
                      message: "Voulez-vous valider cet abonnement sans enregistrer de paiement ?",
                      confirmText: "Oui, valider",
                      onConfirm: () => {
                        if (selectedMember.id) validerMutation.mutate(selectedMember.id);
                        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                  className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                >
                  Valider & Commencer
                </button>
                <button
                  onClick={() => {
                    setPromptConfig({
                      isOpen: true,
                      type: "prompt",
                      title: "Enregistrer un paiement",
                      message: "Saisissez le montant payé par le membre :",
                      defaultValue: String(defaultPrice),
                      inputType: "number",
                      confirmText: "Valider le paiement",
                      confirmColor: "bg-green-600",
                      promoCode: selectedMember.promotion,
                      onConfirm: (amountValue) => {
                        let amount = Number(amountValue);
                        if ((isNaN(amount) || amount <= 0) && defaultPrice > 0) amount = defaultPrice;
                        if (amount > 0) {
                          if (selectedMember.id) {
                            payerMutation.mutate({
                              id: selectedMember.id,
                              amount,
                              userIri: `/api/users/${selectedMember.id}`,
                              subscription: selectedMember.subscription || "",
                            });
                          }
                          setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                        } else {
                          toast.error("Montant invalide");
                        }
                      },
                    });
                  }}
                  className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                >
                  Payer & Valider
                </button>
                <button
                  onClick={() => {
                    setPromptConfig({
                      isOpen: true,
                      type: "confirm",
                      title: "Refuser la demande",
                      message: "Voulez-vous refuser cette demande et réinitialiser l'abonnement ?",
                      confirmText: "Oui, refuser",
                      confirmColor: "bg-destructive",
                      onConfirm: () => {
                        if (selectedMember.id) refuserMutation.mutate(selectedMember.id);
                        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                      },
                    });
                  }}
                  className="w-full py-2 px-4 bg-destructive text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                >
                  Refuser
                </button>
              </div>
            </div>
          )}

          {/* ── Paiement pour membre actif non payé (legacy) ── */}
          {isActiveButUnpaid(selectedMember) && selectedMember.userSubscriptions?.length === 0 && (
            <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <p className="text-sm font-bold text-foreground">Paiement en attente</p>
              <p className="text-xs text-muted-foreground">
                Ce membre a été validé mais n'a pas encore réglé son abonnement.
              </p>
              <button
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "prompt",
                    title: "Enregistrer le paiement",
                    message: "Saisissez le montant payé par le membre :",
                    defaultValue: String(defaultPrice),
                    inputType: "number",
                    confirmText: "Enregistrer le paiement",
                    confirmColor: "bg-green-600",
                    promoCode: selectedMember.promotion,
                    onConfirm: (amountValue) => {
                      let amount = Number(amountValue);
                      if ((isNaN(amount) || amount <= 0) && defaultPrice > 0) amount = defaultPrice;
                      if (amount > 0) {
                        if (selectedMember.id) {
                          enregistrerPaiementMutation.mutate({ id: selectedMember.id, amount });
                        }
                        setPromptConfig((prev) => ({ ...prev, isOpen: false }));
                      } else {
                        toast.error("Montant invalide");
                      }
                    },
                  });
                }}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
              >
                <CreditCard size={16} />
                Enregistrer le paiement
              </button>
            </div>
          )}

          {/* ── Info : membre actif déjà payé ── */}
          {status === "active" && !isActiveButUnpaid(selectedMember) && selectedMember.userSubscriptions?.length === 0 && (
            <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                <p className="text-sm font-semibold text-green-600">✓ Abonnement actif — Paiement enregistré</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Total payé: {formatCurrency(selectedMember.totalPayments || 0)}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }, [
    selectedMember,
    plans,
    computedExpiryDate,
    stableExpiryDate,
    updateExpiryMutation.isPending,
    getAmountWithPromo,
    isActiveButUnpaid,
    validerMutation,
    payerMutation,
    refuserMutation,
    enregistrerPaiementMutation,
    validateSubscriptionMutation,
    paySubscriptionMutation,
    payActiveSubscriptionMutation,
    refuseSubscriptionMutation,
    getPendingSubscriptions,
    getActiveSubscriptions,
    getPlanPrice,
    isAdmin,
  ]);

  /* ── Rendu principal ──────────────────────────────────────────────── */
  const isLoading = usersQuery.isLoading && !usersQuery.data;
  const isError = usersQuery.isError;
  const isRefreshing = usersQuery.isFetching && !usersQuery.isLoading;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Gestion des Membres</h1>
          <p className="page-subtitle">
            {members.length} membres synchronisés depuis l'API
            {isRefreshing && <Loader2 size={14} className="inline-block ml-2 animate-spin text-primary" />}
          </p>
        </div>
        <Link
          to="/register"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all hover:opacity-90"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
        >
          <UserPlus size={16} />
          Nouveau membre
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher par nom, email, numéro membre, carte RFID..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="search-input"
          />
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl border bg-card" style={{ borderColor: "hsl(var(--border))" }}>
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setStatusFilter(filter.value)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap"
              style={{
                background: statusFilter === filter.value ? "hsl(var(--primary))" : "transparent",
                color: statusFilter === filter.value ? "white" : "hsl(var(--muted-foreground))",
              }}
            >
              {filter.label}
            </button>
          ))}
        </div>
      </div>

      <div
        className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5"
        style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
      >
        {/* ── Tableau ── */}
        <div
          className="bg-card rounded-xl border overflow-hidden flex flex-col"
          style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}
        >
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "hsl(var(--muted) / 0.95))", backdropFilter: "blur(4px)" }}>
                  <th>Membre</th>
                  <th>Abonnement</th>
                  {/* ═══════════════════════════════════════════════════════════════════════
                      NOUVEAU : En-tête colonne Offres
                      ═══════════════════════════════════════════════════════════════════════ */}
                  <th>Offres</th>
                  <th>Activités</th>
                  <th>Statut</th>
                  <th>Carte</th>
                  <th>Expiration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {isLoading && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground">
                      <div className="flex flex-col items-center gap-2">
                        <Loader2 size={24} className="animate-spin text-primary" />
                        <span>Chargement...</span>
                      </div>
                    </td>
                  </tr>
                )}

                {isError && (
                  <tr>
                    <td colSpan={8} className="text-center py-10">
                      <div className="flex flex-col items-center gap-3 text-destructive">
                        <p>Impossible de charger les membres.</p>
                        <button
                          onClick={() => usersQuery.refetch()}
                          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-medium hover:opacity-90"
                        >
                          <RotateCcw size={14} />
                          Réessayer
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {!isLoading &&
                  !isError &&
                  filteredMembers.map((member) => (
                    <MemberTableRow
                      key={member.id}
                      member={member}
                      isSelected={selectedMember?.id === member.id}
                      onSelect={handleSelectMember}
                      onRequestDelete={handleRequestDelete}
                    />
                  ))}

                {!isLoading && !isError && filteredMembers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="text-center py-10 text-muted-foreground italic">
                      Aucun membre ne correspond à votre recherche.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Fiche rapide ── */}
        <div
          className="bg-card rounded-xl border p-5 overflow-y-auto"
          style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}
        >
          <h2
            className="font-bold text-foreground mb-4 sticky top-0 bg-card z-10 pb-2"
            style={{ borderBottom: "1px solid hsl(var(--border))" }}
          >
            Fiche rapide
          </h2>
          {detailPanel}
        </div>
      </div>

      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={() => setPromptConfig((prev) => ({ ...prev, isOpen: false }))}
        onConfirm={promptConfig.onConfirm}
        title={promptConfig.title}
        message={promptConfig.message}
        type={promptConfig.type}
        defaultValue={promptConfig.defaultValue}
        inputType={promptConfig.inputType}
        confirmText={promptConfig.confirmText}
        confirmColor={promptConfig.confirmColor}
        promoCode={promptConfig.promoCode}
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground font-medium">{value || "—"}</span>
    </div>
  );
}