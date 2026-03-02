import { useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import { useProductCategoriesQuery, useDeleteProductCategory } from "../../../../api/services/productCategory.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import Button from "../../../../components/ui/button/Button";
import { PlusIcon, TrashBinIcon, PencilIcon } from "../../../../icons";
import { Modal } from "../../../../components/ui/modal";
import Pagination from "../../../../components/pagination";

export default function ProductCategoriesList() {
  const [currentPage, setCurrentPage] = useState(1);
  const navigate = useNavigate();

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<string | null>(null);

  const limit = 10;

  const { data, isLoading } = useProductCategoriesQuery({
    params: { limit, offset: (currentPage - 1) * limit },
  });

  const deleteMutation = useDeleteProductCategory();

  const categories = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const handleCreate = () => {
    navigate("/settings/product-categories/new");
  };

  const handleEdit = (category: any) => {
    navigate(`/settings/product-categories/${category.guid || category.id}`);
  };

  const handleDeleteClick = (guid: string) => {
    setCategoryToDelete(guid);
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    if (categoryToDelete) {
      await deleteMutation.mutateAsync(categoryToDelete);
      setDeleteModalOpen(false);
      setCategoryToDelete(null);
    }
  };

  return (
    <>
      <PageMeta
        title="Категории продуктов | HRMS"
        description="Список категорий продуктов"
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Категории продуктов
          </h3>
          <Button variant="primary" startIcon={<PlusIcon />} onClick={handleCreate}>
            Добавить
          </Button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
                <TableRow>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400">#</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400">Название</TableCell>
                  <TableCell isHeader className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400">Действия</TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`skeleton-${index}`}>
                      <TableCell className="px-5 py-4"><div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div></TableCell>
                      <TableCell className="px-5 py-4"><div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse ml-auto"></div></TableCell>
                    </TableRow>
                  ))
                ) : categories.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={3} className="px-5 py-4 text-center text-gray-500 dark:text-gray-400">Нет данных</TableCell>
                  </TableRow>
                ) : (
                  categories.map((category: any, index: number) => (
                    <TableRow key={category.guid || category.id} className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors">
                      <TableCell className="px-5 py-4 text-center text-theme-sm text-gray-800 dark:text-white/90">
                        {(currentPage - 1) * limit + index + 1}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-theme-sm text-gray-800 dark:text-white/90">
                        {category.title}
                      </TableCell>
                      <TableCell className="px-5 py-4 text-end">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleEdit(category)}
                            className="text-gray-500 hover:text-brand-500 dark:text-gray-400 dark:hover:text-brand-500"
                          >
                            <PencilIcon className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDeleteClick(category.guid)}
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
              Удалить категорию?
            </h3>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
              Вы уверены, что хотите удалить эту категорию? Это действие нельзя будет отменить.
            </p>
            <div className="flex gap-3 w-full">
              <Button
                variant="outline"
                onClick={() => setDeleteModalOpen(false)}
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
      </div>
    </>
  );
}
