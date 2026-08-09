'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/lib/profile-actions';
import { useT } from '@/lib/i18n/client';
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
  const t = useT();
  const [state, action] = useActionState(updateProfile, {});

  return (
    <form action={action} className={styles.form} noValidate>
      <ImageUpload
        name="avatar"
        label={t('form.avatar')}
        initialUrl={initial.avatarUrl}
        shape="circle"
        serverError={state.errors?.avatar}
      />

      <Field
        id="name"
        name="name"
        label={t('auth.name')}
        defaultValue={initial.name}
        required
        error={state.errors?.name}
      />

      <TextareaField
        id="bio"
        name="bio"
        label={t('form.about')}
        defaultValue={initial.bio ?? ''}
        placeholder={t('form.aboutPlaceholder')}
        error={state.errors?.bio}
      />

      <Field
        id="birthday"
        name="birthday"
        type="date"
        label={t('form.birthday')}
        defaultValue={initial.birthday}
        hint={t('form.birthdayHint')}
        error={state.errors?.birthday}
      />

      <Field
        id="interests"
        name="interests"
        label={t('form.interests')}
        defaultValue={initial.interests}
        placeholder={t('form.interestsPlaceholder')}
        hint={t('form.interestsHint')}
        error={state.errors?.interests}
      />

      {/*
        The colour picker is gone with the redesign. An avatar's tint is now
        derived from the name, so this field edited a value nothing displayed.
        The column and the action's optional handling of it are left alone —
        pre-existing data, not this change's to drop.
      */}

      <SubmitButton pendingLabel={t('action.saving')}>{t('common.save')}</SubmitButton>
    </form>
  );
}
