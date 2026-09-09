import { taskDirectoriesService } from "./taskDirectories.service";
import { taskService } from "./task.service";
import { defaultPriority, initialStatus } from "../../modules/Tasks/constants";

type OnboardingTaskDefinition = {
  title: string;
  acceptanceCriteria: string;
};

type OnboardingGroupDefinition = {
  code: string;
  title: string;
  dueAfterMonths: number;
  tasks: OnboardingTaskDefinition[];
};

export type CreateEmployeeOnboardingInput = {
  employeeId: string;
  employeeName: string;
  managerId: string;
  hireDate: string | null;
  locationId?: string | null;
};

export type CreateEmployeeOnboardingResult = {
  createdParents: number;
  createdSubtasks: number;
};

const ONBOARDING_TEMPLATE_VERSION = 1;

export const ONBOARDING_GROUPS: OnboardingGroupDefinition[] = [
  {
    code: "general",
    title: "Umumiy moslashuv vazifalari",
    dueAfterMonths: 3,
    tasks: [
      {
        title: "Asosiy majburiyatlar va standartlarni o‘rgatish",
        acceptanceCriteria: "Vazifalarni tushunadi va bajaradi",
      },
      {
        title: "Kompaniya mahsulotlari va xizmatlari bilan tanishtirish",
        acceptanceCriteria: "Kerakli bilim darajasiga ega",
      },
      {
        title: "Mijozlar, hudud va ish jarayonlarini tushuntirish",
        acceptanceCriteria: "Mas’uliyat hududida erkin yo‘naladi",
      },
      {
        title: "CRM, hisobot va ichki qoidalarni o‘rgatish",
        acceptanceCriteria: "Doimiy nazoratsiz ishlaydi",
      },
      {
        title: "Kommunikatsiya va korporativ standartlarni tushuntirish",
        acceptanceCriteria: "Kompaniya standartlariga rioya qiladi",
      },
      {
        title: "Lavozim bo‘yicha asosiy KPI va vazifalarni kelishish",
        acceptanceCriteria: "Kelishilgan ko‘rsatkichlarga erishadi",
      },
    ],
  },
  {
    code: "month-1",
    title: "Birinchi oy — tanishuv va o‘rganish",
    dueAfterMonths: 1,
    tasks: [
      { title: "Kompaniya va jamoa bilan tanishtirish", acceptanceCriteria: "Tanishuv yakunlangan" },
      { title: "Lavozim va majburiyatlarni o‘rganish", acceptanceCriteria: "Majburiyatlarni tushunadi" },
      {
        title: "Mahsulotlar va xizmatlarni o‘rganish",
        acceptanceCriteria: "Asosiy mahsulot va xizmatlarni biladi",
      },
      {
        title: "CRM va ish vositalarini o‘zlashtirish",
        acceptanceCriteria: "Asosiy vositalardan foydalana oladi",
      },
      {
        title: "Rahbar nazorati ostida dastlabki vazifalarni bajarish",
        acceptanceCriteria: "Dastlabki vazifalar bajarilgan",
      },
    ],
  },
  {
    code: "month-2",
    title: "Ikkinchi oy — mustaqil ishlash",
    dueAfterMonths: 2,
    tasks: [
      {
        title: "Asosiy majburiyatlarni mustaqil bajarish",
        acceptanceCriteria: "Asosiy ishlarni mustaqil bajaradi",
      },
      {
        title: "Rejali vazifalar va KPI’larni bajarish",
        acceptanceCriteria: "Kelishilgan reja va KPI bajariladi",
      },
      {
        title: "Kompaniya standartlariga rioya qilish",
        acceptanceCriteria: "Standart buzilishlari mavjud emas",
      },
      {
        title: "Doimiy nazoratsiz ishlash",
        acceptanceCriteria: "Rahbarning doimiy nazoratisiz ishlaydi",
      },
      {
        title: "Birinchi oyda aniqlangan kamchiliklarni bartaraf etish",
        acceptanceCriteria: "Aniqlangan kamchiliklar yopilgan",
      },
    ],
  },
  {
    code: "month-3",
    title: "Uchinchi oy — mustahkamlash va natija",
    dueAfterMonths: 3,
    tasks: [
      {
        title: "Ishni to‘liq hajmda mustaqil bajarish",
        acceptanceCriteria: "Ishni to‘liq hajmda bajaradi",
      },
      {
        title: "Asosiy KPI va rejalarni bajarish",
        acceptanceCriteria: "Asosiy KPI va rejalar bajarilgan",
      },
      {
        title: "Kompaniya standartlariga rioya qilish",
        acceptanceCriteria: "Standartlarga barqaror rioya qiladi",
      },
      {
        title: "Kerakli bilim va ko‘nikmalarni namoyish etish",
        acceptanceCriteria: "Lavozim uchun zarur bilim va ko‘nikmalarni ko‘rsatadi",
      },
      {
        title: "Yordamsiz ishlashga tayyorlikni tasdiqlash",
        acceptanceCriteria: "Mustaqil ishlashga tayyor",
      },
    ],
  },
  {
    code: "final-assessment",
    title: "Yakuniy baholash",
    dueAfterMonths: 3,
    tasks: [
      { title: "Lavozim majburiyatlarini bilishini baholash", acceptanceCriteria: "1–5 ball" },
      { title: "Kasbiy bilimlarni baholash", acceptanceCriteria: "1–5 ball" },
      { title: "Vazifalar va KPI bajarilishini baholash", acceptanceCriteria: "1–5 ball" },
      { title: "Standartlarga rioya qilishni baholash", acceptanceCriteria: "1–5 ball" },
      { title: "Mustaqillikni baholash", acceptanceCriteria: "1–5 ball" },
      { title: "Jamoa bilan hamkorlikni baholash", acceptanceCriteria: "1–5 ball" },
    ],
  },
];

