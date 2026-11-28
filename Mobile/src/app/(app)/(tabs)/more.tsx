import { router, type Href } from 'expo-router';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  CalendarDays,
  KeyRound,
  Lightbulb,
  ListChecks,
  PlugZap,
  ScrollText,
  Tags,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { ScrollView } from 'react-native';

import { Space } from '@/constants/theme';
import { useCan } from '@/features/assignments/queries';
import { roleLabel } from '@/features/journal/api';
import { TeamPicker } from '@/features/teams/TeamPicker';
import { useT } from '@/lib/i18n';
import { useUser } from '@/lib/session';
import { Avatar, Group, Row, Section } from '@/ui/kit';
import { Screen } from '@/ui/Screen';

interface Entry {
  label: string;
  hint: string;
  href: Href;
  icon: LucideIcon;
  show: boolean;
}

/** Every section the site's menu has for this role, grouped by what a person comes for. */
export default function MoreScreen(): JSX.Element {
  const { t } = useT();
  const user = useUser();
  const can = useCan();
  const admin = user.role === 'Admin';
  const orgAdmin = admin && user.adminScope === 'Organization';
  const lead = user.role === 'Lead';

  const groups: { title: string; items: Entry[] }[] = [
    {
      title: 'Люди',
      items: [
        { label: lead ? 'Команда' : 'Пользователи', hint: lead ? 'Менторы и участники вашей команды' : 'Приглашения, роли, доступ', href: '/users', icon: Users, show: admin || lead },
        { label: 'Направления', hint: 'Лиды, менторы и настройки сроков', href: '/categories', icon: Tags, show: admin },
        { label: 'Филиалы', hint: 'Все филиалы организации', href: '/branches', icon: Building2, show: orgAdmin },
        { label: 'Права доступа', hint: 'Что кому разрешено', href: '/permissions', icon: KeyRound, show: admin && can('permissions.manage') },
      ],
    },
    {
      title: 'Работа',
      items: [
        { label: 'Предложения', hint: user.role === 'Mentor' ? 'Ваши идеи и ответы на них' : 'Идеи менторов', href: '/proposals', icon: Lightbulb, show: true },
        { label: 'Календарь', hint: 'Сроки по дням', href: '/calendar', icon: CalendarDays, show: true },
        { label: 'Отчёты', hint: 'Сроки, проверки, результаты', href: '/reports', icon: BarChart3, show: can('reports.view') },
        { label: 'Интеграция CRM', hint: 'Группы, студенты и журнал', href: '/crm', icon: PlugZap, show: can('crm.use') },
      ],
    },
    {
      title: 'Контроль',
      items: [
        { label: 'Журнал заданий', hint: 'Кто, что и когда сделал', href: '/journal', icon: ListChecks, show: true },
        { label: 'Журнал аудита', hint: 'Действия пользователей в системе', href: '/audit', icon: ScrollText, show: admin && can('audit.view') },
        { label: 'Уведомления', hint: 'Письма и сообщения, повтор отправки', href: '/notifications', icon: Bell, show: admin },
        { label: 'Состояние системы', hint: 'Работают ли сервисы', href: '/health', icon: Activity, show: admin },
      ],
    },
  ];

  return (
    <Screen title={t('Ещё')}>
      <ScrollView contentContainerStyle={{ padding: Space.lg, gap: Space.lg, paddingBottom: Space.xxl * 2 }}>
        <Group>
          <Row
            title={user.fullName}
            subtitle={`${t(roleLabel(user))}${user.branch ? ` · ${user.branch.name}` : ''}`}
            leading={<Avatar name={user.fullName} />}
            onPress={() => router.push('/profile')}
          />
        </Group>
        <TeamPicker />
        {groups.map((group) => {
          const items = group.items.filter((item) => item.show);
          if (items.length === 0) return null;
          return (
            <Section key={group.title} title={t(group.title)}>
              <Group>
                {items.map((item) => (
                  <Row key={item.label} title={t(item.label)} subtitle={t(item.hint)} icon={item.icon} iconTone="brand" onPress={() => router.push(item.href)} />
                ))}
              </Group>
            </Section>
          );
        })}
      </ScrollView>
    </Screen>
  );
}
