<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260508061928 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE article (id INT AUTO_INCREMENT NOT NULL, title VARCHAR(255) NOT NULL, content LONGTEXT NOT NULL, image_url VARCHAR(500) DEFAULT NULL, category VARCHAR(50) DEFAULT NULL, is_published TINYINT NOT NULL, published_at DATETIME DEFAULT NULL, created_at DATETIME NOT NULL, updated_at DATETIME DEFAULT NULL, author_id INT DEFAULT NULL, INDEX IDX_23A0E66F675F31B (author_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4 ENGINE = InnoDB');
        $this->addSql('ALTER TABLE article ADD CONSTRAINT FK_23A0E66F675F31B FOREIGN KEY (author_id) REFERENCES user (id) ON DELETE SET NULL');
        $this->addSql('ALTER TABLE attendance_record ADD CONSTRAINT FK_311E8495A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE daily_summary_row ADD CONSTRAINT FK_5955925C4584665A FOREIGN KEY (product_id) REFERENCES product (id)');
        $this->addSql('ALTER TABLE notification ADD link VARCHAR(255) DEFAULT NULL, ADD priority VARCHAR(20) NOT NULL, ADD action_text VARCHAR(100) DEFAULT NULL, ADD action_link VARCHAR(255) DEFAULT NULL, ADD read_at DATETIME DEFAULT NULL, DROP member_name, CHANGE `read` is_read TINYINT NOT NULL, CHANGE date created_at DATETIME NOT NULL, CHANGE member_id icon VARCHAR(50) DEFAULT NULL');
        $this->addSql('ALTER TABLE notification ADD CONSTRAINT FK_BF5476CAA76ED395 FOREIGN KEY (user_id) REFERENCES user (id) ON DELETE CASCADE');
        $this->addSql('ALTER TABLE payment_record ADD CONSTRAINT FK_BE0C0407A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE transaction ADD CONSTRAINT FK_723705D14584665A FOREIGN KEY (product_id) REFERENCES product (id)');
        $this->addSql('ALTER TABLE user ADD activities JSON DEFAULT NULL, ADD reset_token VARCHAR(255) DEFAULT NULL');
        $this->addSql('ALTER TABLE visit_record ADD CONSTRAINT FK_A1F47BA4A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE article DROP FOREIGN KEY FK_23A0E66F675F31B');
        $this->addSql('DROP TABLE article');
        $this->addSql('ALTER TABLE attendance_record DROP FOREIGN KEY FK_311E8495A76ED395');
        $this->addSql('ALTER TABLE daily_summary_row DROP FOREIGN KEY FK_5955925C4584665A');
        $this->addSql('ALTER TABLE notification DROP FOREIGN KEY FK_BF5476CAA76ED395');
        $this->addSql('ALTER TABLE notification ADD member_name VARCHAR(200) DEFAULT NULL, DROP link, DROP priority, DROP action_text, DROP action_link, DROP read_at, CHANGE created_at date DATETIME NOT NULL, CHANGE is_read `read` TINYINT NOT NULL, CHANGE icon member_id VARCHAR(50) DEFAULT NULL');
        $this->addSql('ALTER TABLE payment_record DROP FOREIGN KEY FK_BE0C0407A76ED395');
        $this->addSql('ALTER TABLE transaction DROP FOREIGN KEY FK_723705D14584665A');
        $this->addSql('ALTER TABLE user DROP activities, DROP reset_token');
        $this->addSql('ALTER TABLE visit_record DROP FOREIGN KEY FK_A1F47BA4A76ED395');
    }
}
