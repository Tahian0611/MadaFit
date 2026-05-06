import 'package:flutter/material.dart';
import 'dart:convert';
import 'EditProfile.dart'; // Add this to use UserApiService

class PasswordPage extends StatefulWidget {
  final String token;      // JWT token from login
  final int userId;        // current user ID

  const PasswordPage({
    super.key,
    required this.token,
    required this.userId,
  });

  @override
  State<PasswordPage> createState() => _PasswordPageState();
}

class _PasswordPageState extends State<PasswordPage> {
  final _oldPasswordController = TextEditingController();
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureOld = true;
  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;

  // --- Password strength indicator ---
  double _strengthValue = 0;
  String _strengthText = "";
  Color _strengthColor = Colors.transparent;


  void _checkPasswordStrength(String value) {
    double strength = 0;
    if (value.isEmpty) {
      strength = 0;
    } else {
      if (value.length >= 6) strength += 0.25;
      if (value.contains(RegExp(r'[A-Z]'))) strength += 0.25;
      if (value.contains(RegExp(r'[0-9]'))) strength += 0.25;
      if (value.contains(RegExp(r'[!@#$%^&*(),.?":{}|<>]'))) strength += 0.25;
    }

    setState(() {
      _strengthValue = strength;
      if (strength <= 0.25) {
        _strengthText = "FAIBLE";
        _strengthColor = Colors.red;
      } else if (strength <= 0.5) {
        _strengthText = "MOYEN";
        _strengthColor = Colors.orange;
      } else if (strength <= 0.75) {
        _strengthText = "FORT";
        _strengthColor = Colors.blueAccent;
      } else {
        _strengthText = "TRÈS FORT";
        _strengthColor = Colors.green;
      }
    });
  }

  Future<void> _changePassword() async {
    // Validate fields
    if (_oldPasswordController.text.isEmpty) {
      _showError("Veuillez entrer votre mot de passe actuel.");
      return;
    }
    if (_newPasswordController.text.length < 6) {
      _showError("Le nouveau mot de passe doit avoir au moins 6 caractères.");
      return;
    }
    if (_newPasswordController.text != _confirmPasswordController.text) {
      _showError("Les mots de passe ne correspondent pas.");
      return;
    }

    setState(() => _isLoading = true);

    try {
      final response = await UserApiService.changePassword(
        token: widget.token,
        currentPassword: _oldPasswordController.text,
        newPassword: _newPasswordController.text,
      );

      if (!mounted) return;

      if (response.statusCode == 200) {
        // Success
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text("✅ Mot de passe modifié avec succès !"),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
        Navigator.pop(context); // return to previous page
      } else {
        // Handle errors from backend
        try {
          final errorData = jsonDecode(response.body);
          final message = errorData['message'] ?? errorData['error'] ?? "Erreur inconnue";
          _showError(message);
        } catch (_) {
          _showError("Erreur ${response.statusCode}: Impossible de changer le mot de passe.");
        }
      }
    } catch (e) {
      _showError("Erreur réseau. Vérifiez votre connexion.");
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showError(String msg) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text(msg), backgroundColor: Colors.redAccent),
    );
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
        title: const Text("SÉCURITÉ",
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 25),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 30),
            const Center(
              child: Icon(Icons.lock_reset_rounded, color: Colors.redAccent, size: 80),
            ),
            const SizedBox(height: 20),
            const Center(
              child: Text("MODIFIER LE MOT DE PASSE",
                  style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 18)),
            ),
            const SizedBox(height: 10),
            const Center(
              child: Text("Assurez-vous d'utiliser un mot de passe robuste.",
                  textAlign: TextAlign.center, style: TextStyle(color: Colors.white38, fontSize: 13)),
            ),
            const SizedBox(height: 40),

            _buildPasswordField(
              label: "ANCIEN MOT DE PASSE",
              controller: _oldPasswordController,
              isObscured: _obscureOld,
              onToggle: () => setState(() => _obscureOld = !_obscureOld),
            ),

            const SizedBox(height: 20),
            const Divider(color: Colors.white10, thickness: 1),
            const SizedBox(height: 20),

            _buildPasswordField(
              label: "NOUVEAU MOT DE PASSE",
              controller: _newPasswordController,
              isObscured: _obscureNew,
              onChanged: _checkPasswordStrength,
              onToggle: () => setState(() => _obscureNew = !_obscureNew),
            ),

            // Strength indicator
            if (_newPasswordController.text.isNotEmpty) ...[
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: LinearProgressIndicator(
                      value: _strengthValue,
                      backgroundColor: Colors.white10,
                      color: _strengthColor,
                      minHeight: 4,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Text(_strengthText,
                      style: TextStyle(color: _strengthColor, fontSize: 10, fontWeight: FontWeight.bold)),
                ],
              ),
            ],

            const SizedBox(height: 20),

            _buildPasswordField(
              label: "CONFIRMER LE NOUVEAU MOT DE PASSE",
              controller: _confirmPasswordController,
              isObscured: _obscureConfirm,
              onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
            ),

            const SizedBox(height: 50),

            SizedBox(
              width: double.infinity,
              height: 55,
              child: ElevatedButton(
                onPressed: _isLoading ? null : _changePassword,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : const Text("METTRE À JOUR",
                        style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
              ),
            ),
            const SizedBox(height: 30),
          ],
        ),
      ),
    );
  }

  Widget _buildPasswordField({
    required String label,
    required TextEditingController controller,
    required bool isObscured,
    required VoidCallback onToggle,
    ValueChanged<String>? onChanged,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.redAccent, fontSize: 10, fontWeight: FontWeight.bold, letterSpacing: 1.2)),
        const SizedBox(height: 10),
        TextField(
          controller: controller,
          obscureText: isObscured,
          onChanged: onChanged,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF151515),
            prefixIcon: const Icon(Icons.lock_outline, color: Colors.white38, size: 20),
            suffixIcon: IconButton(
              icon: Icon(isObscured ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                  color: Colors.white38, size: 20),
              onPressed: onToggle,
            ),
            contentPadding: const EdgeInsets.symmetric(vertical: 18),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.redAccent, width: 1)),
          ),
        ),
      ],
    );
  }
}