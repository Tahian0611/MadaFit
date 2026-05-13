<?php

namespace App\Entity;

use Symfony\Component\Security\Core\User\UserInterface;
use App\Entity\User;

interface AuthoredInterface
{
    public function setAuthor(?User $author): static;
    public function getAuthor(): ?User;
}
