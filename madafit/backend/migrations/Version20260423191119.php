<?php

declare(strict_types=1);

namespace DoctrineMigrations;

use Doctrine\DBAL\Schema\Schema;
use Doctrine\Migrations\AbstractMigration;

/**
 * Auto-generated Migration: Please modify to your needs!
 */
final class Version20260423191119 extends AbstractMigration
{
    public function getDescription(): string
    {
        return '';
    }

    public function up(Schema $schema): void
    {
        // this up() migration is auto-generated, please modify it to your needs
        $this->addSql('CREATE TABLE attendance_record (id INT AUTO_INCREMENT NOT NULL, member_id VARCHAR(50) DEFAULT NULL, member_name VARCHAR(200) DEFAULT NULL, rfid_card VARCHAR(100) DEFAULT NULL, check_in TIME DEFAULT NULL, check_out TIME DEFAULT NULL, date DATE NOT NULL, user_id INT DEFAULT NULL, INDEX IDX_311E8495A76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE daily_summary_row (id INT AUTO_INCREMENT NOT NULL, initial_stock INT NOT NULL, total_entries INT NOT NULL, total_sales INT NOT NULL, total_non_sale_exits INT NOT NULL, total_exits INT NOT NULL, final_stock INT NOT NULL, total_cost DOUBLE PRECISION NOT NULL, revenue DOUBLE PRECISION NOT NULL, profit DOUBLE PRECISION NOT NULL, product_id INT DEFAULT NULL, UNIQUE INDEX UNIQ_5955925C4584665A (product_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE notification (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(50) NOT NULL, title VARCHAR(255) NOT NULL, message LONGTEXT NOT NULL, date DATETIME NOT NULL, `read` TINYINT NOT NULL, member_id VARCHAR(50) DEFAULT NULL, member_name VARCHAR(200) DEFAULT NULL, user_id INT DEFAULT NULL, INDEX IDX_BF5476CAA76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE payment (id INT AUTO_INCREMENT NOT NULL, member_id VARCHAR(50) DEFAULT NULL, member_name VARCHAR(200) DEFAULT NULL, amount DOUBLE PRECISION NOT NULL, method VARCHAR(50) NOT NULL, date DATE NOT NULL, subscription VARCHAR(50) DEFAULT NULL, receipt_no VARCHAR(100) DEFAULT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE payment_record (id INT AUTO_INCREMENT NOT NULL, date DATE NOT NULL, amount DOUBLE PRECISION NOT NULL, method VARCHAR(50) NOT NULL, subscription VARCHAR(50) DEFAULT NULL, receipt_no VARCHAR(100) DEFAULT NULL, user_id INT DEFAULT NULL, INDEX IDX_BE0C0407A76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE product (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(200) NOT NULL, category VARCHAR(100) NOT NULL, purchase_price DOUBLE PRECISION NOT NULL, sale_price DOUBLE PRECISION NOT NULL, initial_stock INT NOT NULL, registration_date DATE DEFAULT NULL, current_stock INT NOT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE subscription_plan (id INT AUTO_INCREMENT NOT NULL, name VARCHAR(100) NOT NULL, type VARCHAR(50) NOT NULL, duration INT NOT NULL, price DOUBLE PRECISION NOT NULL, features JSON DEFAULT NULL, color VARCHAR(50) DEFAULT NULL, popular TINYINT DEFAULT NULL, PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE transaction (id INT AUTO_INCREMENT NOT NULL, type VARCHAR(50) NOT NULL, quantity INT NOT NULL, note LONGTEXT DEFAULT NULL, date DATETIME NOT NULL, unit_price DOUBLE PRECISION DEFAULT NULL, product_id INT DEFAULT NULL, INDEX IDX_723705D14584665A (product_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE user (id INT AUTO_INCREMENT NOT NULL, email VARCHAR(180) NOT NULL, roles JSON NOT NULL, password VARCHAR(255) NOT NULL, member_id VARCHAR(50) DEFAULT NULL, rfid_card VARCHAR(100) DEFAULT NULL, photo VARCHAR(255) DEFAULT NULL, first_name VARCHAR(100) NOT NULL, last_name VARCHAR(100) NOT NULL, phone VARCHAR(20) DEFAULT NULL, dob DATE DEFAULT NULL, gender VARCHAR(1) DEFAULT NULL, address LONGTEXT DEFAULT NULL, emergency_contact VARCHAR(100) DEFAULT NULL, emergency_phone VARCHAR(20) DEFAULT NULL, medical_notes LONGTEXT DEFAULT NULL, join_date DATE DEFAULT NULL, subscription VARCHAR(50) DEFAULT NULL, status VARCHAR(20) DEFAULT NULL, expiry_date DATE DEFAULT NULL, start_date DATE DEFAULT NULL, coach VARCHAR(100) DEFAULT NULL, program VARCHAR(100) DEFAULT NULL, total_payments DOUBLE PRECISION DEFAULT NULL, last_visit DATE DEFAULT NULL, visit_count INT DEFAULT NULL, in_gym TINYINT DEFAULT NULL, notes LONGTEXT DEFAULT NULL, activity VARCHAR(50) DEFAULT NULL, access_type VARCHAR(20) DEFAULT NULL, card_status VARCHAR(20) DEFAULT NULL, promotion VARCHAR(50) DEFAULT NULL, UNIQUE INDEX UNIQ_8D93D6497597D3FE (member_id), UNIQUE INDEX UNIQ_8D93D6492E800D6E (rfid_card), UNIQUE INDEX UNIQ_IDENTIFIER_EMAIL (email), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE visit_record (id INT AUTO_INCREMENT NOT NULL, date DATE NOT NULL, check_in TIME DEFAULT NULL, check_out TIME DEFAULT NULL, user_id INT DEFAULT NULL, INDEX IDX_A1F47BA4A76ED395 (user_id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('CREATE TABLE messenger_messages (id BIGINT AUTO_INCREMENT NOT NULL, body LONGTEXT NOT NULL, headers LONGTEXT NOT NULL, queue_name VARCHAR(190) NOT NULL, created_at DATETIME NOT NULL, available_at DATETIME NOT NULL, delivered_at DATETIME DEFAULT NULL, INDEX IDX_75EA56E0FB7336F0E3BD61CE16BA31DBBF396750 (queue_name, available_at, delivered_at, id), PRIMARY KEY (id)) DEFAULT CHARACTER SET utf8mb4');
        $this->addSql('ALTER TABLE attendance_record ADD CONSTRAINT FK_311E8495A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE daily_summary_row ADD CONSTRAINT FK_5955925C4584665A FOREIGN KEY (product_id) REFERENCES product (id)');
        $this->addSql('ALTER TABLE notification ADD CONSTRAINT FK_BF5476CAA76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE payment_record ADD CONSTRAINT FK_BE0C0407A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
        $this->addSql('ALTER TABLE transaction ADD CONSTRAINT FK_723705D14584665A FOREIGN KEY (product_id) REFERENCES product (id)');
        $this->addSql('ALTER TABLE visit_record ADD CONSTRAINT FK_A1F47BA4A76ED395 FOREIGN KEY (user_id) REFERENCES user (id)');
    }

    public function down(Schema $schema): void
    {
        // this down() migration is auto-generated, please modify it to your needs
        $this->addSql('ALTER TABLE attendance_record DROP FOREIGN KEY FK_311E8495A76ED395');
        $this->addSql('ALTER TABLE daily_summary_row DROP FOREIGN KEY FK_5955925C4584665A');
        $this->addSql('ALTER TABLE notification DROP FOREIGN KEY FK_BF5476CAA76ED395');
        $this->addSql('ALTER TABLE payment_record DROP FOREIGN KEY FK_BE0C0407A76ED395');
        $this->addSql('ALTER TABLE transaction DROP FOREIGN KEY FK_723705D14584665A');
        $this->addSql('ALTER TABLE visit_record DROP FOREIGN KEY FK_A1F47BA4A76ED395');
        $this->addSql('DROP TABLE attendance_record');
        $this->addSql('DROP TABLE daily_summary_row');
        $this->addSql('DROP TABLE notification');
        $this->addSql('DROP TABLE payment');
        $this->addSql('DROP TABLE payment_record');
        $this->addSql('DROP TABLE product');
        $this->addSql('DROP TABLE subscription_plan');
        $this->addSql('DROP TABLE transaction');
        $this->addSql('DROP TABLE user');
        $this->addSql('DROP TABLE visit_record');
        $this->addSql('DROP TABLE messenger_messages');
    }
}
