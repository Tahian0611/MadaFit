import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import jsPDF from "jspdf";
import api from "@/services/api";
import {
  extractHydraMembers,
  formatCurrency,
  normalizeMemberStatus,
  getFullName,
} from "@/lib/madafit";
import {
  Settings as SettingsIcon,
  User as UserIcon,
  Shield,
  Palette,
  Bell,
  Database,
  Lock,
  ChevronRight,
  Save,
  Eye,
  EyeOff,
  Download,
  FileText,
  CheckCircle2,
  XCircle,
  Pencil,
  Loader2,
  Moon,
  Sun,
  Check,
  X,
} from "lucide-react";

// ─── Initialisation thème/dark-mode au chargement du module ───────────────────
// App.tsx importe Settings directement (non lazy) → ce code s'exécute au démarrage
function applyThemeVars(theme: string): void {
  const map: Record<string, string> = {
    default: "10 85% 47%",
    blue:    "220 70% 55%",
    purple:  "270 60% 50%",
  };
  document.documentElement.style.setProperty("--primary", map[theme] || map.default);
}

void (() => {
  if (typeof window === "undefined") return;
  const dark = localStorage.getItem("madafit_dark_mode") === "true";
  document.documentElement.classList.toggle("dark", dark);
  applyThemeVars(localStorage.getItem("madafit_theme") || "default");
})();

// ─── Constantes ───────────────────────────────────────────────────────────────

const SECTIONS = [
  { id: "profile",                label: "Profil",               icon: UserIcon  },
  { id: "users",                  label: "Gestion des accès",    icon: Shield    },
  { id: "appearance",             label: "Apparence",            icon: Palette   },
  { id: "notifications_settings", label: "Notifications",        icon: Bell      },
  { id: "backup",                 label: "Sauvegarde & Données", icon: Database  },
  { id: "security",               label: "Sécurité",             icon: Lock      },
];

const THEMES = [
  { id: "default", name: "Rouge MadaFit", primary: "#E53E2A", desc: "Thème original"  },
  { id: "blue",    name: "Bleu Sport",    primary: "#3B82F6", desc: "Professionnel"    },
  { id: "purple",  name: "Violet Premium", primary: "#8B5CF6", desc: "Élégant"        },
];

// Ce qu'un accueil peut accéder
const ACCESS_MATRIX = [
  { label: "Tableau de bord",  accueil: true  },
  { label: "Membres",          accueil: false },
  { label: "Inscription",      accueil: true  },
  { label: "Contrôle d'accès", accueil: true  },
  { label: "Offres",           accueil: false },
  { label: "Abonnements",      accueil: false },
  { label: "Produits",         accueil: false },
  { label: "Mouvements",       accueil: false },
  { label: "Stock",            accueil: false },
  { label: "Rapports",         accueil: false },
  { label: "Historique",       accueil: false },
  { label: "Notifications",    accueil: true  },
  { label: "Paramètres",       accueil: false },
];

const DEFAULT_NOTIF = {
  alertJ7:        true,
  alertJ3:        true,
  alertJ1:        true,
  paymentConfirm: true,
  notifEmail:     "",
};

// ─── Helper CSV ───────────────────────────────────────────────────────────────
function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv =
    "\uFEFF" +
    [headers.map(esc).join(";"), ...rows.map((r) => r.map(esc).join(";"))].join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ─── Composant principal ──────────────────────────────────────────────────────
