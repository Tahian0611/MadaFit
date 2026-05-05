<?php

namespace App\MessageHandler;

use App\Message\CheckExpiringSubscriptionsMessage;
use App\Command\CheckExpiringSubscriptionsCommand;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Console\Output\BufferedOutput;
use Symfony\Component\Messenger\Attribute\AsMessageHandler;

#[AsMessageHandler]
class CheckExpiringSubscriptionsHandler
{
    public function __construct(
        private CheckExpiringSubscriptionsCommand $command
    ) {}

    public function __invoke(CheckExpiringSubscriptionsMessage $message): void
    {
        $input = new ArrayInput([]);
        $output = new BufferedOutput();
        
        $this->command->run($input, $output);
    }
}