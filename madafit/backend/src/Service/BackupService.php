<?php

namespace App\Service;

use Doctrine\DBAL\Connection;
use Symfony\Component\Process\Process;
use Symfony\Component\Process\Exception\ProcessFailedException;
use Symfony\Component\DependencyInjection\ParameterBag\ParameterBagInterface;
use Symfony\Component\Filesystem\Filesystem;

class BackupService
{
    private $connection;
    private $backupDir;

    public function __construct(Connection $connection, ParameterBagInterface $params)
    {
        $this->connection = $connection;
        $this->backupDir = $params->get('kernel.project_dir') . '/var/backups';
    }

    public function generateBackup(): string
    {
        $fs = new Filesystem();
        if (!$fs->exists($this->backupDir)) {
            $fs->mkdir($this->backupDir);
        }

        $params = $this->connection->getParams();
        
        $dbUser = $params['user'] ?? 'root';
        $dbPass = $params['password'] ?? '';
        $dbHost = $params['host'] ?? '127.0.0.1';
        $dbPort = $params['port'] ?? 3306;
        $dbName = $params['dbname'] ?? 'madafit_dev';

        $timestamp = date('Y-m-d_H-i-s');
        $filename = "backup_{$dbName}_{$timestamp}.sql";
        $filepath = $this->backupDir . '/' . $filename;

        // Construction des arguments de la commande
        $passArg = $dbPass ? "-p" . escapeshellarg($dbPass) : '';
        
        // mysqldump > file.sql
        $command = sprintf(
            'mysqldump -h %s -P %s -u %s %s %s > %s',
            escapeshellarg($dbHost),
            escapeshellarg($dbPort),
            escapeshellarg($dbUser),
            $passArg,
            escapeshellarg($dbName),
            escapeshellarg($filepath)
        );

        $process = Process::fromShellCommandline($command);
        $process->setTimeout(600); // Max 10 minutes
        $process->run();

        if (!$process->isSuccessful()) {
            if ($fs->exists($filepath)) {
                $fs->remove($filepath);
            }
            throw new ProcessFailedException($process);
        }

        return $filename;
    }

    public function listBackups(): array
    {
        $fs = new Filesystem();
        if (!$fs->exists($this->backupDir)) {
            return [];
        }

        $files = scandir($this->backupDir);
        $backups = [];

        foreach ($files as $file) {
            if (pathinfo($file, PATHINFO_EXTENSION) === 'sql') {
                $filepath = $this->backupDir . '/' . $file;
                $backups[] = [
                    'filename' => $file,
                    'size' => filesize($filepath),
                    'date' => date('c', filemtime($filepath)),
                    'timestamp' => filemtime($filepath)
                ];
            }
        }

        // Tri du plus récent au plus ancien
        usort($backups, function($a, $b) {
            return $b['timestamp'] <=> $a['timestamp'];
        });

        return $backups;
    }

    public function getBackupPath(string $filename): ?string
    {
        $filename = basename($filename);
        $filepath = $this->backupDir . '/' . $filename;

        if (file_exists($filepath)) {
            return $filepath;
        }

        return null;
    }

    public function deleteBackup(string $filename): bool
    {
        $filepath = $this->getBackupPath($filename);
        if ($filepath) {
            unlink($filepath);
            return true;
        }
        return false;
    }
}
