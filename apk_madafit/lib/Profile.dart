import 'package:flutter/material.dart';
import 'dart:convert';
import 'dart:async';
import 'package:http/http.dart' as http;
import 'Settings.dart';
import 'QRCode.dart';
import 'Payement.dart';
import 'api_config.dart';
import 'Abonnement.dart';

class ProfilePage extends StatefulWidget {
  final VoidCallback? onLogout;
  final String token;
  final int? userId;

  const ProfilePage({
    super.key,
    required this.token,
    this.onLogout,
    this.userId,
  });

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> with WidgetsBindingObserver {
  Map<String, dynamic>? _user;
  bool _isLoading = true;
  bool _isSuspending = false;
  String? _error;

  static final String _baseUrl = ApiConfig.baseUrl;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetchProfile();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetchProfile();
    }
  }

  Future<void> _fetchProfile() async {
    if (widget.token.isEmpty) {
      setState(() {
        _error = 'Session expirée. Veuillez vous reconnecter.';
        _isLoading = false;
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final response = await http
          .get(
            Uri.parse('$_baseUrl/me'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Content-Type': 'application/json',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        setState(() {
          try {
            _user = jsonDecode(response.body);
            _isLoading = false;
          } catch (e) {
            _error = 'Format de réponse invalide (HTML reçu au lieu de JSON ?). Détails: $e';
            _isLoading = false;
          }
        });
      } else {
        setState(() {
          _error = 'Erreur ${response.statusCode}: ${response.reasonPhrase}';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Impossible de contacter le serveur. (HTML reçu au lieu de JSON ?). Détails: $e';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.black,
        body: Center(child: CircularProgressIndicator(color: Colors.redAccent)),
      );
    }

    if (_error != null) {
      return Scaffold(
        backgroundColor: Colors.black,
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline,
                color: Colors.redAccent,
                size: 50,
              ),
              const SizedBox(height: 15),
              Text(_error!, style: const TextStyle(color: Colors.white)),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _fetchProfile,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                ),
                child: const Text('Réessayer'),
              ),
            ],
          ),
        ),
      );
    }

    final String fullName =
        '${_user?['firstName'] ?? ''} ${_user?['lastName'] ?? ''}'
            .trim()
            .toUpperCase();
    final String memberId =
        _user?['memberId'] ?? '#MAD-${_user?['id'] ?? '---'}';
    final List<dynamic> roles = _user?['roles'] ?? [];
    final String memberType = roles.contains('ROLE_PREMIUM')
        ? 'MEMBRE PREMIUM'
        : roles.contains('ROLE_ADMIN')
        ? 'ADMINISTRATEUR'
        : 'MEMBRE STANDARD';
    final String email = _user?['email'] ?? '';

    final String? photoPath = _user?['photo'];
    final String fullPhotoUrl = (photoPath != null && photoPath.toString().isNotEmpty)
        ? ApiConfig.getFullPhotoUrl(photoPath.toString())
        : '';

    return Scaffold(
      backgroundColor: Colors.black,
      body: RefreshIndicator(
        onRefresh: _fetchProfile,
        color: Colors.redAccent,
        backgroundColor: const Color(0xFF1A1A1A),
        child: SingleChildScrollView(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
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
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.white24,
                      backgroundImage: fullPhotoUrl.isNotEmpty
                          ? NetworkImage(fullPhotoUrl)
                          : null,
                      child: fullPhotoUrl.isEmpty
                          ? const Icon(Icons.person, size: 50, color: Colors.white)
                          : null,
                    ),
                    const SizedBox(height: 15),
                    Text(
                      fullName.isEmpty ? 'UTILISATEUR' : fullName,
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 20,
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.5,
                      ),
                    ),
                    Text(
                      memberType,
                      style: const TextStyle(
                        color: Colors.white70,
                        fontSize: 12,
                        fontWeight: FontWeight.w300,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 30),

              const Text(
                "INFORMATIONS DÉTAILLÉES",
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.2,
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
                    _buildDetailRow("ID Membre", memberId),
                    const Divider(color: Colors.white10, height: 25),
                    _buildDetailRow("Email", email),
                  ],
                ),
              ),

              const SizedBox(height: 30),

              _buildActionCard(
                "Mon QR Code d'accès",
                Icons.qr_code_scanner,
                Colors.blueAccent,
                () => _navigateTo(
                  context,
                  QRCodePage(token: widget.token, userId: _user?['id'] ?? 0),
                ),
              ),
              _buildActionCard(
                "Historique des paiements",
                Icons.account_balance_wallet_outlined,
                Colors.orangeAccent,
                () => _navigateTo(
                  context,
                  PayementPage(token: widget.token, userId: _user?['id'] ?? 0),
                ),
              ),
              _buildActionCard(
                "Mes offres d'abonnement",
                Icons.workspace_premium,
                Colors.redAccent,
                () => _navigateTo(
                  context,
                  UserOffresPage(token: widget.token, user: _user),
                ),
              ),
              _buildActionCard(
                "Mes activités",
                Icons.sports_gymnastics,
                Colors.greenAccent,
                () => _navigateTo(
                  context,
                  UserActivitesPage(user: _user),
                ),
              ),
              _buildActionCard(
                "Paramètres",
                Icons.settings_outlined,
                Colors.grey,
                () => _navigateTo(
                  context,
                  SettingsPage(
                    token: widget.token,
                    userData: _user,
                    onLogout: widget.onLogout,
                  ),
                ),
              ),

              // ── SUPPRIMER COMPTE ───────────────────────────────────────
              _isSuspending
                  ? Container(
                      margin: const EdgeInsets.only(top: 8),
                      padding: const EdgeInsets.symmetric(vertical: 15),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1A1A1A),
                        borderRadius: BorderRadius.circular(15),
                        border: Border.all(
                          color: Colors.redAccent.withOpacity(0.5),
                        ),
                      ),
                      child: const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.redAccent,
                              strokeWidth: 2,
                            ),
                          ),
                          SizedBox(width: 10),
                          Text(
                            "SUPPRESSION EN COURS...",
                            style: TextStyle(
                              color: Colors.redAccent,
                              fontWeight: FontWeight.bold,
                              letterSpacing: 1,
                            ),
                          ),
                        ],
                      ),
                    )
                  : _buildActionCard(
                      "Supprimer le compte",
                      Icons.delete_forever,
                      Colors.redAccent,
                      () => _showDeleteAccountDialog(context),
                    ),

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateTo(BuildContext context, Widget page) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (context) => page),
    ).then((_) {
      _fetchProfile();
    });
  }

  Widget _buildDetailRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: const TextStyle(color: Colors.grey, fontSize: 14)),
        Flexible(
          child: Text(
            value,
            textAlign: TextAlign.end,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildActionCard(
    String title,
    IconData icon,
    Color iconColor,
    VoidCallback onTap,
  ) {
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
            borderRadius: BorderRadius.circular(10),
          ),
          child: Icon(icon, color: iconColor),
        ),
        title: Text(
          title,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
        trailing: const Icon(Icons.chevron_right, color: Colors.grey),
      ),
    );
  }
    // ── DIALOGUE CONFIRMATION SUPPRESSION COMPTE ─────────────────────────────
  void _showDeleteAccountDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Row(
          children: [
            Icon(
              Icons.warning_amber_rounded,
              color: Colors.redAccent,
              size: 28,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                "Supprimer le compte",
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        content: const Text(
          "Êtes-vous sûr de vouloir supprimer votre compte ?\n\n"
          "Cette action est irréversible. Vous ne pourrez plus vous connecter.\n\n"
          "Pour toute réactivation, contactez l'accueil MadaFit.",
          style: TextStyle(color: Colors.white70, height: 1.5),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("Annuler", style: TextStyle(color: Colors.grey)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.redAccent,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(10),
              ),
            ),
            onPressed: () {
              Navigator.pop(context);
              _suspendAccount();
            },
            child: const Text(
              "SUPPRIMER",
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // ── APPEL API SUSPENSION ──────────────────────────────────────────────────
  Future<void> _suspendAccount() async {
    setState(() => _isSuspending = true);

    try {
      final response = await http
          .post(
            Uri.parse('${ApiConfig.baseUrl}/account/suspend'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Accept': 'application/json',
            },
          )
          .timeout(const Duration(seconds: 15));

      if (!mounted) return;

      if (response.statusCode == 200) {
        if (widget.onLogout != null) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Votre compte a été supprimé avec succès.'),
              backgroundColor: Colors.green,
            ),
          );
          await Future.delayed(const Duration(seconds: 1));
          if (mounted) {
            widget.onLogout!();
          }
        }
      } else {
        try {
          final errorData = jsonDecode(response.body);
          _showSnackBar(
            errorData['error'] ?? 'Erreur lors de la suppression du compte.',
          );
        } catch (_) {
          _showSnackBar('Erreur lors de la suppression du compte.');
        }
      }
    } catch (e) {
      debugPrint('💥 Suspend error: $e');
      if (mounted) {
        _showSnackBar('Problème de connexion. Veuillez réessayer.');
      }
    } finally {
      if (mounted) setState(() => _isSuspending = false);
    }
  }

  void _showSnackBar(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.redAccent),
    );
  }
}

