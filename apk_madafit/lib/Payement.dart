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

  String _formatCurrency(num? amount) {
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

  // ═══════════════════════════════════════════════════════════════════════
  // NOUVEAU : Calculer le total payé et le nombre de transactions
  // ═══════════════════════════════════════════════════════════════════════
  num _calculateTotalPaid() {
    return _paymentRecords.fold<num>(0, (sum, record) {
      final amount = record['amount'];
      if (amount is num) return sum + amount;
      return sum;
    });
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
          "HISTORIQUE DES PAIEMENTS",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14, letterSpacing: 1.5),
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
          : RefreshIndicator(
              onRefresh: _fetchData,
              color: Colors.redAccent,
              backgroundColor: const Color(0xFF1A1A1A),
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // ═══════════════════════════════════════════════════════════════════════
                    // NOUVEAU : Carte récapitulative (remplace "Abonnement actuel")
                    // ═══════════════════════════════════════════════════════════════════════
                    _buildSummaryCard(),

                    const SizedBox(height: 30),

                    const Text(
                      "TRANSACTIONS",
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 15),

                    if (_paymentRecords.isEmpty)
                      Container(
                        padding: const EdgeInsets.all(30),
                        decoration: BoxDecoration(
                          color: const Color(0xFF151515),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: Colors.white.withOpacity(0.05)),
                        ),
                        child: const Center(
                          child: Column(
                            children: [
                              Icon(Icons.receipt_long, color: Colors.white24, size: 50),
                              SizedBox(height: 12),
                              Text(
                                "Aucun paiement enregistré.",
                                style: TextStyle(color: Colors.white38, fontSize: 14),
                              ),
                            ],
                          ),
                        ),
                      )
                    else
                      ..._paymentRecords.map((record) => _historyItem(record)),
                  ],
                ),
              ),
            ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // NOUVEAU : Carte récapitulative avec total et nombre de transactions
  // ═══════════════════════════════════════════════════════════════════════
  Widget _buildSummaryCard() {
    final totalPaid = _calculateTotalPaid();
    final transactionCount = _paymentRecords.length;

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
        boxShadow: [
          BoxShadow(
            color: Colors.red.withOpacity(0.15),
            blurRadius: 20,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(Icons.account_balance_wallet, color: Colors.redAccent, size: 40),
          const SizedBox(height: 12),
          Text(
            _formatCurrency(totalPaid),
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            "$transactionCount transaction${transactionCount > 1 ? 's' : ''}",
            style: const TextStyle(
              color: Colors.white70,
              fontSize: 12,
              fontWeight: FontWeight.w300,
            ),
          ),
        ],
      ),
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MODIFIÉ : Meilleure présentation des transactions
  // ═══════════════════════════════════════════════════════════════════════
  Widget _historyItem(Map<String, dynamic> record) {
    final date = _formatDate(record['date']);
    final amount = _formatCurrency(record['amount']);
    final method = record['method'] ?? 'Espèces';
    final subscription = record['subscription'] ?? '';
    final receiptNo = record['receiptNo'] ?? '';

    // Déterminer la couleur selon le montant
    final num? amountValue = record['amount'];
    final bool isPositive = (amountValue ?? 0) > 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.05)),
      ),
      child: Row(
        children: [
          // Icône de transaction
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(
              color: isPositive ? Colors.green.withOpacity(0.1) : Colors.red.withOpacity(0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              isPositive ? Icons.arrow_downward : Icons.arrow_upward,
              color: isPositive ? Colors.greenAccent : Colors.redAccent,
              size: 20,
            ),
          ),
          const SizedBox(width: 16),
          // Détails
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subscription.isNotEmpty ? subscription.toUpperCase() : 'PAIEMENT',
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  date,
                  style: const TextStyle(color: Colors.white38, fontSize: 11),
                ),
                if (receiptNo.isNotEmpty)
                  Text(
                    'N° $receiptNo',
                    style: const TextStyle(color: Colors.white24, fontSize: 10),
                  ),
              ],
            ),
          ),
          // Montant
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                amount,
                style: TextStyle(
                  color: isPositive ? Colors.greenAccent : Colors.redAccent,
                  fontWeight: FontWeight.w900,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 2),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.05),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  method,
                  style: const TextStyle(color: Colors.white38, fontSize: 10),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  String _getStatus(Map<String, dynamic> record) {
    // Assume all fetched payments are successful
    return "Payé";
  }
}