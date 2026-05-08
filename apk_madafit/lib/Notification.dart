import 'dart:convert';
import 'dart:async';
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
        if (diff == 0)      section = "AUJOURD'HUI";
        else if (diff == 1) section = "HIER";
        else if (diff < 7)  section = "CETTE SEMAINE";
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
      id:          json['id'] ?? 0,
      type:        json['type'] ?? 'account',
      title:       json['title'] ?? '',
      description: json['message'] ?? json['description'] ?? '',
      time:        timeLabel,
      isUnread:    !(json['isRead'] ?? false),
      imageUrl:    json['imageUrl'],
      section:     section,
    );
  }

  IconData get icon {
    switch (type) {
      case 'subscription':
      case 'expiry':
      case 'renewal':    return Icons.card_membership_outlined;
      case 'article':
      case 'news':
      case 'announcement': return Icons.article_outlined;
      default:           return Icons.notifications_outlined;
    }
  }

  Color get color {
    switch (type) {
      case 'subscription':
      case 'expiry':
      case 'renewal':    return Colors.redAccent;
      case 'article':
      case 'news':
      case 'announcement': return Colors.cyanAccent;
      default:           return Colors.white38;
    }
  }

  String get tab {
    switch (type) {
      case 'subscription':
      case 'expiry':
      case 'renewal':
        return 'subscription';
      case 'article':
      case 'news':
      case 'announcement':
        return 'news';
      default:
        return 'subscription';
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
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode == 200) {
      final data  = jsonDecode(response.body);
      final items = data['items'] as List? ?? [];
      return items.map((e) => NotificationModel.fromJson(e)).toList();
    }
    throw Exception('Erreur ${response.statusCode}: ${response.body}');
  }

  static Future<void> markAllRead({String? token}) async {
    await http.post(Uri.parse('$_baseUrl/mark-all-read'), headers: _headers(token));
  }

  static Future<void> markOneRead(int id, {String? token}) async {
    await http.patch(Uri.parse('$_baseUrl/$id/read'), headers: _headers(token));
  }

  static Future<void> deleteNotification(int id, {String? token}) async {
    await http.delete(Uri.parse('$_baseUrl/$id'), headers: _headers(token));
  }
}

// ============================================================
//  PAGE NOTIFICATIONS - AVEC LOGS DEBUG
// ============================================================
class NotificationPage extends StatefulWidget {
  final String? token;
  final ValueNotifier<int>? countNotifier;
  const NotificationPage({super.key, this.token, this.countNotifier});

  @override
  State<NotificationPage> createState() => _NotificationPageState();
}

