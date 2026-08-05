# Модуль «Задачи» (Tasks)

Трекер задач внутри HRMS-фронтенда (`hrms-front`). Доска/таблица/график/календарь,
детальная карточка задачи в стиле Jira, создание в стиле Linear.

**Статус: подключён бэкенд** — методы `task_*` в `udevs-hrms-reports`
(`TASKS_DB_SCHEMA.md`). Mock-слоя больше нет; на localStorage остались только
листы задач (§9).

---

## 1. Стек и соглашения

| Что | Чем |
|---|---|
| Фреймворк | React 19 + TypeScript, Vite |
| Стили | Tailwind CSS v4 (токены темы в `src/index.css`, секция `@theme`) |
| Данные | `react-query` v3 (`useQuery` / `useMutation`) |
| Роутинг | `react-router` v7 |
| Уведомления | `sonner` (`toast.success` / `toast.error`) |
| Иконки | `lucide-react` |
| Поповеры | `@floating-ui/react` |
| Drag-n-drop доски | `@hello-pangea/dnd` |
| Календарь | `@fullcalendar/react` (dayGrid + list + interaction) |
| Rich text | `react-simple-wysiwyg` + `dompurify` |
| Даты в пикере | `react-datepicker` + `date-fns/locale/ru` |

Соглашения кода: язык интерфейса — русский; комментарии в коде — английские,
объясняют «почему», а не «что»; классы Tailwind вместо inline-стилей (исключение —
динамические цвета/размеры); имена файлов — `PascalCase.tsx` для компонентов.

---

## 2. Где модуль подключён

| Точка | Файл |
|---|---|
| Роут `/tasks` | `src/App.tsx` |
| Пункт меню «Задачи» (секция «Задачи и KPI») | `src/layout/AppSidebar.tsx` |
| Ключ модуля `tasks` для ролей/доступов | `src/modules/Settings/Roles/moduleCatalog.ts` |
| Подпись хлебных крошек | `src/layout/AppHeader.tsx` |
| CRUD справочников (статусы/приоритеты/типы/теги) | `src/modules/Settings/TaskDirectories`, роут `/settings/task-directories`, пункт каталога в `src/modules/Settings/index.tsx` |

> ⚠️ Каталог модулей на бэкенде (`hrms-roles-common.js` в `udevs-hrms-reports`)
> ключом `tasks` **ещё не синхронизирован** — сделать при подключении API.

---

## 3. Структура файлов

```
src/modules/Tasks/
├── index.tsx                 # страница: тулбар, листы, фильтры, выбор view, модалки
├── types.ts                  # доменные типы (единственный источник правды)
├── constants.ts              # доступ к справочникам, VIEW_META, форматтеры дат, subtasksOf
├── statusGroups.ts           # три группы статусов: порядок, подписи, нормализация
├── sheets.tsx                # листы задач: useTaskSheets + TaskSheetSelect (см. §9)
├── fileUtils.ts              # чтение файлов в data URL, лимит размера, formatFileSize
│
├── views/
│   ├── BoardView.tsx         # канбан, drag-n-drop между колонками
│   ├── TableView.tsx         # таблица с сортировкой по колонкам
│   ├── TimelineView.tsx      # диаграмма Ганта (неделя/месяц/квартал)
│   └── CalendarView.tsx      # FullCalendar по дедлайнам (месяц/неделя/список)
│
├── components/
│   ├── ViewSwitcher.tsx      # переключатель Доска/Таблица/График/Календарь
│   ├── FiltersBar.tsx        # экспортирует FiltersToolbar (поиск+кнопка) и FiltersPanel
│   ├── TaskCard.tsx          # карточка на доске
│   ├── TaskFormModal.tsx     # создание/редактирование
│   ├── TaskDetailModal.tsx   # детальная карточка (главный экран модуля)
│   ├── SubtasksSection.tsx   # список подзадач + инлайн-создание + открепление
│   ├── badges.tsx            # StatusDot, PriorityIcon, TypeIcon/TypeBadge, аватары, …
│   ├── attachments/
│   │   └── AttachmentsGrid.tsx   # дропзона + сетка миниатюр + лайтбокс
│   ├── fields/               # поля-контролы (см. §6)
│   │   ├── StatusField.tsx
│   │   ├── PriorityField.tsx
│   │   ├── TypeField.tsx
│   │   ├── LocationField.tsx
│   │   ├── AssigneeField.tsx
│   │   ├── DateField.tsx
│   │   ├── ParentField.tsx
│   │   ├── SheetField.tsx
│   │   └── TagsField.tsx
│   └── ui/                   # примитивы модуля (см. §6)
│       ├── Popover.tsx
│       ├── OptionPicker.tsx
│       ├── controls.tsx
│       ├── AutoTextarea.tsx
│       ├── AutoSaveText.tsx
│       └── RichTextField.tsx
```

