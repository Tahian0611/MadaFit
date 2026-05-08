import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import api from '@/services/api';
import { refreshNotifications } from '@/services/api';
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
type TxType = 'entry' | 'sale' | 'non_sale_exit' | 'credit';

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
  { value: 'entry',        label: 'Entrée (Approvisionnement)', description: 'Stock reçu ou acheté',      icon: ArrowDown, color: 'border-success/40 bg-success/5 text-success' },
  { value: 'sale',         label: 'Sortie — Vente',             description: "Génère un encaissement direct", icon: ArrowUp,   color: 'border-accent/40 bg-accent/5 text-accent' },
  { value: 'credit',       label: 'Sortie — À Crédit',          description: "Vendu mais non payé",        icon: Clock,     color: 'border-amber-500/40 bg-amber-500/5 text-amber-600' },
  { value: 'non_sale_exit',label: 'Sortie sans encaissement',   description: 'Ex : offert, cassé, perdu...', icon: Gift,    color: 'border-destructive/40 bg-destructive/5 text-destructive' },
];

const TX_TYPE_INFO: Record<string, { label: string; badgeClass: string; marker: string }> = {
  entry:        { label: 'Entrée',    badgeClass: 'bg-success/10 text-success',       marker: 'bg-success'      },
  sale:         { label: 'Vente',     badgeClass: 'bg-accent/10 text-accent',         marker: 'bg-accent'       },
  credit:       { label: 'Crédit',    badgeClass: 'bg-amber-500/10 text-amber-600',   marker: 'bg-amber-500'    },
  non_sale_exit:{ label: 'Sortie S/E',badgeClass: 'bg-destructive/10 text-destructive',marker: 'bg-destructive' },
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

  useEffect(() => {
    if (open) setForm(emptyQuickForm(initialName));
  }, [open, initialName]);

  const createMutation = useMutation({
    mutationFn: (data: any) => api.products.create(data),
    onSuccess: (data) => {
      toast.success("Produit cree");
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
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Annuler</Button>
          <Button onClick={handleSubmit} disabled={createMutation.isPending} className="gradient-accent text-accent-foreground border-0">
            {createMutation.isPending ? "Creation..." : "Créer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function Movements() {
  const queryClient = useQueryClient();
  const [lines, setLines] = useState<ProductLine[]>([newLine('sale')]);
  const [note, setNote] = useState('');
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [success, setSuccess] = useState(false);

  const [quickOpen, setQuickOpen] = useState(false);
  const [quickName, setQuickName] = useState('');
  const [quickLineId, setQuickLineId] = useState<string | null>(null);

  const [showHistory, setShowHistory] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const productsQuery     = useQuery({ queryKey: ['products'],     queryFn: () => api.products.getAll({ itemsPerPage: 1000 }) });
  const transactionsQuery = useQuery({ queryKey: ['transactions'], queryFn: () => api.transactions.getAll({ itemsPerPage: 20 }) });

  const products           = extractHydraMembers(productsQuery.data);
  const recentTransactions = extractHydraMembers(transactionsQuery.data);

  const createTxMutation = useMutation({
    mutationFn: (data: any) => api.transactions.create(data),
    onSuccess: () => {
      // Handled in bulk
    }
  });

  const deleteTxMutation = useMutation({
    mutationFn: (id: number) => api.transactions.delete(id),
    onSuccess: () => {
      toast.success("Transaction supprimee");
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      // ✅ FIX : invalide aussi le rapport stock pour que Reports_stock
      // se mette à jour immédiatement sans F5
      queryClient.invalidateQueries({ queryKey: ['stock-report'] });
      setDeleteId(null);
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
      updateLine(quickLineId, { productId: String(product.id), productName: product.name, unitPrice: String(product.salePrice) });
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

    let totalRevenue = 0, totalCost = 0;
    const items: any[] = [];

    for (const line of validLines) {
      const product = products.find((p) => String(p.id) === line.productId);
      if (!product) continue;
      const qty = Number(line.quantity);
      const unitPrice = Number(line.unitPrice) || product.salePrice;
      const lineTotal = qty * unitPrice;

      if (line.type === 'sale' || line.type === 'credit') {
        totalRevenue += lineTotal;
        totalCost += qty * product.purchasePrice;
      }

      const newStock = line.type === 'entry' ? product.currentStock + qty : Math.max(0, product.currentStock - qty);
      items.push({ 
        product, 
        qty, 
        newStock, 
        lineTotal, 
        type: line.type, 
        typeLabel: TX_TYPE_INFO[line.type]?.label || line.type 
      });
    }

    return { items, totalRevenue, totalCost, profit: totalRevenue - totalCost };
  }, [lines, products]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid) return;

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
        });

        const newStock = line.type === 'entry' 
          ? product.currentStock + Number(line.quantity) 
          : Math.max(0, product.currentStock - Number(line.quantity));
          
        await api.products.update(product.id!, { currentStock: newStock });
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
    }
  }

  function handleDeleteTx() {
    if (deleteId) {
      deleteTxMutation.mutate(deleteId);
    }
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Enregistrer un mouvement</h1>
        <p className="text-sm text-muted-foreground">Gérez vos entrées, ventes et crédits via le backend API.</p>
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
                      onValueChange={(v) => updateLine(line.id, { type: v as TxType })}
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
                      onChange={(patch) => updateLine(line.id, patch)}
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
          </div>
        )}

        <Button type="submit" disabled={!isValid} className="w-full gradient-accent text-accent-foreground border-0 h-11 font-semibold">
          Enregistrer le mouvement
        </Button>
      </form>

      {/* Historique */}
      <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
        <button type="button" onClick={() => setShowHistory(!showHistory)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30">
          <div className="flex items-center gap-2"><History className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-semibold">Historique récent</span></div>
          <ChevronDown className={`w-4 h-4 transition-transform ${showHistory ? 'rotate-180' : ''}`} />
        </button>

        {showHistory && (
          <div className="overflow-x-auto border-t border-border">
            <table className="w-full text-xs">
              <thead className="bg-muted/60">
                <tr><th className="text-left px-4 py-3">Date</th><th className="text-left px-4 py-3">Produit</th><th className="text-left px-4 py-3">Type</th><th className="text-left px-4 py-3">Qté</th><th className="text-left px-4 py-3">Total</th><th /></tr>
              </thead>
              <tbody className="divide-y divide-border">
                {transactionsQuery.isLoading ? (
                   <tr><td colSpan={6} className="text-center py-6"><Loader2 className="animate-spin mx-auto" /></td></tr>
                ) : recentTransactions.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Aucun mouvement en base</td></tr>
                ) : recentTransactions.map((tx) => {
                  const productId = extractIdFromIri(tx.product);
                  const product = productId ? productMap[productId] : null;
                  const info = TX_TYPE_INFO[tx.type] || { label: tx.type, badgeClass: 'bg-muted', marker: 'bg-muted' };
                  
                  const total = (() => {
                    if (!product) return null;
                    switch (tx.type) {
                      case 'entry':        return tx.quantity * (tx.unitPrice ?? product.purchasePrice ?? 0);
                      case 'sale':
                      case 'credit':       return tx.quantity * (tx.unitPrice ?? product.salePrice ?? 0);
                      case 'non_sale_exit':return tx.quantity * (tx.unitPrice ?? product.purchasePrice ?? 0);
                      default:             return null;
                    }
                  })();

                  return (
                    <tr key={tx.id} className="hover:bg-muted/30">
                      <td className="px-4 py-2.5 text-muted-foreground">{new Date(tx.date).toLocaleDateString('fr-FR')}</td>
                      <td className="px-4 py-2.5 font-medium">{product?.name || 'Inconnu'}</td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full ${info.badgeClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${info.marker}`} />{info.label}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-semibold">{tx.quantity}</td>
                      <td className="px-4 py-2.5 font-semibold">
                        {total !== null ? formatCurrency(total) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(tx.id!)} className="h-7 w-7"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <QuickAddProductDialog open={quickOpen} initialName={quickName} onClose={() => setQuickOpen(false)} onCreated={handleProductCreated} />

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Supprimer ?</AlertDialogTitle><AlertDialogDescription>Action irréversible.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTx} className="bg-destructive text-destructive-foreground">Supprimer</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}