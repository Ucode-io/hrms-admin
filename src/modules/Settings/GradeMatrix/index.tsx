import { useMemo, useState } from "react";
import { Link } from "react-router";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { Info, LayoutGrid, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Spinner from "../../../components/ui/Spinner";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  isPendingId,
  useDeleteMatrixColumn,
  useDeleteMatrixRow,
  useGradeMatrixQuery,
  useReorderMatrix,
  useSaveMatrixCell,
  useSaveMatrixColumn,
  useSaveMatrixRow,
} from "../../../api/services/gradeMatrix.service";
import {
  STICKY_TITLE,
  TITLE_CELL,
  filterGroups,
  groupRows,
  usedDepartmentIds,
  usedPositionIds,
} from "./constants";
import AddRowLine from "./components/AddRowLine";
import ColumnHead from "./components/ColumnHead";
import MatrixRowLine from "./components/MatrixRowLine";
import type { CellDraft } from "./types";

type PendingDelete = { kind: "column" | "row"; id: string; title: string; note: string };

export default function GradeMatrixSettingsPage() {
  const { data, isLoading, isError, error } = useGradeMatrixQuery();

  const saveColumn = useSaveMatrixColumn();
  const deleteColumn = useDeleteMatrixColumn();
  const saveRow = useSaveMatrixRow();
  const deleteRow = useDeleteMatrixRow();
  const saveCell = useSaveMatrixCell();
  const reorder = useReorderMatrix();

  const [search, setSearch] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(null);

  const columns = useMemo(() => data?.columns ?? [], [data?.columns]);
  const rows = useMemo(() => data?.rows ?? [], [data?.rows]);
  const levels = useMemo(() => data?.levels ?? [], [data?.levels]);
  const positions = useMemo(() => data?.positions ?? [], [data?.positions]);
  const departments = useMemo(() => data?.departments ?? [], [data?.departments]);

  const groups = useMemo(() => filterGroups(groupRows(rows), search), [rows, search]);
  const freePositions = useMemo(() => {
    const used = usedPositionIds(rows);
    return positions.filter((position) => !used.has(position.id));
  }, [positions, rows]);
  const freeDepartments = useMemo(() => {
    const used = usedDepartmentIds(rows);
    return departments.filter((department) => !used.has(department.id));
  }, [departments, rows]);

  const isConfigured = Boolean(data?.isConfigured);

  /**
   * Номер ступени считается справа налево: правая колонка — первая ступень, и
   * рост идёт влево, туда же добавляются новые. Нумеровать слева направо значило
   * бы перенумеровывать всю лестницу при каждой новой ступени.
   */
  const stepNumber = (index: number) => columns.length - index;

  const sensors = useSensors(
    // 6px — чтобы клик по ячейке открывал выбор, а не начинал перетаскивание.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );

  /**
   * Правки применяются к экрану сразу (оптимистично в сервисе), поэтому здесь
   * остаётся только сообщить, если сервер их не принял: состояние к этому
   * моменту уже откатилось, и человеку нужно понять, что именно пропало.
   */
  const notifyError = (fallback: string) => (mutationError: unknown) => {
    toast.error(
      mutationError instanceof Error && mutationError.message ? mutationError.message : fallback
    );
  };

  const handleCellSave = (rowId: string, value: Omit<CellDraft, "rowId">) =>
    saveCell.mutate({ rowId, ...value }, { onError: notifyError("Не удалось сохранить ячейку.") });

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ids = columns.map((column) => column.id);
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;

    reorder.mutate(
      { target: "columns", ids: arrayMove(ids, from, to) },
      { onError: notifyError("Не удалось сохранить порядок ступеней.") }
    );
  };

  const handleRowDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    if (search.trim()) {
      toast.error("Очистите поиск, чтобы менять порядок строк.");
      return;
    }

    const activeRow = rows.find((row) => row.id === active.id);
    const overRow = rows.find((row) => row.id === over.id);
    if (!activeRow || !overRow || activeRow.type !== overRow.type) return;

    // Перенос должности в другой отдел — не перетаскивание, а смена родителя:
    // молча делать её из drag'n'drop нельзя.
    if (activeRow.type === "position" && activeRow.departmentId !== overRow.departmentId) {
      toast.error("Должность можно двигать только внутри своего отдела.");
      return;
    }

    const group = rows.filter((row) =>
      activeRow.type === "department"
        ? row.type === "department"
        : row.type === "position" && row.departmentId === activeRow.departmentId
    );
    const ids = group.map((row) => row.id);
    const from = ids.indexOf(activeRow.id);
    const to = ids.indexOf(overRow.id);
    if (from < 0 || to < 0) return;

    reorder.mutate(
      { target: "rows", ids: arrayMove(ids, from, to) },
      { onError: notifyError("Не удалось сохранить порядок строк.") }
    );
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    const options = { onError: notifyError("Не удалось удалить.") };
    if (pendingDelete.kind === "column") deleteColumn.mutate(pendingDelete.id, options);
    else deleteRow.mutate(pendingDelete.id, options);
    setPendingDelete(null);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-error-200 bg-error-50 px-5 py-8 text-center text-sm text-error-600">
        {error instanceof Error ? error.message : "Не удалось загрузить матрицу грейдов."}
      </div>
    );
  }

  const addColumn = () =>
    saveColumn.mutate(
      { minMonths: null, maxSalary: null },
      { onError: notifyError("Не удалось добавить ступень.") }
    );

  return (
    <div className="w-full space-y-4">
      <PageMeta
        title="Зарплаты по грейдам | Настройки"
        description="Матрица грейдов: ступени, отделы и должности"
      />

      {/* ── Заголовок ───────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Зарплаты по грейдам</h1>
          <p className="mt-1 max-w-3xl text-sm text-gray-500">
            Столбец — ступень роста: стаж и потолок оклада. Строка — отдел или должность.
            В ячейке — грейд из{" "}
            <Link to="/settings/experience-levels" className="text-brand-500 hover:underline">
              уровней опыта
            </Link>{" "}
            или переход на другую должность.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative w-full max-w-xs">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Отдел или должность..."
              className="h-9 w-full rounded-lg border border-gray-300 pl-9 pr-3 text-sm text-gray-800 outline-none focus:border-brand-300 focus:ring-3 focus:ring-brand-500/10"
            />
          </div>

          <Button
            onClick={addColumn}
            disabled={!isConfigured}
            className="h-9 shrink-0 px-3 py-0 text-sm"
          >
            <Plus size={15} />
            Ступень
          </Button>
        </div>
      </div>

      {data && !isConfigured && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 p-3.5 text-sm text-amber-800">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            Таблицы матрицы ещё не заведены в u-code — заполнять матрицу пока нельзя.
          </span>
        </div>
      )}

      {/* ── Матрица ─────────────────────────────────────────────────────── */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <div className="min-w-max">
            {/* Шапка: ступени */}
            <div className="flex items-stretch bg-white">
              <div
                className={`flex items-end px-4 pb-2.5 pt-3 text-[11px] font-medium uppercase tracking-wide text-gray-400 ${TITLE_CELL} ${STICKY_TITLE} bg-white`}
              >
                Отдел / должность
              </div>

              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleColumnDragEnd}
              >
                <SortableContext
                  items={columns.map((column) => column.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {columns.map((column, index) => (
                    <ColumnHead
                      key={column.id}
                      column={column}
                      index={stepNumber(index)}
                      disabled={isPendingId(column.id)}
                      onSave={(minMonths, maxSalary) =>
                        saveColumn.mutate(
                          { guid: column.id, minMonths, maxSalary },
                          { onError: notifyError("Не удалось сохранить ступень.") }
                        )
                      }
                      onDelete={() =>
                        setPendingDelete({
                          kind: "column",
                          id: column.id,
                          title: `Ступень ${stepNumber(index)}`,
                          note: "Грейды, проставленные в этой ступени, будут удалены.",
                        })
                      }
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>

            {/* Строки */}
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleRowDragEnd}
            >
              <SortableContext
                items={rows.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                {groups.map((group) => (
                  <div key={group.department.id}>
                    <MatrixRowLine
                      row={group.department}
                      columns={columns}
                      levels={levels}
                      positions={positions}
                      disabled={isPendingId(group.department.id)}
                      onCellSave={(value) => handleCellSave(group.department.id, value)}
                      onDelete={() =>
                        setPendingDelete({
                          kind: "row",
                          id: group.department.id,
                          title: group.department.title,
                          note: "Вместе с отделом из матрицы уйдут его должности и все их грейды.",
                        })
                      }
                    />

                    {group.positions.map((row) => (
                      <MatrixRowLine
                        key={row.id}
                        row={row}
                        columns={columns}
                        levels={levels}
                        positions={positions}
                        disabled={isPendingId(row.id)}
                        onCellSave={(value) => handleCellSave(row.id, value)}
                        onDelete={() =>
                          setPendingDelete({
                            kind: "row",
                            id: row.id,
                            title: row.title,
                            note: "Грейды этой должности будут удалены.",
                          })
                        }
                      />
                    ))}

                    {!search.trim() && group.department.departmentId && (
                      <AddRowLine
                        label="Должность"
                        indented
                        options={freePositions}
                        emptyText="Все должности уже в матрице"
                        disabled={isPendingId(group.department.id)}
                        onPick={(positionId) =>
                          saveRow.mutate(
                            {
                              rowType: "position",
                              departmentId: group.department.departmentId as string,
                              positionId,
                            },
                            { onError: notifyError("Не удалось добавить должность.") }
                          )
                        }
                      />
                    )}
                  </div>
                ))}
              </SortableContext>
            </DndContext>

            {groups.length === 0 && search.trim() && (
              <div className="border-t border-gray-100 py-10 text-center text-sm text-gray-500">
                Ничего не найдено
              </div>
            )}

            {groups.length === 0 && !search.trim() && (
              <div className="border-t border-gray-100 py-12 text-center">
                <LayoutGrid className="mx-auto mb-3 h-7 w-7 text-gray-300" />
                <p className="text-sm text-gray-500">
                  Матрица пустая — добавьте отдел, а потом должности внутри него
                </p>
              </div>
            )}

            {!search.trim() && (
              <AddRowLine
                label="Отдел"
                options={freeDepartments}
                emptyText="Все отделы уже в матрице"
                disabled={!isConfigured}
                onPick={(departmentId) =>
                  saveRow.mutate(
                    { rowType: "department", departmentId },
                    { onError: notifyError("Не удалось добавить отдел.") }
                  )
                }
              />
            )}
          </div>
        </div>
      </div>

      <p className="text-xs text-gray-400">
        Изменения сохраняются сразу. Порядок меняется перетаскиванием: ступени — за номер
        в шапке, строки — за ручку слева.
      </p>

      {/* ── Подтверждение удаления ──────────────────────────────────────── */}
      <Modal
        isOpen={Boolean(pendingDelete)}
        onClose={() => setPendingDelete(null)}
        showCloseButton={false}
        className="mx-4 w-full max-w-[460px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
      >
        <div className="px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Убрать «{pendingDelete?.title}» из матрицы?
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            {pendingDelete?.note} Сам справочник не меняется.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3">
          <Button
            variant="outline"
            onClick={() => setPendingDelete(null)}
            className="min-w-[96px] px-3 py-2 text-sm"
          >
            Отмена
          </Button>
          <Button
            onClick={confirmDelete}
            className="min-w-[110px] bg-error-500 px-3 py-2 text-sm hover:bg-error-600"
          >
            Удалить
          </Button>
        </div>
      </Modal>
    </div>
  );
}
