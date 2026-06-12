import 'package:flutter/foundation.dart';

class ApiConfig {
  // 1. URL de Production
  ///static const String _prodUrl = 'https://st-travelnosybe.com/api';

  // 2. URL de Développement (Local)
  // - Utilisez '10.0.2.2' pour l'émulateur Android
  // - Utilisez l'IP de votre machine (ex: '192.168.1.XX') pour un appareil réel
  static const String _localIp = '192.168.1.145'; // À MODIFIER selon votre IP
  static const String _devUrl = 'https://$_localIp:8000/api';

  /// The base URL for the API.
  /// Force l'utilisation de l'URL de production pour l'APK.
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: _devUrl, // Forcer l'URL de production ici
  );

  /// Helper to get the full URL for an image.
  static String getFullImageUrl(String? imageUrl) {
    if (imageUrl == null || imageUrl.isEmpty) return '';
    if (imageUrl.startsWith('http')) return imageUrl;

    // Ensure leading slash
    final String path = imageUrl.startsWith('/') ? imageUrl : '/$imageUrl';

    // The domain is the baseUrl without the /api suffix
    String domain = baseUrl;
    if (domain.endsWith('/api')) {
      domain = domain.substring(0, domain.length - 4);
    } else if (domain.endsWith('/api/')) {
      domain = domain.substring(0, domain.length - 5);
    }

    // Ensure no trailing slash on domain
    if (domain.endsWith('/')) {
      domain = domain.substring(0, domain.length - 1);
    }

    return '$domain$path';
  }
}
