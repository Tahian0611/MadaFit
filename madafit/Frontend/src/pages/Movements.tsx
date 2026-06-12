import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { refreshNotifications } from '@/services/api';
import { useAuth } from '@/hooks/useAuth';
import { 
  extractHydraMembers, 
  formatCurrency, 
  extractIdFromIri 
} from '@/lib/madafit';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  ArrowDown, ArrowUp, Gift, CheckCircle, Plus, Trash2, ShoppingCart,
  History, ChevronDown, Search, X, PackagePlus, Clock, Loader2
} from 'lucide-react';
import type { Product, Transaction } from '@/types/entities';

// ─── Types ────────────────────────────────────────────────────────────────────
type TxType = 'entry' | 'sale' | 'non_sale_exit' | 'credit' | 'charge' | 'other_charge';

type TxTypeUi = 'entry' | 'charge' | 'sale' | 'credit' | 'non_sale_exit' | 'other_charge';

interface ProductLine {
  id: string;
  productId: string;
  productName: string;
  quantity: string;
  unitPrice: string;
  type: TxType;
}

const CATEGORIES = [
  'Boissons', 'Protéines', 'Barres & Biscuits', 'Jus', 'Suppléments', 'Autre',
];

const TX_OPTIONS: { value: TxType; label: string; description: string; icon: React.ElementType; color: string }[] = [
  // NOTE: value doit rester unique pour React keys (Radix SelectItem key uses value).
  // Ici, on conserve le même TxType backend ('entry') en différenciant via un mapping UI.
  { value: 'entry',         label: 'Entrée — Approvisionnement', description: 'Approvisionnement de stock', icon: ArrowDown, color: 'border-success/40 bg-success/5 text-success' },
  { value: 'charge',        label: 'Entrée — Charge',             description: 'Achat de stock, compte en dépense', icon: ArrowDown, color: 'border-success/40 bg-success/5 text-success' },
  { value: 'sale',          label: 'Sortie — Vente',              description: "Génère un encaissement direct", icon: ArrowUp,   color: 'border-accent/40 bg-accent/5 text-accent' },
  { value: 'credit',        label: 'Sortie — À Crédit',           description: "Vendu mais non payé",        icon: Clock,     color: 'border-amber-500/40 bg-amber-500/5 text-amber-600' },
  { value: 'non_sale_exit', label: 'Sortie sans encaissement',    description: 'Ex : offert, cassé, perdu...', icon: Gift,    color: 'border-destructive/40 bg-destructive/5 text-destructive' },
  { value: 'other_charge',  label: 'Autre charge',                description: 'Frais annexes (transport, etc)', icon: ArrowDown, color: 'border-destructive/40 bg-destructive/5 text-destructive' },
];

const TX_TYPE_INFO: Record<TxType, { label: string; badgeClass: string; marker: string }> = {
  entry:        { label: 'Entrée',    badgeClass: 'bg-success/10 text-success',       marker: 'bg-success'      },
  charge:       { label: 'Charge',    badgeClass: 'bg-success/10 text-success',       marker: 'bg-success'      },
  sale:         { label: 'Vente',     badgeClass: 'bg-accent/10 text-accent',         marker: 'bg-accent'       },
  credit:       { label: 'Crédit',    badgeClass: 'bg-amber-500/10 text-amber-600',   marker: 'bg-amber-500'    },
  non_sale_exit:{ label: 'Sortie S/E',badgeClass: 'bg-destructive/10 text-destructive',marker: 'bg-destructive' },
  other_charge: { label: 'Autre Chrg.',badgeClass: 'bg-destructive/10 text-destructive',marker: 'bg-destructive' },
};



function generateId(): string {
  return typeof crypto.randomUUID === 'function' 
    ? crypto.randomUUID() 
    : Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
}

function newLine(type: TxType = 'sale'): ProductLine {
  return { id: generateId(), productId: '', productName: '', quantity: '', unitPrice: '', type };
}

const EXIT_TYPES: TxType[] = ['sale', 'credit', 'non_sale_exit'];

