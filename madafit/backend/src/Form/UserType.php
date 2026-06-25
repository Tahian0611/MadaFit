<?php

namespace App\Form;

use App\Entity\User;
use Symfony\Component\Form\AbstractType;
use Symfony\Component\Form\FormBuilderInterface;
use Symfony\Component\OptionsResolver\OptionsResolver;

class UserType extends AbstractType
{
    public function buildForm(FormBuilderInterface $builder, array $options): void
    {
        $builder
            ->add('email')
            ->add('roles')
            ->add('password')
            ->add('memberId')
            ->add('rfidCard')
            ->add('photo')
            ->add('firstName')
            ->add('lastName')
            ->add('phone')
            ->add('dob', null, [
                'widget' => 'single_text'
            ])
            ->add('gender')
            ->add('address')
            ->add('emergencyContact')
            ->add('emergencyPhone')
            ->add('medicalNotes')
            ->add('joinDate', null, [
                'widget' => 'single_text'
            ])
            ->add('subscription')
            ->add('status')
            ->add('expiryDate', null, [
                'widget' => 'single_text'
            ])
            ->add('startDate', null, [
                'widget' => 'single_text'
            ])
            ->add('coach')
            ->add('program')
            ->add('totalPayments')
            ->add('lastVisit', null, [
                'widget' => 'single_text'
            ])
            ->add('visitCount')
            ->add('inGym')
            ->add('notes')
            ->add('activity')
            ->add('accessType')
            ->add('cardStatus')
            ->add('promotion')
        ;
    }

    public function configureOptions(OptionsResolver $resolver): void
    {
        $resolver->setDefaults([
            'data_class' => User::class,
        ]);
    }
}
