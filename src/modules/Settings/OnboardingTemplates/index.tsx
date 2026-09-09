import { useMemo, useState } from "react";
import {
  Archive,
  Check,
  FileSpreadsheet,
  Loader2,
  Plus,
  Save,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import {
  type DueUnit,
  type OnboardingItem,
  type OnboardingTemplate,
  type ParsedWorkbook,
  useArchiveOnboardingTemplate,
  useOnboardingTemplates,
  useParseOnboardingExcel,
  useSaveOnboardingTemplate,
} from "../../../api/services/onboardingTasks.service";
import { useDepartmentsSettingsQuery } from "../../../api/services/department.service";
import { usePositionsQuery } from "../../../api/services/position.service";

type MappingBlock = {
  id: string;
  sheet: string;
  startRow: number;
  endRow: number;
  parentTitle: string;
  parentColumn: string;
  subtaskColumn: string;
  descriptionColumn: string;
  dueValue: number;
  dueUnit: DueUnit;
};

type PickerOption = { id: string; title: string };

const inputClass =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-800 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

const columnName = (index: number) => {
  let value = index + 1;
  let result = "";
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
};

const columnIndex = (value: string): number => {
  const clean = value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(clean)) return -1;
  return [...clean].reduce(
    (result, character) => result * 26 + character.charCodeAt(0) - 64,
    0
  ) - 1;
};

const slug = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || fallback;

const emptyBlock = (sheet = ""): MappingBlock => ({
  id: crypto.randomUUID(),
  sheet,
  startRow: 2,
  endRow: 20,
  parentTitle: "",
  parentColumn: "",
  subtaskColumn: "B",
  descriptionColumn: "C",
  dueValue: 1,
  dueUnit: "month",
});

const knownWorkbookBlocks = (workbook: ParsedWorkbook): MappingBlock[] | null => {
  const sheet = workbook.sheets[0];
  if (
    !sheet ||
    sheet.rows[9]?.values[1] !== "Основные обязанности и стандарты"
  ) {
    return null;
  }

  const block = (
    parentTitle: string,
    startRow: number,
    endRow: number,
    taskColumn: string,
    descriptionColumn: string,
    dueValue: number
  ): MappingBlock => ({
    ...emptyBlock(sheet.name),
    parentTitle,
    startRow,
    endRow,
    subtaskColumn: taskColumn,
    descriptionColumn,
    dueValue,
  });

  return [
    block("Основные задачи на период адаптации", 10, 15, "B", "C", 3),
    block("1-й месяц — знакомство и освоение", 17, 21, "B", "", 1),
    block("2-й месяц — самостоятельная работа", 27, 31, "B", "C", 2),
    block("3-й месяц — закрепление и итог", 37, 41, "B", "C", 3),
    block("Итоговая оценка адаптации", 47, 52, "A", "D", 3),
  ];
};

const buildItemsFromMapping = (
  workbook: ParsedWorkbook | null,
  blocks: MappingBlock[]
): OnboardingItem[] => {
  if (!workbook) return [];
  const parents = new Map<string, OnboardingItem>();

  blocks.forEach((block, blockIndex) => {
    const sheet = workbook.sheets.find((item) => item.name === block.sheet);
    if (!sheet) return;
    const parentIndex = columnIndex(block.parentColumn);
    const taskIndex = columnIndex(block.subtaskColumn);
    const descriptionIndex = columnIndex(block.descriptionColumn);
    if (taskIndex < 0) return;

    sheet.rows
      .filter((row) => row.number >= block.startRow && row.number <= block.endRow)
      .forEach((row) => {
        const taskTitle = row.values[taskIndex]?.trim();
        if (!taskTitle) return;
        const parentTitle =
          block.parentTitle.trim() || row.values[parentIndex]?.trim();
        if (!parentTitle) return;
        const parentMapKey = `${block.id}:${parentTitle}`;
        let parent = parents.get(parentMapKey);
        if (!parent) {
          const parentKey = `${slug(parentTitle, "group")}-${blockIndex + 1}`;
          parent = {
            key: parentKey,
            title: parentTitle,
            description: "",
            due_value: block.dueValue,
            due_unit: block.dueUnit,
            children: [],
          };
          parents.set(parentMapKey, parent);
        }
        parent.children.push({
          key: `${parent.key}-${row.number}`,
          title: taskTitle,
          description:
            descriptionIndex >= 0
              ? row.values[descriptionIndex]?.trim() || ""
              : "",
          due_value: block.dueValue,
          due_unit: block.dueUnit,
          children: [],
        });
      });
  });

  return [...parents.values()];
};

