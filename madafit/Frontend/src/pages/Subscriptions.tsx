import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import {
  STATUS_LABELS,
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  getFullName,
  normalizeMemberStatus,
  normalizeSubscriptionType,
} from "@/lib/madafit";
import type { User } from "@/types/entities";

export default function Subscriptions() {
  const queryClient = useQueryClient();
  const [selectedMember, setSelectedMember] = useState<User | null>(null);

  const usersQuery = useQuery({ queryKey: ["users", "subscriptions"], queryFn: () => api.users.getAll({ itemsPerPage: 100 }) });
  const plansQuery = useQuery({ queryKey: ["subscription-plans", "subscriptions"], queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }) });

  const users = extractHydraMembers(usersQuery.data);
  const plans = extractHydraMembers(plansQuery.data);

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
                    <tr key={member.id} className="cursor-pointer hover:bg-muted/20" onClick={() => setSelectedMember(member)}>
                      <td>
                        <p className="font-semibold text-foreground">{getFullName(member)}</p>
                        <p className="text-xs text-muted-foreground">{member.memberId}</p>
                      </td>
                      <td>{SUBSCRIPTION_LABELS[subscription]}</td>
                      <td>
                        <span className={status === "active" ? "badge-active" : status === "expired" ? "badge-expired" : "badge-suspended"}>
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
              <p className="text-sm text-muted-foreground">{SUBSCRIPTION_LABELS[normalizeSubscriptionType(selectedMember.subscription)]}</p>
              <p className="text-sm text-muted-foreground">Expire le {formatDate(selectedMember.expiryDate)}</p>
              {/* Affiche le montant du plan correspondant */}
              {(() => {
                const plan = plans.find((p) => normalizeSubscriptionType(p.type) === normalizeSubscriptionType(selectedMember.subscription));
                return plan ? (
                  <p className="text-sm font-bold text-primary">{formatCurrency(plan.price)}</p>
                ) : null;
              })()}
              <button
                className="w-full py-2.5 rounded-xl text-sm font-semibold text-white"
                style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
                onClick={() => renewMutation.mutate(selectedMember)}
                disabled={renewMutation.isPending}
              >
                {renewMutation.isPending ? "Renouvellement..." : "Confirmer le renouvellement"}
              </button>
            </div>
          )}
        </div>
      </div>
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