Вне модуля, но используется им:

```
src/api/services/task.service.ts        # react-query хуки (см. §5)
src/api/services/tasksApi.ts            # клиент методов task_* в reports-шлюзе
src/api/services/taskDirectories.service.ts  # справочники: чтение и CRUD
src/components/form/RichTextEditor.tsx  # общий rich-text редактор (и для Рекрутинга)
src/components/form/richText.ts         # sanitizeRichText / richTextToPlain / isRichTextEmpty
src/components/ui/modal/index.tsx       # общая модалка приложения
src/components/form/ExpandableSearchInput.tsx
```

---

## 4. Доменная модель (`types.ts`)

```ts
// Статусы, приоритеты, типы и теги — справочники компании (правятся в
// «Настройки → Справочники задач»), поэтому в задаче лежат id, а подписи и
// цвета берутся из `TaskDirectories` хелперами из constants.ts.
type TaskStatusGroup = "todo" | "in_progress" | "completed";

interface TaskDirectoryItem {
  id: string;
  title: string;
  color: string;             // "#RRGGBB", "" — не задан
  icon: string;              // ключ lucide (типы и приоритеты)
  group: TaskStatusGroup;    // только у статусов
  isInitial: boolean;        // статус новой задачи, ровно один
  isDefault: boolean;        // приоритет новой задачи, ровно один
  sortOrder: number;
}

interface Task {
  id: string;
  code: string;              // "TASK-001", генерирует сервер
  title: string;
  description: string;       // HTML (санитайзится DOMPurify), не plain text
  typeId: string | null;
  statusId: string | null;
  priorityId: string | null;
  locationId: string | null; // существующий справочник HRMS (`locations`)
  sheetId: string | null;
  assigneeIds: string[];     // НЕСКОЛЬКО исполнителей, не один
  tagIds: string[];
  startDate: string | null;  // ISO-дата "YYYY-MM-DD", без времени
  endDate: string | null;    // фактическое окончание, пишет сервер
  deadline: string | null;   // крайний срок (просрочка считается по нему)
  createdAt: string;         // ISO datetime
  updatedAt: string;         // ISO datetime, обновляется любой записью
  beginAt: string | null;    // начало работ, пишет сервер
  completedAt: string | null;
  parentId: string | null;   // родительская задача
  checklist: ChecklistItem[];
  attachments: TaskAttachment[];
  commentCount: number;      // сами комментарии грузит `task_activity_get`
  order: number;             // позиция внутри колонки доски
}
```

### Группы статусов

Статус принадлежит одной из трёх групп (`statusGroups.ts`), и групп ровно три —
от группы зависят даты, которые проставляет **сервер**, а не форма:

| группа | подпись | что делает при переходе |
|---|---|---|
| `todo` | К выполнению | очищает `beginAt`, `endDate`, `completedAt` |
| `in_progress` | В работе | ставит `beginAt`, если он пустой |
| `completed` | Завершено | ставит `endDate` + `completedAt` (и `beginAt`, если задачу закрыли минуя «В работе») |

Статусов внутри группы сколько угодно — они и дают колонки доски. Колонки идут
в порядке групп: сервис справочников сортирует статусы по группе, затем по
`sortOrder`. «Завершена ли задача» нигде не проверяется по названию — только
`isFinalStatus(directories, statusId)`, то есть `group === "completed"`.

Важные детали:

- **`description` — это HTML.** Любой вывод обязан идти через `sanitizeRichText`,
  любой поиск/усечение — через `richTextToPlain`.
- **`assigneeIds` — массив.** Везде, где нужен «исполнитель», рисуется `AvatarStack`.
  В группировках задача с N исполнителями попадает в строку каждого из них.
- **Подзадач как поля нет.** Подзадачи — это задачи с `parentId === task.id`;
  единственный источник правды — ссылка вверх. Хелперы в `constants.ts`:
  `subtasksOf(tasks, id)` и `descendantIds(tasks, id)` (последний закрывает циклы —
  задача не может стать потомком самой себя, это проверяет и `mockUpdateTask`).
  Удаление родителя **не каскадное**: подзадачи остаются на доске с `parentId: null`.
