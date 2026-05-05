import 'package:flutter/material.dart';

class AproposPage extends StatelessWidget {
  const AproposPage({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: CustomScrollView(
        slivers: [
          // Header avec image et effet parallaxe
          SliverAppBar(
            expandedHeight: 250,
            backgroundColor: Colors.black,
            flexibleSpace: FlexibleSpaceBar(
              centerTitle: true,
              background: Stack(
                fit: StackFit.expand,
                children: [
                  Image.network(
                    'https://images.unsplash.com/photo-1534438327276-14e5300c3a48', // Image de salle premium
                    fit: BoxFit.cover,
                  ),
                  const DecoratedBox(
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.topCenter,
                        end: Alignment.bottomCenter,
                        colors: [Colors.transparent, Colors.black],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          SliverList(
            delegate: SliverChildListDelegate([
              Padding(
                padding: const EdgeInsets.all(20.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildBrandStory(),
                    const SizedBox(height: 30),
                    _buildMissionSection(),
                    const SizedBox(height: 30),
                    _buildStatGrid(),
                    const SizedBox(height: 30),
                    _buildValueSection(),
                    const SizedBox(height: 40),
                    _buildLocationContact(),
                    const SizedBox(height: 100), // Espace pour le footer
                  ],
                ),
              ),
            ]),
          ),
        ],
      ),
    );
  }

  // --- COMPOSANTS DE LA PAGE ---

  Widget _buildBrandStory() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Container(width: 40, height: 4, color: Colors.redAccent),
            const SizedBox(width: 10),
            const Text("NOTRE HISTOIRE", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 15),
        const Text(
          "Madafit United est bien plus qu'une simple salle de sport. Situé au cœur d'Ankorondrano, notre complexe est le temple du fitness et du bodybuilding à Madagascar.",
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, height: 1.4),
        ),
        const SizedBox(height: 15),
        const Text(
          "Fondé par Tina Badano, Madafit s'est imposé comme le sponsor leader des athlètes malgaches sur la scène internationale, offrant un équipement de pointe et un accompagnement d'élite pour repousser toutes les limites.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
      ],
    );
  }

  Widget _buildMissionSection() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF101010),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white10),
      ),
      child: Column(
        children: [
          const Icon(Icons.bolt, color: Colors.redAccent, size: 40),
          const SizedBox(height: 10),
          const Text("NOTRE MISSION", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 10),
          const Text(
            "Démocratiser le fitness haut de gamme et accompagner chaque Malgache, du débutant à l'athlète pro, vers sa meilleure version physique et mentale.",
            textAlign: TextAlign.center,
            style: TextStyle(color: Colors.white54, fontSize: 13, height: 1.5),
          ),
        ],
      ),
    );
  }

  Widget _buildStatGrid() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        _buildStatItem("15+", "COACHS"),
        _buildStatItem("1000+", "MEMBRES"),
        _buildStatItem("2", "SALLES"),
        _buildStatItem("24/7", "SUPPORT"),
      ],
    );
  }

  Widget _buildStatItem(String val, String label) {
    return Column(
      children: [
        Text(val, style: const TextStyle(color: Colors.redAccent, fontSize: 20, fontWeight: FontWeight.w900)),
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 9, fontWeight: FontWeight.bold)),
      ],
    );
  }

  Widget _buildValueSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text("NOS VALEURS", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16)),
        const SizedBox(height: 20),
        _buildValueRow(Icons.star, "Excellence", "Équipements importés et suivi rigoureux."),
        _buildValueRow(Icons.people, "Communauté", "Un esprit d'entraide unique à Madagascar."),
        _buildValueRow(Icons.workspace_premium, "Discipline", "La clé de vos résultats durables."),
      ],
    );
  }

  Widget _buildValueRow(IconData icon, String title, String sub) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20),
      child: Row(
        children: [
          Icon(icon, color: Colors.white24, size: 24),
          const SizedBox(width: 15),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                Text(sub, style: const TextStyle(color: Colors.white38, fontSize: 12)),
              ],
            ),
          )
        ],
      ),
    );
  }

  Widget _buildLocationContact() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: LinearGradient(colors: [Colors.redAccent.withOpacity(0.1), Colors.transparent]),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Column(
        children: [
          const Row(
            children: [
              Icon(Icons.location_on, color: Colors.redAccent),
              SizedBox(width: 10),
              Text("AN KORONDRANO, ANTANANARIVO", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.phone, color: Colors.redAccent),
              SizedBox(width: 10),
              Text("+261 34 XX XXX XX", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 20),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                padding: const EdgeInsets.symmetric(vertical: 15),
              ),
              child: const Text("NOUS CONTACTER", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            ),
          )
        ],
      ),
    );
  }
}