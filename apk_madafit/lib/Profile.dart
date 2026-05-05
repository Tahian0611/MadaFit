import 'package:flutter/material.dart';
import 'settings.dart'; 

// --- NOUVEAUX IMPORTS ---
import 'QRCode.dart';
import 'Payement.dart';
import 'Mensuration.dart';

class ProfilePage extends StatelessWidget {
  const ProfilePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 1. CARTE DE MEMBRE VIRTUELLE
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.red.shade900, const Color(0xFF660000)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(25),
                boxShadow: [
                  BoxShadow(
                    color: Colors.red.withOpacity(0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  )
                ],
              ),
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 40,
                    backgroundColor: Colors.white24,
                    child: Icon(Icons.person, size: 50, color: Colors.white),
                  ),
                  const SizedBox(height: 15),
                  const Text(
                    "RAKOTO DEVEL",
                    style: TextStyle(
                      color: Colors.white, 
                      fontSize: 20, 
                      fontWeight: FontWeight.w900, 
                      letterSpacing: 1.5
                    ),
                  ),
                  const Text(
                    "MEMBRE PREMIUM",
                    style: TextStyle(
                      color: Colors.white70, 
                      fontSize: 12, 
                      fontWeight: FontWeight.w300
                    ),
                  ),
                  const SizedBox(height: 20),
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text("Objectif hebdo", style: TextStyle(color: Colors.white, fontSize: 10)),
                          Text("75%", style: TextStyle(color: Colors.white, fontSize: 10)),
                        ],
                      ),
                      const SizedBox(height: 5),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: const LinearProgressIndicator(
                          value: 0.75,
                          backgroundColor: Colors.white12,
                          valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                          minHeight: 6,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            const SizedBox(height: 25),

            // 2. GRILLE DE STATS RAPIDES
            Row(
              children: [
                _buildQuickStat("Poids", "75kg", Icons.monitor_weight_outlined),
                const SizedBox(width: 15),
                _buildQuickStat("Séances", "12", Icons.fitness_center),
              ],
            ),

            const SizedBox(height: 30),

            // 3. SECTION : INFORMATIONS DÉTAILLÉES
            const Text(
              "INFORMATIONS DÉTAILLÉES",
              style: TextStyle(
                color: Colors.grey, 
                fontSize: 12, 
                fontWeight: FontWeight.bold, 
                letterSpacing: 1.2
              ),
            ),
            const SizedBox(height: 15),
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1A1A1A),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Column(
                children: [
                  _buildDetailRow("ID Membre", "#MAD-2026-99"),
                  const Divider(color: Colors.white10, height: 25),
                  _buildDetailRow("Date d'inscription", "15 Janvier 2026"),
                  const Divider(color: Colors.white10, height: 25),
                  _buildDetailRow("Prochain prélèvement", "15 Mai 2026"),
                  const Divider(color: Colors.white10, height: 25),
                  _buildDetailRow("Coach référent", "Coach FitMania"),
                ],
              ),
            ),

            const SizedBox(height: 30),

            // 4. MENU DE GESTION (Navigation connectée)
            _buildActionCard(
              "Mon QR Code d'accès", 
              Icons.qr_code_scanner, 
              Colors.blueAccent, 
              () => _navigateTo(context, const QRCodePage()),
            ),
            _buildActionCard(
              "Historique des paiements", 
              Icons.account_balance_wallet_outlined, 
              Colors.orangeAccent, 
              () => _navigateTo(context, const PayementPage()),
            ),
            _buildActionCard(
              "Mes Mensurations", 
              Icons.straighten, 
              Colors.greenAccent, 
              () => _navigateTo(context, const MensurationPage()),
            ),
            _buildActionCard(
              "Paramètres", 
              Icons.settings_outlined, 
              Colors.grey, 
              () => _navigateTo(context, const SettingsPage()),
            ),
            
            const SizedBox(height: 100), 
          ],
        ),
      ),
    );
  }

  // --- FONCTION DE NAVIGATION UNIFIÉE ---
  void _navigateTo(BuildContext context, Widget page) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => page),
    );
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14)),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildQuickStat(String label, String value, IconData icon) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(15),
        decoration: BoxDecoration(
          color: const Color(0xFF1A1A1A),
          borderRadius: BorderRadius.circular(15),
        ),
        child: Row(
          children: [
            Icon(icon, color: Colors.redAccent, size: 30),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  value, 
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)
                ),
                Text(label, style: const TextStyle(color: Colors.grey, fontSize: 12)),
              ],
            )
          ],
        ),
      ),
    );
  }

  Widget _buildActionCard(String title, IconData icon, Color iconColor, VoidCallback onTap) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(15),
      ),
      child: ListTile(
        onTap: onTap,
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: iconColor.withOpacity(0.1), 
            borderRadius: BorderRadius.circular(10)
          ),
          child: Icon(icon, color: iconColor),
        ),
        title: Text(
          title, 
          style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w500)
        ),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      ),
    );
  }
}