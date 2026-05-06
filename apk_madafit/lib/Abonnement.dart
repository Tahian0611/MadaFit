import 'package:flutter/material.dart';

class AbonnementPage extends StatelessWidget {
  const AbonnementPage({super.key});

  @override
  Widget build(BuildContext context) {
    // 1. On récupère la hauteur de la barre système (encoche du bas)
    final double systemBottomPadding = MediaQuery.of(context).padding.bottom;
    // 2. On définit une marge fixe pour la barre de navigation (généralement entre 70 et 90)
    const double footerNavbarHeight = 85.0;

    return Scaffold(
      backgroundColor: Colors.black,
      
      body: SingleChildScrollView(
        // On garde le padding horizontal, mais on gère le bas via le Column
        padding: const EdgeInsets.symmetric(horizontal: 20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 10),
            _buildHeader(),
            const SizedBox(height: 30),
            
            // OFFRE 1 : DÉBUTANT
            _buildSubscriptionCard(
              title: "PACK STARTER",
              price: "80.000",
              period: "/ mois",
              color: Colors.grey[800]!,
              features: ["Accès Muscu & Cardio", "Vestiaire & Douche", "1 Séance bilan offerte"],
            ),

            // OFFRE 2 : LA PLUS POPULAIRE
            _buildSubscriptionCard(
              title: "MUSCLE +",
              price: "120.000",
              period: "/ mois",
              color: Colors.redAccent,
              features: [
                "Accès illimité 24/7", 
                "Programme d'entraînement personnalisé", 
                "Accès aux cours collectifs",
                "Suivi mensuel avec coach"
              ],
              isPopular: true,
            ),

            // OFFRE 3 : VIP / ATHLÈTE
            _buildSubscriptionCard(
              title: "ELITE ATHLETE",
              price: "250.000",
              period: "/ mois",
              color: const Color(0xFFFFD700),
              features: [
                "Tout le Pack Muscle+", 
                "Plan nutritionnel complet", 
                "Espace récupération (Sauna/Massage)",
                "Boisson protéinée après chaque séance",
                "Accès à toutes les salles Madafit"
              ],
            ),
            
            const SizedBox(height: 20),
            _buildPaymentInfo(),

            // --- L'ÉLÉMENT CLÉ POUR LE FOOTER ---
            // On ajoute un espace vide égal à l'encoche + la hauteur du menu
            SizedBox(height: systemBottomPadding + footerNavbarHeight + 20),
          ],
        ),
      ),
    );
  }

  // --- Tes widgets de composants (Header, Card, PaymentInfo) restent identiques ---
  // ... (Garde le code de tes méthodes _buildHeader, _buildSubscriptionCard, etc. tel quel)
  
  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "CHOISISSEZ VOTRE\nDESTIN.",
          style: TextStyle(color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1.1),
        ),
        const SizedBox(height: 10),
        Text(
          "Peu importe votre niveau, nous avons le plan parfait pour vous faire progresser.",
          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildSubscriptionCard({
    required String title,
    required String price,
    required String period,
    required Color color,
    required List<String> features,
    bool isPopular = false,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(
          color: isPopular ? color : Colors.white.withOpacity(0.05),
          width: 2,
        ),
      ),
      child: Stack(
        children: [
          if (isPopular)
            Positioned(
              top: 0,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: const BorderRadius.only(bottomLeft: Radius.circular(10), bottomRight: Radius.circular(10)),
                ),
                child: const Text("POPULAIRE", style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(25.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: TextStyle(color: color, fontWeight: FontWeight.bold, letterSpacing: 1)),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text("$price Ar", style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 5, left: 4),
                      child: Text(period, style: const TextStyle(color: Colors.white38, fontSize: 14)),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(color: Colors.white10),
                const SizedBox(height: 15),
                ...features.map((f) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: Row(
                    children: [
                      Icon(Icons.check_circle, color: color, size: 18),
                      const SizedBox(width: 10),
                      Expanded(child: Text(f, style: const TextStyle(color: Colors.white70, fontSize: 13))),
                    ],
                  ),
                )).toList(),
                const SizedBox(height: 25),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {},
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isPopular ? color : Colors.white,
                      foregroundColor: isPopular ? Colors.white : Colors.black,
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                    ),
                    child: const Text("S'ABONNER MAINTENANT", style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: Colors.white38),
          const SizedBox(width: 15),
          Expanded(
            child: Text(
              "Paiements acceptés via MVola, AirtelMoney ou directement à la salle. Sans engagement.",
              style: TextStyle(color: Colors.white.withOpacity(0.4), fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }
}