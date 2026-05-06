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
  const SettingsPage({super.key});

  @override
  State<SettingsPage> createState() => _SettingsPageState();
}

class _SettingsPageState extends State<SettingsPage> {
  // --- VARIABLES D'ÉTAT ---
  bool _notificationsEnabled = true;
  String _currentLanguage = "Français";
  String _currentUnit = "Kilogrammes (kg)";

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
            onTap: () => _navigateTo(context, const EditProfilePage()),
          ),
          _buildSettingsTile(
            icon: Icons.lock_reset_outlined, 
            title: "Mot de passe", 
            subtitle: "Sécurité du compte",
            onTap: () => _navigateTo(context, const PasswordPage()),
          ),
          _buildSettingsTile(
            icon: Icons.verified_user_outlined, 
            title: "Statut du compte", 
            subtitle: "Vérifié",
            onTap: () => _navigateTo(context, const AccountStatusPage()), 
          ),

          const SizedBox(height: 25),

          // --- SECTION PRÉFÉRENCES ---
          _buildSectionTitle("PRÉFÉRENCES"),
          _buildSwitchTile(
            icon: Icons.notifications_none_outlined, 
            title: "Notifications", 
            subtitle: "Alertes et rappels",
            value: _notificationsEnabled,
            onChanged: (val) => setState(() => _notificationsEnabled = val),
          ),
          _buildSettingsTile(
            icon: Icons.monitor_weight_outlined, 
            title: "Unités", 
            subtitle: _currentUnit,
            onTap: () => _showUnitPicker(), 
          ),
          _buildSettingsTile(
            icon: Icons.language_outlined, 
            title: "Langue", 
            subtitle: _currentLanguage,
            onTap: () => _showLanguagePicker(),
          ),

          const SizedBox(height: 25),

          // --- SECTION SUPPORT ---
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

  // --- DIALOGUES (Langue & Unités) ---
  void _showLanguagePicker() {
    showModalBottomSheet(
      backgroundColor: const Color(0xFF151515),
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: ["Français", "Malagasy", "English"].map((lang) => ListTile(
            title: Text(lang, style: const TextStyle(color: Colors.white)),
            trailing: _currentLanguage == lang ? const Icon(Icons.check, color: Colors.redAccent) : null,
            onTap: () {
              setState(() => _currentLanguage = lang);
              Navigator.pop(context);
            },
          )).toList(),
        ),
      ),
    );
  }

  void _showUnitPicker() {
    showModalBottomSheet(
      backgroundColor: const Color(0xFF151515),
      context: context,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: ["Kilogrammes (kg)", "Livres (lbs)"].map((unit) => ListTile(
            title: Text(unit, style: const TextStyle(color: Colors.white)),
            trailing: _currentUnit == unit ? const Icon(Icons.check, color: Colors.redAccent) : null,
            onTap: () {
              setState(() => _currentUnit = unit);
              Navigator.pop(context);
            },
          )).toList(),
        ),
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

  // --- WIDGETS DE DESIGN (Stricts selon ton deuxième code) ---
  Widget _buildSectionTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 5, bottom: 10),
      child: Text(title,
        style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 1.5),
      ),
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

  Widget _buildSwitchTile({required IconData icon, required String title, required String subtitle, required bool value, required ValueChanged<bool> onChanged}) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(color: const Color(0xFF151515), borderRadius: BorderRadius.circular(12)),
      child: ListTile(
        leading: Icon(icon, color: Colors.white70, size: 22),
        title: Text(title, style: const TextStyle(color: Colors.white, fontSize: 14)),
        subtitle: Text(subtitle, style: const TextStyle(color: Colors.white38, fontSize: 11)),
        trailing: Switch(
          value: value,
          activeColor: Colors.redAccent,
          onChanged: onChanged,
        ),
      ),
    );
  }
}