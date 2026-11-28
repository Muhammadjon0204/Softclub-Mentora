import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Plus, Tags } from 'lucide-react-native';
import { useState } from 'react';

import { listCategories, createCategory } from '@/api/categories';
import { listUsers } from '@/api/users';
import { listBranches } from '@/api/admin';
import { useCan } from '@/features/assignments/queries';
import { useBranchScope } from '@/lib/branchScope';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { useAction } from '@/ui/feedback';
import { Badge, Button, Fab, Group, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Field, StateMessage } from '@/ui/primitives';
import { Select, Sheet } from '@/ui/sheet';

export default function CategoriesScreen(): JSX.Element {
  const { t } = useT();
  const me = useUser();
  const can = useCan();
  const query = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const [creating, setCreating] = useState(false);

  return (
    <Page
      onRefresh={() => void query.refetch()}
      refreshing={query.isRefetching}
      floating={can('categories.manage') ? <Fab label={t('Создать')} icon={Plus} onPress={() => setCreating(true)} /> : null}
    >
      <Loaded query={query}>
        {(categories) =>
          categories.length === 0 ? (
            <StateMessage title={t('Направлений пока нет')} />
          ) : (
            <Group>
              {[...categories]
                .sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name, 'ru'))
                .map((x) => {
                  const members = (users.data ?? []).filter((u) => u.categoryId === x.id && u.isActive);
                  const lead = members.find((u) => u.role === 'Lead');
                  return (
                    <Row
                      key={x.id}
                      title={x.name}
                      subtitle={`${lead ? lead.fullName : t('Без руководителя')} · ${t('Менторы')}: ${members.filter((u) => u.role === 'Mentor').length}${me.adminScope === 'Organization' && x.branch ? ` · ${x.branch.name}` : ''}`}
                      icon={Tags}
                      iconTone={x.isActive ? 'brand' : 'neutral'}
                      meta={x.isActive ? undefined : <Badge label={t('Отключено')} />}
                      onPress={() => router.push({ pathname: '/categories/[id]', params: { id: x.id } })}
                    />
                  );
                })}
            </Group>
          )
        }
      </Loaded>
      {creating ? <CreatePanel onClose={() => setCreating(false)} /> : null}
    </Page>
  );
}

function CreatePanel({ onClose }: { onClose: () => void }): JSX.Element {
  const { t } = useT();
  const me = useUser();
  const scope = useBranchScope();
  const orgAdmin = me.adminScope === 'Organization';
  const branches = useQuery({ queryKey: ['branches'], queryFn: listBranches, enabled: orgAdmin });
  const [branchId, setBranchId] = useState<string | null>(scope?.id ?? me.branch?.id ?? null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const save = useAction(() => createCategory({ name: name.trim(), description: description.trim() || null }, branchId), {
    success: 'Направление создано',
    onDone: onClose,
  });
  return (
    <Sheet open onClose={onClose} title={t('Новое направление')}>
      {orgAdmin ? (
        <Select label={t('Филиал')} value={branchId} onChange={setBranchId} options={(branches.data?.items ?? []).map((b) => ({ value: b.id, label: b.name }))} />
      ) : null}
      <Field label={t('Название')} value={name} onChangeText={setName} maxLength={100} placeholder="C#, React, Python…" />
      <Field label={t('Описание')} value={description} onChangeText={setDescription} multiline maxLength={1000} />
      <Button label={t('Создать')} onPress={() => save.run()} loading={save.busy} disabled={name.trim().length < 2 || (orgAdmin && !branchId)} />
    </Sheet>
  );
}
