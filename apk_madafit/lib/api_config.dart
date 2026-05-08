import 'package:flutter/foundation.dart';

class ApiConfig {
  static const String _prodUrl = 'https://st-travelnosybe.com/api';
  static const String _devUrl = 'http://10.0.2.2:8000/api'; // Default for Android emulator

  /// The base URL for the API.
  /// Detects automatically if in Debug or Release mode.
  /// Can be overridden during build using:
  /// flutter run --dart-define=API_BASE_URL=https://your-domain.com/api
  static const String baseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: kReleaseMode ? _prodUrl : _devUrl,
  );

  /// Helper to get the full URL for an image.
  static String getFullImageUrl(String? imageUrl) {
    if (imageUrl == null || imageUrl.isEmpty) return '';
    if (imageUrl.startsWith('http')) return imageUrl;

    // Ensure leading slash
    final String path = imageUrl.startsWith('/') ? imageUrl : '/$imageUrl';

    // The domain is the baseUrl without the /api suffix
    final String domain = baseUrl.endsWith('/api') 
        ? baseUrl.substring(0, baseUrl.length - 4) 
        : baseUrl;

    return '$domain$path';
  }
}
