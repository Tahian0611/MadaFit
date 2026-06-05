import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, CalendarCheck, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import { useAuth } from "@/hooks/useAuth";
import type { SubscriptionPlan, SubscriptionType } from "@/types/entities";
import {
  ACTIVITY_LABELS,
  SUBSCRIPTION_LABELS,
  extractHydraMembers,
  formatCurrency,
  formatDate,
  normalizeSubscriptionType,
  type ActivityType,
} from "@/lib/madafit";

type FormState = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  activities: ActivityType[];
  subscription: string;
  accessType: "abonnement" | "seance";
};

const initialState: FormState = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  dob: "",
  activities: [],
  subscription: "",
  accessType: "abonnement",
};

// ── RÈGLES DE VALIDATION ────────────────────────────────────────────────────
type ValidationErrors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState): ValidationErrors {
  const errors: ValidationErrors = {};

  // ── PRÉNOM ────────────────────────────────────────────────────────────────
  if (!form.firstName.trim())
    errors.firstName = "Le prénom est obligatoire.";
  else if (form.firstName.trim().length < 2)
    errors.firstName = "Minimum 2 caractères.";
  else if (!/^[A-Z][a-zA-ZÀ-ÿ\s'-]*$/.test(form.firstName.trim()))
    errors.firstName = "Le prénom doit commencer par une majuscule (ex: Jean).";

  // ── NOM ───────────────────────────────────────────────────────────────────
  if (!form.lastName.trim())
    errors.lastName = "Le nom est obligatoire.";
  else if (form.lastName.trim().length < 2)
    errors.lastName = "Minimum 2 caractères.";
  else if (!/^[A-Z][a-zA-ZÀ-ÿ\s'-]*$/.test(form.lastName.trim()))
    errors.lastName = "Le nom doit commencer par une majuscule (ex: Dupont).";

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  if (!form.email.trim())
    errors.email = "L'email est obligatoire.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
    errors.email = "Format d'email invalide (ex: nom@domaine.com).";

  // ── TÉLÉPHONE (Format strict Madagascar) ──────────────────────────────────
  // Formats stricts acceptés :
  //   +261 34 00 000 00
  //   034 00 000 00
  // Opérateurs : 032, 033, 034, 037, 038
  // ──────────────────────────────────────────────────────────────────────────
  if (!form.phone.trim())
    errors.phone = "Le téléphone est obligatoire.";
  else if (
    !/^(\+261\s(32|33|34|37|38)\s\d{2}\s\d{3}\s\d{2}|0(32|33|34|37|38)\s\d{2}\s\d{3}\s\d{2})$/.test(
      form.phone.trim()
    )
  )
    errors.phone =
      "Format invalide. Ex: +261 34 00 000 00 ou 034 00 000 00 (opérateurs: 032, 033, 034, 037, 038).";

  // ── DATE DE NAISSANCE ─────────────────────────────────────────────────────
  if (!form.dob)
    errors.dob = "La date de naissance est obligatoire.";
  else {
    const age = Math.floor(
      (Date.now() - new Date(form.dob).getTime()) / (1000 * 60 * 60 * 24 * 365.25)
    );
    if (age < 5) errors.dob = "Âge minimum : 5 ans.";
    if (age > 100) errors.dob = "Date de naissance invalide.";
  }

  // ── ACTIVITÉS ─────────────────────────────────────────────────────────────
  if (!form.activities || form.activities.length === 0)
    errors.activities = "Veuillez choisir au moins une activité.";

  // ── TYPE D'ACCÈS ──────────────────────────────────────────────────────────
  if (!form.accessType)
    errors.accessType = "Veuillez choisir un type d'accès.";

  // ── FORMULE (si abonnement) ───────────────────────────────────────────────
  if (form.accessType === "abonnement" && !form.subscription)
    errors.subscription = "Veuillez choisir une formule.";

  return errors;
}
// ───────────────────────────────────────────────────────────────────────────

export default function Register() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? "caisse2" : "caisse1";
  const [completed, setCompleted] = useState(false);
  const [form, setForm] = useState<FormState>(initialState);
  const [touched, setTouched] = useState<Partial<Record<keyof FormState, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const plansQuery = useQuery({
    queryKey: ["subscription-plans", "register"],
    queryFn: () => api.subscriptionPlans.getAll({ itemsPerPage: 100 }),
  });

  const plans = extractHydraMembers<SubscriptionPlan>(plansQuery.data);

  const selectedPlan = useMemo(
  () => plans.find((plan) => String(plan.id) === form.subscription),
  [form.subscription, plans]
);

  // ── CALCUL AUTOMATIQUE DE LA DATE DE FIN ────────────────────────────────
  const computedDates = useMemo(() => {
    const start = new Date();
    const startStr = start.toISOString().split("T")[0];
    if (form.accessType === "seance" || !selectedPlan?.duration) return { startStr, expiryStr: null };
    const expiry = new Date(start);
    expiry.setMonth(expiry.getMonth() + Number(selectedPlan.duration));
    return { startStr, expiryStr: expiry.toISOString().split("T")[0] };
  }, [selectedPlan, form.accessType]);
  // ────────────────────────────────────────────────────────────────────────

  // Erreurs en temps réel
  const errors = useMemo(() => validate(form), [form]);
  const isValid = Object.keys(errors).length === 0;

  // Marque un champ comme "touché" pour afficher son erreur
  const touch = (field: keyof FormState) =>
    setTouched((prev) => ({ ...prev, [field]: true }));

  // Affiche l'erreur si le champ a été touché OU si soumission tentée
  const getError = (field: keyof FormState): string | undefined =>
    (touched[field] || submitAttempted) ? errors[field] : undefined;

  // ── GESTION MULTI-ACTIVITÉS ─────────────────────────────────────────────
  function toggleActivity(activity: ActivityType) {
    setForm((c) => {
      const exists = c.activities.includes(activity);
      const newActivities = exists
        ? c.activities.filter((a) => a !== activity)
        : [...c.activities, activity];
      return { ...c, activities: newActivities };
    });
    touch("activities");
  }
  // ────────────────────────────────────────────────────────────────────────

  // ── AUTO-FORMATAGE TÉLÉPHONE MADAGASCAR ─────────────────────────────────
  function formatPhoneInput(value: string): string {
    // Autorise uniquement les chiffres et un seul "+" au début
    let cleaned = "";
    let hasPlus = false;
    
    for (let i = 0; i < value.length; i++) {
      const char = value[i];
      if (char === "+" && i === 0 && !hasPlus) {
        hasPlus = true;
        cleaned += char;
      } else if (/\d/.test(char)) {
        cleaned += char;
      }
      // Ignore tout le reste (lettres, symboles, espaces)
    }

    const digits = cleaned.replace(/\D/g, "");
    
    // Format international : +261 XX XXX XX
    if (hasPlus || (digits.length > 3 && digits.startsWith("261"))) {
      const rest = hasPlus ? digits.slice(3) : digits.slice(3);
      if (rest.length === 0) return hasPlus ? "+261" : digits;
      const op = rest.slice(0, 2);
      const p1 = rest.slice(2, 4);
      const p2 = rest.slice(4, 7);
      const p3 = rest.slice(7, 9);
      let formatted = `+261 ${op}`;
      if (p1) formatted += ` ${p1}`;
      if (p2) formatted += ` ${p2}`;
      if (p3) formatted += ` ${p3}`;
      return formatted.trim();
    }
    
    // Format local : 0XX XXX XX
    const op = digits.slice(0, 3);
    const rest = digits.slice(3);
    if (op.length < 3) return op;
    const p1 = rest.slice(0, 2);
    const p2 = rest.slice(2, 5);
    const p3 = rest.slice(5, 7);
    let formatted = `${op}`;
    if (p1) formatted += ` ${p1}`;
    if (p2) formatted += ` ${p2}`;
    if (p3) formatted += ` ${p3}`;
    return formatted.trim();
  }

  function handlePhoneChange(rawValue: string) {
    // Si l'utilisateur efface, recalcule proprement
    if (rawValue.length < form.phone.length) {
      const cleaned = rawValue.replace(/[^\d+]/g, "");
      setForm((c) => ({ ...c, phone: formatPhoneInput(cleaned) }));
    } else {
      setForm((c) => ({ ...c, phone: formatPhoneInput(rawValue) }));
    }
    touch("phone");
  }
  // ────────────────────────────────────────────────────────────────────────

  const createMutation = useMutation({
    mutationFn: async () => {
      const createdUser = await api.users.create({
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim(),
        dob: form.dob || undefined,
        password: Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-2).toUpperCase() + "!",
        roles: ["ROLE_USER"],
        status: "pending", // Modification : Toujours mettre en attente de validation
        memberId: `MF-${Date.now().toString().slice(-6)}`,
        rfidCard: `RF${Date.now().toString().slice(-6)}`,
        subscription: (form.accessType === "abonnement" && selectedPlan ? normalizeSubscriptionType(selectedPlan.type) : "monthly") as SubscriptionType,
        activities: form.activities,
        activity: form.activities[0] ?? null,
        accessType: form.accessType,
        joinDate: computedDates.startStr,
        startDate: computedDates.startStr,
        expiryDate: computedDates.expiryStr ?? undefined,
        totalPayments: 0, // Initialement à 0, sera mis à jour lors de la validation du paiement
      });

      return createdUser;
    },
    onSuccess: () => {
      toast.success("Membre créé en base");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["payments"] });
      refreshNotifications();
      setCompleted(true);
      setForm(initialState);
      setTouched({});
      setSubmitAttempted(false);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = () => {
    setSubmitAttempted(true);
    if (!isValid) {
      toast.error("Veuillez corriger les erreurs avant de continuer.");
      return;
    }
    createMutation.mutate();
  };

  if (completed) {
    return (
      <div className="w-full max-w-xl mx-auto mt-10 text-center space-y-6 px-4">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto"
          style={{ background: "hsl(var(--accent) / 0.15)" }}
        >
          <CheckCircle2 size={40} className="text-accent" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">Inscription réussie</h2>
          <p className="text-muted-foreground mt-2">
            Le membre a été enregistré via l'API Symfony.
          </p>
        </div>
        <button
          className="w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-semibold text-white"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
          onClick={() => setCompleted(false)}
        >
          Enregistrer un autre membre
        </button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-2 sm:px-4 lg:px-0 pb-10">
      <div className="page-header">
        <h1 className="page-title">Inscription Nouveau Membre</h1>
        <p className="page-subtitle">Création directe dans le backend API Platform</p>
      </div>

      {submitAttempted && !isValid && (
        <div className="flex items-start gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/5">
          <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
          <p className="text-sm text-destructive font-medium">
            {Object.keys(errors).length} champ{Object.keys(errors).length > 1 ? "s" : ""} à corriger avant de valider.
          </p>
        </div>
      )}

      <div
        className="bg-card rounded-2xl border p-4 sm:p-6 space-y-6"
        style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}
      >
        {/* Section : Informations personnelles */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Informations personnelles
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field
              label="Prénom"
              required
              value={form.firstName}
              error={getError("firstName")}
              onChange={(value) => setForm((c) => ({ ...c, firstName: value }))}
              onBlur={() => touch("firstName")}
            />
            <Field
              label="Nom"
              required
              value={form.lastName}
              error={getError("lastName")}
              onChange={(value) => setForm((c) => ({ ...c, lastName: value }))}
              onBlur={() => touch("lastName")}
            />
            <Field
              label="Email"
              type="email"
              required
              placeholder="nom@domaine.com"
              value={form.email}
              error={getError("email")}
              onChange={(value) => setForm((c) => ({ ...c, email: value }))}
              onBlur={() => touch("email")}
            />
            {/* ═══════════════════════════════════════════════════════════════════
                CHAMP TÉLÉPHONE AVEC AUTO-FORMATAGE MADAGASCAR
                ═══════════════════════════════════════════════════════════════════ */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Téléphone <span className="text-destructive">*</span>
              </label>
              <input
                type="tel"
                value={form.phone}
                placeholder="+261 34 00 000 00"
                onChange={(e) => handlePhoneChange(e.target.value)}
                onBlur={() => touch("phone")}
                maxLength={17}
                className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors ${
                  getError("phone") ? "border-destructive bg-destructive/5" : ""
                }`}
                style={{ borderColor: getError("phone") ? undefined : "hsl(var(--border))" }}
              />
              {getError("phone") && <ErrorMsg message={getError("phone")!} />}
            </div>
            {/* ═══════════════════════════════════════════════════════════════════ */}
            <Field
              label="Date de naissance"
              type="date"
              required
              value={form.dob}
              error={getError("dob")}
              onChange={(value) => setForm((c) => ({ ...c, dob: value }))}
              onBlur={() => touch("dob")}
            />
            
            {/* ═══════════════════════════════════════════════════════════════
                INJECTION : Champ Activités multi-sélection (checkboxes)
                ═══════════════════════════════════════════════════════════════ */}
            <div className="space-y-1.5 sm:col-span-2">
              <label className="text-xs font-semibold text-foreground">
                Activités <span className="text-destructive">*</span>
              </label>
              <div className={`grid grid-cols-2 sm:grid-cols-3 gap-2 p-3 rounded-lg border bg-card ${
                getError("activities") ? "border-destructive" : ""
              }`} style={{ borderColor: getError("activities") ? undefined : "hsl(var(--border))" }}>
                {Object.entries(ACTIVITY_LABELS).map(([value, label]) => {
                  const isSelected = form.activities.includes(value as ActivityType);
                  return (
                    <label
                      key={value}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary/30 text-primary"
                          : "bg-card border-border/50 text-muted-foreground hover:border-muted-foreground/30"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleActivity(value as ActivityType)}
                        className="w-4 h-4 rounded border-primary text-primary focus:ring-primary/20"
                      />
                      <span className="text-xs font-medium">{label}</span>
                    </label>
                  );
                })}
              </div>
              {getError("activities") && <ErrorMsg message={getError("activities")!} />}
            </div>
            {/* ═══════════════════════════════════════════════════════════════ */}
          </div>
        </div>

        {/* Section : Abonnement */}
        <div>
          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">
            Type de passage
          </p>
          <div className={`grid grid-cols-1 ${form.accessType === "abonnement" ? "sm:grid-cols-2" : "sm:grid-cols-1"} gap-4`}>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Type d'accès <span className="text-destructive">*</span>
              </label>
              <select
                value={form.accessType}
                onChange={(e) => {
                  const val = e.target.value as "abonnement" | "seance";
                  setForm((c) => ({ ...c, accessType: val, subscription: val === "seance" ? "" : c.subscription }));
                  touch("accessType");
                }}
                onBlur={() => touch("accessType")}
                className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <option value="abonnement">Abonnement</option>
                <option value="seance">Séance simple</option>
              </select>
              {getError("accessType") && <ErrorMsg message={getError("accessType")!} />}
            </div>

            {/* Condition : Formule affichée seulement si abonnement */}
            {form.accessType === "abonnement" && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Formule <span className="text-destructive">*</span>
                </label>
                <select
                  value={form.subscription} // ← PLUS DE FALLBACK ICI
                  onChange={(e) => {
                    setForm((c) => ({ ...c, subscription: e.target.value }));
                    touch("subscription");
                  }}
                  onBlur={() => touch("subscription")}
                  className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors ${
                    getError("subscription") ? "border-destructive" : ""
                  }`}
                  style={{ borderColor: getError("subscription") ? undefined : "hsl(var(--border))" }}
                >
                  <option value="" disabled>— Choisir une formule —</option>
                  {plans.map((plan) => (
                    <option key={plan.id} value={String(plan.id)}>
                      {plan.name} — {formatCurrency(plan.price)}
                    </option>
                  ))}
                </select>
                {getError("subscription") && <ErrorMsg message={getError("subscription")!} />}
              </div>
            )}
          </div>
        </div>

        {/* ── RÉCAPITULATIF : Affiché seulement si abonnement ET plan sélectionné ── */}
        {form.accessType === "abonnement" && selectedPlan && (
          <div
            className="rounded-xl border p-4 space-y-3"
            style={{
              background: "hsl(var(--primary) / 0.06)",
              borderColor: "hsl(var(--primary) / 0.2)",
            }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="font-semibold text-foreground">
                  {SUBSCRIPTION_LABELS[normalizeSubscriptionType(selectedPlan.type)]}
                </p>
                <p className="text-xs text-muted-foreground">{selectedPlan.duration} mois</p>
              </div>
              <p className="text-xl font-black text-primary">{formatCurrency(selectedPlan.price)}</p>
            </div>
            <div
              className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t"
              style={{ borderColor: "hsl(var(--primary) / 0.15)" }}
            >
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-card border"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <CalendarCheck size={16} className="text-primary shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Date de début</p>
                  <p className="text-sm font-black text-foreground">
                    {formatDate(computedDates.startStr)}
                  </p>
                </div>
              </div>
              <div
                className="flex items-center gap-3 p-3 rounded-lg bg-card border"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <CalendarCheck size={16} className="text-primary shrink-0" />
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase">Date de fin</p>
                  <p className="text-sm font-black text-foreground">
                    {computedDates.expiryStr ? formatDate(computedDates.expiryStr) : "—"}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bouton soumission */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <p className="text-[11px] text-muted-foreground">
            <span className="text-destructive font-bold">*</span> Champs obligatoires
          </p>
          <button
            onClick={handleSubmit}
            disabled={createMutation.isPending}
            className="w-full sm:w-auto px-8 py-3 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
          >
            {createMutation.isPending ? "Création en cours..." : "Valider l'inscription"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── COMPOSANTS UTILITAIRES ──────────────────────────────────────────────────

function ErrorMsg({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-destructive mt-1 font-medium">
      <AlertCircle size={11} className="shrink-0" />
      {message}
    </p>
  );
}

function Field({
  label,
  type = "text",
  value,
  onChange,
  onBlur,
  error,
  required,
  placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  error?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">
        {label} {required && <span className="text-destructive">*</span>}
      </label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className={`w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors ${
          error ? "border-destructive bg-destructive/5" : ""
        }`}
        style={{ borderColor: error ? undefined : "hsl(var(--border))" }}
      />
      {error && <ErrorMsg message={error} />}
    </div>
  );
}
