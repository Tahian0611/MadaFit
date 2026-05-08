import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Mail, Loader2 } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import logoImg from "@/assets/madafit-logo.png";
import fondImg from "@/assets/fond.jpg";

export default function Login() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const user = await api.auth.login({ email: form.email, password: form.password });

      const roles: string[] = user.roles || [];

      // Admin OU Accueil (ROLE_RECEPTION) peuvent accéder au dashboard
      const hasAccess =
        roles.includes("ROLE_ADMIN") || roles.includes("ROLE_RECEPTION");

      if (!hasAccess) {
        toast.error("Accès refusé : ce compte n'est pas autorisé à accéder au tableau de bord.");
        api.auth.logout();
        setLoading(false);
        return;
      }

      toast.success(`Bienvenue, ${user.firstName || "utilisateur"} !`);
      navigate("/");
    } catch (error: unknown) {
      if (error instanceof Error) {
        toast.error(error.message);
      } else {
        toast.error("Erreur de connexion");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <div
        className="absolute inset-0 z-0"
        style={{ backgroundImage: `url(${fondImg})`, backgroundSize: "cover", backgroundPosition: "center" }}
      />
      <div className="absolute inset-0 z-0 bg-black/60" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary mb-4">
            <img src={logoImg} alt="logo" />
          </div>
          <h1 className="text-3xl text-white font-black tracking-tight">MadaFit Admin</h1>
          <p className="text-muted-foreground text-white mt-2">
            Connectez-vous pour gérer votre salle
          </p>
        </div>

        <div className="bg-card rounded-3xl border border-border p-8 shadow-xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="admin@madafit.mg"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground ml-1">
                Mot de passe
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
                <input
                  type="password"
                  required
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-xl text-white font-bold bg-primary hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/20"
              style={{ background: "var(--gradient-hero)" }}
            >
              {loading ? <Loader2 className="animate-spin" size={20} /> : "Se connecter"}
            </button>
          </form>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          © {new Date().getFullYear()} MadaFit Officiel. Tous droits réservés.
        </p>
      </div>
    </div>
  );
}