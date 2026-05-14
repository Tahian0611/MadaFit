<?php

namespace App\Controller;

use App\Repository\PromoCodeRepository;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\HttpKernel\Attribute\AsController;

#[AsController]
class ValidatePromoCodeController extends AbstractController
{
    private PromoCodeRepository $promoCodeRepository;

    public function __construct(PromoCodeRepository $promoCodeRepository)
    {
        $this->promoCodeRepository = $promoCodeRepository;
    }

    public function __invoke(Request $request): JsonResponse
    {
        $data = json_decode($request->getContent(), true);
        $code = $data['code'] ?? null;

        if (!$code) {
            return new JsonResponse(['message' => 'Code promo manquant'], 400);
        }

        $promoCode = $this->promoCodeRepository->findOneByCode($code);

        if (!$promoCode) {
            return new JsonResponse(['message' => 'Code promo invalide'], 404);
        }

        if (!$promoCode->isValid()) {
            return new JsonResponse(['message' => 'Code promo expiré ou désactivé'], 400);
        }

        return new JsonResponse([
            'valid' => true,
            'code' => $promoCode->getCode(),
            'discountPercentage' => $promoCode->getDiscountPercentage(),
            'discountAmount' => $promoCode->getDiscountAmount(),
        ]);
    }
}
