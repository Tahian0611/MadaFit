<?php

namespace App;

use App\Message\CheckExpiringSubscriptionsMessage;
use Symfony\Component\Scheduler\Attribute\AsSchedule;
use Symfony\Component\Scheduler\RecurringMessage;
use Symfony\Component\Scheduler\Schedule as SymfonySchedule;
use Symfony\Component\Scheduler\ScheduleProviderInterface;
use Symfony\Contracts\Cache\CacheInterface;
use Symfony\Component\Console\Messenger\RunCommandMessage;

#[AsSchedule('default')]
class Schedule implements ScheduleProviderInterface
{
    public function __construct(
        private CacheInterface $cache,
    ) {
    }

    public function getSchedule(): SymfonySchedule
    {
        return (new SymfonySchedule())
            ->stateful($this->cache)
            ->processOnlyLastMissedRun(true)
            ->add(
                RecurringMessage::every('1 day', new CheckExpiringSubscriptionsMessage()),
                RecurringMessage::cron('0 0 1 * *', new RunCommandMessage('app:backup:database'))
            );
    }
}