- **`endDate` ≠ `deadline`.** Полоса на диаграмме Ганта идёт `startDate → endDate`
  (см. `taskDateSpan`), а календарь и признак просрочки (`isTaskOverdue`) смотрят
  только на `deadline`. Легаси-поле `dueDate` мигрируется в `deadline` в `normalize()`.
- **`TaskAttachment.url`** на этапе 1 — `data:`-URL внутри localStorage.
  При появлении бэкенда это будет ссылка на объектное хранилище.
- **`TaskHistoryEntry.text`** — готовая русская фраза, намеренно **безличная и без
  рода**, и со значениями: «статус: «К выполнению» → «В работе»», «дедлайн:
  12.08.2026 → 20.08.2026», «исполнители: добавлены Петров Пётр», «комментарий:
  «…»». Рендерится как `Имя · фраза`, поэтому глаголы прошедшего времени
  («создал/создала») использовать нельзя. Названия в фразу подставляет сервер в
  момент записи — переименование статуса задним числом историю не переписывает.
- `TaskDraft` — то, что отдаёт форма создания/редактирования (без служебных полей).

---

## 5. Слой данных

### Переключатель

`mock/mockConfig.ts` → `TASKS_USE_MOCK = true`. Пока `true`, все вызовы уходят в
`mockApi`; при `false` сервис бросает `notImplemented()`.

### Сервис и хуки — `src/api/services/task.service.ts`

```ts
useTasksQuery()          // { tasks: Task[], employees: TaskEmployee[] }, ключ ["tasks"]
useCreateTask()          // (draft: TaskDraft)
useUpdateTask()          // ({ id, patch: Partial<Task> })
useDeleteTask()          // (id)
useMoveTask()            // ({ id, status, order }) — drag-n-drop доски
useAddTaskComment()      // ({ id, authorId, text })
useAddChecklistItem()    // ({ id, text })
useToggleChecklistItem() // ({ id, itemId })
useDeleteChecklistItem() // ({ id, itemId })
useAddAttachments()      // ({ id, files: NewAttachment[] })
useDeleteAttachment()    // ({ id, attachmentId })
```

Все мутации инвалидируют ключ `["tasks"]`. `useMoveTask` использует `onSettled`
(а не `onSuccess`) намеренно: доска держит собственное состояние колонок во время
перетаскивания, промежуточная запись в кэш заставляла бы карточку прыгать.

**Как подключать реальный бэкенд:** заменить ветки `TASKS_USE_MOCK ? mockX() :
notImplemented()` на вызовы items API / gateway-методов. Сигнатуры хуков менять не
нужно — UI к ним не привязан.

### Mock-хранилище

- Ключ localStorage: `hrms.tasks.mock.v1`.
- `SEED_VERSION` в `seed.ts`: при несовпадении версии данные пересоздаются из сида.
  **Меняешь форму сида — подними версию**, иначе останутся старые данные.
- `normalize()` в `mockDb.ts` добирает недостающие коллекции и мигрирует legacy-поле
  `assigneeId` → `assigneeIds`.
- `saveDb()` возвращает `boolean`: `false` — запись не прошла (обычно квота из-за
  data URL вложений). `mockAddAttachments` на этом откатывает всю пачку, чтобы UI не
  показывал файлы, которые исчезнут после перезагрузки.
- `mockApi.describeChanges()` — единственное место, где рождаются записи истории.

---

## 6. Собственная мини-дизайн-система модуля

Формы задач не используют `react-select`; вместо этого — набор своих контролов.
Если добавляешь новое поле, собирай его из этих кирпичей, а не заново.

### `ui/Popover.tsx`
Обёртка над `@floating-ui/react`: портал, автопереворот, `flip`/`shift`.
Две неочевидные вещи:
- `z-index: 100000` — модалка приложения сидит на `z-99999`;
- Escape перехватывается на capture-фазе и **не доходит** до модалки, поэтому
  Esc закрывает только поповер.

### `ui/OptionPicker.tsx`
Единый список для всех выпадашек: поиск, навигация ↑/↓, Enter, галочка у выбранных,
мульти-режим (`closeOnSelect={false}`), строка «создать «…»» (`onCreate`).

### `ui/controls.tsx`
- `ControlButton` — два варианта: `row` (невидимый до наведения, для сайдбара
  деталей) и `chip` (обведённая «таблетка», для формы создания);
