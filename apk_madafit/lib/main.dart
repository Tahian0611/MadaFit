import 'dart:io';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:math';
import 'Accueil.dart';
import 'api_config.dart';
import 'http_overrides.dart';
import 'ResetPassword.dart';

void main() {
  HttpOverrides.global = MyHttpOverrides();
  runApp(const MadafitApp());
}

class MadafitApp extends StatelessWidget {
  const MadafitApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Madafit',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.redAccent,
          primary: Colors.red.shade900,
          brightness: Brightness.dark,
        ),
      ),
      home: const AuthWrapper(),
    );
  }
}

// ── AUTH WRAPPER ─────────────────────────────────────────────────────────────
class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  bool _isLoggedIn = false;
  Map<String, dynamic>? _userData;

  void _onLoginSuccess(Map<String, dynamic> userData) {
    setState(() {
      _isLoggedIn = true;
      _userData = userData;
    });
  }

  void _onLogout() => setState(() {
    _isLoggedIn = false;
    _userData = null;
  });

  @override
  Widget build(BuildContext context) {
    return _isLoggedIn
        ? HomeScreen(
            onLogout: _onLogout,
            token: _userData!['token'] ?? '',
            userId: _userData!['id'],
          )
        : AuthScreen(onSuccess: _onLoginSuccess);
  }
}

// ── AUTH SCREEN ───────────────────────────────────────────────────────────────
class AuthScreen extends StatefulWidget {
  final Function(Map<String, dynamic>) onSuccess;
  const AuthScreen({super.key, required this.onSuccess});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  bool _isLogin = true;
  bool _isLoading = false;
  int _registerStep = 0;

  final _loginFormKey = GlobalKey<FormState>();
  final _registerStep0Key = GlobalKey<FormState>();
  final _registerStep1Key = GlobalKey<FormState>();

  // Controllers login
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // Controllers inscription étape 0
  final _regEmailController = TextEditingController();
  final _regPasswordController = TextEditingController();
  final _regFirstNameController = TextEditingController();
  final _regLastNameController = TextEditingController();

  // Controllers inscription étape 1
  final _regPhoneController = TextEditingController();
  List<String> _selectedActivities = ['musculation'];
  String _regAccessType = 'abonnement';
  String? _regDob;

