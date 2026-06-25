import 'package:flutter/material.dart';

class CAPage extends StatelessWidget {
  const CAPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20), onPressed: () => Navigator.pop(context)),
        title: const Text("CENTRE D'AIDE", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        centerTitle: true,
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Text("QUESTIONS FRÉQUENTES", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 20),
          _buildFaqItem("Comment renouveler mon abonnement ?", "Vous pouvez renouveler directement via l'application par MVola ou directement à l'accueil de votre salle Madafit."),
          _buildFaqItem("J'ai oublié mon mot de passe", "Cliquez sur 'Mot de passe oublié' à l'écran de connexion pour recevoir un lien de réinitialisation."),
          _buildFaqItem("Puis-je changer de salle ?", "Oui, selon votre type d'abonnement, l'accès peut être multi-salles."),
          const SizedBox(height: 40),
          const Center(child: Text("Besoin d'aide supplémentaire ?", style: TextStyle(color: Colors.white38))),
          const SizedBox(height: 15),
          ElevatedButton.icon(
            onPressed: () {}, // Action pour contacter support
            icon: const Icon(Icons.support_agent),
            label: const Text("CONTACTER LE SUPPORT"),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              padding: const EdgeInsets.symmetric(vertical: 15),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          )
        ],
      ),
    );
  }

  Widget _buildFaqItem(String question, String answer) {
    return Theme(
      data: ThemeData.dark().copyWith(dividerColor: Colors.transparent),
      child: ExpansionTile(
        title: Text(question, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)),
        iconColor: Colors.redAccent,
        children: [
          Padding(
            padding: const EdgeInsets.only(left: 15, right: 15, bottom: 15),
            child: Text(answer, style: const TextStyle(color: Colors.white54, fontSize: 13)),
          ),
        ],
      ),
    );
  }
}