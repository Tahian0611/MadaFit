<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260605171219 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE attendance_record DROP FOREIGN KEY `FK_311E8495A76ED395`');
        $this->addSql('ALTER TABLE attendance_record ADD CONSTRAINT FK_311E8495A76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE payment_record DROP FOREIGN KEY `FK_BE0C0407A76ED395`');
        $this->addSql('ALTER TABLE payment_record ADD CONSTRAINT FK_BE0C0407A76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE visit_record DROP FOREIGN KEY `FK_A1F47BA4A76ED395`');
        $this->addSql('ALTER TABLE visit_record ADD CONSTRAINT FK_A1F47BA4A76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE attendance_record DROP FOREIGN KEY FK_311E8495A76ED395');
        $this->addSql('ALTER TABLE attendance_record ADD CONSTRAINT `FK_311E8495A76ED395` FOREIGN KEY (user_id) REFERENCES user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('ALTER TABLE payment_record DROP FOREIGN KEY FK_BE0C0407A76ED395');
        $this->addSql('ALTER TABLE payment_record ADD CONSTRAINT `FK_BE0C0407A76ED395` FOREIGN KEY (user_id) REFERENCES user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
        $this->addSql('ALTER TABLE visit_record DROP FOREIGN KEY FK_A1F47BA4A76ED395');
        $this->addSql('ALTER TABLE visit_record ADD CONSTRAINT `FK_A1F47BA4A76ED395` FOREIGN KEY (user_id) REFERENCES user (id) ON UPDATE NO ACTION ON DELETE NO ACTION');
    }
}
