import 'package:flutter/material.dart';

// --- TES IMPORTS ---
import 'apropos.dart';
import 'abonnement.dart';
import 'profile.dart';
import 'notification.dart';

class HomeScreen extends StatefulWidget {
  final VoidCallback onLogout;
  const HomeScreen({super.key, required this.onLogout});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  // Titres du Header unique
  final List<String> _titles = [
    "ARTICLES",
    "À PROPOS",
    "NOS OFFRES",
    "MON PROFIL",
    "NOTIFICATIONS",
  ];

  late final List<Widget> _pages;

  @override
  void initState() {
    super.initState();
    // On définit les 5 pages ici. 
    // L'index 0 utilise le widget défini en bas de ce fichier.
    _pages = [
      const ContenuArticlesPage(), // Ta page d'actualités (voir en bas)
      const AproposPage(),
      const AbonnementPage(),
      const ProfilePage(),
      const NotificationPage(),
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      // HEADER COMMUN
      appBar: AppBar(
        backgroundColor: Colors.red.shade900,
        // On utilise leading pour placer le logo à gauche
        leading: Padding(
          padding: const EdgeInsets.only(left: 12.0), // Décale un peu du bord gauche
          child: Center(
            child: Container(
              padding: const EdgeInsets.all(9), // Espace entre l'icône et le bord rouge
              decoration: BoxDecoration(
                color: const Color(0xFF660000), // Rouge très profond
                shape: BoxShape.circle, // Forme ronde
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.3),
                    blurRadius: 4,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: const Icon(
                Icons.fitness_center, 
                color: Colors.white, 
                size: 20, // Taille de l'icône à l'intérieur du cercle
              ),
            ),
          ),
        ),
        title: Text(
          _titles[_selectedIndex], 
          style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2)
        ),
        centerTitle: true,
        elevation: 4,
        actions: [
          IconButton(
            icon: const Icon(Icons.power_settings_new),
            onPressed: widget.onLogout,
          ),
        ],
      ),
      body: Stack(
        children: [
          // L'affichage des pages
          IndexedStack(
            index: _selectedIndex,
            children: _pages,
          ),

          // TON DESIGN DE FOOTER FLOTTANT (Code 1)
          Positioned(
            left: 15,
            right: 15,
            bottom: 20,
            child: Container(
              height: 70,
              decoration: BoxDecoration(
                color: const Color(0xFF151515),
                borderRadius: BorderRadius.circular(25),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.8),
                    blurRadius: 15,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceAround,
                children: [
                  _buildNavItem(0, Icons.home_filled),
                  _buildNavItem(1, Icons.language),
                  _buildNavItem(2, Icons.add_circle),
                  _buildNavItem(3, Icons.person),
                  _buildNavItem(4, Icons.notifications),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // LOGIQUE DU NAV ITEM AVEC EFFETS VISUELS
  Widget _buildNavItem(int index, IconData icon) {
    bool isSelected = _selectedIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _selectedIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Barre de spotlight supérieure
          AnimatedContainer(
            duration: const Duration(milliseconds: 300),
            height: 4,
            width: isSelected ? 28 : 0,
            decoration: BoxDecoration(
              color: Colors.redAccent,
              borderRadius: BorderRadius.circular(2),
              boxShadow: isSelected ? [
                const BoxShadow(color: Colors.redAccent, blurRadius: 10, spreadRadius: 1)
              ] : [],
            ),
          ),
          const SizedBox(height: 5),
          Stack(
            alignment: Alignment.center,
            children: [
              if (isSelected)
                Container(
                  height: 35,
                  width: 35,
                  decoration: BoxDecoration(
                    shape: BoxShape.rectangle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.red.withOpacity(0.2),
                        blurRadius: 15,
                        spreadRadius: 10,
                      ),
                    ],
                  ),
                ),
              Icon(
                icon,
                color: isSelected ? Colors.redAccent : Colors.grey.shade600,
                size: isSelected ? 30 : 26,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ContenuArticlesPage extends StatelessWidget {
  const ContenuArticlesPage({super.key});

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      padding: const EdgeInsets.only(top: 10, bottom: 100),
      itemCount: 5,
      itemBuilder: (context, index) {
        return _buildAdminPost(context, index);
      },
    );
  }

  Widget _buildAdminPost(BuildContext context, int index) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // 1. IMAGE
        Container(
          width: double.infinity,
          height: MediaQuery.of(context).size.width * 0.9,
          margin: const EdgeInsets.symmetric(horizontal: 4),
          decoration: BoxDecoration(
            color: Colors.grey.shade900,
            borderRadius: BorderRadius.circular(10),
            image: const DecorationImage(
              image: NetworkImage("https://via.placeholder.com/600x400"),
              fit: BoxFit.cover,
            ),
          ),
        ),

        // 2. INTERACTIONS (Likes/Date)
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          child: Row(
            children: [
              IconButton(icon: const Icon(Icons.favorite_border, color: Colors.white), onPressed: () {}),
              IconButton(icon: const Icon(Icons.chat_bubble_outline, color: Colors.white), onPressed: () {}),
              const Spacer(),
              const Text("21 AVRIL 2026", style: TextStyle(color: Colors.grey, fontSize: 11)),
            ],
          ),
        ),

        // 3. TEXTE AVEC NAVIGATION
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "OUVERTURE EXCEPTIONNELLE",
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 16),
              ),
              const SizedBox(height: 6),
              const Text(
                "L'équipe Madafit vous informe que la salle sera ouverte de 08h à 20h ce jeudi férié. Préparez vos baskets ! 💪",
                style: TextStyle(color: Colors.white70, fontSize: 14, height: 1.4),
                maxLines: 2, // On limite à 2 lignes sur le flux principal
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              
              // ACTION : LIRE LA SUITE
              GestureDetector(
                onTap: () => _ouvrirDetails(context, index),
                child: const Text(
                  "Lire la suite...",
                  style: TextStyle(
                    color: Colors.redAccent, 
                    fontWeight: FontWeight.bold,
                    fontSize: 13
                  ),
                ),
              ),
            ],
          ),
        ),
        
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 20),
          child: Divider(color: Colors.white10, thickness: 1),
        ),
      ],
    );
  }
}

