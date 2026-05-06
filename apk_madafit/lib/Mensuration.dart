import 'package:flutter/material.dart';

class MensurationPage extends StatefulWidget {
  const MensurationPage({super.key});

  @override
  State<MensurationPage> createState() => _MensurationPageState();
}

class _MensurationPageState extends State<MensurationPage> {
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      appBar: AppBar(
        backgroundColor: Colors.black,
        elevation: 0,
        leading: IconButton(icon: const Icon(Icons.arrow_back_ios, color: Colors.white), onPressed: () => Navigator.pop(context)),
        title: const Text("MES MENSURATIONS", style: TextStyle(fontWeight: FontWeight.w900, fontSize: 14)),
        centerTitle: true,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            _buildStatHeader(),
            const SizedBox(height: 30),
            _buildInputRow("Poids", "78.5", "kg"),
            _buildInputRow("Taille", "182", "cm"),
            _buildInputRow("Tour de taille", "84", "cm"),
            _buildInputRow("Tour de bras", "38", "cm"),
            _buildInputRow("Tour de poitrine", "102", "cm"),
            const SizedBox(height: 40),
            ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.redAccent,
                minimumSize: const Size(double.infinity, 55),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(15)),
              ),
              child: const Text("METTRE À JOUR LES DONNÉES", style: TextStyle(fontWeight: FontWeight.bold)),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildStatHeader() {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(color: const Color(0xFF151515), borderRadius: BorderRadius.circular(20)),
      child: Row( // <-- ENLÈVE LE "const" ICI
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: [
          _stat("IMC", "23.4", Colors.green),
          _stat("GRAS", "14%", Colors.orange),
          _stat("MUSCLE", "62%", Colors.redAccent),
        ],
      ),
    );
  }

  static Widget _stat(String label, String value, Color color) {
    return Column(
      children: [
        Text(label, style: const TextStyle(color: Colors.white38, fontSize: 12)),
        Text(value, style: TextStyle(color: color, fontWeight: FontWeight.bold, fontSize: 20)),
      ],
    );
  }

  Widget _buildInputRow(String label, String current, String unit) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 15),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Colors.white, fontSize: 16))),
          SizedBox(
            width: 100,
            child: TextField(
              style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
              textAlign: TextAlign.end,
              decoration: InputDecoration(
                hintText: current,
                hintStyle: const TextStyle(color: Colors.white24),
                suffixText: " $unit",
                suffixStyle: const TextStyle(color: Colors.white38),
                enabledBorder: const UnderlineInputBorder(borderSide: BorderSide(color: Colors.white10)),
              ),
            ),
          ),
        ],
      ),
    );
  }
}