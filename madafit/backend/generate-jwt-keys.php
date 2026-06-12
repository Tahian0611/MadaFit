<?php
// Génère les clés JWT en gérant le problème openssl.cnf sur Windows

// Chemins courants où se trouve openssl.cnf sur Windows
$possiblePaths = [
    'C:\\xampp\\apache\\conf\\openssl.cnf',
    'C:\\xampp\\php\\extras\\ssl\\openssl.cnf',
    'C:\\wamp64\\bin\\apache\\apache2.4.51\\conf\\openssl.cnf',
    'C:\\wamp\\bin\\apache\\apache2.4.41\\conf\\openssl.cnf',
    'C:\\php\\extras\\ssl\\openssl.cnf',
    'C:\\Program Files\\OpenSSL-Win64\\bin\\cnf\\openssl.cnf',
    'C:\\Program Files (x86)\\OpenSSL-Win32\\bin\\cnf\\openssl.cnf',
];

// Tente de trouver le fichier openssl.cnf
$opensslCnf = null;
foreach ($possiblePaths as $path) {
    if (file_exists($path)) {
        $opensslCnf = $path;
        break;
    }
}

// Si trouvé, on définit la variable d'environnement pour PHP
if ($opensslCnf) {
    putenv("OPENSSL_CONF={$opensslCnf}");
    echo "✅ Fichier config trouvé : {$opensslCnf}\n";
} else {
    echo "⚠️ Fichier openssl.cnf non trouvé dans les chemins connus.\n";
    echo "👉 Recherche automatique en cours...\n";

    // Recherche rapide dans les dossiers courants
    $dirs = ['C:\\xampp', 'C:\\wamp64', 'C:\\wamp', 'C:\\php'];
    foreach ($dirs as $dir) {
        if (is_dir($dir)) {
            $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir));
            foreach ($iterator as $file) {
                if ($file->getFilename() === 'openssl.cnf') {
                    $opensslCnf = $file->getPathname();
                    putenv("OPENSSL_CONF={$opensslCnf}");
                    echo "✅ Trouvé : {$opensslCnf}\n";
                    break 2;
                }
            }
        }
    }
}

// Configuration des clés
$config = [
    "private_key_type" => OPENSSL_KEYTYPE_RSA,
    "private_key_bits" => 2048,
];

// Si on a un fichier config, on l'utilise
if ($opensslCnf) {
    $config['config'] = $opensslCnf;
}

$keyPair = openssl_pkey_new($config);

if ($keyPair === false) {
    echo "❌ Échec de la génération.\n";
    echo "Erreur OpenSSL : " . openssl_error_string() . "\n";
    exit(1);
}

openssl_pkey_export($keyPair, $privateKey, null, $config);
$publicKey = openssl_pkey_get_details($keyPair)['key'];

// Écriture
mkdir('config/jwt', 0777, true);
file_put_contents('config/jwt/private.pem', $privateKey);
file_put_contents('config/jwt/public.pem', $publicKey);

echo "✅ Clés 2048 bits générées avec succès !\n";
echo "   - config/jwt/private.pem\n";
echo "   - config/jwt/public.pem\n";
