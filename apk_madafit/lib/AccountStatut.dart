import 'package:flutter/material.dart';
import 'EditProfile.dart'; // Add this to use UserModel and UserApiService

class AccountStatusPage extends StatefulWidget {
  final String token;
  final int userId;

  const AccountStatusPage({
    super.key,
    required this.token,
    required this.userId,
  });

  @override
  State<AccountStatusPage> createState() => _AccountStatusPageState();
}

class _AccountStatusPageState extends State<AccountStatusPage> {
  UserModel? _user;
  bool _isLoading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    _fetchUserData();
  }

  Future<void> _fetchUserData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      final user = await UserApiService.fetchUser(widget.userId, widget.token);
      setState(() {
        _user = user;
        _isLoading = false;
      });
    } catch (e) {
      debugPrint('💥 fetchUserData error: $e');
      setState(() {
        _error = 'Impossible de charger le statut du compte.';
        _isLoading = false;
      });
    }
  }

  String _getMemberType() {
    final roles = _user?.roles ?? [];
    if (roles.contains('ROLE_PREMIUM')) return 'Membre Premium';
    if (roles.contains('ROLE_ADMIN')) return 'Administrateur';
    return 'Membre Standard';
  }

  String _getSubscriptionLabel() {
    final sub = _user?.subscription ?? 'Non spécifié';
    return sub.toUpperCase();
  }

  String _getExpiryDate() {
    final expiry = _user?.dob; // Placeholder if no expiry date in UserModel
    if (expiry == null) return 'N/A';
    return '${expiry.day} ${_monthAbbr(expiry.month)}. ${expiry.year}';
  }

  String _monthAbbr(int month) {
    const months = ['Janv.', 'Fév.', 'Mars', 'Avr.', 'Mai', 'Juin', 'Juil.', 'Août', 'Sept.', 'Oct.', 'Nov.', 'Déc.'];
    return months[month - 1];
  }

  String _getMedicalStatus() {
    final notes = _user?.medicalNotes;
    if (notes == null || notes.isEmpty) return 'Aucune info';
    return notes.length > 20 ? 'Renseigné' : notes;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text("STATUT",
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
        centerTitle: true,
      ),
      body: SafeArea(
        child: LayoutBuilder(
          builder: (context, constraints) {
            if (_isLoading) {
              return const Center(child: CircularProgressIndicator(color: Colors.redAccent));
            }
            if (_error != null) {
              return Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.error_outline, color: Colors.redAccent, size: 50),
                    const SizedBox(height: 15),
                    Text(_error!, style: const TextStyle(color: Colors.white70)),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _fetchUserData,
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      child: const Text("Réessayer"),
                    ),
                  ],
                ),
              );
            }

            final String memberId = _user?.memberId ?? '#MAD-${_user?.id ?? '---'}';
            final String fullName = '${_user?.firstName ?? ''} ${_user?.lastName ?? ''}'.trim();
            final String memberType = _getMemberType();
            final String subscription = _getSubscriptionLabel();
            final String expiryDate = _getExpiryDate();
            final String medicalStatus = _getMedicalStatus();
            final String status = 'Actif';

            return SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 25),
                child: Center(
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      maxWidth: 500,
                      minHeight: constraints.maxHeight,
                    ),
                    child: IntrinsicHeight(
                      child: Column(
                        children: [
                          const SizedBox(height: 40),

                          // --- BADGE DE STATUT ---
                          Center(
                            child: Stack(
                              alignment: Alignment.center,
                              children: [
                                Container(
                                  width: 120,
                                  height: 120,
                                  decoration: BoxDecoration(
                                    shape: BoxShape.circle,
                                    border: Border.all(color: Colors.redAccent.withOpacity(0.2), width: 8),
                                  ),
                                ),
                                const Icon(Icons.verified_rounded, color: Colors.redAccent, size: 80),
                              ],
                            ),
                          ),

                          const SizedBox(height: 20),
                          Text(
                            status == 'Actif' ? "COMPTE VÉRIFIÉ" : "COMPTE $status",
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 22),
                          ),
                          Text(
                            memberType,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600, fontSize: 14),
                          ),
                          if (fullName.isNotEmpty) ...[
                            const SizedBox(height: 5),
                            Text(
                              fullName,
                              style: const TextStyle(color: Colors.white54, fontSize: 12),
                            ),
                          ],

                          const SizedBox(height: 40),

                          // --- DETAILS DU COMPTE ---
                          Container(
                            padding: const EdgeInsets.all(20),
                            decoration: BoxDecoration(
                              color: const Color(0xFF151515),
                              borderRadius: BorderRadius.circular(20),
                            ),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                _buildStatusRow("ID Membre", memberId),
                                const Divider(color: Colors.white10, height: 30),
                                // _buildStatusRow("Type d'adhésion", subscription),
                                // const Divider(color: Colors.white10, height: 30),
                                // _buildStatusRow("Prochain renouvellement", expiryDate),
                                // const Divider(color: Colors.white10, height: 30),
                                _buildStatusRow("Statut médical", medicalStatus,
                                    color: medicalStatus == 'Aucune info' ? Colors.white38 : Colors.greenAccent),
                              ],
                            ),
                          ),

                          const Expanded(child: SizedBox(height: 40)),

                          // --- PETIT MESSAGE D'ENCOURAGEMENT ---
                          const Text(
                            "Votre discipline est votre seule limite.",
                            textAlign: TextAlign.center,
                            style: TextStyle(color: Colors.white24, fontStyle: FontStyle.italic, fontSize: 12),
                          ),
                          const SizedBox(height: 40),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            );
          },
        ),
      ),
    );
  }

  Widget _buildStatusRow(String label, String value, {Color color = Colors.white}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Flexible(
          child: Text(label, style: const TextStyle(color: Colors.white38, fontSize: 13)),
        ),
        const SizedBox(width: 10),
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 14)),
      ],
    );
  }
}