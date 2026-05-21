<?php

namespace App\Command;

use App\Service\BackupService;
use Symfony\Component\Console\Attribute\AsCommand;
use Symfony\Component\Console\Command\Command;
use Symfony\Component\Console\Input\InputInterface;
use Symfony\Component\Console\Output\OutputInterface;
use Symfony\Component\Console\Style\SymfonyStyle;

#[AsCommand(
    name: 'app:backup:database',
    description: 'Sauvegarde la base de données via mysqldump',
)]
class BackupDatabaseCommand extends Command
{
    private $backupService;

    public function __construct(BackupService $backupService)
    {
        $this->backupService = $backupService;
        parent::__construct();
    }

    protected function execute(InputInterface $input, OutputInterface $output): int
    {
        $io = new SymfonyStyle($input, $output);

        $io->title('Démarrage de la sauvegarde de la base de données');

        try {
            $filename = $this->backupService->generateBackup();
            $io->success('Sauvegarde réussie : ' . $filename);
            return Command::SUCCESS;
        } catch (\Exception $e) {
            $io->error('Erreur lors de la sauvegarde : ' . $e->getMessage());
            return Command::FAILURE;
        }
    }
}
