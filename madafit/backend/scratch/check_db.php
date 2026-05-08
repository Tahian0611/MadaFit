<?php
require_once __DIR__ . '/../vendor/autoload.php';

use App\Kernel;
use App\Entity\Article;
use App\Entity\SubscriptionPlan;
use Symfony\Component\Dotenv\Dotenv;

$dotenv = new Dotenv();
$dotenv->load(__DIR__ . '/../.env');

$kernel = new Kernel($_SERVER['APP_ENV'] ?? 'prod', (bool) ($_SERVER['APP_DEBUG'] ?? false));
$kernel->boot();
$container = $kernel->getContainer();
$em = $container->get('doctrine')->getManager();

$articles = $em->getRepository(Article::class)->count([]);
$plans = $em->getRepository(SubscriptionPlan::class)->count([]);
$users = $em->getRepository(App\Entity\User::class)->count([]);

echo "Articles: $articles\n";
echo "Plans: $plans\n";
echo "Users: $users\n";
