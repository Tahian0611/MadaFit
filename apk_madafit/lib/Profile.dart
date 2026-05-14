import 'package:flutter/material.dart';
import 'dart:convert';
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

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? _user;
  bool _isLoading = true;
  String? _error;

  static final String _baseUrl = ApiConfig.baseUrl;

  @override
  void initState() {
    super.initState();
    _fetchProfile();
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
    final String coach = _user?['coach'] ?? 'Coach FitMania';
    final double weeklyGoal =
        double.tryParse(_user?['weeklyGoalProgress']?.toString() ?? '') ?? 0.0;

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
              // 1. CARTE DE MEMBRE VIRTUELLE
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
                    const CircleAvatar(
                      radius: 40,
                      backgroundColor: Colors.white24,
                      child: Icon(Icons.person, size: 50, color: Colors.white),
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
                    const SizedBox(height: 20),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text(
                              "Objectif hebdo",
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                              ),
                            ),
                            Text(
                              '${(weeklyGoal * 100).toInt()}%',
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 5),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(10),
                          child: LinearProgressIndicator(
                            value: weeklyGoal.clamp(0.0, 1.0),
                            backgroundColor: Colors.white12,
                            valueColor: const AlwaysStoppedAnimation<Color>(
                              Colors.white,
                            ),
                            minHeight: 6,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 30),

              // 2. INFORMATIONS DÉTAILLÉES
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
                    const Divider(color: Colors.white10, height: 25),
                    _buildDetailRow("Coach référent", coach),
                  ],
                ),
              ),

              const SizedBox(height: 30),

              // 3. MENU DE GESTION
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

              const SizedBox(height: 100),
            ],
          ),
        ),
      ),
    );
  }

  void _navigateTo(BuildContext context, Widget page) {
    Navigator.push(context, MaterialPageRoute(builder: (context) => page));
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
}

// ============================================================
//  PAGE MES OFFRES
// ============================================================
// ============================================================
//  PAGE MES OFFRES
// ============================================================
class UserOffresPage extends StatefulWidget {
  final String token;
  final Map<String, dynamic>? user;

  const UserOffresPage({super.key, required this.token, required this.user});

  @override
  State<UserOffresPage> createState() => _UserOffresPageState();
}

class _UserOffresPageState extends State<UserOffresPage> {
  List<SubscriptionPlan> _plans = [];
  Map<String, dynamic>? _userData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _userData = widget.user;
    _fetchData();
  }

  Future<void> _fetchData() async {
    final baseUrl = ApiConfig.baseUrl;
    final headers = {
      'Authorization': 'Bearer ${widget.token}',
      'Accept': 'application/ld+json',
    };

    try {
      // 1. Fetch Plans
      final plansRes = await http.get(Uri.parse('$baseUrl/subscription_plans'), headers: headers);
      if (plansRes.statusCode == 200) {
        final data = jsonDecode(plansRes.body);
        final List<dynamic> members = data['member'] ?? data['hydra:member'] ?? [];
        _plans = members.map((json) => SubscriptionPlan.fromJson(json)).toList();
      }

      // 2. Fetch fresh user data (to get payments)
      if (widget.user?['id'] != null) {
        final userRes = await http.get(Uri.parse('$baseUrl/users/${widget.user!['id']}'), headers: headers);
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
    // Parser les offres (champ 'subscription' = noms séparés par des virgules)
    final String rawSubscription = _userData?['subscription'] ?? '';
    final List<String> subs = rawSubscription.isNotEmpty
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
                    // Résumé paiement
                    _buildSummaryCard(totalPayments),

                    const SizedBox(height: 30),

                    if (subs.isEmpty)
                      _buildEmptyState()
                    else ...[
                      const Text(
                        'VOS ABONNEMENTS ACTIFS',
                        style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
                      ),
                      const SizedBox(height: 15),
                      ...subs.map((s) => _buildSubscriptionCard(s, payments)),
                    ],
                    const SizedBox(height: 100),
                  ],
                ),
              ),
            ),
    );
  }

  Widget _buildSummaryCard(int total) {
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
          const Text('TOTAL SOUSCRIT', style: TextStyle(color: Colors.white54, fontSize: 11, letterSpacing: 2)),
          const SizedBox(height: 6),
          Text(_formatPrice(total), style: const TextStyle(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900)),
          const Text('Ariary', style: TextStyle(color: Colors.white54, fontSize: 12)),
        ],
      ),
    );
  }

  Widget _buildSubscriptionCard(String s, List<dynamic> payments) {
    final plan = _plans.firstWhere((p) => p.name == s, 
      orElse: () => SubscriptionPlan(id: 0, name: s, type: '', duration: 0, price: 0, features: [], popular: false));
    
    final double price = plan.price.toDouble();
    double paidForThis = 0;
    for (var p in payments) {
      if (p['subscription'] == s) paidForThis += (p['amount'] as num?)?.toDouble() ?? 0.0;
    }
    final double balance = price - paidForThis;

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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text("Reste à payer", style: TextStyle(color: Colors.white38, fontSize: 10)),
                  Text(
                    "${_formatPrice(balance.toInt() > 0 ? balance.toInt() : 0)} Ar",
                    style: TextStyle(
                      color: balance > 0 ? Colors.orangeAccent : Colors.greenAccent,
                      fontSize: 18,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ],
              ),
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

          // Progression du temps
          if (_userData?['startDate'] != null && _userData?['expiryDate'] != null) ...[
            const SizedBox(height: 20),
            () {
              final start = DateTime.parse(_userData?['startDate']);
              final end = DateTime.parse(_userData?['expiryDate']);
              final now = DateTime.now();
              final total = end.difference(start).inSeconds;
              final elapsed = now.difference(start).inSeconds;
              final double progress = total > 0 ? (elapsed / total).clamp(0.0, 1.0) : 0.0;
              final int percent = (progress * 100).toInt();
              
              return Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text("Validité (temps écoulé)", style: const TextStyle(color: Colors.white38, fontSize: 10)),
                      Text("$percent%", style: TextStyle(color: progress >= 0.9 ? Colors.redAccent : Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: LinearProgressIndicator(
                      value: progress,
                      backgroundColor: Colors.white.withOpacity(0.05),
                      valueColor: AlwaysStoppedAnimation<Color>(progress >= 0.9 ? Colors.redAccent : Colors.blueAccent),
                      minHeight: 6,
                    ),
                  ),
                ],
              );
            }(),
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
}

// ============================================================
//  PAGE MES ACTIVITÉS
// ============================================================
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
    // Essayer d'abord le champ 'activities' (liste)
    final dynamic activitiesRaw = user?['activities'];
    if (activitiesRaw is List && activitiesRaw.isNotEmpty) {
      return activitiesRaw.map((a) => a.toString().trim()).where((s) => s.isNotEmpty).toList();
    }
    // Sinon parser le champ 'activity' (string CSV)
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
