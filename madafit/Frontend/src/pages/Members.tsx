import { QRCodeSVG } from "qrcode.react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Trash2, UserPlus, Wifi, RefreshCw } from "lucide-react";
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
import type { User, SubscriptionPlan, PromoCode } from "@/types/entities";

const STATUS_FILTERS: { value: "all" | MemberStatus; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "active", label: "Actifs" },
  { value: "pending", label: "En attente" },
  { value: "expired", label: "Expires" },
  { value: "suspended", label: "Suspendus" },
];

export default function Members() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? "caisse2" : "caisse1";
  const [search, setSearch] = useState("");
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
    onConfirm: () => {},
  });

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
  });

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
  });
  const promoCodesQuery = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => api.promoCodes.getAll({ itemsPerPage: 100 }),
  });

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

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.users.delete(id),
    onSuccess: () => {
      toast.success("Membre supprimé");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const members = extractHydraMembers<User>(usersQuery.data);
  const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  const selectedMember = useMemo(() => members.find(m => m.id === selectedMemberId) || null, [members, selectedMemberId]);

  const updateExpiryMutation = useMutation({
    mutationFn: ({ id, expiryDate }: { id: number; expiryDate: string }) =>
      api.users.update(id, { expiryDate }),
    onSuccess: () => {
      toast.success("Date de fin synchronisée en base ✓");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: () => {
      console.error("Erreur lors de la mise à jour de la date de fin.");
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
      setSelectedMemberId(null);
    },
    onError: () => toast.error("Erreur lors de la validation"),
  });

  const payerMutation = useMutation({
    mutationFn: async ({ id, amount, userIri, subscription }: { id: number, amount: number, userIri: string, subscription: string }) => {
      const today = new Date().toISOString().split("T")[0];
      const currentUser = members.find(m => m.id === id);
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
        status: "active", 
        startDate: actualStartDate, 
        expiryDate, 
        totalPayments: newTotal 
      });
    },
    onSuccess: () => {
      toast.success("Paiement enregistré et abonnement validé");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      setSelectedMemberId(null);
    },
    onError: () => toast.error("Erreur lors du paiement"),
  });

  const resilierMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended" }),
    onSuccess: () => {
      toast.success("Abonnement résilié");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMemberId(null);
    },
    onError: () => toast.error("Erreur lors de la résiliation"),
  });

  const refuserMutation = useMutation({
    mutationFn: (id: number) => api.users.update(id, { status: "suspended", subscription: null }),
    onSuccess: () => {
      toast.success("Demande refusée");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setSelectedMemberId(null);
    },
    onError: () => toast.error("Erreur lors du refus"),
  });

  const filteredMembers = useMemo(() => {
    return members.filter((member) => {
      const normalizedStatus = normalizeMemberStatus(member.status);
      const haystack = [
        getFullName(member),
        member.memberId,
        member.rfidCard,
        member.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = search === "" || haystack.includes(search.toLowerCase());
      const matchesStatus = statusFilter === "all" || normalizedStatus === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [members, search, statusFilter]);

  const computedExpiryDate = useMemo(() => {
    if (!selectedMember || plans.length === 0) return selectedMember?.expiryDate ?? null;

    const matchedPlan = plans.find(
      (plan) =>
        normalizeSubscriptionType(plan.type) ===
        normalizeSubscriptionType(selectedMember.subscription)
    );

    const base = selectedMember.startDate || selectedMember.joinDate;
    if (!matchedPlan?.duration || !base) return selectedMember.expiryDate ?? null;

    const expiry = new Date(base);
    expiry.setMonth(expiry.getMonth() + Number(matchedPlan.duration));
    return expiry.toISOString().split("T")[0];
  }, [selectedMember, plans]);

  useEffect(() => {
    if (
      !selectedMember?.id ||
      !computedExpiryDate ||
      computedExpiryDate === selectedMember.expiryDate ||
      updateExpiryMutation.isPending
    ) return;

    updateExpiryMutation.mutate({
      id: selectedMember.id,
      expiryDate: computedExpiryDate,
    });
  }, [selectedMember?.id, computedExpiryDate, selectedMember?.expiryDate, updateExpiryMutation.isPending]);

  const wasOutOfSync =
    selectedMember &&
    computedExpiryDate &&
    selectedMember.expiryDate !== computedExpiryDate;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Gestion des Membres</h1>
          <p className="page-subtitle">{members.length} membres synchronisés depuis l'API</p>
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

      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5" style={{ height: "calc(100vh - 220px)", minHeight: "500px" }}>
        
        <div className="bg-card rounded-xl border overflow-hidden flex flex-col" style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}>
          <div className="overflow-x-auto overflow-y-auto flex-1">
            <table className="data-table">
              <thead className="sticky top-0 z-10">
                <tr style={{ background: "hsl(var(--muted) / 0.95))", backdropFilter: "blur(4px)" }}>
                  <th>Membre</th>
                  <th>Abonnement</th>
                  <th>Activités</th>
                  <th>Statut</th>
                  <th>Carte</th>
                  <th>Expiration</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {usersQuery.isLoading && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-muted-foreground">
                      Chargement...
                    </td>
                  </tr>
                )}
                {usersQuery.isError && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-destructive">
                      Impossible de charger les membres.
                    </td>
                  </tr>
                )}
                {!usersQuery.isLoading &&
                  !usersQuery.isError &&
                  filteredMembers.map((member) => {
                    const status = normalizeMemberStatus(member.status);
                    const subscription = normalizeSubscriptionType(member.subscription);

                    return (
                      <tr
                        key={member.id}
                        className="cursor-pointer hover:bg-muted/20"
                        onClick={() => setSelectedMemberId(member.id ?? null)}
                      >
                        <td>
                          <div>
                            <p className="font-semibold text-sm text-foreground">{getFullName(member)}</p>
                            <p className="text-xs text-muted-foreground">{member.email}</p>
                            <p className="text-xs text-muted-foreground">{member.memberId || "Sans numéro"}</p>
                          </div>
                        </td>
                        <td>{SUBSCRIPTION_LABELS[subscription as SubscriptionType] ?? subscription}</td>
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
                          <span className={status === "active" ? "badge-active" : status === "pending" ? "px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/20 text-orange-500" : status === "expired" ? "badge-expired" : "badge-suspended"}>
                            {STATUS_LABELS[status]}
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
                            onClick={(event) => {
                              event.stopPropagation();
                              if (member.id) {
                                setPromptConfig({
                                  isOpen: true,
                                  type: "confirm",
                                  title: "Supprimer le membre",
                                  message: `Voulez-vous vraiment supprimer ${getFullName(member)} ?`,
                                  confirmText: "Oui, supprimer",
                                  confirmColor: "bg-destructive",
                                  onConfirm: () => {
                                    if(member.id) deleteMutation.mutate(member.id);
                                    setPromptConfig(prev => ({ ...prev, isOpen: false }));
                                  }
                                });
                              }
                            }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-card rounded-xl border p-5 overflow-y-auto" style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}>
          <h2 className="font-bold text-foreground mb-4 sticky top-0 bg-card z-10 pb-2" style={{ borderBottom: "1px solid hsl(var(--border))" }}>Fiche rapide</h2>
          {!selectedMember ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              Sélectionnez un membre pour voir ses informations.
            </p>
          ) : (
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
                  <QRCodeSVG
                    value={`MADAFIT:${selectedMember.memberId}`}
                    size={160}
                    className="w-40 h-40"
                  />
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
                <InfoRow
                  label="Abonnement"
                  value={SUBSCRIPTION_LABELS[normalizeSubscriptionType(selectedMember.subscription) as SubscriptionType] ?? normalizeSubscriptionType(selectedMember.subscription)}
                />

                {selectedMember.promotion && (
                   <div className="flex items-start justify-between gap-4">
                     <span className="text-muted-foreground">Code Promo</span>
                     <span className="text-[10px] font-bold text-green-600 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                       {selectedMember.promotion}
                     </span>
                   </div>
                )}

                <InfoRow
                  label="Date début"
                  value={formatDate(selectedMember.startDate || selectedMember.joinDate)}
                />

                <div className="flex items-start justify-between gap-4">
                  <span className="text-muted-foreground">Date fin</span>
                  <div className="flex items-center gap-2 text-right">
                    <span className="text-foreground font-medium">
                      {formatDate(computedExpiryDate)}
                    </span>
                    {updateExpiryMutation.isPending ? (
                      <RefreshCw size={12} className="text-primary animate-spin shrink-0" />
                    ) : wasOutOfSync ? (
                      <span className="text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full shrink-0">
                        SYNC ✓
                      </span>
                    ) : null}
                  </div>
                </div>

                <InfoRow
                  label="Paiements"
                  value={
                    selectedMember.totalPayments != null
                      ? selectedMember.totalPayments.toLocaleString("fr-FR").replace(/\./g, " ")
                      : "0"
                  }
                />

                {(() => {
                  const matchedPlan = plans.find(p => normalizeSubscriptionType(p.type) === normalizeSubscriptionType(selectedMember.subscription));
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

                <InfoRow label="Notes" value={selectedMember.notes} />

                {(() => {
                  const status = normalizeMemberStatus(selectedMember.status);
                  const needsAction = status === "pending" || (status === "active" && (selectedMember.totalPayments || 0) === 0);
                  
                  if (!needsAction) return null;

                  return (
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
                                if(selectedMember.id) validerMutation.mutate(selectedMember.id);
                                setPromptConfig(prev => ({ ...prev, isOpen: false }));
                              }
                            });
                          }}
                          className="w-full py-2 px-4 bg-primary text-white rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
                        >
                          Valider & Commencer
                        </button>
                        <button 
                          onClick={() => {
                            const matchedPlan = plans.find(
                              (plan) =>
                                normalizeSubscriptionType(plan.type) ===
                                normalizeSubscriptionType(selectedMember.subscription)
                            );
                            const defaultPrice = matchedPlan ? getAmountWithPromo(selectedMember, matchedPlan.price) : 0;
                            
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
                                  if(selectedMember.id) {
                                    payerMutation.mutate({ 
                                      id: selectedMember.id, 
                                      amount, 
                                      userIri: `/api/users/${selectedMember.id}`,
                                      subscription: selectedMember.subscription || ""
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
                  );
                })()}

                {isAdmin && normalizeMemberStatus(selectedMember.status) === "active" && (
                  <div className="pt-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
                    <button
                      onClick={() => {
                        setPromptConfig({
                          isOpen: true,
                          type: "confirm",
                          title: "Résilier l'abonnement",
                          message: "Résilier l'abonnement actif de ce membre ? Le statut passera à 'Suspendu'.",
                          confirmText: "Oui, résilier",
                          confirmColor: "bg-destructive",
                          onConfirm: () => {
                            if (selectedMember.id) resilierMutation.mutate(selectedMember.id);
                            setPromptConfig(prev => ({ ...prev, isOpen: false }));
                          }
                        });
                      }}
                      className="w-full py-2 px-4 bg-destructive/10 text-destructive border border-destructive/20 rounded-lg font-medium text-sm hover:bg-destructive hover:text-white transition-all"
                    >
                      Résilier l'abonnement
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

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

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right text-foreground font-medium">{value || "—"}</span>
    </div>
  );
}
