/** Демо-данные страницы /admin/users (UI-прототип, раздел 7 сессии). */

export type PreviewUserRole = 'OrgAdmin' | 'BranchAdmin' | 'Lead' | 'Mentor';
export type PreviewUserStatus = 'Active' | 'Invited' | 'Locked' | 'Deactivated';

export interface PreviewUser {
  id: string;
  fullName: string;
  email: string;
  role: PreviewUserRole;
  branchName: string;
  categoryName: string | null;
  status: PreviewUserStatus;
  lastLoginLabel: string;
  createdLabel: string;
}

export const ROLE_LABEL: Record<PreviewUserRole, string> = {
  OrgAdmin: 'Администратор организации',
  BranchAdmin: 'Администратор филиала',
  Lead: 'Руководитель направления',
  Mentor: 'Ментор',
};

export const STATUS_LABEL: Record<PreviewUserStatus, string> = {
  Active: 'Активен',
  Invited: 'Приглашён',
  Locked: 'Заблокирован',
  Deactivated: 'Деактивирован',
};

const FEATURED_USERS: PreviewUser[] = [
  {
    id: 'usr-01',
    fullName: 'Фируз Алимов',
    email: 'firuz.alimov@softclub-academy.test',
    role: 'OrgAdmin',
    branchName: 'Главный офис',
    categoryName: null,
    status: 'Active',
    lastLoginLabel: 'Сегодня, 09:42',
    createdLabel: '02.02.2023',
  },
  {
    id: 'usr-02',
    fullName: 'Мадина Юсупова',
    email: 'madina.yusupova@softclub-academy.test',
    role: 'BranchAdmin',
    branchName: 'Филиал Худжанд',
    categoryName: null,
    status: 'Active',
    lastLoginLabel: 'Вчера, 18:15',
    createdLabel: '14.03.2023',
  },
  {
    id: 'usr-03',
    fullName: 'Феруза Каримова',
    email: 'feruza.karimova@softclub-academy.test',
    role: 'BranchAdmin',
    branchName: 'Филиал Бохтар',
    categoryName: null,
    status: 'Active',
    lastLoginLabel: 'Вчера, 13:57',
    createdLabel: '21.06.2023',
  },
  {
    id: 'usr-04',
    fullName: 'Насим Раджабов',
    email: 'nasim.radjabov@softclub-academy.test',
    role: 'BranchAdmin',
    branchName: 'Главный офис',
    categoryName: null,
    status: 'Active',
    lastLoginLabel: '3 дня назад',
    createdLabel: '09.09.2023',
  },
  {
    id: 'usr-05',
    fullName: 'Сухроб Холов',
    email: 'suhrob.kholov@softclub-academy.test',
    role: 'Lead',
    branchName: 'Главный офис',
    categoryName: 'C#',
    status: 'Active',
    lastLoginLabel: 'Вчера, 16:33',
    createdLabel: '11.01.2023',
  },
  {
    id: 'usr-06',
    fullName: 'Шахноза Мирзоева',
    email: 'shahnoza.mirzoeva@softclub-academy.test',
    role: 'Lead',
    branchName: 'Главный офис',
    categoryName: 'Frontend',
    status: 'Deactivated',
    lastLoginLabel: '12.05.2024, 11:44',
    createdLabel: '11.01.2023',
  },
  {
    id: 'usr-07',
    fullName: 'Далер Сафаров',
    email: 'daler.safarov@softclub-academy.test',
    role: 'Lead',
    branchName: 'Филиал Худжанд',
    categoryName: 'Python',
    status: 'Active',
    lastLoginLabel: 'Сегодня, 08:05',
    createdLabel: '02.02.2023',
  },
  {
    id: 'usr-08',
    fullName: 'Умедчода Парвиз',
    email: 'umedchoda.parviz@softclub-academy.test',
    role: 'Lead',
    branchName: 'Главный офис',
    categoryName: 'Mobile Development',
    status: 'Active',
    lastLoginLabel: 'Сегодня, 10:02',
    createdLabel: '18.04.2023',
  },
  {
    id: 'usr-09',
    fullName: 'Нигина Джалолова',
    email: 'nigina.jalolova@softclub-academy.test',
    role: 'Lead',
    branchName: 'Филиал Худжанд',
    categoryName: 'QA',
    status: 'Active',
    lastLoginLabel: 'Сегодня, 08:21',
    createdLabel: '05.05.2023',
  },
  {
    id: 'usr-10',
    fullName: 'Комилжон Ибрагимов',
    email: 'komiljon.ibragimov@softclub-academy.test',
    role: 'Lead',
    branchName: 'Главный офис',
    categoryName: 'DevOps',
    status: 'Active',
    lastLoginLabel: '14.05.2024, 17:08',
    createdLabel: '30.07.2023',
  },
];

