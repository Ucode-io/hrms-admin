import { useMemo, useState } from "react";
import { Award, Check, Plus, Search, X } from "lucide-react";
import {
  type Skill,
  useSkillsQuery,
} from "../../../../api/services/skill.service";
import {
  useCreateEmployeeSkill,
  useDeleteEmployeeSkill,
  useEmployeeSkillsQuery,
} from "../../../../api/services/employeeSkill.service";

type SkillsSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type SelectedSkill = {
  skillId: string;
  title: string;
  relationGuid: string;
};

function SkillsSection({ employeeGuid, brandColor }: SkillsSectionProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const { data: skillsData, isLoading: isSkillsCatalogLoading } = useSkillsQuery({
    params: { limit: 200, offset: 0 },
  });

  const { data: employeeSkillsData, isLoading: isEmployeeSkillsLoading } = useEmployeeSkillsQuery({
    userBaseId: employeeGuid,
    limit: 200,
    offset: 0,
  });

  const createMutation = useCreateEmployeeSkill(employeeGuid);
  const deleteMutation = useDeleteEmployeeSkill(employeeGuid);

  const isSaving = createMutation.isLoading || deleteMutation.isLoading;

  const allSkills = useMemo<Skill[]>(() => {
    return skillsData?.response ?? [];
  }, [skillsData?.response]);

  const employeeSkillRows = useMemo(() => {
    return employeeSkillsData?.response ?? [];
  }, [employeeSkillsData?.response]);

  const selectedSkills = useMemo<SelectedSkill[]>(() => {
    const byCatalogId = new Map(allSkills.map((skill) => [skill.guid, skill]));
    const unique = new Map<string, SelectedSkill>();

    for (const row of employeeSkillRows) {
      const skillId = typeof row.skills_id === "string" ? row.skills_id : "";
      if (!skillId || unique.has(skillId)) continue;

      const fromRelation =
        row.skills_id_data && typeof row.skills_id_data.title === "string"
          ? row.skills_id_data.title
          : "";
      const fromCatalog = byCatalogId.get(skillId);

      unique.set(skillId, {
        skillId,
        relationGuid: row.guid,
        title: fromRelation || String(fromCatalog?.title || "Без названия"),
      });
    }

    return Array.from(unique.values());
  }, [allSkills, employeeSkillRows]);

  const selectedSkillIds = useMemo(() => {
    return new Set(selectedSkills.map((skill) => skill.skillId));
  }, [selectedSkills]);

  const availableSkills = useMemo(() => {
    const search = query.trim().toLowerCase();
    return allSkills.filter((skill) => {
      if (selectedSkillIds.has(skill.guid)) return false;
      if (!search) return true;
      return String(skill.title || "").toLowerCase().includes(search);
    });
  }, [allSkills, query, selectedSkillIds]);

  const addSkill = async (skillId: string) => {
    if (!employeeGuid || isSaving) return;

    try {
      setError("");
      await createMutation.mutateAsync({
        user_base_id: employeeGuid,
        skills_id: skillId,
      });
      setQuery("");
      setIsPickerOpen(false);
    } catch (createError) {
      console.error("Employee skill create error:", createError);
      setError("Не удалось добавить навык. Попробуйте ещё раз.");
    }
  };

  const removeSkill = async (skillId: string) => {
    if (isSaving) return;

    const row = selectedSkills.find((item) => item.skillId === skillId);
    if (!row?.relationGuid) return;

    try {
      setError("");
      await deleteMutation.mutateAsync(row.relationGuid);
    } catch (deleteError) {
      console.error("Employee skill delete error:", deleteError);
      setError("Не удалось удалить навык. Попробуйте ещё раз.");
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white overflow-visible">
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span style={{ color: brandColor }}>
            <Award className="w-4 h-4" />
          </span>
          <h3 className="text-[15px] font-bold text-slate-900 m-0">Навыки</h3>
          <span className="text-[12px] font-medium text-slate-400">{selectedSkills.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setIsPickerOpen((prev) => !prev)}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: brandColor }}
        >
          <Plus className="w-3.5 h-3.5" />
          Добавить
        </button>
      </div>

      <div className="px-6 pt-4 pb-5 space-y-3">
        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        {isPickerOpen && (
          <div className="rounded-xl border border-slate-200 bg-white p-3">
            <label className="relative block">
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Поиск навыка..."
                className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 text-[13px] text-slate-700 outline-none transition-colors focus:border-slate-400"
              />
            </label>

            <div className="mt-2 max-h-44 overflow-auto rounded-lg border border-slate-100">
              {isSkillsCatalogLoading ? (
                <div className="px-3 py-2 text-[12px] text-slate-400">Загрузка...</div>
              ) : availableSkills.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-slate-400">
                  Подходящие навыки не найдены
                </div>
              ) : (
                availableSkills.map((skill) => (
                  <button
                    key={skill.guid}
                    type="button"
                    onClick={() => void addSkill(skill.guid)}
                    className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-[13px] text-slate-700 hover:bg-slate-50 cursor-pointer"
                  >
                    <span>{String(skill.title || "Без названия")}</span>
                    <Check className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))
              )}
            </div>
          </div>
        )}

        {isEmployeeSkillsLoading ? (
          <div className="py-3 text-[13px] text-slate-400">Загрузка...</div>
        ) : selectedSkills.length === 0 ? (
          <div className="py-1 text-[13px] text-slate-400">Навыки не добавлены</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {selectedSkills.map((skill) => (
              <div
                key={skill.relationGuid}
                className="group inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
              >
                <Award className="w-3.5 h-3.5 text-slate-400" />
                <span className="text-[13px] text-slate-700 whitespace-nowrap">
                  {skill.title}
                </span>
                <button
                  type="button"
                  onClick={() => void removeSkill(skill.skillId)}
                  className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-500 hover:text-rose-500 hover:bg-slate-100 transition-all cursor-pointer opacity-0 group-hover:opacity-100 focus:opacity-100"
                  title="Удалить"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default SkillsSection;