export default function Settings() {
  const queryClient = useQueryClient();
  const [activeSection, setActiveSection] = useState("profile");

  // ── Queries ────────────────────────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
  });
  const paymentsQuery = useQuery({
    queryKey: ["payments"],
    queryFn: () => api.payments.getAll({ itemsPerPage: 1000 }),
  });
  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 1000 }),
  });
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 100 }),
  });

  const users      = extractHydraMembers(usersQuery.data);
  const payments   = extractHydraMembers(paymentsQuery.data);
  const attendance = extractHydraMembers(attendanceQuery.data);
  const products   = extractHydraMembers(productsQuery.data);

  // ── Utilisateur courant ────────────────────────────────────────────────────
  const sessionUser = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("madafit_user") || "{}"); }
    catch { return {}; }
  }, []);

  const isAdmin = sessionUser?.roles?.includes("ROLE_ADMIN") ?? false;
  const currentUserFromDB = users.find((u) => u.email === sessionUser?.email);

  // ── Profil ─────────────────────────────────────────────────────────────────
  const gymSettings = useMemo(() => {
    try { return JSON.parse(localStorage.getItem("madafit_gym_settings") || "{}"); }
    catch { return {}; }
  }, []);

  const [profileForm, setProfileForm] = useState({
    firstName:  "",
    lastName:   "",
    phone:      "",
    gymName:    gymSettings.gymName    || "MadaFit",
    gymAddress: gymSettings.gymAddress || "",
    gymPhone:   gymSettings.gymPhone   || "",
  });

  useEffect(() => {
    if (currentUserFromDB) {
      setProfileForm((prev) => ({
        ...prev,
        firstName: currentUserFromDB.firstName || "",
        lastName:  currentUserFromDB.lastName  || "",
        phone:     currentUserFromDB.phone     || "",
      }));
    }
  }, [currentUserFromDB?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const profileMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserFromDB?.id) throw new Error("Utilisateur introuvable");
      await api.users.update(currentUserFromDB.id, {
        firstName: profileForm.firstName,
        lastName:  profileForm.lastName,
        phone:     profileForm.phone,
      });
      localStorage.setItem(
        "madafit_gym_settings",
        JSON.stringify({
          gymName:    profileForm.gymName,
          gymAddress: profileForm.gymAddress,
          gymPhone:   profileForm.gymPhone,
        })
      );
    },
    onSuccess: () => {
      toast.success("Profil mis à jour");
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Gestion des accès ──────────────────────────────────────────────────────
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editRole, setEditRole] = useState<"admin" | "accueil">("accueil");

  const roleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: number; role: "admin" | "accueil" }) =>
      api.users.update(userId, {
        roles: role === "admin" ? ["ROLE_ADMIN", "ROLE_USER"] : ["ROLE_USER"],
      }),
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      queryClient.invalidateQueries({ queryKey: ["users"] });
      setEditingUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Apparence ──────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(
    () => localStorage.getItem("madafit_dark_mode") === "true"
  );
  const [selectedTheme, setSelectedTheme] = useState(
    () => localStorage.getItem("madafit_theme") || "default"
  );

  const toggleDark = (enabled: boolean) => {
    document.documentElement.classList.toggle("dark", enabled);
    localStorage.setItem("madafit_dark_mode", String(enabled));
    setDarkMode(enabled);
  };

  const changeTheme = (theme: string) => {
    applyThemeVars(theme);
    localStorage.setItem("madafit_theme", theme);
    setSelectedTheme(theme);
    toast.success("Thème appliqué");
  };

  // ── Notifications ──────────────────────────────────────────────────────────
  const [notifSettings, setNotifSettings] = useState<typeof DEFAULT_NOTIF>(() => {
    try {
      return JSON.parse(localStorage.getItem("madafit_notif_settings") || "null") || DEFAULT_NOTIF;
    } catch { return DEFAULT_NOTIF; }
  });

  const saveNotifSettings = () => {
    localStorage.setItem("madafit_notif_settings", JSON.stringify(notifSettings));
    toast.success("Préférences de notification enregistrées");
  };

  // ── Sécurité ───────────────────────────────────────────────────────────────
  const [showCurrent, setShowCurrent]   = useState(false);
  const [showNew, setShowNew]           = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "", confirm: "" });

  const [loginLog, setLoginLog] = useState<{ date: string; device: string; current: boolean }[]>([]);

  useEffect(() => {
    const existing: any[] = JSON.parse(localStorage.getItem("madafit_login_log") || "[]");
    const now = Date.now();
    if (!existing.length || now - new Date(existing[0].date).getTime() > 5 * 60 * 1000) {
      const ua = navigator.userAgent;
      const device = ua.includes("Chrome") ? "Chrome" : ua.includes("Firefox") ? "Firefox" : ua.includes("Safari") ? "Safari" : "Navigateur";
      const updated = [
        { date: new Date().toISOString(), device, current: true },
        ...existing.map((e) => ({ ...e, current: false })),
      ].slice(0, 5);
      localStorage.setItem("madafit_login_log", JSON.stringify(updated));
      setLoginLog(updated);
    } else {
      setLoginLog(existing);
    }
  }, []);

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (!currentUserFromDB?.id) throw new Error("Utilisateur introuvable");
      if (pwdForm.next.length < 6)             throw new Error("Minimum 6 caractères requis");
      if (pwdForm.next !== pwdForm.confirm)     throw new Error("Les mots de passe ne correspondent pas");
      return api.users.update(currentUserFromDB.id, { password: pwdForm.next });
    },
    onSuccess: () => {
      toast.success("Mot de passe modifié avec succès");
      setPwdForm({ current: "", next: "", confirm: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Stats Sauvegarde ───────────────────────────────────────────────────────
  const now6m = new Date();
  const sixMonthsAgo = new Date(now6m.getFullYear(), now6m.getMonth() - 6, 1);
  const totalRevenue6m = payments
    .filter((p) => new Date(p.date) >= sixMonthsAgo)
    .reduce((s, p) => s + (p.amount ?? 0), 0);
  const activeCount = users.filter((u) => normalizeMemberStatus(u.status) === "active").length;
  const today = new Date().toISOString().split("T")[0];

  // ── Exports ────────────────────────────────────────────────────────────────
  const exportMembres = () => {
    if (!users.length) { toast.error("Aucun membre à exporter"); return; }
    downloadCSV(`membres_${today}.csv`,
      ["ID Membre", "Prénom", "Nom", "Email", "Téléphone", "Statut", "Abonnement", "Inscription", "Expiration"],
      users.map((u) => [
        u.memberId || "-", u.firstName || "-", u.lastName || "-",
        u.email || "-", u.phone || "-", u.status || "-", u.subscription || "-",
        u.joinDate   ? new Date(u.joinDate).toLocaleDateString("fr-FR")   : "-",
        u.expiryDate ? new Date(u.expiryDate).toLocaleDateString("fr-FR") : "-",
      ])
    );
    toast.success("Export membres réussi");
  };

  const exportPaiements = () => {
    if (!payments.length) { toast.error("Aucun paiement à exporter"); return; }
    downloadCSV(`paiements_${today}.csv`,
      ["ID", "Membre", "Montant (Ar)", "Méthode", "Date", "Abonnement", "N° Reçu"],
      payments.map((p) => [
        p.id || "-", p.memberName || "-", p.amount || 0, p.method || "-",
        p.date ? new Date(p.date).toLocaleDateString("fr-FR") : "-",
        p.subscription || "-", p.receiptNo || "-",
      ])
    );
    toast.success("Export paiements réussi");
  };

  const exportPresences = () => {
    if (!attendance.length) { toast.error("Aucune présence à exporter"); return; }
    downloadCSV(`presences_${today}.csv`,
      ["ID", "Membre", "Date", "Entrée", "Sortie", "RFID"],
      attendance.map((a) => [
        a.id || "-", a.memberName || "-",
        a.date ? new Date(a.date).toLocaleDateString("fr-FR") : "-",
        a.checkIn  ? String(a.checkIn).substring(0, 5)  : "-",
        a.checkOut ? String(a.checkOut).substring(0, 5) : "-",
        a.rfidCard || "-",
      ])
    );
    toast.success("Export présences réussi");
  };

  const exportRapportPDF = () => {
    const pdf = new jsPDF("p", "mm", "a4");
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 15;
    const CW = W - M * 2;
    let y = M;

    // Fix accents pour jsPDF
    const origText = pdf.text.bind(pdf);
    pdf.text = function (...args: any[]) {
      if (typeof args[0] === "string") {
        args[0] = args[0]
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[\u00A0\u202F]/g, " ");
      }
      return origText.apply(pdf, args);
    };

    const C = {
      primary: [220, 53, 69] as [number, number, number],
      dark:    [33, 37, 41]  as [number, number, number],
      gray:    [108, 117, 125] as [number, number, number],
      light:   [248, 249, 250] as [number, number, number],
      white:   [255, 255, 255] as [number, number, number],
      border:  [222, 226, 230] as [number, number, number],
      green:   [40, 167, 69]  as [number, number, number],
      red:     [220, 53, 69]  as [number, number, number],
    };

    // En-tête
    pdf.setTextColor(...C.primary);
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("MADAFIT", M, y);
    pdf.setTextColor(...C.gray);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("Rapport Comptable", M, y + 7);
    pdf.text(`Genere le ${new Date().toLocaleDateString("fr-FR")}`, W - M, y, { align: "right" });
    y += 15;
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.5);
    pdf.line(M, y, W - M, y);
    y += 10;

    // KPIs
    const kpis = [
      { label: "Membres actifs", value: String(activeCount) },
      { label: "CA (6 mois)",    value: `${Math.round(totalRevenue6m).toLocaleString("fr-FR")} Ar` },
      { label: "Paiements",      value: String(payments.length) },
      { label: "Produits",       value: String(products.length) },
    ];
    const kw = (CW - 9) / 4;
    kpis.forEach((k, i) => {
      const x = M + i * (kw + 3);
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.3);
      pdf.roundedRect(x, y, kw, 18, 2, 2, "S");
      pdf.setTextColor(...C.gray);
      pdf.setFontSize(7);
      pdf.setFont("helvetica", "normal");
      pdf.text(k.label, x + 3, y + 6);
      pdf.setTextColor(...C.dark);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "bold");
      pdf.text(k.value, x + 3, y + 14);
    });
    y += 26;

    // Tableau revenus par mois
    pdf.setTextColor(...C.dark);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text("Revenus des 6 derniers mois", M, y);
    y += 7;

    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const name = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
      const monthPays = payments.filter((p) => {
        const pd = new Date(p.date);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      });
      return {
        name,
        count: monthPays.length,
        revenue: monthPays.reduce((s, p) => s + (p.amount ?? 0), 0),
      };
    });

    const rH = 7;
    // Header
    pdf.setFillColor(...C.primary);
    pdf.rect(M, y, CW, rH, "F");
    pdf.setTextColor(...C.white);
    pdf.setFontSize(8);
    pdf.setFont("helvetica", "bold");
    pdf.text("Mois",          M + 3,          y + 5);
    pdf.text("Nb paiements",  M + CW * 0.55,  y + 5);
    pdf.text("Montant",       M + CW * 0.8,   y + 5);
    y += rH;

    months.forEach((m, idx) => {
      if (idx % 2 === 0) {
        pdf.setFillColor(...C.light);
        pdf.rect(M, y, CW, rH, "F");
      }
      pdf.setDrawColor(...C.border);
      pdf.setLineWidth(0.2);
      pdf.line(M, y + rH, M + CW, y + rH);
      pdf.setTextColor(...C.dark);
      pdf.setFont("helvetica", "normal");
      pdf.text(m.name,               M + 3,         y + 5);
      pdf.text(String(m.count),      M + CW * 0.55, y + 5);
      pdf.text(`${Math.round(m.revenue).toLocaleString("fr-FR")} Ar`, M + CW * 0.8, y + 5);
      y += rH;
    });

    // Ligne total
    pdf.setFillColor(240, 240, 240);
    pdf.rect(M, y, CW, rH, "F");
    pdf.setTextColor(...C.primary);
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL", M + 3, y + 5);
    pdf.text(String(months.reduce((s, m) => s + m.count, 0)), M + CW * 0.55, y + 5);
    pdf.text(`${Math.round(totalRevenue6m).toLocaleString("fr-FR")} Ar`, M + CW * 0.8, y + 5);
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.rect(M, y - months.length * rH - rH, CW, (months.length + 2) * rH);

    // Pied de page
    pdf.setDrawColor(...C.border);
    pdf.setLineWidth(0.3);
    pdf.line(M, H - 12, W - M, H - 12);
    pdf.setTextColor(...C.gray);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.text("MADAFIT - Systeme de gestion de salle de sport", M, H - 6);
    pdf.text(`${new Date().toLocaleDateString("fr-FR")} ${new Date().toLocaleTimeString("fr-FR")}`, W - M, H - 6, { align: "right" });

    pdf.save(`rapport-comptable_${today}.pdf`);
    toast.success("PDF généré avec succès");
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">
      <div className="page-header">
        <h1 className="page-title flex items-center gap-2">
          <SettingsIcon size={22} className="text-primary" /> Paramètres
        </h1>
        <p className="page-subtitle">Configuration et gestion du système MadaFit</p>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">
        {/* ── Sidebar ──────────────────────────────────────────────────────── */}
        <div className="lg:w-60 flex-shrink-0">
          <div
            className="bg-card rounded-xl border overflow-hidden"
            style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}
          >
            {SECTIONS.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              return (
                <button
                  key={section.id}
                  onClick={() => setActiveSection(section.id)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium transition-all border-b last:border-0"
                  style={{
                    borderColor: "hsl(var(--border) / 0.5)",
                    background: isActive ? "hsl(var(--primary) / 0.08)" : "transparent",
                    color: isActive ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                  }}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon size={15} />
                    <span>{section.label}</span>
                  </div>
                  {isActive && <ChevronRight size={14} />}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ──────────────────────────────────────────────────────── */}
        <div className="flex-1 min-w-0">
          <div
            className="bg-card rounded-xl border p-6 space-y-6"
            style={{ borderColor: "hsl(var(--border))", boxShadow: "var(--shadow-md)" }}
          >

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* PROFIL                                                         */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "profile" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Profil"
                  subtitle="Informations de votre compte administrateur"
                />

                {/* Avatar */}
                <div
                  className="flex items-center gap-4 p-4 rounded-xl"
                  style={{ background: "hsl(var(--muted) / 0.4)" }}
                >
                  <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center text-white font-black text-2xl">
                    {(profileForm.firstName || sessionUser?.firstName || "A").charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <p className="font-bold text-foreground">
                      {profileForm.firstName} {profileForm.lastName}
                    </p>
                    <p className="text-sm text-muted-foreground">{sessionUser?.email}</p>
                    <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-primary/10 text-primary">
                      Administrateur
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField label="Prénom" value={profileForm.firstName}
                    onChange={(v) => setProfileForm((f) => ({ ...f, firstName: v }))} />
                  <FormField label="Nom" value={profileForm.lastName}
                    onChange={(v) => setProfileForm((f) => ({ ...f, lastName: v }))} />
                  <FormField label="Email" type="email" value={sessionUser?.email || ""} disabled />
                  <FormField label="Téléphone" value={profileForm.phone}
                    onChange={(v) => setProfileForm((f) => ({ ...f, phone: v }))} />
                </div>

                <div className="border-t pt-4" style={{ borderColor: "hsl(var(--border))" }}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Informations de la salle
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField label="Nom de la salle" value={profileForm.gymName}
                      onChange={(v) => setProfileForm((f) => ({ ...f, gymName: v }))} />
                    <FormField label="Téléphone salle" value={profileForm.gymPhone}
                      onChange={(v) => setProfileForm((f) => ({ ...f, gymPhone: v }))} />
                    <div className="sm:col-span-2">
                      <FormField label="Adresse" value={profileForm.gymAddress}
                        onChange={(v) => setProfileForm((f) => ({ ...f, gymAddress: v }))} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* GESTION DES ACCÈS                                              */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "users" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Gestion des accès utilisateurs"
                  subtitle="Rôles Admin et Accueil uniquement — seul l'admin peut modifier"
                />

                {/* Liste des utilisateurs */}
                <div className="rounded-xl border overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
                  <div className="overflow-x-auto">
                    <table className="data-table">
                      <thead>
                        <tr style={{ background: "hsl(var(--muted) / 0.5)" }}>
                          <th>Utilisateur</th>
                          <th>Rôle</th>
                          <th>Statut</th>
                          {isAdmin && <th>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {usersQuery.isLoading ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-muted-foreground">
                              Chargement...
                            </td>
                          </tr>
                        ) : users.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center py-8 text-muted-foreground">
                              Aucun utilisateur
                            </td>
                          </tr>
                        ) : (
                          users.map((user) => {
                            const userIsAdmin = user.roles?.includes("ROLE_ADMIN");
                            const isSelf = user.email === sessionUser?.email;
                            return (
                              <tr key={user.id}>
                                <td>
                                  <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                      {(user.firstName || user.email || "?").charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-medium text-sm text-foreground">
                                        {getFullName(user)}
                                        {isSelf && (
                                          <span className="ml-1.5 text-[9px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">
                                            Vous
                                          </span>
                                        )}
                                      </p>
                                      <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                  </div>
                                </td>
                                <td>
                                  <span
                                    className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold text-white"
                                    style={{
                                      background: userIsAdmin
                                        ? "hsl(var(--primary))"
                                        : "hsl(220 70% 55%)",
                                    }}
                                  >
                                    {userIsAdmin ? "Administrateur" : "Accueil"}
                                  </span>
                                </td>
                                <td>
                                  <span className={normalizeMemberStatus(user.status) === "active" ? "badge-active" : "badge-suspended"}>
                                    {normalizeMemberStatus(user.status) === "active" ? "Actif" : "Inactif"}
                                  </span>
                                </td>
                                {isAdmin && (
                                  <td>
                                    {!isSelf && (
                                      <button
                                        onClick={() => {
                                          setEditingUser(user);
                                          setEditRole(userIsAdmin ? "admin" : "accueil");
                                        }}
                                        className="px-2 py-1 rounded-lg text-xs font-medium border hover:bg-muted transition-colors inline-flex items-center gap-1"
                                        style={{ borderColor: "hsl(var(--border))" }}
                                      >
                                        <Pencil size={11} /> Modifier
                                      </button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Matrice des accès */}
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{ borderColor: "hsl(var(--border))" }}
                >
                  <h4 className="text-sm font-bold text-foreground">Droits d'accès par rôle</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr>
                          <th className="text-left py-2 pr-4 text-muted-foreground font-semibold w-1/2">
                            Page
                          </th>
                          <th className="py-2 px-3 text-center text-muted-foreground font-semibold">
                            Admin
                          </th>
                          <th className="py-2 px-3 text-center text-muted-foreground font-semibold">
                            Accueil
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/40">
                        {ACCESS_MATRIX.map((item) => (
                          <tr key={item.label}>
                            <td className="py-2 pr-4 font-medium text-foreground">{item.label}</td>
                            <td className="py-2 px-3 text-center">
                              <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                            </td>
                            <td className="py-2 px-3 text-center">
                              {item.accueil ? (
                                <CheckCircle2 size={14} className="text-emerald-500 mx-auto" />
                              ) : (
                                <XCircle size={14} className="text-destructive/40 mx-auto" />
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground italic">
                    * La restriction effective des routes nécessite une configuration supplémentaire dans App.tsx
                  </p>
                </div>

                {/* Modal édition rôle */}
                {editingUser && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
                    <div
                      className="w-full max-w-sm bg-card rounded-2xl border p-6 space-y-4 shadow-2xl"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-bold text-foreground">Modifier le rôle</h3>
                        <button
                          onClick={() => setEditingUser(null)}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <X size={18} />
                        </button>
                      </div>
                      <p className="text-sm text-muted-foreground">{getFullName(editingUser)}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {(["admin", "accueil"] as const).map((role) => (
                          <button
                            key={role}
                            onClick={() => setEditRole(role)}
                            className="p-3 rounded-xl border text-sm font-semibold transition-all"
                            style={{
                              borderColor: editRole === role ? "hsl(var(--primary))" : "hsl(var(--border))",
                              background: editRole === role ? "hsl(var(--primary) / 0.08)" : "transparent",
                              color: editRole === role ? "hsl(var(--primary))" : "hsl(var(--foreground))",
                            }}
                          >
                            {role === "admin" ? "Administrateur" : "Accueil"}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-3 pt-2">
                        <button
                          onClick={() => setEditingUser(null)}
                          className="flex-1 py-2 rounded-xl border text-sm font-semibold"
                          style={{ borderColor: "hsl(var(--border))" }}
                        >
                          Annuler
                        </button>
                        <button
                          onClick={() => roleMutation.mutate({ userId: editingUser.id, role: editRole })}
                          disabled={roleMutation.isPending}
                          className="flex-1 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50"
                          style={{ background: "var(--gradient-hero)" }}
                        >
                          {roleMutation.isPending ? "..." : "Enregistrer"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* APPARENCE                                                      */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "appearance" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Apparence"
                  subtitle="Personnalisez l'interface de MadaFit"
                />

                {/* Thème principal */}
                <div className="space-y-3">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Thème principal
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {THEMES.map((theme) => (
                      <button
                        key={theme.id}
                        onClick={() => changeTheme(theme.id)}
                        className="relative p-4 rounded-xl border-2 text-left transition-all hover:scale-105 active:scale-95"
                        style={{
                          borderColor:
                            selectedTheme === theme.id ? theme.primary : "hsl(var(--border))",
                          background:
                            selectedTheme === theme.id ? `${theme.primary}15` : "transparent",
                        }}
                      >
                        {selectedTheme === theme.id && (
                          <span className="absolute top-2.5 right-2.5">
                            <Check size={14} style={{ color: theme.primary }} />
                          </span>
                        )}
                        <div
                          className="w-8 h-8 rounded-full mb-3 shadow-md"
                          style={{ background: theme.primary }}
                        />
                        <p className="text-sm font-bold text-foreground">{theme.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{theme.desc}</p>
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le thème s'applique immédiatement et est sauvegardé automatiquement.
                  </p>
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* NOTIFICATIONS                                                  */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "notifications_settings" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Paramètres de notifications"
                  subtitle="Configurez les alertes automatiques du système"
                />

                <div className="space-y-2">
                  {[
                    {
                      key: "alertJ7",
                      label: "Alerte expiration J-7",
                      desc: "Notification 7 jours avant l'expiration d'un abonnement",
                    },
                    {
                      key: "alertJ3",
                      label: "Alerte expiration J-3",
                      desc: "Notification 3 jours avant l'expiration d'un abonnement",
                    },
                    {
                      key: "alertJ1",
                      label: "Alerte expiration J-1",
                      desc: "Notification la veille de l'expiration d'un abonnement",
                    },
                    {
                      key: "paymentConfirm",
                      label: "Confirmation de paiement",
                      desc: "Notification après chaque paiement enregistré",
                    },
                  ].map((item) => (
                    <div
                      key={item.key}
                      className="flex items-center justify-between py-3 px-4 rounded-xl border"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div>
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <ToggleSwitch
                        enabled={notifSettings[item.key as keyof typeof notifSettings] as boolean}
                        onChange={(v) =>
                          setNotifSettings((prev) => ({ ...prev, [item.key]: v }))
                        }
                      />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <FormField
                    label="Email de notification"
                    type="email"
                    placeholder="admin@madafit.mg"
                    value={notifSettings.notifEmail}
                    onChange={(v) => setNotifSettings((prev) => ({ ...prev, notifEmail: v }))}
                  />
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SAUVEGARDE & DONNÉES                                           */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "backup" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Sauvegarde & Données"
                  subtitle="Exportez et sauvegardez vos données"
                />

                {/* Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      label: "Total membres",
                      value: usersQuery.isLoading ? "..." : `${users.length} membres`,
                    },
                    {
                      label: "Membres actifs",
                      value: usersQuery.isLoading ? "..." : `${activeCount} actifs`,
                    },
                    {
                      label: "CA 6 mois",
                      value: paymentsQuery.isLoading ? "..." : formatCurrency(totalRevenue6m),
                    },
                  ].map((s) => (
                    <div key={s.label} className="stat-card">
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                      <p className="text-lg font-black text-foreground mt-1">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Boutons d'export */}
                <div className="space-y-3">
                  {[
                    {
                      label: "Exporter membres (CSV)",
                      desc: `${users.length} membres — fiches complètes avec statuts et dates`,
                      icon: Download,
                      action: exportMembres,
                      loading: usersQuery.isLoading,
                    },
                    {
                      label: "Exporter paiements (CSV)",
                      desc: `${payments.length} paiements — historique complet`,
                      icon: Download,
                      action: exportPaiements,
                      loading: paymentsQuery.isLoading,
                    },
                    {
                      label: "Exporter présences (CSV)",
                      desc: `${attendance.length} enregistrements — entrées et sorties`,
                      icon: Download,
                      action: exportPresences,
                      loading: attendanceQuery.isLoading,
                    },
                    {
                      label: "Rapport comptable (PDF)",
                      desc: "Synthèse financière des 6 derniers mois avec KPIs",
                      icon: FileText,
                      action: exportRapportPDF,
                      loading: paymentsQuery.isLoading || usersQuery.isLoading,
                    },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center justify-between p-3.5 rounded-xl border"
                      style={{ borderColor: "hsl(var(--border))" }}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground">{item.desc}</p>
                      </div>
                      <button
                        onClick={item.action}
                        disabled={item.loading}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50"
                        style={{ background: "var(--gradient-hero)" }}
                      >
                        {item.loading ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <item.icon size={12} />
                        )}
                        Exporter
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* SÉCURITÉ                                                       */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {activeSection === "security" && (
              <div className="space-y-5">
                <SectionHeader
                  title="Sécurité"
                  subtitle="Gérez la sécurité de votre compte"
                />

                {/* Changement de mot de passe */}
                <div className="space-y-4">
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    Modifier le mot de passe
                  </p>

                  <PasswordField
                    label="Mot de passe actuel"
                    value={pwdForm.current}
                    onChange={(v) => setPwdForm((f) => ({ ...f, current: v }))}
                    show={showCurrent}
                    onToggle={() => setShowCurrent(!showCurrent)}
                  />
                  <PasswordField
                    label="Nouveau mot de passe"
                    value={pwdForm.next}
                    onChange={(v) => setPwdForm((f) => ({ ...f, next: v }))}
                    show={showNew}
                    onToggle={() => setShowNew(!showNew)}
                  />
                  <PasswordField
                    label="Confirmer le mot de passe"
                    value={pwdForm.confirm}
                    onChange={(v) => setPwdForm((f) => ({ ...f, confirm: v }))}
                    show={showConfirm}
                    onToggle={() => setShowConfirm(!showConfirm)}
                  />

                  {pwdForm.next && pwdForm.next.length < 6 && (
                    <p className="text-xs text-destructive">Minimum 6 caractères requis</p>
                  )}
                  {pwdForm.confirm && pwdForm.next !== pwdForm.confirm && (
                    <p className="text-xs text-destructive">Les mots de passe ne correspondent pas</p>
                  )}

                  <button
                    onClick={() => passwordMutation.mutate()}
                    disabled={
                      passwordMutation.isPending ||
                      !pwdForm.next ||
                      !pwdForm.confirm ||
                      pwdForm.next !== pwdForm.confirm ||
                      pwdForm.next.length < 6
                    }
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-all hover:opacity-90"
                    style={{ background: "var(--gradient-hero)" }}
                  >
                    {passwordMutation.isPending ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Lock size={14} />
                    )}
                    {passwordMutation.isPending ? "Modification..." : "Modifier le mot de passe"}
                  </button>
                </div>

                {/* Journal des connexions */}
                <div className="border-t pt-4" style={{ borderColor: "hsl(var(--border))" }}>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3">
                    Journal des connexions
                  </p>
                  {loginLog.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Aucune connexion enregistrée</p>
                  ) : (
                    <div className="space-y-2">
                      {loginLog.map((log, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2.5 px-3 rounded-lg text-xs"
                          style={{
                            background: log.current
                              ? "hsl(var(--primary) / 0.06)"
                              : "hsl(var(--muted) / 0.3)",
                          }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className={`w-2 h-2 rounded-full ${
                                log.current ? "bg-primary" : "bg-muted-foreground/30"
                              }`}
                            />
                            <span className="font-medium text-foreground">{log.device}</span>
                            {log.current && (
                              <span className="badge-active text-[9px]">Session actuelle</span>
                            )}
                          </div>
                          <span className="text-muted-foreground">
                            {new Date(log.date).toLocaleDateString("fr-FR")} à{" "}
                            {new Date(log.date).toLocaleTimeString("fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Bouton Enregistrer commun (profil + notifications) ─────── */}
            {["profile", "notifications_settings"].includes(activeSection) && (
              <div
                className="flex justify-end pt-4 border-t"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                <button
                  onClick={() => {
                    if (activeSection === "profile") profileMutation.mutate();
                    if (activeSection === "notifications_settings") saveNotifSettings();
                  }}
                  disabled={profileMutation.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-all hover:opacity-90"
                  style={{ background: "var(--gradient-hero)" }}
                >
                  {profileMutation.isPending ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Save size={15} />
                  )}
                  Enregistrer les modifications
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Sous-composants ──────────────────────────────────────────────────────────

function SectionHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="border-b pb-4" style={{ borderColor: "hsl(var(--border))" }}>
      <h2 className="font-bold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>
    </div>
  );
}

function FormField({
  label, type = "text", value, onChange, disabled, placeholder,
}: {
  label: string;
  type?: string;
  value: string;
  onChange?: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        style={{ borderColor: "hsl(var(--border))" }}
      />
    </div>
  );
}

function PasswordField({
  label, value, onChange, show, onToggle,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <div className="relative">
        <input
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          className="w-full px-3 py-2.5 pr-10 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
          style={{ borderColor: "hsl(var(--border))" }}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
        >
          {show ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    </div>
  );
}

function ToggleSwitch({
  enabled, onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      onClick={() => onChange(!enabled)}
      className="relative inline-flex h-5 w-9 items-center rounded-full transition-colors flex-shrink-0"
      style={{ background: enabled ? "hsl(var(--accent))" : "hsl(var(--muted))" }}
    >
      <span
        className="inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: enabled ? "translateX(20px)" : "translateX(2px)" }}
      />
    </button>
  );
}