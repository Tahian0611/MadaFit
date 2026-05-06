import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;

// ============================================================
//  MODÈLE NOTIFICATION
// ============================================================
class NotificationModel {
  final int id;
  final String type;
  final String title;
  final String description;
  final String time;
  final bool isUnread;
  final String? imageUrl;
  final String section;

  NotificationModel({
    required this.id,
    required this.type,
    required this.title,
    required this.description,
    required this.time,
    required this.isUnread,
    this.imageUrl,
    required this.section,
  });

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    String section = "PLUS ANCIEN";
    if (json['createdAt'] != null) {
      final created = DateTime.tryParse(json['createdAt']);
      if (created != null) {
        final diff = DateTime.now().difference(created).inDays;
        if (diff == 0) section = "AUJOURD'HUI";
        else if (diff == 1) section = "HIER";
      }
    }

    String timeLabel = "";
    if (json['createdAt'] != null) {
      final created = DateTime.tryParse(json['createdAt']);
      if (created != null) {
        final diff = DateTime.now().difference(created);
        if (diff.inMinutes < 60) {
          timeLabel = "Il y a ${diff.inMinutes}min";
        } else if (diff.inHours < 24) {
          timeLabel = "${created.hour.toString().padLeft(2, '0')}:${created.minute.toString().padLeft(2, '0')}";
        } else if (diff.inDays == 1) {
          timeLabel = "Hier";
        } else {
          const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
          timeLabel = days[created.weekday - 1];
        }
      }
    }

    return NotificationModel(
      id: json['id'] ?? 0,
      type: json['type'] ?? 'account',
      title: json['title'] ?? '',
      description: json['message'] ?? json['description'] ?? '',
      time: timeLabel,
      isUnread: !(json['isRead'] ?? false),
      imageUrl: json['imageUrl'],
      section: section,
    );
  }

  // ── ICÔNE selon type ──────────────────────────────────────
  IconData get icon {
    switch (type) {
      // Onglet ENTRAÎNEMENT
      case 'training':        return Icons.fitness_center;
      case 'streak':          return Icons.local_fire_department;
      // Onglet ABONNEMENT
      case 'subscription':    return Icons.card_membership_outlined;
      case 'expiry':          return Icons.warning_amber_rounded;
      case 'renewal':         return Icons.autorenew;
      case 'payment':         return Icons.credit_card;
      // Onglet ACTUALITÉS
      case 'news':
      case 'article':         return Icons.article_outlined;
      case 'announcement':    return Icons.campaign_outlined;
      // Onglet COMPTE
      case 'account':         return Icons.manage_accounts_outlined;
      case 'security':        return Icons.verified_user_outlined;
      case 'maintenance':     return Icons.build_outlined;
      default:                return Icons.notifications_outlined;
    }
  }

  // ── COULEUR selon type ────────────────────────────────────
  Color get color {
    switch (type) {
      case 'training':
      case 'streak':          return Colors.blueAccent;
      case 'subscription':
      case 'renewal':         return Colors.greenAccent;
      case 'expiry':          return Colors.redAccent;
      case 'payment':         return Colors.orangeAccent;
      case 'news':
      case 'article':
      case 'announcement':    return Colors.cyanAccent;
      case 'account':
      case 'security':
      case 'maintenance':     return Colors.purpleAccent;
      default:                return Colors.white38;
    }
  }

  // ── ONGLET d'appartenance ─────────────────────────────────
  String get tab {
    switch (type) {
      case 'training':
      case 'streak':
        return 'training';
      case 'subscription':
      case 'expiry':
      case 'renewal':
      case 'payment':
        return 'subscription';
      case 'news':
      case 'article':
      case 'announcement':
        return 'news';
      case 'account':
      case 'security':
      case 'maintenance':
      default:
        return 'account';
    }
  }
}

// ============================================================
//  SERVICE API
// ============================================================
class NotificationApiService {
  static const String _baseUrl = 'http://192.168.1.145:8000/api/notifications';

  static Map<String, String> _headers(String? token) => {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };

  static Future<List<NotificationModel>> fetchNotifications({
    String? token,
    int page = 1,
  }) async {
    if (token == null || token.isEmpty) {
      throw Exception('Non authentifié (token manquant)');
    }
    final response = await http.get(
      Uri.parse('$_baseUrl?page=$page&itemsPerPage=50'),
      headers: _headers(token),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      final items = data['items'] as List;
      return items.map((e) => NotificationModel.fromJson(e)).toList();
    }
    throw Exception('Erreur ${response.statusCode}: ${response.body}');
  }

  static Future<void> markAllRead({String? token}) async {
    await http.post(
      Uri.parse('$_baseUrl/mark-all-read'),
      headers: _headers(token),
    );
  }

  static Future<void> markOneRead(int id, {String? token}) async {
    await http.patch(
      Uri.parse('$_baseUrl/$id/read'),
      headers: _headers(token),
    );
  }

  static Future<void> deleteNotification(int id, {String? token}) async {
    await http.delete(
      Uri.parse('$_baseUrl/$id'),
      headers: _headers(token),
    );
  }
}

// ============================================================
//  PAGE NOTIFICATIONS
// ============================================================
class NotificationPage extends StatefulWidget {
  final String? token;
  const NotificationPage({super.key, this.token});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<NotificationModel> _notifications = [];
  bool _isLoading = true;
  String? _errorMessage;