- `SidebarField` — строка «подпись + контрол» в панели «Детали»;
- `FieldSlot` + `ClearButton` — крестик очистки поверх контрола.

### `ui/AutoTextarea.tsx`
Textarea, растущая по контенту. `ResizeObserver` обязателен: первое измерение
внутри только что открытой модалки приходится на нулевую ширину, и без пересчёта
поле залипает на `maxHeight`.

### `ui/AutoSaveText.tsx`
Текст, сохраняющийся по blur (заголовок задачи). Читает значение из DOM-узла, а не
из state: blur может попасть в тот же React-батч, что и последнее нажатие клавиши.

### `ui/RichTextField.tsx`
Описание: режим чтения → клик → редактор → сохранение при уходе фокуса.
Тонкость: клик по неинтерактивному месту (заголовок, отступ модалки) **не снимает
фокус** с `contenteditable`, поэтому дополнительно висит слушатель `mousedown` по
документу; коммит читает черновик из ref, иначе замыкание в слушателе устареет.

### `fields/*`
`StatusField` (варианты `lozenge` / `row` / `chip`), `PriorityField`, `TypeField`,
`AssigneeField` (мульти), `LocationField` (одно значение, выбрать или создать),
`DateField` (инлайн-календарь + пресеты «Сегодня/Завтра/Через неделю»),
`ParentField` (поиск по задачам, сам отсекает себя и своих потомков),
`SheetField` (перенос между листами), `TagsField` (мульти + создание).
Все принимают `variant: "row" | "chip"` и сами рисуют свой триггер.

---

## 7. Экраны

### Страница (`index.tsx`)
Тулбар: `ViewSwitcher` и селектор листа (`TaskSheetSelect`) слева; справа поиск,
кнопка фильтра (`FiltersToolbar`) и «Новая задача». Фильтры живут в раскрывающейся
полосе `FiltersPanel` под тулбаром (тот же паттерн, что на странице KPI); на кнопке —
счётчик активных фильтров. Активный view хранится в query-параметре `?view=`.

Данные сужаются в два шага: сначала активный лист (`sheetIdOf(task.id) ===
activeSheetId`), затем клиентские фильтры в `useMemo` — статус, приоритет, тип,
локация, исполнитель (`assigneeIds.includes`) и текстовый поиск по коду, названию,
описанию, локации и тегам. Во views уходит и полный список `allTasks` — счётчики
подзадач не должны зависеть от фильтров.

### Детальная карточка (`TaskDetailModal.tsx`)
Центральная модалка, две колонки.
- Слева: хлебная крошка родителя (если задача — подзадача), заголовок
  (автосохранение по blur), описание (rich text), вложения, чек-лист с прогрессом,
  **подзадачи**, вкладки «Комментарии / История».
- Справа: кнопка статуса-лозенга и карточка «Детали» (тип, исполнители, приоритет,
  локация, начало, окончание, дедлайн, родитель, лист, теги) — **каждое изменение
  сохраняется сразу**, кнопки «Сохранить» нет. Ниже — «Создана / Обновлена /
  Завершена».
- Удаление — в меню «…» в шапке; в подтверждении отдельно сказано, что подзадачи
  не удаляются.

### Создание/редактирование (`TaskFormModal.tsx`)
Крупное поле названия, редактор описания, ряд чипов-атрибутов, сворачиваемый блок
вложений. `⌘/Ctrl+Enter` — отправка. Чекбокс «Создать ещё одну» оставляет модалку
открытой и сохраняет контекст (колонка, приоритет, теги).
`onSubmit` возвращает `Promise<boolean>`; закрывать модалку решает она сама.

### Views
- **BoardView** — колонки по статусам, `@hello-pangea/dnd`. Внутри колонки у карточек
  `mb-2.5` вместо `gap`: библиотека считает плейсхолдер по margin и о flex-gap не знает.
- **TableView** — сортировка по коду, названию, типу, статусу, приоритету,
  исполнителю, локации, началу, окончанию, дедлайну и дате обновления.
- **TimelineView** — Ганта. Одна задача = одна строка, липкая левая колонка,
  масштабы неделя/месяц/квартал (в квартале колонки — недели), линия «сегодня»,
  прогресс чек-листа тёмной заливкой внутри полосы, группировка по исполнителям.
- **CalendarView** — FullCalendar. Задача стоит **только на дате своего дедлайна**
  (не диапазон). `dayMaxEvents={3}` + попап «+N ещё» для дней с большим числом задач.

