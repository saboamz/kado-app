'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/lib/profile-actions';
import { Field, TextareaField } from './Field';
import { ImageUpload } from './ImageUpload';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    bio: string | null;
    birthday: string;
    avatarUrl: string | null;
    interests: string;
  };
}) {
  const [state, action] = useActionState(updateProfile, {});

  return (
    <form action={action} className={styles.form} noValidate>
      <ImageUpload
        name="avatar"
        label="Photo de profil"
        initialUrl={initial.avatarUrl}
        shape="circle"
        serverError={state.errors?.avatar}
      />

      <Field
        id="name"
        name="name"
        label="Nom"
        defaultValue={initial.name}
        required
        error={state.errors?.name}
      />

      <TextareaField
        id="bio"
        name="bio"
        label="À propos"
        defaultValue={initial.bio ?? ''}
        placeholder="Ce que vous aimez, en une phrase."
        error={state.errors?.bio}
      />

      <Field
        id="birthday"
        name="birthday"
        type="date"
        label="Date de naissance"
        defaultValue={initial.birthday}
        hint="Vos amis verront le jour, jamais l'année."
        error={state.errors?.birthday}
      />

      <Field
        id="interests"
        name="interests"
        label="Centres d'intérêt"
        defaultValue={initial.interests}
        placeholder="Café, céramique, randonnée"
        hint="Séparés par des virgules — de quoi inspirer vos proches."
        error={state.errors?.interests}
      />

      {/*
        The colour picker is gone with the redesign. An avatar's tint is now
        derived from the name, so this field edited a value nothing displayed.
        The column and the action's optional handling of it are left alone —
        pre-existing data, not this change's to drop.
      */}

      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
