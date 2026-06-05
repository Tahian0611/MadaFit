<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

final class Version20260605010000 extends AbstractMigration
{
    public function getDescription(): string
    {
        return 'Ajoute la caisse aux paiements et mouvements.';
    }

    public function up(Schema $schema): void
    {
        $this->addSql("ALTER TABLE payment ADD cash_register VARCHAR(20) NOT NULL DEFAULT 'caisse2'");
        $this->addSql("ALTER TABLE transaction ADD cash_register VARCHAR(20) NOT NULL DEFAULT 'caisse2'");
    }

    public function down(Schema $schema): void
    {
        $this->addSql('ALTER TABLE payment DROP cash_register');
        $this->addSql('ALTER TABLE transaction DROP cash_register');
    }
}