function StepTitle({
  number,
  title,
  description,
}: {
  number: number;
  title: string;
  description: string;
}) {
  return (
    <div className="flex gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
        {number}
      </span>
      <div>
        <h2 className="m-0 text-base font-semibold text-gray-900">{title}</h2>
        <p className="mb-0 mt-1 text-sm text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function LimitedPicker({
  label,
  options,
  selectedIds,
  onChange,
}: {
  label: string;
  options: PickerOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const available = options.filter((option) => !selectedIds.includes(option.id));
  const selected = selectedIds
    .map((id) => options.find((option) => option.id === id))
    .filter((option): option is PickerOption => Boolean(option));

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <span className="text-xs text-gray-400">{selectedIds.length}/2</span>
      </div>
      <select
        className={inputClass}
        value=""
        disabled={selectedIds.length >= 2}
        onChange={(event) => {
          if (event.target.value && selectedIds.length < 2) {
            onChange([...selectedIds, event.target.value]);
          }
        }}
      >
        <option value="">
          {selectedIds.length >= 2 ? "Maksimum 2 ta tanlandi" : "Tanlash…"}
        </option>
        {available.map((option) => (
          <option key={option.id} value={option.id}>
            {option.title}
          </option>
        ))}
      </select>
      <div className="mt-2 flex min-h-7 flex-wrap gap-2">
        {selected.map((option) => (
          <span
            key={option.id}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700"
          >
            {option.title}
            <button
              type="button"
              aria-label={`${option.title}ni olib tashlash`}
              onClick={() => onChange(selectedIds.filter((id) => id !== option.id))}
            >
              <X size={13} />
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function MappingCard({
  index,
  block,
  workbook,
  canRemove,
  onChange,
  onRemove,
}: {
  index: number;
  block: MappingBlock;
  workbook: ParsedWorkbook;
  canRemove: boolean;
  onChange: (next: MappingBlock) => void;
  onRemove: () => void;
}) {
  const field = (key: keyof MappingBlock, value: string | number) =>
    onChange({ ...block, [key]: value });
  const activeSheet =
    workbook.sheets.find((sheet) => sheet.name === block.sheet) ||
    workbook.sheets[0];
  const columnOptions = Array.from(
    { length: Math.min(activeSheet?.columnCount || 1, 26) },
    (_, column) => {
      const sample = activeSheet?.rows
        .filter(
          (row) => row.number >= block.startRow && row.number <= block.endRow
        )
        .map((row) => row.values[column]?.trim())
        .find(Boolean);
      return {
        value: columnName(column),
        label: sample
          ? `${columnName(column)} — ${sample.slice(0, 42)}`
          : columnName(column),
      };
    }
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-4">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="m-0 text-sm font-semibold text-gray-900">
            {index + 1}-vazifalar guruhi
          </p>
          <p className="mb-0 mt-0.5 text-xs text-gray-500">
            Excel’dagi bir bo‘lim bitta asosiy task bo‘ladi.
          </p>
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-xs font-medium text-error-600"
          >
            Olib tashlash
          </button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="text-sm font-medium text-gray-700">
          Asosiy task nomi
          <input
            className={`${inputClass} mt-1.5`}
            value={block.parentTitle}
            placeholder="Masalan: 1-oy vazifalari"
            onChange={(event) => field("parentTitle", event.target.value)}
          />
        </label>
        <div>
          <span className="text-sm font-medium text-gray-700">
            Vazifalar qaysi qatorlarda?
          </span>
          <div className="mt-1.5 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <input
              aria-label="Birinchi qator"
              className={inputClass}
              type="number"
              min={1}
              value={block.startRow}
              onChange={(event) => field("startRow", Number(event.target.value))}
            />
            <span className="text-sm text-gray-400">dan</span>
            <input
              aria-label="Oxirgi qator"
              className={inputClass}
              type="number"
              min={1}
              value={block.endRow}
              onChange={(event) => field("endRow", Number(event.target.value))}
            />
          </div>
        </div>
        <label className="text-sm font-medium text-gray-700">
          Vazifa nomi qaysi ustunda?
          <select
            className={`${inputClass} mt-1.5`}
            value={block.subtaskColumn}
            onChange={(event) => field("subtaskColumn", event.target.value)}
          >
            {columnOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium text-gray-700">
          Natija yoki izoh qaysi ustunda?
          <select
            className={`${inputClass} mt-1.5`}
            value={block.descriptionColumn}
            onChange={(event) => field("descriptionColumn", event.target.value)}
          >
            <option value="">Izoh yo‘q</option>
            {columnOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 rounded-xl bg-gray-50 p-3">
        <div className="grid items-end gap-3 sm:grid-cols-[1fr_110px_130px]">
          <div>
            <p className="m-0 text-sm font-medium text-gray-700">
              Qachongacha bajarilishi kerak?
            </p>
            <p className="mb-0 mt-1 text-xs text-gray-500">
              Xodimning ish boshlagan sanasidan hisoblanadi.
            </p>
          </div>
          <input
            aria-label="Deadline miqdori"
            className={inputClass}
            type="number"
            min={0}
            value={block.dueValue}
            onChange={(event) => field("dueValue", Number(event.target.value))}
          />
          <select
            aria-label="Deadline birligi"
            className={inputClass}
            value={block.dueUnit}
            onChange={(event) => field("dueUnit", event.target.value as DueUnit)}
          >
            <option value="day">kun ichida</option>
            <option value="week">hafta ichida</option>
            <option value="month">oy ichida</option>
          </select>
        </div>
      </div>

      <details className="mt-3 text-sm text-gray-600">
        <summary className="cursor-pointer font-medium text-brand-600">
          Qo‘shimcha sozlamalar
        </summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label>
            Excel varag‘i
            <select
              className={`${inputClass} mt-1`}
              value={block.sheet}
              onChange={(event) => field("sheet", event.target.value)}
            >
              {workbook.sheets.map((sheet) => (
                <option key={sheet.name}>{sheet.name}</option>
              ))}
            </select>
          </label>
          <label>
            Guruh nomi Excel ustunida bo‘lsa
            <select
              className={`${inputClass} mt-1`}
              value={block.parentColumn}
              onChange={(event) => field("parentColumn", event.target.value)}
            >
              <option value="">Ishlatilmaydi</option>
              {columnOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </details>
    </div>
  );
}

export default function OnboardingTemplatesPage() {
  const templatesQuery = useOnboardingTemplates();
  const parseMutation = useParseOnboardingExcel();
  const saveMutation = useSaveOnboardingTemplate();
  const archiveMutation = useArchiveOnboardingTemplate();
  const departmentsQuery = useDepartmentsSettingsQuery({ params: { limit: 500 } });
  const positionsQuery = usePositionsQuery({ params: { all: true } });
  const [editing, setEditing] = useState<OnboardingTemplate | null>(null);
  const [title, setTitle] = useState("");
  const [workbook, setWorkbook] = useState<ParsedWorkbook | null>(null);
  const [blocks, setBlocks] = useState<MappingBlock[]>([]);
  const [storedItems, setStoredItems] = useState<OnboardingItem[]>([]);
  const [isDefault, setIsDefault] = useState(true);
  const [status, setStatus] = useState<"draft" | "active">("active");
  const [departmentIds, setDepartmentIds] = useState<string[]>([]);
  const [positionIds, setPositionIds] = useState<string[]>([]);
  const mappedItems = useMemo(
    () => buildItemsFromMapping(workbook, blocks),
    [workbook, blocks]
  );
  const preview = storedItems.length ? storedItems : mappedItems;
  const departments = (departmentsQuery.data?.response || []).map((item) => ({
    id: item.guid,
    title: item.title,
  }));
  const positions = (positionsQuery.data?.response || []).map((item) => ({
    id: item.guid,
    title: item.title,
  }));

  const editPreview = (change: (items: OnboardingItem[]) => void) => {
    const next = structuredClone(preview);
    change(next);
    setStoredItems(next);
  };

  const reset = () => {
    setEditing(null);
    setTitle("");
    setWorkbook(null);
    setBlocks([]);
    setStoredItems([]);
    setIsDefault(true);
    setStatus("active");
    setDepartmentIds([]);
    setPositionIds([]);
  };

  const edit = (template: OnboardingTemplate) => {
    setEditing(template);
    setTitle(template.title);
    setWorkbook(null);
    setBlocks([]);
    setStoredItems(template.items);
    setIsDefault(template.isDefault);
    setStatus(template.status === "active" ? "active" : "draft");
    setDepartmentIds(template.departmentIds.slice(0, 2));
    setPositionIds(template.positionIds.slice(0, 2));
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseMutation.mutateAsync(file);
      const detected = knownWorkbookBlocks(parsed);
      setWorkbook(parsed);
      setStoredItems([]);
      setBlocks(detected || [emptyBlock(parsed.sheets[0]?.name || "")]);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
      toast.success(
        detected
          ? "Excel tanildi: 5 ta vazifalar guruhi avtomatik topildi"
          : "Excel o‘qildi. Endi vazifalar joyini ko‘rsating"
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Excel faylni o‘qib bo‘lmadi"
      );
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Shablon nomini kiriting");
    if (!isDefault && departmentIds.length === 0 && positionIds.length === 0) {
      return toast.error("Kamida bitta departament yoki lavozim tanlang");
    }
    if (
      !preview.length ||
      preview.some((item) => item.children.length === 0 || !item.title.trim())
    ) {
      return toast.error("Har bir guruh nomi va uning vazifalari bo‘lishi kerak");
    }
    try {
      await saveMutation.mutateAsync({
        guid: editing?.id,
        title: title.trim(),
        status,
        is_default: isDefault,
        department_ids: isDefault ? [] : departmentIds.slice(0, 2),
        position_ids: isDefault ? [] : positionIds.slice(0, 2),
        source_file_name:
          workbook?.fileName || editing?.sourceFileName || "",
        mapping: { version: 2, mode: "guided-ranges", blocks },
        items: preview,
      });
      toast.success("Onboarding shabloni saqlandi");
      reset();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Shablonni saqlab bo‘lmadi"
      );
    }
  };

  return (
    <>
      <PageMeta
        title="Onboarding shablonlari"
        description="Excel orqali avtomatik onboarding vazifalari"
      />
      <div className="mx-auto max-w-5xl space-y-5 pb-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="m-0 text-xl font-semibold text-gray-900">
              Onboarding vazifalarini sozlash
            </h1>
            <p className="mb-0 mt-1 max-w-2xl text-sm text-gray-500">
              Excel’dan vazifalarni oling. Yangi xodim ishga kirganda tizim ularni
              bevosita rahbariga avtomatik biriktiradi.
            </p>
          </div>
          <Button
            variant="outline"
            startIcon={<Plus size={16} />}
            onClick={reset}
          >
            Yangi shablon
          </Button>
        </div>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <StepTitle
            number={1}
            title="Excel faylni yuklang"
            description="Vazifalar yozilgan .xlsx yoki .xlsm faylni tanlang."
          />
          <label className="mt-5 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-brand-200 bg-brand-25 px-5 text-center transition hover:border-brand-400 hover:bg-brand-50">
            {parseMutation.isLoading ? (
              <Loader2 className="animate-spin text-brand-500" size={25} />
            ) : (
              <Upload className="text-brand-500" size={25} />
            )}
            <span className="mt-2 text-sm font-semibold text-brand-700">
              {workbook
                ? "Boshqa Excel tanlash"
                : parseMutation.isLoading
                  ? "Excel o‘qilmoqda…"
                  : "Excel faylni tanlash"}
            </span>
            <span className="mt-1 text-xs text-gray-500">
              {workbook?.fileName || "10 MB gacha"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xlsm"
              className="hidden"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
          <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_180px]">
            <label className="text-sm font-medium text-gray-700">
              Shablon nomi
              <input
                className={`${inputClass} mt-1.5`}
                value={title}
                placeholder="Masalan: Sotuv bo‘limi onboarding"
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="text-sm font-medium text-gray-700">
              Holati
              <select
                className={`${inputClass} mt-1.5`}
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as "draft" | "active")
                }
              >
                <option value="active">Faol</option>
                <option value="draft">Qoralama</option>
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <StepTitle
            number={2}
            title="Bu shablon kimlar uchun?"
            description="Barcha xodimlar yoki ayrim departament va lavozimlar uchun belgilang."
          />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setIsDefault(true)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                isDefault
                  ? "border-brand-500 bg-brand-25"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  isDefault
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-gray-300"
                }`}
              >
                {isDefault && <Check size={13} />}
              </span>
              <span>
                <strong className="block text-sm text-gray-900">
                  Barcha yangi xodimlar
                </strong>
                <span className="mt-1 block text-xs text-gray-500">
                  Maxsus shablon topilmasa shu ishlaydi.
                </span>
              </span>
            </button>
            <button
              type="button"
              onClick={() => setIsDefault(false)}
              className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
                !isDefault
                  ? "border-brand-500 bg-brand-25"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <span
                className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                  !isDefault
                    ? "border-brand-500 bg-brand-500 text-white"
                    : "border-gray-300"
                }`}
              >
                {!isDefault && <Check size={13} />}
              </span>
              <span>
                <strong className="block text-sm text-gray-900">
                  Tanlangan guruhlar
                </strong>
                <span className="mt-1 block text-xs text-gray-500">
                  Ko‘pi bilan 2 ta departament va 2 ta lavozim.
                </span>
              </span>
            </button>
          </div>
          {!isDefault && (
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <LimitedPicker
                label="Departamentlar"
                options={departments}
                selectedIds={departmentIds}
                onChange={setDepartmentIds}
              />
              <LimitedPicker
                label="Lavozimlar"
                options={positions}
                selectedIds={positionIds}
                onChange={setPositionIds}
              />
            </div>
          )}
        </section>

        {(workbook || storedItems.length > 0) && (
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <StepTitle
              number={3}
              title="Excel’dagi vazifalarni tekshiring"
              description={
                workbook
                  ? "Har bir bo‘lim uchun guruh nomi, qatorlar va ustunlarni ko‘rsating."
                  : "Saqlangan vazifalarni tahrirlang yoki yangi Excel yuklang."
              }
            />
            {workbook && (
              <div className="mt-5 space-y-3 rounded-2xl bg-gray-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 px-1">
                  <p className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-800">
                    <FileSpreadsheet size={17} />
                    {workbook.fileName}
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    startIcon={<Plus size={14} />}
                    onClick={() => {
                      setStoredItems([]);
                      setBlocks((current) => [
                        ...current,
                        emptyBlock(workbook.sheets[0]?.name || ""),
                      ]);
                    }}
                  >
                    Yana guruh qo‘shish
                  </Button>
                </div>
                {blocks.map((block, index) => (
                  <MappingCard
                    key={block.id}
                    index={index}
                    block={block}
                    workbook={workbook}
                    canRemove={blocks.length > 1}
                    onChange={(next) => {
                      setStoredItems([]);
                      setBlocks((current) =>
                        current.map((item) => (item.id === next.id ? next : item))
                      );
                    }}
                    onRemove={() => {
                      setStoredItems([]);
                      setBlocks((current) =>
                        current.filter((item) => item.id !== block.id)
                      );
                    }}
                  />
                ))}
              </div>
            )}

            {preview.length > 0 && (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4">
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                    <Check size={16} />
                  </span>
                  <div>
                    <p className="m-0 text-sm font-semibold text-gray-900">
                      Tizim yaratadigan vazifalar
                    </p>
                    <p className="mb-0 mt-0.5 text-xs text-gray-500">
                      {preview.length} ta asosiy task va{" "}
                      {preview.reduce(
                        (sum, item) => sum + item.children.length,
                        0
                      )}{" "}
                      ta subtask topildi.
                    </p>
                  </div>
                </div>
                <div className="mt-4 max-h-[430px] space-y-3 overflow-auto">
                  {preview.map((parent, parentIndex) => (
                    <div
                      key={parent.key}
                      className="rounded-xl border border-gray-200 bg-white p-3"
                    >
                      <div className="grid gap-2 md:grid-cols-[1fr_90px_125px]">
                        <input
                          aria-label="Asosiy task nomi"
                          className={inputClass}
                          value={parent.title}
                          onChange={(event) =>
                            editPreview((items) => {
                              items[parentIndex].title = event.target.value;
                            })
                          }
                        />
                        <input
                          aria-label="Deadline miqdori"
                          className={inputClass}
                          type="number"
                          min={0}
                          value={parent.due_value}
                          onChange={(event) =>
                            editPreview((items) => {
                              items[parentIndex].due_value = Number(
                                event.target.value
                              );
                            })
                          }
                        />
                        <select
                          aria-label="Deadline birligi"
                          className={inputClass}
                          value={parent.due_unit}
                          onChange={(event) =>
                            editPreview((items) => {
                              items[parentIndex].due_unit = event.target
                                .value as DueUnit;
                            })
                          }
                        >
                          <option value="day">kun ichida</option>
                          <option value="week">hafta ichida</option>
                          <option value="month">oy ichida</option>
                        </select>
                      </div>
                      <div className="mt-2 space-y-2">
                        {parent.children.map((child, childIndex) => (
                          <div
                            key={child.key}
                            className="grid gap-2 border-l-2 border-brand-100 pl-3 md:grid-cols-2"
                          >
                            <input
                              aria-label="Subtask nomi"
                              className={inputClass}
                              value={child.title}
                              onChange={(event) =>
                                editPreview((items) => {
                                  items[parentIndex].children[childIndex].title =
                                    event.target.value;
                                })
                              }
                            />
                            <input
                              aria-label="Natija yoki izoh"
                              className={inputClass}
                              value={child.description}
                              placeholder="Natija yoki izoh"
                              onChange={(event) =>
                                editPreview((items) => {
                                  items[parentIndex].children[
                                    childIndex
                                  ].description = event.target.value;
                                })
                              }
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        <div className="sticky bottom-4 z-10 flex justify-end gap-2 rounded-2xl border border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur">
          {editing && (
            <Button variant="outline" onClick={reset}>
              Bekor qilish
            </Button>
          )}
          <Button
            startIcon={
              saveMutation.isLoading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Save size={16} />
              )
            }
            disabled={saveMutation.isLoading}
            onClick={() => void save()}
          >
            Shablonni saqlash
          </Button>
        </div>

        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b border-gray-100 px-5 py-4">
            <h2 className="m-0 text-base font-semibold text-gray-900">
              Saqlangan shablonlar
            </h2>
          </div>
          {templatesQuery.isLoading ? (
            <div className="p-8 text-center text-sm text-gray-500">
              Yuklanmoqda…
            </div>
          ) : templatesQuery.data?.length ? (
            templatesQuery.data.map((template) => (
              <div
                key={template.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0"
              >
                <button
                  type="button"
                  onClick={() => edit(template)}
                  className="text-left"
                >
                  <span className="text-sm font-medium text-gray-900">
                    {template.title}
                  </span>
                  <span className="ml-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">
                    v{template.version}
                  </span>
                  <p className="mb-0 mt-1 text-xs text-gray-500">
                    {template.status === "active"
                      ? "Faol"
                      : template.status === "draft"
                        ? "Qoralama"
                        : "Arxiv"}{" "}
                    · {template.items.length} task ·{" "}
                    {template.sourceFileName || "qo‘lda"}
                  </p>
                </button>
                <button
                  type="button"
                  title="Arxivlash"
                  className="rounded-lg p-2 text-gray-400 hover:bg-error-50 hover:text-error-600"
                  onClick={() =>
                    void archiveMutation
                      .mutateAsync(template.id)
                      .then(() => toast.success("Shablon arxivlandi"))
                  }
                >
                  <Archive size={17} />
                </button>
              </div>
            ))
          ) : (
            <div className="p-8 text-center text-sm text-gray-500">
              Hali shablon yo‘q. Excel yuklab birinchi shablonni yarating.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
