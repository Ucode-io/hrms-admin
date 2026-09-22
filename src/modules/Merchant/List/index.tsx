import { useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useMerchantsQuery } from "../../../api/services/merchant.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import Badge from "../../../components/ui/badge/Badge";
// import { Dropdown } from "../../../components/ui/dropdown/Dropdown";
import Button from "../../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon } from "../../../icons";
import { Modal } from "../../../components/ui/modal";
import { useDeleteMerchant } from "../../../api/services/merchant.service";
import { useTranslation } from "../../../i18n";

export default function MerchantsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = useState({
    id: "",
    name: "",
    director_fio: "",
    phone: "",
    tin: "",
    status: "",
    date: "",
  });

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [merchantToDelete, setMerchantToDelete] = useState<string | null>(null);

  const deleteMutation = useDeleteMerchant();

  const { data, isLoading } = useMerchantsQuery({
    params: filters,
  });

  const merchants = data?.response || [];

  /* const handleFilterChange removed */

  const handleDeleteClick = (guid: string) => {
    setMerchantToDelete(guid);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (merchantToDelete) {
      await deleteMutation.mutateAsync(merchantToDelete);
      setDeleteModalOpen(false);
      setMerchantToDelete(null);
    }
  };

  const closeDeleteModal = () => {
    setDeleteModalOpen(false);
    setMerchantToDelete(null);
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
      second: "2-digit",
    });
  };

  const getStatusBadge = (status: string[]) => {
    if (!status || status.length === 0) return null;
    const statusValue = status[0]?.toLowerCase();
    if (statusValue === "active") {
      return (
        <Badge size="sm" color="success">
          Активный
        </Badge>
      );
    }
    return (
      <Badge size="sm" color="warning">
        Неактивный
      </Badge>
    );
  };

  return (
    <>
      <PageMeta
        title="Партнеры | HRMS"
        description="Список партнеров"
      />
      <div className="space-y-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex flex-col gap-2">
            <nav>
              <ol className="flex items-center gap-1.5">
                <li>
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                    to="/"
                  >
                    Home
                    <svg
                      className="stroke-current"
                      width="17"
                      height="16"
                      viewBox="0 0 17 16"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.0765 12.667L10.2432 8.50033L6.0765 4.33366"
                        stroke=""
                        strokeWidth="1.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </li>
                <li className="text-sm text-gray-800 dark:text-white/90">
                  Партнеры
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Партнеры
            </h3>
          </div>
          <Link to="/merchants/new">
            <Button variant="primary" startIcon={<PlusIcon />}>
              Добавить
            </Button>
          </Link>
        </div>
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    #
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    ID
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    Название магазина
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    Ф.И.О партнера
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    Номер телефона
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    ИНН/ПИНФЛ
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    Статус
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Тип
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    Logo
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400 relative"
                  >
                    Дата создания
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    Действия
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  Array.from({ length: 8 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5" colSpan={5}>
                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : merchants.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                    >
                      Нет данных
                    </TableCell>
                  </TableRow>
                ) : (
                  merchants.map((merchant: any, index: number) => (
                    <TableRow
                      key={merchant.guid || merchant.id}
                      onClick={() => navigate(`/merchants/${merchant.guid}`)}
                      className="cursor-pointer hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {index + 1}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        <span className="text-brand-500">
                          {merchant.id}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        <span className="text-brand-500">
                          {merchant.name}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {merchant.director_fio}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {merchant.phone}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {merchant.tin}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {getStatusBadge(merchant.status)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        Из нашего баланса
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {merchant.logo ? (
                          <div className="w-10 h-10 overflow-hidden rounded border border-gray-200 dark:border-gray-700">
                            <img
                              src={merchant.logo}
                              alt={merchant.name}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = "none";
                              }}
                            />
                          </div>
                        ) : (
                          <div className="w-10 h-10 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded flex items-center justify-center relative">
                            <svg
                              className="w-6 h-6 text-gray-400"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                              />
                            </svg>
                            <span className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-full border border-white"></span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-500 text-theme-sm dark:text-gray-400">
                        {formatDate(merchant.created_at || merchant.createdAt || "")}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteClick(merchant.guid || merchant.id);
                            }}
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
        </div>
      </div>

      <Modal isOpen={deleteModalOpen} onClose={closeDeleteModal} className="max-w-[400px] p-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 text-error-500 bg-error-50 dark:bg-error-500/10 p-4 rounded-full">
            <TrashBinIcon className="w-8 h-8" />
          </div>
          <h3 className="mb-2 text-xl font-semibold text-gray-800 dark:text-white">
            Удалить партнера?
          </h3>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
            Вы уверены, что хотите удалить этого партнера? Это действие нельзя будет отменить.
          </p>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={closeDeleteModal}
              className="w-full justify-center"
            >
              Отмена
            </Button>
            <Button
              variant="primary"
              className="w-full justify-center bg-error-600 hover:bg-error-700 border-error-600"
              onClick={confirmDelete}
            >
              Удалить
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

