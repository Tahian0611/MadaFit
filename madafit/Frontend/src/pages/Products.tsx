import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  History, 
  Plus, 
  Trash2, 
  ArrowDownLeft, 
  ArrowUpRight, 
  ShoppingCart, 
  Package, 
  Calendar,
  Banknote,
  StickyNote,
  TrendingUp,
  AlertCircle,
  Loader2,
  Search,
  X,
  Clock
} from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";
import { refreshNotifications } from '@/services/api';
import {
  computeProductMetrics,
  extractHydraMembers,
  extractIdFromIri,
  formatCurrency,
} from "@/lib/madafit";
import type { Product, Transaction } from "@/types/entities";

// ============================================================================
// CONFIGURATION DES TYPES DE TRANSACTION (UI)
// ============================================================================

type TransactionTypeConfig = {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  quantityPrefix: string;
};

const TRANSACTION_CONFIG: Record<string, TransactionTypeConfig> = {
  entry: {
    label: "Approvisionnement",
    icon: ArrowDownLeft,
    color: "text-emerald-600",
    bgColor: "bg-emerald-50",
    borderColor: "border-emerald-200",
    quantityPrefix: "+",
  },
  sale: {
    label: "Vente",
    icon: ShoppingCart,
    color: "text-sky-600",
    bgColor: "bg-sky-50",
    borderColor: "border-sky-200",
    quantityPrefix: "-",
  },
  credit: {
    label: "À Crédit",
    icon: Clock,
    color: "text-amber-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
    quantityPrefix: "-",
  },
  non_sale_exit: {
    label: "Sortie S/E",
    icon: ArrowUpRight,
    color: "text-rose-600",
    bgColor: "bg-rose-50",
    borderColor: "border-rose-200",
    quantityPrefix: "-",
  },
};

// ============================================================================
// FONCTIONS UTILITAIRES POUR L'HISTORIQUE
// ============================================================================

function formatTransactionDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) {
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    if (diffHours === 0) {
      const diffMinutes = Math.floor(diffMs / (1000 * 60));
      return diffMinutes < 1 ? "À l'instant" : `Il y a ${diffMinutes} min`;
    }
    return `Il y a ${diffHours}h`;
  }
  
  if (diffDays === 1) return "Hier";
  if (diffDays < 7) return `Il y a ${diffDays} jours`;
  
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTransactionTotal(transaction: Transaction): number | null {
  if (transaction.unitPrice && transaction.quantity) {
    return transaction.unitPrice * transaction.quantity;
  }
  return null;
}

// ============================================================================
// COMPOSANT PRINCIPAL
// ============================================================================