class DetailsArticlePage extends StatelessWidget {
  final int index; // On passera l'index ou les données de l'article plus tard

  const DetailsArticlePage({super.key, required this.index});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.red.shade900,
        title: const Text("PUBLICATION", style: TextStyle(fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        child: Column(
          children: [
            // On réutilise la même structure mais sans limite de texte
            Container(
              width: double.infinity,
              height: 400,
              decoration: const BoxDecoration(
                image: DecorationImage(
                  image: NetworkImage("https://via.placeholder.com/600x400"),
                  fit: BoxFit.cover,
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: const [
                  Text(
                    "OUVERTURE EXCEPTIONNELLE",
                    style: TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w900),
                  ),
                  SizedBox(height: 15),
                  Text(
                    "L'équipe Madafit vous informe que la salle sera ouverte de 08h à 20h ce jeudi férié. Préparez vos baskets ! 💪\n\nIci, le texte peut être extrêmement long car nous sommes dans une vue isolée. L'utilisateur peut lire chaque détail de l'annonce publiée par l'administrateur sans aucune restriction de lignes.",
                    style: TextStyle(color: Colors.white70, fontSize: 16, height: 1.6),
                  ),
                  SizedBox(height: 30),
                  Text("Publié le 21 Avril 2026", style: TextStyle(color: Colors.grey)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _ouvrirDetails(BuildContext context, int index) {
  Navigator.push(
    context,
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) => DetailsArticlePage(index: index),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        // Animation de trajectoire (du bas vers le haut)
        // const begin = Offset(0.0, 0.1); // Commence légèrement plus bas
        // const end = Offset.zero;       // Arrive à sa position normale
        // const curve = Curves.easeOutExpo; // Courbe d'animation fluide et rapide

        // var tween = Tween(begin: begin, end: end).chain(CurveTween(curve: curve));
        
                // À remplacer dans transitionsBuilder
        return ScaleTransition(
          scale: animation.drive(
            Tween<double>(begin: 0.8, end: 1.0).chain(CurveTween(curve: Curves.easeOutBack)),
          ),
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 350), // Vitesse de l'animation
    ),
  );
}