---

## 8. Вложения и картинки

Два независимых механизма:

1. **Вложения задачи** (`attachments/AttachmentsGrid.tsx`, `fileUtils.ts`) —
   drag-n-drop или выбор файла, лимит `MAX_ATTACHMENT_SIZE` = 3 МБ, миниатюры,
   лайтбокс для изображений, скачивание, удаление. Битые картинки автоматически
   падают в плитку файла.
2. **Картинки внутри описания** (`components/form/RichTextEditor.tsx`) —
   кнопка в тулбаре, вставка из буфера (Cmd+V) и перетаскивание. Лимит
   `MAX_INLINE_IMAGE_SIZE` = 1.5 МБ — жёстче, потому что описание уходит в каждый
   ответ списка задач. В `ALLOWED_ATTR` санитайзера добавлены `src/alt/title/
   width/height`; DOMPurify пропускает `data:` только для `<img>`.

---

## 9. Листы (`sheets.tsx`)

Тот же механизм, что листы KPI (`src/modules/KPI/sheets.tsx`), вплоть до разметки
выпадашки: выбор листа, «+ Добавить», переименование по двойному клику, цвет,
перетаскивание порядка (`@dnd-kit`) и удаление с подтверждением.

```ts
useTaskSheets(companyId) → {
  sheets, activeSheetId, defaultSheetId, isDefaultActive, assignments,
  selectSheet, addSheet, renameSheet, setSheetColor, deleteSheet, reorderSheets,
  moveTasksToSheet(taskIds, sheetId), clearTaskAssignment(taskIds), sheetIdOf(taskId),
}
```

Отличия от KPI и неочевидные места:

- **Только localStorage** (`tasks-sheets::<companyId>`), серверного режима нет —
  у задач ещё нет бэкенда. Когда он появится, файл повторяет путь KPI: гидратация
  из БД + дебаунс-сохранение, при неприменённой миграции — откат на localStorage.
- Задачи **без явной привязки** принадлежат `defaultSheetId`, поэтому появление
  листов не «прячет» существующие задачи. Удаление листа возвращает его задачи в
  лист по умолчанию, сами задачи не трогает.
- Новая задача привязывается к **активному** листу (иначе она исчезла бы сразу
  после создания), подзадача — к листу родителя.
- Перенос задачи между листами тянет **всю ветку подзадач** (`descendantIds`),
  иначе подзадачи выпали бы из листа, где живёт их родитель.

---

## 10. Известные ограничения / что дальше

- Бэкенда нет: `TASKS_USE_MOCK = true`, всё в localStorage. Листы — тоже
  (серверных `sheets_get/save`, как у KPI, пока нет).
- Нет авторства: «текущий пользователь» — первый сотрудник из сида
  (`currentAuthorId()` в `mockApi.ts`).
- Ключ `tasks` не заведён в бэкенд-каталоге ролей.
- Описания в сид-данных — простой текст. Он рендерится корректно, но при переезде
  на бэкенд старые записи стоит один раз обернуть в `<p>`, иначе потеряются переносы.
- Комментарии — только текст, без вложений и упоминаний.
- Подзадачи — один уровень в UI (дерево вложенное, но карточка показывает только
  прямых детей); нет связей «блокирует/связана», уведомлений и повторяющихся задач.

---

## 11. Как проверить локально

`AccessGate` требует роль через `hrms_user_access`. Самый простой обход для UI-проверки —
положить в localStorage запись `ayva-auth` с `isAuth: true` и пользователем **без**
`guid`: тогда запрос доступа не запускается (`enabled: false`) и гейт пропускает.

```js
localStorage.setItem("ayva-auth", JSON.stringify({
  isAuth: true, token: null, refreshToken: null,
  user: { first_name: "Тест", second_name: "Тестов" },
  user_data: { first_name: "Тест", second_name: "Тестов" },
  companyId: null,
}));
```

Сброс демо-данных задач: `localStorage.removeItem("hrms.tasks.mock.v1")` + перезагрузка.
Сброс листов: удалить ключи с префиксом `tasks-sheets::`.

> Проверка типов: `npx tsc -p tsconfig.app.json` в этом репозитории падает на
> `TS2688` (не установлен `@types/react-datepicker`) и из-за этой ошибки **не
> проверяет файлы вообще**. Для реальной проверки нужен временный tsconfig с
> `"compilerOptions": { "types": [] }`.
