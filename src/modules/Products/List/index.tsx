import { useState } from "react";
import { Link, useNavigate } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import { useTranslation } from "../../../i18n";
import { useMerchantProductsQuery } from "../../../api/services/contract.service";
import Badge from "../../../components/ui/badge/Badge";
import Button from "../../../components/ui/button/Button";
import Pagination from "../../../components/pagination";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";

export default function ProductsList() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useMerchantProductsQuery({
    params: { limit, offset: (currentPage - 1) * limit },
  });

  const products = data?.response || [];
  const totalCount = data?.count || 0;
  const totalPages = Math.ceil(totalCount / limit);

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "-";
    return new Intl.NumberFormat("ru-RU").format(amount) + " " + t("common.currency_sum");
  };

  return (
    <>
      <PageMeta
        title={t("products.list_title")}
        description={t("products.list_description")}
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
                  {t("products.breadcrumb_products")}
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              {t("products.breadcrumb_products")}
            </h3>
          </div>
          <Link to="/products/new">
            <Button size="sm">{t("products.add_plus")}</Button>
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
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("products.image")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("products.name")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("products.category")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    {t("products.merchant")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                  >
                    IKPU
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                  >
                    {t("products.price")}
                  </TableCell>
                  <TableCell
                    isHeader
                    className="px-3 py-2 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                  >
                    {t("products.unit")}
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
                        <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : products.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                    >
                      {t("products.no_data")}
                    </TableCell>
                  </TableRow>
                ) : (
                  products.map((product: any, index: number) => (
                    <TableRow
                      key={product.guid}
                      className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors cursor-pointer"
                      onClick={() => navigate(`/products/${product.guid}/edit`)}
                    >
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {(currentPage - 1) * limit + index + 1}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-10 w-10 rounded-lg object-cover"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                            <span className="text-gray-400 text-xs">—</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90 font-medium">
                        {product.name}
                      </TableCell>
                      <TableCell className="px-3 py-2.5">
                        {product.product_categories_id_data ? (
                          <Badge color="primary">
                            {product.product_categories_id_data.title}
                          </Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                        {product.merchants_id_data?.name || "-"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90 font-mono text-xs">
                        {product.ikpu || "-"}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90 text-end font-medium">
                        {formatAmount(product.price)}
                      </TableCell>
                      <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90 text-center">
                        {product.unit_of_measurement?.[0] || "-"}
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
      </div>
    </>
  );
}
