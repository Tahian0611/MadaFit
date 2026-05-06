# TODO - Fix Rafraîchissement Automatique Web

## Problème
L'application web se rafraîchit automatiquement après la connexion, causant une mauvaise UX.

## Cause racine
4 problèmes identifiés dans le Frontend :
1. Polling notifications toutes les 15s (trop fréquent)
2. React Query refetchOnWindowFocus activé par défaut
3. window.location.href="/login" dans logout() (reload hard)
4. Double event storage au login (double re-render)

## Plan de correction

- [ ] 1. `Frontend/src/contexts/NotificationContext.tsx` — Augmenter polling 15s → 60s
- [ ] 2. `Frontend/src/App.tsx` — Désactiver refetchOnWindowFocus + refetchOnReconnect
- [ ] 3. `Frontend/src/services/api.ts` — Supprimer window.location.href dans logout()
- [ ] 4. `Frontend/src/pages/Login.tsx` — Supprimer double storage event redondant

## Tests à effectuer après correction

- [ ] Login → vérifier pas de double re-render
- [ ] Rester sur Dashboard → vérifier pas de refresh toutes les 15s
- [ ] Changer d'onglet et revenir → vérifier pas de re-fetch auto
- [ ] Logout → vérifier redirection propre sans reload hard
