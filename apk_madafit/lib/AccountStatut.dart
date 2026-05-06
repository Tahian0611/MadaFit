// ignore: file_names
import 'package:flutter/material.dart';

class AccountStatusPage extends StatelessWidget {
  const AccountStatusPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text("STATUT", 
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 25),
                child: Center(
                  child: ConstrainedBox(
                    // On définit une largeur max pour les tablettes/écrans larges
                    // et on force la hauteur minimum sur la hauteur de l'écran
                    constraints: BoxConstraints(
                      maxWidth: 500,
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        children: [
                          const SizedBox(height: 40),
                          
                          // --- BADGE DE STATUT ---
                          Center(
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Container(
                                  width: 120,
                                  height: 120,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.redAccent.withOpacity(0.2), width: 8),
                                  ),
                                ),
                                const Icon(Icons.verified_rounded, color: Colors.redAccent, size: 80),
                              ],
                            ),
                          ),
                          
                          const SizedBox(height: 20),
                          const Text(
                            "COMPTE VÉRIFIÉ",
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22),
                          ),
                          const Text(
                            "Membre Premium Madafit",
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600, fontSize: 14),
                          ),

                          const SizedBox(height: 40),

                          // --- DETAILS DU COMPTE ---
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: const Color(0xFF151515),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildStatusRow("ID Membre", "#MF-2026-99"),
                                const Divider(color: Colors.white10, height: 30),
                                _buildStatusRow("Type d'adhésion", "Annuel (Full Access)"),
                                const Divider(color: Colors.white10, height: 30),
                                _buildStatusRow("Prochain renouvellement", "15 Sept. 2026"),
                                const Divider(color: Colors.white10, height: 30),
                                _buildStatusRow("Statut médical", "À jour", color: Colors.greenAccent),
                              ],
                            ),
                          ),

                          // Remplace le Spacer() pour fonctionner dans un IntrinsicHeight/SingleChildScrollView
                          const Expanded(child: SizedBox(height: 40)),
                          
                          // --- PETIT MESSAGE D'ENCOURAGEMENT ---
                          const Text(
                            "Votre discipline est votre seule limite.",
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white24, fontStyle: FontStyle.italic, fontSize: 12),
                          ),
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, {Color color = Colors.white}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(label, style: const TextStyle(color: Colors.white38, fontSize: 13)),
        ),
        const SizedBox(width: 10),
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}