# AI Guide: Items API, Aggregation, Batch Ops, Filters, Pagination

Этот файл для AI-ассистентов в проекте. Используйте его как единый стандарт при работе с `items` API.

## 1) Базовые правила проекта

1. Базовый клиент: `src/api/httpRequest.ts`.
2. `baseURL`: `https://api.admin.u-code.io/`.
3. `project-id` уже добавляется в `params` клиента по умолчанию.
4. `Environment-Id` добавляется в request interceptor.
5. Авторизация:
   - если есть `token` -> `Authorization: Bearer <token>`
   - иначе -> `Authorization: API-KEY` + `X-Api-Key`
6. При `401`/`403` response interceptor делает `authStore.logout()`.

## 2) Items API (обычный CRUD)

### List

```ts
httpRequest.get(`/v2/items/${collection}`, { params: { limit, offset, search } });
```

Или через `data` (сложные фильтры, как в проекте):

```ts
import encodeJsonToUrlParam from "src/utils/encodeJsonToUrlParam";

httpRequest.get(`/v2/items/${collection}`, {
  params: {
    data: encodeJsonToUrlParam({
      limit: 20,
      offset: 0,
      search: "ceo",
      user_base_id: "...",
    }),
  },
});
```

### Get by guid

```ts
httpRequest.get(`/v2/items/${collection}/${guid}`, { params: { with_relations: true } });
```

### Create

```ts
httpRequest.post(`/v2/items/${collection}`, { data: payload });
```

### Update

Предпочтительно:

```ts
httpRequest.put(`/v2/items/${collection}/${guid}`, { data: { ...payload, guid } });
```

Fallback, если backend не принимает `/:guid`:

```ts
httpRequest.put(`/v2/items/${collection}`, { data: { ids: [guid], ...payload, guid } });
```

### Delete

Предпочтительно (массовый стиль, используется в проекте):

```ts
httpRequest.delete(`/v2/items/${collection}`, { data: { ids: [guid] } });
```

Fallback:

```ts
httpRequest.delete(`/v2/items/${collection}/${guid}`);
```

## 3) Aggregation API

Использовать для:
1. SQL-like `where`
2. `JOIN`
3. контролируемой выборки по диапазонам дат
4. обхода лимитов обычного `items` list через пагинацию батчами

### Вариант A: по collection

`POST /v2/items/{collection}/aggregation`

```ts
httpRequest.post(`/v2/items/${collection}/aggregation`, {
  data: {
    operation: "SELECT",
    table: collection,
    columns: ["guid", "title", "created_at"],
    where: "deleted_at IS NULL",
    order_by: ["created_at DESC"],
    limit: 200,
    offset: 0,
  },
  is_cached: true,
});
```

### Вариант B: store aggregation (для JOIN)

`POST /v2/items/store/aggregation`

```ts
httpRequest.post("/v2/items/store/aggregation", {
  data: {
    operation: "SELECT",
    table: "absences a LEFT JOIN absence_policies ap ON ap.guid = a.absence_policies_id",
    columns: [
      "a.guid",
      "a.user_base_id",
      "a.date_from",
      "a.date_to",
      "ap.title AS absence_policy_title",
      "ap.icon AS absence_policy_icon",
      "ap.color AS absence_policy_color",
    ],
    where: "a.user_base_id IN ('...') AND a.date_from <= '2026-03-31' AND a.date_to >= '2026-03-01'",
    order_by: ["a.date_from ASC", "a.created_at DESC"],
    limit: 200,
    offset: 0,
  },
  is_cached: true,
});
```

## 4) Batch APIs (multiple-*)

### multiple-insert

`POST /v2/items/{collection}/multiple-insert`

```ts
httpRequest.post(`/v2/items/${collection}/multiple-insert`, {
  items: [
    { positions_id: "...", experience_levels_id: "..." },
    { positions_id: "...", experience_levels_id: "..." },
  ],
});
```

Fallback: цикл обычных `POST /v2/items/{collection}`.

### multiple-update

`PUT /v2/items/{collection}/multiple-update`

```ts
httpRequest.put(`/v2/items/${collection}/multiple-update`, {
  data: { status: ["approved"] },
  ids: ["guid-1", "guid-2"],
});
```

Если этот endpoint недоступен, fallback:
1. `PUT /v2/items/{collection}` с `data: { ids: [...], ...payload }`
2. или цикл `PUT /v2/items/{collection}/{guid}`.

### multiple-delete

Предпочтительно:
`DELETE /v2/items/{collection}` с `data: { ids: [...] }` (активно используется в проекте).

Если backend поддерживает explicit endpoint:
`DELETE /v2/items/{collection}/multiple-delete` с `data: { ids: [...] }`.

Fallback: цикл `DELETE /v2/items/{collection}/{guid}`.

## 5) Filters (как формировать корректно)

### Простой фильтр (query params)

```ts
params: {
  limit: 20,
  offset: 0,
  search: "finance",
  departments_id: "<guid>",
  with_relations: true,
}
```

### Сложный фильтр через `data`

```ts
params: {
  data: encodeJsonToUrlParam({
    limit: 20,
    offset: 0,
    search: "finance",
    user_base_id: "<guid>",
    status: ["pending"],
  }),
}
```

