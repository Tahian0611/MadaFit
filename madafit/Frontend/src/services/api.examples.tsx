/**
 * Example: How to use the API service in your components
 * This file demonstrates how to fetch and display data from the backend
 */

import { useEffect, useState } from 'react';
import type { User, Product, SubscriptionPlan } from '../types/entities';
import { api } from '../services/api';

// ============================================================================
// EXAMPLE 1: Fetch Users
// ============================================================================

export function UserListExample() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await api.users.getAll({
          page: 1,
          itemsPerPage: 10,
        });
        setUsers(response['hydra:member']);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  if (loading) return <div>Loading users...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      <h2>Users</h2>
      <ul>
        {users.map((user) => (
          <li key={user.id}>
            {user.firstName} {user.lastName} ({user.email})
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================================
// EXAMPLE 2: Fetch Products
// ============================================================================

export function ProductListExample() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await api.products.getAll({
          itemsPerPage: 20,
          order: { name: 'asc' },
        });
        setProducts(response['hydra:member']);
      } catch (err) {
        console.error('Failed to fetch products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  if (loading) return <div>Loading products...</div>;

  return (
    <div>
      <h2>Products</h2>
      <table>
        <thead>
          <tr>
            <th>Name</th>
            <th>Category</th>
            <th>Sale Price</th>
            <th>Stock</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td>{product.name}</td>
              <td>{product.category}</td>
              <td>${product.salePrice}</td>
              <td>{product.currentStock}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ============================================================================
// EXAMPLE 3: Fetch Subscription Plans
// ============================================================================

export function SubscriptionPlansExample() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await api.subscriptionPlans.getAll();
        setPlans(response['hydra:member']);
      } catch (err) {
        console.error('Failed to fetch plans:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPlans();
  }, []);

  if (loading) return <div>Loading plans...</div>;

  return (
    <div>
      <h2>Subscription Plans</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className="border rounded-lg p-4"
            style={{ borderColor: plan.color }}
          >
            <h3>{plan.name}</h3>
            <p className="text-2xl font-bold">${plan.price}</p>
            <p className="text-sm text-gray-600">{plan.duration} days</p>
            {plan.popular && <span className="badge">Popular</span>}
            {plan.features && (
              <ul className="mt-3 space-y-1">
                {plan.features.map((feature, idx) => (
                  <li key={idx}>✓ {feature}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EXAMPLE 4: Create a New User
// ============================================================================

export function CreateUserExample() {
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    password: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const newUser = await api.users.create({
        ...formData,
        roles: ['ROLE_USER'],
      });
      console.log('User created:', newUser);
      alert('User created successfully!');
      setFormData({ email: '', firstName: '', lastName: '', password: '' });
    } catch (err) {
      console.error('Failed to create user:', err);
      alert('Failed to create user');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create New User</h2>
      <input
        type="email"
        placeholder="Email"
        value={formData.email}
        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
        required
      />
      <input
        type="text"
        placeholder="First Name"
        value={formData.firstName}
        onChange={(e) =>
          setFormData({ ...formData, firstName: e.target.value })
        }
        required
      />
      <input
        type="text"
        placeholder="Last Name"
        value={formData.lastName}
        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
        required
      />
      <input
        type="password"
        placeholder="Password"
        value={formData.password}
        onChange={(e) =>
          setFormData({ ...formData, password: e.target.value })
        }
        required
      />
      <button type="submit" disabled={loading}>
        {loading ? 'Creating...' : 'Create User'}
      </button>
    </form>
  );
}

// ============================================================================
// EXAMPLE 5: Search and Filter
// ============================================================================

export function SearchUsersExample() {
  const [searchTerm, setSearchTerm] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      const response = await api.users.getAll({
        search: searchTerm,
        itemsPerPage: 10,
      });
      setUsers(response['hydra:member']);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSearch}>
        <input
          type="text"
          placeholder="Search users..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Searching...' : 'Search'}
        </button>
      </form>

      {users.length > 0 && (
        <div>
          <h3>Results ({users.length})</h3>
          {users.map((user) => (
            <div key={user.id} className="border-b p-2">
              {user.firstName} {user.lastName}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// EXAMPLE 6: Real-time Dashboard
// ============================================================================

export function DashboardExample() {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalProducts: 0,
    totalTransactions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const usersRes = await api.users.getAll({ itemsPerPage: 1 });
        const productsRes = await api.products.getAll({ itemsPerPage: 1 });
        const transactionsRes = await api.transactions.getAll({
          itemsPerPage: 1,
        });

        setStats({
          totalUsers: usersRes['hydra:totalItems'],
          totalProducts: productsRes['hydra:totalItems'],
          totalTransactions: transactionsRes['hydra:totalItems'],
        });
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading) return <div>Loading dashboard...</div>;

  return (
    <div>
      <h2>Dashboard</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="card">
          <h3>Total Users</h3>
          <p className="text-3xl font-bold">{stats.totalUsers}</p>
        </div>
        <div className="card">
          <h3>Total Products</h3>
          <p className="text-3xl font-bold">{stats.totalProducts}</p>
        </div>
        <div className="card">
          <h3>Total Transactions</h3>
          <p className="text-3xl font-bold">{stats.totalTransactions}</p>
        </div>
      </div>
    </div>
  );
}
