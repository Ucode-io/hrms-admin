import { X } from "lucide-react";
import Select from "react-select";
import Button from "../../../../components/ui/button/Button";
import { Modal } from "../../../../components/ui/modal";
import EmployeeInfiniteSelect from "../../../../components/autocomplete/EmployeeInfiniteSelect";
import type { Option } from "../types";
import { getDepartmentSelectStyles } from "../utils";

interface DepartmentUpsertModalProps {
  isOpen: boolean;
  isSaving: boolean;
  isEditing: boolean;
  departmentTitle: string;
  parentDepartmentId: string;
  leaderUserId: string;
  leaderFallbackLabel?: string;
  parentOptions: Option[];
  onClose: () => void;
  onDepartmentTitleChange: (value: string) => void;
  onParentDepartmentChange: (value: string) => void;
  onLeaderChange: (value: string) => void;
  onSubmit: () => void;
}

export default function DepartmentUpsertModal({
  isOpen,
  isSaving,
  isEditing,
  departmentTitle,
  parentDepartmentId,
  leaderUserId,
  leaderFallbackLabel,
  parentOptions,
  onClose,
  onDepartmentTitleChange,
  onParentDepartmentChange,
  onLeaderChange,
  onSubmit,
}: DepartmentUpsertModalProps) {
  const selectedParentOption =
    parentOptions.find((option) => option.value === parentDepartmentId) || parentOptions[0];
  const menuPortalTarget = typeof document !== "undefined" ? document.body : undefined;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      showCloseButton={false}
      className="mx-4 w-full max-w-[560px] overflow-hidden rounded-2xl border border-gray-200 shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3.5">
        <h3 className="text-xl font-semibold text-gray-900">
          {isEditing ? "Изменить департамент" : "Новый департамент"}
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
          aria-label="Закрыть"
        >
          <X size={18} />
        </button>
      </div>

      <div className="space-y-3 px-4 py-4">
        <div>
          <label htmlFor="department-title" className="mb-1.5 block text-sm font-medium text-gray-700">
            Название
          </label>
          <input
            id="department-title"
            value={departmentTitle}
            onChange={(event) => onDepartmentTitleChange(event.target.value)}
            placeholder="Введите название департамента"
            autoFocus
            className="h-9 w-full rounded-lg border border-gray-300 px-3 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Родительский департамент
          </label>
          <Select
            options={parentOptions}
            value={selectedParentOption}
            onChange={(option) => onParentDepartmentChange(option?.value || "")}
            placeholder="Выберите департамент"
            isSearchable
            styles={getDepartmentSelectStyles()}
            menuPortalTarget={menuPortalTarget}
            menuPosition="fixed"
            classNamePrefix="department-parent-select"
            noOptionsMessage={() => "Ничего не найдено"}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Руководитель
          </label>
          <EmployeeInfiniteSelect
            value={leaderUserId}
            onChange={onLeaderChange}
            fallbackLabel={leaderFallbackLabel}
            placeholder="Выберите руководителя"
            styles={getDepartmentSelectStyles()}
            menuPortalTarget={menuPortalTarget}
            classNamePrefix="department-leader-select"
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 px-4 py-3">
        <Button
          variant="outline"
          onClick={onClose}
          className="min-w-[96px] px-3 py-2 text-sm"
        >
          Отмена
        </Button>
        <Button onClick={onSubmit} disabled={isSaving} className="min-w-[110px] px-3 py-2 text-sm">
          {isSaving ? "Сохранение..." : "Сохранить"}
        </Button>
      </div>
    </Modal>
  );
}
