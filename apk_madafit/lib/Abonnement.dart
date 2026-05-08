import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;

class SubscriptionPlan {
  final int id;
  final String name;
  final String type;
  final int duration;
  final double price;
  final List<String> features;
  final String? color;
  final bool popular;

  SubscriptionPlan({
    required this.id,
    required this.name,
    required this.type,
    required this.duration,
    required this.price,
    required this.features,
    this.color,
    required this.popular,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    // Every nullable field gets a safe default
    return SubscriptionPlan(
      id: json['id'] ?? 0,
      name: json['name']?.toString() ?? 'Formule',
      type: json['type']?.toString() ?? 'monthly',
      duration: (json['duration'] as num?)?.toInt() ?? 1,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      features:
          (json['features'] as List?)?.map((e) => e.toString()).toList() ?? [],
      color: json['color']?.toString(),
      popular: json['popular'] == true,
    );
  }
}

class AbonnementPage extends StatefulWidget {
  final String token;
  final int? userId;

  const AbonnementPage({super.key, required this.token, this.userId});

  @override
  State<AbonnementPage> createState() => _AbonnementPageState();
}

class _AbonnementPageState extends State<AbonnementPage> {
  List<SubscriptionPlan> _plans = [];
  bool _isLoading = true;
  String? _error;

  static const String _baseUrl = 'https://www.st-travelnosybe.com/api';

  @override
  void initState() {
    super.initState();
    _fetchPlans();
  }

  Future<void> _fetchPlans() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      final response = await http
          .get(
            Uri.parse('$_baseUrl/subscription_plans'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Accept': 'application/ld+json',
            },
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        final List<dynamic> members =
            data['hydra:member'] ?? data['member'] ?? [];
        setState(() {
          _plans = members
              .map((json) => SubscriptionPlan.fromJson(json))
              .toList();
          _isLoading = false;
        });
      } else {
        setState(() {
          _error = 'Erreur ${response.statusCode}';
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

  String _formatPrice(double price) {
    // price is never null (default 0.0)
    final str = price.toInt().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  String _formatPeriod(int duration) {
    if (duration == 1) return '/ mois';
    if (duration == 12) return '/ an';
    return '/ $duration mois';
  }

  Color _getColorFromHex(String? hex) {
    if (hex == null || hex.isEmpty) return Colors.redAccent;
    final buffer = StringBuffer();
    final cleanHex = hex.replaceFirst('#', '');
    if (cleanHex.length == 6) {
      buffer.write('FF');
      buffer.write(cleanHex);
    } else if (cleanHex.length == 8) {
      buffer.write(cleanHex);
    } else {
      return Colors.redAccent;
    }
    return Color(int.parse(buffer.toString(), radix: 16));
  }

  void _onSubscribe(SubscriptionPlan plan) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Souscription à ${plan.name}'),
        backgroundColor: Colors.green,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final double systemBottomPadding = MediaQuery.of(context).padding.bottom;
    const double footerNavbarHeight = 85.0;

    return Scaffold(
      backgroundColor: Colors.black,
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
                    onPressed: _fetchPlans,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                    ),
                    child: const Text("Réessayer"),
                  ),
                ],
              ),
            )
          : SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const SizedBox(height: 10),
                  _buildHeader(),
                  const SizedBox(height: 30),
                  ..._plans.map((plan) => _buildSubscriptionCard(plan)),
                  const SizedBox(height: 20),
                  _buildPaymentInfo(),
                  SizedBox(
                    height: systemBottomPadding + footerNavbarHeight + 20,
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildHeader() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          "CHOISISSEZ VOTRE\nDESTIN.",
          style: TextStyle(
            color: Colors.white,
            fontSize: 28,
            fontWeight: FontWeight.w900,
            height: 1.1,
          ),
        ),
        const SizedBox(height: 10),
        Text(
          "Peu importe votre niveau, nous avons le plan parfait pour vous faire progresser.",
          style: TextStyle(color: Colors.white.withOpacity(0.5), fontSize: 14),
        ),
      ],
    );
  }

  Widget _buildSubscriptionCard(SubscriptionPlan plan) {
    final Color planColor = _getColorFromHex(plan.color);
    final String priceFormatted = _formatPrice(plan.price);
    final String period = _formatPeriod(plan.duration);

    return Container(
      margin: const EdgeInsets.only(bottom: 20),
      decoration: BoxDecoration(
        color: const Color(0xFF151515),
        borderRadius: BorderRadius.circular(25),
        border: Border.all(
          color: plan.popular ? planColor : Colors.white.withOpacity(0.05),
          width: 2,
        ),
      ),
      child: Stack(
        children: [
          if (plan.popular)
            Positioned(
              top: 0,
              right: 20,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ),
                decoration: BoxDecoration(
                  color: planColor,
                  borderRadius: const BorderRadius.only(
                    bottomLeft: Radius.circular(10),
                    bottomRight: Radius.circular(10),
                  ),
                ),
                child: const Text(
                  "POPULAIRE",
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(25.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  plan.name,
                  style: TextStyle(
                    color: planColor,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1,
                  ),
                ),
                const SizedBox(height: 10),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      "$priceFormatted Ar",
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 32,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    Padding(
                      padding: const EdgeInsets.only(bottom: 5, left: 4),
                      child: Text(
                        period,
                        style: const TextStyle(
                          color: Colors.white38,
                          fontSize: 14,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Divider(color: Colors.white10),
                const SizedBox(height: 15),
                ...plan.features.map(
                  (feature) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Row(
                      children: [
                        Icon(Icons.check_circle, color: planColor, size: 18),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            feature,
                            style: const TextStyle(
                              color: Colors.white70,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPaymentInfo() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(15),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, color: Colors.white38),
          const SizedBox(width: 15),
          Expanded(
            child: Text(
              "Paiements acceptés via MVola, AirtelMoney ou directement à la salle. Sans engagement.",
              style: TextStyle(
                color: Colors.white.withOpacity(0.4),
                fontSize: 12,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
