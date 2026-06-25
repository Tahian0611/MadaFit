import { useMemo, useState, useCallback, useEffect, useRef, memo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, CreditCard, AlertCircle } from "lucide-react";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import PromptModal from "@/components/PromptModal";
import {
  STATUS_LABELS,
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  getFullName,
  normalizeMemberStatus,
  normalizeSubscriptionType,
  calculateGracePeriodStartDate,
  type MemberStatus,
  type SubscriptionType,
} from "@/lib/madafit";
import type { User, SubscriptionPlan, PromoCode, UserSubscription } from "@/types/entities";

/* ─── Options communes React Query (cache, retry, pas de flash) ─────────── */
const COMMON_QUERY_OPTIONS = {
  staleTime: 1000 * 60 * 5,
  gcTime: 1000 * 60 * 10,
  refetchOnWindowFocus: false,
  retry: 2,
  retryDelay: (attemptIndex: number) => Math.min(1000 * 2 ** attemptIndex, 30000),
  placeholderData: (previousData: any) => previousData,
} as const;

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

/* ═══════════════════════════════════════════════════════════════════════
   NOUVEAU : Calculer la nouvelle date de début selon la logique APK
   - Avant/jour J de l'expiration : garde startDate actuel
   - Dans la marge (1-10j après expiry) : startDate = expiryDate
   - Après marge (11j+) : startDate = date du paiement (aujourd'hui)
   ═══════════════════════════════════════════════════════════════════════ */
function calculateRenewalStartDate(
  startDate: string | null,
  expiryDate: string | null,
  paymentDate: Date = new Date()
): string {
  if (!expiryDate) {
    return paymentDate.toISOString().split("T")[0];
  }

  const expiry = new Date(expiryDate);
  const payment = new Date(paymentDate);
  
  expiry.setHours(0, 0, 0, 0);
  payment.setHours(0, 0, 0, 0);
  
  const diffTime = payment.getTime() - expiry.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays <= 0) {
    // Avant ou le jour J : garde le startDate actuel (continuité)
    return startDate ? startDate : expiryDate;
  } else if (diffDays <= 10) {
    // Dans la marge de grâce : commence à la date d'expiration
    return expiryDate;
  } else {
    // Après la marge : commence à la date du paiement
    return payment.toISOString().split("T")[0];
  }
}

/* ═══════════════════════════════════════════════════════════════════════
   CORRECTION : Calculer la date d'expiration à partir du plan
   ═══════════════════════════════════════════════════════════════════════ */
function calculateExpiryDate(startDateStr: string, plan: SubscriptionPlan | null): string {
  const baseDate = new Date(startDateStr);
  const expiry = new Date(baseDate);
  expiry.setMonth(expiry.getMonth() + Number(plan?.duration ?? 1));
  return expiry.toISOString().split("T")[0];
}

/* ─── Ligne de tableau mémoïsée ───────────────────────────────────────── */
interface SubscriptionTableRowProps {
  member: User;
  isSelected: boolean;
  onSelect: (member: User) => void;
}

const SubscriptionTableRow = memo(function SubscriptionTableRow({
  member,
  isSelected,
  onSelect,
}: SubscriptionTableRowProps) {
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
    return SUBSCRIPTION_LABELS[subscription as SubscriptionType] || subscription || "—";
  };

  /* ═══════════════════════════════════════════════════════════════════════
     MODIFIÉ : Calculer le total des paiements depuis toutes les offres
     ═══════════════════════════════════════════════════════════════════════ */
  const getTotalPaymentsFromSubscriptions = (member: User): number => {
    const userSubs = member.userSubscriptions ?? [];
    if (userSubs.length === 0) return member.totalPayments || 0;
    return userSubs.reduce((sum, sub) => sum + (sub.totalPaid || 0), 0);
  };

  const handleClick = useCallback(() => onSelect(member), [onSelect, member]);

  return (
    <tr
      className={`cursor-pointer hover:bg-muted/20 ${isSelected ? "bg-primary/5" : ""}`}
      onClick={handleClick}
    >
      <td>
        <p className="font-semibold text-foreground">{getFullName(member)}</p>
        <p className="text-xs text-muted-foreground">{member.memberId}</p>
      </td>
      <td>{getSubscriptionDisplay(member)}</td>
      {/* ═══════════════════════════════════════════════════════════════════════
          NOUVEAU : Colonne Offres
          ═══════════════════════════════════════════════════════════════════════ */}
      <td>
        <span className="text-xs text-muted-foreground">{formatSubscriptionsDisplay(member)}</span>
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
      <td>{formatDate(member.expiryDate)}</td>
      {/* ═══════════════════════════════════════════════════════════════════════
          MODIFIÉ : Afficher la somme des totalPaid de toutes les offres
          ═══════════════════════════════════════════════════════════════════════ */}
      <td>{formatCurrency(getTotalPaymentsFromSubscriptions(member))}</td>
    </tr>
  );
});

