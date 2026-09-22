import { useEffect, useMemo, useState } from "react";
import { Check, Heart, MoreHorizontal, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  useCreateEmployeeInterest,
  useDeleteEmployeeInterest,
  useEmployeeInterestsQuery,
  useUpdateEmployeeInterest,
} from "../../../../api/services/employeeInterest.service";
import { useTranslation } from "../../../../i18n";

type InterestsSectionProps = {
  employeeGuid: string;
  brandColor: string;
};

type InterestRecord = {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  isLocal?: boolean;
};

function createInterestId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `intr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

const toTime = (date: string) => {
  const ts = new Date(date).getTime();
  return Number.isNaN(ts) ? 0 : ts;
};

function InterestsSection({ employeeGuid, brandColor }: InterestsSectionProps) {
  const { t } = useTranslation();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [creatingId, setCreatingId] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const { data, isLoading } = useEmployeeInterestsQuery({
    userBaseId: employeeGuid,
    limit: 100,
    offset: 0,
  });
  const createMutation = useCreateEmployeeInterest(employeeGuid);
  const updateMutation = useUpdateEmployeeInterest(employeeGuid);
  const deleteMutation = useDeleteEmployeeInterest(employeeGuid);

  const isSaving =
    createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading;

  const records = useMemo<InterestRecord[]>(() => {
    const apiRecords = (data?.response || []).map((item) => ({
      id: item.guid,
      title: typeof item.title === "string" ? item.title : "",
      created_at: typeof item.created_at === "string" ? item.created_at : "",
      updated_at: typeof item.updated_at === "string" ? item.updated_at : "",
    }));

    apiRecords.sort((a, b) => toTime(b.updated_at || b.created_at) - toTime(a.updated_at || a.created_at));

    if (creatingId) {
      return [
        {
          id: creatingId,
          title: "",
          created_at: "",
          updated_at: "",
          isLocal: true,
        },
        ...apiRecords,
      ];
    }

    return apiRecords;
  }, [creatingId, data?.response]);

  useEffect(() => {
    const handleClickOutsideMenu = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('[data-interest-menu="true"]')) return;
      setMenuOpenId(null);
    };
    document.addEventListener("mousedown", handleClickOutsideMenu);
    return () => document.removeEventListener("mousedown", handleClickOutsideMenu);
  }, []);

  const handleCreate = () => {
    if (editingId || isSaving) return;
    const id = createInterestId();
    setCreatingId(id);
    setEditingId(id);
    setEditingTitle("");
    setMenuOpenId(null);
    setError("");
  };

  const startEdit = (record: InterestRecord) => {
    if (isSaving) return;
    if (creatingId && editingId === creatingId && creatingId !== record.id) {
      setCreatingId(null);
    }
    setEditingId(record.id);
    setEditingTitle(record.title);
    if (!record.isLocal) setCreatingId(null);
    setMenuOpenId(null);
    setError("");
  };

  const cancelEdit = () => {
    if (isSaving) return;
    setEditingId(null);
    setEditingTitle("");
    if (creatingId) setCreatingId(null);
    setError("");
  };

  const saveEdit = async () => {
    if (!editingId || isSaving) return;
    const title = editingTitle.trim();
    const isNew = editingId === creatingId;

    if (!title) {
      if (isNew) {
        setCreatingId(null);
        setEditingId(null);
        setEditingTitle("");
        return;
      }
      setError(t("employees.interests.empty_title_error"));
      return;
    }

    try {
      if (isNew) {
        await createMutation.mutateAsync({
          user_base_id: employeeGuid,
          title,
        });
      } else {
        await updateMutation.mutateAsync({
          guid: editingId,
          user_base_id: employeeGuid,
          title,
        });
      }

      setCreatingId(null);
      setEditingId(null);
      setEditingTitle("");
      setError("");
    } catch (saveError) {
      console.error("Interest save error:", saveError);
      setError(t("employees.interests.save_failed"));
    }
  };

  const handleDelete = async (record: InterestRecord) => {
    if (isSaving) return;

    if (record.isLocal) {
      setCreatingId(null);
      if (editingId === record.id) {
        setEditingId(null);
        setEditingTitle("");
      }
      setMenuOpenId(null);
      return;
    }

    try {
      await deleteMutation.mutateAsync(record.id);
      if (editingId === record.id) {
        setEditingId(null);
        setEditingTitle("");
      }
      if (menuOpenId === record.id) setMenuOpenId(null);
      setError("");
    } catch (deleteError) {
      console.error("Interest delete error:", deleteError);
      setError(t("employees.interests.delete_failed"));
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white">
      <div className="flex items-center justify-between px-6 py-4.5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <span style={{ color: brandColor }}>
            <Heart className="w-4 h-4" />
          </span>
          <h3 className="text-[15px] font-bold text-slate-900 m-0">{t("employees.interests.title")}</h3>
          <span className="text-[12px] font-medium text-slate-400">{records.length}</span>
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={isSaving}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-slate-200 bg-white text-[12px] font-semibold cursor-pointer transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          style={{ color: brandColor }}
        >
          <Plus className="w-3.5 h-3.5" />
          {t("common.add")}
        </button>
      </div>

      <div className="px-6 pt-4 pb-5">
        {error && (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="py-5 flex items-center justify-center">
            <div
              className="w-6 h-6 rounded-full border-2 border-slate-200 animate-spin"
              style={{ borderTopColor: brandColor }}
            />
          </div>
        ) : records.length === 0 ? (
          <div className="py-2 text-[13px] text-slate-400">{t("employees.interests.none_added")}</div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {records.map((record) => (
              <div
                key={record.id}
                className="group relative inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50/70 px-3 py-2"
              >
                {editingId === record.id ? (
                  <>
                    <Heart className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={editingTitle}
                      onChange={(event) => setEditingTitle(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void saveEdit();
                        }
                        if (event.key === "Escape") {
                          event.preventDefault();
                          cancelEdit();
                        }
                      }}
                      placeholder={t("employees.interests.new_interest_placeholder")}
                      autoFocus
                      style={{
                        width: `${Math.max((editingTitle || t("employees.interests.new_interest_placeholder")).length + 1, 8)}ch`,
                      }}
                      className="max-w-[220px] bg-transparent border-none p-0 text-[13px] text-slate-800 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-emerald-200 bg-white text-emerald-600 hover:bg-emerald-50 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      title={t("common.save")}
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      disabled={isSaving}
                      className="inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                      title={t("common.cancel")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </>
                ) : (
                  <>
                    <Heart className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span className="text-[13px] text-slate-700 whitespace-nowrap">
                      {record.title}
                    </span>
                    <button
                      type="button"
                      data-interest-menu="true"
                      onClick={() =>
                        setMenuOpenId((prev) => (prev === record.id ? null : record.id))
                      }
                      className={`inline-flex items-center justify-center w-6 h-6 rounded-md border border-slate-200 bg-white text-slate-500 transition-all cursor-pointer ${
                        menuOpenId === record.id
                          ? "opacity-100"
                          : "opacity-0 group-hover:opacity-100"
                      }`}
                      title={t("employees.interests.actions")}
                    >
                      <MoreHorizontal className="w-3.5 h-3.5" />
                    </button>

                    {menuOpenId === record.id && (
                      <div
                        data-interest-menu="true"
                        className="absolute z-50 top-[calc(100%+6px)] right-0 w-32 rounded-lg border border-slate-200 bg-white shadow-lg p-1"
                      >
                        <button
                          type="button"
                          onClick={() => startEdit(record)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-slate-700 rounded-md hover:bg-slate-100 cursor-pointer"
                        >
                          <Pencil className="w-4 h-4" />
                          {t("common.edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(record)}
                          className="w-full flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-rose-600 rounded-md hover:bg-rose-50 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                          {t("common.delete")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default InterestsSection;
