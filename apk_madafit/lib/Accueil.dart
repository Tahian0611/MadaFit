import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'dart:math';
import 'package:http/http.dart' as http;

// --- TES IMPORTS ---
import 'apropos.dart';
import 'abonnement.dart';
import 'profile.dart';
import 'notification.dart';

// ============================================================
//  MODÈLE ARTICLE
// ============================================================
class ArticleModel {
  final int id;
  final String title;
  final String content;
  final String? imageUrl;
  final String? category;
  final String? publishedAt;
  final String? createdAt;

  ArticleModel({
    required this.id,
    required this.title,
    required this.content,
    this.imageUrl,
    this.category,
    this.publishedAt,
    this.createdAt,
  });

  factory ArticleModel.fromJson(Map<String, dynamic> json) {
    return ArticleModel(
      id: json['id'] ?? 0,
      title: json['title'] ?? '',
      content: json['content'] ?? '',
      imageUrl: json['imageUrl'],
      category: json['category'],
      publishedAt: json['publishedAt'],
      createdAt: json['createdAt'],
    );
  }

  String get fullImageUrl {
    if (imageUrl == null || imageUrl!.isEmpty) return '';
    if (imageUrl!.startsWith('http')) return imageUrl!;
    if (imageUrl!.startsWith('/')) return 'http://192.168.1.145:8000$imageUrl';
    return 'http://192.168.1.145:8000/$imageUrl';
  }