  // ── PLANS DEPUIS LA BD ───────────────────────────────────────────────────
  List<Map<String, dynamic>> _plans = [];
  List<Map<String, dynamic>> _selectedPlans = [];
  bool _plansLoading = false;
  // ─────────────────────────────────────────────────────────────────────────

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _regEmailController.dispose();
    _regPasswordController.dispose();
    _regFirstNameController.dispose();
    _regLastNameController.dispose();
    _regPhoneController.dispose();
    super.dispose();
  }

  final String _baseUrl = ApiConfig.baseUrl;

  final Map<String, String> _activityLabels = {
    'musculation': 'Musculation',
    'cardio': 'Cardio',
    'yoga': 'Yoga',
    'crossfit': 'CrossFit',
    'boxe': 'Boxe',
    'natation': 'Natation',
  };

  // ── VALIDATION PRÉNOM ────────────────────────────────────────────────────
  String? _validateFirstName(String? value) {
    if (value == null || value.trim().isEmpty) return "Le prénom est obligatoire.";
    if (value.trim().length < 2) return "Minimum 2 caractères.";
    if (!RegExp(r"^[A-Z][a-zA-ZÀ-ÿ\s'-]*$").hasMatch(value.trim())) {
      return "Le prénom doit commencer par une majuscule (ex: Jean).";
    }
    return null;
  }

  // ── VALIDATION NOM ───────────────────────────────────────────────────────
  String? _validateLastName(String? value) {
    if (value == null || value.trim().isEmpty) return "Le nom est obligatoire.";
    if (value.trim().length < 2) return "Minimum 2 caractères.";
    if (!RegExp(r"^[A-Z][a-zA-ZÀ-ÿ\s'-]*$").hasMatch(value.trim())) {
      return "Le nom doit commencer par une majuscule (ex: Dupont).";
    }
    return null;
  }

  // ── VALIDATION EMAIL ─────────────────────────────────────────────────────
  String? _validateEmail(String? value) {
    if (value == null || value.trim().isEmpty) return "L'email est obligatoire.";
    if (!RegExp(r"^[^\s@]+@[^\s@]+\.[^\s@]+$").hasMatch(value.trim())) {
      return "Format d'email invalide (ex: nom@domaine.com).";
    }
    return null;
  }

  // ── VALIDATION TÉLÉPHONE MADAGASCAR ──────────────────────────────────────
  String? _validatePhone(String? value) {
    if (value == null || value.trim().isEmpty) return "Le téléphone est obligatoire.";
    if (!RegExp(r"^(\+261\s(32|33|34|37|38)\s\d{2}\s\d{3}\s\d{2}|0(32|33|34|37|38)\s\d{2}\s\d{3}\s\d{2})$")
        .hasMatch(value.trim())) {
      return "Format invalide. Ex: +261 34 00 000 00 ou 034 00 000 00 (opérateurs: 032, 033, 034, 037, 038).";
    }
    return null;
  }

  // ── VALIDATION DATE DE NAISSANCE ───────────────────────────────────────
  String? _validateDob(String? value) {
    if (value == null || value.isEmpty) return "La date de naissance est obligatoire.";
    final dob = DateTime.parse(value);
    final now = DateTime.now();
    final age = now.year - dob.year - (now.month < dob.month || (now.month == dob.month && now.day < dob.day) ? 1 : 0);
    if (age < 5) return "Âge minimum : 5 ans.";
    if (age > 100) return "Date de naissance invalide.";
    return null;
  }

  // ── AUTO-FORMATAGE TÉLÉPHONE ────────────────────────────────────────────
  String _formatPhoneInput(String value) {
    String cleaned = "";
    bool hasPlus = false;

    for (int i = 0; i < value.length; i++) {
      final char = value[i];
      if (char == "+" && i == 0 && !hasPlus) {
        hasPlus = true;
        cleaned += char;
      } else if (RegExp(r"\d").hasMatch(char)) {
        cleaned += char;
      }
    }

    final digits = cleaned.replaceAll(RegExp(r"\D"), "");

    if (hasPlus || (digits.length > 3 && digits.startsWith("261"))) {
      final rest = hasPlus ? digits.substring(3) : digits.substring(3);
      if (rest.isEmpty) return hasPlus ? "+261" : digits;
      final op = rest.substring(0, min(2, rest.length));
      final p1 = rest.length > 2 ? rest.substring(2, min(4, rest.length)) : "";
      final p2 = rest.length > 4 ? rest.substring(4, min(7, rest.length)) : "";
      final p3 = rest.length > 7 ? rest.substring(7, min(9, rest.length)) : "";
      String formatted = "+261 $op";
      if (p1.isNotEmpty) formatted += " $p1";
      if (p2.isNotEmpty) formatted += " $p2";
      if (p3.isNotEmpty) formatted += " $p3";
      return formatted.trim();
    }

    final op = digits.substring(0, min(3, digits.length));
    final rest = digits.length > 3 ? digits.substring(3) : "";
    if (op.length < 3) return op;
    final p1 = rest.substring(0, min(2, rest.length));
    final p2 = rest.length > 2 ? rest.substring(2, min(5, rest.length)) : "";
    final p3 = rest.length > 5 ? rest.substring(5, min(7, rest.length)) : "";
    String formatted = op;
    if (p1.isNotEmpty) formatted += " $p1";
    if (p2.isNotEmpty) formatted += " $p2";
    if (p3.isNotEmpty) formatted += " $p3";
    return formatted.trim();
  }

  void _handlePhoneChange(String rawValue) {
    if (rawValue.length < _regPhoneController.text.length) {
      final cleaned = rawValue.replaceAll(RegExp(r"[^\d+]"), "");
      _regPhoneController.text = _formatPhoneInput(cleaned);
    } else {
      _regPhoneController.text = _formatPhoneInput(rawValue);
    }
    _regPhoneController.selection = TextSelection.fromPosition(
      TextPosition(offset: _regPhoneController.text.length),
    );
  }

  // ── FETCH DES PLANS DEPUIS LA BD ─────────────────────────────────────────
  Future<void> _fetchPlans() async {
    setState(() => _plansLoading = true);
    try {
      final uri = Uri.parse('$_baseUrl/subscription_plans');
      print('🔵 URL: $uri');

      final response = await http.get(
        uri,
        headers: {'Accept': 'application/ld+json'},
      );

      print('🟢 Status: ${response.statusCode}');
      print('🟢 Body length: ${response.body.length}');
      print(
        '🟢 Body preview: ${response.body.substring(0, min(200, response.body.length))}',
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        print('🟡 data keys: ${data.keys.toList()}');

        print('🟢 Full API Response: ${response.body}');
        print('🟢 Full API Response (Abonnement): ${response.body}');
        final List<dynamic> members =
            data['member'] ?? data['hydra:member'] ?? [];
        print('🟡 Formules trouvées: ${members.length}');

          setState(() {
            _plans = members
                .map((e) => Map<String, dynamic>.from(e as Map))
                .toList();
            if (_selectedPlans.isEmpty && _plans.isNotEmpty) {
              _selectedPlans = [_plans.first];
            }
            print('🔴 _plans length: ${_plans.length}');
          });
      } else {
        print('❌ HTTP ${response.statusCode}: ${response.body}');
        _showSnackBar("Erreur serveur: ${response.statusCode}");
      }
    } catch (e, stack) {
      print('💥 Exception: $e');
      print('💥 Stack: $stack');
      _showSnackBar("Erreur: $e");
    } finally {
      if (mounted) setState(() => _plansLoading = false);
    }
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── LOGIN ─────────────────────────────────────────────────────────────────
  void _submitLogin() async {
    if (!_loginFormKey.currentState!.validate()) return;
    setState(() => _isLoading = true);

    try {
      final response = await http.post(
        Uri.parse('$_baseUrl/login'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': _emailController.text.trim(),
          'password': _passwordController.text,
        }),
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;

        if (data['firstLogin'] == true) {
          _showSnackBar(
            "✓ Bienvenue ! Votre mot de passe a été enregistré. Bonne séance !",
            isSuccess: true,
          );
        }

        widget.onSuccess(data);
      } else {
        try {
          final errorData = jsonDecode(response.body);
          final code = errorData['code'] ?? '';

          if (code == 'USER_NOT_FOUND') {
            _showSnackBar(
              "Aucun compte avec cet email. Inscrivez-vous d'abord.",
            );
          } else if (code == 'INVALID_PASSWORD') {
            _showSnackBar("Mot de passe incorrect.");
          } else {
            _showSnackBar(errorData['error'] ?? "Erreur d'authentification.");
          }
        } catch (e) {
          _showSnackBar("Erreur de format de réponse (HTML reçu au lieu de JSON ?). Détails: $e");
        }
      }
    } catch (e) {
      print('💥 Network Exception (Login): $e');
      _showSnackBar("Erreur réseau : $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── INSCRIPTION ÉTAPE 0 → 1 ───────────────────────────────────────────────
  void _goToStep1() async {
    if (!_registerStep0Key.currentState!.validate()) return;

    setState(() => _isLoading = true);

    try {
      final checkResponse = await http.post(
        Uri.parse('$_baseUrl/check-email'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({'email': _regEmailController.text.trim()}),
      );

      print('🟢 Check Email Status: ${checkResponse.statusCode}');

      if (!mounted) return;

      if (checkResponse.statusCode == 409) {
        _showEmailExistsModal();
        return;
      }
    } catch (e) {
      // En cas d'erreur réseau, on laisse passer (fail-safe)
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }

    _fetchPlans();
    setState(() => _registerStep = 1);
  }

  // ── MODAL EMAIL EXISTE DÉJÀ ───────────────────────────────────────────────
  void _showEmailExistsModal() {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        contentPadding: const EdgeInsets.fromLTRB(24, 28, 24, 20),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 60,
              height: 60,
              decoration: BoxDecoration(
                color: Colors.redAccent.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.person_search,
                color: Colors.redAccent,
                size: 32,
              ),
            ),
            const SizedBox(height: 18),
            const Text(
              "Compte déjà existant",
              style: TextStyle(
                color: Colors.white,
                fontSize: 18,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 12),
            const Text(
              "Cet email est déjà enregistré dans notre système.\n\n"
              "Si vous avez déjà fait une inscription à l'accueil MadaFit, "
              "vous n'avez pas besoin de vous réinscrire.\n\n"
              "Connectez-vous simplement avec votre email et choisissez "
              "un mot de passe — même si vous n'en avez pas encore, "
              "IL SERA ENREGISTRÉ AUTOMATIQUEMENT.",
              style: TextStyle(
                color: Colors.white70,
                fontSize: 13,
                height: 1.5,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                icon: const Icon(Icons.login, size: 18),
                label: const Text(
                  "SE CONNECTER",
                  style: TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                ),
                onPressed: () {
                  Navigator.pop(context);
                  _emailController.text = _regEmailController.text;
                  setState(() {
                    _isLogin = true;
                    _registerStep = 0;
                  });
                },
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text(
                "Annuler",
                style: TextStyle(color: Colors.white38, fontSize: 13),
              ),
            ),
          ],
        ),
      ),
    );
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── INSCRIPTION SOUMISSION FINALE ─────────────────────────────────────────
  void _submitRegister() async {
    if (!_registerStep1Key.currentState!.validate()) return;

    if (_selectedActivities.isEmpty) {
      _showSnackBar("Veuillez sélectionner au moins une activité.");
      return;
    }

    if (_regAccessType == 'abonnement' && _selectedPlans.isEmpty) {
      _showSnackBar("Veuillez sélectionner au moins une formule d'abonnement.");
      return;
    }

    setState(() => _isLoading = true);

    try {
      final int totalPayments = _regAccessType == 'abonnement'
          ? _selectedPlans.fold(0, (sum, p) => sum + ((p['price'] as num?)?.toInt() ?? 0))
          : 0;

      final String subscriptionName = _regAccessType == 'abonnement'
          ? _selectedPlans.map((p) => p['name'] as String? ?? '').join(', ')
          : 'Séance simple';

      final String subscriptionType = _regAccessType == 'abonnement'
          ? (_selectedPlans.first['type'] as String? ?? 'monthly')
          : 'session';

      final body = {
        'email': _regEmailController.text.trim(),
        'password': _regPasswordController.text,
        'firstName': _regFirstNameController.text.trim(),
        'lastName': _regLastNameController.text.trim(),
        'phone': _regPhoneController.text.trim(),
        'activities': _selectedActivities,
        'activity': _selectedActivities.isNotEmpty ? _selectedActivities.first : '',
        'accessType': _regAccessType,
        'dob': _regDob,
        'subscription': subscriptionName,
        'totalPayments': totalPayments,
        'subscriptionType': subscriptionType,
      };

      final response = await http.post(
        Uri.parse('$_baseUrl/register'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode(body),
      );

      print('🟢 Register Status: ${response.statusCode}');
      print('🟢 Register Body: ${response.body}');

      if (!mounted) return;

      if (response.statusCode == 201) {
        _showSnackBar(
          "Compte créé ! Connectez-vous maintenant.",
          isSuccess: true,
        );
        setState(() {
          _isLogin = true;
          _registerStep = 0;
        });
        _emailController.text = _regEmailController.text;
      } else {
        try {
          final errorData = jsonDecode(response.body);
          final code = errorData['code'] ?? '';

          if (code == 'EMAIL_EXISTS') {
            _showEmailExistsModal();
          } else {
            _showSnackBar(
              errorData['error'] ?? "Erreur lors de l'inscription.",
            );
          }
        } catch (e) {
          _showSnackBar("Erreur de format (HTML reçu ?). Détails: $e");
        }
      }
    } catch (e) {
      print('💥 Network Exception (Register): $e');
      _showSnackBar("Erreur réseau : $e");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── FORGOT PASSWORD ───────────────────────────────────────────────────────
  void _showForgotPasswordDialog() {
    final resetEmailController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: Colors.grey[900],
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: const Text(
          "Réinitialisation",
          style: TextStyle(color: Colors.redAccent),
        ),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              "Entrez votre email pour recevoir un code de vérification.",
              style: TextStyle(color: Colors.white, fontSize: 14),
            ),
            const SizedBox(height: 20),
            MadafitTextField(
              label: "Votre Email",
              icon: Icons.alternate_email,
              controller: resetEmailController,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text(
              "Annuler",
              style: TextStyle(color: Colors.white54),
            ),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              final email = resetEmailController.text.trim();
              if (email.isNotEmpty) {
                Navigator.pop(context);
                _showSnackBar("Si ce compte existe, un code a été envoyé.");
                
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => ResetPasswordPage(email: email),
                  ),
                );

                try {
                  await http.post(
                    Uri.parse('$_baseUrl/forgot-password'),
                    headers: {'Content-Type': 'application/json'},
                    body: jsonEncode({'email': email}),
                  );
                } catch (_) {}
              }
            },
            child: const Text("Envoyer", style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  void _showSnackBar(String msg, {bool isSuccess = false}) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg),
        backgroundColor: isSuccess ? Colors.green.shade700 : null,
      ),
    );
  }

  // ── BUILD ─────────────────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: [Colors.red.shade900, Colors.black],
          ),
        ),
        child: SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return SingleChildScrollView(
                physics: const BouncingScrollPhysics(),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 24.0),
                  child: Center(
                    child: ConstrainedBox(
                      constraints: BoxConstraints(
                        maxWidth: 450,
                        minHeight: constraints.maxHeight,
                      ),
                      child: IntrinsicHeight(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const SizedBox(height: 40),
                            const Icon(
                              Icons.fitness_center,
                              size: 60,
                              color: Colors.white,
                            ),
                            const SizedBox(height: 10),
                            const Text(
                              "MADAFIT",
                              style: TextStyle(
                                fontSize: 25,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 3,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 30),

                            Card(
                              elevation: 12,
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(25),
                              ),
                              color: Colors.black.withOpacity(0.7),
                              child: Padding(
                                padding: const EdgeInsets.all(25.0),
                                child: _isLogin
                                    ? _buildLoginForm()
                                    : _buildRegisterForm(),
                              ),
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
      ),
    );
  }

  // ── FORMULAIRE LOGIN ──────────────────────────────────────────────────────
  Widget _buildLoginForm() {
    return Form(
      key: _loginFormKey,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            "CONNEXION",
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Colors.redAccent,
            ),
          ),
          const SizedBox(height: 25),
          MadafitTextField(
            label: "Email",
            icon: Icons.email_outlined,
            controller: _emailController,
            validator: _validateEmail,
          ),
          const SizedBox(height: 15),
          MadafitTextField(
            label: "Mot de passe",
            icon: Icons.lock_outline,
            isPassword: true,
            controller: _passwordController,
          ),
          const SizedBox(height: 25),
          SizedBox(
            width: double.infinity,
            height: 55,
            child: ElevatedButton(
              onPressed: _isLoading ? null : _submitLogin,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              child: _isLoading
                  ? const CircularProgressIndicator(color: Colors.white)
                  : const Text(
                      "SE CONNECTER",
                      style: TextStyle(fontWeight: FontWeight.bold),
                    ),
            ),
          ),
          const SizedBox(height: 15),
          TextButton(
            onPressed: () => setState(() {
              _isLogin = false;
              _registerStep = 0;
            }),
            child: Text.rich(
              TextSpan(
                text: "Pas de compte ? ",
                style: const TextStyle(color: Colors.white70),
                children: [
                  TextSpan(
                    text: "Inscrivez-vous",
                    style: const TextStyle(
                      color: Color.fromARGB(255, 237, 23, 23),
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
              textAlign: TextAlign.center,
            ),
          ),
          TextButton(
            onPressed: _showForgotPasswordDialog,
            child: const Text(
              "Mot de passe oublié ?",
              style: TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  // ── FORMULAIRE INSCRIPTION (STEPPER) ─────────────────────────────────────
  Widget _buildRegisterForm() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Text(
              "INSCRIPTION",
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: Colors.redAccent,
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: Colors.redAccent.withOpacity(0.15),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: Colors.redAccent.withOpacity(0.4)),
              ),
              child: Text(
                "Étape ${_registerStep + 1}/2",
                style: const TextStyle(
                  color: Colors.redAccent,
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 20),

        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: _registerStep == 0 ? 0.5 : 1.0,
            backgroundColor: Colors.white12,
            valueColor: const AlwaysStoppedAnimation<Color>(Colors.redAccent),
            minHeight: 4,
          ),
        ),
        const SizedBox(height: 20),

        // ── ÉTAPE 0 ───────────────────────────────────────────────────────
        if (_registerStep == 0)
          Form(
            key: _registerStep0Key,
            child: Column(
              children: [
                MadafitTextField(
                  label: "Prénom",
                  icon: Icons.person_outline,
                  controller: _regFirstNameController,
                  validator: _validateFirstName,
                ),
                const SizedBox(height: 15),
                MadafitTextField(
                  label: "Nom",
                  icon: Icons.person_add_alt_1,
                  controller: _regLastNameController,
                  validator: _validateLastName,
                ),
                const SizedBox(height: 15),
                MadafitTextField(
                  label: "Email",
                  icon: Icons.email_outlined,
                  controller: _regEmailController,
                  validator: _validateEmail,
                ),
                const SizedBox(height: 15),
                MadafitTextField(
                  label: "Mot de passe",
                  icon: Icons.lock_outline,
                  isPassword: true,
                  controller: _regPasswordController,
                ),
                const SizedBox(height: 25),
                SizedBox(
                  width: double.infinity,
                  height: 55,
                  child: ElevatedButton(
                    onPressed: _isLoading ? null : _goToStep1,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : const Text(
                            "SUIVANT →",
                            style: TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ),
              ],
            ),
          ),

        // ── ÉTAPE 1 ───────────────────────────────────────────────────────
        if (_registerStep == 1)
          Form(
            key: _registerStep1Key,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                MadafitTextField(
                  label: "Téléphone",
                  icon: Icons.phone_outlined,
                  controller: _regPhoneController,
                  validator: _validatePhone,
                  onChanged: _handlePhoneChange,
                  maxLength: 17,
                ),
                const SizedBox(height: 15),

                _buildDateField(),
                const SizedBox(height: 15),

                _buildActivitySelector(),
                const SizedBox(height: 15),

                _buildDropdown(
                  label: "Type d'accès",
                  icon: Icons.card_membership,
                  value: _regAccessType,
                  items: const {
                    'abonnement': 'Abonnement',
                    'seance': 'Séance simple',
                  },
                  onChanged: (val) {
                    setState(() {
                      _regAccessType = val!;
                      if (val == 'seance') _selectedPlans = [];
                      if (val == 'abonnement' && _selectedPlans.isEmpty && _plans.isNotEmpty) {
                        _selectedPlans = [_plans.first];
                      }
                    });
                  },
                ),
                const SizedBox(height: 15),

                // Sélecteur formule — visible seulement si abonnement
                if (_regAccessType == 'abonnement') ...[
                  _buildPlanSelector(),
                  const SizedBox(height: 15),
                ],

                // Récap plan sélectionné
                if (_regAccessType == 'abonnement' && _selectedPlans.isNotEmpty)
                  _buildPlanSummary(),

                const SizedBox(height: 25),

                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _registerStep = 0),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white70,
                          side: const BorderSide(color: Colors.white24),
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: const Text("← Retour"),
                      ),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      flex: 2,
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submitRegister,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.redAccent,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                height: 20,
                                width: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              )
                            : const Text(
                                "CRÉER MON COMPTE",
                                style: TextStyle(fontWeight: FontWeight.bold),
                              ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

        const SizedBox(height: 15),
        TextButton(
          onPressed: () => setState(() {
            _isLogin = true;
            _registerStep = 0;
          }),
          child: Text.rich(
            TextSpan(
              text: "Déjà membre ? ",
              style: const TextStyle(color: Colors.white70),
              children: [
                TextSpan(
                  text: "Connectez-vous",
                  style: const TextStyle(
                    color: Color.fromARGB(255, 237, 23, 23),
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ],
            ),
            textAlign: TextAlign.center,
          ),
        ),
      ],
    );
  }

  Widget _buildActivitySelector() {
    final Map<String, IconData> activityIcons = {
      'musculation': Icons.fitness_center,
      'cardio': Icons.directions_run,
      'yoga': Icons.self_improvement,
      'crossfit': Icons.sports_gymnastics,
      'boxe': Icons.sports_mma,
      'natation': Icons.pool,
    };

    final String summary = _selectedActivities.isEmpty
        ? 'Aucune activité sélectionnée'
        : _selectedActivities.map((k) => _activityLabels[k] ?? k).join(', ');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _selectedActivities.isEmpty
              ? Colors.redAccent.withOpacity(0.5)
              : Colors.redAccent.withOpacity(0.2),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ExpansionTile(
          leading: const Icon(Icons.sports_gymnastics, color: Colors.redAccent, size: 20),
          title: const Text(
            "Activités pratiquées *",
            style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          subtitle: Text(
            summary,
            style: TextStyle(
              color: _selectedActivities.isEmpty
                  ? Colors.redAccent.withOpacity(0.7)
                  : Colors.white54,
              fontSize: 11,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          iconColor: Colors.redAccent,
          collapsedIconColor: Colors.white38,
          backgroundColor: Colors.transparent,
          collapsedBackgroundColor: Colors.transparent,
          tilePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
          childrenPadding: EdgeInsets.zero,
          children: [
            Divider(color: Colors.white.withOpacity(0.08), height: 1),
            ConstrainedBox(
              constraints: const BoxConstraints(maxHeight: 210),
              child: SingleChildScrollView(
                padding: EdgeInsets.zero,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: activityIcons.entries.toList().asMap().entries.map((entry) {
                    final index = entry.key;
                    final key = entry.value.key;
                    final icon = entry.value.value;
                    final label = _activityLabels[key] ?? key;
                    final isSelected = _selectedActivities.contains(key);

                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (index > 0) Divider(color: Colors.white.withOpacity(0.05), height: 1),
                        CheckboxListTile(
                          contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                          secondary: Icon(icon,
                            color: isSelected ? Colors.redAccent : Colors.white38,
                            size: 20,
                          ),
                          title: Text(
                            label,
                            style: TextStyle(
                              color: isSelected ? Colors.white : Colors.white70,
                              fontSize: 13,
                              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                          value: isSelected,
                          activeColor: Colors.redAccent,
                          checkColor: Colors.white,
                          onChanged: (bool? checked) {
                            setState(() {
                              if (checked == true) {
                                _selectedActivities.add(key);
                              } else {
                                _selectedActivities.remove(key);
                              }
                            });
                          },
                        ),
                      ],
                    );
                  }).toList(),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  // ── SÉLECTEUR DE PLAN (depuis la BD) ──────────────────────────────────────
  Widget _buildPlanSelector() {
    _selectedPlans.removeWhere((selected) => !_plans.any((p) => p['id'] == selected['id']));
    if (_selectedPlans.isEmpty && _plans.isNotEmpty) {
      _selectedPlans = [_plans.first];
    }

    final String summary = _plansLoading
        ? 'Chargement...'
        : _plans.isEmpty
            ? 'Aucune offre disponible'
            : _selectedPlans.isEmpty
                ? 'Aucune offre sélectionnée'
                : _selectedPlans.map((p) => p['name'] as String? ?? '').join(', ');

    return Container(
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _selectedPlans.isEmpty
              ? Colors.redAccent.withOpacity(0.5)
              : Colors.redAccent.withOpacity(0.2),
        ),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(12),
        child: ExpansionTile(
          leading: const Icon(Icons.workspace_premium, color: Colors.redAccent, size: 20),
          title: const Text(
            "Formules d'abonnement *",
            style: TextStyle(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.bold),
          ),
          subtitle: Text(
            summary,
            style: TextStyle(
              color: _selectedPlans.isEmpty
                  ? Colors.redAccent.withOpacity(0.7)
                  : Colors.white54,
              fontSize: 11,
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
          trailing: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (_plansLoading)
                const SizedBox(
                  width: 14,
                  height: 14,
                  child: CircularProgressIndicator(color: Colors.redAccent, strokeWidth: 2),
                )
              else
                GestureDetector(
                  onTap: _fetchPlans,
                  child: const Icon(Icons.refresh, color: Colors.redAccent, size: 18),
                ),
              const SizedBox(width: 4),
              const Icon(Icons.expand_more, color: Colors.white38, size: 20),
            ],
          ),
          iconColor: Colors.transparent,
          collapsedIconColor: Colors.transparent,
          backgroundColor: Colors.transparent,
          collapsedBackgroundColor: Colors.transparent,
          tilePadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
          childrenPadding: EdgeInsets.zero,
          children: [
            Divider(color: Colors.white.withOpacity(0.08), height: 1),
            if (_plans.isEmpty && !_plansLoading)
              Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.info_outline, color: Colors.white38, size: 18),
                    const SizedBox(width: 10),
                    const Expanded(
                      child: Text(
                        "Aucune formule disponible.",
                        style: TextStyle(color: Colors.white38, fontSize: 13),
                      ),
                    ),
                    TextButton(
                      onPressed: _fetchPlans,
                      child: const Text("Réessayer", style: TextStyle(color: Colors.redAccent, fontSize: 12)),
                    ),
                  ],
                ),
              )
            else
              ConstrainedBox(
                constraints: const BoxConstraints(maxHeight: 210),
                child: SingleChildScrollView(
                  padding: EdgeInsets.zero,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: _plans.asMap().entries.map((entry) {
                      final index = entry.key;
                      final plan = entry.value;
                      final isSelected = _selectedPlans.any((p) => p['id'] == plan['id']);
                      final price = plan['price'] as num? ?? 0;
                      final name = plan['name'] as String? ?? 'Formule';

                      return Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          if (index > 0) Divider(color: Colors.white.withOpacity(0.05), height: 1),
                          CheckboxListTile(
                            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 0),
                            secondary: Icon(
                              Icons.workspace_premium,
                              color: isSelected ? Colors.redAccent : Colors.white24,
                              size: 18,
                            ),
                            title: Text(
                              name,
                              style: TextStyle(
                                color: isSelected ? Colors.white : Colors.white70,
                                fontSize: 13,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                            subtitle: Text(
                              '${_formatPrice(price.toInt())} Ar',
                              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
                            ),
                            value: isSelected,
                            activeColor: Colors.redAccent,
                            checkColor: Colors.white,
                            onChanged: (bool? checked) {
                              setState(() {
                                if (checked == true) {
                                  _selectedPlans.add(plan);
                                } else {
                                  _selectedPlans.removeWhere((p) => p['id'] == plan['id']);
                                }
                              });
                            },
                          ),
                        ],
                      );
                    }).toList(),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  // ── RÉCAPITULATIF DU PLAN ─────────────────────────────────────────────────
  Widget _buildPlanSummary() {
    final originalPrice = _selectedPlans.fold(0, (sum, p) => sum + ((p['price'] as num?)?.toInt() ?? 0));

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.redAccent.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.redAccent.withOpacity(0.3), width: 1.5),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.shopping_cart_checkout, color: Colors.redAccent, size: 18),
              const SizedBox(width: 8),
              const Text(
                "RÉCAPITULATIF",
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w900, fontSize: 12, letterSpacing: 1),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ..._selectedPlans.map((p) => Padding(
            padding: const EdgeInsets.only(bottom: 6),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(p['name'] ?? '', style: const TextStyle(color: Colors.white70, fontSize: 13)),
                Text('${_formatPrice((p['price'] as num?)?.toInt() ?? 0)} Ar', style: const TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.bold)),
              ],
            ),
          )),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 8),
            child: Divider(color: Colors.white10),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text("TOTAL À PAYER", style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
              Text(
                '${_formatPrice(originalPrice)} Ar',
                style: const TextStyle(
                  color: Colors.redAccent,
                  fontWeight: FontWeight.w900,
                  fontSize: 22,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── FORMAT PRIX ───────────────────────────────────────────────────────────
  String _formatPrice(int price) {
    final str = price.toString();
    final buffer = StringBuffer();
    for (var i = 0; i < str.length; i++) {
      if (i > 0 && (str.length - i) % 3 == 0) buffer.write(' ');
      buffer.write(str[i]);
    }
    return buffer.toString();
  }

  // ── DATE PICKER ───────────────────────────────────────────────────────────
  Widget _buildDateField() {
    return FormField<String>(
      validator: _validateDob,
      builder: (field) {
        return GestureDetector(
          onTap: () async {
            final picked = await showDatePicker(
              context: context,
              initialDate: DateTime(2000),
              firstDate: DateTime(1920),
              lastDate: DateTime.now(),
              builder: (context, child) => Theme(
                data: Theme.of(context).copyWith(
                  colorScheme: ColorScheme.dark(
                    primary: Colors.redAccent,
                    surface: Colors.grey.shade900,
                  ),
                ),
                child: child!,
              ),
            );
            if (picked != null) {
              final dateStr = picked.toIso8601String().split('T')[0];
              setState(() => _regDob = dateStr);
              field.didChange(dateStr);
            }
          },
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
            decoration: BoxDecoration(
              color: Colors.white.withOpacity(0.05),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(
                color: field.hasError
                    ? Colors.redAccent.withOpacity(0.5)
                    : Colors.transparent,
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.cake_outlined, color: Colors.redAccent, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    _regDob ?? "Date de naissance *",
                    style: TextStyle(
                      color: _regDob != null ? Colors.white : Colors.white54,
                      fontSize: 15,
                    ),
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  // ── DROPDOWN ─────────────────────────────────────────────────────────────
  Widget _buildDropdown({
    required String label,
    required IconData icon,
    required String value,
    required Map<String, String> items,
    required ValueChanged<String?> onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
      ),
      child: DropdownButtonFormField<String>(
        value: value,
        dropdownColor: Colors.grey.shade900,
        decoration: InputDecoration(
          prefixIcon: Icon(icon, color: Colors.redAccent, size: 20),
          labelText: label,
          labelStyle: const TextStyle(color: Colors.white70, fontSize: 15),
          border: InputBorder.none,
        ),
        style: const TextStyle(color: Colors.white),
        items: items.entries
            .map((e) => DropdownMenuItem(value: e.key, child: Text(e.value)))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }
}

// ── CHAMP TEXTE RÉUTILISABLE ─────────────────────────────────────────────────
class MadafitTextField extends StatefulWidget {
  final String label;
  final IconData icon;
  final bool isPassword;
  final bool isRequired;
  final TextEditingController controller;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;
  final int? maxLength;

  const MadafitTextField({
    super.key,
    required this.label,
    required this.icon,
    required this.controller,
    this.isPassword = false,
    this.isRequired = true,
    this.validator,
    this.onChanged,
    this.maxLength,
  });

  @override
  State<MadafitTextField> createState() => _MadafitTextFieldState();
}

class _MadafitTextFieldState extends State<MadafitTextField> {
  bool _obscureText = true;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: widget.controller,
      obscureText: widget.isPassword ? _obscureText : false,
      style: const TextStyle(color: Colors.white),
      onChanged: widget.onChanged,
      maxLength: widget.maxLength,
      decoration: InputDecoration(
        labelText: widget.label,
        labelStyle: const TextStyle(color: Colors.white70, fontSize: 15),
        prefixIcon: Icon(widget.icon, color: Colors.redAccent, size: 20),
        suffixIcon: widget.isPassword
            ? IconButton(
                icon: Icon(
                  _obscureText ? Icons.visibility_off : Icons.visibility,
                  color: Colors.white54,
                  size: 20,
                ),
                onPressed: () => setState(() => _obscureText = !_obscureText),
              )
            : null,
        filled: true,
        fillColor: Colors.white.withOpacity(0.05),
        contentPadding: const EdgeInsets.symmetric(
          vertical: 16,
          horizontal: 12,
        ),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        errorStyle: const TextStyle(color: Colors.redAccent, fontSize: 12),
        counterText: widget.maxLength != null ? '' : null,
      ),
      validator: widget.validator ?? (value) {
        if (!widget.isRequired) return null;
        if (value == null || value.isEmpty) return "Champ obligatoire";
        if (widget.label.toLowerCase().contains("email")) {
          final bool emailValid = RegExp(
            r"^[a-zA-Z0-9.]+@[a-zA-Z0-9]+\.[a-zA-Z]+",
          ).hasMatch(value);
          if (!emailValid) return "Format d'email invalide";
        }
        if (widget.isPassword && value.length < 6)
          return "Minimum 6 caractères";
        return null;
      },
    );
  }
}