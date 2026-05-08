import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:math';
import 'Accueil.dart';

void main() {
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
        ? HomeScreen(onLogout: _onLogout, token: _userData!['token'] ?? '')
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
  String _regActivity = 'musculation';
  String _regAccessType = 'abonnement';
  String? _regDob;

  // ── PLANS DEPUIS LA BD ───────────────────────────────────────────────────
  List<Map<String, dynamic>> _plans = [];
  Map<String, dynamic>? _selectedPlan;
  bool _plansLoading = false;
  // ─────────────────────────────────────────────────────────────────────────

  final String _baseUrl = 'https://www.st-travelnosybe.com/api';

  final Map<String, String> _activityLabels = {
    'musculation': 'Musculation',
    'cardio': 'Cardio',
    'yoga': 'Yoga',
    'crossfit': 'CrossFit',
    'boxe': 'Boxe',
    'natation': 'Natation',
  };

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

        final members =
            data['hydra:member'] as List<dynamic>? ??
            data['member'] as List<dynamic>? ??
            [];
        print('🟡 members count: ${members.length}');

        setState(() {
          _plans = members
              .map((e) => Map<String, dynamic>.from(e as Map))
              .toList();
          if (_plans.isNotEmpty) _selectedPlan = _plans.first;
          print('🔴 _plans length: ${_plans.length}');
          print('🔴 _selectedPlan: $_selectedPlan');
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
        } catch (_) {
          _showSnackBar("Erreur serveur. Réessayez.");
        }
      }
    } catch (e) {
      _showSnackBar("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  // ── INSCRIPTION ÉTAPE 0 → 1 ───────────────────────────────────────────────
  void _goToStep1() async {
    if (!_registerStep0Key.currentState!.validate()) return;

    // ── VÉRIFICATION EMAIL EXISTANT AVANT PASSAGE ÉTAPE 1 ──
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

      if (!mounted) return;

      if (checkResponse.statusCode == 409) {
        // Email déjà existant → modal + bloque la progression
        _showEmailExistsModal();
        return; // ← Reste bloqué sur l'étape 0
      }
    } catch (e) {
      // En cas d'erreur réseau, on laisse passer (fail-safe)
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
    // ─────────────────────────────────────────────────────────

    _fetchPlans();
    setState(() => _registerStep = 1);
  }

  // ── MODAL EMAIL EXISTE DÉJÀ ───────────────────────────────────────────────
  // Affiché quand l'email est déjà en base (inscription physique préalable)
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
            // Icône
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
            // Titre
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
            // Message
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
            // Bouton Se connecter
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
                  // Pré-remplir l'email de connexion avec celui saisi
                  _emailController.text = _regEmailController.text;
                  // Redirection vers le formulaire de connexion
                  setState(() {
                    _isLogin = true;
                    _registerStep = 0;
                  });
                },
              ),
            ),
            const SizedBox(height: 10),
            // Bouton Annuler (rester sur l'inscription)
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

    if (_regAccessType == 'abonnement' && _selectedPlan == null) {
      _showSnackBar("Veuillez sélectionner une formule d'abonnement.");
      return;
    }

    setState(() => _isLoading = true);

    try {
      final int totalPayments = _regAccessType == 'abonnement'
          ? ((_selectedPlan?['price'] as num?)?.toInt() ?? 0)
          : 0;
      final String subscriptionType = _regAccessType == 'abonnement'
          ? (_selectedPlan?['type'] as String? ?? 'monthly')
          : 'session';

      final response = await http.post(
        Uri.parse('$_baseUrl/register'),
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: jsonEncode({
          'email': _regEmailController.text.trim(),
          'password': _regPasswordController.text,
          'firstName': _regFirstNameController.text.trim(),
          'lastName': _regLastNameController.text.trim(),
          'phone': _regPhoneController.text.trim(),
          'activity': _regActivity,
          'accessType': _regAccessType,
          'dob': _regDob,
          'totalPayments': totalPayments,
          'subscriptionType': subscriptionType,
        }),
      );

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
            // ── Modal dédié au lieu d'un simple snackbar ──
            _showEmailExistsModal();
          } else {
            _showSnackBar(
              errorData['error'] ?? "Erreur lors de l'inscription.",
            );
          }
        } catch (_) {
          _showSnackBar("Erreur serveur.");
        }
      }
    } catch (e) {
      _showSnackBar("Erreur réseau.");
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
              "Entrez votre email pour recevoir un lien de récupération.",
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
                try {
                  await http.post(
                    Uri.parse('$_baseUrl/forgot-password'),
                    headers: {'Content-Type': 'application/json'},
                    body: jsonEncode({'email': email}),
                  );
                } catch (_) {}
                if (!mounted) return;
                Navigator.pop(context);
                _showSnackBar("Si ce compte existe, un email a été envoyé.");
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

                            if (_isLogin) ...[
                              const SizedBox(height: 20),
                              Container(
                                padding: const EdgeInsets.all(14),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.07),
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(
                                    color: Colors.redAccent.withOpacity(0.3),
                                  ),
                                ),
                                child: const Row(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Icon(
                                      Icons.info_outline,
                                      color: Colors.redAccent,
                                      size: 18,
                                    ),
                                    SizedBox(width: 10),
                                    Expanded(
                                      child: Text(
                                        "Déjà inscrit(e) à l'accueil MadaFit ? "
                                        "Entrez simplement votre email et choisissez "
                                        "un mot de passe — votre compte sera activé "
                                        "automatiquement. Pas besoin de vous inscrire à nouveau.",
                                        style: TextStyle(
                                          color: Colors.white70,
                                          fontSize: 12,
                                          height: 1.5,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],

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
                ),
                const SizedBox(height: 15),
                MadafitTextField(
                  label: "Nom",
                  icon: Icons.person_add_alt_1,
                  controller: _regLastNameController,
                ),
                const SizedBox(height: 15),
                MadafitTextField(
                  label: "Email",
                  icon: Icons.email_outlined,
                  controller: _regEmailController,
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
                    onPressed: _goToStep1,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.redAccent,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Text(
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
                  isRequired: false,
                ),
                const SizedBox(height: 15),

                _buildDateField(),
                const SizedBox(height: 15),

                _buildDropdown(
                  label: "Activité",
                  icon: Icons.sports_gymnastics,
                  value: _regActivity,
                  items: _activityLabels,
                  onChanged: (val) => setState(() => _regActivity = val!),
                ),
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
                      if (val == 'seance') _selectedPlan = null;
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
                if (_regAccessType == 'abonnement' && _selectedPlan != null)
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

  // ── SÉLECTEUR DE PLAN (depuis la BD) ─────────────────────────────────────
  Widget _buildPlanSelector() {
    if (_plansLoading) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            SizedBox(
              width: 16,
              height: 16,
              child: CircularProgressIndicator(
                color: Colors.redAccent,
                strokeWidth: 2,
              ),
            ),
            SizedBox(width: 12),
            Text(
              "Chargement des formules...",
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
          ],
        ),
      );
    }

    if (_plans.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: const Row(
          children: [
            Icon(Icons.info_outline, color: Colors.white38, size: 18),
            SizedBox(width: 10),
            Text(
              "Aucune formule disponible.",
              style: TextStyle(color: Colors.white38, fontSize: 14),
            ),
          ],
        ),
      );
    }

    // ── CORRECTION : S'assurer que _selectedPlan vient de _plans ──
    final bool isValidSelection = _plans.any(
      (p) => p['id'] == _selectedPlan?['id'],
    );
    if (!isValidSelection && _plans.isNotEmpty) {
      _selectedPlan = _plans.first;
    }
    // ───────────────────────────────────────────────────────────────

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.05),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
      ),
      child: DropdownButtonFormField<Map<String, dynamic>>(
        value: _selectedPlan,
        dropdownColor: Colors.grey.shade900,
        decoration: const InputDecoration(
          prefixIcon: Icon(
            Icons.workspace_premium,
            color: Colors.redAccent,
            size: 20,
          ),
          labelText: "Formule d'abonnement *",
          labelStyle: TextStyle(color: Colors.white70, fontSize: 15),
          border: InputBorder.none,
        ),
        style: const TextStyle(color: Colors.white),
        items: _plans.map((plan) {
          final price = plan['price'] as num? ?? 0;
          final name = plan['name'] as String? ?? 'Formule';
          return DropdownMenuItem<Map<String, dynamic>>(
            value: plan,
            child: Text(
              '$name — ${_formatPrice(price.toInt())} Ar',
              style: const TextStyle(color: Colors.white, fontSize: 14),
            ),
          );
        }).toList(),
        onChanged: (plan) => setState(() => _selectedPlan = plan),
        validator: (val) => val == null ? "Veuillez choisir une formule" : null,
      ),
    );
  }

  // ── RÉCAPITULATIF DU PLAN ─────────────────────────────────────────────────
  Widget _buildPlanSummary() {
    final price = (_selectedPlan!['price'] as num?)?.toInt() ?? 0;
    final duration = _selectedPlan!['duration'] as int? ?? 1;
    final name = _selectedPlan!['name'] as String? ?? '';

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.redAccent.withOpacity(0.08),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.redAccent.withOpacity(0.25)),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                name,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
              Text(
                '$duration mois',
                style: const TextStyle(color: Colors.white54, fontSize: 12),
              ),
            ],
          ),
          Text(
            '${_formatPrice(price)} Ar',
            style: const TextStyle(
              color: Colors.redAccent,
              fontWeight: FontWeight.w900,
              fontSize: 18,
            ),
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
          setState(() => _regDob = picked.toIso8601String().split('T')[0]);
        }
      },
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
        decoration: BoxDecoration(
          color: Colors.white.withOpacity(0.05),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Row(
          children: [
            const Icon(Icons.cake_outlined, color: Colors.redAccent, size: 20),
            const SizedBox(width: 12),
            Text(
              _regDob ?? "Date de naissance (optionnel)",
              style: TextStyle(
                color: _regDob != null ? Colors.white : Colors.white54,
                fontSize: 15,
              ),
            ),
          ],
        ),
      ),
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

  const MadafitTextField({
    super.key,
    required this.label,
    required this.icon,
    required this.controller,
    this.isPassword = false,
    this.isRequired = true,
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
      ),
      validator: (value) {
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
