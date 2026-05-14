import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, X, AlertTriangle, Ticket, Calendar, Users, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { extractHydraMembers } from "@/lib/madafit";
import { PromoCode } from "@/types/entities";

export default function PromoCodes() {
  const queryClient = useQueryClient();
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | string | null>(null);
  const [deleteId, setDeleteId] = useState<number | string | null>(null);

  const initialForm = {
    code: "",
    discountPercentage: 0,
    discountAmount: 0,
    expiryDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0],
    isActive: true,
    maxUses: 100,
  };

  const [form, setForm] = useState(initialForm);

  const promoCodesQuery = useQuery({
    queryKey: ["promo-codes"],
    queryFn: () => api.promoCodes.getAll({ itemsPerPage: 100 }),
  });

  const promoCodes = extractHydraMembers<PromoCode>(promoCodesQuery.data);

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        discountPercentage: form.discountPercentage ? Number(form.discountPercentage) : null,
        discountAmount: form.discountAmount ? Number(form.discountAmount) : null,
        maxUses: form.maxUses ? Number(form.maxUses) : null,
        expiryDate: new Date(form.expiryDate).toISOString(),
      };
      
      return editingId 
        ? api.promoCodes.update(editingId, payload) 
        : api.promoCodes.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Code promo mis à jour" : "Code promo ajouté");
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      closeModal();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.promoCodes.delete(id),
    onSuccess: () => {
      toast.success("Code promo supprimé");
      queryClient.invalidateQueries({ queryKey: ["promo-codes"] });
      setDeleteId(null);
    },
    onError: () => toast.error("Erreur lors de la suppression"),
  });

  const openEdit = (promo: any) => {
    setEditingId(promo.id);
    setForm({
      code: promo.code || "",
      discountPercentage: promo.discountPercentage ?? 0,
      discountAmount: promo.discountAmount ?? 0,
      expiryDate: promo.expiryDate ? promo.expiryDate.split('T')[0] : initialForm.expiryDate,
      isActive: ((promo as any).isActive !== undefined ? (promo as any).isActive : (promo as any).active) ?? true,
      maxUses: promo.maxUses ?? 0,
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(initialForm);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2">
            <Ticket className="text-primary" />
            Codes Promo
          </h1>
          <p className="page-subtitle">Gérez les réductions pour vos membres</p>
        </div>
        <button
          onClick={() => setIsOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
        >
          <Plus size={18} />
          Nouveau code
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {promoCodes.map((promo) => (
          <div key={promo.id} className="group relative rounded-2xl border bg-card p-6 transition-all hover:shadow-lg overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="absolute top-0 right-0 p-4">
              {((promo as any).isActive !== undefined ? (promo as any).isActive : (promo as any).active) ? (
                <span className="flex items-center gap-1 text-[10px] font-black text-green-500 bg-green-500/10 px-2 py-1 rounded-full">
                  <CheckCircle2 size={10} /> ACTIF
                </span>
              ) : (
                <span className="flex items-center gap-1 text-[10px] font-black text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
                  <XCircle size={10} /> INACTIF
                </span>
              )}
            </div>

            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Ticket size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black tracking-tight">{promo.code}</h3>
                <p className="text-sm text-muted-foreground">
                  {promo.discountPercentage 
                    ? `${promo.discountPercentage}% de réduction` 
                    : `${promo.discountAmount} Ar de réduction`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Calendar size={10} /> Expiration
                </p>
                <p className="text-xs font-semibold">{formatDate(promo.expiryDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                  <Users size={10} /> Utilisations
                </p>
                <p className="text-xs font-semibold">
                  {promo.currentUses} / {promo.maxUses || '∞'}
                </p>
              </div>
            </div>

            <div className="mt-6 flex gap-2">
              <button 
                onClick={() => openEdit(promo)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
              >
                <Pencil size={14} /> Modifier
              </button>
              <button 
                onClick={() => setDeleteId(promo.id)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-red-500/20 bg-card p-8 text-center shadow-2xl">
            <div className="mx-auto w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-black text-foreground mb-2">Supprimer le code ?</h2>
            <p className="text-muted-foreground text-sm mb-8">
              Cette action supprimera définitivement le code promo <strong>{promoCodes.find(p => String(p.id) === String(deleteId))?.code}</strong>.
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
                onClick={() => deleteMutation.mutate(String(deleteId))}
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
                {editingId ? "Modifier le code" : "Nouveau code promo"}
              </h2>
              <button onClick={closeModal} className="text-muted-foreground hover:text-foreground">
                <X size={24} />
              </button>
            </div>

            <div className="space-y-4">
              <Field 
                label="Code Promo (ex: MADA20)" 
                value={form.code} 
                onChange={(value) => setForm((c) => ({ ...c, code: value.toUpperCase() }))} 
              />
              
              <div className="grid grid-cols-2 gap-4">
                <Field 
                  label="Réduction (%)" 
                  type="number" 
                  value={String(form.discountPercentage)} 
                  onChange={(value) => setForm((c) => ({ ...c, discountPercentage: Number(value), discountAmount: 0 }))} 
                />
                <Field 
                  label="Réduction (Montant Ar)" 
                  type="number" 
                  value={String(form.discountAmount)} 
                  onChange={(value) => setForm((c) => ({ ...c, discountAmount: Number(value), discountPercentage: 0 }))} 
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Field 
                  label="Date d'expiration" 
                  type="date" 
                  value={form.expiryDate} 
                  onChange={(value) => setForm((c) => ({ ...c, expiryDate: value }))} 
                />
                <Field 
                  label="Limite d'utilisations" 
                  type="number" 
                  value={String(form.maxUses)} 
                  onChange={(value) => setForm((c) => ({ ...c, maxUses: Number(value) }))} 
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={form.isActive}
                  onChange={(e) => setForm((c) => ({ ...c, isActive: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                />
                <label htmlFor="isActive" className="text-sm font-bold">Code actif</label>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <button className="px-6 py-2.5 rounded-xl border font-bold" onClick={closeModal}>
                Annuler
              </button>
              <button
                className="px-6 py-2.5 rounded-xl text-white font-bold disabled:opacity-50"
                style={{ background: "var(--gradient-hero)" }}
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending || !form.code}
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
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
        style={{ borderColor: "hsl(var(--border))" }}
      />
    </div>
  );
}
