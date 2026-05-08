<?php

namespace App\Controller;

use App\Entity\User;
use App\Repository\UserRepository;
use App\Repository\SubscriptionPlanRepository;
use Doctrine\ORM\EntityManagerInterface;
use Lexik\Bundle\JWTAuthenticationBundle\Services\JWTTokenManagerInterface;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\Mailer\MailerInterface;
use Symfony\Component\Mime\Email;
use Symfony\Component\Routing\Attribute\Route;
use Symfony\Component\PasswordHasher\Hasher\UserPasswordHasherInterface;

class SecurityController extends AbstractController
{
    public function __construct(
        private JWTTokenManagerInterface $jwtManager
    ) {}

    #[Route(path: '/api/login', name: 'app_login', methods: ['POST'])]
    public function login(
        Request $request,
        UserRepository $userRepository,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager
    ): Response {
        $data = json_decode($request->getContent(), true);

        if ($data && isset($data['email'], $data['password'])) {
            $user = $userRepository->findOneBy(['email' => $data['email']]);

            if (!$user) {
                return $this->json([
                    'error' => 'Aucun compte trouvé avec cet email.',
                    'code'  => 'USER_NOT_FOUND',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $currentPassword = $user->getPassword();
            $isFirstLogin = empty($currentPassword);

            if ($isFirstLogin) {
                $user->setPassword(
                    $passwordHasher->hashPassword($user, $data['password'])
                );
                $entityManager->flush();

                $token = $this->jwtManager->create($user);
                return $this->json(array_merge(
                    $this->formatUserResponse($user, true),
                    ['token' => $token]
                ));
            }

            if (!$passwordHasher->isPasswordValid($user, $data['password'])) {
                return $this->json([
                    'error' => 'Mot de passe incorrect.',
                    'code'  => 'INVALID_PASSWORD',
                ], Response::HTTP_UNAUTHORIZED);
            }

            $token = $this->jwtManager->create($user);
            return $this->json(array_merge(
                $this->formatUserResponse($user, false),
                ['token' => $token]
            ));
        }

        throw new \LogicException('Intercepté par le firewall.');
    }

    #[Route('/api/register', name: 'api_register', methods: ['POST'])]
    public function register(
        Request $request,
        UserPasswordHasherInterface $passwordHasher,
        EntityManagerInterface $entityManager,
        UserRepository $userRepository
    ): Response {
        $data = json_decode($request->getContent(), true);

        if (!isset($data['email'], $data['password'])) {
            return $this->json(['error' => 'Email et mot de passe requis.'], Response::HTTP_BAD_REQUEST);
        }

        if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
            return $this->json(['error' => 'Format d\'email invalide.'], Response::HTTP_BAD_REQUEST);
        }

        if ($userRepository->findOneBy(['email' => $data['email']])) {
            return $this->json([
                'error' => 'Cet email est déjà utilisé.',
                'code'  => 'EMAIL_EXISTS',
            ], Response::HTTP_CONFLICT);
        }

        $user = new User();
        $user->setEmail($data['email']);
        $user->setFirstName($data['firstName'] ?? 'Prénom');
        $user->setLastName($data['lastName'] ?? 'Nom');
        $user->setPhone($data['phone'] ?? null);

        $now = new \DateTimeImmutable();
        $user->setDob(isset($data['dob']) ? new \DateTimeImmutable($data['dob']) : null);
        $user->setJoinDate($now);
        $user->setStartDate($now);

        $accessType = $data['accessType'] ?? 'abonnement';
        $user->setAccessType($accessType);

        if ($accessType === 'seance') {
            $user->setExpiryDate($now->modify('+24 hours'));
        } else {
            $user->setExpiryDate($now->modify('+1 month'));
        }

        $user->setActivity($data['activity'] ?? 'musculation');
        $user->setTotalPayments((int) ($data['totalPayments'] ?? 0));

        $user->setSubscription($data['subscriptionType'] ?? ($accessType === 'seance' ? 'session' : 'monthly'));

        $user->setMemberId('MF-' . substr((string) time(), -6));
        $user->setRfidCard('RF' . substr((string) time(), -6));
        $user->setStatus('active');
        $user->setRoles(['ROLE_USER']);
        $user->setPassword($passwordHasher->hashPassword($user, $data['password']));

        try {
            $entityManager->persist($user);
            $entityManager->flush();

            return $this->json([
                'message'  => 'Compte créé avec succès.',
                'id'       => $user->getId(),
                'memberId' => $user->getMemberId(),
            ], Response::HTTP_CREATED);
        } catch (\Exception $e) {
            return $this->json(['error' => 'Erreur serveur : ' . $e->getMessage()], 500);
        }
    }

    private function formatUserResponse(User $user, bool $firstLogin): array
    {
        return [
            'id'           => $user->getId(),
            'email'        => $user->getEmail(),
            'firstName'    => $user->getFirstName(),
            'lastName'     => $user->getLastName(),
            'memberId'     => $user->getMemberId(),
            'rfidCard'     => $user->getRfidCard(),
            'status'       => $user->getStatus(),
            'phone'        => $user->getPhone(),
            'activity'     => $user->getActivity(),
            'accessType'   => $user->getAccessType(),
            'startDate'    => $user->getStartDate()?->format('Y-m-d'),
            'expiryDate'   => $user->getExpiryDate()?->format('Y-m-d'),
            'subscription' => $user->getSubscription(),
            'firstLogin'   => $firstLogin,
            'message'      => $firstLogin ? 'Bienvenue ! Votre mot de passe a bien été enregistré.' : null,
            'roles'        => $user->getRoles(),
        ];
    }

    #[Route('/api/forgot-password', name: 'api_forgot_password', methods: ['POST'])]
    public function forgotPassword(
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $entityManager,
        MailerInterface $mailer
    ): Response {
        $data  = json_decode($request->getContent(), true);
        $email = $data['email'] ?? $request->request->get('email');

        if (!$email) {
            return $this->json(['error' => 'Email manquant'], Response::HTTP_BAD_REQUEST);
        }

        $user = $userRepository->findOneBy(['email' => $email]);

        if ($user) {
            $token = bin2hex(random_bytes(32));
            $user->setResetToken($token);
            $entityManager->flush();

            $resetLink = "https://www.st-travelnosybe.com/api/reset-password/$token";

            $emailMessage = (new Email())
                ->from('support@madafit.mg')
                ->to($user->getEmail())
                ->subject('Réinitialisation de mot de passe - MadaFit')
                ->html("
                    <div style='font-family: sans-serif; line-height: 1.5;'>
                        <h3>Bonjour {$user->getFirstName()},</h3>
                        <p>Vous avez demandé à réinitialiser votre mot de passe <strong>MadaFit</strong>.</p>
                        <p><a href='$resetLink' style='display:inline-block;background:#e74c3c;color:white;padding:10px 20px;text-decoration:none;border-radius:5px;'>Changer mon mot de passe</a></p>
                    </div>
                ");

            try {
                $mailer->send($emailMessage);
            } catch (\Exception $e) {
                return $this->json(['error' => 'Erreur envoi email'], 500);
            }
        }

        return $this->json(['status' => 'success', 'message' => 'Si ce compte existe, un email a été envoyé.']);
    }

    #[Route('/api/reset-password/{token}', name: 'api_reset_password', methods: ['GET', 'POST'])]
    public function resetPassword(
        string $token,
        Request $request,
        UserRepository $userRepository,
        EntityManagerInterface $entityManager,
        UserPasswordHasherInterface $passwordHasher
    ): Response {
        $user = $userRepository->findOneBy(['resetToken' => $token]);

        if (!$user) {
            return new Response('Lien invalide ou expiré.', Response::HTTP_BAD_REQUEST);
        }

        if ($request->isMethod('POST')) {
            $newPassword = $request->request->get('password');
            if ($newPassword) {
                $user->setPassword($passwordHasher->hashPassword($user, $newPassword));
                $user->setResetToken(null);
                $entityManager->flush();

                return new Response('
                    <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;font-family:sans-serif;background:#f4f7f6;">
                        <div style="text-align:center;padding:40px;background:white;border-radius:20px;box-shadow:0 10px 25px rgba(0,0,0,0.1);max-width:90%;">
                            <h2 style="color:#e74c3c;">✓ Terminé !</h2>
                            <p>Votre mot de passe a été mis à jour.</p>
                            <p>Retournez sur l\'application <strong>MadaFit</strong>.</p>
                        </div>
                    </body>
                ');
            }
        }

        return new Response('
        <!DOCTYPE html><html lang="fr"><head>
            <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                @keyframes fadeInUp { from { opacity:0;transform:translateY(20px); } to { opacity:1;transform:translateY(0); } }
                body { margin:0;font-family:"Segoe UI",sans-serif;background:linear-gradient(135deg,#f5f7fa,#c3cfe2);display:flex;align-items:center;justify-content:center;height:100vh; }
                .card { background:white;padding:40px;border-radius:24px;box-shadow:0 15px 35px rgba(0,0,0,0.1);width:90%;max-width:400px;animation:fadeInUp 0.6s ease-out;text-align:center; }
                input { width:100%;padding:14px;margin-bottom:20px;border:2px solid #eee;border-radius:12px;font-size:16px;box-sizing:border-box; }
                button { width:100%;padding:16px;background:#e74c3c;color:white;border:none;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;transition:0.3s; }
                button:hover { background:#c0392b;transform:translateY(-2px); }
                .logo { font-weight:bold;color:#e74c3c;font-size:28px;margin-bottom:10px;display:block; }
            </style>
        </head><body>
            <div class="card">
                <span class="logo">MadaFit</span>
                <h2>Nouveau mot de passe</h2>
                <p>Compte : <b>' . $user->getEmail() . '</b></p>
                <form method="POST">
                    <input type="password" name="password" placeholder="Mot de passe (min. 6 caractères)" required minlength="6">
                    <button type="submit">Sauvegarder et Continuer</button>
                </form>
            </div>
        </body></html>');
    }

    #[Route('/api/me', name: 'api_me', methods: ['GET'])]
    public function me(): Response
    {
        $user = $this->getUser();

        if (!$user instanceof User) {
            return $this->json(['error' => 'Non authentifié'], Response::HTTP_UNAUTHORIZED);
        }

        return $this->json([
            'id'        => $user->getId(),
            'email'     => $user->getEmail(),
            'firstName' => $user->getFirstName(),
            'lastName'  => $user->getLastName(),
            'roles'     => $user->getRoles(),
            'memberId'  => $user->getMemberId(),
            'status'    => $user->getStatus(),
        ]);
    }

    #[Route(path: '/logout', name: 'app_logout')]
    public function logout(): void {}


    #[Route('/api/check-email', name: 'api_check_email', methods: ['POST'])]
    public function checkEmail(
        Request $request,
        UserRepository $userRepository
    ): Response {
        $data = json_decode($request->getContent(), true);
        $email = $data['email'] ?? null;

        if (!$email) {
            return $this->json(['error' => 'Email manquant'], Response::HTTP_BAD_REQUEST);
        }

        if ($userRepository->findOneBy(['email' => $email])) {
            return $this->json([
                'error' => 'Cet email est déjà utilisé.',
                'code'  => 'EMAIL_EXISTS',
            ], Response::HTTP_CONFLICT); // 409
        }

        return $this->json(['available' => true]);
    }
}
