import 'package:flutter/material.dart';

class EditProfilePage extends StatefulWidget {
  const EditProfilePage({super.key});

  @override
  State<EditProfilePage> createState() => _EditProfilePageState();
}

class _EditProfilePageState extends State<EditProfilePage> {
  // --- CONTRÔLEURS ---
  final _nameController = TextEditingController(text: "Utilisateur Madafit");
  final _emailController = TextEditingController(text: "user@madafit.mg");
  final _phoneController = TextEditingController(text: "+261 34 00 000 00");
  // Nouveau contrôleur pour l'adresse
  final _addressController = TextEditingController(text: "Lot IVG Antananarivo, Madagascar");
  
  final _weightController = TextEditingController(text: "75");
  final _heightController = TextEditingController(text: "180");
  
  // --- VARIABLES D'ÉTAT ---
  String _selectedGender = "Homme";
  String _selectedGoal = "Perte de poids";

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
        title: const Text("MODIFIER PROFIL", 
          style: TextStyle(fontWeight: FontWeight.w900, fontSize: 16, letterSpacing: 1.2)),
        centerTitle: true,
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text("OK", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold)),
          )
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 25),
        child: Column(
          children: [
            const SizedBox(height: 20),
            
            // SECTION PHOTO
            _buildPhotoSection(),
            
            const SizedBox(height: 30),

            // --- SECTION 1 : IDENTITÉ & CONTACT ---
            _buildSectionHeader("COORDONNÉES"),
            _buildEditField("NOM COMPLET", _nameController, Icons.person_outline),
            const SizedBox(height: 15),
            _buildEditField("EMAIL", _emailController, Icons.email_outlined),
            const SizedBox(height: 15),
            _buildEditField("TÉLÉPHONE", _phoneController, Icons.phone_android_outlined),
            const SizedBox(height: 15),
            // AJOUT DU CHAMP ADRESSE
            _buildEditField("ADRESSE RÉSIDENTIELLE", _addressController, Icons.location_on_outlined),
            
            const SizedBox(height: 30),

            // --- SECTION 2 : BIOMÉTRIE ---
            _buildSectionHeader("MESURES PHYSIQUES"),
            Row(
              children: [
                Expanded(child: _buildEditField("POIDS (KG)", _weightController, Icons.monitor_weight_outlined, isNumber: true)),
                const SizedBox(width: 15),
                Expanded(child: _buildEditField("TAILLE (CM)", _heightController, Icons.straighten, isNumber: true)),
              ],
            ),
            const SizedBox(height: 15),
            _buildDropdownField("GENRE", ["Homme", "Femme", "Autre"], _selectedGender, (val) => setState(() => _selectedGender = val!)),

            const SizedBox(height: 30),

            // --- SECTION 3 : OBJECTIFS ---
            _buildSectionHeader("OBJECTIF FITNESS"),
            _buildDropdownField(
              "MON BUT PRINCIPAL", 
              ["Perte de poids", "Prise de masse", "Endurance", "Remise en forme"], 
              _selectedGoal, 
              (val) => setState(() => _selectedGoal = val!)
            ),
            
            const SizedBox(height: 40),

            // BOUTON SAUVEGARDER
            _buildSaveButton(),
            
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }

  // --- WIDGETS COMPOSANTS ---

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
            backgroundImage: NetworkImage('https://via.placeholder.com/150'),
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
          Text(title, style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.bold, letterSpacing: 1.5)),
          const SizedBox(width: 10),
          const Expanded(child: Divider(color: Colors.white10, thickness: 1)),
        ],
      ),
    );
  }

  Widget _buildEditField(String label, TextEditingController controller, IconData icon, {bool isNumber = false}) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          keyboardType: isNumber ? TextInputType.number : TextInputType.text,
          style: const TextStyle(color: Colors.white, fontSize: 14),
          decoration: InputDecoration(
            filled: true,
            fillColor: const Color(0xFF151515),
            prefixIcon: Icon(icon, color: Colors.redAccent, size: 18),
            contentPadding: const EdgeInsets.symmetric(vertical: 15, horizontal: 10),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.redAccent, width: 1)),
          ),
        ),
      ],
    );
  }

  Widget _buildDropdownField(String label, List<String> items, String currentValue, ValueChanged<String?> onChanged) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 10, fontWeight: FontWeight.bold)),
        const SizedBox(height: 8),
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(color: const Color(0xFF151515), borderRadius: BorderRadius.circular(12)),
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

  Widget _buildSaveButton() {
    return SizedBox(
      width: double.infinity,
      height: 55,
      child: ElevatedButton(
        onPressed: () => Navigator.pop(context),
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.redAccent,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
        ),
        child: const Text("SAUVEGARDER LES DONNÉES", 
          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, letterSpacing: 1)),
      ),
    );
  }
}