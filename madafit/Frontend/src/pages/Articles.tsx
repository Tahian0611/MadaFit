import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus, Trash2, Pencil, Eye, EyeOff, Newspaper, X, Loader2, Calendar, Upload,
} from "lucide-react";
import api, { uploadImage, getFullImageUrl } from "@/services/api";
import { extractHydraMembers } from "@/lib/madafit";
import type { Article, ArticleCategory } from "@/types/entities";

const CATEGORIES: { value: ArticleCategory; label: string; color: string }[] = [
  { value: "news",  label: "Actualité",  color: "bg-blue-500/10 text-blue-600"     },
  { value: "promo", label: "Promotion",  color: "bg-emerald-500/10 text-emerald-600" },
  { value: "event", label: "Événement",  color: "bg-purple-500/10 text-purple-600"  },
  { value: "tips",  label: "Conseil",    color: "bg-amber-500/10 text-amber-600"    },
];

const CATEGORY_MAP = Object.fromEntries(
  CATEGORIES.map((c) => [c.value, { label: c.label, color: c.color }])
);

const EMPTY_FORM: Partial<Article> = {
  title:       "",
  content:     "",
  imageUrl:    "",
  category:    "news",
  isPublished: true,
};

export default function Articles() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen]       = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId]   = useState<number | null>(null);
  const [form, setForm]           = useState<Partial<Article>>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);

  // ── Query ──────────────────────────────────────────────────────────────────
  const articlesQuery = useQuery({
    queryKey: ["articles"],
    queryFn: () => api.articles.getAll({ itemsPerPage: 100, order: { createdAt: "desc" } }),
  });

  const articles  = extractHydraMembers<Article>(articlesQuery.data);
  const published = articles.filter((a) => a.isPublished).length;

  // ── Mutations ──────────────────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => {
      if (!form.title?.trim())   throw new Error("Le titre est obligatoire");
      if (!form.content?.trim()) throw new Error("Le contenu est obligatoire");
      const payload: Partial<Article> = {
        title:       form.title.trim(),
        content:     form.content.trim(),
        imageUrl:    form.imageUrl?.trim() || null,
        category:    form.category || "news",
        isPublished: form.isPublished || false,
      };
      return editingId
        ? api.articles.update(editingId, payload)
        : api.articles.create(payload);
    },
    onSuccess: () => {
      toast.success(editingId ? "Article mis à jour" : "Article créé");
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      closeModal();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, isPublished }: { id: number; isPublished: boolean }) =>
      api.articles.update(id, { isPublished }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["articles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.articles.delete(id),
    onSuccess: () => {
      toast.success("Article supprimé");
      queryClient.invalidateQueries({ queryKey: ["articles"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ── Handlers ───────────────────────────────────────────────────────────────
  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setIsOpen(true);
  };

  const openEdit = (article: Article) => {
    setEditingId(article.id!);
    setForm({
      title:       article.title,
      content:     article.content,
      imageUrl:    article.imageUrl || "",
      category:    article.category || "news",
      isPublished: article.isPublished,
    });
    setIsOpen(true);
  };

  const closeModal = () => {
    setIsOpen(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
  };

  // ── Upload fichier ─────────────────────────────────────────────────────────
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const url = await uploadImage(file);
      setForm((f) => ({ ...f, imageUrl: url }));
      toast.success("Image uploadée avec succès");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(false);
      // Reset l'input pour permettre de re-sélectionner le même fichier
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="page-header mb-0">
          <h1 className="page-title flex items-center gap-2">
            <Newspaper size={22} className="text-primary" /> Articles & Actualités
          </h1>
          <p className="page-subtitle">
            Contenus visibles dans l'application mobile —{" "}
            {published} publié{published > 1 ? "s" : ""} sur {articles.length}
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 flex-shrink-0"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
        >
          <Plus size={16} /> Nouvel article
        </button>
      </div>

      {/* Stats catégories */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const count = articles.filter((a) => a.category === cat.value).length;
          return (
            <div key={cat.value} className="stat-card">
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold mb-2 ${cat.color}`}>
                {cat.label}
              </span>
              <p className="text-2xl font-black text-foreground">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Grille d'articles */}
      {articlesQuery.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={28} className="animate-spin text-muted-foreground" />
        </div>
      ) : articlesQuery.isError ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center bg-destructive/5 rounded-2xl border border-dashed border-destructive/20"
        >
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
            <X size={28} className="text-destructive" />
          </div>
          <p className="text-lg font-bold text-destructive">Erreur de chargement</p>
          <p className="text-sm text-muted-foreground/60 mt-1 max-w-xs mx-auto">
            {articlesQuery.error instanceof Error ? articlesQuery.error.message : "Impossible de récupérer les articles."}
          </p>
          <button
            onClick={() => articlesQuery.refetch()}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white bg-destructive hover:opacity-90"
          >
            Réessayer
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-20 text-center bg-card rounded-2xl border border-dashed"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Newspaper size={28} className="text-muted-foreground/40" />
          </div>
          <p className="text-lg font-bold text-muted-foreground">Aucun article</p>
          <p className="text-sm text-muted-foreground/60 mt-1">
            Créez votre premier article pour l'afficher dans l'APK
          </p>
          <button
            onClick={openCreate}
            className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
            style={{ background: "var(--gradient-hero)" }}
          >
            <Plus size={14} /> Créer un article
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {articles.map((article) => {
            const catInfo = CATEGORY_MAP[article.category || "news"] || CATEGORY_MAP.news;
            return (
              <div
                key={article.id}
                className="bg-card rounded-2xl border overflow-hidden hover:shadow-lg transition-all group"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                {/* Image */}
                {article.imageUrl ? (
                  <div className="h-40 overflow-hidden bg-muted/20">
                    <img
                      src={getFullImageUrl(article.imageUrl)}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        const container = (e.target as HTMLImageElement).closest(".h-40");
                        if (container) {
                          container.innerHTML =
                            '<div class="h-full flex items-center justify-center text-muted-foreground/30"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242"/><path d="M12 12v9"/><path d="m16 16-4-4-4 4"/></svg></div>';
                        }
                      }}
                    />
                  </div>
                ) : (
                  <div className="h-40 bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                    <Newspaper size={40} className="text-primary/30" />
                  </div>
                )}

                <div className="p-4 space-y-3">
                  {/* Badges */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${catInfo.color}`}>
                      {catInfo.label}
                    </span>
                  </div>

                  {/* Titre */}
                  <h3 className="font-bold text-foreground leading-tight line-clamp-2">
                    {article.title}
                  </h3>

                  {/* Extrait */}
                  <p className="text-xs text-muted-foreground line-clamp-3">{article.content}</p>

                  {/* Date */}
                  {article.createdAt && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                      <Calendar size={10} />
                      {new Date(article.createdAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}

                  {/* Actions */}
                  <div
                    className="flex items-center gap-2 pt-2 border-t"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    <button
                      onClick={() =>
                        toggleMutation.mutate({
                          id: article.id!,
                          isPublished: !article.isPublished,
                        })
                      }
                      disabled={toggleMutation.isPending}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                        article.isPublished
                          ? "bg-muted text-muted-foreground hover:bg-muted/80"
                          : "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      }`}
                    >
                      {article.isPublished ? "Dépublier" : "Publier"}
                    </button>
                    <button
                      onClick={() => openEdit(article)}
                      className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      onClick={() => setDeleteId(article.id!)}
                      className="p-2 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Modal créer / éditer ─────────────────────────────────────────────── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div
            className="w-full h-full sm:h-auto max-w-2xl bg-card rounded-none sm:rounded-2xl border p-6 space-y-4 shadow-2xl sm:my-4 max-h-none sm:max-h-[80dvh] flex flex-col justify-start overflow-y-auto"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-foreground">
                {editingId ? "Modifier l'article" : "Nouvel article"}
              </h2>
              <button
                onClick={closeModal}
                className="text-muted-foreground hover:text-foreground"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Titre */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Titre *</label>
                <input
                  type="text"
                  value={form.title || ""}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Titre de l'article"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
                  style={{ borderColor: "hsl(var(--border))" }}
                />
              </div>

              {/* Catégorie + Statut publié */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Catégorie</label>
                  <select
                    value={form.category || "news"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, category: e.target.value as ArticleCategory }))
                    }
                    className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors"
                    style={{ borderColor: "hsl(var(--border))" }}
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-foreground">Statut</label>
                  <div className="flex items-center gap-3 h-[42px]">
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, isPublished: !f.isPublished }))}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                        form.isPublished ? "bg-primary" : "bg-muted"
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          form.isPublished ? "translate-x-6" : "translate-x-1"
                        }`}
                      />
                    </button>
                    <span className="text-sm font-medium">
                      {form.isPublished ? "Publié (visible APK)" : "Brouillon (caché)"}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Image : upload fichier OU saisie URL ────────────────────── */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground">
                  Image (optionnel)
                </label>

                {/* Bouton upload + champ URL */}
                <div className="flex gap-2">
                  {/* Champ URL */}
                  <input
                    type="url"
                    value={form.imageUrl || ""}
                    onChange={(e) => setForm((f) => ({ ...f, imageUrl: e.target.value }))}
                    placeholder="https://exemple.com/image.jpg"
                    className="flex-1 px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors min-w-0"
                    style={{ borderColor: "hsl(var(--border))" }}
                  />

                  {/* Bouton upload fichier */}
                  <label
                    className={`inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-semibold cursor-pointer transition-all select-none flex-shrink-0 ${
                      uploading
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-muted active:scale-95"
                    }`}
                    style={{ borderColor: "hsl(var(--border))" }}
                    title="Uploader une image depuis votre appareil"
                  >
                    {uploading ? (
                      <>
                        <Loader2 size={15} className="animate-spin text-primary" />
                        <span className="text-xs hidden sm:inline">Upload...</span>
                      </>
                    ) : (
                      <>
                        <Upload size={15} className="text-primary" />
                        <span className="text-xs hidden sm:inline">Uploader</span>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleFileChange}
                    />
                  </label>
                </div>

                <p className="text-[10px] text-muted-foreground">
                  Collez une URL ou uploadez un fichier (JPEG, PNG, GIF, WebP — max 5 Mo)
                </p>

                {/* Aperçu image */}
                {form.imageUrl && (
                  <div className="relative">
                    <img
                      src={getFullImageUrl(form.imageUrl)}
                      alt="Aperçu"
                      className="h-32 w-full object-cover rounded-lg border"
                      style={{ borderColor: "hsl(var(--border))" }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, imageUrl: "" }))}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                      title="Supprimer l'image"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Contenu */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Contenu *</label>
                <textarea
                  value={form.content || ""}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  placeholder="Rédigez votre article ici..."
                  rows={8}
                  className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary transition-colors resize-none"
                  style={{ borderColor: "hsl(var(--border))" }}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {(form.content || "").length} caractères
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeModal}
                className="px-4 py-2.5 rounded-xl border text-sm font-semibold hover:bg-muted transition-colors"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                Annuler
              </button>
              <button
                onClick={() => saveMutation.mutate()}
                disabled={
                  saveMutation.isPending ||
                  uploading ||
                  !form.title?.trim() ||
                  !form.content?.trim()
                }
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50 hover:opacity-90"
                style={{ background: "var(--gradient-hero)" }}
              >
                {saveMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <Plus size={14} />
                )}
                {saveMutation.isPending
                  ? "Enregistrement..."
                  : editingId
                  ? "Mettre à jour"
                  : "Créer l'article"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal suppression ────────────────────────────────────────────────── */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm">
          <div
            className="w-full h-full sm:h-auto max-w-sm bg-card rounded-none sm:rounded-2xl border p-6 text-center shadow-2xl flex flex-col justify-center sm:block overflow-y-auto"
            style={{ borderColor: "hsl(var(--border))" }}
          >
            <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <Trash2 size={24} className="text-destructive" />
            </div>
            <h3 className="font-bold text-foreground mb-2">Supprimer cet article ?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Cette action est irréversible. L'article ne sera plus visible dans l'APK.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="py-2.5 rounded-xl border font-semibold text-sm hover:bg-muted transition-colors"
                style={{ borderColor: "hsl(var(--border))" }}
              >
                Annuler
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                disabled={deleteMutation.isPending}
                className="py-2.5 rounded-xl bg-destructive text-white font-semibold text-sm disabled:opacity-50 hover:bg-destructive/90"
              >
                {deleteMutation.isPending ? "Suppression..." : "Supprimer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}