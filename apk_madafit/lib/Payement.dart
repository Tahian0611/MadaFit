import 'package:flutter/material.dart';

class PayementPage extends StatelessWidget {
  const PayementPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white), onPressed: () => Navigator.pop(context)),
        title: const Text("PAIEMENT", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text("ABONNEMENT ACTUEL", style: TextStyle(color: Colors.white38, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            _buildCurrentPlan(),
            const SizedBox(height: 30),
            const Text("MÉTHODES DE PAIEMENT DISPONIBLES", style: TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold)),
            const SizedBox(height: 15),
            _paymentTile("MVola", "Simple & Rapide", Icons.phone_android),
            _paymentTile("Orange Money", "Sécurisé", Icons.money),
            _paymentTile("Airtel Money", "Direct", Icons.account_balance_wallet),
            const SizedBox(height: 30),
            const Text("HISTORIQUE", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
            const SizedBox(height: 10),
            _historyItem("Avril 2026", "90.000 Ar", "Payé"),
            _historyItem("Mars 2026", "90.000 Ar", "Payé"),
          ],
        ),
      ),
    );
  }

  Widget _buildCurrentPlan() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(colors: [Color(0xFFB71C1C), Color(0xFFD32F2F)]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("PACK MUSCLE +", style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
              Text("Renouvellement automatique", style: TextStyle(color: Colors.white70, fontSize: 12)),
            ],
          ),
          Text("90k Ar", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 20)),
        ],
      ),
    );
  }

  Widget _paymentTile(String name, String sub, IconData icon) {
    return Card(
      color: const Color(0xFF151515),
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        leading: Icon(icon, color: Colors.white),
        title: Text(name, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        subtitle: Text(sub, style: const TextStyle(color: Colors.white38)),
        trailing: const Icon(Icons.add_circle_outline, color: Colors.redAccent),
      ),
    );
  }

  Widget _historyItem(String date, String price, String status) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(date, style: const TextStyle(color: Colors.white70)),
      subtitle: Text(status, style: const TextStyle(color: Colors.green, fontSize: 12)),
      trailing: Text(price, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
    );
  }
}