const normalizeDate = (value: string | null): string => {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date().toISOString().slice(0, 10);
};

/** Add calendar months while keeping end-of-month dates valid. */
export const addCalendarMonths = (date: string, months: number): string => {
  const [year, month, day] = date.split("-").map(Number);
  const firstOfTargetMonth = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(
    Date.UTC(firstOfTargetMonth.getUTCFullYear(), firstOfTargetMonth.getUTCMonth() + 1, 0)
  ).getUTCDate();
  firstOfTargetMonth.setUTCDate(Math.min(day, lastDay));
  return firstOfTargetMonth.toISOString().slice(0, 10);
};

const markerFor = (employeeId: string, groupCode: string): string =>
  `<!-- hrms:onboarding:${employeeId}:${groupCode}:v${ONBOARDING_TEMPLATE_VERSION} -->`;

const escapeHtml = (value: string): string =>
  value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ] ?? character
  );

const parentDescription = (
  employeeName: string,
  employeeId: string,
  groupCode: string
): string =>
  `<p>Yangi xodim: <strong>${escapeHtml(employeeName)}</strong></p>${markerFor(employeeId, groupCode)}`;

const subtaskDescription = (criteria: string): string =>
  `<p><strong>Natija mezoni:</strong> ${criteria}</p>`;

/**
 * Creates or resumes the fixed onboarding plan for one employee. Existing
 * group markers and subtask titles make a retry fill only missing records.
 */
export const createEmployeeOnboardingTasks = async (
  input: CreateEmployeeOnboardingInput
): Promise<CreateEmployeeOnboardingResult> => {
  const startDate = normalizeDate(input.hireDate);
  const [snapshot, directories] = await Promise.all([
    taskService.list(),
    taskDirectoriesService.list(),
  ]);
  const statusId = initialStatus(directories)?.id ?? null;
  const priorityId = defaultPriority(directories)?.id ?? null;
  const typeId = directories.types[0]?.id ?? null;
  const tasks = [...snapshot.tasks];
  let createdParents = 0;
  let createdSubtasks = 0;

  for (const group of ONBOARDING_GROUPS) {
    const marker = markerFor(input.employeeId, group.code);
    let parent = tasks.find(
      (task) => task.parentId === null && task.description.includes(marker)
    );
    const deadline = addCalendarMonths(startDate, group.dueAfterMonths);

    if (!parent) {
      parent = await taskService.create({
        title: `Onboarding — ${input.employeeName} — ${group.title}`,
        description: parentDescription(input.employeeName, input.employeeId, group.code),
        typeId,
        locationId: input.locationId ?? null,
        statusId,
        priorityId,
        sheetId: null,
        assigneeIds: [input.managerId],
        tagIds: [],
        startDate,
        deadline,
        parentId: null,
      });
      tasks.push(parent);
      createdParents += 1;
    }

    const existingTitles = new Set(
      tasks.filter((task) => task.parentId === parent.id).map((task) => task.title.trim())
    );

    for (const definition of group.tasks) {
      if (existingTitles.has(definition.title)) continue;

      const subtask = await taskService.create({
        title: definition.title,
        description: subtaskDescription(definition.acceptanceCriteria),
        typeId,
        locationId: input.locationId ?? null,
        statusId,
        priorityId,
        sheetId: null,
        assigneeIds: [input.managerId],
        tagIds: [],
        startDate,
        deadline,
        parentId: parent.id,
      });
      tasks.push(subtask);
      existingTitles.add(definition.title);
      createdSubtasks += 1;
    }
  }

  return { createdParents, createdSubtasks };
};