/* ─── Composant principal ─────────────────────────────────────────────── */
export default function Subscriptions() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? "caisse2" : "caisse1";
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
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
    onConfirm: () => {},
  });

  /* ── Requêtes API optimisées ──────────────────────────────────────── */
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

  /* ── Données dérivées mémorisées ──────────────────────────────────── */
  const users = useMemo(() => extractHydraMembers<User>(usersQuery.data), [usersQuery.data]);
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

  /* ── Mutations avec Optimistic Update ─────────────────────────────── */
  /* ═══════════════════════════════════════════════════════════════════════
     MODIFIÉ : renewMutation avec logique APK complète + prompt montant
     - Signature : { member, subscriptionId, planName, amount, renewalPrice }
     - Les dates se mettent à jour QUOI QU'IL ARRIVE (partiel ou complet)
     - Paiement partiel : incrémente totalPaid, met à jour les dates
     - Paiement complet : reset totalPaid à 0, met à jour les dates
     ═══════════════════════════════════════════════════════════════════════ */
  const renewMutation = useMutation({
    mutationFn: async ({
      member,
      subscriptionId,
      planName,
      amount,
      renewalPrice,
    }: {
      member: User;
      subscriptionId: number;
      planName: string;
      amount: number;
      renewalPrice: number;
    }) => {
      const today = new Date().toISOString().split("T")[0];
      const now = new Date();

      // CORRECTION : Chercher le plan par planName en priorité
      let selectedPlan = plans.find((plan) => plan.name === planName);
      if (!selectedPlan) {
        // Fallback : chercher par type normalisé (legacy)
        const currentType = normalizeSubscriptionType(member.subscription);
        const start = member.startDate ? new Date(member.startDate) : (member.joinDate ? new Date(member.joinDate) : null);
        const end = member.expiryDate ? new Date(member.expiryDate) : null;
        let currentDuration = 1;
        if (start && end) {
          const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          currentDuration = Math.max(1, Math.round(diffMonths));
        }
        selectedPlan = plans.find((plan) => normalizeSubscriptionType(plan.type) === currentType && Number(plan.duration) === currentDuration);
        if (!selectedPlan) {
          selectedPlan = plans.find((plan) => normalizeSubscriptionType(plan.type) === currentType);
        }
      }

      // CORRECTION : Récupérer l'offre actuelle pour ses dates propres
      const sub = member.userSubscriptions?.find((s) => s.id === subscriptionId);
      const subStartDate = sub?.startDate || member.startDate;
      const subExpiryDate = sub?.expiryDate || member.expiryDate;

      // LOGIQUE APK : Calcul de la nouvelle date de début basée sur l'OFFRE
      const newStartDateStr = calculateRenewalStartDate(
        subStartDate,
        subExpiryDate,
        now
      );
      const baseDate = new Date(newStartDateStr);
      const expiry = new Date(baseDate);
      expiry.setMonth(expiry.getMonth() + Number(selectedPlan?.duration ?? 1));

      // Met à jour les dates QUOI QU'IL ARRIVE (partiel ou complet)
      await api.users.update(member.id!, {
        status: "active",
        startDate: baseDate.toISOString().split("T")[0],
        expiryDate: expiry.toISOString().split("T")[0],
      });

      // Créer l'enregistrement de paiement
      if (amount > 0) {
        await api.paymentRecords.create({
          user: `/api/users/${member.id}`,
          amount,
          date: today,
          method: "Espèces",
          receiptNo: `REN-${Date.now()}`,
          subscription: planName,
          userSubscription: `/api/user_subscriptions/${subscriptionId}`,
        });

        await api.payments.create({
          memberId: member.memberId,
          memberName: getFullName(member),
          amount,
          date: today,
          method: "cash",
          receiptNo: `REN-${Date.now()}`,
          subscription: planName,
          cashRegister: currentCashRegister,
          userSubscription: `/api/user_subscriptions/${subscriptionId}`,
        });
      }

      // Récupérer l'offre actuelle pour connaître son totalPaid
      const currentTotalPaid = sub?.totalPaid || 0;

      if (amount >= renewalPrice) {
        // PAIEMENT COMPLET : reset totalPaid à 0 pour la nouvelle période
        await api.userSubscriptions.update(subscriptionId, {
          totalPaid: 0,
          startDate: baseDate.toISOString().split("T")[0],
          expiryDate: expiry.toISOString().split("T")[0],
        });
      } else {
        // PAIEMENT PARTIEL : incrémente totalPaid
        // Mais les dates sont DÉJÀ mises à jour ci-dessus
        await api.userSubscriptions.update(subscriptionId, {
          totalPaid: currentTotalPaid + amount,
          startDate: baseDate.toISOString().split("T")[0],
          expiryDate: expiry.toISOString().split("T")[0],
        });
      }

      return { amount, renewalPrice, isComplete: amount >= renewalPrice };
    },
    onMutate: async ({ member, subscriptionId, amount, renewalPrice }) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousUsers = queryClient.getQueryData(["users"]);

      queryClient.setQueryData(["users"], (old: any) => {
        if (!old) return old;
        const members = extractHydraMembers<User>(old);
        const updatedMembers = members.map((m: User) => {
          if (m.id !== member.id) return m;
          const updatedSubs = m.userSubscriptions?.map((sub) => {
            if (sub.id !== subscriptionId) return sub;
            const isComplete = amount >= renewalPrice;
            return {
              ...sub,
              totalPaid: isComplete ? 0 : (sub.totalPaid || 0) + amount,
              startDate: new Date().toISOString().split("T")[0],
              expiryDate: new Date().toISOString().split("T")[0],
            };
          });
          return { ...m, userSubscriptions: updatedSubs };
        });
        return { ...old, "hydra:member": updatedMembers };
      });

      return { previousUsers };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousUsers) {
        queryClient.setQueryData(["users"], context.previousUsers);
      }
      toast.error("Erreur lors du renouvellement");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      refreshNotifications();
    },
    onSuccess: () => {
      toast.success("Renouvellement effectué");
    },
  });

  const validerMutation = useMutation({
    mutationFn: (id: number) => {
      const today = new Date().toISOString().split("T")[0];
      return api.users.update(id, { status: "active", startDate: today });
    },
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ["users"] });
      const previousData = queryClient.getQueryData<any>(["users"]);
      if (previousData) {
        queryClient.setQueryData(["users"], {
          ...previousData,
          "hydra:member": previousData["hydra:member"]?.map((m: any) =>
            m.id === id ? { ...m, status: "active", startDate: new Date().toISOString().split("T")[0] } : m
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
    mutationFn: async ({ id, amount, userIri, subscription }: { id: number, amount: number, userIri: string, subscription: string }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = users.find(m => m.id === id);
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
      const currentType = normalizeSubscriptionType(currentUser?.subscription);
      
      const start = currentUser?.startDate ? new Date(currentUser.startDate) : (currentUser?.joinDate ? new Date(currentUser.joinDate) : null);
      const end = currentUser?.expiryDate ? new Date(currentUser.expiryDate) : null;
      let currentDuration = 1;
      if (start && end) {
        const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
        currentDuration = Math.max(1, Math.round(diffMonths));
      }

      let selectedPlan = plans.find(p => normalizeSubscriptionType(p.type) === currentType && Number(p.duration) === currentDuration);
      if (!selectedPlan) {
        selectedPlan = plans.find(p => normalizeSubscriptionType(p.type) === currentType);
      }

      const expiry = new Date(actualStartDate);
      expiry.setMonth(expiry.getMonth() + Number(selectedPlan?.duration ?? 1));
      const expiryDate = expiry.toISOString().split("T")[0];

      const newTotal = (currentUser?.totalPayments || 0) + amount;
      return api.users.update(id, {
        totalPayments: newTotal,
        status: "active",
        startDate: actualStartDate,
        expiryDate,
      });
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
      toast.error("Erreur lors du paiement");
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré");
      setSelectedMember(null);
    },
  });

  const enregistrerPaiementMutation = useMutation({
    mutationFn: async ({ id, amount }: { id: number, amount: number }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = users.find(m => m.id === id);
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
    mutationFn: async ({ subscriptionId, validatedBy, memberId }: { subscriptionId: number; validatedBy: string; memberId: number }) => {
      const today = new Date().toISOString().split("T")[0];
      
      // CORRECTION : Chercher le plan par planName pour calculer la durée
      const sub = users.find(u => u.id === memberId)?.userSubscriptions?.find(s => s.id === subscriptionId);
      const planName = sub?.planName;
      const selectedPlan = plans.find((plan) => plan.name === planName);
      const expiryDate = calculateExpiryDate(today, selectedPlan);

      await api.userSubscriptions.update(subscriptionId, {
        status: "active",
        startDate: today,
        expiryDate: expiryDate,
        validatedBy,
        validatedAt: new Date().toISOString(),
      });
      if (memberId) {
        await api.users.update(memberId, { status: "active", startDate: today, expiryDate });
      }
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
      
      // CORRECTION : Chercher le plan par planName pour calculer la durée
      const selectedPlan = plans.find((plan) => plan.name === planName);
      const expiryDate = calculateExpiryDate(today, selectedPlan);

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

      await api.userSubscriptions.update(subscriptionId, {
        status: "active",
        startDate: today,
        expiryDate: expiryDate,
        totalPaid: amount,
        validatedBy,
        validatedAt: new Date().toISOString(),
      });

      if (selectedMember?.id) {
        await api.users.update(selectedMember.id, { status: "active", startDate: today, expiryDate });
      }
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
      
      // CORRECTION : Chercher le plan pour calculer le prix et savoir si c'est complet
      const selectedPlan = plans.find((plan) => plan.name === planName);
      const planPrice = selectedPlan ? getAmountWithPromo(selectedMember!, Number(selectedPlan.price)) : 0;
      const isComplete = newTotalPaid >= planPrice;

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

      if (isComplete) {
        // Paiement complet : reset totalPaid à 0 et recalculer les dates
        const sub = selectedMember?.userSubscriptions?.find((s) => s.id === subscriptionId);
        const newStartDateStr = calculateRenewalStartDate(
          sub?.startDate || selectedMember?.startDate,
          sub?.expiryDate || selectedMember?.expiryDate,
          new Date()
        );
        const newExpiryDate = calculateExpiryDate(newStartDateStr, selectedPlan);

        await api.userSubscriptions.update(subscriptionId, {
          totalPaid: 0,
          startDate: newStartDateStr,
          expiryDate: newExpiryDate,
        });

        if (selectedMember?.id) {
          await api.users.update(selectedMember.id, { startDate: newStartDateStr, expiryDate: newExpiryDate });
        }
      } else {
        // Paiement partiel : incrémente totalPaid
        await api.userSubscriptions.update(subscriptionId, {
          totalPaid: newTotalPaid,
        });
      }

      return { isComplete };
    },
    onSuccess: () => {
      toast.success("Paiement enregistré avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de l'enregistrement du paiement"),
  });

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
     MODIFIÉ : Stats basées sur le statut effectif
     ═══════════════════════════════════════════════════════════════════════ */
  const stats = useMemo(() => {
    return {
      active: users.filter((user) => getMemberEffectiveStatus(user) === "active").length,
      expired: users.filter((user) => getMemberEffectiveStatus(user) === "expired").length,
      suspended: users.filter((user) => getMemberEffectiveStatus(user) === "suspended").length,
    };
  }, [users]);

  /* ── Helper pour membre actif non payé ────────────────────────────── */
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

  /* ── Synchronise selectedMember avec les données fraîches du cache ─── */
  const selectedMemberRef = useRef(selectedMember);
  useEffect(() => {
    selectedMemberRef.current = selectedMember;
  });

  useEffect(() => {
    if (selectedMemberRef.current && users.length > 0) {
      const fresh = users.find((m) => m.id === selectedMemberRef.current!.id);
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
  }, [users]);

  /* ── Handlers stables ─────────────────────────────────────────────── */
  const handleSelectMember = useCallback((member: User) => {
    setSelectedMember(member);
    setIsModalOpen(true);
  }, []);

  const findPlanForMember = useCallback((m: User) => {
    if (!m.subscription) return null;
    const normalizedSub = normalizeSubscriptionType(m.subscription);

    const start = m.startDate ? new Date(m.startDate) : (m.joinDate ? new Date(m.joinDate) : null);
    const end = m.expiryDate ? new Date(m.expiryDate) : null;
    let currentDuration = 1;
    if (start && end) {
      const diffMonths = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
      currentDuration = Math.max(1, Math.round(diffMonths));
    }

    let p = plans.find(plan => normalizeSubscriptionType(plan.type) === normalizedSub && Number(plan.duration) === currentDuration);
    if (p) return p;

    p = plans.find(plan => normalizeSubscriptionType(plan.type) === normalizedSub);
    if (p) return p;

    p = plans.find(plan => plan.name.toLowerCase().includes(normalizedSub) || normalizedSub.includes(plan.name.toLowerCase()));
    if (p) return p;

    return plans.find(plan => normalizeSubscriptionType(plan.type) === "monthly") || plans[0] || null;
  }, [plans]);

  return (
    <div className="space-y-5">
      <div className="page-header mb-0">
        <h1 className="page-title">Gestion des Abonnements</h1>
        <p className="page-subtitle">Renouvellement et suivi en direct</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Actifs" value={String(stats.active)} />
        <MetricCard label="Expires" value={String(stats.expired)} />
        <MetricCard label="Suspendus" value={String(stats.suspended)} />
      </div>

      <div 
        className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5"
        style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}
      >
        <div 
          className="bg-card rounded-xl border overflow-hidden flex flex-col"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "hsl(var(--muted) / 0.95)", backdropFilter: "blur(4px)" }}>
                  <th>Membre</th>
                  <th>Formule</th>
                  <th>Offres</th>
                  <th>Statut</th>
                  <th>Expiration</th>
                  <th>Paiements</th>
                </tr>
              </thead>
              <tbody>
                {users.map((member) => (
                  <SubscriptionTableRow
                    key={member.id}
                    member={member}
                    isSelected={selectedMember?.id === member.id}
                    onSelect={handleSelectMember}
                  />
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-10 text-muted-foreground italic">
                      Aucun membre enregistré.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div 
          className="bg-card rounded-xl border p-5 overflow-y-auto"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <h2 className="font-bold text-foreground mb-4">Renouveler</h2>
          {!selectedMember ? (
            <p className="text-sm text-muted-foreground">Selectionnez un membre dans la liste.</p>
          ) : (
            <SubscriptionDetailPanel
              member={selectedMember}
              plans={plans}
              promoCodes={promoCodes}
              getAmountWithPromo={getAmountWithPromo}
              findPlanForMember={findPlanForMember}
              isActiveButUnpaid={isActiveButUnpaid}
              renewMutation={renewMutation}
              validerMutation={validerMutation}
              payerMutation={payerMutation}
              refuserMutation={refuserMutation}
              enregistrerPaiementMutation={enregistrerPaiementMutation}
              validateSubscriptionMutation={validateSubscriptionMutation}
              paySubscriptionMutation={paySubscriptionMutation}
              payActiveSubscriptionMutation={payActiveSubscriptionMutation}
              refuseSubscriptionMutation={refuseSubscriptionMutation}
              getPendingSubscriptions={getPendingSubscriptions}
              getActiveSubscriptions={getActiveSubscriptions}
              getPlanPrice={getPlanPrice}
              isAdmin={isAdmin}
              setPromptConfig={setPromptConfig}
            />
          )}
        </div>
      </div>

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        member={selectedMember}
        plans={plans}
        promoCodes={promoCodes}
        renewMutation={renewMutation}
        validerMutation={validerMutation}
        payerMutation={payerMutation}
        refuserMutation={refuserMutation}
        enregistrerPaiementMutation={enregistrerPaiementMutation}
        validateSubscriptionMutation={validateSubscriptionMutation}
        paySubscriptionMutation={paySubscriptionMutation}
        payActiveSubscriptionMutation={payActiveSubscriptionMutation}
        refuseSubscriptionMutation={refuseSubscriptionMutation}
        getPendingSubscriptions={getPendingSubscriptions}
        getActiveSubscriptions={getActiveSubscriptions}
        getPlanPrice={getPlanPrice}
        isAdmin={isAdmin}
        setPromptConfig={setPromptConfig}
      />

      <PromptModal
        isOpen={promptConfig.isOpen}
        onClose={() => setPromptConfig(prev => ({ ...prev, isOpen: false }))}
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

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-black text-foreground mt-1">{value}</p>
    </div>
  );
}

/* ─── Composant panneau de détail (mémorisé) ──────────────────────────── */
interface SubscriptionDetailPanelProps {
  member: User;
  plans: SubscriptionPlan[];
  promoCodes: PromoCode[];
  getAmountWithPromo: (member: User, originalPrice: number) => number;
  findPlanForMember: (m: User) => SubscriptionPlan | null;
  isActiveButUnpaid: (member: User | null) => boolean;
  renewMutation: any;
  validerMutation: any;
  payerMutation: any;
  refuserMutation: any;
  enregistrerPaiementMutation: any;
  validateSubscriptionMutation: any;
  paySubscriptionMutation: any;
  payActiveSubscriptionMutation: any;
  refuseSubscriptionMutation: any;
  getPendingSubscriptions: (member: User | null) => UserSubscription[];
  getActiveSubscriptions: (member: User | null) => UserSubscription[];
  getPlanPrice: (planName: string) => number;
  isAdmin: boolean;
  setPromptConfig: any;
}

const SubscriptionDetailPanel = memo(function SubscriptionDetailPanel({
  member,
  plans,
  getAmountWithPromo,
  findPlanForMember,
  isActiveButUnpaid,
  renewMutation,
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
  setPromptConfig,
}: SubscriptionDetailPanelProps) {
  const normalizedStatus = getMemberEffectiveStatus(member);
  const isPendingLike = normalizedStatus === "pending" || (normalizedStatus === "suspended" && !member.startDate);
  const pendingSubs = getPendingSubscriptions(member);
  const activeSubs = getActiveSubscriptions(member);
  
  /* Variables nécessaires pour les boutons legacy */
  const matchedPlan = findPlanForMember(member);
  const discountedPrice = matchedPlan ? getAmountWithPromo(member, matchedPlan.price) : 0;

  return (
    <div className="space-y-3">
      <p className="font-semibold text-foreground">{getFullName(member)}</p>

      {/* Bandeau d'alerte si actif avec offres en attente */}
      {hasPendingWhileActive(member) && (
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
            const finalPrice = sub.promotion ? getAmountWithPromo({ ...member, promotion: sub.promotion }, planPrice) : planPrice;
            
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
                          if (sub.id && member.id) {
                            validateSubscriptionMutation.mutate({
                              subscriptionId: sub.id,
                              validatedBy: isAdmin ? "admin" : "reception",
                              memberId: member.id,
                            });
                          }
                          setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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
                        message: "Entrez le montant reçu en espèces :",
                        defaultValue: String(finalPrice),
                        inputType: "number",
                        confirmText: "Enregistrer le paiement",
                        confirmColor: "bg-green-600",
                        promoCode: sub.promotion,
                        onConfirm: (amountValue: any) => {
                          let amount = Number(amountValue);
                          if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                          if (amount > 0) {
                            if (sub.id && member.id) {
                              paySubscriptionMutation.mutate({
                                subscriptionId: sub.id,
                                amount,
                                userIri: `/api/users/${member.id}`,
                                planName: sub.planName,
                                validatedBy: isAdmin ? "admin" : "reception",
                              });
                            }
                            setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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
                          setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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

      {/* ── Offres actives avec paiement partiel et renouvellement ── */}
      {activeSubs.length > 0 && (
        <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
          <p className="text-sm font-bold text-foreground">Offres actives ({activeSubs.length})</p>
          {activeSubs.map((sub) => {
            const planPrice = getPlanPrice(sub.planName);
            const finalPrice = sub.promotion ? getAmountWithPromo({ ...member, promotion: sub.promotion }, planPrice) : planPrice;
            const totalPaid = sub.totalPaid || 0;
            const remaining = Math.max(0, finalPrice - totalPaid);
            const isFullyPaid = totalPaid >= finalPrice;
            
            // ═══════════════════════════════════════════════════════════════════════
            // CORRECTION : Ajouter isExpired pour chaque offre
            // ═══════════════════════════════════════════════════════════════════════
            const now = new Date();
            const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
            const isExpired = expiryDate ? expiryDate < now : false;

            // ═══════════════════════════════════════════════════════════════════════
            // NOUVELLE LOGIQUE : Si expiré, on force l'affichage "Paiement à compléter"
            // et on bloque le renouvellement jusqu'à paiement complet
            // ═══════════════════════════════════════════════════════════════════════
            const showRenewButton = isFullyPaid && !isExpired;
            const showCompletePayment = !isFullyPaid || isExpired;

            return (
              <div key={sub.id} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground">{sub.planName}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-500">
                    ACTIF
                  </span>
                </div>
                {/* CORRECTION : Afficher les dates de l'OFFRE, pas du membre */}
                <p className="text-xs text-muted-foreground">
                  Du {formatDate(sub.startDate)} au {formatDate(sub.expiryDate)}
                </p>

                {showCompletePayment ? (
                  <>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Prix total :</span>
                        <span className="font-medium text-foreground">{formatCurrency(finalPrice)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Payé :</span>
                        <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Reste :</span>
                        <span className="font-bold text-orange-500">{formatCurrency(remaining)}</span>
                      </div>
                      {isExpired && (
                        <div className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle size={12} />
                          <span>Expiré le {formatDate(sub.expiryDate)}</span>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        setPromptConfig({
                          isOpen: true,
                          type: "prompt",
                          title: `Enregistrer un paiement — ${sub.planName}`,
                          message: `Montant restant : ${formatCurrency(remaining)}\nEntrez le montant reçu en espèces :`,
                          defaultValue: String(remaining),
                          inputType: "number",
                          confirmText: "Enregistrer le paiement",
                          confirmColor: "bg-green-600",
                          promoCode: sub.promotion,
                          onConfirm: (amountValue: any) => {
                            let amount = Number(amountValue);
                            if (isNaN(amount) || amount <= 0) {
                              toast.error("Montant invalide");
                              return;
                            }
                            if (amount > remaining) amount = remaining;
                            if (sub.id && member.id) {
                              payActiveSubscriptionMutation.mutate({
                                subscriptionId: sub.id,
                                amount,
                                userIri: `/api/users/${member.id}`,
                                planName: sub.planName,
                                currentTotalPaid: totalPaid,
                              });
                            }
                            setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                          },
                        });
                      }}
                      className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                    >
                      <CreditCard size={16} />
                      {isExpired ? "Paiement à compléter" : "Enregistrer un paiement"}
                    </button>
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full w-fit">
                      ✓ Paiement complet — {formatCurrency(totalPaid)}
                    </p>
                    {showRenewButton && (
                      <button
                        onClick={() => {
                          const renewalPrice = finalPrice;
                          setPromptConfig({
                            isOpen: true,
                            type: "prompt",
                            title: `Renouveler ${sub.planName}`,
                            message: `Prix du renouvellement : ${formatCurrency(renewalPrice)}\nSaisissez le montant reçu (0 pour gratuit) :`,
                            defaultValue: String(renewalPrice),
                            inputType: "number",
                            confirmText: "Renouveler",
                            confirmColor: "bg-primary",
                            promoCode: sub.promotion,
                            onConfirm: (amountValue: any) => {
                              let amount = Number(amountValue);
                              if (isNaN(amount) || amount < 0) {
                                toast.error("Montant invalide");
                                return;
                              }
                              if (amount > renewalPrice) amount = renewalPrice;
                              renewMutation.mutate({
                                member,
                                subscriptionId: sub.id,
                                planName: sub.planName,
                                amount,
                                renewalPrice,
                              });
                              setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        disabled={renewMutation.isPending}
                        className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                        style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
                      >
                        {renewMutation.isPending ? "Traitement..." : `Renouveler ${sub.planName}`}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Boutons legacy masqués si userSubscriptions existent */}
      {member.userSubscriptions?.length === 0 && isPendingLike && (
        <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
          <p className="text-sm font-bold text-foreground">Actions sur la demande</p>
          <div className="flex flex-col gap-2">
            <button
              onClick={() => {
                setPromptConfig({
                  isOpen: true,
                  type: "confirm",
                  title: "Commencer l'abonnement",
                  message: "Commencer l'abonnement sans enregistrer de paiement ?",
                  confirmText: "Oui, commencer",
                  onConfirm: () => {
                    if (member.id) validerMutation.mutate(member.id);
                    setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                  },
                });
              }}
              className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
            >
              Commencer l'abonnement
            </button>
            <button
              onClick={() => {
                setPromptConfig({
                  isOpen: true,
                  type: "prompt",
                  title: "Enregistrer un paiement",
                  message: "Entrez le montant reçu en espèces :",
                  defaultValue: String(discountedPrice),
                  inputType: "number",
                  confirmText: "Enregistrer le paiement",
                  confirmColor: "bg-green-600",
                  promoCode: member.promotion,
                  onConfirm: (amountValue: any) => {
                    let amount = Number(amountValue);
                    if ((isNaN(amount) || amount <= 0) && discountedPrice > 0) amount = discountedPrice;
                    if (amount > 0) {
                      if (member.id) {
                        payerMutation.mutate({
                          id: member.id,
                          amount,
                          userIri: `/api/users/${member.id}`,
                          subscription: member.subscription || "",
                        });
                      }
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                    } else {
                      toast.error("Montant invalide");
                    }
                  },
                });
              }}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
            >
              Payer l'abonnement
            </button>
            <button
              onClick={() => {
                setPromptConfig({
                  isOpen: true,
                  type: "confirm",
                  title: "Refuser la demande",
                  message: "Refuser cette demande et réinitialiser l'abonnement ?",
                  confirmText: "Oui, refuser",
                  confirmColor: "bg-destructive",
                  onConfirm: () => {
                    if (member.id) refuserMutation.mutate(member.id);
                    setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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
      {isActiveButUnpaid(member) && member.userSubscriptions?.length === 0 && (
        <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
          <p className="text-sm font-bold text-foreground">Paiement en attente</p>
          <p className="text-xs text-muted-foreground">
            Ce membre a commencé son abonnement mais n'a pas encore réglé.
          </p>
          <button
            onClick={() => {
              setPromptConfig({
                isOpen: true,
                type: "prompt",
                title: "Enregistrer le paiement",
                message: "Entrez le montant reçu en espèces :",
                defaultValue: String(discountedPrice),
                inputType: "number",
                confirmText: "Enregistrer le paiement",
                confirmColor: "bg-green-600",
                promoCode: member.promotion,
                onConfirm: (amountValue: any) => {
                  let amount = Number(amountValue);
                  if ((isNaN(amount) || amount <= 0) && discountedPrice > 0) amount = discountedPrice;
                  if (amount > 0) {
                    if (member.id) {
                      enregistrerPaiementMutation.mutate({ id: member.id, amount });
                    }
                    setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                  } else {
                    toast.error("Montant invalide");
                  }
                },
              });
            }}
            className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
          >
            Enregistrer le paiement
          </button>
        </div>
      )}

      {/* ── Info : membre actif déjà payé ── */}
      {member.userSubscriptions?.length === 0 && !isPendingLike && !isActiveButUnpaid(member) && (
        <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
            <p className="text-sm font-semibold text-green-600">✓ Abonnement actif — Paiement enregistré</p>
            <p className="text-xs text-muted-foreground mt-1">
              Total payé: {formatCurrency(member.totalPayments || 0)}
            </p>
          </div>
          <button
            onClick={() => {
              const matchedPlan = findPlanForMember(member);
              const renewalPrice = matchedPlan ? getAmountWithPromo(member, matchedPlan.price) : 0;
              setPromptConfig({
                isOpen: true,
                type: "prompt",
                title: "Renouveler l'abonnement",
                message: `Prix du renouvellement : ${formatCurrency(renewalPrice)}\nSaisissez le montant reçu (0 pour gratuit) :`,
                defaultValue: String(renewalPrice),
                inputType: "number",
                confirmText: "Renouveler",
                confirmColor: "bg-primary",
                promoCode: member.promotion,
                onConfirm: (amountValue: any) => {
                  let amount = Number(amountValue);
                  if (isNaN(amount) || amount < 0) {
                    toast.error("Montant invalide");
                    return;
                  }
                  if (amount > renewalPrice) amount = renewalPrice;
                  renewMutation.mutate({
                    member,
                    subscriptionId: 0,
                    planName: member.subscription || "",
                    amount,
                    renewalPrice,
                  });
                  setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                },
              });
            }}
            disabled={renewMutation.isPending}
            className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
          >
            {renewMutation.isPending ? "Renouvellement..." : "Confirmer le renouvellement"}
          </button>
        </div>
      )}
    </div>
  );
});

/* ─── COMPOSANT MODAL DE VALIDATION ───────────────────────────────────── */
interface ValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: User | null;
  plans: SubscriptionPlan[];
  promoCodes: PromoCode[];
  renewMutation: any;
  validerMutation: any;
  payerMutation: any;
  refuserMutation: any;
  enregistrerPaiementMutation: any;
  validateSubscriptionMutation: any;
  paySubscriptionMutation: any;
  payActiveSubscriptionMutation: any;
  refuseSubscriptionMutation: any;
  getPendingSubscriptions: (member: User | null) => UserSubscription[];
  getActiveSubscriptions: (member: User | null) => UserSubscription[];
  getPlanPrice: (planName: string) => number;
  isAdmin: boolean;
  setPromptConfig: any;
}

function ValidationModal({
  isOpen,
  onClose,
  member,
  plans,
  promoCodes,
  renewMutation,
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
  setPromptConfig,
}: ValidationModalProps) {
  if (!isOpen || !member) return null;

  const normalizedStatus = getMemberEffectiveStatus(member);
  const isPendingLike = normalizedStatus === "pending" || (normalizedStatus === "suspended" && !member.startDate);
  const pendingSubs = getPendingSubscriptions(member);
  const activeSubs = getActiveSubscriptions(member);

  const getAmountWithPromo = (m: User, originalPrice: number) => {
    if (!m.promotion) return originalPrice;
    const promo = promoCodes.find(p => p.code.toUpperCase() === m.promotion?.toUpperCase());
    if (!promo) return originalPrice;
    let discounted = originalPrice;
    if (promo.discountPercentage) {
      discounted -= originalPrice * (promo.discountPercentage / 100);
    } else if (promo.discountAmount) {
      discounted -= promo.discountAmount;
    }
    return Math.max(0, discounted);
  };

  const findPlanForMember = (m: User) => {
    if (!m.subscription) return null;
    const normalizedSub = normalizeSubscriptionType(m.subscription);
    let p = plans.find(plan => normalizeSubscriptionType(plan.type) === normalizedSub);
    if (p) return p;
    p = plans.find(plan => plan.name.toLowerCase().includes(normalizedSub) || normalizedSub.includes(plan.name.toLowerCase()));
    if (p) return p;
    if (normalizedSub === "monthly" || normalizedSub === "standard") {
      return plans.find(plan => normalizeSubscriptionType(plan.type) === "monthly") || plans[0];
    }
    return null;
  };

  const plan = findPlanForMember(member);
  const finalPrice = plan ? getAmountWithPromo(member, plan.price) : 0;
  const hasPromo = plan && finalPrice < plan.price;
  const subscriptionLabel = normalizeSubscriptionType(member.subscription);

  const isActiveButUnpaid = (m: User): boolean => {
    const status = getMemberEffectiveStatus(m);
    return status === "active" && (m.totalPayments == null || m.totalPayments === 0);
  };

  const getAllFormulesDisplay = (): string => {
    const userSubs = member.userSubscriptions ?? [];
    if (userSubs.length > 0) {
      return userSubs.map((sub) => sub.planName).join(", ");
    }
    return SUBSCRIPTION_LABELS[subscriptionLabel as SubscriptionType] || subscriptionLabel || "—";
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-card w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200 overflow-y-auto"
        style={{ 
          borderColor: "hsl(var(--border))",
          maxHeight: "85vh",
        }}
      >
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-foreground">{getFullName(member)}</h2>
            <p className="text-sm text-muted-foreground">{member.memberId}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded-full transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
          </button>
        </div>

        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Formule choisie</p>
            <p className="font-bold text-foreground">{getAllFormulesDisplay()}</p>
            {plan && (
              <div className="mt-1">
                <p className={`text-lg font-black ${hasPromo ? 'text-muted-foreground text-sm line-through' : 'text-primary'}`}>
                  {formatCurrency(plan.price)}
                </p>
                {hasPromo && (
                  <div className="flex items-center gap-3">
                    <p className="text-xl font-black text-primary">{formatCurrency(finalPrice)}</p>
                    <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                      CODE: {member.promotion}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase">Statut actuel</p>
              <span className={`inline-block mt-1 ${normalizedStatus === "active" ? "badge-active" : normalizedStatus === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : normalizedStatus === "expired" ? "badge-expired" : "badge-suspended"}`}>
                {STATUS_LABELS[normalizedStatus]}
              </span>
            </div>
          </div>
        </div>

                {/* Bandeau d'alerte dans le modal si actif avec offres en attente */}
        {hasPendingWhileActive(member) && (
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
              const finalPrice = sub.promotion ? getAmountWithPromo({ ...member, promotion: sub.promotion }, planPrice) : planPrice;

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
                            if (sub.id && member.id) {
                              validateSubscriptionMutation.mutate({
                                subscriptionId: sub.id,
                                validatedBy: isAdmin ? "admin" : "reception",
                                memberId: member.id,
                              });
                            }
                            setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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
                          message: "Entrez le montant reçu en espèces :",
                          defaultValue: String(finalPrice),
                          inputType: "number",
                          confirmText: "Enregistrer le paiement",
                          confirmColor: "bg-green-600",
                          promoCode: sub.promotion,
                          onConfirm: (amountValue: any) => {
                            let amount = Number(amountValue);
                            if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                            if (amount > 0) {
                              if (sub.id && member.id) {
                                paySubscriptionMutation.mutate({
                                  subscriptionId: sub.id,
                                  amount,
                                  userIri: `/api/users/${member.id}`,
                                  planName: sub.planName,
                                  validatedBy: isAdmin ? "admin" : "reception",
                                });
                              }
                              setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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
                            setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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

        {/* ── Offres actives ── */}
        {activeSubs.length > 0 && (
          <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm font-bold text-foreground">Offres actives ({activeSubs.length})</p>
            {activeSubs.map((sub) => {
              const planPrice = getPlanPrice(sub.planName);
              const finalPrice = sub.promotion ? getAmountWithPromo({ ...member, promotion: sub.promotion }, planPrice) : planPrice;
              const totalPaid = sub.totalPaid || 0;
              const remaining = Math.max(0, finalPrice - totalPaid);
              const isFullyPaid = totalPaid >= finalPrice;

              // ═══════════════════════════════════════════════════════════════════════
              // CORRECTION : Ajouter isExpired pour chaque offre (même code que Panel)
              // ═══════════════════════════════════════════════════════════════════════
              const now = new Date();
              const expiryDate = sub.expiryDate ? new Date(sub.expiryDate) : null;
              const isExpired = expiryDate ? expiryDate < now : false;

              // ═══════════════════════════════════════════════════════════════════════
              // NOUVELLE LOGIQUE : Si expiré, on force l'affichage "Paiement à compléter"
              // et on bloque le renouvellement jusqu'à paiement complet
              // ═══════════════════════════════════════════════════════════════════════
              const showRenewButton = isFullyPaid && !isExpired;
              const showCompletePayment = !isFullyPaid || isExpired;

              return (
                <div key={sub.id} className="p-3 rounded-lg bg-green-500/5 border border-green-500/20 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">{sub.planName}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/20 text-green-500">
                      ACTIF
                    </span>
                  </div>
                  {/* ═══════════════════════════════════════════════════════════════════════
                      CORRECTION : Afficher les dates de l'OFFRE, pas du membre
                      ═══════════════════════════════════════════════════════════════════════ */}
                  <p className="text-xs text-muted-foreground">
                    Du {formatDate(sub.startDate)} au {formatDate(sub.expiryDate)}
                  </p>

                  {showCompletePayment ? (
                    <>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Prix total :</span>
                          <span className="font-medium text-foreground">{formatCurrency(finalPrice)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Payé :</span>
                          <span className="font-medium text-green-600">{formatCurrency(totalPaid)}</span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">Reste :</span>
                          <span className="font-bold text-orange-500">{formatCurrency(remaining)}</span>
                        </div>
                        {isExpired && (
                          <div className="flex items-center gap-1 text-xs text-red-500">
                            <AlertCircle size={12} />
                            <span>Expiré le {formatDate(sub.expiryDate)}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "prompt",
                            title: `Enregistrer un paiement — ${sub.planName}`,
                            message: `Montant restant : ${formatCurrency(remaining)}\nEntrez le montant reçu en espèces :`,
                            defaultValue: String(remaining),
                            inputType: "number",
                            confirmText: "Enregistrer le paiement",
                            confirmColor: "bg-green-600",
                            promoCode: sub.promotion,
                            onConfirm: (amountValue: any) => {
                              let amount = Number(amountValue);
                              if (isNaN(amount) || amount <= 0) {
                                toast.error("Montant invalide");
                                return;
                              }
                              if (amount > remaining) amount = remaining;
                              if (sub.id && member.id) {
                                payActiveSubscriptionMutation.mutate({
                                  subscriptionId: sub.id,
                                  amount,
                                  userIri: `/api/users/${member.id}`,
                                  planName: sub.planName,
                                  currentTotalPaid: totalPaid,
                                });
                              }
                              setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                            },
                          });
                        }}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                      >
                        <CreditCard size={16} />
                        {isExpired ? "Paiement à compléter" : "Enregistrer un paiement"}
                      </button>
                    </>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full w-fit">
                        ✓ Paiement complet — {formatCurrency(totalPaid)}
                      </p>
                      {showRenewButton && (
                        <button
                          onClick={() => {
                            const renewalPrice = finalPrice;
                            setPromptConfig({
                              isOpen: true,
                              type: "prompt",
                              title: `Renouveler ${sub.planName}`,
                              message: `Prix du renouvellement : ${formatCurrency(renewalPrice)}\nSaisissez le montant reçu (0 pour gratuit) :`,
                              defaultValue: String(renewalPrice),
                              inputType: "number",
                              confirmText: "Renouveler",
                              confirmColor: "bg-primary",
                              promoCode: sub.promotion,
                              onConfirm: (amountValue: any) => {
                                let amount = Number(amountValue);
                                if (isNaN(amount) || amount < 0) {
                                  toast.error("Montant invalide");
                                  return;
                                }
                                if (amount > renewalPrice) amount = renewalPrice;
                                renewMutation.mutate({
                                  member,
                                  subscriptionId: sub.id,
                                  planName: sub.planName,
                                  amount,
                                  renewalPrice,
                                });
                                setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                              },
                            });
                          }}
                          disabled={renewMutation.isPending}
                          className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
                        >
                          {renewMutation.isPending ? "Traitement..." : `Renouveler ${sub.planName}`}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Legacy : boutons pour membres sans userSubscriptions ── */}
        {member.userSubscriptions?.length === 0 && isPendingLike && (
          <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm font-bold text-foreground">Actions sur la demande</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "confirm",
                    title: "Commencer l'abonnement",
                    message: "Commencer l'abonnement sans enregistrer de paiement ?",
                    confirmText: "Oui, commencer",
                    onConfirm: () => {
                      if (member.id) validerMutation.mutate(member.id);
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                    },
                  });
                }}
                className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
              >
                Commencer l'abonnement
              </button>
              <button
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "prompt",
                    title: "Enregistrer un paiement",
                    message: "Entrez le montant reçu en espèces :",
                    defaultValue: String(finalPrice),
                    inputType: "number",
                    confirmText: "Enregistrer le paiement",
                    confirmColor: "bg-green-600",
                    promoCode: member.promotion,
                    onConfirm: (amountValue: any) => {
                      let amount = Number(amountValue);
                      if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                      if (amount > 0) {
                        if (member.id) {
                          payerMutation.mutate({
                            id: member.id,
                            amount,
                            userIri: `/api/users/${member.id}`,
                            subscription: member.subscription || "",
                          });
                        }
                        setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                      } else {
                        toast.error("Montant invalide");
                      }
                    },
                  });
                }}
                className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
              >
                Payer l'abonnement
              </button>
              <button
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "confirm",
                    title: "Refuser la demande",
                    message: "Refuser cette demande et réinitialiser l'abonnement ?",
                    confirmText: "Oui, refuser",
                    confirmColor: "bg-destructive",
                    onConfirm: () => {
                      if (member.id) refuserMutation.mutate(member.id);
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
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

        {/* ── Legacy : paiement pour actif non payé ── */}
        {isActiveButUnpaid(member) && member.userSubscriptions?.length === 0 && (
          <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm font-bold text-foreground">Paiement en attente</p>
            <p className="text-xs text-muted-foreground">
              Ce membre a commencé son abonnement mais n'a pas encore réglé.
            </p>
            <button
              onClick={() => {
                setPromptConfig({
                  isOpen: true,
                  type: "prompt",
                  title: "Enregistrer le paiement",
                  message: "Entrez le montant reçu en espèces :",
                  defaultValue: String(finalPrice),
                  inputType: "number",
                  confirmText: "Enregistrer le paiement",
                  confirmColor: "bg-green-600",
                  promoCode: member.promotion,
                  onConfirm: (amountValue: any) => {
                    let amount = Number(amountValue);
                    if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                    if (amount > 0) {
                      if (member.id) {
                        enregistrerPaiementMutation.mutate({ id: member.id, amount });
                      }
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                    } else {
                      toast.error("Montant invalide");
                    }
                  },
                });
              }}
              className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
            >
              Enregistrer le paiement
            </button>
          </div>
        )}

        {/* ── Legacy : renouvellement pour actif payé ── */}
        {member.userSubscriptions?.length === 0 && !isPendingLike && !isActiveButUnpaid(member) && (
          <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-sm font-semibold text-green-600">✓ Abonnement actif — Paiement enregistré</p>
              <p className="text-xs text-muted-foreground mt-1">
                Total payé: {formatCurrency(member.totalPayments || 0)}
              </p>
            </div>
            <button
              onClick={() => {
                const matchedPlan = findPlanForMember(member);
                const renewalPrice = matchedPlan ? getAmountWithPromo(member, matchedPlan.price) : 0;
                setPromptConfig({
                  isOpen: true,
                  type: "prompt",
                  title: "Renouveler l'abonnement",
                  message: `Prix du renouvellement : ${formatCurrency(renewalPrice)}\nSaisissez le montant reçu (0 pour gratuit) :`,
                  defaultValue: String(renewalPrice),
                  inputType: "number",
                  confirmText: "Renouveler",
                  confirmColor: "bg-primary",
                  promoCode: member.promotion,
                  onConfirm: (amountValue: any) => {
                    let amount = Number(amountValue);
                    if (isNaN(amount) || amount < 0) {
                      toast.error("Montant invalide");
                      return;
                    }
                    if (amount > renewalPrice) amount = renewalPrice;
                    renewMutation.mutate({
                      member,
                      subscriptionId: 0,
                      planName: member.subscription || "",
                      amount,
                      renewalPrice,
                    });
                    setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                  },
                });
              }}
              disabled={renewMutation.isPending}
              className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
              style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
            >
              {renewMutation.isPending ? "Renouvellement..." : "Confirmer le renouvellement"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}