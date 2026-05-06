import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'main.dart'; // replace with your actual login file name

// ============================================================
//  USER MODEL (matches Symfony User entity writable fields)
// ============================================================
class UserModel {
  final int id;
  final String? memberId;
  final String email;
  final String firstName;
  final String lastName;
  final String? phone;
  final String? address;
  final String? gender;        // 'M', 'F' or null
  final DateTime? dob;
  final String? emergencyContact;
  final String? emergencyPhone;
  final String? medicalNotes;
  final String? photo;          // optional, not editable in this page
  final List<String> roles;
  final String? subscription;

  UserModel({
    required this.id,
    this.memberId,
    required this.email,
    required this.firstName,
    required this.lastName,
    this.phone,
    this.address,
    this.gender,
    this.dob,
    this.emergencyContact,
    this.emergencyPhone,
    this.medicalNotes,
    this.photo,
    this.roles = const [],
    this.subscription,
  });

  factory UserModel.fromJson(Map<String, dynamic> json) {
    // Convert gender from 'M'/'F' to display string if needed later
    final rawGender = json['gender']?.toString().toUpperCase();
    String? genderCode;
    if (rawGender == 'M') genderCode = 'M';
    else if (rawGender == 'F') genderCode = 'F';
    else genderCode = null;

    DateTime? parseDate(String? dateStr) {
      if (dateStr == null || dateStr.isEmpty) return null;
      return DateTime.tryParse(dateStr);
    }

    return UserModel(
      id: json['id'] ?? 0,
      memberId: json['memberId']?.toString(),
      email: json['email'] ?? '',
      firstName: json['firstName'] ?? '',
      lastName: json['lastName'] ?? '',
      phone: json['phone'],
      address: json['address'],
      gender: genderCode,
      dob: parseDate(json['dob']),
      emergencyContact: json['emergencyContact'],
      emergencyPhone: json['emergencyPhone'],
      medicalNotes: json['medicalNotes'],
      photo: json['photo'],
      roles: (json['roles'] as List?)?.map((e) => e.toString()).toList() ?? [],
      subscription: json['subscription']?.toString(),
    );
  }

  Map<String, dynamic> toJson() => {
        'email': email,
        'firstName': firstName,
        'lastName': lastName,
        'phone': phone,
        'address': address,
        'gender': gender,   // will be 'M', 'F' or null
        'dob': dob?.toIso8601String().split('T').first, // YYYY-MM-DD
        'emergencyContact': emergencyContact,
        'emergencyPhone': emergencyPhone,
        'medicalNotes': medicalNotes,
        // photo is not updated here, but you could add it
      };
}

// ============================================================
//  API SERVICE
// ============================================================
class UserApiService {
  static const String apiBase = 'http://192.168.1.145:8000/api';
  static const String usersUrl = '$apiBase/users';

  static Future<UserModel> fetchUser(int userId, String token) async {
    debugPrint('🔍 Fetch user: $userId');
    try {
      final response = await http.get(
        Uri.parse('$usersUrl/$userId'),
        headers: {
          'Accept': 'application/ld+json',
          'Authorization': 'Bearer $token',
        },
      );
      debugPrint('📥 STATUS: ${response.statusCode}');
      if (response.statusCode == 200) {
        return UserModel.fromJson(jsonDecode(response.body));
      }
      throw Exception('Status ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('💥 EXCEPTION fetchUser: $e');
      rethrow;
    }
  }

  static Future<bool> updateUser(int userId, String token, UserModel user) async {
    final url = '$usersUrl/$userId';
    final body = jsonEncode(user.toJson());
    try {
      final response = await http.patch(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/merge-patch+json',
          'Accept': 'application/ld+json',
          'Authorization': 'Bearer $token',
        },
        body: body,
      );
      debugPrint('📥 STATUS: ${response.statusCode}');
      if (response.statusCode == 200 || response.statusCode == 204) {
        return true;
      }
      throw Exception('Status ${response.statusCode}: ${response.body}');
    } catch (e) {
      debugPrint('💥 EXCEPTION updateUser: $e');
      rethrow;
    }
  }

