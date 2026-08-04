'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/lib/profile-actions';
import { Field, TextareaField } from './Field';
import { ImageUpload } from './ImageUpload';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

const COLOURS = ['#FF6A55', '#6C5CE7', '#2F6BFF', '#11A56F', '#111114'];

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    bio: string | null;
    birthday: string;
    avatarColor: string;
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

      <fieldset className={styles.fieldset}>
        <legend className={styles.legend}>
          Couleur (sans photo de profil)
        </legend>
        <div className={styles.colours}>
          {COLOURS.map((colour) => (
            <label key={colour} className={styles.colour}>
              <input
                type="radio"
                name="avatarColor"
                value={colour}
                defaultChecked={initial.avatarColor === colour}
              />
              <span style={{ background: colour }} />
              <span className="srOnly">{colour}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <SubmitButton pendingLabel="Enregistrement…">Enregistrer</SubmitButton>
    </form>
  );
}