// ─── Sub-component: Product search input with autocomplete ────────────────────
function ProductSearchInput({
  value,
  onChange,
  products,
  onCreateNew,
}: {
  value: { productId: string; productName: string };
  onChange: (patch: { productId: string; productName: string; unitPrice?: string }) => void;
  products: Product[];
  onCreateNew: (name: string) => void;
}) {
  const [query, setQuery] = useState(value.productName);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value.productName);
  }, [value.productName]);

  const filtered = useMemo(() => {
    if (!query.trim()) return products.slice(0, 8);
    return products.filter((p) =>
      p.name.toLowerCase().includes(query.toLowerCase()) ||
      p.category.toLowerCase().includes(query.toLowerCase())
    ).slice(0, 8);
  }, [query, products]);

  function select(p: Product) {
    setQuery(p.name);
    setOpen(false);
    onChange({ productId: String(p.id), productName: p.name, unitPrice: String(p.salePrice) });
  }

  function handleBlur(e: React.FocusEvent) {
    if (wrapRef.current?.contains(e.relatedTarget as Node)) return;
    setOpen(false);
    if (!value.productId && query.trim()) {
      const exact = products.find((p) => p.name.toLowerCase() === query.toLowerCase());
      if (exact) select(exact);
    }
  }

  const showCreate = query.trim().length >= 2 && !products.find((p) => p.name.toLowerCase() === query.toLowerCase());

  return (
    <div ref={wrapRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); onChange({ productId: '', productName: e.target.value }); }}
          onFocus={() => setOpen(true)}
          onBlur={handleBlur}
          placeholder="Rechercher..."
          className="pl-8 h-9 text-sm"
        />
        {query && (
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => { setQuery(''); setOpen(false); onChange({ productId: '', productName: '' }); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
          {filtered.length > 0 && (
            <ul className="max-h-48 overflow-y-auto divide-y divide-border">
              {filtered.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => select(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted text-left transition-colors"
                  >
                    <div>
                      <span className="font-medium text-foreground">{p.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{p.category}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">stock : {p.currentStock}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {showCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => { setOpen(false); onCreateNew(query.trim()); }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-primary hover:bg-primary/5 border-t border-border"
            >
              <PackagePlus className="w-4 h-4" />
              Créer « <strong>{query.trim()}</strong> »
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component: Quick product creation dialog ─────────────────────────────
type QuickProductForm = { name: string; category: string; purchasePrice: string; salePrice: string; initialStock: string };
const emptyQuickForm = (name = ''): QuickProductForm => ({ name, category: 'Boissons', purchasePrice: '', salePrice: '', initialStock: '0' });

function QuickAddProductDialog({
  open,
  initialName,
  onClose,
  onCreated,
}: {
  open: boolean;
  initialName: string;
  onClose: () => void;
  onCreated: (product: Product) => void;
}) {
  const [form, setForm] = useState<QuickProductForm>(emptyQuickForm(initialName));
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? 'caisse2' : 'caisse1';

  useEffect(() => {
    if (open) setForm(emptyQuickForm(initialName));
  }, [open, initialName]);

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      // 1. On crée le produit
      const product = await api.products.create(data);
      // 2. Si on a du stock initial, on crée une transaction 'charge'
      if (Number(form.initialStock) > 0) {
        await api.transactions.create({
          product: `/api/products/${product.id}`,
          type: 'charge',
          quantity: Number(form.initialStock),
          note: 'Stock initial / Exception ajout',
          date: new Date().toISOString(),
          unitPrice: Number(form.purchasePrice) || 0,
          cashRegister: currentCashRegister,
        });
      }
      return product;
    },
    onSuccess: (data) => {
      toast.success("Produit crée avec succès");
      onCreated(data);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    }
  });

  function handleSubmit() {
    if (!form.name.trim() || !form.purchasePrice || !form.salePrice) return;
    createMutation.mutate({
      name: form.name.trim(),
      category: form.category,
      purchasePrice: Number(form.purchasePrice),
      salePrice: Number(form.salePrice),
      initialStock: Number(form.initialStock),
      currentStock: Number(form.initialStock),
      registrationDate: new Date().toISOString().split('T')[0],
    });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><PackagePlus className="w-5 h-5" />Nouveau produit</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5"><Label>Nom *</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="space-y-1.5">
            <Label>Catégorie</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Prix d'achat</Label><Input type="number" value={form.purchasePrice} onChange={(e) => setForm({ ...form, purchasePrice: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Prix de vente</Label><Input type="number" value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: e.target.value })} /></div>
          </div>
          <div className="space-y-1.5">
            <Label>Stock initial</Label>
            <Input type="number" value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: e.target.value })} />
            <p className="text-[10px] text-muted-foreground mt-1">Sera enregistré comme charge dans {currentCashRegister === "caisse2" ? "Caisse 2 - Admin" : "Caisse 1 - Reception"}</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gradient-accent text-accent-foreground border-0">
            {createMutation.isPending ? "Création..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Movements() {
  const queryClient = useQueryClient();
  const { isAdmin } = useAuth();
  const currentCashRegister = isAdmin ? 'caisse2' : 'caisse1';
  const currentCashRegisterLabel = isAdmin ? 'Caisse 2 - Admin' : 'Caisse 1 - Reception';
  const [lines, setLines] = useState<ProductLine[]>([newLine('sale')]);
  const [note, setNote] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickLineId, setQuickLineId] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [deleteTx, setDeleteTx] = useState<Transaction | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | TxType>('all');

  const productsQuery     = useQuery({ queryKey: ['products'],     queryFn: () => api.products.getAll({ itemsPerPage: 1000 }) });
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: () => api.transactions.getAll({ itemsPerPage: 100 }) });

  const products           = extractHydraMembers(productsQuery.data) as Product[];
  const recentTransactions = extractHydraMembers(transactionsQuery.data) as Transaction[];

  const filteredTransactions = useMemo(() => {
    if (activeTab === 'all') return recentTransactions;
    return recentTransactions.filter(tx => tx.type === activeTab);
  }, [recentTransactions, activeTab]);

  const createTxMutation = useMutation({
    mutationFn: (data: any) => api.transactions.create(data),
    onSuccess: () => {
      // Handled in bulk
    }
  });

  const deleteTxMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      // 1. Revert stock
      const productId = extractIdFromIri(tx.product);
      const product = productId ? productMap[productId] : null;
      
      if (product && tx.type !== 'other_charge') {
        let revertQty = 0;
        let saleRevert = 0;
        if (tx.type === 'entry' || tx.type === 'charge') {
          // It was an entry (+), so we subtract it (-)
          revertQty = -tx.quantity;
        } else {
          // It was an exit (-), so we add it back (+)
          revertQty = tx.quantity;
          if (tx.type === 'sale' || tx.type === 'credit') {
            saleRevert = -tx.quantity;
          }
        }
        
        await api.products.update(product.id!, { 
          currentStock: Math.max(0, product.currentStock + revertQty),
          totalSales: Math.max(0, (product.totalSales || 0) + saleRevert)
        });
      }

      // 2. Delete transaction
      return api.transactions.delete(tx.id!);
    },
    onSuccess: () => {
      toast.success("Transaction supprimée et stock rétabli");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['stock-report'] });
      setDeleteTx(null);
    },
    onError: (error: Error) => {
      toast.error("Erreur lors de la suppression : " + error.message);
    }
  });

  const payCreditMutation = useMutation({
    mutationFn: async (tx: Transaction) => {
      return api.transactions.update(tx.id!, { 
        type: 'sale',
        note: tx.note ? `${tx.note} (Payé le ${new Date().toLocaleDateString('fr-FR')})` : `Payé le ${new Date().toLocaleDateString('fr-FR')}`
      });
    },
    onSuccess: () => {
      toast.success("Crédit marqué comme payé ✓");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['stock-report'] });
    },
    onError: (error: Error) => {
      toast.error("Erreur lors du paiement : " + error.message);
    }
  });

  const productMap = useMemo(() => {
    const m: Record<string, Product> = {};
    products.forEach((p) => (m[p.id!] = p));
    return m;
  }, [products]);

  function updateLine(id: string, patch: Partial<Omit<ProductLine, 'id'>>) {
    setLines((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function addLine() { setLines((prev) => [...prev, newLine('sale')]); }

  function removeLine(id: string) { setLines((prev) => (prev.length > 1 ? prev.filter((l) => l.id !== id) : prev)); }

  function openQuickCreate(name: string, lineId: string) {
    setQuickName(name);
    setQuickLineId(lineId);
    setQuickOpen(true);
  }

  function handleProductCreated(product: Product) {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    refreshNotifications();
    if (quickLineId) {
      const targetLine = lines.find((line) => line.id === quickLineId);
      updateLine(quickLineId, {
        productId: String(product.id),
        productName: product.name,
        unitPrice: String((targetLine?.type === 'entry' || targetLine?.type === 'charge' || targetLine?.type === 'other_charge') ? product.purchasePrice : product.salePrice),
      });
    }
    setQuickOpen(false);
    setQuickLineId(null);
  }

  function getLineError(line: ProductLine): string | null {
    const qty = Number(line.quantity);
    if (line.quantity !== '' && (isNaN(qty) || qty < 0)) {
      return "La quantité ne peut pas être négative";
    }
    if (line.productId && EXIT_TYPES.includes(line.type)) {
      const product = productMap[line.productId];
      if (product && qty > product.currentStock) {
        return `Stock insuffisant : ${product.currentStock} unité${product.currentStock > 1 ? 's' : ''} disponible${product.currentStock > 1 ? 's' : ''}`;
      }
    }
    return null;
  }

  const isValid = lines.every((l) => {
    const qty = Number(l.quantity);
    if (!l.productId || !l.quantity || isNaN(qty) || qty <= 0) return false;
    if (EXIT_TYPES.includes(l.type)) {
      const product = productMap[l.productId];
      if (product && qty > product.currentStock) return false;
    }
    return true;
  }) && lines.length > 0;

  const preview = useMemo(() => {
    const validLines = lines.filter((l) => l.productId && l.quantity && Number(l.quantity) > 0);
    if (validLines.length === 0) return null;

    let totalRevenue = 0, totalCost = 0, totalCharges = 0;
    const items: any[] = [];

    for (const line of validLines) {
      const product = products.find((p) => String(p.id) === line.productId);
      if (!product) continue;
      const qty = Number(line.quantity);
      const unitPrice = Number(line.unitPrice) || product.salePrice;
      const lineTotal = qty * unitPrice;

      if (line.type === 'sale') {
        totalRevenue += lineTotal;
        totalCost += qty * product.purchasePrice;
      } else if (line.type === 'credit') {
        // Optionnel : on peut tracker le total des crédits séparément si besoin
        totalCost += qty * product.purchasePrice;
      }

      if (line.type === 'entry' || line.type === 'charge' || line.type === 'other_charge') {
        totalCharges += lineTotal;
      }

      const newStock = (line.type === 'entry' || line.type === 'charge') ? product.currentStock + qty : (line.type === 'other_charge' ? product.currentStock : Math.max(0, product.currentStock - qty));
      items.push({ 
        product, 
        qty, 
        newStock, 
        lineTotal, 
        type: line.type, 
        typeLabel: TX_TYPE_INFO[line.type]?.label || line.type 
      });
    }

    return { items, totalRevenue, totalCost, totalCharges, profit: totalRevenue - totalCost };
  }, [lines, products]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isSaving) return;
    setIsSaving(true);

    const date = new Date(movementDate).toISOString();
    
    try {
      for (const line of lines) {
        const product = products.find((p) => String(p.id) === line.productId);
        if (!product) continue;
        
        const unitPriceValue = Number(line.unitPrice) || product.salePrice;
        
        await api.transactions.create({
          product: `/api/products/${line.productId}`,
          type: line.type,
          quantity: Number(line.quantity),
          note: note.trim(),
          date,
          unitPrice: unitPriceValue,
          cashRegister: currentCashRegister,
        });

        const isSale = line.type === 'sale' || line.type === 'credit';
        const newStock = (line.type === 'entry' || line.type === 'charge') 
          ? product.currentStock + Number(line.quantity) 
          : (line.type === 'other_charge' ? product.currentStock : Math.max(0, product.currentStock - Number(line.quantity)));
        
        const newTotalSales = isSale ? (product.totalSales || 0) + Number(line.quantity) : product.totalSales;
          
        if (line.type !== 'other_charge') {
          await api.products.update(product.id!, { 
            currentStock: newStock,
            totalSales: newTotalSales
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // ✅ FIX : invalide le rapport stock pour que Reports_stock
      // affiche les nouvelles données immédiatement sans F5
      queryClient.invalidateQueries({ queryKey: ['stock-report'] });
      
      refreshNotifications();
      
      setLines([newLine('sale')]);
      setNote('');
      setMovementDate(new Date().toISOString().slice(0, 16));
      setSuccess(true);
      toast.success("Mouvements enregistres");
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIsSaving(false);
    }
  }

  function handleDeleteTx() {
    if (deleteTx) {
      deleteTxMutation.mutate(deleteTx);
    }
  }

  return (
    <div className="p-6 max-w-[1600px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Côté gauche : Formulaire (ne rien modifier) */}
        <div className="lg:col-span-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Enregistrer un mouvement</h1>
            <p className="text-sm text-muted-foreground">Gérez vos entrées, ventes et crédits via le backend API.</p>
            <p className="text-xs font-bold text-primary mt-1">{currentCashRegisterLabel}</p>
          </div>

          {success && (
            <div className="flex items-center gap-3 bg-success/10 border border-success/20 text-success rounded-lg px-4 py-3">
              <CheckCircle className="w-5 h-5 shrink-0" />
              <p className="text-sm font-medium">Mouvement enregistré avec succès !</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-2">
              <Label className="text-sm font-semibold">Date &amp; heure</Label>
              <Input type="datetime-local" value={movementDate} onChange={(e) => setMovementDate(e.target.value)} className="max-w-xs" />
            </div>

            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-semibold">Produits *</Label>
                <Button type="button" variant="outline" size="sm" onClick={addLine} className="gap-1.5 h-8 text-xs"><Plus className="w-3.5 h-3.5" />Ajouter</Button>
              </div>

              <div className="grid grid-cols-[130px_1fr_60px_80px_80px_36px] gap-2 text-xs font-medium text-muted-foreground px-1">
                <span>Type</span>
                <span>Produit</span>
                <span>Qté</span>
                <span>Prix Unit.</span>
                <span>Total</span>
                <span />
              </div>

              <div className="space-y-3">
                {lines.map((line) => {
                  const product = products.find((p) => String(p.id) === line.productId);
                  const qty = Number(line.quantity);
                  const lineTotal = qty > 0 && Number(line.unitPrice) > 0 ? qty * Number(line.unitPrice) : null;
                  const error = getLineError(line);
                  return (
                    <div key={line.id} className="space-y-1.5">
                      <div className="grid grid-cols-[130px_1fr_60px_80px_80px_36px] gap-2 items-start">
                        <Select 
                          value={line.type}
                          onValueChange={(v) => {
                            const nextType = v as TxType;
                            const selectedProduct = product || productMap[line.productId];
                            updateLine(line.id, {
                              type: nextType,
                              unitPrice: selectedProduct 
                                ? ((nextType === 'entry' || nextType === 'charge' || nextType === 'other_charge') ? String(selectedProduct.purchasePrice) : String(selectedProduct.salePrice))
                                : line.unitPrice,
                            });
                          }}
                        >
                          <SelectTrigger className="h-9 text-xs">
                            <SelectValue placeholder="Type" />
                          </SelectTrigger>
                          <SelectContent>
                            {TX_OPTIONS.map((opt) => (
                              <SelectItem key={opt.value} value={opt.value} className="text-xs">
                                {opt.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <ProductSearchInput
                          value={{ productId: line.productId, productName: line.productName }}
                          onChange={(patch) => {
                            const selectedProduct = patch.productId ? productMap[patch.productId] : null;
                            updateLine(line.id, {
                              ...patch,
                              unitPrice: selectedProduct && (line.type === 'entry' || line.type === 'charge' || line.type === 'other_charge')
                                ? String(selectedProduct.purchasePrice)
                                : patch.unitPrice ?? line.unitPrice,
                            });
                          }}
                          products={products}
                          onCreateNew={(name) => openQuickCreate(name, line.id)}
                        />
                        <Input 
                          type="number" 
                          min={0}
                          value={line.quantity} 
                          onKeyDown={(e) => {
                            if (e.key === '-' || e.key === 'Minus' || e.key === 'NumpadSubtract') {
                              e.preventDefault();
                            }
                          }}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val === '') {
                              updateLine(line.id, { quantity: '' });
                              return;
                            }
                            const num = Number(val);
                            if (isNaN(num) || num < 0) return;
                            if (EXIT_TYPES.includes(line.type) && product && num > product.currentStock) {
                              updateLine(line.id, { quantity: String(product.currentStock) });
                              return;
                            }
                            updateLine(line.id, { quantity: val });
                          }} 
                          className={`h-9 text-sm ${error ? 'border-destructive focus-visible:ring-destructive' : ''}`} 
                        />
                        <Input type="number" value={line.unitPrice} onChange={(e) => updateLine(line.id, { unitPrice: e.target.value })} className="h-9 text-sm" />
                        <div className="h-9 flex items-center px-2 bg-muted rounded-md text-xs font-semibold truncate">
                          {lineTotal !== null ? formatCurrency(lineTotal) : '—'}
                        </div>
                        <button type="button" onClick={() => removeLine(line.id)} disabled={lines.length === 1} className="w-9 h-9 flex items-center justify-center text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      {error && (
                        <p className="text-xs text-destructive ml-[130px]">{error}</p>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Les entrees de stock sont ajoutees comme charges dans {currentCashRegisterLabel}.
              </p>
            </div>

            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-2">
              <Label className="text-sm font-semibold">Note / Motif</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Détails (nom du client si crédit, raison de sortie...)" rows={2} className="resize-none" />
            </div>

            {preview && (
              <div className="bg-muted rounded-xl border border-border p-4 space-y-3">
                <p className="font-semibold text-sm flex items-center gap-2"><ShoppingCart className="w-4 h-4" />Aperçu du mouvement</p>
                {preview.items.map((it: any) => (
                  <div key={it.product.id + it.type} className="flex justify-between items-center text-xs bg-background p-2 rounded-md border border-border">
                    <div className="flex flex-col gap-0.5">
                      <span className="font-medium">{it.product.name} (x{it.qty})</span>
                      <span className="text-muted-foreground">{it.typeLabel}</span>
                    </div>
                    <div className="text-right">
                      <span className="font-semibold block">→ Stock : {it.newStock}</span>
                      {(it.type === 'sale' || it.type === 'credit') && (
                        <span className="text-muted-foreground">{formatCurrency(it.lineTotal)}</span>
                      )}
                    </div>
                  </div>
                ))}
                {preview.totalRevenue > 0 && (
                  <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                    <span>Total à encaisser / créditer</span>
                    <span className="text-accent">{formatCurrency(preview.totalRevenue)}</span>
                  </div>
                )}
                {preview.totalCharges > 0 && (
                  <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                    <span>Total charges ({currentCashRegisterLabel})</span>
                    <span className="text-destructive">{formatCurrency(preview.totalCharges)}</span>
                  </div>
                )}
              </div>
            )}

            <Button 
              type="submit" 
              disabled={!isValid || isSaving} 
              className="w-full gradient-accent text-accent-foreground border-0 h-11 font-semibold flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Enregistrement en cours...
                </>
              ) : (
                "Enregistrer le mouvement"
              )}
            </Button>
          </form>
        </div>

        {/* Côté droit : Historique détaillé par type */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-card rounded-2xl border border-border shadow-xl p-6 flex flex-col h-[calc(100vh-120px)] min-h-[600px]">
            <div className="space-y-1 mb-6 shrink-0">
              <h3 className="text-lg font-black uppercase tracking-tight text-foreground flex items-center gap-2">
                <History className="w-5 h-5 text-primary" />
                Historique des Mouvements
              </h3>
              <p className="text-xs text-muted-foreground">
                Visualisez et filtrez les mouvements récents par type
              </p>
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-1.5 p-1 bg-muted/50 rounded-xl mb-4 shrink-0">
              {[
                { id: 'all', label: 'Tous' },
                { id: 'entry', label: 'Entrées' },
                { id: 'sale', label: 'Ventes' },
                { id: 'credit', label: 'Crédits' },
                { id: 'non_sale_exit', label: 'Sorties S/E' },
              ].map((tab) => {
                const count = tab.id === 'all' 
                  ? recentTransactions.length 
                  : recentTransactions.filter(t => t.type === tab.id).length;
                
                const isActive = activeTab === tab.id;
                
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex-1 min-w-[70px] px-2 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                      isActive 
                        ? 'bg-card text-foreground shadow-sm' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {count > 0 && (
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                        isActive ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* List Container */}
            <div className="overflow-y-auto flex-1 pr-1 custom-scrollbar min-h-0">
              {transactionsQuery.isLoading ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic">
                  <Loader2 className="animate-spin text-primary mb-2" size={32} />
                  Chargement de l'historique...
                </div>
              ) : filteredTransactions.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-muted-foreground italic text-xs">
                  Aucun mouvement enregistré pour ce type
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTransactions.map((tx) => {
                    const productId = extractIdFromIri(tx.product);
                    const product = productId ? productMap[productId] : null;
                    const info = TX_TYPE_INFO[tx.type] || { label: tx.type, badgeClass: 'bg-muted', marker: 'bg-muted' };
                    
                    const total = (() => {
                      if (!product) return null;
                      switch (tx.type) {
                        case 'entry':
                        case 'charge':
                        case 'other_charge': return tx.quantity * (tx.unitPrice ?? product.purchasePrice ?? 0);
                        case 'sale':
                        case 'credit':       return tx.quantity * (tx.unitPrice ?? product.salePrice ?? 0);
                        case 'non_sale_exit':return tx.quantity * (tx.unitPrice ?? product.purchasePrice ?? 0);
                        default:             return null;
                      }
                    })();

                    return (
                      <div key={tx.id} className="p-4 rounded-xl border border-border/50 bg-card hover:bg-muted/10 transition-colors flex items-center justify-between gap-4">
                        <div className="overflow-hidden space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${info.badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${info.marker}`} />
                              {info.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {new Date(tx.date).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </span>
                          </div>
                          <h4 className="font-bold text-sm text-foreground truncate uppercase">{product?.name || 'Produit Inconnu'}</h4>
                          {tx.note && (
                            <p className="text-[10px] text-muted-foreground italic truncate">
                              Note: {tx.note}
                            </p>
                          )}
                        </div>
                        
                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right">
                            <span className="text-xs font-bold text-muted-foreground block">
                              Qté: {tx.quantity}
                            </span>
                            <span className="font-black text-sm text-foreground">
                              {total !== null ? formatCurrency(total) : '—'}
                            </span>
                          </div>
                          {tx.type === 'credit' && (
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => payCreditMutation.mutate(tx)} 
                              className="h-8 px-2.5 gap-1.5 text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500 hover:text-white"
                              disabled={payCreditMutation.isPending}
                            >
                              <CheckCircle size={14} />
                              Payer
                            </Button>
                          )}
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => setDeleteTx(tx)} 
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <QuickAddProductDialog open={quickOpen} initialName={quickName} onClose={() => setQuickOpen(false)} onCreated={handleProductCreated} />

      <AlertDialog open={!!deleteTx} onOpenChange={(o) => !o && setDeleteTx(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Action irréversible. Le stock sera automatiquement recalculé.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTx} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
