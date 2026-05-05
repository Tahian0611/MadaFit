import 'package:flutter/material.dart';

class CGUPage extends StatelessWidget {
  const CGUPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20), onPressed: () => Navigator.pop(context)),
        title: const Text("CONDITIONS GÉNÉRALES", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("RÈGLEMENT INTÉRIEUR MADAFIT", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 18)),
            const SizedBox(height: 20),
            _item("Accès", "L'accès à la salle nécessite un abonnement valide et le port d'une tenue de sport propre."),
            _item("Santé", "L'utilisateur certifie être en bonne santé physique. Un certificat médical est recommandé."),
            _item("Responsabilité", "Madafit décline toute responsabilité en cas de perte ou de vol d'objets personnels."),
            _item("Matériel", "Veuillez ranger le matériel (haltères, bancs) après chaque utilisation."),
          ],
        ),
      ),
    );
  }

  Widget _item(String title, String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 25),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1)),
          const SizedBox(height: 8),
          Text(text, style: const TextStyle(color: Colors.white54, fontSize: 13)),
        ],
      ),
    );
  }
}