<?php
require 'vendor/autoload.php';
use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
$dotenv->load(__DIR__ . '/../.env');

$url = $_ENV['DATABASE_URL'];
$url = str_replace('mysql://', '', $url);
$parts = parse_url('mysql://' . $url);

$dsn = sprintf('mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4', $parts['host'], $parts['port'], ltrim($parts['path'], '/'));
$pdo = new PDO($dsn, $parts['user'], $parts['pass'] ?? '');

$stmt = $pdo->query("SHOW TABLES");
$tables = $stmt->fetchAll(PDO::FETCH_COLUMN);

foreach ($tables as $table) {
    echo "Converting $table to InnoDB...\n";
    try {
        $pdo->exec("ALTER TABLE `$table` ENGINE=InnoDB");
        echo "Done.\n";
    } catch (Exception $e) {
        echo "Error converting $table: " . $e->getMessage() . "\n";
    }
}
echo "All tables processed.\n";