class _NotificationPageState extends State<NotificationPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  List<NotificationModel> _notifications = [];
  bool _isLoading = true;
  String? _errorMessage;
  Timer? _refreshTimer;

  static const _tabs = [
    {'key': 'all',          'label': 'TOUT'},
    {'key': 'subscription', 'label': 'ABONNEMENT'},
    {'key': 'news',         'label': 'ACTUALITÉS'},
  ];

  @override
  void initState() {
    super.initState();
    debugPrint('🟡 NOTIF INIT - token: ${widget.token != null ? 'PRESENT' : 'NULL'}');
    debugPrint('🟡 NOTIF INIT - notifier: ${widget.countNotifier != null ? 'PRESENT' : 'NULL'}');
    
    _tabController = TabController(length: _tabs.length, vsync: this);
    _loadNotifications();
    
    _refreshTimer = Timer.periodic(const Duration(seconds: 30), (_) {
      debugPrint('🟡 NOTIF TIMER TICK');
      _loadNotifications(silent: true);
    });
    
    widget.countNotifier?.addListener(_onCountChanged);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _refreshTimer?.cancel();
    widget.countNotifier?.removeListener(_onCountChanged);
    super.dispose();
  }

  void _onCountChanged() {
    debugPrint('🟡 NOTIFIER LISTENER TRIGGERED - new value: ${widget.countNotifier?.value}');
    _loadNotifications(silent: true);
  }

  Future<void> _loadNotifications({bool silent = false}) async {
    debugPrint('🟡 LOAD NOTIFICATIONS - silent: $silent');
    if (!silent) {
      setState(() { _isLoading = true; _errorMessage = null; });
    }
    try {
      final data = await NotificationApiService.fetchNotifications(token: widget.token);
      debugPrint('🟡 FETCHED NOTIFICATIONS: ${data.length}');

      final filtered = data.where((n) =>
        n.type == 'subscription' ||
        n.type == 'expiry'       ||
        n.type == 'renewal'      ||
        n.type == 'article'      ||
        n.type == 'news'         ||
        n.type == 'announcement'
      ).toList();
      debugPrint('🟡 FILTERED NOTIFICATIONS: ${filtered.length}');

      if (mounted) {
        setState(() { _notifications = filtered; _isLoading = false; });
      }
      
      // Met à jour le notifier avec le vrai count
      final unreadCount = filtered.where((n) => n.isUnread).length;
      debugPrint('🟡 UNREAD COUNT: $unreadCount');
      if (widget.countNotifier != null && widget.countNotifier!.value != unreadCount) {
        debugPrint('🟡 UPDATING NOTIFIER FROM $widget.countNotifier!.value TO $unreadCount');
        widget.countNotifier!.value = unreadCount;
      }
    } catch (e) {
      debugPrint('🟡 LOAD EXCEPTION: $e');
      if (mounted && !silent) {
        setState(() { _errorMessage = '$e'; _isLoading = false; });
      }
    }
  }

  Future<void> _markAllRead() async {
    debugPrint('🟡 MARK ALL READ');
    try {
      await NotificationApiService.markAllRead(token: widget.token);
      setState(() {
        _notifications = _notifications.map((n) => NotificationModel(
          id: n.id, type: n.type, title: n.title,
          description: n.description, time: n.time,
          isUnread: false, imageUrl: n.imageUrl, section: n.section,
        )).toList();
      });
      widget.countNotifier?.value = 0;
      debugPrint('🟡 NOTIFIER SET TO 0');
    } catch (e) {
      debugPrint('🟡 MARK ALL READ EXCEPTION: $e');
    }
  }

  Future<void> _markOneRead(NotificationModel notif) async {
    debugPrint('🟡 MARK ONE READ: ${notif.id}');
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
      final newCount = _notifications.where((n) => n.isUnread).length;
      debugPrint('🟡 NEW COUNT AFTER MARK ONE: $newCount');
      widget.countNotifier?.value = newCount;
    } catch (e) {
      debugPrint('🟡 MARK ONE READ EXCEPTION: $e');
    }
  }

  Future<void> _deleteNotification(int id) async {
    debugPrint('🟡 DELETE NOTIFICATION: $id');
    try {
      await NotificationApiService.deleteNotification(id, token: widget.token);
      setState(() => _notifications.removeWhere((n) => n.id == id));
      final newCount = _notifications.where((n) => n.isUnread).length;
      widget.countNotifier?.value = newCount;
    } catch (e) {
      debugPrint('🟡 DELETE EXCEPTION: $e');
    }
  }

  List<NotificationModel> _filtered(String category) {
    if (category == 'all') return _notifications;
    return _notifications.where((n) => n.tab == category).toList();
  }

  int _unreadCount(String category) {
    return _filtered(category).where((n) => n.isUnread).length;
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('🟡 NOTIF BUILD - loading: $_isLoading, count: ${_notifications.length}');
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        actions: [
          if (_notifications.any((n) => n.isUnread))
            TextButton(
              onPressed: _markAllRead,
              child: const Text("Tout lire", style: TextStyle(color: Colors.redAccent, fontSize: 12)),
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
                  if (count > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(color: Colors.redAccent, borderRadius: BorderRadius.circular(10)),
                      child: Text('$count', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
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
          Text(_errorMessage!, textAlign: TextAlign.center, style: const TextStyle(color: Colors.white38)),
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
    debugPrint('🟡 BUILD LIST - category: $category, items: ${list.length}');

    if (list.isEmpty) {
      final isSubscription = category == 'subscription';
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              isSubscription ? Icons.card_membership_outlined : Icons.article_outlined,
              color: Colors.white12, size: 60,
            ),
            const SizedBox(height: 15),
            Text(
              isSubscription ? "Aucune alerte d'abonnement" : "Aucune actualité",
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

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(top: 10, bottom: 15, left: 5),
      child: Text(title, style: const TextStyle(color: Colors.white24, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1)),
    );
  }

  Widget _buildNotificationItem(NotificationModel item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: item.isUnread ? const Color(0xFF1A1A1A) : const Color(0xFF101010),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: item.isUnread ? Colors.redAccent.withOpacity(0.1) : Colors.transparent),
      ),
      child: Row(
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
                      child: Text(
                        item.title,
                        style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                    ),
                    Text(item.time, style: const TextStyle(color: Colors.white24, fontSize: 10)),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  item.description,
                  style: const TextStyle(color: Colors.white54, fontSize: 12, height: 1.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}