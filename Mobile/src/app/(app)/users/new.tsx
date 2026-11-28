import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Text } from 'react-native';

import { listBranches } from '@/api/admin';
import { listCategories } from '@/api/categories';
import { createUser, type User } from '@/api/users';
import { USER_ROLE_LABEL } from '@/features/users/presentation';
import { useBranchScope } from '@/lib/branchScope';
import { useT } from '@/lib/i18n';
import { goBack } from '@/lib/nav';
import { useUser } from '@/lib/session';
import { useColors } from '@/lib/useColors';
import { useAction } from '@/ui/feedback';
import { Button } from '@/ui/kit';
import { Page } from '@/ui/page';
import { Field } from '@/ui/primitives';
import { Select } from '@/ui/sheet';

type Choice = User['role'] | 'Member';

export default function NewUserScreen(): JSX.Element {
  const c = useColors();
  const { t } = useT();
  const me = useUser();
  const scope = useBranchScope();
  const orgAdmin = me.adminScope === 'Organization';
  // Whom each role may invite — the server enforces the same table.
  // «Участник» is a mentor's account that does not teach in its team.
  const roles: Choice[] = orgAdmin
    ? ['Admin', 'Lead', 'Member', 'Mentor']
    : me.role === 'Admin' ? ['Lead', 'Member', 'Mentor'] : ['Member', 'Mentor'];
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Choice>('Mentor');
  const [branchId, setBranchId] = useState<string | null>(scope?.id ?? me.branch?.id ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(me.role === 'Lead' ? (me.category?.id ?? null) : null);
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const branches = useQuery({ queryKey: ['branches'], queryFn: listBranches, enabled: orgAdmin });
  const needsCategory = role !== 'Admin';
  const categoryOptions = (categories.data ?? [])
    .filter((x) => x.isActive && (!branchId || x.branchId === branchId))
    .map((x) => ({ value: x.id, label: x.name, hint: x.branch?.name }));
  const valid =
    fullName.trim().length >= 2 && /\S+@\S+\.\S+/.test(email.trim()) && (!orgAdmin || branchId !== null) && (!needsCategory || categoryId !== null);

  const save = useAction(
    () =>
      createUser(
        {
          fullName: fullName.trim(),
          email: email.trim(),
          role: role === 'Member' ? 'Mentor' : role,
          adminScope: role === 'Admin' ? 'Branch' : null,
          categoryId: needsCategory ? categoryId : null,
          ...(role === 'Member' ? { teamRole: 'Member' as const } : {}),
        },
        branchId,
      ),
    { success: 'Приглашение отправлено на почту', onDone: () => goBack('/users') },
  );

  return (
    <Page>
      <Field label={t('Имя и фамилия')} value={fullName} onChangeText={setFullName} maxLength={200} autoCapitalize="words" />
      <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" placeholder="name@company.com" />
      <Select
        label={t('Роль')}
        value={role}
        onChange={setRole}
        options={roles.map((r) => ({
          value: r,
          label: t(r === 'Admin' ? 'Администратор филиала' : r === 'Member' ? 'Участник команды' : USER_ROLE_LABEL[r]),
          hint: r === 'Member' ? t('Работает в команде, но не преподаёт') : null,
        }))}
      />
      {orgAdmin ? (
        <Select
          label={t('Филиал')}
          value={branchId}
          onChange={(id) => {
            setBranchId(id);
            setCategoryId(null);
          }}
          options={(branches.data?.items ?? []).filter((b) => b.isActive).map((b) => ({ value: b.id, label: b.name }))}
        />
      ) : null}
      {needsCategory && me.role === 'Admin' ? <Select label={t('Направление')} value={categoryId} onChange={setCategoryId} options={categoryOptions} /> : null}
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('Человек получит письмо со ссылкой, по которой задаст пароль.')}</Text>
      <Button label={t('Пригласить')} onPress={() => save.run()} loading={save.busy} disabled={!valid} />
    </Page>
  );
}
