import 'package:flutter/material.dart';

class ConfidentialityPage extends StatelessWidget {
  const ConfidentialityPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: _buildAppBar(context, "CONFIDENTIALITÉ"),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            _buildHeader("PROTECTION DES DONNÉES"),
            _buildText("Chez Madafit, nous respectons votre vie privée. Les données collectées (poids, mesures, fréquence cardiaque) servent exclusivement à votre suivi de performance."),
            _buildSection("1. Collecte", "Nous collectons vos informations lors de l'inscription et via les capteurs de santé."),
            _buildSection("2. Utilisation", "Vos données ne sont jamais vendues à des tiers."),
            _buildSection("3. Sécurité", "Toutes vos données sont chiffrées sur nos serveurs basés à Madagascar."),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  // --- WIDGETS REUTILISABLES ---
  PreferredSizeWidget _buildAppBar(BuildContext context, String title) {
    return AppBar(
      backgroundColor: Colors.black,
      elevation: 0,
      leading: IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20), onPressed: () => Navigator.pop(context)),
      title: Text(title, style: const TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1.2)),
      centerTitle: true,
    );
  }

  Widget _buildHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Text(title, style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 18)),
    );
  }

  Widget _buildSection(String title, String content) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SizedBox(height: 20),
        Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
        const SizedBox(height: 8),
        Text(content, style: const TextStyle(color: Colors.white60, fontSize: 13, height: 1.5)),
      ],
    );
  }

  Widget _buildText(String content) {
    return Text(content, style: const TextStyle(color: Colors.white70, fontSize: 14, height: 1.5));
  }
}