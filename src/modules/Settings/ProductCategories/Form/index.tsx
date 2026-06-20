import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import Button from "../../../../components/ui/button/Button";
import Input from "../../../../components/form/input/InputField";
import Label from "../../../../components/form/Label";
import {
  useCreateProductCategory,
  useUpdateProductCategory,
  useProductCategoryQuery,
} from "../../../../api/services/productCategory.service";
import Spinner from "../../../../components/ui/Spinner";

export default function ProductCategoryForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!id;

  const [title, setTitle] = useState("");

  const { data: categoryData, isLoading: isLoadingCategory } = useProductCategoryQuery({
    id: id || "",
    querySettings: { enabled: isEditMode },
  });

  const createMutation = useCreateProductCategory();
  const updateMutation = useUpdateProductCategory();

  const category = categoryData?.response || categoryData;

  useEffect(() => {
    if (category && isEditMode) {
      setTitle(category.title || "");
    }
  }, [category, isEditMode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = { title };

      if (isEditMode) {
        await updateMutation.mutateAsync({
          guid: category.guid,
          data: {
            ...payload,
            guid: category.guid
          },
        });
      } else {
        await createMutation.mutateAsync(payload);
      }
      navigate("/settings/product-categories");
    } catch (error) {
      console.error("Error saving category:", error);
    }
  };

  const handleCancel = () => {
    navigate("/settings/product-categories");
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading || (isEditMode && isLoadingCategory);

  return (
    <>
      <PageMeta
        title={isEditMode ? "Редактировать категорию | HRMS" : "Добавить категорию | HRMS"}
        description={isEditMode ? "Редактирование категории" : "Добавление новой категории"}
      />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
          {isEditMode ? "Редактировать категорию" : "Добавить категорию"}
        </h2>
        <nav>
          <ol className="flex items-center gap-1.5">
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/"
              >
                Главная
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
            <li>
              <Link
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400"
                to="/settings/product-categories"
              >
                Категории
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
              {isEditMode ? "Редактировать" : "Добавить"}
            </li>
          </ol>
        </nav>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5 lg:p-6 max-w-2xl mx-auto">
        {isLoading && isEditMode ? (
          <div className="flex items-center justify-center py-12">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div>
              <Label>Название *</Label>
              <Input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                placeholder="Введите название категории"
              />
            </div>

            <div className="flex items-center gap-3 mt-4 justify-end">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                type="button"
              >
                Отмена
              </Button>
              <Button size="sm" type="submit" disabled={isLoading}>
                {isLoading ? "Сохранение..." : isEditMode ? "Сохранить" : "Создать"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
