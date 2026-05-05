import 'package:flutter/material.dart';

class QRCodePage extends StatelessWidget {
  const QRCodePage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text("MON PASS ACCÈS", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Center(
                  child: ConstrainedBox(
                    // On force le contenu à prendre au moins toute la hauteur visible
                    // pour garantir le centrage vertical parfait
                    constraints: BoxConstraints(
                      minHeight: constraints.maxHeight,
                      maxWidth: 500, // Largeur max pour tablettes/web
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 20),
                          const Text(
                            "SCANNEZ À L'ENTRÉE",
                            style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, letterSpacing: 2),
                          ),
                          const SizedBox(height: 30),
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(25),
                              boxShadow: [
                                BoxShadow(
                                  color: Colors.redAccent.withOpacity(0.2),
                                  blurRadius: 20,
                                  spreadRadius: 5,
                                )
                              ],
                            ),
                            child: Image.network(
                              'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=MADAFIT-USER-12345',
                              // Taille adaptative : on utilise la largeur de l'écran avec un max de 200
                              width: constraints.maxWidth * 0.5 > 200 ? 200 : constraints.maxWidth * 0.5,
                              height: constraints.maxWidth * 0.5 > 200 ? 200 : constraints.maxWidth * 0.5,
                            ),
                          ),
                          const SizedBox(height: 40),
                          const Text(
                            "Membre Premium",
                            style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
                          ),
                          const Text(
                            "ID: MF-88920",
                            style: TextStyle(color: Colors.white38, fontSize: 12),
                          ),
                          const SizedBox(height: 50),
                          _buildInfoCard(Icons.timer_outlined, "Validité", "Jusqu'au 12/05/2026"),
                          const SizedBox(height: 20),
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

  Widget _buildInfoCard(IconData icon, String label, String value) {
    return Container(
      width: 280, // Légèrement élargi pour mieux s'adapter aux différents écrans
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(color: const Color(0xFF151515), borderRadius: BorderRadius.circular(15)),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.redAccent),
          const SizedBox(width: 15),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10)),
                Text(
                  value,
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          )
        ],
      ),
    );
  }
}