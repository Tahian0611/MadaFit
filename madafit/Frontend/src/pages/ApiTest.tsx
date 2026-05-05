import { useQuery } from "@tanstack/react-query";
import api from "@/services/api";
import { extractHydraMembers } from "@/lib/madafit";
import { 
  Users, 
  Package, 
  CreditCard, 
  Activity,
  CheckCircle2,
  XCircle,
  Loader2
} from "lucide-react";

export default function ApiTest() {
  // 1. Fetch Users
  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 5 }),
  });

  // 2. Fetch Products
  const productsQuery = useQuery({
    queryKey: ["products"],
    queryFn: () => api.products.getAll({ itemsPerPage: 5 }),
  });

  // 3. Fetch Subscription Plans
  const plansQuery = useQuery({
    queryKey: ["subscriptionPlans"],
    queryFn: () => api.subscriptionPlans.getAll(),
  });

  const users = extractHydraMembers(usersQuery.data);
  const products = extractHydraMembers(productsQuery.data);
  const plans = extractHydraMembers(plansQuery.data);

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">
      <header>
        <h1 className="text-3xl font-black text-foreground">API Status & Live Data</h1>
        <p className="text-muted-foreground mt-1">Verification of Symfony API Platform integration</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatusCard 
          title="Users API" 
          icon={<Users className="text-blue-500" />} 
          query={usersQuery} 
          count={users.length}
        />
        <StatusCard 
          title="Products API" 
          icon={<Package className="text-orange-500" />} 
          query={productsQuery} 
          count={products.length}
        />
        <StatusCard 
          title="Plans API" 
          icon={<CreditCard className="text-green-500" />} 
          query={plansQuery} 
          count={plans.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Users List */}
        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Users size={20} className="text-primary" />
            <h2 className="text-xl font-bold">Recent Users</h2>
          </div>
          {usersQuery.isLoading ? (
            <LoadingState />
          ) : users.length > 0 ? (
            <div className="space-y-3">
              {users.map((user) => (
                <div key={user.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-colors">
                  <div>
                    <p className="font-semibold">{user.firstName} {user.lastName}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                  <span className="text-xs font-mono bg-primary/10 text-primary px-2 py-1 rounded">ID: {user.id}</span>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No users found in database" />
          )}
        </div>

        {/* Products List */}
        <div className="bg-card rounded-2xl border p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <Package size={20} className="text-primary" />
            <h2 className="text-xl font-bold">Latest Products</h2>
          </div>
          {productsQuery.isLoading ? (
            <LoadingState />
          ) : products.length > 0 ? (
            <div className="space-y-3">
              {products.map((product) => (
                <div key={product.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-transparent hover:border-primary/20 transition-colors">
                  <div>
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.category}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary">{product.salePrice}€</p>
                    <p className="text-[10px] text-muted-foreground">Stock: {product.currentStock}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState message="No products found in database" />
          )}
        </div>
      </div>

      <div className="bg-card rounded-2xl border p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Activity size={20} className="text-primary" />
          <h2 className="text-xl font-bold">Debug Information</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 rounded-lg bg-black text-green-400 overflow-auto max-h-64">
            <p className="text-white mb-2 underline">// API Endpoints Tested:</p>
            <p>GET /api/users</p>
            <p>GET /api/products</p>
            <p>GET /api/subscription_plans</p>
            <p className="mt-4 text-white underline">// Last Response Metadata (Users):</p>
            <pre>{JSON.stringify(usersQuery.data?.["hydra:view"] || "No metadata", null, 2)}</pre>
          </div>
          <div className="p-4 rounded-lg bg-muted/50">
            <p className="font-bold mb-2">Integration Summary:</p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>Backend: Symfony + API Platform</li>
              <li>Format: JSON-LD (application/ld+json)</li>
              <li>Frontend: React + TanStack Query</li>
              <li>Service: Centralized Axios-like fetcher</li>
              <li>CORS: Enabled via NelmioCorsBundle</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ title, icon, query, count }: { title: string, icon: React.ReactNode, query: any, count: number }) {
  const isError = query.isError;
  const isLoading = query.isLoading;

  return (
    <div className="bg-card rounded-2xl border p-5 flex items-center justify-between shadow-sm">
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-xl bg-muted">
          {icon}
        </div>
        <div>
          <p className="text-sm text-muted-foreground font-medium">{title}</p>
          <p className="text-2xl font-black">{isLoading ? "..." : count}</p>
        </div>
      </div>
      <div>
        {isError ? (
          <XCircle className="text-destructive" size={24} />
        ) : isLoading ? (
          <Loader2 className="text-muted-foreground animate-spin" size={24} />
        ) : (
          <CheckCircle2 className="text-green-500" size={24} />
        )}
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Loader2 className="animate-spin mb-4" size={32} />
      <p className="text-sm font-medium">Fetching data from API...</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground border-2 border-dashed rounded-xl">
      <p className="text-sm font-medium">{message}</p>
    </div>
  );
}