  static Future<http.Response> changePassword({
    required String token,
    required String currentPassword,
    required String newPassword,
  }) async {
    final response = await http.post(
      Uri.parse('$apiBase/change-password'),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'currentPassword': currentPassword,
        'newPassword': newPassword,
      }),
    );
    return response;
  }
}

// ============================================================
//  EDIT PROFILE PAGE (only fields from Symfony User entity)
// ============================================================
class EditProfilePage extends StatefulWidget {
  final int userId;
  final String token;

  const EditProfilePage({
    super.key,
    required this.userId,
    required this.token,
  });

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  final _firstNameController = TextEditingController();
  final _lastNameController = TextEditingController();
  final _emailController = TextEditingController();
  final _phoneController = TextEditingController();
  final _addressController = TextEditingController();
  final _emergencyContactController = TextEditingController();
  final _emergencyPhoneController = TextEditingController();
  final _medicalNotesController = TextEditingController();

  // Gender selection: stored as 'M' or 'F', displayed as 'Homme'/'Femme'
  String? _selectedGenderCode; // 'M' or 'F' or null
  DateTime? _selectedDob;

  String _originalEmail = '';
  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadUserData();
  }

  Future<void> _loadUserData() async {
    try {
      final user = await UserApiService.fetchUser(widget.userId, widget.token);
      setState(() {
        _originalEmail = user.email;
        _firstNameController.text = user.firstName;
        _lastNameController.text = user.lastName;
        _emailController.text = user.email;
        _phoneController.text = user.phone ?? '';
        _addressController.text = user.address ?? '';
        _emergencyContactController.text = user.emergencyContact ?? '';
        _emergencyPhoneController.text = user.emergencyPhone ?? '';
        _medicalNotesController.text = user.medicalNotes ?? '';
        _selectedGenderCode = user.gender; // 'M' or 'F' or null
        _selectedDob = user.dob;
        _isLoading = false;
      });
    } catch (e) {
      setState(() {
        _errorMessage = 'Impossible de charger le profil.\n$e';
        _isLoading = false;
      });
    }
  }

  Future<void> _saveProfile() async {
    if (_isSaving) return;

    final newEmail = _emailController.text.trim();
    final emailChanged = newEmail != _originalEmail;

    if (emailChanged) {
      final confirmed = await showDialog<bool>(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => AlertDialog(
          backgroundColor: const Color(0xFF1A1A1A),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: const Row(
            children: [
              Icon(Icons.warning_amber_rounded, color: Colors.orangeAccent, size: 28),
              SizedBox(width: 10),
              Text(
                'Attention',
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          content: const Text(
            'Modifier votre email va vous déconnecter immédiatement.\n\n'
            'Vous serez redirigé vers la page de connexion.',
            style: TextStyle(color: Colors.white70, height: 1.5),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Annuler', style: TextStyle(color: Colors.white38)),
            ),
            ElevatedButton(
              onPressed: () => Navigator.pop(ctx, true),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.orangeAccent,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text(
                'Confirmer',
                style: TextStyle(color: Colors.black, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }

    setState(() => _isSaving = true);

    try {
      final updatedUser = UserModel(
        id: widget.userId,
        email: newEmail,
        firstName: _firstNameController.text.trim(),
        lastName: _lastNameController.text.trim(),
        phone: _phoneController.text.trim().isEmpty ? null : _phoneController.text.trim(),
        address: _addressController.text.trim().isEmpty ? null : _addressController.text.trim(),
        gender: _selectedGenderCode,
        dob: _selectedDob,
        emergencyContact: _emergencyContactController.text.trim().isEmpty ? null : _emergencyContactController.text.trim(),
        emergencyPhone: _emergencyPhoneController.text.trim().isEmpty ? null : _emergencyPhoneController.text.trim(),
        medicalNotes: _medicalNotesController.text.trim().isEmpty ? null : _medicalNotesController.text.trim(),
      );

      await UserApiService.updateUser(widget.userId, widget.token, updatedUser);

      if (!mounted) return;

      if (emailChanged) {
        Navigator.pushAndRemoveUntil(
          context,
          MaterialPageRoute(builder: (_) => const AuthWrapper()),
          (route) => false,
        );
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Profil mis à jour avec succès !'),
            backgroundColor: Colors.green,
            duration: Duration(seconds: 2),
          ),
        );
        await Future.delayed(const Duration(seconds: 1));
        if (mounted) Navigator.pop(context, true);
      }
    } catch (e) {
      if (mounted) {
        debugPrint('❌ Erreur lors de la sauvegarde: $e');
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('❌ Erreur: $e'),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 5),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isSaving = false);
    }
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context, // ← now using the state's context directly
      initialDate: _selectedDob ?? DateTime.now().subtract(const Duration(days: 365 * 20)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: ThemeData.dark().copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Colors.redAccent,
              onPrimary: Colors.white,
              surface: Color(0xFF1A1A1A),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null && picked != _selectedDob) {
      setState(() {
        _selectedDob = picked;
      });
    }
  }
  @override
  void dispose() {
    _firstNameController.dispose();
    _lastNameController.dispose();
    _emailController.dispose();
    _phoneController.dispose();
    _addressController.dispose();
    _emergencyContactController.dispose();
    _emergencyPhoneController.dispose();
    _medicalNotesController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.close, color: Colors.white),
          onPressed: () => Navigator.pop(context),
        ),
        title: const Text(
          "MODIFIER PROFIL",
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2),
        ),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: _isSaving ? null : _saveProfile,
            child: const Text("OK",
                style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.redAccent))
          : _errorMessage != null
              ? Center(
                  child: Padding(
                    padding: const EdgeInsets.all(30),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.wifi_off, color: Colors.white38, size: 60),
                        const SizedBox(height: 20),
                        Text(_errorMessage!,
                            textAlign: TextAlign.center,
                            style: const TextStyle(color: Colors.white38)),
                        const SizedBox(height: 20),
                        ElevatedButton(
                          onPressed: () {
                            setState(() {
                              _isLoading = true;
                              _errorMessage = null;
                            });
                            _loadUserData();
                          },
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                          child: const Text("Réessayer"),
                        ),
                      ],
                    ),
                  ),
                )
              : SingleChildScrollView(
                  padding: const EdgeInsets.symmetric(horizontal: 25),
                  child: Column(
                    children: [
                      const SizedBox(height: 20),
                      _buildPhotoSection(),
                      const SizedBox(height: 30),
                      _buildSectionHeader("COORDONNÉES"),
                      Row(
                        children: [
                          Expanded(child: _buildEditField("PRÉNOM", _firstNameController, Icons.person_outline)),
                          const SizedBox(width: 15),
                          Expanded(child: _buildEditField("NOM", _lastNameController, Icons.person_outline)),
                        ],
                      ),
                      const SizedBox(height: 15),
                      _buildEditField("EMAIL", _emailController, Icons.email_outlined),
                      const SizedBox(height: 15),
                      _buildEditField("TÉLÉPHONE", _phoneController, Icons.phone_android_outlined),
                      const SizedBox(height: 15),
                      _buildEditField("ADRESSE", _addressController, Icons.location_on_outlined),
                      const SizedBox(height: 15),
                      _buildDropdownField(
                        "GENRE",
                        ["Homme", "Femme"],
                        _selectedGenderCode == 'M' ? "Homme" : (_selectedGenderCode == 'F' ? "Femme" : "Non spécifié"),
                        (val) {
                          setState(() {
                            if (val == "Homme") _selectedGenderCode = 'M';
                            else if (val == "Femme") _selectedGenderCode = 'F';
                            else _selectedGenderCode = null;
                          });
                        },
                      ),
                      const SizedBox(height: 15),
                      _buildDateField("DATE DE NAISSANCE", _selectedDob, _selectDate),
                      const SizedBox(height: 30),
                      _buildSectionHeader("CONTACT D'URGENCE"),
                      _buildEditField("NOM / LIEN", _emergencyContactController, Icons.contact_emergency),
                      const SizedBox(height: 15),
                      _buildEditField("TÉLÉPHONE URGENCE", _emergencyPhoneController, Icons.phone),
                      const SizedBox(height: 30),
                      _buildSectionHeader("NOTES MÉDICALES"),
                      _buildMultilineField("Allergies, pathologies, etc.", _medicalNotesController),
                      const SizedBox(height: 40),
                      _buildSaveButton(),
                      const SizedBox(height: 40),
                    ],
                  ),
                ),
    );
  }

  Widget _buildPhotoSection() {
    return Stack(
      alignment: Alignment.bottomRight,
      children: [
        Container(
          padding: const EdgeInsets.all(3),
          decoration: const BoxDecoration(color: Colors.redAccent, shape: BoxShape.circle),
          child: const CircleAvatar(
            radius: 55,
            backgroundColor: Color(0xFF151515),
            child: Icon(Icons.person, color: Colors.white24, size: 60),
          ),
        ),
        const CircleAvatar(
          radius: 18,
          backgroundColor: Colors.white,
          child: Icon(Icons.camera_alt, color: Colors.black, size: 18),
        ),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Row(
        children: [
          Text(title,
              style: const TextStyle(
                  color: Colors.redAccent,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  letterSpacing: 1.5)),
          const SizedBox(width: 10),
          const Expanded(child: Divider(color: Colors.white10, thickness: 1)),
        ],
      ),
    );
  }

  Widget _buildEditField(String label, TextEditingController controller, IconData icon) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF151515),
            prefixIcon: Icon(icon, color: Colors.redAccent, size: 18),
            contentPadding: const EdgeInsets.symmetric(vertical: 15, horizontal: 10),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.redAccent, width: 1)),
          ),
        ),
      ],
    );
  }

  Widget _buildMultilineField(String label, TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          maxLines: 3,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF151515),
            contentPadding: const EdgeInsets.symmetric(vertical: 15, horizontal: 10),
            enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: const BorderSide(color: Colors.redAccent, width: 1)),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField(String label, List<String> items, String currentValue,
      ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
              color: const Color(0xFF151515), borderRadius: BorderRadius.circular(12)),
          child: DropdownButtonHideUnderline(
            child: DropdownButton<String>(
              value: currentValue,
              isExpanded: true,
              dropdownColor: const Color(0xFF1A1A1A),
              icon: const Icon(Icons.keyboard_arrow_down, color: Colors.white38),
              style: const TextStyle(color: Colors.white, fontSize: 14),
              items: items.map((e) => DropdownMenuItem(value: e, child: Text(e))).toList(),
              onChanged: onChanged,
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(String label, DateTime? selectedDate, VoidCallback onTap) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label,
            style: const TextStyle(
                color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        InkWell(
          onTap: onTap,
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 15, horizontal: 12),
            decoration: BoxDecoration(
              color: const Color(0xFF151515),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  selectedDate != null
                      ? "${selectedDate.day.toString().padLeft(2, '0')}/${selectedDate.month.toString().padLeft(2, '0')}/${selectedDate.year}"
                      : "Non renseignée",
                  style: TextStyle(
                    color: selectedDate != null ? Colors.white : Colors.white54,
                    fontSize: 14,
                  ),
                ),
                const Icon(Icons.calendar_today, color: Colors.redAccent, size: 18),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      height: 55,
      child: ElevatedButton(
        onPressed: _isSaving ? null : _saveProfile,
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.redAccent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        ),
        child: _isSaving
            ? const SizedBox(
                height: 20,
                width: 20,
                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
              )
            : const Text("SAUVEGARDER LES DONNÉES",
                style: TextStyle(
                    color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1)),
      ),
    );
  }
}