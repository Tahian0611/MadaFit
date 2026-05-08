import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';

class PayementPage extends StatefulWidget {
  final String token;
  final int userId;

  const PayementPage({super.key, required this.token, required this.userId});

  @override
  State<PayementPage> createState() => _PayementPageState();
}

class _PayementPageState extends State<PayementPage> {
  Map<String, dynamic>? _user;
  List<dynamic> _paymentRecords = [];
  bool _isLoading = true;
  String? _error;

  static final String _baseUrl = ApiConfig.baseUrl;

  @override
  void initState() {
    super.initState();
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });

    try {
      // Fetch user with embedded paymentRecords (thanks to Groups(['user:read']))
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
        setState(() {
          try {
            final data = jsonDecode(response.body);
            _user = data;
            _paymentRecords = data['paymentRecords'] ?? [];
            _isLoading = false;
          } catch (e) {
            _error = 'Format de réponse invalide (HTML reçu au lieu de JSON ?). Détails: $e';
            _isLoading = false;
          }
        });
      } else {
        setState(() {
          _error =
              'Erreur ${response.statusCode}: Impossible de charger les paiements.';
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

  String _formatCurrency(double? amount) {
    if (amount == null) return '0 Ar';
    final str = amount.toInt().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(str[i]);
    }
    return '${buffer.toString()} Ar';
  }

  String _formatDate(String? dateStr) {
    if (dateStr == null) return 'N/A';
    final date = DateTime.tryParse(dateStr);
    if (date == null) return dateStr;
    const months = [
      'Jan',
      'Fév',
      'Mar',
      'Avr',
      'Mai',
      'Juin',
      'Juil',
      'Août',
      'Sep',
      'Oct',
      'Nov',
      'Déc',
    ];
    return '${date.day} ${months[date.month - 1]} ${date.year}';
  }

  String _getSubscriptionLabel() {
    final sub = _user?['subscription'] ?? 'standard';
    switch (sub) {
      case 'monthly':
        return 'Abonnement Mensuel';
      case 'yearly':
        return 'Abonnement Annuel';
      case 'premium':
        return 'Pack Premium';
      default:
        return sub.toString().toUpperCase();
    }
  }

  double? _getCurrentPlanPrice() {
    // If totalPayments is available, use it; otherwise estimate from subscription type
    final total = _user?['totalPayments'];
    if (total != null) return total.toDouble();
    // Fallback: if subscription is 'monthly' -> 90k, 'yearly' -> 900k etc.
    final sub = _user?['subscription'];
    if (sub == 'yearly') return 900000.0;
    return 90000.0;
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
          "PAIEMENT",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14),
        ),
        centerTitle: true,
      ),
      body: _isLoading
          ? const Center(
              child: CircularProgressIndicator(color: Colors.redAccent),
            )
          : _error != null
          ? Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.error_outline,
                    color: Colors.redAccent,
                    size: 50,
                  ),
                  const SizedBox(height: 15),
                  Text(_error!, style: const TextStyle(color: Colors.white70)),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: _fetchData,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                    ),
                    child: const Text("Réessayer"),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    "ABONNEMENT ACTUEL",
                    style: TextStyle(
                      color: Colors.white38,
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  _buildCurrentPlan(),
                  const SizedBox(height: 30),
                  const Text(
                    "HISTORIQUE",
                    style: TextStyle(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 10),
                  if (_paymentRecords.isEmpty)
                    Container(
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: const Color(0xFF151515),
                        borderRadius: BorderRadius.circular(15),
                      ),
                      child: const Center(
                        child: Text(
                          "Aucun paiement enregistré.",
                          style: TextStyle(color: Colors.white38),
                        ),
                      ),
                    )
                  else
                    ..._paymentRecords.map((record) => _historyItem(record)),
                ],
              ),
            ),
    );
  }

  Widget _buildCurrentPlan() {
    final price = _getCurrentPlanPrice();
    final label = _getSubscriptionLabel();
    final expiry = _user?['expiryDate'];
    final expiryStr = expiry != null ? _formatDate(expiry) : 'N/A';

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFB71C1C), Color(0xFFD32F2F)],
        ),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w900,
                  fontSize: 18,
                ),
              ),
              Text(
                "Valable jusqu'au $expiryStr",
                style: const TextStyle(color: Colors.white70, fontSize: 12),
              ),
            ],
          ),
          Text(
            _formatCurrency(price),
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.bold,
              fontSize: 20,
            ),
          ),
        ],
      ),
    );
  }

  Widget _historyItem(Map<String, dynamic> record) {
    final date = _formatDate(record['date']);
    final amount = _formatCurrency(record['amount']);
    final method = record['method'] ?? 'Inconnu';
    final subscription = record['subscription'] ?? '';
    final status = _getStatus(record);

    return ListTile(
      contentPadding: EdgeInsets.zero,
      title: Text(
        "$date - ${subscription.isNotEmpty ? subscription : method}",
        style: const TextStyle(color: Colors.white70),
      ),
      subtitle: Text(
        status,
        style: const TextStyle(color: Colors.green, fontSize: 12),
      ),
      trailing: Text(
        amount,
        style: const TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  String _getStatus(Map<String, dynamic> record) {
    // Assume all fetched payments are successful
    return "Payé";
  }
}
