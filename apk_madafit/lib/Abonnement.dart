import 'package:flutter/material.dart';
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'api_config.dart';
import 'Payement.dart';

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

  // User & Payment state
  Map<String, dynamic>? _user;
  final TextEditingController _promoController = TextEditingController();
  Map<String, dynamic>? _appliedPromo;
  bool _isValidatingPromo = false;

  static final String _baseUrl = ApiConfig.baseUrl;

  @override
  void initState() {
    super.initState();
    _fetchPlans();
    _fetchUser();
  }

  Future<void> _fetchUser() async {
    if (widget.userId == null) return;
    try {
      final response = await http.get(
        Uri.parse('$_baseUrl/users/${widget.userId}'),
        headers: {
          'Authorization': 'Bearer ${widget.token}',
          'Accept': 'application/ld+json',
        },
      );
      if (response.statusCode == 200) {
        setState(() {
          _user = jsonDecode(response.body);
        });
      }
    } catch (e) {
      print('Erreur fetch user: $e');
    }
  }

  @override
  void dispose() {
    _promoController.dispose();
    super.dispose();
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
        try {
          final data = jsonDecode(response.body);
          print('🟢 Full API Response (Abonnement): ${response.body}');
          final List<dynamic> members =
              data['member'] ?? data['hydra:member'] ?? [];
          print('🟡 Formules trouvées: ${members.length}');
          setState(() {
            _plans = members
                .map((json) => SubscriptionPlan.fromJson(json))
                .toList();
            _isLoading = false;
          });
        } catch (e) {
          setState(() {
            _error = 'Format de réponse invalide. Détails: $e';
            _isLoading = false;
          });
        }
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

  Future<void> _validatePromoCode() async {
    final code = _promoController.text.trim();
    if (code.isEmpty) return;

    setState(() {
      _isValidatingPromo = true;
    });

    try {
      final response = await http
          .post(
            Uri.parse('$_baseUrl/promo_codes/validate'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Content-Type': 'application/json',
            },
            body: jsonEncode({'code': code}),
          )
          .timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        setState(() {
          _appliedPromo = data;
          _isValidatingPromo = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('✓ Code promo appliqué !'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        setState(() {
          _appliedPromo = null;
          _isValidatingPromo = false;
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content: Text('Code promo invalide ou expiré'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      setState(() {
        _isValidatingPromo = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erreur : $e')));
      }
    }
  }

  String _formatPrice(double price) {
    final str = price.toInt().toString();
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  double _calculateDiscountedPrice(double originalPrice) {
    if (_appliedPromo == null) return originalPrice;

    double discountedPrice = originalPrice;
    if (_appliedPromo!['discountPercentage'] != null) {
      discountedPrice -=
          (originalPrice * (_appliedPromo!['discountPercentage'] / 100));
    } else if (_appliedPromo!['discountAmount'] != null) {
      discountedPrice -= _appliedPromo!['discountAmount'];
    }

    return discountedPrice > 0 ? discountedPrice : 0;
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

  // ═══════════════════════════════════════════════════════════════════════
  // MODIFIÉ : _onSubscribe crée maintenant un UserSubscription au lieu de
  // modifier le champ subscription du User
  // ═══════════════════════════════════════════════════════════════════════
  void _onSubscribe(SubscriptionPlan plan) async {
    if (widget.userId == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Erreur: Utilisateur non identifié")),
      );
      return;
    }

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => const Center(
        child: CircularProgressIndicator(color: Colors.redAccent),
      ),
    );

    try {
      // NOUVEAU : Créer un UserSubscription avec status 'pending'
      final body = {
        'user': '/api/users/${widget.userId}',
        'planName': plan.name,
        'status': 'pending',
        'totalPaid': 0.0,
      };

      if (_appliedPromo != null) {
        body['promotion'] = _appliedPromo!['code'];
      }

      final response = await http
          .post(
            Uri.parse('$_baseUrl/user_subscriptions'),
            headers: {
              'Authorization': 'Bearer ${widget.token}',
              'Content-Type': 'application/ld+json',
              'Accept': 'application/ld+json',
            },
            body: jsonEncode(body),
          )
          .timeout(const Duration(seconds: 10));

      if (mounted) Navigator.of(context).pop();

      if (response.statusCode == 201 || response.statusCode == 200) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('✓ Demande envoyée : ${plan.name}'),
              backgroundColor: Colors.green,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Erreur lors du choix : ${response.statusCode}'),
              backgroundColor: Colors.redAccent,
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        Navigator.of(context).pop();
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Erreur réseau : $e')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final double systemBottomPadding = MediaQuery.of(context).padding.bottom;
    const double footerNavbarHeight = 85.0;

    return Scaffold(
      backgroundColor: Colors.black,
      body: RefreshIndicator(
        onRefresh: _fetchPlans,
        color: Colors.redAccent,
        backgroundColor: const Color(0xFF151515),
        child: _isLoading
            ? const Center(
                child: CircularProgressIndicator(color: Colors.redAccent),
              )
            : _error != null
            ? SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: SizedBox(
                  height: MediaQuery.of(context).size.height * 0.7,
                  child: Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(
                          Icons.error_outline,
                          color: Colors.redAccent,
                          size: 50,
                        ),
                        const SizedBox(height: 15),
                        Text(
                          _error!,
                          style: const TextStyle(color: Colors.white70),
                        ),
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
                  ),
                ),
              )
            : SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.symmetric(horizontal: 20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 10),
                    _buildHeader(),
                    const SizedBox(height: 20),
                    _buildPromoSection(),
                    const SizedBox(height: 20),
                    const SizedBox(height: 20),
                    const Text(
                      "OFFRES DISPONIBLES",
                      style: TextStyle(
                        color: Colors.white38,
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 15),
                    ..._plans.map((plan) => _buildSubscriptionCard(plan)),
                    const SizedBox(height: 20),
                    _buildPaymentInfo(),
                    SizedBox(
                      height: systemBottomPadding + footerNavbarHeight + 20,
                    ),
                  ],
                ),
              ),
      ),
    );
  }

  Widget _buildHeader() {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: Column(
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
                style: TextStyle(
                  color: Colors.white.withOpacity(0.5),
                  fontSize: 14,
                ),
              ),
            ],
          ),
        ),
        IconButton(
          onPressed: _fetchPlans,
          icon: const Icon(Icons.refresh, color: Colors.redAccent, size: 28),
          tooltip: "Actualiser les offres",
        ),
      ],
    );
  }

  Widget _buildPromoSection() {
    return Container(
      padding: const EdgeInsets.all(15),
      decoration: BoxDecoration(
        color: const Color(0xFF1A1A1A),
        borderRadius: BorderRadius.circular(15),
        border: Border.all(color: Colors.white10),
      ),
      // child: Column(
      //   crossAxisAlignment: CrossAxisAlignment.start,
      //   children: [
      //     const Text(
      //       "CODE PROMO",
      //       style: TextStyle(
      //         color: Colors.white38,
      //         fontSize: 10,
      //         fontWeight: FontWeight.bold,
      //         letterSpacing: 1.2,
      //       ),
      //     ),
      //     const SizedBox(height: 10),
      //     Row(
      //       children: [
      //         Expanded(
      //           child: TextField(
      //             controller: _promoController,
      //             style: const TextStyle(color: Colors.white, fontSize: 14),
      //             decoration: InputDecoration(
      //               hintText: "Entrez un code...",
      //               hintStyle: const TextStyle(color: Colors.white24),
      //               filled: true,
      //               fillColor: Colors.black26,
      //               contentPadding: const EdgeInsets.symmetric(
      //                 horizontal: 15,
      //                 vertical: 0,
      //               ),
      //               border: OutlineInputBorder(
      //                 borderRadius: BorderRadius.circular(10),
      //                 borderSide: BorderSide.none,
      //               ),
      //             ),
      //           ),
      //         ),
      //         const SizedBox(width: 10),
      //         SizedBox(
      //           height: 45,
      //           child: ElevatedButton(
      //             onPressed: _isValidatingPromo ? null : _validatePromoCode,
      //             style: ElevatedButton.styleFrom(
      //               backgroundColor: Colors.white10,
      //               foregroundColor: Colors.white,
      //               shape: RoundedRectangleBorder(
      //                 borderRadius: BorderRadius.circular(10),
      //               ),
      //             ),
      //             child: _isValidatingPromo
      //                 ? const SizedBox(
      //                     width: 20,
      //                     height: 20,
      //                     child: CircularProgressIndicator(
      //                       strokeWidth: 2,
      //                       color: Colors.white,
      //                     ),
      //                   )
      //                 : const Text("APPLIQUER"),
      //           ),
      //         ),
      //       ],
      //     ),
      //     if (_appliedPromo != null) ...[
      //       const SizedBox(height: 10),
      //       Row(
      //         children: [
      //           const Icon(Icons.check_circle, color: Colors.green, size: 16),
      //           const SizedBox(width: 5),
      //           Text(
      //             "Réduction de ${_appliedPromo!['discountPercentage'] != null ? '${_appliedPromo!['discountPercentage']}%' : '${_appliedPromo!['discountAmount']} Ar'} appliquée !",
      //             style: const TextStyle(color: Colors.green, fontSize: 12),
      //           ),
      //           const Spacer(),
      //           TextButton(
      //             onPressed: () => setState(() => _appliedPromo = null),
      //             child: const Text(
      //               "Supprimer",
      //               style: TextStyle(color: Colors.redAccent, fontSize: 12),
      //             ),
      //           ),
      //         ],
      //       ),
      //     ],
      //   ],
      // ),
    );
  }

  Widget _buildSubscriptionCard(SubscriptionPlan plan) {
    final Color planColor = _getColorFromHex(plan.color);
    final double originalPrice = plan.price;
    final double discountedPrice = _calculateDiscountedPrice(originalPrice);
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
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_appliedPromo != null &&
                            discountedPrice < originalPrice)
                          Text(
                            "${_formatPrice(originalPrice)} Ar",
                            style: const TextStyle(
                              color: Colors.white38,
                              fontSize: 16,
                              decoration: TextDecoration.lineThrough,
                            ),
                          ),
                        Text(
                          "${_formatPrice(discountedPrice)} Ar",
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 32,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ],
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
                const SizedBox(height: 25),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () => _onSubscribe(plan),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: planColor,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(15),
                      ),
                      elevation: 5,
                      shadowColor: planColor.withOpacity(0.5),
                    ),
                    child: const Text(
                      "CHOISIR CETTE OFFRE",
                      style: TextStyle(
                        fontWeight: FontWeight.w900,
                        letterSpacing: 1.2,
                        fontSize: 14,
                      ),
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
              "Sans engagement. Paiement directement à la salle.",
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