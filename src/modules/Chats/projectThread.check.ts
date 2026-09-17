// Самопроверка проектора. Тест-раннера в админке нет и заводить его ради одного
// файла дорого, поэтому проверка запускается голым node:
//
//   node --experimental-strip-types src/modules/Chats/projectThread.check.ts
//
// Ломается ровно на том, ради чего проектор существует: служебные блоки не
// должны утечь в реплики человека.

import assert from "node:assert/strict";
import { lastSaid, projectThread } from "./projectThread.ts";

const thread = [
  { role: "user", content: "сколько у меня отпуска" },
  {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "надо посмотреть баланс" },
      { type: "text", text: "Смотрю." },
      { type: "tool_use", id: "t1", name: "get_items", input: { table: "leaves" } },
    ],
  },
  {
    role: "user",
    content: [
      {
        type: "tool_result",
        tool_use_id: "t1",
        content: "<untrusted-data>{\"ok\":true}</untrusted-data>",
      },
    ],
  },
  { role: "assistant", content: [{ type: "text", text: "Осталось 12 дней." }] },
];

const messages = projectThread(thread);

assert.deepEqual(
  messages.map((m) => `${m.role}:${m.text}`),
  [
    "user:сколько у меня отпуска",
    "assistant:Смотрю.",
    "tool:get_items",
    "assistant:Осталось 12 дней.",
  ]
);

// Тред приходит и строкой тоже — ucode отдаёт jsonb как придётся.
assert.equal(projectThread(JSON.stringify(thread)).length, messages.length);

// Мусор не роняет страницу.
assert.deepEqual(projectThread("не json"), []);
assert.deepEqual(projectThread(null), []);

// Превью берёт последнюю живую реплику, а не имя инструмента.
assert.equal(lastSaid(messages), "Осталось 12 дней.");
assert.equal(
  lastSaid(projectThread([{ role: "assistant", content: [{ type: "tool_use", name: "get_items" }] }])),
  ""
);

console.log("projectThread: ok");
