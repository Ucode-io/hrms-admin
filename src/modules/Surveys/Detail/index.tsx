import { useMemo, useState } from "react";

import { CheckCircle2, CircleDashed, ClipboardList, Pencil, Users, X } from "lucide-react";
import { useNavigate, useParams } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { parseSurveyBody, useSurveyQuery } from "../../../api/services/survey.service";
import { useTranslation } from "../../../i18n";
import {
  type SurveyResultResponse,
  useSurveyResultsQuery,
} from "../../../api/services/surveyEmployee.service";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-gray-100 text-gray-600" },
  active: { label: "Активный", className: "bg-success-50 text-success-700" },
  archived: { label: "Архив", className: "bg-warning-50 text-warning-700" },
};

type SurveyQuestion = {
  name: string;
  title: string;
  type: string;
  choices: Array<{ value: string; text: string }>;
};

const normalizeChoice = (choice: unknown): { value: string; text: string } | null => {
  if (typeof choice === "string" || typeof choice === "number") {
    return { value: String(choice), text: String(choice) };
  }
  if (choice && typeof choice === "object") {
    const obj = choice as Record<string, unknown>;
    const value = obj.value ?? obj.text;
    if (value === undefined || value === null) return null;
    const text = obj.text ?? obj.value;
    return { value: String(value), text: typeof text === "string" ? text : String(value) };
  }
  return null;
};

/** Flattens SurveyJS pages/panels into a plain ordered question list. */
const extractQuestions = (body: Record<string, unknown>): SurveyQuestion[] => {
  const questions: SurveyQuestion[] = [];

  const walk = (elements: unknown) => {
    if (!Array.isArray(elements)) return;

    for (const element of elements) {
      if (!element || typeof element !== "object") continue;
      const el = element as Record<string, unknown>;
      const type = String(el.type || "");

      if (type === "panel") {
        walk(el.elements);
        continue;
      }

      const name = typeof el.name === "string" ? el.name : "";
      if (!name) continue;

      const rawTitle = el.title;
      const title =
        typeof rawTitle === "string"
          ? rawTitle
          : rawTitle && typeof rawTitle === "object" && typeof (rawTitle as any).default === "string"
            ? (rawTitle as any).default
            : name;

      const choices = Array.isArray(el.choices)
        ? el.choices.map(normalizeChoice).filter((c): c is { value: string; text: string } => c !== null)
        : [];

      questions.push({ name, title, type, choices });
    }
  };

  const pages = Array.isArray(body.pages) ? body.pages : [];
  for (const page of pages) {
    if (page && typeof page === "object") {
      walk((page as Record<string, unknown>).elements);
    }
  }

  return questions;
};

const answerToStrings = (value: unknown): string[] => {
  if (value === undefined || value === null) return [];
  if (Array.isArray(value)) return value.map((item) => String(item));
  if (typeof value === "object") return [JSON.stringify(value)];
  return [String(value)];
};

const formatDateTime = (value: string | null): string => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const CHOICE_TYPES = new Set(["radiogroup", "dropdown", "checkbox", "tagbox", "boolean", "rating"]);

