import { Product, Transaction, ProductCategory } from './types';

// ─── Keys ─────────────────────────────────────────────────────────────────────
const PRODUCTS_KEY = 'mada_fitness_products';
const TRANSACTIONS_KEY = 'mada_fitness_transactions';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ─── Products ─────────────────────────────────────────────────────────────────
export function getProducts(): Product[] {
  try {
    return JSON.parse(localStorage.getItem(PRODUCTS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveProducts(products: Product[]): void {
  localStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
}

export function addProduct(
  data: Omit<Product, 'id' | 'currentStock'>
): Product {
  const products = getProducts();
  const product: Product = {
    ...data,
    id: generateId(),
    currentStock: data.initialStock,
  };
  products.push(product);
  saveProducts(products);
  return product;
}

export function updateProduct(
  id: string,
  data: Partial<Omit<Product, 'id'>>
): Product | null {
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === id);
  if (idx === -1) return null;
  products[idx] = { ...products[idx], ...data };
  saveProducts(products);
  return products[idx];
}

export function deleteProduct(id: string): void {
  const products = getProducts().filter((p) => p.id !== id);
  saveProducts(products);
  // also clean up transactions
  const txs = getTransactions().filter((t) => t.productId !== id);
  saveTransactions(txs);
}

export function getProductById(id: string): Product | undefined {
  return getProducts().find((p) => p.id === id);
}

// ─── Transactions ─────────────────────────────────────────────────────────────
export function getTransactions(): Transaction[] {
  try {
    return JSON.parse(localStorage.getItem(TRANSACTIONS_KEY) || '[]');
  } catch {
    return [];
  }
}

export function saveTransactions(transactions: Transaction[]): void {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

export function addTransaction(
  data: Omit<Transaction, 'id'>
): Transaction {
  const transactions = getTransactions();
  const transaction: Transaction = { ...data, id: generateId() };
  transactions.push(transaction);
  saveTransactions(transactions);

  // Update currentStock of the product
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === data.productId);
  if (idx !== -1) {
    if (data.type === 'entry') {
      products[idx].currentStock += data.quantity;
    } else {
      products[idx].currentStock = Math.max(
        0,
        products[idx].currentStock - data.quantity
      );
    }
    saveProducts(products);
  }

  return transaction;
}

export function deleteTransaction(id: string): void {
  const tx = getTransactions().find((t) => t.id === id);
  if (!tx) return;

  // Reverse stock effect
  const products = getProducts();
  const idx = products.findIndex((p) => p.id === tx.productId);
  if (idx !== -1) {
    if (tx.type === 'entry') {
      products[idx].currentStock = Math.max(
        0,
        products[idx].currentStock - tx.quantity
      );
    } else {
      products[idx].currentStock += tx.quantity;
    }
    saveProducts(products);
  }

  saveTransactions(getTransactions().filter((t) => t.id !== id));
}

// ─── Filtering ────────────────────────────────────────────────────────────────
export function getTransactionsInRange(
  from: Date,
  to: Date,
  productId?: string
): Transaction[] {
  return getTransactions().filter((t) => {
    const d = new Date(t.date);
    const inRange = d >= from && d <= to;
    if (productId) return inRange && t.productId === productId;
    return inRange;
  });
}

// ─── Summary Calculations ────────────────────────────────────────────────────
export function computeDailySummary(from: Date, to: Date) {
  const products = getProducts();
  const txs = getTransactionsInRange(from, to);

  // Get transactions BEFORE the period to compute initial stock for the period
  const txsBefore = getTransactions().filter((t) => new Date(t.date) < from);

  return products.map((product) => {
    const productTxsBefore = txsBefore.filter(
      (t) => t.productId === product.id
    );
    // Recompute stock at start of period
    let stockAtStart = product.initialStock;
    for (const t of productTxsBefore) {
      if (t.type === 'entry') stockAtStart += t.quantity;
      else stockAtStart -= t.quantity;
    }
    stockAtStart = Math.max(0, stockAtStart);

    const productTxs = txs.filter((t) => t.productId === product.id);
    let totalEntries = 0;
    let totalSales = 0;
    let totalNonSaleExits = 0;

    for (const t of productTxs) {
      if (t.type === 'entry') totalEntries += t.quantity;
      else if (t.type === 'sale') totalSales += t.quantity;
      else totalNonSaleExits += t.quantity;
    }

    const totalExits = totalSales + totalNonSaleExits;
    const finalStock = Math.max(0, stockAtStart + totalEntries - totalExits);
    const totalCost = totalSales * product.purchasePrice;
    const revenue = totalSales * product.salePrice;
    const profit = revenue - totalCost;

    return {
      product,
      initialStock: stockAtStart,
      totalEntries,
      totalSales,
      totalNonSaleExits,
      totalExits,
      finalStock,
      totalCost,
      revenue,
      profit,
    };
  });
}

export function getTodayRange(): { from: Date; to: Date } {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  return { from, to };
}

// ─── Seed data (demo) ────────────────────────────────────────────────────────
export function seedDemoData(): void {
  if (getProducts().length > 0) return;

  const categories: ProductCategory[] = [
    'Boissons',
    'Protéines',
    'Barres & Biscuits',
    'Jus',
    'Suppléments',
  ];

  const demoProducts = [
    { name: 'Eau minérale 50cl', category: 'Boissons' as ProductCategory, purchasePrice: 200, salePrice: 500, initialStock: 50 },
    { name: 'Eau gazeuse 33cl', category: 'Boissons' as ProductCategory, purchasePrice: 300, salePrice: 700, initialStock: 30 },
    { name: 'Whey Protéine (sac 1kg)', category: 'Protéines' as ProductCategory, purchasePrice: 15000, salePrice: 22000, initialStock: 10 },
    { name: 'Biscuits protéinés', category: 'Barres & Biscuits' as ProductCategory, purchasePrice: 500, salePrice: 1000, initialStock: 40 },
    { name: 'Jus d\'orange naturel', category: 'Jus' as ProductCategory, purchasePrice: 800, salePrice: 1500, initialStock: 25 },
    { name: 'BCAA (pot 300g)', category: 'Suppléments' as ProductCategory, purchasePrice: 8000, salePrice: 12000, initialStock: 8 },
    { name: 'Barre énergétique', category: 'Barres & Biscuits' as ProductCategory, purchasePrice: 600, salePrice: 1200, initialStock: 35 },
    { name: 'Jus de mangue 25cl', category: 'Jus' as ProductCategory, purchasePrice: 400, salePrice: 800, initialStock: 5 },
  ];

  const today = new Date().toISOString();
  demoProducts.forEach((p) => {
    addProduct({ ...p, registrationDate: today });
  });
}
