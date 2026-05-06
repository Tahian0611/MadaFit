# MadaFit Officiel
![alt text](<Capture d’écran (8).png>)
![alt text](<Capture d’écran (9).png>)

MadaFit est une solution complète de gestion pour salle de sport, intégrant un système de contrôle d'accès en temps réel (RFID & QR Code), une gestion des membres, des abonnements, et des stocks.

## 🚀 Technologies Utilisées

### Backend
- **Framework**: Symfony 7.4
- **API**: API Platform 4.3 (REST, JSON-LD)
- **Authentification**: JWT (LexikJWTAuthenticationBundle)
- **Base de données**: MySQL / MariaDB
- **Langage**: PHP 8.2+

### Frontend
- **Framework**: React 18 (Vite + TypeScript)
- **Styling**: Tailwind CSS + Shadcn/UI
- **State Management**: TanStack Query (React Query)
- **Icons**: Lucide React
- **Notifications**: Sonner

---

## 🛠 Installation et Configuration

### 1. Prérequis
- **PHP 8.2** ou supérieur
- **Composer**
- **Node.js** (v18+) & **npm** / **bun**
- **Symfony CLI** (optionnel mais recommandé)
- **MySQL** / **MariaDB**

### 2. Installation du Backend
```bash
cd Backend
composer install
```

#### Configuration du .env
Créez ou modifiez le fichier `.env` (ou `.env.local`) :
```env
DATABASE_URL="mysql://root:@127.0.0.1:3306/madafit_db?serverVersion=8.0&charset=utf8mb4"
```

#### Génération des clés JWT
```bash
php bin/console lexik:jwt:generate-keypair
```

#### Migration de la base de données
```bash
php bin/console doctrine:database:create --if-not-exists
php bin/console doctrine:migrations:migrate
```

### 3. Installation du Frontend
```bash
cd Frontend
npm install
```

---

## 🏃 Démarrage du Projet

### Lancer le Backend
```bash
cd Backend
symfony serve -d
# OU
php -S localhost:8000 -t public
```

### Lancer le Frontend
```bash
cd Frontend
npm run dev
```
L'application sera accessible sur [http://localhost:5173](http://localhost:5173).

---

## 🔑 Accès Admin
L'interface d'administration est protégée par un système de rôles. Seuls les comptes possédant le rôle `ROLE_ADMIN` peuvent se connecter.

---

## 📋 Fonctionnalités Principales
- **Tableau de Bord**: Statistiques en temps réel sur les membres et les revenus.
- **Contrôle d'Accès**: Monitoring des passages par scan QR Code et RFID.
- **Gestion des Membres**: Inscription, suivi des abonnements et historique.
- **Gestion des Produits**: Inventaire et rapports de stock.
- **Notifications**: Alertes pour les abonnements expirants.

---

## 📄 Licence
Propriétaire - Tous droits réservés à Eray Digital.

## 👨‍💻 Développeurs
Ce projet a été développé par :
- **Fabrice Faniry RANDT**
- **Tahiana Ramanantsialonina.**

