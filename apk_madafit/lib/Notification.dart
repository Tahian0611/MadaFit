import 'package:flutter/material.dart';

class NotificationPage extends StatefulWidget {
  const NotificationPage({super.key});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    // Fusion : On utilise 4 onglets pour inclure la partie Blog/Actu de l'admin
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
   Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        actions: [
          TextButton(
            onPressed: () {}, 
            child: const Text("Tout lire", style: TextStyle(color: Colors.redAccent, fontSize: 12))
          )
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true, // Nécessaire car 4 onglets peuvent dépasser sur petits écrans
          tabAlignment: TabAlignment.center,
          indicatorColor: Colors.redAccent,
          indicatorWeight: 3,
          labelColor: Colors.redAccent,
          unselectedLabelColor: Colors.white38,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: const [
            Tab(text: "TOUT"),
            Tab(text: "ENTRAÎNEMENT"),
            Tab(text: "COMPTE & INFO"),
            Tab(text: "ACTUALITÉS"),
          ],
        )
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildNotificationList(context, "all"),
          _buildNotificationList(context, "training"),
          _buildNotificationList(context, "account"),
          _buildNotificationList(context, "news"),
        ],
      ),
    );
  }

  Widget _buildNotificationList(BuildContext context, String category) {
    // Base de données complète fusionnée
    final List<Map<String, dynamic>> allNotifications = [
      {
        "type": "news",
        "icon": Icons.article_outlined,
        "color": Colors.cyanAccent,
        "title": "BLOG : Top 5 aliments post-training",
        "desc": "Découvrez les conseils de notre nutritionniste pour une récupération optimale.",
        "time": "14:00",
        "unread": true,
        "section": "AUJOURD'HUI",
        "image": "https://images.unsplash.com/photo-1546069901-ba9599a7e63c"
      },
      {
        "type": "training",
        "icon": Icons.fitness_center,
        "color": Colors.blueAccent,
        "title": "C'est l'heure du Leg Day !",
        "desc": "Votre séance commence dans 15 min. Prêt à briser vos records ?",
        "time": "10:30",
        "unread": true,
        "section": "AUJOURD'HUI"
      },
      {
        "type": "account",
        "icon": Icons.info_outline,
        "color": Colors.purpleAccent,
        "title": "Maintenance Exceptionnelle",
        "desc": "La zone cardio sera fermée ce soir de 18h à 20h pour installation de nouveaux tapis.",
        "time": "08:15",
        "unread": true,
        "section": "AUJOURD'HUI"
      },
      {
        "type": "news",
        "icon": Icons.campaign_outlined,
        "color": Colors.orangeAccent,
        "title": "ACTU : Ouverture à Tamatave",
        "desc": "Le nouveau complexe Madafit Tamatave ouvre ses portes ce lundi !",
        "time": "Hier",
        "unread": false,
        "section": "HIER",
        "image": "https://images.unsplash.com/photo-1534438327276-14e5300c3a48"
      },
      {
        "type": "account",
        "icon": Icons.verified_user_outlined,
        "color": Colors.greenAccent,
        "title": "Connexion détectée",
        "desc": "Votre compte Madafit a été connecté sur un nouveau Mac à Antananarivo.",
        "time": "Hier",
        "unread": false,
        "section": "HIER"
      },
      {
        "type": "account",
        "icon": Icons.credit_card,
        "color": Colors.redAccent,
        "title": "Abonnement expire bientôt",
        "desc": "Votre Pack Muscle+ arrive à échéance dans 3 jours. Pensez à renouveler.",
        "time": "Hier",
        "unread": false,
        "section": "HIER"
      },
      {
        "type": "training",
        "icon": Icons.local_fire_department,
        "color": Colors.red,
        "title": "Série de 5 jours !",
        "desc": "Incroyable ! Vous avez validé 5 séances d'affilée. Ne lâchez rien !",
        "time": "Lun",
        "unread": false,
        "section": "PLUS ANCIEN"
      },
    ];

    // Logique de filtrage par onglet
    final filteredList = category == "all" 
        ? allNotifications 
        : allNotifications.where((n) => n['type'] == category).toList();

    return ListView.builder(
      padding: const EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 100),
      itemCount: filteredList.length,
      itemBuilder: (context, index) {
        final item = filteredList[index];
        // Logique pour n'afficher le header de section (AUJOURD'HUI, HIER) qu'une seule fois
        bool showSection = index == 0 || filteredList[index]['section'] != filteredList[index - 1]['section'];

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (showSection) _buildSectionHeader(item['section']),
            _buildNotificationItem(
              icon: item['icon'],
              color: item['color'],
              title: item['title'],
              description: item['desc'],
              time: item['time'],
              isUnread: item['unread'],
              imageUrl: item['image'],
            ),
          ],
        );
      },
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 15, left: 5),
      child: Text(title, 
        style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
    );
  }

  Widget _buildNotificationItem({
    required IconData icon,
    required Color color,
    required String title,
    required String description,
    required String time,
    bool isUnread = false,
    String? imageUrl,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isUnread ? const Color(0xFF1A1A1A) : const Color(0xFF101010),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: isUnread ? Colors.redAccent.withOpacity(0.1) : Colors.transparent
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icône avec indicateur de notification non lue
              Stack(
                alignment: Alignment.topRight,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  if (isUnread)
                    Container(
                      width: 10,
                      height: 10,
                      decoration: BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black, width: 2),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              // Textes de la notification
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(title, 
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                        ),
                        Text(time, style: const TextStyle(color: Colors.white24, fontSize: 10)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(description, 
                      style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.5)),
                  ],
                ),
              ),
            ],
          ),
          
          // Image du blog/actu si présente
          if (imageUrl != null)
            Padding(
              padding: const EdgeInsets.only(top: 15),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Image.network(
                  imageUrl,
                  height: 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  // Gestion d'erreur si l'image ne charge pas
                  errorBuilder: (context, error, stackTrace) => const SizedBox(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}