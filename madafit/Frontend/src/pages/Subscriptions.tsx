import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Eye } from "lucide-react";
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
  type SubscriptionType,
} from "@/lib/madafit";
import type { User, SubscriptionPlan, PromoCode } from "@/types/entities";

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

  const usersQuery = useQuery({ queryKey: ["users", "subscriptions"], queryFn: () => api.users.getAll({ itemsPerPage: 100 }) });
  const plansQuery = useQuery({ queryKey: ["subscription-plans", "subscriptions"], queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }) });
  const promoCodesQuery = useQuery({ queryKey: ["promo-codes"], queryFn: () => api.promoCodes.getAll({ itemsPerPage: 100 }) });

  const users = extractHydraMembers<User>(usersQuery.data);
  const plans = extractHydraMembers<SubscriptionPlan>(plansQuery.data);
  const promoCodes = extractHydraMembers<PromoCode>(promoCodesQuery.data);

  const getAmountWithPromo = (member: User, originalPrice: number) => {
    if (!member.promotion) return originalPrice;
    const promo = promoCodes.find(p => p.code.toUpperCase() === member.promotion?.toUpperCase());
    if (!promo) return originalPrice;

    let discounted = originalPrice;
    if (promo.discountPercentage) {
      discounted -= (originalPrice * (promo.discountPercentage / 100));
    } else if (promo.discountAmount) {
      discounted -= promo.discountAmount;
    }
    return Math.max(0, discounted);
  };

  const renewMutation = useMutation({
    mutationFn: async (member: User) => {
      const currentType = normalizeSubscriptionType(member.subscription);
      const selectedPlan = plans.find((plan) => normalizeSubscriptionType(plan.type) === currentType);
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + Number(selectedPlan?.duration ?? 1));
      const today = now.toISOString().split("T")[0];

      await api.users.update(member.id!, {
        status: "active",
        startDate: today,
        expiryDate: expiry.toISOString().split("T")[0],
      });

      if (selectedPlan?.price) {
        const finalAmount = getAmountWithPromo(member, selectedPlan.price);
        await api.payments.create({
          memberId: member.memberId,
          memberName: getFullName(member),
          amount: finalAmount,
          method: "cash",
          date: today,
          subscription: currentType,
          cashRegister: currentCashRegister,
        });
      }
    },
    onSuccess: () => {
      toast.success("Abonnement renouvelle");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      refreshNotifications();
      setSelectedMember(null);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const validerMutation = useMutation({
    mutationFn: (id: number) => {
      const today = new Date().toISOString().split("T")[0];
      return api.users.update(id, { status: "active", startDate: today });
    },
    onSuccess: () => {
      toast.success("Abonnement validé avec succès");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de la validation"),
  });

  const payerMutation = useMutation({
    mutationFn: async ({ id, amount, userIri, subscription }: { id: number, amount: number, userIri: string, subscription: string }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = users.find(m => m.id === id);
      const originalStart = currentUser?.startDate || currentUser?.joinDate || today;
      const actualStartDate = calculateGracePeriodStartDate(originalStart, today);

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
      const currentType = normalizeSubscriptionType(currentUser?.subscription);
      const selectedPlan = plans.find(p => normalizeSubscriptionType(p.type) === currentType);
      const expiry = new Date(actualStartDate);
      expiry.setMonth(expiry.getMonth() + Number(selectedPlan?.duration ?? 1));
      const expiryDate = expiry.toISOString().split("T")[0];

      return api.users.update(id, {
        totalPayments: newTotal,
        status: "active",
        startDate: actualStartDate,
        expiryDate,
      });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré et abonnement activé");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      refreshNotifications();
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors du paiement"),
  });

  const resilierMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended" }),
    onSuccess: () => {
      toast.success("Abonnement résilié");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      refreshNotifications();
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors de la résiliation"),
  });

  const refuserMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended", subscription: null }),
    onSuccess: () => {
      toast.success("Demande refusée");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors du refus"),
  });

  const stats = useMemo(() => {
    return {
      active: users.filter((user) => normalizeMemberStatus(user.status) === "active").length,
      expired: users.filter((user) => normalizeMemberStatus(user.status) === "expired").length,
      suspended: users.filter((user) => normalizeMemberStatus(user.status) === "suspended").length,
    };
  }, [users]);

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

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        <div className="bg-card rounded-xl border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr style={{ background: "hsl(var(--muted) / 0.5)" }}>
                  <th>Membre</th>
                  <th>Formule</th>
                  <th>Statut</th>
                  <th>Expiration</th>
                  <th>Paiements</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {users.map((member) => {
                  const status = normalizeMemberStatus(member.status);
                  const subscription = normalizeSubscriptionType(member.subscription);

                  return (
                    <tr key={member.id} className="cursor-pointer hover:bg-muted/20" onClick={() => { setSelectedMember(member); setIsModalOpen(true); }}>
                      <td>
                        <p className="font-semibold text-foreground">{getFullName(member)}</p>
                        <p className="text-xs text-muted-foreground">{member.memberId}</p>
                      </td>
                      <td>{SUBSCRIPTION_LABELS[subscription as SubscriptionType] || subscription || "—"}</td>
                      <td>
                        <span className={status === "active" ? "badge-active" : status === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : status === "expired" ? "badge-expired" : "badge-suspended"}>
                          {STATUS_LABELS[status]}
                        </span>
                      </td>
                      <td>{formatDate(member.expiryDate)}</td>
                      <td>{formatCurrency(member.totalPayments)}</td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember(member);
                            setIsModalOpen(true);
                          }}
                          className="p-2 rounded-lg hover:bg-primary/10 text-primary transition-colors"
                          title="Gérer l'abonnement"
                        >
                          <Eye size={18} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5" style={{ borderColor: "hsl(var(--border))" }}>
          <h2 className="font-bold text-foreground mb-4">Renouveler</h2>
          {!selectedMember ? (
            <p className="text-sm text-muted-foreground">Selectionnez un membre dans la liste.</p>
          ) : (
            <div className="space-y-3">
              <p className="font-semibold text-foreground">{getFullName(selectedMember)}</p>
              <p className="text-sm text-muted-foreground">{SUBSCRIPTION_LABELS[normalizeSubscriptionType(selectedMember.subscription) as SubscriptionType] || normalizeSubscriptionType(selectedMember.subscription) || "—"}</p>
              <p className="text-sm text-muted-foreground">
                {normalizeMemberStatus(selectedMember.status) === "pending" 
                  ? "Demande en attente" 
                  : `Expire le ${formatDate(selectedMember.expiryDate)}`}
              </p>
              {(() => {
                const findPlanForMember = (m: User) => {
                  if (!m.subscription) return null;
                  const normalizedSub = normalizeSubscriptionType(m.subscription);
                  let p = plans.find(plan => normalizeSubscriptionType(plan.type) === normalizedSub);
                  if (p) return p;
                  p = plans.find(plan => plan.name.toLowerCase().includes(normalizedSub) || normalizedSub.includes(plan.name.toLowerCase()));
                  if (p) return p;
                  return plans.find(plan => normalizeSubscriptionType(plan.type) === "monthly") || plans[0] || null;
                };

                const matchedPlan = findPlanForMember(selectedMember);
                if (!matchedPlan) return null;
                
                const discountedPrice = getAmountWithPromo(selectedMember, matchedPlan.price);
                const hasPromo = discountedPrice < matchedPlan.price;

                return (
                  <div className="space-y-1">
                    <p className={`text-sm font-bold ${hasPromo ? 'text-muted-foreground line-through' : 'text-primary'}`}>
                      {formatCurrency(matchedPlan.price)}
                    </p>
                    {hasPromo && (
                      <div className="flex flex-col">
                        <p className="text-sm font-black text-primary">
                          {formatCurrency(discountedPrice)}
                        </p>
                        <p className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full w-fit">
                          CODE: {selectedMember.promotion}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const status = normalizeMemberStatus(selectedMember.status);
                const needsAction = status === "pending" || (status === "active" && (selectedMember.totalPayments || 0) === 0);

                return needsAction ? (
                  <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                    <p className="text-sm font-bold text-foreground">Actions sur la demande</p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          setPromptConfig({
                            isOpen: true,
                            type: "confirm",
                            title: "Commencer l'abonnement",
                            message: "Voulez-vous commencer l'abonnement sans enregistrer de paiement ?",
                            confirmText: "Oui, commencer",
                            onConfirm: () => {
                              if(selectedMember.id) validerMutation.mutate(selectedMember.id);
                              setPromptConfig(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Commencer l'abonnement
                      </button>
                      <button 
                        onClick={() => {
                          const findPlanForMember = (m: User) => {
                            if (!m.subscription) return null;
                            const normalizedSub = normalizeSubscriptionType(m.subscription);
                            let p = plans.find(plan => normalizeSubscriptionType(plan.type) === normalizedSub);
                            if (p) return p;
                            p = plans.find(plan => plan.name.toLowerCase().includes(normalizedSub) || normalizedSub.includes(plan.name.toLowerCase()));
                            if (p) return p;
                            return plans.find(plan => normalizeSubscriptionType(plan.type) === "monthly") || plans[0] || null;
                          };

                          const matchedPlan = findPlanForMember(selectedMember);
                          const defaultPrice = matchedPlan ? getAmountWithPromo(selectedMember, matchedPlan.price) : 0;
                          
                          setPromptConfig({
                            isOpen: true,
                            type: "prompt",
                            title: "Paiement de l'abonnement",
                            message: "Entrez le montant reçu en espèces :",
                            defaultValue: String(defaultPrice),
                            inputType: "number",
                            confirmText: "Enregistrer le paiement",
                            confirmColor: "bg-green-600",
                            promoCode: selectedMember.promotion,
                            onConfirm: (amountValue) => {
                              let amount = Number(amountValue);
                              if ((isNaN(amount) || amount <= 0) && defaultPrice > 0) amount = defaultPrice;
                              if (amount > 0) {
                                if(selectedMember.id) {
                                  payerMutation.mutate({ 
                                    id: selectedMember.id, 
                                    amount,
                                    userIri: `/api/users/${selectedMember.id}`,
                                    subscription: selectedMember.subscription || "",
                                  });
                                }
                                setPromptConfig(prev => ({ ...prev, isOpen: false }));
                              } else {
                                toast.error("Montant invalide");
                              }
                            }
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
                            message: "Voulez-vous vraiment refuser cette demande ? L'abonnement sera réinitialisé.",
                            confirmText: "Oui, refuser",
                            confirmColor: "bg-destructive",
                            onConfirm: () => {
                              if(selectedMember.id) refuserMutation.mutate(selectedMember.id);
                              setPromptConfig(prev => ({ ...prev, isOpen: false }));
                            }
                          });
                        }}
                        className="w-full py-2 px-4 bg-destructive text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Refuser
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                    style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
                    onClick={() => renewMutation.mutate(selectedMember)}
                    disabled={renewMutation.isPending}
                  >
                    {renewMutation.isPending ? "Renouvellement..." : "Confirmer le renouvellement"}
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      </div>

      <ValidationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        member={selectedMember}
        plans={plans}
        promoCodes={promoCodes}
        validerMutation={validerMutation}
        payerMutation={payerMutation}
        refuserMutation={refuserMutation}
        resilierMutation={resilierMutation}
        setPromptConfig={setPromptConfig}
        isAdmin={isAdmin}
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

function ValidationModal({ 
  isOpen, 
  onClose, 
  member, 
  plans, 
  promoCodes,
  validerMutation, 
  payerMutation, 
  refuserMutation,
  resilierMutation,
  setPromptConfig,
  isAdmin,
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  member: User | null; 
  plans: SubscriptionPlan[];
  promoCodes: PromoCode[];
  validerMutation: any;
  payerMutation: any;
  refuserMutation: any;
  resilierMutation: any;
  setPromptConfig: any;
  isAdmin: boolean;
}) {
  if (!isOpen || !member) return null;

  const status = normalizeMemberStatus(member.status);
  const needsAction = status === "pending" || (status === "active" && (member.totalPayments || 0) === 0);
  
  const getAmountWithPromo = (m: User, originalPrice: number) => {
    if (!m.promotion) return originalPrice;
    const promo = promoCodes.find(p => p.code.toUpperCase() === m.promotion?.toUpperCase());
    if (!promo) return originalPrice;

    let discounted = originalPrice;
    if (promo.discountPercentage) {
      discounted -= (originalPrice * (promo.discountPercentage / 100));
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-card w-full max-w-md rounded-2xl border shadow-2xl p-6 space-y-6 animate-in zoom-in-95 duration-200"
        style={{ borderColor: "hsl(var(--border))" }}
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
            <p className="font-bold text-foreground">{SUBSCRIPTION_LABELS[subscriptionLabel as SubscriptionType] || subscriptionLabel || "—"}</p>
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
               <span className={`inline-block mt-1 ${status === "active" ? "badge-active" : status === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : status === "expired" ? "badge-expired" : "badge-suspended"}`}>
                 {STATUS_LABELS[status]}
               </span>
             </div>
             <div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Date expiration</p>
               <p className="text-sm font-semibold mt-1">{formatDate(member.expiryDate)}</p>
             </div>
          </div>
        </div>

        {needsAction ? (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm font-bold text-center text-foreground">Actions requises</p>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "confirm",
                    title: "Commencer l'abonnement",
                    message: "Commencer l'abonnement sans enregistrer de paiement ?",
                    confirmText: "Oui, commencer",
                    onConfirm: () => {
                      if(member.id) {
                        validerMutation.mutate(member.id);
                        onClose();
                      }
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                    }
                  });
                }}
                className="w-full py-3 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Commencer l'abonnement
              </button>
              <button 
                onClick={() => {
                  setPromptConfig({
                    isOpen: true,
                    type: "prompt",
                    title: "Enregistrer un paiement",
                    message: "Saisissez le montant réglé par le client :",
                    defaultValue: String(finalPrice),
                    inputType: "number",
                    confirmText: "Valider le paiement",
                    confirmColor: "bg-green-600",
                    promoCode: member.promotion,
                    onConfirm: (amountValue: any) => {
                      let amount = Number(amountValue);
                      if ((isNaN(amount) || amount <= 0) && finalPrice > 0) amount = finalPrice;
                      if (amount > 0) {
                        if(member.id) {
                          payerMutation.mutate({ 
                            id: member.id, 
                            amount,
                            userIri: `/api/users/${member.id}`,
                            subscription: member.subscription || "",
                          });
                          onClose();
                        }
                        setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                      } else {
                        toast.error("Montant invalide");
                      }
                    }
                  });
                }}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Payer l'abonnement (Espèces)
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
                      if(member.id) {
                        refuserMutation.mutate(member.id);
                        onClose();
                      }
                      setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                    }
                  });
                }}
                className="w-full py-3 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl font-bold text-sm transition-all hover:bg-destructive hover:text-white active:scale-95"
              >
                Refuser la demande
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
             <p className="text-sm text-muted-foreground italic text-center">L'abonnement est actif jusqu'au {formatDate(member.expiryDate)}.</p>
             <button onClick={onClose} className="w-full py-2 px-4 bg-muted/50 text-foreground rounded-lg font-medium text-sm hover:bg-muted transition-colors">Fermer</button>
             {isAdmin && (
               <button
                 onClick={() => {
                   setPromptConfig({
                     isOpen: true,
                     type: "confirm",
                     title: "Résilier l'abonnement",
                     message: "Résilier cet abonnement actif ? Le statut passera à 'Suspendu'.",
                     confirmText: "Oui, résilier",
                     confirmColor: "bg-destructive",
                     onConfirm: () => {
                       if (member.id) {
                         resilierMutation.mutate(member.id);
                         onClose();
                       }
                       setPromptConfig((prev: any) => ({ ...prev, isOpen: false }));
                     }
                   });
                 }}
                 className="w-full py-2 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-medium text-sm hover:bg-destructive hover:text-white transition-all"
               >
                 Résilier l'abonnement
               </button>
             )}
          </div>
        )}
      </div>
    </div>
  );
}
