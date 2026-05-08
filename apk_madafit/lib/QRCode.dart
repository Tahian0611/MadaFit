import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:qr_flutter/qr_flutter.dart';

class QRCodePage extends StatefulWidget {
  final String token;
  final int userId;

  const QRCodePage({super.key, required this.token, required this.userId});

  @override
  State<QRCodePage> createState() => _QRCodePageState();
}

class _QRCodePageState extends State<QRCodePage> {
  Map<String, dynamic>? _user;
  bool _isLoading = true;
  String? _error;
  String _qrData = '';

  static const String _baseUrl = 'https://www.st-travelnosybe.com/api';

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
      final response = await http
          .get(
            Uri.parse('$_baseUrl/users/${widget.userId}'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Accept': 'application/ld+json',
            },
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final user = jsonDecode(response.body);
        setState(() {
          _user = user;
          final memberId = user['memberId'] ?? 'MAD-${user['id']}';
          _qrData = 'MADAFIT:$memberId';
          _isLoading = false;
        });
      } else {
        setState(() {
          _error =
              'Erreur ${response.statusCode}: Impossible de charger le profil.';
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() {
        _error = 'Erreur réseau : $e';
        _isLoading = false;
      });
    }
  }

  String _getMemberType() {
    final roles = _user?['roles'] as List? ?? [];
    if (roles.contains('ROLE_PREMIUM')) return 'Membre Premium';
    if (roles.contains('ROLE_ADMIN')) return 'Administrateur';
    return 'Membre Standard';
  }

  String _formatExpiryDate() {
    final expiry = _user?['expiryDate'];
    if (expiry == null) return 'N/A';
    final date = DateTime.tryParse(expiry.toString());
    if (date == null) return expiry.toString();
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "MON PASS ACCÈS",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        centerTitle: true,
      ),
      body: SafeArea(
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.redAccent),
              )
            : _error != null
            ? _buildError()
            : _buildContent(),
      ),
    );
  }

  Widget _buildError() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.error_outline, color: Colors.redAccent, size: 50),
          const SizedBox(height: 15),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 30),
            child: Text(
              _error!,
              style: const TextStyle(color: Colors.white70),
              textAlign: TextAlign.center,
            ),
          ),
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

  Widget _buildContent() {
    final String fullName =
        '${_user?['firstName'] ?? ''} ${_user?['lastName'] ?? ''}'.trim();
    final String memberId = _user?['memberId'] ?? 'MAD-${_user?['id']}';
    final String memberType = _getMemberType();
    final String expiryDate = _formatExpiryDate();

    // QR size based on screen width, fixed value — no LayoutBuilder needed
    final double screenWidth = MediaQuery.of(context).size.width;
    final double qrSize = (screenWidth * 0.55).clamp(150.0, 220.0);

    return SingleChildScrollView(
      physics: const BouncingScrollPhysics(),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 500),
          child: Column(
            // No IntrinsicHeight, no minHeight — Column sizes to its children
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Text(
                "SCANNEZ À L'ENTRÉE",
                style: TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 2,
                ),
              ),
              const SizedBox(height: 30),

              // QR Code card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(25),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.redAccent.withOpacity(0.2),
                      blurRadius: 20,
                      spreadRadius: 5,
                    ),
                  ],
                ),
                child: QrImageView(
                  data: _qrData,
                  version: QrVersions.auto,
                  size: qrSize,
                  backgroundColor: Colors.white,
                  errorCorrectionLevel: QrErrorCorrectLevel.M,
                ),
              ),
              const SizedBox(height: 40),

              Text(
                memberType,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
              if (fullName.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  fullName,
                  style: const TextStyle(color: Colors.white54, fontSize: 12),
                ),
              ],
              const SizedBox(height: 4),
              Text(
                "ID: $memberId",
                style: const TextStyle(color: Colors.white38, fontSize: 12),
              ),
              const SizedBox(height: 50),

              _buildInfoCard(
                Icons.timer_outlined,
                "Validité",
                "Jusqu'au $expiryDate",
              ),
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoCard(IconData icon, String label, String value) {
    return Container(
      width: 280,
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.redAccent),
          const SizedBox(width: 15),
          Flexible(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  label,
                  style: const TextStyle(color: Colors.white38, fontSize: 10),
                ),
                Text(
                  value,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
