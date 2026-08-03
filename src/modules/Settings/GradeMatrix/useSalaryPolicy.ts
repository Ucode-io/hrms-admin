import { useCallback } from "react";
import {
  normalizeGradeSalaryPolicy,
  useMainSettingsQuery,
  type GradeSalaryPolicy,
} from "../../../api/services/mainSettings.service";
import { useGradeMatrixQuery } from "../../../api/services/gradeMatrix.service";
import { formatMoney, formatTenure } from "./constants";
import type { GradeMatrixResult } from "./types";

/** Что именно разошлось с матрицей: грейд должности или сумма оклада. */
export type GradeIssue = { kind: "level" | "salary"; message: string };

export type GradeCheck = {
  /** `skip` — сверять не с чем (режим выключен или грейдов у должности нет). */
  status: "skip" | "ok" | "mismatch";
  issues: GradeIssue[];
};

const SKIP: GradeCheck = { status: "skip", issues: [] };
const OK: GradeCheck = { status: "ok", issues: [] };

export type GradeCheckInput = {
  positionId?: string | null;
  levelId?: string | null;
  salary?: number | null;
};

/**
 * Сверка должности сотрудника с матрицей грейдов.
 *
 * Проверяем две вещи подряд:
 *   • уровень опыта — он должен стоять в лестнице этой должности;
 *   • оклад — он не должен превышать потолок той ступени, на которой стоит
 *     уровень. Потолок это верхняя граница, а не фиксированная сумма, поэтому
 *     платить меньше можно.
 *
 * Если должности нет в матрице или у неё не проставлено ни одного грейда,
 * проверка молчит даже в строгом режиме: матрицу заполняют постепенно, и
 * запрещать назначения там, где лестница ещё не заведена, значило бы остановить
 * работу с половиной должностей.
 */
/** Та же проверка без React — вся логика ветвлений живёт здесь. */
export const evaluateGradeCheck = (
  matrix: GradeMatrixResult | null | undefined,
  policy: GradeSalaryPolicy,
  input: GradeCheckInput
): GradeCheck => {
  if (policy === "off" || !matrix || !input.positionId) return SKIP;

  const row = matrix.rows.find(
    (item) => item.type === "position" && item.positionId === input.positionId
  );
  if (!row) return SKIP;

  const levelCells = row.cells.filter((cell) => cell.experienceLevelId);
  if (levelCells.length === 0) return SKIP;

  const levelTitle = (id: string) => matrix.levels.find((item) => item.id === id)?.title ?? "—";
  const ladder = levelCells
    .map((cell) => levelTitle(cell.experienceLevelId as string))
    .join(", ");

  if (!input.levelId) {
    return {
      status: "mismatch",
      issues: [
        {
          kind: "level",
          message: `Уровень не указан, а для должности «${row.title}» в матрице грейдов заданы ступени: ${ladder}.`,
        },
      ],
    };
  }

  const cell = levelCells.find((item) => item.experienceLevelId === input.levelId);
  if (!cell) {
    return {
      status: "mismatch",
      issues: [
        {
          kind: "level",
          message: `Уровень ${levelTitle(input.levelId)} не задан для должности «${row.title}» — в матрице у неё ступени: ${ladder}.`,
        },
      ],
    };
  }

  const column = matrix.columns.find((item) => item.id === cell.columnId);
  if (!column || column.maxSalary === null || !input.salary) return OK;
  if (input.salary <= column.maxSalary) return OK;

  return {
    status: "mismatch",
    issues: [
      {
        kind: "salary",
        message: `Оклад ${formatMoney(input.salary)} выше потолка ступени ${levelTitle(
          input.levelId
        )} — ${formatMoney(column.maxSalary)} (стаж ${formatTenure(column.minMonths)}).`,
      },
    ],
  };
};

export const useSalaryPolicy = () => {
  const { data: settings } = useMainSettingsQuery();
  const policy: GradeSalaryPolicy = normalizeGradeSalaryPolicy(settings?.grade_salary_policy);

  // Матрицу тянем, только когда она нужна для проверки.
  const { data: matrix } = useGradeMatrixQuery({ enabled: policy !== "off" });

  const check = useCallback(
    (input: GradeCheckInput): GradeCheck => evaluateGradeCheck(matrix, policy, input),
    [matrix, policy]
  );

  return {
    policy,
    check,
    /** В строгом режиме расхождение с матрицей не даёт сохранить запись. */
    isBlocking: policy === "required",
    /** Цвет, которым расхождение показывается в карточке сотрудника. */
    tone: policy === "required" ? ("error" as const) : ("warning" as const),
  };
};