export default function Products() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: "",
    category: "Boissons",
    purchasePrice: 0,
    salePrice: 0,
    initialStock: 0,
  });

  // -------------------------------------------------------------------------
  // QUERIES
  // -------------------------------------------------------------------------

  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 100 }),
  });

  const transactionsQuery = useQuery({
    queryKey: ["transactions"],
    queryFn: () => api.transactions.getAll({ itemsPerPage: 100 }),
  });

  const products = extractHydraMembers(productsQuery.data);
  const transactions = extractHydraMembers(transactionsQuery.data);

  const metrics = computeProductMetrics(products, transactions);

  // -------------------------------------------------------------------------
  // FILTRAGE DES PRODUITS
  // -------------------------------------------------------------------------

  const filteredProducts = useMemo(() => {
    if (!search.trim()) return products;
    return products.filter((product) =>
      `${product.name} ${product.category}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [products, search]);

  // -------------------------------------------------------------------------
  // MUTATIONS
  // -------------------------------------------------------------------------

  const createMutation = useMutation({
    mutationFn: () =>
      api.products.create({
        name: form.name,
        category: form.category,
        purchasePrice: Number(form.purchasePrice),
        salePrice: Number(form.salePrice),
        initialStock: Number(form.initialStock),
        currentStock: Number(form.initialStock),
        registrationDate: new Date().toISOString().split("T")[0],
      }),
    onSuccess: () => {
      toast.success("Produit ajouté avec succès");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      refreshNotifications();
      setIsOpen(false);
      setForm({ name: "", category: "Boissons", purchasePrice: 0, salePrice: 0, initialStock: 0 });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => api.products.delete(id),
    onSuccess: () => {
      toast.success("Produit supprimé");
      queryClient.invalidateQueries({ queryKey: ["products"] });
      if (selectedProduct) setSelectedProduct(null);
      refreshNotifications();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // -------------------------------------------------------------------------
  // HISTORIQUE DU PRODUIT SÉLECTIONNÉ
  // -------------------------------------------------------------------------

  const productTransactions = useMemo(() => {
    if (!selectedProduct) return [];
    
    const filtered = transactions.filter((transaction) => 
      extractIdFromIri(transaction.product) === selectedProduct.id
    );
    
    // Tri par date décroissante (plus récent en premier)
    return [...filtered].sort((a, b) => 
      new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [selectedProduct, transactions]);

  const productTransactionMetrics = useMemo(() => {
    if (!selectedProduct) return null;
    
    const totalIn = productTransactions
      .filter(t => t.type === 'entry')
      .reduce((sum, t) => sum + t.quantity, 0);
      
    const totalOut = productTransactions
      .filter(t => t.type === 'sale' || t.type === 'exit' || t.type === 'non_sale_exit' || t.type === 'credit')
      .reduce((sum, t) => sum + t.quantity, 0);
      
    const totalSales = productTransactions
      .filter(t => t.type === 'sale')
      .reduce((sum, t) => sum + (getTransactionTotal(t) || 0), 0);
    
    return { totalIn, totalOut, totalSales, count: productTransactions.length };
  }, [productTransactions, selectedProduct]);

  // -------------------------------------------------------------------------
  // RENDU - ÉTAT DE CHARGEMENT
  // -------------------------------------------------------------------------

  if (productsQuery.isLoading || transactionsQuery.isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-8 w-48 bg-muted rounded-lg animate-pulse" />
            <div className="h-4 w-32 bg-muted rounded-lg animate-pulse" />
          </div>
          <div className="h-10 w-36 bg-muted rounded-xl animate-pulse" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="h-96 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  // -------------------------------------------------------------------------
  // RENDU PRINCIPAL
  // -------------------------------------------------------------------------

  return (
    <div className="space-y-6 animate-fade-in">
      {/* ================================================================== */}
      {/* HEADER */}
      {/* ================================================================== */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Produits</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {products.length} produit{products.length > 1 ? 's' : ''} en base
          </p>
        </div>
        <button 
          onClick={() => setIsOpen(true)} 
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:scale-105 active:scale-95"
          style={{ background: "var(--gradient-hero)", boxShadow: "var(--shadow-red)" }}
        >
          <Plus size={16} />
          Nouveau produit
        </button>
      </div>

      {/* ================================================================== */}
      {/* KPIs */}
      {/* ================================================================== */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard 
          label="Produits" 
          value={String(products.length)} 
          icon={Package}
          delay={0}
        />
        <MetricCard 
          label="Stock faible" 
          value={String(metrics.lowStockCount)} 
          icon={AlertCircle}
          color={metrics.lowStockCount > 0 ? "text-amber-500" : undefined}
          delay={1}
        />
        <MetricCard 
          label="Mouvements" 
          value={String(metrics.transactionCount)} 
          icon={TrendingUp}
          delay={2}
        />
      </div>

      {/* ================================================================== */}
      {/* GRILLE PRINCIPALE : TABLEAU + HISTORIQUE */}
      {/* ================================================================== */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-5">
        
        {/* ================================================================ */}
        {/* TABLEAU DES PRODUITS — HAUTEUR FIXE + SCROLL */}
        {/* ================================================================ */}
        <div 
          className="bg-card rounded-xl border overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg h-[400px] xl:h-[600px]"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Barre de recherche — FIXE */}
          <div className="p-4 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Rechercher un produit..."
                className="w-full pl-10 pr-10 py-2.5 rounded-lg border bg-card text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                style={{ borderColor: "hsl(var(--border))" }}
              />
              {search && (
                <button 
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Table — SCROLLABLE */}
          <div className="flex-1 overflow-y-auto overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 z-10" style={{ background: "hsl(var(--muted) / 0.95)" }}>
                <tr>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Produit</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Catégorie</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Achat</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Vente</th>
                  <th className="text-left px-4 py-3 font-semibold text-muted-foreground text-xs uppercase tracking-wider">Stock</th>
                  <th className="w-12"></th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: "hsl(var(--border))" }}>
                {filteredProducts.map((product, index) => (
                  <tr 
                    key={product.id} 
                    className="group transition-all duration-200 hover:bg-muted/30 cursor-pointer"
                    style={{ 
                      animationDelay: `${index * 30}ms`,
                      animation: "fade-in 0.3s ease-out forwards",
                      opacity: 0
                    }}
                    onClick={() => setSelectedProduct(product)}
                  >
                    <td className="px-4 py-3">
                      <button 
                        className={`font-semibold transition-colors ${
                          selectedProduct?.id === product.id 
                            ? "text-primary" 
                            : "text-foreground hover:text-primary"
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedProduct(product);
                        }}
                      >
                        {product.name}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{product.category}</td>
                    <td className="px-4 py-3 text-muted-foreground">{formatCurrency(product.purchasePrice)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatCurrency(product.salePrice)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        product.currentStock === 0 
                          ? "bg-destructive/10 text-destructive" 
                          : product.currentStock <= 5 
                            ? "bg-amber-500/10 text-amber-600" 
                            : "bg-emerald-500/10 text-emerald-600"
                      }`}>
                        {product.currentStock} u.
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        className="p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 hover:bg-destructive/10 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (product.id && window.confirm("Supprimer ce produit ?")) {
                            deleteMutation.mutate(product.id);
                          }
                        }}
                        disabled={deleteMutation.isPending}
                      >
                        {deleteMutation.isPending && deleteMutation.variables === product.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 size={14} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                      <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                      <p>Aucun produit trouvé</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ================================================================ */}
        {/* CARD HISTORIQUE PRODUIT — HAUTEUR FIXE + SCROLL */}
        {/* ================================================================ */}
        <div 
          className="bg-card rounded-xl border overflow-hidden flex flex-col transition-all duration-300 hover:shadow-lg h-[400px] xl:h-[600px]"
          style={{ borderColor: "hsl(var(--border))" }}
        >
          {/* Header — FIXE */}
          <div className="px-5 py-4 border-b shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="flex items-center gap-2 mb-1">
              <History size={16} className="text-primary" />
              <h2 className="font-bold text-foreground">Historique produit</h2>
            </div>
            {!selectedProduct ? (
              <p className="text-xs text-muted-foreground">Sélectionnez un produit pour voir ses mouvements</p>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{selectedProduct.name}</p>
                  <p className="text-xs text-muted-foreground">{selectedProduct.category}</p>
                </div>
                {productTransactionMetrics && (
                  <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                    {productTransactionMetrics.count} mouvement{productTransactionMetrics.count > 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Contenu — SCROLLABLE */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {!selectedProduct ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Aucun produit sélectionné</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Cliquez sur un produit dans le tableau</p>
              </div>
            ) : productTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                  <History className="w-8 h-8 text-muted-foreground/50" />
                </div>
                <p className="text-sm text-muted-foreground font-medium">Aucun mouvement</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ce produit n'a pas encore d'historique</p>
              </div>
            ) : (
              <>
                {/* Mini-stats */}
                {productTransactionMetrics && (
                  <div className="grid grid-cols-3 gap-2 mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Entrées</p>
                      <p className="text-sm font-bold text-emerald-600">+{productTransactionMetrics.totalIn}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">Sorties</p>
                      <p className="text-sm font-bold text-rose-600">-{productTransactionMetrics.totalOut}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xs text-muted-foreground">CA généré</p>
                      <p className="text-sm font-bold text-sky-600">{formatCurrency(productTransactionMetrics.totalSales)}</p>
                    </div>
                  </div>
                )}

                {/* Liste des transactions */}
                <div className="space-y-2">
                  {productTransactions.map((transaction, index) => {
                    const config = TRANSACTION_CONFIG[transaction.type] || TRANSACTION_CONFIG.non_sale_exit;
                    const Icon = config.icon;
                    const total = getTransactionTotal(transaction);
                    const qtyPositive = transaction.type === 'entry';
                    const pricePositive = transaction.type === 'sale' || transaction.type === 'credit';
                    
                    return (
                      <div 
                        key={transaction.id}
                        className={`rounded-lg border p-3 transition-all duration-200 hover:shadow-md ${config.bgColor} ${config.borderColor}`}
                        style={{
                          animationDelay: `${index * 50}ms`,
                          animation: "slide-in 0.3s ease-out forwards",
                          opacity: 0
                        }}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center bg-white/80 ${config.color}`}>
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatTransactionDate(transaction.date)}
                              </p>
                            </div>
                          </div>
                          <span className={`text-sm font-bold ${qtyPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {qtyPositive ? '+' : '-'}{transaction.quantity} u.
                          </span>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-black/5">
                          <div className="flex items-center gap-3">
                            {transaction.unitPrice && (
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Banknote className="w-3 h-3" />
                                {formatCurrency(transaction.unitPrice)}/u.
                              </span>
                            )}
                          </div>
                          {total !== null && (
                            <span className={`text-sm font-bold ${pricePositive ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {pricePositive ? '+' : '-'}{formatCurrency(total)}
                            </span>
                          )}
                        </div>

                        {transaction.note && (
                          <div className="mt-2 pt-2 border-t border-black/5">
                            <p className="text-xs text-muted-foreground flex items-start gap-1">
                              <StickyNote className="w-3 h-3 mt-0.5 shrink-0" />
                              <span className="line-clamp-2">{transaction.note}</span>
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Footer — FIXE */}
          {selectedProduct && (
            <div className="px-5 py-3 border-t shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Stock actuel</span>
                <span className={`text-sm font-bold ${
                  selectedProduct.currentStock === 0 
                    ? "text-destructive" 
                    : selectedProduct.currentStock <= 5 
                      ? "text-amber-600" 
                      : "text-emerald-600"
                }`}>
                  {selectedProduct.currentStock} unité{selectedProduct.currentStock > 1 ? 's' : ''}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ================================================================== */}
      {/* MODAL NOUVEAU PRODUIT */}
      {/* ================================================================== */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-fade-in"
          onClick={() => setIsOpen(false)}
        >
          <div 
            className="w-full max-w-lg rounded-2xl border bg-card p-6 space-y-4 animate-scale-in"
            style={{ borderColor: "hsl(var(--border))" }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-lg font-bold text-foreground">Nouveau produit</h2>
            
            <Field 
              label="Nom" 
              value={form.name} 
              onChange={(value) => setForm((current) => ({ ...current, name: value }))} 
            />
            <Field 
              label="Catégorie" 
              value={form.category} 
              onChange={(value) => setForm((current) => ({ ...current, category: value }))} 
            />
            
            <div className="grid grid-cols-3 gap-3">
              <Field 
                label="Prix d'achat" 
                type="number" 
                min={0}
                value={String(form.purchasePrice)} 
                onChange={(value) => setForm((current) => ({ ...current, purchasePrice: Number(value) }))} 
              />
              <Field 
                label="Prix de vente" 
                type="number" 
                min={0}
                value={String(form.salePrice)} 
                onChange={(value) => setForm((current) => ({ ...current, salePrice: Number(value) }))} 
              />
              <Field 
                label="Stock initial" 
                type="number" 
                min={0}
                value={String(form.initialStock)} 
                onChange={(value) => setForm((current) => ({ ...current, initialStock: Number(value) }))} 
              />
            </div>
            
            <div className="flex justify-end gap-3 pt-2">
              <button 
                className="px-4 py-2 rounded-lg border transition-colors hover:bg-muted"
                style={{ borderColor: "hsl(var(--border))" }} 
                onClick={() => setIsOpen(false)}
              >
                Annuler
              </button>
              <button 
                className="px-4 py-2 rounded-lg text-white transition-all duration-200 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:hover:scale-100"
                style={{ background: "var(--gradient-hero)" }} 
                onClick={() => createMutation.mutate()} 
                disabled={!form.name || createMutation.isPending}
              >
                {createMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Création...
                  </span>
                ) : (
                  "Enregistrer"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// COMPOSANTS INTERNES
// ============================================================================

function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      <input
        type={type}
        min={min}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full px-3 py-2.5 rounded-lg border text-sm bg-card outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        style={{ borderColor: "hsl(var(--border))" }}
      />
    </div>
  );
}

function MetricCard({ 
  label, 
  value, 
  icon: Icon,
  color,
  delay = 0
}: { 
  label: string; 
  value: string; 
  icon: React.ElementType;
  color?: string;
  delay?: number;
}) {
  return (
    <div 
      className="stat-card transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
      style={{
        animationDelay: `${delay * 100}ms`,
        animation: "fade-in 0.4s ease-out forwards",
        opacity: 0
      }}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {Icon && <Icon className={`w-4 h-4 ${color || "text-muted-foreground"}`} />}
      </div>
      <p className="text-2xl font-black text-foreground mt-1">{value}</p>
    </div>
  );
}