export default function SurveyDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const surveyGuid = id || "";

  const { data: survey, isLoading: isSurveyLoading } = useSurveyQuery(surveyGuid);
  const { data: results, isLoading: isResultsLoading } = useSurveyResultsQuery(surveyGuid);

  const [answersFor, setAnswersFor] = useState<SurveyResultResponse | null>(null);

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Опросники", to: "/surveys" },
        { label: String(survey?.title || "Детали"), to: "#" },
      ],
      [survey?.title]
    )
  );

  const status = useMemo(() => {
    const raw = Array.isArray(survey?.status)
      ? String(survey?.status?.[0] || "")
      : String(survey?.status || "");
    return STATUS_LABELS[raw] || STATUS_LABELS.draft;
  }, [survey?.status]);

  const questions = useMemo(
    () => (survey ? extractQuestions(parseSurveyBody(survey.body)) : []),
    [survey]
  );

  const employees = results?.employees || [];
  const responses = results?.responses || [];
  const assignedCount = results?.assigned_count || 0;
  const completedCount = results?.completed_count || 0;
  const completionPercent = assignedCount > 0 ? Math.round((completedCount / assignedCount) * 100) : 0;

  // Per-question aggregation: for choice-like questions count each option,
  // for everything else collect the raw answers.
  const questionStats = useMemo(() => {
    return questions.map((question) => {
      const rawAnswers: Array<{ full_name: string; values: string[] }> = [];
      const counts = new Map<string, number>();
      let answeredCount = 0;

      for (const response of responses) {
        const values = answerToStrings(response.answers[question.name]);
        if (values.length === 0) continue;
        answeredCount += 1;
        rawAnswers.push({ full_name: response.full_name, values });
        for (const value of values) {
          counts.set(value, (counts.get(value) || 0) + 1);
        }
      }

      const isChoice = CHOICE_TYPES.has(question.type);
      const options: Array<{ label: string; count: number }> = [];

      if (isChoice) {
        if (question.type === "boolean") {
          options.push(
            { label: "Да", count: counts.get("true") || 0 },
            { label: "Нет", count: counts.get("false") || 0 }
          );
        } else if (question.choices.length > 0) {
          for (const choice of question.choices) {
            options.push({ label: choice.text, count: counts.get(choice.value) || 0 });
          }
          // answers outside of the configured choices (e.g. "other")
          for (const [value, count] of counts) {
            if (!question.choices.some((c) => c.value === value)) {
              options.push({ label: value, count });
            }
          }
        } else {
          for (const [value, count] of counts) {
            options.push({ label: value, count });
          }
        }
      }

      return { question, answeredCount, options, rawAnswers, isChoice };
    });
  }, [questions, responses]);

  const isLoading = isSurveyLoading || isResultsLoading;

  return (
    <>
      <PageMeta
        title={`${String(survey?.title || "Опросник")} | Опросы`}
        description="Статистика и результаты опросника"
      />

      <div className="space-y-4">
        {/* Header card */}
        <div className="rounded-2xl border border-gray-200 bg-white px-6 py-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <ClipboardList size={22} />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="truncate text-lg font-semibold text-gray-900">
                    {String(survey?.title || (isSurveyLoading ? "Загрузка..." : "Опросник"))}
                  </h1>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
                  >
                    {status.label}
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-gray-500">
                  <span className="inline-flex items-center gap-1">
                    <Users size={13} />
                    назначено {assignedCount}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <CheckCircle2 size={13} />
                    прошли {completedCount}
                  </span>
                </div>
              </div>
            </div>

            <Button
              variant="outline"
              className="h-10"
              startIcon={<Pencil size={15} />}
              onClick={() => navigate(`/surveys/${surveyGuid}/edit`)}
            >
              Изменить
            </Button>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Users size={16} /> Назначено
            </div>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{assignedCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CheckCircle2 size={16} /> Прошли
            </div>
            <p className="mt-1 text-2xl font-semibold text-gray-900">{completedCount}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <CircleDashed size={16} /> Заполняемость
            </div>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full bg-brand-500 transition-all"
                  style={{ width: `${completionPercent}%` }}
                />
              </div>
              <span className="text-sm font-semibold text-gray-900">{completionPercent}%</span>
            </div>
          </div>
        </div>

        {/* Employees table */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">Сотрудники</h2>
          </div>
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Сотрудник
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Статус
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Дата прохождения
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Ответы
                  </TableCell>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-gray-100">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`detail-skeleton-${index}`}>
                      {Array.from({ length: 4 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex} className="px-4 py-4">
                          <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="px-4 py-10 text-center text-sm text-gray-500">
                      Сотрудники не назначены
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => {
                    const response = responses.find(
                      (item) => item.user_base_id === employee.user_base_id
                    );

                    return (
                      <TableRow key={employee.user_base_id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="px-4 py-3 text-sm text-gray-800">
                          {employee.full_name}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          {employee.completed ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-medium text-success-700">
                              <CheckCircle2 size={12} /> Пройден
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-500">
                              <CircleDashed size={12} /> Не пройден
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-700">
                          {formatDateTime(employee.completed_at)}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-right">
                          {response ? (
                            <button
                              type="button"
                              onClick={() => setAnswersFor(response)}
                              className="text-sm font-medium text-brand-500 transition hover:text-brand-600"
                            >
                              Посмотреть
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Per-question statistics */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-4 py-3">
            <h2 className="text-base font-semibold text-gray-900">Статистика по вопросам</h2>
          </div>

          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="h-20 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : questions.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-gray-500">
              В опроснике нет вопросов
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {questionStats.map(({ question, answeredCount, options, rawAnswers, isChoice }, index) => (
                <div key={question.name} className="px-4 py-4">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <p className="text-sm font-medium text-gray-900">
                      {index + 1}. {question.title}
                    </p>
                    <span className="shrink-0 text-xs text-gray-400">
                      Ответили: {answeredCount} из {completedCount}
                    </span>
                  </div>

                  {isChoice ? (
                    <div className="space-y-1.5">
                      {options.map((option) => {
                        const percent =
                          answeredCount > 0 ? Math.round((option.count / answeredCount) * 100) : 0;
                        return (
                          <div key={option.label} className="flex items-center gap-3">
                            <span className="w-56 shrink-0 truncate text-sm text-gray-700" title={option.label}>
                              {option.label}
                            </span>
                            <div className="h-2 flex-1 overflow-hidden rounded-full bg-gray-100">
                              <div
                                className="h-full rounded-full bg-brand-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                            <span className="w-16 shrink-0 text-right text-xs text-gray-500">
                              {option.count} ({percent}%)
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : rawAnswers.length === 0 ? (
                    <p className="text-sm text-gray-400">Ответов нет</p>
                  ) : (
                    <ul className="space-y-1.5">
                      {rawAnswers.map((answer) => (
                        <li key={answer.full_name + answer.values.join()} className="rounded-lg bg-gray-50 px-3 py-2 text-sm">
                          <span className="text-gray-800">{answer.values.join(", ")}</span>
                          <span className="ml-2 text-xs text-gray-400">— {answer.full_name}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Single employee answers modal */}
      <Modal
        isOpen={Boolean(answersFor)}
        onClose={() => setAnswersFor(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[640px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
          <div className="min-w-0">
            <h3 className="truncate text-lg font-semibold text-gray-900">
              {answersFor?.full_name}
            </h3>
            <p className="text-xs text-gray-500">
              Пройден: {formatDateTime(answersFor?.completed_at || null)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setAnswersFor(null)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto px-4 py-4">
          {questions.map((question, index) => {
            const values = answersFor ? answerToStrings(answersFor.answers[question.name]) : [];
            const choiceTexts = values.map((value) => {
              const choice = question.choices.find((c) => c.value === value);
              if (choice) return choice.text;
              if (question.type === "boolean") return value === "true" ? "Да" : value === "false" ? "Нет" : value;
              return value;
            });

            return (
              <div key={question.name} className="rounded-xl border border-gray-100 p-3">
                <p className="mb-1 text-sm font-medium text-gray-900">
                  {index + 1}. {question.title}
                </p>
                {choiceTexts.length === 0 ? (
                  <p className="text-sm text-gray-400">Нет ответа</p>
                ) : (
                  <p className="text-sm text-gray-700">{choiceTexts.join(", ")}</p>
                )}
              </div>
            );
          })}
        </div>
      </Modal>
    </>
  );
}