  String get displayDate {
    final dateStr = publishedAt ?? createdAt;
    if (dateStr == null) return '';
    final date = DateTime.tryParse(dateStr);
    if (date == null) return '';
    const months = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  String get categoryLabel {
    switch (category) {
      case 'news': return 'ACTUALITÉ';
      case 'promo': return 'PROMOTION';
      case 'event': return 'ÉVÉNEMENT';
      case 'tips': return 'CONSEIL';
      default: return '';
    }
  }

  Color get categoryColor {
    switch (category) {
      case 'news': return Colors.blueAccent;
      case 'promo': return Colors.greenAccent;
      case 'event': return Colors.purpleAccent;
      case 'tips': return Colors.orangeAccent;
      default: return Colors.white38;
    }
  }
}

// ============================================================
//  HOME SCREEN
// ============================================================
class HomeScreen extends StatefulWidget {
  final VoidCallback onLogout;
  final String token;
  const HomeScreen({super.key, required this.onLogout, required this.token});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  Timer? _notificationTimer;
  final ValueNotifier<int> _notificationCountNotifier = ValueNotifier<int>(0);

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
    _pages = [
      ContenuArticlesPage(
        token: widget.token,
        onArticlePublished: _onArticlePublished,
        countNotifier: _notificationCountNotifier,
      ),
      const AproposPage(),
      AbonnementPage(token: widget.token),
      ProfilePage(token: widget.token, onLogout: widget.onLogout),
      NotificationPage(
        token: widget.token,
        countNotifier: _notificationCountNotifier,
      ),
    ];
    _fetchNotificationCount();
    _notificationTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _fetchNotificationCount();
    });
  }

  @override
  void dispose() {
    _notificationTimer?.cancel();
    _notificationCountNotifier.dispose();
    super.dispose();
  }

  Future<void> _fetchNotificationCount() async {
    try {
      final response = await http.get(
        Uri.parse('http://192.168.1.145:8000/api/notifications/unread-count'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/json',
        },
      ).timeout(const Duration(seconds: 5));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final count = data['unreadCount'] ?? data['count'] ?? 0;
        if (mounted) {
          _notificationCountNotifier.value = count;
        }
      }
    } catch (_) {}
  }

  void _onArticlePublished() {
    _fetchNotificationCount();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.red.shade900,
        leading: Padding(
          padding: const EdgeInsets.only(left: 12.0),
          child: Center(
            child: Container(
              padding: const EdgeInsets.all(9),
              decoration: BoxDecoration(
                color: const Color(0xFF660000),
                shape: BoxShape.circle,
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
                size: 20,
              ),
            ),
          ),
        ),
        title: Text(
          _titles[_selectedIndex],
          style: const TextStyle(fontWeight: FontWeight.w900, letterSpacing: 1.2),
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
          IndexedStack(
            index: _selectedIndex,
            children: _pages,
          ),
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
                  ValueListenableBuilder<int>(
                    valueListenable: _notificationCountNotifier,
                    builder: (context, count, child) {
                      return _buildNavItem(4, Icons.notifications, badge: count);
                    },
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNavItem(int index, IconData icon, {int badge = 0}) {
    bool isSelected = _selectedIndex == index;

    return GestureDetector(
      onTap: () => setState(() => _selectedIndex = index),
      behavior: HitTestBehavior.opaque,
      child: Container(
        width: 60,
        height: 55,
        alignment: Alignment.center,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.end,
          children: [
            AnimatedContainer(
              duration: const Duration(milliseconds: 300),
              height: 4,
              width: isSelected ? 28 : 0,
              decoration: BoxDecoration(
                color: Colors.redAccent,
                borderRadius: BorderRadius.circular(2),
                boxShadow: isSelected
                    ? [
                        const BoxShadow(
                          color: Colors.redAccent,
                          blurRadius: 10,
                          spreadRadius: 1,
                        )
                      ]
                    : [],
              ),
            ),
            const SizedBox(height: 4),
            SizedBox(
              width: 44,
              height: 36,
              child: Stack(
                alignment: Alignment.center,
                clipBehavior: Clip.none,
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
                    size: isSelected ? 28 : 24,
                  ),
                  if (badge > 0)
                    Positioned(
                      right: 0,
                      top: -2,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(
                          color: Colors.redAccent,
                          shape: BoxShape.circle,
                          border: Border.all(color: const Color(0xFF151515), width: 2),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.5),
                              blurRadius: 4,
                              offset: const Offset(0, 2),
                            ),
                          ],
                        ),
                        constraints: const BoxConstraints(
                          minWidth: 18,
                          minHeight: 18,
                        ),
                        child: Center(
                          child: Text(
                            badge > 99 ? '99+' : '$badge',
                            style: const TextStyle(
                              color: Colors.white,
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                              height: 1,
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ============================================================
//  PAGE ARTICLES
// ============================================================
class ContenuArticlesPage extends StatefulWidget {
  final String token;
  final VoidCallback? onArticlePublished;
  final ValueNotifier<int>? countNotifier;
  const ContenuArticlesPage({
    super.key,
    required this.token,
    this.onArticlePublished,
    this.countNotifier,
  });

  @override
  State<ContenuArticlesPage> createState() => _ContenuArticlesPageState();
}

class _ContenuArticlesPageState extends State<ContenuArticlesPage> {
  List<ArticleModel> _articles = [];
  bool _isLoading = true;
  String? _error;
  Timer? _refreshTimer;
  int _lastArticleCount = 0;

  static const String _baseUrl = 'http://192.168.1.145:8000/api';

  @override
  void initState() {
    super.initState();
    _fetchArticles();
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      _checkForNewArticles();
    });
  }

  @override
  void dispose() {
    _refreshTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchArticles() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/articles?isPublished=true&itemsPerPage=50'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/ld+json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final members = (data['hydra:member'] as List?) ?? (data['member'] as List?) ?? [];

        final articles = members
            .map((j) => ArticleModel.fromJson(j as Map<String, dynamic>))
            .toList()
          ..sort((a, b) {
            final dateA = a.publishedAt ?? a.createdAt ?? '';
            final dateB = b.publishedAt ?? b.createdAt ?? '';
            return dateB.compareTo(dateA);
          });

        setState(() {
          _articles = articles;
          _isLoading = false;
          _lastArticleCount = articles.length;
        });
      } else {
        setState(() {
          _error = 'Erreur ${response.statusCode}: ${response.reasonPhrase}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Impossible de contacter le serveur ($e)';
        _isLoading = false;
      });
    }
  }

  Future<void> _checkForNewArticles() async {
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/articles?isPublished=true&itemsPerPage=50'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/ld+json',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final members = (data['hydra:member'] as List?) ?? (data['member'] as List?) ?? [];
        
        if (members.length > _lastArticleCount) {
          _fetchArticles();
          widget.onArticlePublished?.call();
        }
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Colors.redAccent),
      );
    }

    if (_error != null) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.wifi_off, color: Colors.white38, size: 60),
            const SizedBox(height: 15),
            Text(
              _error!,
              style: const TextStyle(color: Colors.white54),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: _fetchArticles,
              style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
              child: const Text("Réessayer"),
            ),
          ],
        ),
      );
    }

    if (_articles.isEmpty) {
      return RefreshIndicator(
        color: Colors.redAccent,
        backgroundColor: const Color(0xFF1A1A1A),
        onRefresh: _fetchArticles,
        child: ListView(
          physics: const AlwaysScrollableScrollPhysics(),
          children: const [
            SizedBox(height: 200),
            Center(
              child: Column(
                children: [
                  Icon(Icons.article_outlined, color: Colors.white12, size: 60),
                  SizedBox(height: 15),
                  Text(
                    "Aucun article pour le moment",
                    style: TextStyle(color: Colors.white24),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: Colors.redAccent,
      backgroundColor: const Color(0xFF1A1A1A),
      onRefresh: _fetchArticles,
      child: ListView.builder(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.only(top: 10, bottom: 100),
        itemCount: _articles.length,
        itemBuilder: (context, index) => _buildArticleCard(context, _articles[index]),
      ),
    );
  }

  Widget _buildArticleCard(BuildContext context, ArticleModel article) {
    final hasImage = article.fullImageUrl.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (hasImage)
          Container(
            width: double.infinity,
            height: MediaQuery.of(context).size.width * 0.65,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: Colors.grey.shade900,
              borderRadius: BorderRadius.circular(10),
            ),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: Image.network(
                article.fullImageUrl,
                fit: BoxFit.cover,
                errorBuilder: (_, __, ___) => Container(
                  color: const Color(0xFF1A1A1A),
                  child: const Icon(
                    Icons.image_not_supported,
                    color: Colors.white24,
                    size: 40,
                  ),
                ),
                loadingBuilder: (context, child, progress) {
                  if (progress == null) return child;
                  return const Center(
                    child: CircularProgressIndicator(
                      color: Colors.redAccent,
                      strokeWidth: 2,
                    ),
                  );
                },
              ),
            ),
          )
        else
          Container(
            width: double.infinity,
            height: 120,
            margin: const EdgeInsets.symmetric(horizontal: 4),
            decoration: BoxDecoration(
              color: const Color(0xFF1A1A1A),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: Colors.white10),
            ),
            child: const Center(
              child: Icon(
                Icons.article_outlined,
                color: Colors.white24,
                size: 40,
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  if (article.categoryLabel.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: article.categoryColor.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(
                          color: article.categoryColor.withOpacity(0.3),
                        ),
                      ),
                      child: Text(
                        article.categoryLabel,
                        style: TextStyle(
                          color: article.categoryColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                  ],
                  if (article.displayDate.isNotEmpty)
                    Text(
                      article.displayDate,
                      style: const TextStyle(color: Colors.grey, fontSize: 11),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                article.title.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 16,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                article.content,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  height: 1.4,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
              const SizedBox(height: 10),
              GestureDetector(
                onTap: () => _ouvrirDetails(context, article),
                child: const Text(
                  "Lire la suite...",
                  style: TextStyle(
                    color: Colors.redAccent,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 16),
          child: Divider(color: Colors.white10, thickness: 1),
        ),
      ],
    );
  }
}

// ============================================================
//  PAGE DÉTAIL ARTICLE
// ============================================================
class DetailsArticlePage extends StatelessWidget {
  final ArticleModel article;
  const DetailsArticlePage({super.key, required this.article});

  @override
  Widget build(BuildContext context) {
    final hasImage = article.fullImageUrl.isNotEmpty;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.red.shade900,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "ARTICLE",
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (hasImage)
              SizedBox(
                width: double.infinity,
                height: 280,
                child: Image.network(
                  article.fullImageUrl,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => Container(
                    height: 100,
                    color: const Color(0xFF1A1A1A),
                    child: const Icon(
                      Icons.image_not_supported,
                      color: Colors.white24,
                      size: 40,
                    ),
                  ),
                ),
              )
            else
              Container(
                width: double.infinity,
                height: 100,
                color: const Color(0xFF1A1A1A),
                child: const Icon(
                  Icons.article_outlined,
                  color: Colors.white24,
                  size: 40,
                ),
              ),
            Padding(
              padding: const EdgeInsets.all(20.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      if (article.categoryLabel.isNotEmpty) ...[
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            color: article.categoryColor.withOpacity(0.15),
                            borderRadius: BorderRadius.circular(6),
                            border: Border.all(
                              color: article.categoryColor.withOpacity(0.3),
                            ),
                          ),
                          child: Text(
                            article.categoryLabel,
                            style: TextStyle(
                              color: article.categoryColor,
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      if (article.displayDate.isNotEmpty)
                        Text(
                          article.displayDate,
                          style: const TextStyle(
                            color: Colors.grey,
                            fontSize: 12,
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 15),
                  Text(
                    article.title.toUpperCase(),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 22,
                      fontWeight: FontWeight.w900,
                      height: 1.2,
                    ),
                  ),
                  const SizedBox(height: 20),
                  const Divider(color: Colors.white10),
                  const SizedBox(height: 15),
                  Text(
                    article.content,
                    style: const TextStyle(
                      color: Colors.white70,
                      fontSize: 16,
                      height: 1.7,
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

void _ouvrirDetails(BuildContext context, ArticleModel article) {
  Navigator.push(
    context,
    PageRouteBuilder(
      pageBuilder: (context, animation, secondaryAnimation) =>
          DetailsArticlePage(article: article),
      transitionsBuilder: (context, animation, secondaryAnimation, child) {
        return ScaleTransition(
          scale: animation.drive(
            Tween<double>(begin: 0.8, end: 1.0)
                .chain(CurveTween(curve: Curves.easeOutBack)),
          ),
          child: FadeTransition(
            opacity: animation,
            child: child,
          ),
        );
      },
      transitionDuration: const Duration(milliseconds: 350),
    ),
  );
}