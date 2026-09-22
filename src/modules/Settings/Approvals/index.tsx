import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import {
  MoreHorizontal,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import { DropdownItem } from "../../../components/ui/dropdown/DropdownItem";
import { type ApprovalProcess, getProcessTypeLabel } from "./mockData";
import {
  useApprovalProcessesQuery,
  useDeleteApprovalProcess,
} from "../../../api/services/approval.service";
import { useTranslation } from "../../../i18n";

export default function ApprovalsSettingsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: processes, isLoading } = useApprovalProcessesQuery();
  const deleteProcessMutation = useDeleteApprovalProcess();
  const items = useMemo(() => processes ?? [], [processes]);
  const [searchValue, setSearchValue] = useState("");
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<ApprovalProcess | null>(null);
  const [openActionsFor, setOpenActionsFor] = useState<string | null>(null);
  const actionButtonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const filteredItems = useMemo(() => {
    const query = searchValue.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) =>
      [item.title, getProcessTypeLabel(item.type, t)].some((field) =>
        field.toLowerCase().includes(query)
      )
    );
  }, [items, searchValue, t]);

  const toggleActionsMenu = (id: string) => {
    setOpenActionsFor((prev) => (prev === id ? null : id));
  };

  const openDeleteModal = (item: ApprovalProcess) => {
    setItemToDelete(item);
    setIsDeleteModalOpen(true);
    setOpenActionsFor(null);
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setItemToDelete(null);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteProcessMutation.mutateAsync(itemToDelete.id);
      toast.success(t("settings_approvals.list.delete_toast_success"));
      closeDeleteModal();
    } catch (error) {
      console.error("Failed to delete approval process:", error);
      toast.error(t("settings_approvals.list.delete_toast_error"));
    }
  };

  return (
    <>
      <PageMeta
        title={t("settings_approvals.list.page_meta_title")}
        description={t("settings_approvals.list.page_meta_description")}
      />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold text-gray-900">{t("settings_approvals.list.title")}</h1>
            <p className="mt-1 text-sm text-gray-500">
              {t("settings_approvals.list.subtitle")}
            </p>
          </div>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={() => navigate("/settings/approvals/new")}
          >
            {t("settings_approvals.list.add_button")}
          </Button>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 p-4">
            <label className="relative block">
              <Search
                size={18}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder={t("settings_approvals.list.search_placeholder")}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-700 placeholder:text-gray-400 focus:border-brand-300 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
              />
            </label>
          </div>

          <div className="max-w-full overflow-x-auto border-t border-gray-100">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_approvals.list.column_title")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_approvals.list.column_process")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    {t("settings_approvals.list.column_departments")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_approvals.list.column_stages")}
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    {t("settings_approvals.list.column_actions")}
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-10 text-center text-sm text-gray-500">
                      {isLoading ? t("settings_approvals.list.loading") : t("settings_approvals.list.empty")}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="transition-colors hover:bg-gray-50">
                      <TableCell className="px-4 py-3 text-sm text-gray-800">
                        <Link
                          to={`/settings/approvals/${item.id}`}
                          className="font-medium text-brand-600 transition hover:text-brand-700"
                        >
                          {item.title || t("settings_approvals.list.untitled")}
                        </Link>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        {getProcessTypeLabel(item.type, t)}
                      </TableCell>
                      <TableCell className="px-4 py-3 text-sm text-gray-700">
                        <div className="flex flex-wrap gap-1.5">
                          {item.departments.length === 0 ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            item.departments.map((dep) => (
                              <span
                                key={dep.id}
                                className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700"
                              >
                                {dep.title}
                              </span>
                            ))
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-3 text-right text-sm font-medium text-gray-700">
                        {item.stages.length}
                      </TableCell>
                      <TableCell className="px-4 py-3">
                        <div className="relative flex items-center justify-end">
                          <button
                            type="button"
                            onClick={() => toggleActionsMenu(item.id)}
                            className="dropdown-toggle rounded-md p-1.5 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            aria-label={t("settings_approvals.list.open_actions_aria")}
                            ref={(el) => {
                              actionButtonRefs.current[item.id] = el;
                            }}
                          >
                            <MoreHorizontal size={16} />
                          </button>

                          <Dropdown
                            isOpen={openActionsFor === item.id}
                            onClose={() => setOpenActionsFor(null)}
                            className="w-40 p-1"
                            usePortal
                            anchorEl={actionButtonRefs.current[item.id]}
                          >
                            <DropdownItem
                              onClick={() => navigate(`/settings/approvals/${item.id}`)}
                              className="rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-brand-500"
                            >
                              {t("settings_approvals.list.edit_action")}
                            </DropdownItem>
                            <DropdownItem
                              onClick={() => openDeleteModal(item)}
                              className="rounded-lg px-3 py-2 text-sm text-error-600 hover:bg-error-50 hover:text-error-700"
                            >
                              {t("settings_approvals.list.delete_action")}
                            </DropdownItem>
                          </Dropdown>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      <Modal
        isOpen={isDeleteModalOpen}
        onClose={closeDeleteModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[340px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">{t("settings_approvals.list.delete_modal_title")}</h3>
            <button
              type="button"
              onClick={closeDeleteModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label={t("settings_approvals.list.close_aria")}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4 text-center">
          <p className="text-sm text-gray-500">{t("settings_approvals.list.delete_irreversible")}</p>
          <p className="text-sm text-gray-700">
            {itemToDelete
              ? t("settings_approvals.list.delete_confirm_named", { title: itemToDelete.title })
              : t("settings_approvals.list.delete_confirm_generic")}
          </p>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              {t("settings_approvals.list.cancel")}
            </Button>
            <Button
              onClick={() => void confirmDelete()}
              disabled={deleteProcessMutation.isLoading}
              className="w-full justify-center bg-error-600 px-3 py-2 text-sm hover:bg-error-700"
            >
              {deleteProcessMutation.isLoading ? t("settings_approvals.list.deleting") : t("settings_approvals.list.delete_action")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
