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
            const Text("BIENVENUE SUR MADAFIT APP", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ],
        ),
        const SizedBox(height: 15),
        const Text(
          "Depuis sa création, Madafit poursuit une ambition claire : élever les standards du fitness et de la musculation dans notre pays. Grâce à la confiance de milliers d'adhérents, à la passion de notre équipe et à la détermination de notre communauté, Madafit est devenu une référence incontournable, reconnue pour son excellence, son professionnalisme et ses résultats.",
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, height: 1.4),
        ),
        const SizedBox(height: 15),
        const Text(
          "Aujourd'hui, nous sommes fiers de vous présenter Madafit App, une nouvelle étape dans l'histoire de notre aventure.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "Conçue pour simplifier votre expérience et renforcer votre lien avec notre communauté, cette application vous permet de :",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        _buildBulletPoint("Créer et gérer votre identifiant adhérent."),
        _buildBulletPoint("Consulter et suivre votre abonnement en temps réel."),
        _buildBulletPoint("Visualiser votre présence et votre assiduité."),
        _buildBulletPoint("Accéder aux actualités, événements et nouveautés de Madafit."),
        _buildBulletPoint("Participer à notre journal social, un espace d'échange dédié à la vie de notre communauté."),
        const SizedBox(height: 15),
        const Text(
          "Mais Madafit est bien plus qu'une salle de sport ou une application. C'est un état d'esprit. Chaque entraînement, chaque objectif atteint, chaque défi relevé contribue à construire une version plus forte de soi-même.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "Nous croyons que les grandes réussites naissent de la régularité, de la discipline et de la persévérance. Chaque séance compte. Chaque effort compte. Chaque progrès, même le plus petit, vous rapproche de vos objectifs.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "En rejoignant Madafit, vous intégrez une communauté de femmes et d'hommes animés par la même volonté : progresser, se dépasser et inspirer les autres.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "Votre présence compte. Votre progression compte. Votre histoire compte.",
          style: TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.bold, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "Merci de faire partie de cette aventure et de contribuer chaque jour à faire de Madafit la référence du fitness dans notre pays.",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
        const SizedBox(height: 15),
        const Text(
          "Bienvenue chez Madafit.",
          style: TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold, height: 1.4),
        ),
        const SizedBox(height: 15),
        const Text(
          "Le meilleur d'aujourd'hui n'est que le point de départ du meilleur de demain. 🏆💪🔥",
          style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
        ),
      ],
    );
  }

  Widget _buildBulletPoint(String text) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8.0),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text(
            "• ",
            style: TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
          ),
          Expanded(
            child: Text(
              text,
              style: const TextStyle(color: Colors.white54, fontSize: 14, height: 1.6),
            ),
          ),
        ],
      ),
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
        _buildStatItem("300+", "MEMBRES"),
        _buildStatItem("1", "SALLES"),
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
              Text("ANKORONDRANO, ANTANANARIVO", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.phone, color: Colors.redAccent),
              SizedBox(width: 10),
              Text("+261 38 72 566 90", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          const SizedBox(height: 10),
          const Row(
            children: [
              Icon(Icons.phone, color: Colors.redAccent),
              SizedBox(width: 10),
              Text("+261 38 07 680 82", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12)),
            ],
          ),
          // const SizedBox(height: 20),
          // SizedBox(
          //   width: double.infinity,
          //   child: ElevatedButton(
          //     onPressed: () {},
          //     style: ElevatedButton.styleFrom(
          //       backgroundColor: Colors.redAccent,
          //       shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          //       padding: const EdgeInsets.symmetric(vertical: 15),
          //     ),
          //     child: const Text("NOUS CONTACTER", style: TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
          //   ),
          // )
        ],
      ),
    );
  }
}