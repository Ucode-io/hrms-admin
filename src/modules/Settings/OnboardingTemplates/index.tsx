import { useMemo, useState } from "react";
import { Archive, FileSpreadsheet, Loader2, Plus, Save, Upload } from "lucide-react";
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

const columnIndex = (value: string): number => {
  const clean = value.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(clean)) return -1;
  return [...clean].reduce((result, character) => result * 26 + character.charCodeAt(0) - 64, 0) - 1;
};

const slug = (value: string, fallback: string) =>
  value
    .toLowerCase()
    .replace(/[^a-zа-яё0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120) || fallback;

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
        const parentTitle = block.parentTitle.trim() || row.values[parentIndex]?.trim();
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
          description: descriptionIndex >= 0 ? row.values[descriptionIndex]?.trim() || "" : "",
          due_value: block.dueValue,
          due_unit: block.dueUnit,
          children: [],
        });
      });
  });

  return [...parents.values()];
};

const inputClass =
  "h-10 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-800 outline-none focus:border-brand-500";

const multiSelectClass =
  "min-h-24 w-full rounded-lg border border-gray-300 bg-white px-2 py-2 text-sm text-gray-800 outline-none focus:border-brand-500";

function MappingCard({
  block,
  workbook,
  onChange,
  onRemove,
}: {
  block: MappingBlock;
  workbook: ParsedWorkbook;
  onChange: (next: MappingBlock) => void;
  onRemove: () => void;
}) {
  const field = (key: keyof MappingBlock, value: string | number) =>
    onChange({ ...block, [key]: value });

  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="m-0 text-sm font-semibold text-gray-800">Excel diapazoni</p>
        <button type="button" onClick={onRemove} className="text-xs font-medium text-error-600">Olib tashlash</button>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="text-xs text-gray-600">Sheet / tab
          <select className={inputClass} value={block.sheet} onChange={(event) => field("sheet", event.target.value)}>
            {workbook.sheets.map((sheet) => <option key={sheet.name}>{sheet.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-gray-600">Boshlanish qatori
          <input className={inputClass} type="number" min={1} value={block.startRow} onChange={(event) => field("startRow", Number(event.target.value))} />
        </label>
        <label className="text-xs text-gray-600">Tugash qatori
          <input className={inputClass} type="number" min={1} value={block.endRow} onChange={(event) => field("endRow", Number(event.target.value))} />
        </label>
        <label className="text-xs text-gray-600">Parent task nomi
          <input className={inputClass} value={block.parentTitle} placeholder="Masalan: 1-oy" onChange={(event) => field("parentTitle", event.target.value)} />
        </label>
        <label className="text-xs text-gray-600">Parent task kolonkasi
          <input className={inputClass} value={block.parentColumn} placeholder="A (ixtiyoriy)" onChange={(event) => field("parentColumn", event.target.value)} />
        </label>
        <label className="text-xs text-gray-600">Subtask kolonkasi
          <input className={inputClass} value={block.subtaskColumn} placeholder="B" onChange={(event) => field("subtaskColumn", event.target.value)} />
        </label>
        <label className="text-xs text-gray-600">Izoh / natija kolonkasi
          <input className={inputClass} value={block.descriptionColumn} placeholder="C" onChange={(event) => field("descriptionColumn", event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-gray-600">Deadline
            <input className={inputClass} type="number" min={0} value={block.dueValue} onChange={(event) => field("dueValue", Number(event.target.value))} />
          </label>
          <label className="text-xs text-gray-600">Birlik
            <select className={inputClass} value={block.dueUnit} onChange={(event) => field("dueUnit", event.target.value as DueUnit)}>
              <option value="day">kun</option><option value="week">hafta</option><option value="month">oy</option>
            </select>
          </label>
        </div>
      </div>
      <p className="mb-0 mt-3 text-xs text-gray-500">
        Parent nomini yozsangiz shu diapazondagi barcha qatorlar bitta task ostiga tushadi. Bo‘sh qoldirsangiz parent kolonkasi bo‘yicha guruhlanadi.
      </p>
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
  const mappedItems = useMemo(() => buildItemsFromMapping(workbook, blocks), [workbook, blocks]);
  const preview = storedItems.length ? storedItems : mappedItems;

  const editPreview = (change: (items: OnboardingItem[]) => void) => {
    const next = structuredClone(preview);
    change(next);
    setStoredItems(next);
  };

  const reset = () => {
    setEditing(null); setTitle(""); setWorkbook(null); setBlocks([]); setStoredItems([]);
    setIsDefault(true); setStatus("active"); setDepartmentIds([]); setPositionIds([]);
  };

  const edit = (template: OnboardingTemplate) => {
    setEditing(template); setTitle(template.title); setWorkbook(null); setBlocks([]);
    setStoredItems(template.items); setIsDefault(template.isDefault);
    setStatus(template.status === "active" ? "active" : "draft");
    setDepartmentIds(template.departmentIds); setPositionIds(template.positionIds);
  };

  const handleFile = async (file?: File) => {
    if (!file) return;
    try {
      const parsed = await parseMutation.mutateAsync(file);
      setWorkbook(parsed); setStoredItems([]); setBlocks([emptyBlock(parsed.sheets[0]?.name || "")]);
      if (!title) setTitle(file.name.replace(/\.[^.]+$/, ""));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Excel faylni o‘qib bo‘lmadi");
    }
  };

  const save = async () => {
    if (!title.trim()) return toast.error("Shablon nomini kiriting");
    if (!preview.length || preview.some((item) => item.children.length === 0)) return toast.error("Mappingdan kamida bitta parent task va subtask chiqishi kerak");
    try {
      await saveMutation.mutateAsync({
        guid: editing?.id, title: title.trim(), status, is_default: isDefault,
        department_ids: departmentIds, position_ids: positionIds,
        source_file_name: workbook?.fileName || editing?.sourceFileName || "",
        mapping: { version: 1, mode: "ranges", blocks }, items: preview,
      });
      toast.success("Onboarding shabloni saqlandi"); reset();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Shablonni saqlab bo‘lmadi");
    }
  };

  return (
    <>
      <PageMeta title="Onboarding shablonlari" description="Excel mapping va avtomatik vazifalar" />
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h1 className="m-0 text-xl font-semibold text-gray-900">Onboarding shablonlari</h1><p className="mb-0 mt-1 text-sm text-gray-500">Excel strukturasini mapping qiling. Xodim ishga olinganda vazifalar bevosita rahbariga avtomatik biriktiriladi.</p></div>
          <Button variant="outline" startIcon={<Plus size={16} />} onClick={reset}>Yangi shablon</Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 lg:grid-cols-3">
            <label className="text-sm text-gray-700">Shablon nomi<input className={`${inputClass} mt-1`} value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="text-sm text-gray-700">Holati<select className={`${inputClass} mt-1`} value={status} onChange={(event) => setStatus(event.target.value as "draft" | "active")}><option value="active">Faol</option><option value="draft">Qoralama</option></select></label>
            <label className="mt-7 flex h-10 items-center gap-2 text-sm text-gray-700"><input type="checkbox" checked={isDefault} onChange={(event) => setIsDefault(event.target.checked)} /> Kompaniya uchun default shablon</label>
            <label className="text-sm text-gray-700">Departamentlar<select multiple className={`${multiSelectClass} mt-1`} value={departmentIds} onChange={(event) => setDepartmentIds([...event.target.selectedOptions].map((option) => option.value))}>{departmentsQuery.data?.response.map((item) => <option key={item.guid} value={item.guid}>{item.title}</option>)}</select></label>
            <label className="text-sm text-gray-700">Lavozimlar<select multiple className={`${multiSelectClass} mt-1`} value={positionIds} onChange={(event) => setPositionIds([...event.target.selectedOptions].map((option) => option.value))}>{positionsQuery.data?.response.map((item) => <option key={item.guid} value={item.guid}>{item.title}</option>)}</select></label>
            <label className="flex min-h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand-200 bg-brand-25 text-sm font-medium text-brand-600"><Upload size={18} />{parseMutation.isLoading ? "Excel o‘qilmoqda…" : "Excel yuklash / almashtirish"}<input type="file" accept=".xlsx,.xlsm" className="hidden" onChange={(event) => void handleFile(event.target.files?.[0])} /></label>
          </div>

          {workbook && <div className="mt-5 space-y-3">
            <div className="flex items-center justify-between"><p className="m-0 flex items-center gap-2 text-sm font-semibold text-gray-800"><FileSpreadsheet size={17} />{workbook.fileName}</p><Button size="sm" variant="outline" startIcon={<Plus size={14} />} onClick={() => { setStoredItems([]); setBlocks((current) => [...current, emptyBlock(workbook.sheets[0]?.name || "")]); }}>Diapazon qo‘shish</Button></div>
            {blocks.map((block) => <MappingCard key={block.id} block={block} workbook={workbook} onChange={(next) => { setStoredItems([]); setBlocks((current) => current.map((item) => item.id === next.id ? next : item)); }} onRemove={() => { setStoredItems([]); setBlocks((current) => current.filter((item) => item.id !== block.id)); }} />)}
          </div>}

          {preview.length > 0 && <div className="mt-5 rounded-xl border border-gray-200 p-4"><p className="m-0 text-sm font-semibold text-gray-800">Preview va tahrirlash: {preview.length} ta task, {preview.reduce((sum, item) => sum + item.children.length, 0)} ta subtask</p><div className="mt-3 max-h-96 space-y-3 overflow-auto">{preview.map((parent, parentIndex) => <div key={parent.key} className="rounded-lg bg-gray-50 p-3"><div className="grid gap-2 md:grid-cols-[1fr_90px_110px]"><input className={inputClass} value={parent.title} onChange={(event) => editPreview((items) => { items[parentIndex].title = event.target.value; })} /><input className={inputClass} type="number" min={0} value={parent.due_value} onChange={(event) => editPreview((items) => { items[parentIndex].due_value = Number(event.target.value); })} /><select className={inputClass} value={parent.due_unit} onChange={(event) => editPreview((items) => { items[parentIndex].due_unit = event.target.value as DueUnit; })}><option value="day">kun</option><option value="week">hafta</option><option value="month">oy</option></select></div><div className="mt-2 space-y-2">{parent.children.map((child, childIndex) => <div key={child.key} className="grid gap-2 border-l-2 border-brand-100 pl-3 md:grid-cols-2"><input className={inputClass} value={child.title} onChange={(event) => editPreview((items) => { items[parentIndex].children[childIndex].title = event.target.value; })} /><input className={inputClass} value={child.description} placeholder="Izoh / natija mezoni" onChange={(event) => editPreview((items) => { items[parentIndex].children[childIndex].description = event.target.value; })} /></div>)}</div></div>)}</div></div>}

          <div className="mt-5 flex justify-end gap-2">{editing && <Button variant="outline" onClick={reset}>Bekor qilish</Button>}<Button startIcon={saveMutation.isLoading ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />} disabled={saveMutation.isLoading} onClick={() => void save()}>Saqlash</Button></div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm"><div className="border-b border-gray-100 px-5 py-4 text-sm font-semibold text-gray-800">Saqlangan shablonlar</div>{templatesQuery.isLoading ? <div className="p-8 text-center text-gray-500">Yuklanmoqda…</div> : templatesQuery.data?.length ? templatesQuery.data.map((template) => <div key={template.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 px-5 py-4 last:border-0"><button type="button" onClick={() => edit(template)} className="text-left"><span className="text-sm font-medium text-gray-900">{template.title}</span><span className="ml-2 rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">v{template.version}</span><p className="mb-0 mt-1 text-xs text-gray-500">{template.status === "active" ? "Faol" : template.status === "draft" ? "Qoralama" : "Arxiv"} · {template.items.length} task · {template.sourceFileName || "qo‘lda"}</p></button><button type="button" title="Arxivlash" className="rounded-lg p-2 text-gray-400 hover:bg-error-50 hover:text-error-600" onClick={() => void archiveMutation.mutateAsync(template.id).then(() => toast.success("Shablon arxivlandi"))}><Archive size={17} /></button></div>) : <div className="p-8 text-center text-sm text-gray-500">Hali shablon yo‘q. Excel yuklab birinchi shablonni yarating.</div>}</div>
      </div>
    </>
  );
}
