'use client';

import { useActionState } from 'react';
import { updateProfile } from '@/lib/profile-actions';
import { useT } from '@/lib/i18n/client';
import { Field, SelectField, TextareaField } from './Field';
import { CategoryPicker } from './CategoryPicker';
import { ImageUpload } from './ImageUpload';
import { SubmitButton } from './SubmitButton';
import styles from './forms.module.css';

export function ProfileForm({
  initial,
}: {
  initial: {
    name: string;
    bio: string | null;
    avatarUrl: string | null;
    interests: readonly string[];
    gender: string;
    ageBracket: string;
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
        hint={t('auth.nameHint')}
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

      {/*
        Editable here because the privacy policy says consent can be withdrawn
        from the profile, and the GDPR asks that withdrawing be as easy as
        giving. The empty option is a real answer, and clearing the field is
        what erases what was stored.
      */}
      <SelectField
        id="gender"
        name="gender"
        label={t('survey.gender')}
        defaultValue={initial.gender}
        placeholder={t('survey.noAnswer')}
        options={[
          { value: 'FEMALE', label: t('survey.genderFemale') },
          { value: 'MALE', label: t('survey.genderMale') },
          { value: 'OTHER', label: t('survey.genderOther') },
        ]}
        error={state.errors?.gender}
      />

      <SelectField
        id="ageBracket"
        name="ageBracket"
        label={t('survey.age')}
        defaultValue={initial.ageBracket}
        placeholder={t('survey.noAnswer')}
        options={[
          { value: 'AGE_15_24', label: '15 – 24' },
          { value: 'AGE_25_34', label: '25 – 34' },
          { value: 'AGE_35_44', label: '35 – 44' },
          { value: 'AGE_45_54', label: '45 – 54' },
          { value: 'AGE_55_64', label: '55 – 64' },
          { value: 'AGE_65_PLUS', label: '65 +' },
        ]}
        error={state.errors?.ageBracket}
      />

      {/* Ticked, not typed. "À propos" above is where free text belongs —
          it is prose nothing matches on, so a spelling costs nothing there. */}
      <CategoryPicker
        legend={t('form.interests')}
        hint={t('form.interestsHint')}
        selected={initial.interests}
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
