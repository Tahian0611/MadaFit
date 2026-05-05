import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import {
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  normalizeSubscriptionType,
} from "@/lib/madafit";

export default function Plans() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const initialForm = {
    name: "",
    type: "monthly",
    duration: 1,
    price: 35000,
    features: "Acces salle illimite, Vestiaire",
  };

  const [form, setForm] = useState(initialForm);

  const plansQuery = useQuery({
    queryKey: ["subscription-plans"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
  });

  const plans = extractHydraMembers(plansQuery.data);

  const saveMutation = useMutation({
    mutationFn: () => {
      const isTypeAlreadyUsed = plans.some(
        (plan) => 
          plan.type === form.type && 
          plan.id !== editingId
      );

      if (isTypeAlreadyUsed) {
        throw new Error(`Une offre de type "${SUBSCRIPTION_LABELS[normalizeSubscriptionType(form.type)]}" existe déjà.`);
      }

      const payload = {
        ...form,
        duration: Number(form.duration),
        price: Number(form.price),
        features: form.features.split(",").map((item) => item.trim()).filter(Boolean),
      };
      
      return editingId 
        ? api.subscriptionPlans.update(editingId, payload) 
        : api.subscriptionPlans.create({ ...payload, popular: false });
    },
    onSuccess: () => {
      toast.success(editingId ? "Formule mise à jour" : "Formule ajoutée");
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      refreshNotifications();
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.subscriptionPlans.delete(id),
    onSuccess: () => {
      toast.success("Formule supprimée");
      queryClient.invalidateQueries({ queryKey: ["subscription-plans"] });
      refreshNotifications();
      setDeleteId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const openEdit = (plan: any) => {
    setEditingId(plan.id);
    setForm({
      name: plan.name,
      type: plan.type,
      duration: plan.duration,
      price: plan.price,
      features: (plan.features ?? []).join(", "),
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(initialForm);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title">Formules & Abonnements</h1>
          <p className="page-subtitle">Gestion en base des offres MadaFit</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
        >
          <Plus size={18} />
          Nouvelle formule
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {plans.map((plan) => (
          <div key={plan.id} className="group relative rounded-2xl border bg-card p-5 transition-all hover:shadow-lg" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => openEdit(plan)}
                className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white transition-colors"
              >
                <Pencil size={14} />
              </button>
              <button 
                onClick={() => setDeleteId(plan.id)}
                className="p-1.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-colors"
              >
                <Trash2 size={14} />
              </button>
            </div>

            <p className="text-xs text-muted-foreground mb-2">{SUBSCRIPTION_LABELS[normalizeSubscriptionType(plan.type)]}</p>
            <h3 className="font-black text-lg text-foreground">{plan.name}</h3>
            <p className="text-2xl font-black text-primary mt-3">{formatCurrency(plan.price)}</p>
            <p className="text-xs text-muted-foreground mt-1">{plan.duration} mois</p>
            <ul className="mt-4 space-y-1.5 text-sm text-muted-foreground">
              {(plan.features ?? []).map((feature: string, index: number) => (
                <li key={index}>• {feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-card p-8 text-center shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2">Supprimer l'offre ?</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Cette action est irréversible. Les nouveaux membres ne pourront plus souscrire à ce plan.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                className="px-6 py-3 rounded-xl border font-bold hover:bg-accent transition-colors" 
                onClick={() => setDeleteId(null)}
              >
                Annuler
              </button>
              <button
                className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-all shadow-lg shadow-red-900/20"
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? "Suppression..." : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-3xl border bg-card p-8 shadow-2xl space-y-6" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-foreground">
                {editingId ? "Modifier l'offre" : "Nouvelle formule"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <Field label="Nom de l'offre" value={form.name} onChange={(value) => setForm((c) => ({ ...c, name: value }))} />
              <div className="grid grid-cols-2 gap-4">
                <SelectField
                  label="Type d'abonnement"
                  value={form.type}
                  onChange={(value) => setForm((c) => ({ ...c, type: value }))}
                  options={[
                    { value: "monthly", label: "Mensuel" },
                    { value: "quarterly", label: "Trimestriel" },
                    { value: "annual", label: "Annuel" },
                    { value: "vip", label: "VIP" },
                    { value: "coaching", label: "Coaching" },
                  ]}
                />
                <Field label="Durée (mois)" type="number" value={String(form.duration)} onChange={(value) => setForm((c) => ({ ...c, duration: Number(value) }))} />
              </div>
              <Field label="Prix (Ar)" type="number" value={String(form.price)} onChange={(value) => setForm((c) => ({ ...c, price: Number(value) }))} />
              <Field label="Avantages (séparés par virgule)" value={form.features} onChange={(value) => setForm((c) => ({ ...c, features: value }))} />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button className="px-6 py-2.5 rounded-xl border font-bold" onClick={closeModal}>
                Annuler
              </button>
              <button
                className="px-6 py-2.5 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: "var(--gradient-hero)" }}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.name}
              >
                {saveMutation.isPending ? "Enregistrement..." : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string; }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
        style={{ borderColor: "hsl(var(--border))" }}
      />
    </div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[]; }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
        style={{ borderColor: "hsl(var(--border))" }}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}