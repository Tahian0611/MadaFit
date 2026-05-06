export type ProductCategory =
  | 'Boissons'
  | 'Protéines'
  | 'Barres & Biscuits'
  | 'Jus'
  | 'Suppléments'
  | 'Autre';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  purchasePrice: number;   // coût unitaire
  salePrice: number;       // prix de vente
  initialStock: number;    // stock initial à la création
  registrationDate: string; // ISO date string
  currentStock: number;    // stock actuel (mis à jour par les transactions)
}

export type TransactionType = 'entry' | 'sale' | 'non_sale_exit';

export interface Transaction {
  id: string;
  productId: string;
  type: TransactionType;
  quantity: number;
  note: string;
  date: string; // ISO datetime string
  unitPrice?: number; // prix de vente au moment de la transaction (pour les ventes)
}

export interface DailySummaryRow {
  product: Product;
  initialStock: number;
  totalEntries: number;
  totalSales: number;
  totalNonSaleExits: number;
  totalExits: number;
  finalStock: number;
  totalCost: number;         // qté vendue × prix d'achat
  revenue: number;           // qté vendue × prix de vente
  profit: number;            // revenue - totalCost
}
