import { useQuery } from '@tanstack/react-query';
import { Bot, Database, HardDrive, Server, type LucideIcon } from 'lucide-react-native';

import { API_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { Badge, Group, Row } from '@/ui/kit';
import { Loaded, Page } from '@/ui/page';

interface Health {
  status: string;
  totalDurationMs: number;
  checks: { name: string; status: string; durationMs: number }[];
}

const SERVICE: Record<string, { label: string; icon: LucideIcon }> = {
  postgres: { label: 'База данных', icon: Database },
  storage: { label: 'Хранилище файлов', icon: HardDrive },
  ai: { label: 'ИИ-помощник', icon: Bot },
};
const STATE: Record<string, { label: string; tone: 'success' | 'warning' | 'danger' }> = {
  Healthy: { label: 'Работает', tone: 'success' },
  Degraded: { label: 'Ограничено', tone: 'warning' },
  Unhealthy: { label: 'Недоступен', tone: 'danger' },
};

/** The server's own readiness check, asked from this phone — so it also shows whether the phone reaches it. */
export default function HealthScreen(): JSX.Element {
  const { t } = useT();
  const query = useQuery({
    queryKey: ['health'],
    refetchInterval: 30_000,
    queryFn: async (): Promise<Health> => {
      try {
        // An unhealthy server answers 503 with the same body — that is a result, not an error.
        const response = await fetch(`${API_URL}/health/ready`);
        return (await response.json()) as Health;
      } catch {
        throw new Error('Нет связи с сервером. Проверьте интернет.');
      }
    },
  });
  return (
    <Page onRefresh={() => void query.refetch()} refreshing={query.isRefetching}>
      <Loaded query={query}>
        {(health) => (
          <>
            <Group>
              <Row title={t('Сервер RAVAND')} subtitle={`${Math.round(health.totalDurationMs)} ms`} icon={Server} iconTone={STATE[health.status]?.tone ?? 'neutral'} trailing={<Badge tone={STATE[health.status]?.tone} label={t(STATE[health.status]?.label ?? health.status)} />} />
            </Group>
            <Group>
              {health.checks.map((check) => (
                <Row
                  key={check.name}
                  title={t(SERVICE[check.name]?.label ?? check.name)}
                  subtitle={`${Math.round(check.durationMs)} ms`}
                  icon={SERVICE[check.name]?.icon ?? Server}
                  iconTone={STATE[check.status]?.tone ?? 'neutral'}
                  trailing={<Badge tone={STATE[check.status]?.tone} label={t(STATE[check.status]?.label ?? check.status)} />}
                />
              ))}
            </Group>
          </>
        )}
      </Loaded>
    </Page>
  );
}
