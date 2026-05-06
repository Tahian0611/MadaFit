// ignore: file_names
import 'package:flutter/material.dart';

// --- IMPORTS DES PAGES (Vérifie que les noms de fichiers correspondent exactement) ---
import 'EditProfile.dart';
import 'Password.dart';
import 'AccountStatut.dart';
import 'CA.dart';
import 'CGU.dart';
import 'Confidentiality.dart';

class SettingsPage extends StatefulWidget {
  final String token;
  final Map<String, dynamic>? userData;
  const SettingsPage({super.key, required this.token, this.userData});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        title: const Text("PARAMÈTRES",
            style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
        centerTitle: true,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_ios, color: Colors.white, size: 20),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 20),
        children: [
          const SizedBox(height: 10),

          // --- SECTION COMPTE ---
          _buildSectionTitle("COMPTE"),
          _buildSettingsTile(
            icon: Icons.person_outline,
            title: "Informations personnelles",
            subtitle: "Modifier profil",
            onTap: () {
              if (widget.userData?['id'] != null) {
                _navigateTo(context, EditProfilePage(
                  userId: widget.userData!['id'],
                  token: widget.token,
                ));
              }
            },
          ),
          _buildSettingsTile(
            icon: Icons.lock_reset_outlined,
            title: "Mot de passe",
            subtitle: "Sécurité du compte",
            onTap: () {
              if (widget.userData?['id'] != null) {
                _navigateTo(context, PasswordPage(
                  token: widget.token,
                  userId: widget.userData!['id'],
                ));
              }
            },
          ),
          _buildSettingsTile(
            icon: Icons.verified_user_outlined,
            title: "Statut du compte",
            subtitle: "Vérifié",
            onTap: () {
              if (widget.userData?['id'] != null) {
                _navigateTo(context, AccountStatusPage(
                  token: widget.token,
                  userId: widget.userData!['id'],
                ));
              }
            },
          ),

          const SizedBox(height: 25),

          // --- SECTION SUPPORT & LÉGAL ---
          _buildSectionTitle("SUPPORT & LÉGAL"),
          _buildSettingsTile(
            icon: Icons.help_outline,
            title: "Centre d'aide",
            subtitle: "FAQ & Support",
            onTap: () => _navigateTo(context, const CAPage()),
          ),
          _buildSettingsTile(
            icon: Icons.description_outlined,
            title: "CGU",
            subtitle: "Règles de la salle",
            onTap: () => _navigateTo(context, const CGUPage()),
          ),
          _buildSettingsTile(
            icon: Icons.privacy_tip_outlined,
            title: "Confidentialité",
            subtitle: "Données personnelles",
            onTap: () => _navigateTo(context, const ConfidentialityPage()),
          ),

          const SizedBox(height: 35),

          // --- BOUTON DÉCONNEXION ---
          InkWell(
            onTap: () => _showLogoutDialog(context),
            borderRadius: BorderRadius.circular(15),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 15),
              decoration: BoxDecoration(
                border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(15),
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.logout, color: Colors.redAccent, size: 20),
                  SizedBox(width: 10),
                  Text("DÉCONNEXION",
                      style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, letterSpacing: 1)),
                ],
              ),
            ),
          ),

          const SizedBox(height: 25),
          const Center(
            child: Text("Madafit APK v1.0.2",
                style: TextStyle(color: Colors.white24, fontSize: 11)),
          ),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  // --- LOGIQUE DE NAVIGATION (Zoom + Fade) ---
  void _navigateTo(BuildContext context, Widget page) {
    Navigator.push(
      context,
      PageRouteBuilder(
        pageBuilder: (context, animation, secondaryAnimation) => page,
        transitionsBuilder: (context, animation, secondaryAnimation, child) {
          return ScaleTransition(
            scale: animation.drive(Tween<double>(begin: 0.8, end: 1.0).chain(CurveTween(curve: Curves.easeOutBack))),
            child: FadeTransition(opacity: animation, child: child),
          );
        },
        transitionDuration: const Duration(milliseconds: 300),
      ),
    );
  }

  void _showLogoutDialog(BuildContext context) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A1A),
        title: const Text("Déconnexion", style: TextStyle(color: Colors.white)),
        content: const Text("Voulez-vous vraiment quitter Madafit ?", style: TextStyle(color: Colors.white70)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Annuler", style: TextStyle(color: Colors.grey))),
          TextButton(onPressed: () => Navigator.pop(context), child: const Text("Confirmer", style: TextStyle(color: Colors.redAccent))),
        ],
      ),
    );
  }

  // --- WIDGETS DE DESIGN ---
  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 5, bottom: 10),
      child: Text(title,
          style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
    );
  }

  Widget _buildSettingsTile({required IconData icon, required String title, required String subtitle, required VoidCallback onTap}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: const Color(0xFF151515), borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Icon(icon, color: Colors.white70, size: 22),
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        trailing: const Icon(Icons.chevron_right, color: Colors.white10, size: 18),
        onTap: onTap,
      ),
    );
  }
}