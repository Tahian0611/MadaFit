# API Platform Integration Guide

Cette documentation explique comment utiliser l'intégration API Platform dans votre projet MadaFit.

## 📋 Vue d'ensemble

Vous avez maintenant une intégration complète entre votre backend Symfony (API Platform) et votre frontend React. Toutes les entités sont exposées via des endpoints API.

## 🎯 Entités disponibles

Les 10 entités suivantes sont maintenant accessibles via API Platform:

1. **User** - Utilisateurs/Membres
2. **Product** - Produits
3. **SubscriptionPlan** - Plans d'abonnement
4. **AttendanceRecord** - Enregistrements d'présence
5. **Payment** - Paiements
6. **PaymentRecord** - Enregistrements de paiement
7. **Notification** - Notifications
8. **Transaction** - Transactions
9. **VisitRecord** - Enregistrements de visite
10. **DailySummaryRow** - Résumés quotidiens

## 📁 Fichiers créés/modifiés

### Backend (Symfony)
- ✅ Ajout de `#[ApiResource]` à toutes les entités
- ✅ Les endpoints sont maintenant disponibles via API Platform

### Frontend (React)

#### 1. **src/types/entities.ts**
Contient tous les types TypeScript pour les entités backend:
```typescript
import { User, Product, SubscriptionPlan, ... } from '@/types/entities'
```

#### 2. **src/services/api.ts**
Service centralisé pour tous les appels API:
```typescript
import { api } from '@/services/api'

// Fetch users
const response = await api.users.getAll({ page: 1, itemsPerPage: 10 })

// Create user
const newUser = await api.users.create({ email: 'user@example.com', ... })

// Update user
const updated = await api.users.update(1, { firstName: 'John' })

// Delete user
await api.users.delete(1)
```

#### 3. **src/hooks/useApi.ts**
Hooks React personnalisés pour simplifier l'accès aux données:
- `useFetch()` - Fetch simple
- `usePaginatedFetch()` - Fetch avec pagination
- `useSearch()` - Recherche
- `useApiMutation()` - Mutations (créer, mettre à jour, supprimer)
- `useForm()` - Gestion de formulaires

#### 4. **src/services/api.examples.tsx**
Exemples d'utilisation complète

## 🚀 Utilisation rapide

### Exemple 1: Afficher une liste d'utilisateurs

```tsx
import { usePaginatedFetch } from '@/hooks/useApi'
import { api } from '@/services/api'
import type { User } from '@/types/entities'

export function UserList() {
  const { items: users, loading, error } = usePaginatedFetch(
    api.users.getAll,
    10
  )

  if (loading) return <div>Chargement...</div>
  if (error) return <div>Erreur: {error.message}</div>

  return (
    <ul>
      {users.map((user) => (
        <li key={user.id}>
          {user.firstName} {user.lastName}
        </li>
      ))}
    </ul>
  )
}
```

### Exemple 2: Créer un nouvel utilisateur

```tsx
import { useApiMutation } from '@/hooks/useApi'
import { api } from '@/services/api'
import type { User } from '@/types/entities'

export function CreateUserForm() {
  const { submit, loading, error } = useApiMutation(api.users.create)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    try {
      const newUser = await submit({
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        password: 'password123',
        roles: ['ROLE_USER'],
      })
      console.log('User created:', newUser)
    } catch (err) {
      console.error('Error:', err)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* form fields */}
      <button disabled={loading}>{loading ? 'Creating...' : 'Create'}</button>
      {error && <div>Error: {error.message}</div>}
    </form>
  )
}
```

### Exemple 3: Recherche

```tsx
import { useSearch } from '@/hooks/useApi'
import { api } from '@/services/api'

export function SearchUsers() {
  const { results, search, loading } = useSearch(
    (query) => api.users.getAll({ search: query })
  )

  return (
    <div>
      <input
        type="text"
        placeholder="Rechercher..."
        onChange={(e) => search(e.target.value)}
      />
      {results.map((user) => (
        <div key={user.id}>{user.firstName} {user.lastName}</div>
      ))}
    </div>
  )
}
```

### Exemple 4: Avec le hook useForm

