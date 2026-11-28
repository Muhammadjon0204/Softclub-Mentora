import { useQuery } from '@tanstack/react-query';
import { Building2 } from 'lucide-react-native';
import { useState } from 'react';

import { listUsers } from '@/api/users';
import { listCategories } from '@/api/categories';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { apiGet, apiSend, type Paged } from '@/lib/api';
import { useAction, useConfirm } from '@/ui/feedback';
import { Badge, Button, Group, Info, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';
import { Sheet } from '@/ui/sheet';

interface BranchDetails {
  id: string;
  name: string;
  code: string;
  address?: string | null;
  timeZoneId: string;
  isHeadOffice: boolean;
  isActive: boolean;
  concurrencyToken: string;
}

/** Branches of the organization: who works there and whether it is switched on. Creating and editing
 *  a branch stays on the site. */
export default function BranchesScreen(): JSX.Element {
  const { t } = useT();
  const me = useUser();
  const confirm = useConfirm();
  const query = useQuery({ queryKey: ['branches', 'details'], queryFn: () => apiGet<Paged<BranchDetails>>('/api/v1/branches?pageSize=100') });
  const users = useQuery({ queryKey: ['users', me.id], queryFn: listUsers });
  const categories = useQuery({ queryKey: ['categories', me.id], queryFn: listCategories });
  const [selected, setSelected] = useState<BranchDetails | null>(null);
  const toggle = useAction(
    (branch: BranchDetails) =>
      apiSend('POST', `/api/v1/branches/${branch.id}/${branch.isActive ? 'deactivate' : 'activate'}`, {
        concurrencyToken: branch.concurrencyToken,
        ...(branch.isActive ? { confirmActiveUsers: true } : {}),
      }, branch.id),
    { success: 'Сохранено', onDone: () => setSelected(null) },
  );
  const count = (branchId: string, role?: string) => (users.data ?? []).filter((u) => u.branchId === branchId && u.isActive && (!role || u.role === role)).length;

  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>
        {(page) => (
          <Group>
            {page.items.map((b) => (
              <Row
                key={b.id}
                title={b.name}
                subtitle={`${t('Пользователи')}: ${count(b.id)} · ${t('Направления')}: ${(categories.data ?? []).filter((x) => x.branchId === b.id && x.isActive).length}`}
                icon={Building2}
                iconTone={b.isActive ? 'brand' : 'neutral'}
                meta={b.isHeadOffice ? <Badge tone="brand" label={t('Головной офис')} /> : b.isActive ? undefined : <Badge label={t('Отключён')} />}
                onPress={() => setSelected(b)}
              />
            ))}
          </Group>
        )}
      </Loaded>
      {selected ? (
        <Sheet open onClose={() => setSelected(null)} title={selected.name}>
          <Group>
            <Info label={t('Код')} value={selected.code} />
            {selected.address ? <Info label={t('Адрес')} value={selected.address} /> : null}
            <Info label={t('Часовой пояс')} value={selected.timeZoneId} />
            <Info label={t('Тимлиды')} value={String(count(selected.id, 'Lead'))} />
            <Info label={t('Менторы')} value={String(count(selected.id, 'Mentor'))} />
          </Group>
          {!selected.isHeadOffice ? (
            <Button
              kind={selected.isActive ? 'danger' : 'primary'}
              label={t(selected.isActive ? 'Отключить филиал' : 'Включить филиал')}
              loading={toggle.busy}
              onPress={() =>
                selected.isActive
                  ? confirm(t('Отключить филиал?'), t('Его сотрудники не смогут работать, пока вы не включите его снова.'), t('Отключить'), () => toggle.run(selected), true)
                  : toggle.run(selected)
              }
            />
          ) : null}
        </Sheet>
      ) : null}
    </Page>
  );
}
