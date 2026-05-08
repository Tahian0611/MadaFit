import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'Settings.dart';
import 'QRCode.dart';
import 'Payement.dart';

class ProfilePage extends StatefulWidget {
  final VoidCallback? onLogout;
  final String token;

  const ProfilePage({super.key, required this.token, this.onLogout});

  @override
  State<ProfilePage> createState() => _ProfilePageState();
}

class _ProfilePageState extends State<ProfilePage> {
  Map<String, dynamic>? _user;
  bool _isLoading = true;
  String? _error;

  static const String _baseUrl = 'https://www.st-travelnosybe.com/api';

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
          _user = jsonDecode(response.body);
          _isLoading = false;
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
                "Paramètres",
                Icons.settings_outlined,
                Colors.grey,
                () => _navigateTo(
                  context,
                  SettingsPage(token: widget.token, userData: _user),
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