class UserOffresPage extends StatefulWidget {
  final String token;
  final Map<String, dynamic>? user;

  const UserOffresPage({super.key, required this.token, required this.user});

  @override
  State<UserOffresPage> createState() => _UserOffresPageState();
}

class _UserOffresPageState extends State<UserOffresPage> with WidgetsBindingObserver {
  List<SubscriptionPlan> _plans = [];
  Map<String, dynamic>? _userData;
  bool _isLoading = true;

  static final String _baseUrl = ApiConfig.baseUrl;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _userData = widget.user;
    _fetchData();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetchData();
    }
  }

  Future<void> _fetchData() async {
    final headers = {
      'Authorization': 'Bearer ${widget.token}',
      'Accept': 'application/ld+json',
    };

    try {
      final plansRes = await http.get(Uri.parse('$_baseUrl/subscription_plans'), headers: headers);
      if (plansRes.statusCode == 200) {
        final data = jsonDecode(plansRes.body);
        final List<dynamic> members = data['member'] ?? data['hydra:member'] ?? [];
        _plans = members.map((json) => SubscriptionPlan.fromJson(json)).toList();
      }

      if (widget.user?['id'] != null) {
        final userRes = await http.get(Uri.parse('$_baseUrl/users/${widget.user!['id']}'), headers: headers);
        if (userRes.statusCode == 200) {
          _userData = jsonDecode(userRes.body);
        }
      }
    } catch (e) {
      print('Erreur fetch data: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final List<dynamic> userSubscriptions = _userData?['userSubscriptions'] ?? [];
    final List<dynamic> pendingSubs = userSubscriptions.where((s) => s['status'] == 'pending').toList();
    final List<dynamic> activeSubs = userSubscriptions.where((s) => s['status'] == 'active').toList();
    final List<dynamic> expiredSubs = userSubscriptions.where((s) => s['status'] == 'expired' || s['status'] == 'suspended').toList();

    final String rawSubscription = _userData?['subscription'] ?? '';
    final List<String> legacySubs = rawSubscription.isNotEmpty
        ? rawSubscription.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList()
        : [];
    final int totalPayments = (_userData?['totalPayments'] as num?)?.toInt() ?? 0;
    final List<dynamic> payments = _userData?['paymentRecords'] ?? [];

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          'MES OFFRES',
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, letterSpacing: 1.5, fontSize: 16),
        ),
        centerTitle: true,
      ),
      body: _isLoading 
          ? const Center(child: CircularProgressIndicator(color: Colors.redAccent))
          : RefreshIndicator(
              onRefresh: _fetchData,
              color: Colors.redAccent,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _buildSummaryCard(pendingSubs, activeSubs),

                    const SizedBox(height: 30),

                    if (pendingSubs.isNotEmpty) ...[
                      const Text(
                        'OFFRES EN ATTENTE',
                        style: TextStyle(color: Colors.orangeAccent, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 15),
                      ...pendingSubs.map((sub) => _buildPendingSubscriptionCard(sub)),
                      const SizedBox(height: 20),
                    ],

                    if (activeSubs.isNotEmpty) ...[
                      const Text(
                        'OFFRES ACTIVES',
                        style: TextStyle(color: Colors.greenAccent, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 15),
                      ...activeSubs.map((sub) => _buildActiveSubscriptionCard(sub)),
                      const SizedBox(height: 20),
                    ],

                    if (expiredSubs.isNotEmpty) ...[
                      const Text(
                        'OFFRES EXPIRÉES',
                        style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 15),
                      ...expiredSubs.map((sub) => _buildExpiredSubscriptionCard(sub)),
                      const SizedBox(height: 20),
                    ],

                    if (userSubscriptions.isEmpty && legacySubs.isNotEmpty) ...[
                      const Text(
                        'VOS ABONNEMENTS (LEGACY)',
                        style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 15),
                      ...legacySubs.map((s) => _buildLegacySubscriptionCard(s, payments, totalPayments)),
                    ],

                    if (userSubscriptions.isEmpty && legacySubs.isEmpty)
                      _buildEmptyState(),

                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSummaryCard(List<dynamic> pending, List<dynamic> active) {
    int totalPendingPrice = 0;
    int totalActivePrice = 0;

    for (final sub in pending) {
      final plan = _plans.firstWhere(
        (p) => p.name == sub['planName'],
        orElse: () => SubscriptionPlan(id: 0, name: sub['planName'] ?? '', type: '', duration: 0, price: 0, features: [], popular: false),
      );
      totalPendingPrice += plan.price.toInt();
    }

    for (final sub in active) {
      final plan = _plans.firstWhere(
        (p) => p.name == sub['planName'],
        orElse: () => SubscriptionPlan(id: 0, name: sub['planName'] ?? '', type: '', duration: 0, price: 0, features: [], popular: false),
      );
      totalActivePrice += plan.price.toInt();
    }

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.red.shade900.withOpacity(0.8), const Color(0xFF1A0000)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
      ),
      child: Column(
        children: [
          const Icon(Icons.workspace_premium, color: Colors.redAccent, size: 40),
          const SizedBox(height: 12),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceEvenly,
            children: [
              Column(
                children: [
                  const Text('EN ATTENTE', style: TextStyle(color: Colors.orangeAccent, fontSize: 10, letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text(_formatPrice(totalPendingPrice), style: const TextStyle(color: Colors.orangeAccent, fontSize: 20, fontWeight: FontWeight.w900)),
                ],
              ),
              Container(width: 1, height: 30, color: Colors.white24),
              Column(
                children: [
                  const Text('ACTIFS', style: TextStyle(color: Colors.greenAccent, fontSize: 10, letterSpacing: 1)),
                  const SizedBox(height: 4),
                  Text(_formatPrice(totalActivePrice), style: const TextStyle(color: Colors.greenAccent, fontSize: 20, fontWeight: FontWeight.w900)),
                ],
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPendingSubscriptionCard(Map<String, dynamic> sub) {
    final planName = sub['planName'] ?? 'Offre';
    final plan = _plans.firstWhere(
      (p) => p.name == planName,
      orElse: () => SubscriptionPlan(id: 0, name: planName, type: '', duration: 0, price: 0, features: [], popular: false),
    );
    final promotion = sub['promotion'] as String?;
    final double price = plan.price.toDouble();

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.orangeAccent.withOpacity(0.3)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  planName.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.orangeAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  "EN ATTENTE",
                  style: TextStyle(color: Colors.orangeAccent, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "${_formatPrice(price.toInt())} Ar",
            style: const TextStyle(color: Colors.white, fontSize: 20, fontWeight: FontWeight.w900),
          ),
          // if (promotion != null) ...[
          //   const SizedBox(height: 4),
          //   Text(
          //     "Code promo: $promotion",
          //     style: const TextStyle(color: Colors.greenAccent, fontSize: 11),
          //   ),
          // ],
          const SizedBox(height: 12),
          const Text(
            "Votre demande sera traitée par un administrateur.",
            style: TextStyle(color: Colors.white38, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildActiveSubscriptionCard(Map<String, dynamic> sub) {
    final planName = sub['planName'] ?? 'Offre';
    final plan = _plans.firstWhere(
      (p) => p.name == planName,
      orElse: () => SubscriptionPlan(id: 0, name: planName, type: '', duration: 0, price: 0, features: [], popular: false),
    );
    final double price = plan.price.toDouble();
    final double totalPaid = (sub['totalPaid'] as num?)?.toDouble() ?? 0;
    final String? startDate = sub['startDate'];
    final String? expiryDate = sub['expiryDate'];
    final double balance = price - totalPaid;

    double progress = 0.0;
    int percent = 0;
    Color validityColor = Colors.blueAccent;
    bool isBlinking = false;
    String validityLabel = "Validité";

    if (startDate != null && plan.duration > 0) {
      final start = DateTime.parse(startDate);
      final now = DateTime.now();
      final end = DateTime(
        start.year + (start.month + plan.duration - 1) ~/ 12,
        (start.month + plan.duration - 1) % 12 + 1,
        start.day,
      );
      final graceEnd = end.add(const Duration(days: 10));
      final totalSeconds = end.difference(start).inSeconds;
      final elapsedSeconds = now.difference(start).inSeconds;
      final daysUntilExpiry = end.difference(now).inDays;

      if (totalSeconds > 0) {
        progress = (elapsedSeconds / totalSeconds).clamp(0.0, 1.0);
      }
      percent = (progress * 100).toInt();

      if (now.isBefore(end)) {
        if (daysUntilExpiry <= 5) {
          validityColor = Colors.orangeAccent;
        }
      } else if (now.isBefore(graceEnd) || now.isAtSameMomentAs(graceEnd)) {
        validityColor = Colors.redAccent;
        isBlinking = true;
        percent = 100;
        progress = 1.0;
        validityLabel = "Marge de grâce";
      } else {
        validityColor = const Color(0xFF444444);
        percent = 100;
        progress = 1.0;
        validityLabel = "EXPIRÉ";
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.greenAccent.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  planName.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.greenAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  "ACTIF",
                  style: TextStyle(color: Colors.greenAccent, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Prix", style: TextStyle(color: Colors.white38, fontSize: 10)),
                  Text("${_formatPrice(price.toInt())} Ar", style: const TextStyle(color: Colors.white, fontSize: 16, fontWeight: FontWeight.w900)),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text("Payé", style: TextStyle(color: Colors.white38, fontSize: 10)),
                  Text("${_formatPrice(totalPaid.toInt())} Ar", style: TextStyle(color: totalPaid >= price ? Colors.greenAccent : Colors.orangeAccent, fontSize: 16, fontWeight: FontWeight.w900)),
                ],
              ),
            ],
          ),
          // if (balance > 0) ...[
          //   const SizedBox(height: 8),
          //   Text(
          //     "Reste à payer : ${_formatPrice(balance.toInt())} Ar",
          //     style: const TextStyle(color: Colors.orangeAccent, fontSize: 12),
          //   ),
          // ],
          if (startDate != null && expiryDate != null) ...[
            const SizedBox(height: 12),
            Text(
              "Du ${_formatDate(startDate)} au ${_formatDate(expiryDate)}",
              style: const TextStyle(color: Colors.white38, fontSize: 11),
            ),
          ],
          if (plan.duration > 0) ...[
            const SizedBox(height: 12),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(validityLabel, style: const TextStyle(color: Colors.white38, fontSize: 10)),
                Text(
                  validityLabel == "EXPIRÉ" ? "EXPIRÉ" : "$percent%",
                  style: TextStyle(color: validityColor == const Color(0xFF444444) ? Colors.grey : validityColor, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 6),
            isBlinking
              ? _BlinkingProgressBar(progress: progress, color: validityColor)
              : ClipRRect(
                  borderRadius: BorderRadius.circular(10),
                  child: LinearProgressIndicator(
                    value: progress,
                    backgroundColor: Colors.white.withOpacity(0.05),
                    valueColor: AlwaysStoppedAnimation<Color>(validityColor),
                    minHeight: 6,
                  ),
                ),
          ],
        ],
      ),
    );
  }

  Widget _buildExpiredSubscriptionCard(Map<String, dynamic> sub) {
    final planName = sub['planName'] ?? 'Offre';
    final plan = _plans.firstWhere(
      (p) => p.name == planName,
      orElse: () => SubscriptionPlan(id: 0, name: planName, type: '', duration: 0, price: 0, features: [], popular: false),
    );
    final double totalPaid = (sub['totalPaid'] as num?)?.toDouble() ?? 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.grey.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  planName.toUpperCase(),
                  style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: Colors.grey.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  (sub['status'] ?? 'expired').toUpperCase(),
                  style: const TextStyle(color: Colors.grey, fontSize: 10, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            "Payé : ${_formatPrice(totalPaid.toInt())} Ar",
            style: const TextStyle(color: Colors.white38, fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildLegacySubscriptionCard(String s, List<dynamic> payments, int totalPayments) {
    final plan = _plans.firstWhere((p) => p.name == s, 
      orElse: () => SubscriptionPlan(id: 0, name: s, type: '', duration: 0, price: 0, features: [], popular: false));
    
    final double price = plan.price.toDouble();
    final String status = _userData?['status'] ?? '';
    
    double paidForThis = 0;
    for (var p in payments) {
      if (p['subscription'] == s) paidForThis += (p['amount'] as num?)?.toDouble() ?? 0.0;
    }
    if (paidForThis == 0 && totalPayments > 0) {
      paidForThis = totalPayments.toDouble();
    }
    double balance = price - paidForThis;
    if (balance < 0) balance = 0;

    double progress = 0.0;
    int percent = 0;
    Color validityColor = Colors.blueAccent;
    bool isBlinking = false;
    String validityLabel = "Validité (temps écoulé)";
    
    if (_userData?['startDate'] != null && plan.duration > 0) {
      final start = DateTime.parse(_userData!['startDate']);
      final now = DateTime.now();
      final end = DateTime(
        start.year + (start.month + plan.duration - 1) ~/ 12,
        (start.month + plan.duration - 1) % 12 + 1,
        start.day,
      );
      final graceEnd = end.add(const Duration(days: 10));
      final totalSeconds = end.difference(start).inSeconds;
      final elapsedSeconds = now.difference(start).inSeconds;
      final daysUntilExpiry = end.difference(now).inDays;

      if (totalSeconds > 0) {
        progress = (elapsedSeconds / totalSeconds).clamp(0.0, 1.0);
      }
      percent = (progress * 100).toInt();

      if (now.isBefore(end)) {
        if (daysUntilExpiry <= 5) {
          validityColor = Colors.orangeAccent;
        }
      } else if (now.isBefore(graceEnd) || now.isAtSameMomentAs(graceEnd)) {
        validityColor = Colors.redAccent;
        isBlinking = true;
        percent = 100;
        progress = 1.0;
        validityLabel = "Validité (marge de grâce)";
      } else {
        validityColor = const Color(0xFF444444);
        percent = 100;
        progress = 1.0;
        validityLabel = "EXPIRÉ";
      }
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: balance > 0 ? Colors.orangeAccent.withOpacity(0.2) : Colors.greenAccent.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(s.toUpperCase(), style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 14)),
              ),
              if (balance <= 0 && price > 0)
                const Icon(Icons.verified, color: Colors.greenAccent, size: 20),
            ],
          ),
          const SizedBox(height: 15),
          if (balance > 0 && status == 'pending') ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(vertical: 12),
              decoration: BoxDecoration(
                color: Colors.orangeAccent.withOpacity(0.1),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.orangeAccent.withOpacity(0.3)),
              ),
              child: const Center(
                child: Text(
                  "EN ATTENTE DE VALIDATION",
                  style: TextStyle(
                    color: Colors.orangeAccent,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.2,
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ] else ...[
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                // Column(
                //   crossAxisAlignment: CrossAxisAlignment.start,
                //   children: [
                //     const Text("Reste à payer", style: TextStyle(color: Colors.white38, fontSize: 10)),
                //     Text(
                //       "${_formatPrice(balance.toInt())} Ar",
                //       style: TextStyle(
                //         color: balance > 0 ? Colors.orangeAccent : Colors.greenAccent,
                //         fontSize: 18,
                //         fontWeight: FontWeight.w900,
                //       ),
                //     ),
                //   ],
                // ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: (balance > 0 ? Colors.orangeAccent : Colors.greenAccent).withOpacity(0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    balance > 0 ? "PARTIEL" : "PAYÉ",
                    style: TextStyle(
                      color: balance > 0 ? Colors.orangeAccent : Colors.greenAccent,
                      fontSize: 10,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ],
            ),
            if (price > 0) ...[
              const SizedBox(height: 20),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text("Paiement effectué", style: TextStyle(color: Colors.white38, fontSize: 10)),
                  Text("${((paidForThis / price) * 100).toInt()}%", style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
              const SizedBox(height: 8),
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: LinearProgressIndicator(
                  value: (paidForThis / price).clamp(0.0, 1.0),
                  backgroundColor: Colors.white.withOpacity(0.05),
                  valueColor: AlwaysStoppedAnimation<Color>(balance > 0 ? Colors.orangeAccent : Colors.greenAccent),
                  minHeight: 6,
                ),
              ),
            ],
            if (_userData?['startDate'] != null && plan.duration > 0) ...[
              const SizedBox(height: 20),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(validityLabel, style: const TextStyle(color: Colors.white38, fontSize: 10)),
                      Text(
                        validityLabel == "EXPIRÉ" ? "EXPIRÉ" : "$percent%",
                        style: TextStyle(
                          color: validityColor == const Color(0xFF444444) ? Colors.grey : validityColor,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  isBlinking
                    ? _BlinkingProgressBar(progress: progress, color: validityColor)
                    : ClipRRect(
                        borderRadius: BorderRadius.circular(10),
                        child: LinearProgressIndicator(
                          value: progress,
                          backgroundColor: Colors.white.withOpacity(0.05),
                          valueColor: AlwaysStoppedAnimation<Color>(validityColor),
                          minHeight: 6,
                        ),
                      ),
                ],
              ),
            ],
          ],
        ],
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        children: const [
          SizedBox(height: 50),
          Icon(Icons.inbox_rounded, color: Colors.white12, size: 80),
          SizedBox(height: 15),
          Text('Aucune offre enregistrée', style: TextStyle(color: Colors.white24, fontSize: 16)),
        ],
      ),
    );
  }

  String _formatPrice(int price) {
    final str = price.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return 'N/A';
    final date = DateTime.tryParse(dateStr);
    if (date == null) return dateStr;
    const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc'];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }
}

class _BlinkingProgressBar extends StatefulWidget {
  final double progress;
  final Color color;

  const _BlinkingProgressBar({required this.progress, required this.color});

  @override
  State<_BlinkingProgressBar> createState() => _BlinkingProgressBarState();
}

class _BlinkingProgressBarState extends State<_BlinkingProgressBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    )..repeat(reverse: true);
    _opacity = Tween<double>(begin: 1.0, end: 0.3).animate(_controller);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _opacity,
      builder: (context, child) {
        return Opacity(
          opacity: _opacity.value,
          child: ClipRRect(
            borderRadius: BorderRadius.circular(10),
            child: LinearProgressIndicator(
              value: widget.progress,
              backgroundColor: Colors.white.withOpacity(0.05),
              valueColor: AlwaysStoppedAnimation<Color>(widget.color),
              minHeight: 6,
            ),
          ),
        );
      },
    );
  }
}

class UserActivitesPage extends StatelessWidget {
  final Map<String, dynamic>? user;

  const UserActivitesPage({super.key, required this.user});

  static const Map<String, IconData> _activityIcons = {
    'musculation': Icons.fitness_center,
    'cardio': Icons.directions_run,
    'yoga': Icons.self_improvement,
    'crossfit': Icons.sports_gymnastics,
    'boxe': Icons.sports_mma,
    'natation': Icons.pool,
  };

  static const Map<String, String> _activityLabels = {
    'musculation': 'Musculation',
    'cardio': 'Cardio',
    'yoga': 'Yoga',
    'crossfit': 'CrossFit',
    'boxe': 'Boxe',
    'natation': 'Natation',
  };

  static const Map<String, Color> _activityColors = {
    'musculation': Colors.redAccent,
    'cardio': Colors.orangeAccent,
    'yoga': Colors.purpleAccent,
    'crossfit': Colors.blueAccent,
    'boxe': Colors.deepOrangeAccent,
    'natation': Colors.cyanAccent,
  };

  List<String> _parseActivities() {
    final dynamic activitiesRaw = user?['activities'];
    if (activitiesRaw is List && activitiesRaw.isNotEmpty) {
      return activitiesRaw.map((a) => a.toString().trim()).where((s) => s.isNotEmpty).toList();
    }
    final String raw = user?['activity'] ?? '';
    return raw.isNotEmpty
        ? raw.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList()
        : [];
  }

  @override
  Widget build(BuildContext context) {
    final activities = _parseActivities();

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios_rounded, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.sports_gymnastics, color: Colors.greenAccent, size: 18),
            SizedBox(width: 8),
            Text(
              'MES ACTIVITÉS',
              style: TextStyle(
                color: Colors.white,
                fontWeight: FontWeight.w900,
                letterSpacing: 1.5,
                fontSize: 16,
              ),
            ),
          ],
        ),
        centerTitle: true,
        flexibleSpace: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [Colors.green.shade900.withOpacity(0.5), Colors.transparent],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ),
      body: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: activities.isEmpty
            ? Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.sports_gymnastics, color: Colors.white12, size: 70),
                    const SizedBox(height: 16),
                    const Text(
                      'Aucune activité enregistrée',
                      style: TextStyle(color: Colors.white24, fontSize: 15),
                    ),
                  ],
                ),
              )
            : Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${activities.length} activité${activities.length > 1 ? "s" : ""} inscrite${activities.length > 1 ? "s" : ""}',
                    style: const TextStyle(
                      color: Colors.white38,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 20),
                  ...activities.map((key) {
                    final label = _activityLabels[key] ?? key;
                    final icon = _activityIcons[key] ?? Icons.sports;
                    final color = _activityColors[key] ?? Colors.white;

                    return Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(18),
                      decoration: BoxDecoration(
                        color: const Color(0xFF111111),
                        borderRadius: BorderRadius.circular(18),
                        border: Border.all(color: color.withOpacity(0.25)),
                        boxShadow: [
                          BoxShadow(
                            color: color.withOpacity(0.08),
                            blurRadius: 12,
                            offset: const Offset(0, 4),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 52,
                            height: 52,
                            decoration: BoxDecoration(
                              color: color.withOpacity(0.12),
                              borderRadius: BorderRadius.circular(14),
                            ),
                            child: Icon(icon, color: color, size: 26),
                          ),
                          const SizedBox(width: 16),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  label.toUpperCase(),
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontSize: 15,
                                    fontWeight: FontWeight.bold,
                                    letterSpacing: 1,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  'Activité enregistrée',
                                  style: TextStyle(
                                    color: color.withOpacity(0.7),
                                    fontSize: 11,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.verified_rounded, color: color, size: 22),
                        ],
                      ),
                    );
                  }),
                ],
              ),
      ),
    );
  }
}