  // ── Définition des onglets ────────────────────────────────
  static const _tabs = [
    {'key': 'all',          'label': 'TOUT'},
    {'key': 'training',     'label': 'ENTRAÎNEMENT'},
    {'key': 'subscription', 'label': 'ABONNEMENT'},
    {'key': 'account',      'label': 'COMPTE'},
    {'key': 'news',         'label': 'ACTUALITÉS'},
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadNotifications();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadNotifications() async {
    setState(() { _isLoading = true; _errorMessage = null; });
    try {
      final data = await NotificationApiService.fetchNotifications(token: widget.token);
      setState(() { _notifications = data; _isLoading = false; });
    } catch (e) {
      setState(() { _errorMessage = '$e'; _isLoading = false; });
    }
  }

  Future<void> _markAllRead() async {
    try {
      await NotificationApiService.markAllRead(token: widget.token);
      setState(() {
        _notifications = _notifications.map((n) => NotificationModel(
          id: n.id, type: n.type, title: n.title,
          description: n.description, time: n.time,
          isUnread: false, imageUrl: n.imageUrl, section: n.section,
        )).toList();
      });
    } catch (_) {}
  }

  Future<void> _markOneRead(NotificationModel notif) async {
    if (!notif.isUnread) return;
    try {
      await NotificationApiService.markOneRead(notif.id, token: widget.token);
      setState(() {
        final idx = _notifications.indexWhere((n) => n.id == notif.id);
        if (idx != -1) {
          final n = _notifications[idx];
          _notifications[idx] = NotificationModel(
            id: n.id, type: n.type, title: n.title,
            description: n.description, time: n.time,
            isUnread: false, imageUrl: n.imageUrl, section: n.section,
          );
        }
      });
    } catch (_) {}
  }

  Future<void> _deleteNotification(int id) async {
    try {
      await NotificationApiService.deleteNotification(id, token: widget.token);
      setState(() => _notifications.removeWhere((n) => n.id == id));
    } catch (_) {}
  }

  // ── Filtrage par onglet via la propriété .tab du modèle ───
  List<NotificationModel> _filtered(String category) {
    if (category == 'all') return _notifications;
    return _notifications.where((n) => n.tab == category).toList();
  }

  // ── Compteur de non-lus par onglet ────────────────────────
  int _unreadCount(String category) {
    return _filtered(category).where((n) => n.isUnread).length;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        actions: [
          TextButton(
            onPressed: _markAllRead,
            child: const Text("Tout lire",
                style: TextStyle(color: Colors.redAccent, fontSize: 12)),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.center,
          indicatorColor: Colors.redAccent,
          indicatorWeight: 3,
          labelColor: Colors.redAccent,
          unselectedLabelColor: Colors.white38,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: _tabs.map((t) {
            final count = _unreadCount(t['key']!);
            return Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(t['label']!),
                  // ── Badge de non-lus ──
                  if (count > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.redAccent,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ],
              ),
            );
          }).toList(),
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.redAccent))
          : _errorMessage != null
              ? _buildError()
              : TabBarView(
                  controller: _tabController,
                  children: _tabs.map((t) => _buildNotificationList(t['key']!)).toList(),
                ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.wifi_off, color: Colors.white38, size: 60),
          const SizedBox(height: 20),
          Text(_errorMessage!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: Colors.white38)),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _loadNotifications,
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            child: const Text("Réessayer"),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationList(String category) {
    final list = _filtered(category);

    if (list.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(_emptyIcon(category), color: Colors.white12, size: 60),
            const SizedBox(height: 15),
            Text(
              _emptyMessage(category),
              style: const TextStyle(color: Colors.white24, fontSize: 14),
            ),
          ],
        ),
      );
    }

    return RefreshIndicator(
      color: Colors.redAccent,
      backgroundColor: const Color(0xFF1A1A1A),
      onRefresh: _loadNotifications,
      child: ListView.builder(
        padding: const EdgeInsets.only(left: 20, right: 20, top: 20, bottom: 100),
        itemCount: list.length,
        itemBuilder: (context, index) {
          final item = list[index];
          final showSection = index == 0 || list[index].section != list[index - 1].section;
          return Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (showSection) _buildSectionHeader(item.section),
              Dismissible(
                key: Key('notif_${item.id}'),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 20),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(18),
                  ),
                  child: const Icon(Icons.delete_outline, color: Colors.redAccent),
                ),
                onDismissed: (_) => _deleteNotification(item.id),
                child: GestureDetector(
                  onTap: () => _markOneRead(item),
                  child: _buildNotificationItem(item),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  // ── Message/icône vide selon onglet ───────────────────────
  IconData _emptyIcon(String category) {
    switch (category) {
      case 'training':     return Icons.fitness_center;
      case 'subscription': return Icons.card_membership_outlined;
      case 'news':         return Icons.article_outlined;
      case 'account':      return Icons.manage_accounts_outlined;
      default:             return Icons.notifications_off_outlined;
    }
  }

  String _emptyMessage(String category) {
    switch (category) {
      case 'training':     return "Aucune notification d'entraînement";
      case 'subscription': return "Aucune notification d'abonnement";
      case 'news':         return "Aucune actualité";
      case 'account':      return "Aucune notification de compte";
      default:             return "Aucune notification";
    }
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 15, left: 5),
      child: Text(title,
          style: const TextStyle(
              color: Colors.white24, fontSize: 10,
              fontWeight: FontWeight.bold, letterSpacing: 1)),
    );
  }

  Widget _buildNotificationItem(NotificationModel item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: item.isUnread ? const Color(0xFF1A1A1A) : const Color(0xFF101010),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(
          color: item.isUnread ? Colors.redAccent.withOpacity(0.1) : Colors.transparent,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                alignment: Alignment.topRight,
                children: [
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: item.color.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: Icon(item.icon, color: item.color, size: 22),
                  ),
                  if (item.isUnread)
                    Container(
                      width: 10, height: 10,
                      decoration: BoxDecoration(
                        color: Colors.redAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.black, width: 2),
                      ),
                    ),
                ],
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Expanded(
                          child: Text(item.title,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.bold,
                                  fontSize: 14)),
                        ),
                        Text(item.time,
                            style: const TextStyle(color: Colors.white24, fontSize: 10)),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(item.description,
                        style: const TextStyle(
                            color: Colors.white54, fontSize: 12, height: 1.5)),
                  ],
                ),
              ),
            ],
          ),
          if (item.imageUrl != null)
            Padding(
              padding: const EdgeInsets.only(top: 15),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(15),
                child: Image.network(
                  item.imageUrl!,
                  height: 150,
                  width: double.infinity,
                  fit: BoxFit.cover,
                  errorBuilder: (_, __, ___) => const SizedBox(),
                ),
              ),
            ),
        ],
      ),
    );
  }
}