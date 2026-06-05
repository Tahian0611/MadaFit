import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import {
  STATUS_LABELS,
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  getFullName,
  normalizeMemberStatus,
  normalizeSubscriptionType,
  type SubscriptionType,
} from "@/lib/madafit";
import type { User, SubscriptionPlan } from "@/types/entities";

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? "caisse2" : "caisse1";
  const [selectedMember, setSelectedMember] = useState<User | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const usersQuery = useQuery({ queryKey: ["users", "subscriptions"], queryFn: () => api.users.getAll({ itemsPerPage: 100 }) });
  const plansQuery = useQuery({ queryKey: ["subscription-plans", "subscriptions"], queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }) });

  const users = extractHydraMembers<User>(usersQuery.data);
  const plans = extractHydraMembers<SubscriptionPlan>(plansQuery.data);

  const renewMutation = useMutation({
    mutationFn: async (member: User) => {
      const currentType = normalizeSubscriptionType(member.subscription);
      const selectedPlan = plans.find((plan) => normalizeSubscriptionType(plan.type) === currentType);
      const now = new Date();
      const expiry = new Date(now);
      expiry.setMonth(expiry.getMonth() + Number(selectedPlan?.duration ?? 1));

      // 1. Mise à jour du statut et des dates de l'utilisateur
      await api.users.update(member.id!, {
        status: "active",
        startDate: now.toISOString().split("T")[0],
        expiryDate: expiry.toISOString().split("T")[0],
      });

      // 2. Création du paiement pour que le Dashboard affiche le revenu
      if (selectedPlan?.price) {
        await api.payments.create({
          memberId: member.memberId,
          memberName: getFullName(member),
          amount: selectedPlan.price,
          method: "cash",
          date: now.toISOString().split("T")[0],
          subscription: currentType,
          cashRegister: currentCashRegister,
        });
      }
    },
    onSuccess: () => {
      toast.success("Abonnement renouvele");
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
      await api.paymentRecords.create({
        user: userIri,
        amount: amount,
        date: today,
        method: "Espèces",
        receiptNo: `VAL-${Date.now()}`,
        subscription: subscription,
      });
      const currentUser = users.find(m => m.id === id);
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
      return api.users.update(id, { totalPayments: newTotal });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedMember(null);
    },
    onError: () => toast.error("Erreur lors du paiement"),
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
              {/* Affiche le montant du plan correspondant */}
              {(() => {
                const plan = plans.find((p) => normalizeSubscriptionType(p.type) === normalizeSubscriptionType(selectedMember.subscription));
                return plan ? (
                  <p className="text-sm font-bold text-primary">{formatCurrency(plan.price)}</p>
                ) : null;
              })()}

              {(() => {
                const normalizedStatus = normalizeMemberStatus(selectedMember.status);

                // Fallback: certains backends peuvent ne jamais renvoyer exactement "pending".
                // On affiche alors les 3 boutons si l'état ressemble à une demande et que l'abonnement n'est pas démarré.
                const isPendingLike =
                  normalizedStatus === "pending" ||
                  (normalizedStatus === "suspended" && !selectedMember.startDate);

                return isPendingLike ? (
                  <div className="pt-4 space-y-3 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                    <p className="text-sm font-bold text-foreground">Actions sur la demande</p>
                    <div className="flex flex-col gap-2">
                      <button 
                        onClick={() => {
                          if(window.confirm("Commencer l'abonnement sans enregistrer de paiement ?")) {
                            if(selectedMember.id) validerMutation.mutate(selectedMember.id);
                          }
                        }}
                        className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Commencer l'abonnement
                      </button>
                      <button 
                        onClick={() => {
                          const matchedPlan = plans.find(
                            (plan) =>
                              normalizeSubscriptionType(plan.type) ===
                              normalizeSubscriptionType(selectedMember.subscription)
                          );
                          const defaultPrice = matchedPlan?.price || 0;
                          const amountStr = window.prompt("Entrez le montant payé:", String(defaultPrice));
                          if (amountStr !== null) {
                            const amount = Number(amountStr);
                            if (!isNaN(amount) && amount > 0) {
                              if(selectedMember.id) {
                                payerMutation.mutate({ 
                                  id: selectedMember.id, 
                                  amount,
                                  userIri: `/api/users/${selectedMember.id}`,
                                  subscription: selectedMember.subscription || "",
                                });
                              }
                            } else {
                              toast.error("Montant invalide");
                            }
                          }
                        }}
                        className="w-full py-2 px-4 bg-green-600 text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                      >
                        Payer l'abonnement
                      </button>
                      <button 
                        onClick={() => {
                          if(window.confirm("Refuser cette demande et réinitialiser l'abonnement ?")) {
                            if(selectedMember.id) refuserMutation.mutate(selectedMember.id);
                          }
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
        validerMutation={validerMutation}
        payerMutation={payerMutation}
        refuserMutation={refuserMutation}
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

// ── COMPOSANT MODAL DE VALIDATION ──────────────────────────────────────────

function ValidationModal({ 
  isOpen, 
  onClose, 
  member, 
  plans, 
  validerMutation, 
  payerMutation, 
  refuserMutation 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  member: User | null; 
  plans: SubscriptionPlan[];
  validerMutation: any;
  payerMutation: any;
  refuserMutation: any;
}) {
  if (!isOpen || !member) return null;

  const normalizedStatus = normalizeMemberStatus(member.status);
  const isPendingLike = normalizedStatus === "pending" || (normalizedStatus === "suspended" && !member.startDate);
  const subscription = normalizeSubscriptionType(member.subscription);
  const plan = plans.find((p) => normalizeSubscriptionType(p.type) === subscription);

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
            <p className="font-bold text-foreground">{SUBSCRIPTION_LABELS[subscription as SubscriptionType] || subscription || "—"}</p>
            {plan && <p className="text-lg font-black text-primary mt-1">{formatCurrency(plan.price)}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
             <div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Statut actuel</p>
               <span className={`inline-block mt-1 ${normalizedStatus === "active" ? "badge-active" : normalizedStatus === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : normalizedStatus === "expired" ? "badge-expired" : "badge-suspended"}`}>
                 {STATUS_LABELS[normalizedStatus]}
               </span>
             </div>
             <div>
               <p className="text-[10px] font-bold text-muted-foreground uppercase">Date expiration</p>
               <p className="text-sm font-semibold mt-1">{formatDate(member.expiryDate)}</p>
             </div>
          </div>
        </div>

        {isPendingLike ? (
          <div className="pt-4 border-t space-y-3" style={{ borderColor: "hsl(var(--border))" }}>
            <p className="text-sm font-bold text-center text-foreground">Actions requises</p>
            <div className="grid grid-cols-1 gap-3">
              <button 
                onClick={() => {
                  if(window.confirm("Commencer l'abonnement sans enregistrer de paiement ?")) {
                    if(member.id) {
                      validerMutation.mutate(member.id);
                      onClose();
                    }
                  }
                }}
                className="w-full py-3 px-4 bg-primary text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Commencer l'abonnement
              </button>
              <button 
                onClick={() => {
                  const defaultPrice = plan?.price || 0;
                  const amountStr = window.prompt("Entrez le montant payé:", String(defaultPrice));
                  if (amountStr !== null) {
                    const amount = Number(amountStr);
                    if (!isNaN(amount) && amount > 0) {
                      if(member.id) {
                        payerMutation.mutate({ 
                          id: member.id, 
                          amount,
                          userIri: `/api/users/${member.id}`,
                          subscription: member.subscription || "",
                        });
                        onClose();
                      }
                    } else {
                      toast.error("Montant invalide");
                    }
                  }
                }}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Payer l'abonnement (Espèces)
              </button>
              <button 
                onClick={() => {
                  if(window.confirm("Refuser cette demande et réinitialiser l'abonnement ?")) {
                    if(member.id) {
                      refuserMutation.mutate(member.id);
                      onClose();
                    }
                  }
                }}
                className="w-full py-3 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-xl font-bold text-sm transition-all hover:bg-destructive hover:text-white active:scale-95"
              >
                Refuser la demande
              </button>
            </div>
          </div>
        ) : (
          <div className="pt-4 border-t space-y-4" style={{ borderColor: "hsl(var(--border))" }}>
             <p className="text-sm text-muted-foreground italic text-center">L'abonnement est actif.</p>
             
             {/* Bouton payer toujours disponible - totalPayments est cumulatif et ne peut pas servir d'indicateur */}
             <button 
                onClick={() => {
                  const defaultPrice = plan?.price || 0;
                  const amountStr = window.prompt("Entrez le montant payé:", String(defaultPrice));
                  if (amountStr !== null) {
                    const amount = Number(amountStr);
                    if (!isNaN(amount) && amount > 0) {
                      if(member.id) {
                        payerMutation.mutate({ 
                          id: member.id, 
                          amount,
                          userIri: `/api/users/${member.id}`,
                          subscription: member.subscription || "",
                        });
                        onClose();
                      }
                    } else {
                      toast.error("Montant invalide");
                    }
                  }
                }}
                className="w-full py-3 px-4 bg-green-600 text-white rounded-xl font-bold text-sm shadow-sm transition-all hover:opacity-90 active:scale-95"
              >
                Payer l'abonnement (Espèces)
              </button>

             <button onClick={onClose} className="w-full py-2 px-4 bg-muted/50 text-foreground rounded-lg font-medium text-sm hover:bg-muted transition-colors">Fermer</button>
          </div>
        )}
      </div>
    </div>
  );
}