const MENTOR_FIRST_NAMES = [
  'Рустам', 'Шервон', 'Джамшед', 'Хуршед', 'Бахтиёр', 'Абдулло', 'Сорбон', 'Фаридун',
  'Зафар', 'Гулнора', 'Зарина', 'Фарзона', 'Мунира', 'Дилноза', 'Ситора', 'Парвина',
  'Наргис', 'Тахмина', 'Джасур', 'Отабек', 'Мехрубон', 'Диловар', 'Саодат', 'Мадина',
  'Озода', 'Фаррух',
];
const MENTOR_LAST_NAMES = [
  'Раҳимов', 'Назаров', 'Юлдашев', 'Абдуллоев', 'Турсунов', 'Раджабов', 'Хакимов', 'Гафуров',
  'Саидов', 'Умаров', 'Латипов', 'Рахимова', 'Назарова', 'Юлдашева', 'Абдуллоева', 'Турсунова',
  'Раджабова', 'Хакимова', 'Гафурова', 'Саидова', 'Умарова', 'Латипова', 'Қосимов', 'Қосимова',
  'Одинаев', 'Одинаева',
];
const MENTOR_BRANCHES = ['Главный офис', 'Филиал Худжанд', 'Филиал Бохтар'];
const MENTOR_CATEGORIES = ['C#', 'Frontend', 'Python', 'UI/UX Design', 'Mobile Development', 'QA', 'DevOps', 'Data Science'];
const MENTOR_STATUSES: PreviewUserStatus[] = ['Active', 'Active', 'Active', 'Active', 'Active', 'Invited', 'Locked'];
const LAST_LOGIN_POOL = [
  'Сегодня, 07:5{i}', 'Вчера, 1{i}:20', '2 дня назад', '4 дня назад', '11.05.2024, 09:1{i}', 'Никогда',
];

/** Только буквы, реально встречающиеся в пулах имён/фамилий выше — не общий словарь языка. */
const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a', б: 'b', в: 'v', г: 'g', ғ: 'gh', д: 'd', е: 'e', ж: 'j', з: 'z', и: 'i',
  й: 'y', к: 'k', қ: 'q', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r', с: 's',
  т: 't', у: 'u', ӯ: 'u', ф: 'f', х: 'kh', ҳ: 'h', ц: 'ts', ч: 'ch', ш: 'sh', щ: 'sch',
  ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya', ҷ: 'j', ӣ: 'i',
};

function toEmailSlug(fullNamePart: string): string {
  return fullNamePart
    .toLowerCase()
    .split('')
    .map((char) => CYRILLIC_TO_LATIN[char] ?? char)
    .join('');
}

/** Детерминированная, но правдоподобная генерация без Math.random — раздел 4 сессии превью. */
function buildMentors(count: number): PreviewUser[] {
  const mentors: PreviewUser[] = [];
  for (let index = 0; index < count; index += 1) {
    const firstName = MENTOR_FIRST_NAMES[index % MENTOR_FIRST_NAMES.length];
    const lastName = MENTOR_LAST_NAMES[(index * 7 + 3) % MENTOR_LAST_NAMES.length];
    const branchName = MENTOR_BRANCHES[index % MENTOR_BRANCHES.length];
    const categoryName = MENTOR_CATEGORIES[(index * 3 + 1) % MENTOR_CATEGORIES.length];
    const status = MENTOR_STATUSES[index % MENTOR_STATUSES.length];
    const loginTemplate = LAST_LOGIN_POOL[index % LAST_LOGIN_POOL.length];
    const dayOfMonth = 2 + (index % 26);

    mentors.push({
      id: `usr-mentor-${index + 1}`,
      fullName: `${firstName} ${lastName}`,
      email: `${toEmailSlug(firstName)}.${toEmailSlug(lastName)}@softclub-academy.test`,
      role: 'Mentor',
      branchName,
      categoryName,
      status,
      lastLoginLabel: status === 'Invited' ? 'Ещё не входил' : loginTemplate.replace('{i}', String(index % 10)),
      createdLabel: `${String(dayOfMonth).padStart(2, '0')}.0${(index % 9) + 1}.2024`,
    });
  }
  return mentors;
}

export const PREVIEW_USERS: PreviewUser[] = [...FEATURED_USERS, ...buildMentors(26)];

export const PREVIEW_USER_SUMMARY = {
  total: PREVIEW_USERS.length,
  admins: PREVIEW_USERS.filter((user) => user.role === 'OrgAdmin' || user.role === 'BranchAdmin').length,
  leads: PREVIEW_USERS.filter((user) => user.role === 'Lead').length,
  mentors: PREVIEW_USERS.filter((user) => user.role === 'Mentor').length,
};

/** Компактный line chart «Новые пользователи за 30 дней» — 7 точек, детерминировано. */
export const PREVIEW_NEW_USERS_SERIES: { label: string; value: number }[] = [
  { label: '1 нед', value: 3 },
  { label: '2 нед', value: 5 },
  { label: '3 нед', value: 4 },
  { label: '4 нед', value: 7 },
  { label: '5 нед', value: 6 },
  { label: '6 нед', value: 9 },
  { label: 'Сейчас', value: 8 },
];