```tsx
import { useForm } from '@/hooks/useApi'
import { api } from '@/services/api'

export function UserForm() {
  const { values, errors, handleChange, handleSubmit } = useForm(
    { email: '', firstName: '', lastName: '' },
    async (data) => {
      await api.users.create({
        ...data,
        password: 'default123',
        roles: ['ROLE_USER'],
      })
    },
    (values) => {
      const errors: Record<string, string> = {}
      if (!values.email) errors.email = 'Email required'
      if (!values.firstName) errors.firstName = 'First name required'
      return errors
    }
  )

  return (
    <form onSubmit={handleSubmit}>
      <input
        name="email"
        value={values.email}
        onChange={handleChange}
        placeholder="Email"
      />
      {errors.email && <span>{errors.email}</span>}
      
      {/* Other fields */}
      
      <button type="submit">Submit</button>
    </form>
  )
}
```

## 📡 Configuration API

### URL Backend
L'URL du backend est définie dans `.env`:
```
VITE_API_URL=https://127.0.0.1:8000
```

### Format des données
API Platform utilise le format **JSON-LD** (Linked Data):
```json
{
  "@context": "/api/contexts/User",
  "@id": "/api/users",
  "@type": "hydra:Collection",
  "hydra:member": [
    {
      "@id": "/api/users/1",
      "@type": "User",
      "id": 1,
      "email": "user@example.com"
    }
  ],
  "hydra:totalItems": 100
}
```

## 🔑 Endpoints disponibles

### Structure générale

Pour chaque entité `{entity}`, les endpoints suivants sont disponibles:

```
GET    /api/{entity}           # Lister (avec pagination et filtres)
GET    /api/{entity}/{id}      # Récupérer un item
POST   /api/{entity}           # Créer
PUT    /api/{entity}/{id}      # Mettre à jour
DELETE /api/{entity}/{id}      # Supprimer
```

### Exemples d'endpoints

```
GET    /api/users              # Liste des utilisateurs
GET    /api/users/1            # Utilisateur avec ID 1
POST   /api/users              # Créer un utilisateur
PUT    /api/users/1            # Mettre à jour l'utilisateur 1
DELETE /api/users/1            # Supprimer l'utilisateur 1

GET    /api/products           # Liste des produits
GET    /api/subscription_plans # Plans d'abonnement
GET    /api/payments           # Paiements
GET    /api/notifications      # Notifications
```

## 📝 Options de requête

### Pagination
```typescript
api.users.getAll({
  page: 1,
  itemsPerPage: 10
})
```

### Tri
```typescript
api.products.getAll({
  order: {
    name: 'asc',
    price: 'desc'
  }
})
```

### Recherche
```typescript
api.users.getAll({
  search: 'john'
})
```

### Filtres personnalisés
```typescript
api.users.getAll({
  filters: {
    status: 'active',
    subscription: 'premium'
  }
})
```

## ✅ Prochaines étapes

1. **Vérifier que le backend est en cours d'exécution**
   ```bash
   cd Backend
   symfony serve
   ```

2. **Tester les endpoints avec Postman/Insomnia**
   - Importer l'API: `https://127.0.0.1:8000/api/docs`

3. **Intégrer dans vos pages React**
   - Utiliser les hooks `usePaginatedFetch`, `useSearch`, etc.
   - Voir `src/services/api.examples.tsx` pour des exemples complets

4. **Ajouter l'authentification** (optionnel)
   - Configurer JWT tokens dans API Platform
   - Ajouter les tokens aux headers des requêtes

## 🐛 Dépannage

### "API not found" ou erreur 404
- Vérifier que le backend Symfony est en cours d'exécution
- Vérifier l'URL dans `.env`

### Erreur CORS
- Vérifier la configuration `nelmio_cors.yaml` du backend
- Assurez-vous que le frontend est autorisé à accéder au backend

### Les types TypeScript ne correspondent pas
- Régénérer les types après modification des entités Symfony
- Mettre à jour `src/types/entities.ts`

## 📚 Ressources

- [API Platform Documentation](https://api-platform.com/)
- [Symfony Documentation](https://symfony.com/doc)
- [React Hooks Guide](https://react.dev/reference/react/hooks)
