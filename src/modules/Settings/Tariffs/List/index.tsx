import { useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import { useTariffsQuery, useDeleteTariff } from "../../../../api/services/tariff.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import Badge from "../../../../components/ui/badge/Badge";
import Button from "../../../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../../../icons";
import { Modal } from "../../../../components/ui/modal";
import Pagination from "../../../../components/pagination";
import { useTranslation } from "../../../../i18n";

export default function TariffsList() {
  const { t } = useTranslation();
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [tariffToDelete, setTariffToDelete] = useState<string | null>(null);

  const limit = 10;

  const { data, isLoading } = useTariffsQuery({
    params: { limit, offset: (currentPage - 1) * limit },
  });

  const deleteMutation = useDeleteTariff();

  const tariffs = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const handleCreate = () => {
    navigate("/settings/tariffs/new");
  };

  const handleEdit = (tariff: any) => {
    navigate(`/settings/tariffs/${tariff.guid || tariff.id}`);
  };

  const handleDeleteClick = (guid: string) => {
    setTariffToDelete(guid);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (tariffToDelete) {
      await deleteMutation.mutateAsync(tariffToDelete);
      setDeleteModalOpen(false);
      setTariffToDelete(null);
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    return date.toLocaleString("ru-RU", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string[]) => {
    if (!status || status.length === 0) return null;
    const statusValue = status[0]?.toLowerCase();

    if (statusValue === "active") {
      return <Badge size="sm" color="success">Active</Badge>;
    }
    return <Badge size="sm" color="warning">Inactive</Badge>;
  };

  return (
    <>
      <PageMeta
        title={t("settings_tariffs.page_title")}
        description={t("settings_tariffs.page_description")}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {t("settings_tariffs.heading")}
          </h3>
          <Button variant="primary" startIcon={<PlusIcon />} onClick={handleCreate}>
            {t("settings_tariffs.add_button")}
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">{t("settings_tariffs.number")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">{t("settings_tariffs.id")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">{t("settings_tariffs.period")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">{t("settings_tariffs.commission")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">{t("settings_tariffs.category")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">{t("settings_tariffs.merchant")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">{t("settings_tariffs.status")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">{t("settings_tariffs.created_date")}</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">{t("settings_tariffs.actions")}</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="px-5 py-4"><div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto"></div></TableCell>
                    </TableRow>
                  ))
                ) : tariffs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={9} className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">{t("settings_tariffs.no_data")}</TableCell>
                  </TableRow>
                ) : (
                  tariffs.map((tariff: any, index: number) => (
                    <TableRow key={tariff.guid || tariff.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4 text-center text-theme-sm text-gray-800 dark:text-white/90">
                        {(currentPage - 1) * limit + index + 1}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90">
                        {tariff.id}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center text-theme-sm text-gray-800 dark:text-white/90">
                        {tariff.period}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-center text-theme-sm text-gray-800 dark:text-white/90">
                        {tariff.commission_percentage}%
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90">
                        {tariff.product_categories_id_data?.title || "-"}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90">
                        {tariff.merchants_id_data?.name || "-"}
                      </TableCell>
                      <TableCell className="px-5 py-4">
                        {getStatusBadge(tariff.status)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90">
                        {formatDate(tariff.created__at || tariff.created_at)}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(tariff)}
                            className="text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(tariff.guid)}
                            className="text-gray-500 hover:text-error-500 dark:text-gray-400 dark:hover:text-error-500"
                          >
                            <TrashBinIcon className="w-5 h-5" />
                          </button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalCount={totalCount}
            limit={limit}
            onPageChange={setCurrentPage}
          />
        </div>

        <Modal isOpen={deleteModalOpen} onClose={() => setDeleteModalOpen(false)} className="max-w-[400px] p-6">
          <div className="flex flex-col items-center text-center">
            <div className="mb-4 text-error-500 bg-error-50 dark:bg-error-500/10 p-4 rounded-full">
              <TrashBinIcon className="w-8 h-8" />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
              {t("settings_tariffs.delete_heading")}
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              {t("settings_tariffs.delete_confirmation")}
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
                className="w-full justify-center"
              >
                {t("settings_tariffs.cancel")}
              </Button>
              <Button
                variant="primary"
                className="w-full justify-center bg-error-600 hover:bg-error-700 border-error-600"
                onClick={confirmDelete}
              >
                {t("settings_tariffs.delete")}
              </Button>
            </div>
          </div>
        </Modal>
      </div>
    </>
  );
}
