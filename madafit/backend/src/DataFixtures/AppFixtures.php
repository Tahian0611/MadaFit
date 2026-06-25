<?php

namespace App\DataFixtures;

use App\Entity\Product;
use App\Entity\SubscriptionPlan;
use App\Entity\User;
use Doctrine\Bundle\FixturesBundle\Fixture;
use Doctrine\Persistence\ObjectManager;
use Faker\Factory;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class AppFixtures extends Fixture
{
    public function __construct(private readonly UserPasswordHasherInterface $passwordHasher)
    {
    }

    public function load(ObjectManager $manager): void
    {
        $faker = Factory::create('fr_FR');

        $plansData = [
            ['name' => 'Mensuel', 'type' => 'monthly', 'duration' => 1, 'price' => 35000, 'features' => ['Acces salle illimite', 'Vestiaire', 'Wifi'], 'color' => '#3b82f6', 'popular' => false],
            ['name' => 'Trimestriel', 'type' => 'quarterly', 'duration' => 3, 'price' => 90000, 'features' => ['Acces salle illimite', 'Cours collectifs', 'Vestiaire', 'Wifi'], 'color' => '#10b981', 'popular' => true],
            ['name' => 'Annuel', 'type' => 'annual', 'duration' => 12, 'price' => 300000, 'features' => ['Acces illimite', 'Cours collectifs', '1 bilan/mois', 'Vestiaires VIP'], 'color' => '#8b5cf6', 'popular' => false],
            ['name' => 'VIP', 'type' => 'vip', 'duration' => 12, 'price' => 500000, 'features' => ['Acces 24h/7j', 'Coach dedie', 'Programme personnalise'], 'color' => '#f59e0b', 'popular' => false],
            ['name' => 'Coaching Perso', 'type' => 'coaching', 'duration' => 1, 'price' => 120000, 'features' => ['10 seances coach', 'Bilan complet', 'Suivi nutrition'], 'color' => '#ef4444', 'popular' => false],
        ];

        foreach ($plansData as $planData) {
            $plan = new SubscriptionPlan();
            $plan->setName($planData['name'])
                ->setType($planData['type'])
                ->setDuration($planData['duration'])
                ->setPrice($planData['price'])
                ->setFeatures($planData['features'])
                ->setColor($planData['color'])
                ->setPopular($planData['popular']);

            $manager->persist($plan);
        }

        $admin = new User();
        $admin->setEmail('admin@madafit.mg')
            ->setRoles(['ROLE_ADMIN'])
            ->setFirstName('Admin')
            ->setLastName('MadaFit')
            ->setPassword($this->passwordHasher->hashPassword($admin, 'admin123'))
            ->setMemberId('ADMIN-001')
            ->setPhone('0340000000')
            ->setStatus('active')
            ->setSubscription('vip');
        $manager->persist($admin);

        for ($i = 1; $i <= 20; ++$i) {
            $user = new User();
            $user->setEmail($faker->unique()->safeEmail())
                ->setRoles(['ROLE_USER'])
                ->setFirstName($faker->firstName())
                ->setLastName($faker->lastName())
                ->setPassword($this->passwordHasher->hashPassword($user, 'password123'))
                ->setMemberId('MEM-' . str_pad((string) $i, 4, '0', STR_PAD_LEFT))
                ->setPhone($faker->phoneNumber())
                ->setDob(\DateTimeImmutable::createFromMutable($faker->dateTimeBetween('-50 years', '-18 years')))
                ->setGender($faker->randomElement(['M', 'F']))
                ->setAddress($faker->address())
                ->setJoinDate(\DateTimeImmutable::createFromMutable($faker->dateTimeBetween('-1 year', 'now')))
                ->setStartDate(\DateTimeImmutable::createFromMutable($faker->dateTimeBetween('-6 months', 'now')))
                ->setExpiryDate(\DateTimeImmutable::createFromMutable($faker->dateTimeBetween('-2 months', '+6 months')))
                ->setStatus($faker->randomElement(['active', 'expired', 'suspended']))
                ->setSubscription($faker->randomElement(['monthly', 'quarterly', 'annual', 'vip', 'coaching']))
                ->setActivity($faker->randomElement(['musculation', 'cardio', 'danse', 'gym', 'cours_collectif']))
                ->setAccessType($faker->randomElement(['abonnement', 'seance']))
                ->setCardStatus($faker->randomElement(['active', 'inactive', 'lost']))
                ->setVisitCount($faker->numberBetween(0, 100))
                ->setTotalPayments((float) $faker->numberBetween(35000, 500000))
                ->setInGym($faker->boolean(20));

            $manager->persist($user);
        }

        $productsData = [
            ['name' => 'Eau Minerale 1.5L', 'category' => 'Boissons', 'purchasePrice' => 1500, 'salePrice' => 3000, 'initialStock' => 100],
            ['name' => 'Boisson Energisante', 'category' => 'Boissons', 'purchasePrice' => 3000, 'salePrice' => 5000, 'initialStock' => 50],
            ['name' => 'Barre Proteinee', 'category' => 'Snacks', 'purchasePrice' => 4000, 'salePrice' => 8000, 'initialStock' => 30],
            ['name' => 'T-shirt MadaFit', 'category' => 'Vetements', 'purchasePrice' => 15000, 'salePrice' => 30000, 'initialStock' => 20],
            ['name' => 'Serviette MadaFit', 'category' => 'Accessoires', 'purchasePrice' => 10000, 'salePrice' => 20000, 'initialStock' => 40],
        ];

        foreach ($productsData as $productData) {
            $product = new Product();
            $product->setName($productData['name'])
                ->setCategory($productData['category'])
                ->setPurchasePrice($productData['purchasePrice'])
                ->setSalePrice($productData['salePrice'])
                ->setInitialStock($productData['initialStock'])
                ->setCurrentStock($productData['initialStock'])
                ->setRegistrationDate(new \DateTimeImmutable());

            $manager->persist($product);
        }

        $manager->flush();
    }
}