### SQL where в aggregation

1. Всегда экранировать одинарные кавычки в значениях:
   - `value.replace(/'/g, "''")`
2. Для `IN` собирать список только из валидных непустых ID.
3. Для дат использовать четкий диапазон:
   - `date_from <= '<to>' AND date_to >= '<from>'`

## 6) Pagination (обязательно батчами)

У `items` API есть максимальный лимит на один запрос. Не ставить огромные `limit` (например, `3000`) в надежде получить все данные.

Используйте цикл:
1. `limit = 100..200` (безопасный батч)
2. `offset = 0`
3. после каждого запроса:
   - если пришло `0` записей -> stop
   - если пришло меньше `limit` -> stop
   - если есть `count` и уже набрали `count` -> stop
   - иначе `offset += chunk.length`
4. добавить `maxRequests` guard (например, 100/200), чтобы избежать бесконечного цикла

Пример:

```ts
const limit = 200;
const maxRequests = 100;
let offset = 0;
const allRows = [];

for (let i = 0; i < maxRequests; i += 1) {
  const chunk = await fetchChunk({ limit, offset });
  if (!chunk.length) break;
  allRows.push(...chunk);
  if (chunk.length < limit) break;
  offset += chunk.length;
}
```

## 7) Нормализация ответа

Из-за разных форм ответа API и interceptor-а, проверять данные в таком порядке:
1. `response`
2. `data`
3. `data.data`

Стандарт в проекте: писать нормализатор и приводить результат к:

```ts
type ListResponse<T> = {
  count: number;
  response: T[];
};
```

### Какая структура response приходит фактически

#### 1. Raw axios response (до interceptor)

Обычно API возвращает обертку вида:

```json
{
  "status": "OK",
  "description": "The request has succeeded",
  "data": {
    "data": {
      "count": 20,
      "response": []
    },
    "project_id": "..."
  },
  "custom_message": ""
}
```

Для aggregation часто бывает:

```json
{
  "status": "OK",
  "data": {
    "data": {
      "data": []
    }
  }
}
```

#### 2. Что возвращает `httpRequest` после interceptor

`src/api/httpRequest.ts` возвращает:
1. `response.data.data.data` (если есть)
2. иначе `response.data.data`
3. иначе `response.data`

То есть в коде сервисов вы получаете уже "срезанный" объект. Примеры:

1. List endpoint -> обычно `{ count, response }`
2. Aggregation endpoint -> часто `{ data: [...] }`
3. Иногда сразу массив `[...]`

#### 3. Рекомендуемая универсальная распаковка

В сервисах делайте extraction так:
1. если `Array.isArray(res)` -> это rows
2. иначе если `Array.isArray(res.response)` -> rows = `res.response`
3. иначе если `Array.isArray(res.data)` -> rows = `res.data`
4. иначе если `Array.isArray(res.data?.data)` -> rows = `res.data.data`
5. иначе rows = `[]`

И отдельно:
1. `count = Number(res.count || rows.length || 0)`
2. возвращать в общем формате `{ count, response: rows }`

## 8) Практический чеклист для AI

Перед реализацией любого списка:
1. Есть ли `search`?
2. Нужны ли relations (`with_relations`)?
3. Нужен ли `aggregation` (JOIN/range/IN)?
4. Реализована ли батчевая pagination, если нужен полный набор?
5. Есть ли fallback на альтернативный endpoint?
6. Корректно ли удаление/обновление нескольких записей через `ids`?

Если сомневаетесь: сначала делайте безопасный вариант (batched + fallback), потом оптимизируйте.

## 9) File Upload API

Для загрузки файлов на CDN используйте `/v1/files/folder_upload`. Удобнее всего использовать готовый hook `useUploadFile()` из `src/api/services/file-upload.service.ts`.

### Базовые параметры
1. **URL**: `https://api.admin.u-code.io/v1/files/folder_upload`
2. **Method**: `POST`
3. **Headers**:
   - `Authorization: Bearer <token>`
   - `environment-id`: (берется из константы)
   - `Resource-Id`: (берется из константы)
   - `Content-Type`: `multipart/form-data` (браузер ставит сам)
4. **Params**:
   - `folder_name` (по умолчанию `"Media"`)
   - `format` (опционально)
5. **Body**: `FormData` с полем `file`

### Пример использования через Hook (React)

```ts
import { useUploadFile } from "src/api/services/file-upload.service";

export const MyComponent = () => {
  const uploadMutation = useUploadFile({ folder: "Users" });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      // Возвращает полную публичную ссылку: https://cdn.u-code.io/<link>
      const cdnUrl = await uploadMutation.mutateAsync(file);
      console.log("File uploaded:", cdnUrl);
    } catch (error) {
      console.error("Upload error:", error);
    }
  };

  return <input type="file" onChange={handleFileChange} />;
};
```

### Формат ответа сервера (внутри хука)

Сервер возвращает JSON с полем `link`, которое хук автоматически склеивает с константой `https://cdn.u-code.io`.

```json
{
  "status": "OK",
  "data": {
    "data": {
      "link": "some-random-id/filename.jpg"
    }
  }
}
```
