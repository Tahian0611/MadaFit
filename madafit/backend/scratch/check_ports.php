<?php
try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3306', 'root', '');
    $stmt = $pdo->query("SHOW DATABASES");
    echo "Databases on 3306:\n";
    while ($db = $stmt->fetchColumn()) {
        echo "- $db\n";
    }
} catch (Exception $e) {
    echo "Error on 3306: " . $e->getMessage() . "\n";
}

try {
    $pdo = new PDO('mysql:host=127.0.0.1;port=3307', 'root', '');
    $stmt = $pdo->query("SHOW DATABASES");
    echo "\nDatabases on 3307:\n";
    while ($db = $stmt->fetchColumn()) {
        echo "- $db\n";
    }
} catch (Exception $e) {
    echo "Error on 3307: " . $e->getMessage() . "\n";
}
