import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'Settings.dart';
import 'QRCode.dart';
import 'Payement.dart';
import 'api_config.dart';

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
class UserOffresPage extends StatelessWidget {
  final String token;
  final Map<String, dynamic>? user;

  const UserOffresPage({super.key, required this.token, required this.user});

  @override
  Widget build(BuildContext context) {
    // Parser les offres (champ 'subscription' = noms séparés par des virgules)
    final String rawSubscription = user?['subscription'] ?? '';
    final List<String> offres = rawSubscription.isNotEmpty
        ? rawSubscription.split(',').map((s) => s.trim()).where((s) => s.isNotEmpty).toList()
        : [];
    final int totalPayments = (user?['totalPayments'] as num?)?.toInt() ?? 0;
    final String accessType = user?['accessType'] ?? '';

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
            Icon(Icons.workspace_premium, color: Colors.redAccent, size: 18),
            SizedBox(width: 8),
            Text(
              'MES OFFRES',
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
              colors: [Colors.red.shade900, Colors.transparent],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Résumé paiement ──────────────────────────────────
            Container(
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
                boxShadow: [
                  BoxShadow(
                    color: Colors.red.withOpacity(0.2),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                children: [
                  const Icon(Icons.workspace_premium, color: Colors.redAccent, size: 40),
                  const SizedBox(height: 12),
                  const Text(
                    'TOTAL SOUSCRIT',
                    style: TextStyle(color: Colors.white54, fontSize: 11, letterSpacing: 2),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _formatPrice(totalPayments),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1,
                    ),
                  ),
                  const Text(
                    'Ariary',
                    style: TextStyle(color: Colors.white54, fontSize: 13),
                  ),
                  if (accessType.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        accessType == 'abonnement' ? '🏷️ Abonnement' : '🏷️ Séance simple',
                        style: const TextStyle(color: Colors.white70, fontSize: 12),
                      ),
                    ),
                  ],
                ],
              ),
            ),

            const SizedBox(height: 30),

            // ── Liste des offres ────────────────────────────────
            if (offres.isEmpty)
              Center(
                child: Column(
                  children: [
                    const SizedBox(height: 30),
                    Icon(Icons.inbox_rounded, color: Colors.white12, size: 60),
                    const SizedBox(height: 12),
                    const Text(
                      'Aucune offre enregistrée',
                      style: TextStyle(color: Colors.white24, fontSize: 14),
                    ),
                  ],
                ),
              )
            else ...[
              const Text(
                'DÉTAIL DES OFFRES',
                style: TextStyle(
                  color: Colors.grey,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5,
                ),
              ),
              const SizedBox(height: 12),
              ...offres.asMap().entries.map((entry) {
                final i = entry.key;
                final offre = entry.value;
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1A1A1A),
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: Colors.redAccent.withOpacity(0.15)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withOpacity(0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Center(
                          child: Text(
                            '${i + 1}',
                            style: const TextStyle(
                              color: Colors.redAccent,
                              fontWeight: FontWeight.bold,
                              fontSize: 14,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Text(
                          offre,
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const Icon(Icons.check_circle, color: Colors.greenAccent, size: 20),
                    ],
                  ),
                );
              }),
            ],
          ],
        ),
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
