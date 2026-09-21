import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import DateInput from "../../../components/form/DateInput";
import AssigneeSelect, { type AssigneeOption } from "./AssigneeSelect";
import StatusBadge from "./StatusBadge";
import { useMoveProperty } from "../../../api/services/property.service";
import authStore from "../../../store/auth.store";
import {
  PROPERTY_STATUS_CONFIG,
  PROPERTY_STATUS_ORDER,
  type PropertyItem,
  type PropertyMovementInput,
  type PropertyStatus,
  createMovementInput,
} from "../types";

interface MovementModalProps {
  isOpen: boolean;
  item: PropertyItem | null;
  onClose: () => void;
  onSuccess: () => void;
}

const labelCls = "mb-1.5 block text-sm font-medium text-gray-700";
const inputCls =
  "h-11 w-full rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10";
const selectCls = `${inputCls} appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2220%22 height=%2220%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2394a3b8%22 stroke-width=%222%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%226 9 12 15 18 9%22/></svg>')] bg-[right_0.75rem_center] bg-no-repeat pr-10`;

const resolveAuthorId = (): string | null => {
  const user = authStore.user_data || authStore.user;
  return (user as { guid?: string } | null)?.guid ?? null;
};

export default function MovementModal({ isOpen, item, onClose, onSuccess }: MovementModalProps) {
  const [input, setInput] = useState<PropertyMovementInput | null>(null);
  const moveMutation = useMoveProperty();
  const menuPortalTarget = typeof document !== "undefined" ? document.body : null;

  useEffect(() => {
    if (isOpen && item) setInput(createMovementInput(item));
  }, [isOpen, item]);

  const hasChanges = useMemo(() => {
    if (!item || !input) return false;
    return (
      input.status !== item.status ||
      input.assignedToGuid !== item.assignedToGuid ||
      input.date !== item.assignedDate ||
      input.comment.trim().length > 0
    );
  }, [item, input]);

  if (!isOpen || !item || !input) return null;

  const isAssigned = input.status === "assigned";

  const handleStatusChange = (status: PropertyStatus) =>
    setInput((prev) =>
      prev
        ? status === "assigned"
          ? { ...prev, status }
          : { ...prev, status, assignedToGuid: null, assignedToName: null }
        : prev
    );

  const handleAssigneeChange = (option: AssigneeOption | null) =>
    setInput((prev) =>
      prev
        ? { ...prev, assignedToGuid: option?.value ?? null, assignedToName: option?.label ?? null }
        : prev
    );

  const handleSubmit = async () => {
    if (!input) return;
    try {
      await moveMutation.mutateAsync({
        properties_id: item.id,
        to_status: input.status,
        user_base_id: isAssigned ? input.assignedToGuid : null,
        movement_date: input.date,
        comment: input.comment.trim(),
        author_user_base_id: resolveAuthorId(),
      });
      toast.success("Движение сохранено");
      onSuccess();
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось сохранить движение");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false} className="m-4 max-w-[560px]">
      <div className="flex max-h-[90vh] flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Движение имущества</h3>
            <p className="mt-0.5 truncate text-sm text-gray-500">{item.name}</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-gray-200 text-gray-400 transition hover:bg-gray-50 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Transition preview */}
          <div className="mb-5 flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3">
            <StatusBadge status={item.status} />
            <ArrowRight size={16} className="text-gray-400" />
            <StatusBadge status={input.status} />
          </div>

          <div className="space-y-4">
            <div>
              <label className={labelCls}>Новый статус</label>
              <select className={selectCls} value={input.status}
                onChange={(e) => handleStatusChange(e.target.value as PropertyStatus)}>
                {PROPERTY_STATUS_ORDER.map((status) => (
                  <option key={status} value={status}>
                    {PROPERTY_STATUS_CONFIG[status].label}
                  </option>
                ))}
              </select>
            </div>

            <div className={`rounded-2xl border p-4 transition ${isAssigned ? "border-brand-100 bg-brand-50/40" : "border-gray-100 bg-gray-50/60"}`}>
              <label className={labelCls}>Назначено на</label>
              <AssigneeSelect
                value={input.assignedToGuid}
                label={input.assignedToName}
                onChange={handleAssigneeChange}
                isDisabled={!isAssigned}
                placeholder={isAssigned ? "Выберите сотрудника" : "Доступно при статусе «Выдано»"}
                menuPortalTarget={menuPortalTarget}
              />
            </div>

            <div>
              <label className={labelCls}>{isAssigned ? "Дата выдачи" : "Дата операции"}</label>
              <DateInput className={inputCls}
                value={input.date ?? ""}
                onChange={(next) => setInput((prev) => prev ? { ...prev, date: next || null } : prev)} />
            </div>

            <div>
              <label className={labelCls}>Комментарий</label>
              <textarea rows={3} className={`${inputCls} h-auto resize-none py-2.5`}
                placeholder="Причина изменения, состояние, дополнительная информация"
                value={input.comment}
                onChange={(e) => setInput((prev) => prev ? { ...prev, comment: e.target.value } : prev)} />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-6 py-4">
          <Button variant="outline" onClick={onClose} className="px-5">Отменить</Button>
          <Button onClick={handleSubmit} className="px-5"
            disabled={!hasChanges || moveMutation.isLoading}>
            {moveMutation.isLoading
              ? <><Loader2 size={15} className="animate-spin" /> Сохранение…</>
              : "Сохранить и записать в историю"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
