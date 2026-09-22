import { useContractProductsQuery } from "../../../../api/services/contract.service";
import Spinner from "../../../../components/ui/Spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import encodeJsonToUrlParam from "../../../../utils/encodeJsonToUrlParam";
import { useTranslation } from "../../../../i18n";

interface ProductsTabProps {
  contractId: string;
}

export default function ProductsTab({ contractId }: ProductsTabProps) {
  const { t } = useTranslation();
  const { data: productsData, isLoading } = useContractProductsQuery({
    params: {
      data: encodeJsonToUrlParam({ contracts_id: contractId })
    },
  });

  const products = productsData?.response || [];

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "-";
    return t("contracts.common.amount_suffix", { amount: new Intl.NumberFormat("ru-RU").format(amount) });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
        <p className="text-gray-500 dark:text-gray-400">{t("contracts.products_tab.empty")}</p>
      </div>
    );
  }

  // Calculate total
  const totalAmount = products.reduce((sum: number, item: any) => sum + (item.price * (item.quantity || 1)), 0);
  const totalCount = products.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0);

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t("contracts.products_tab.total_count_label")}</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{t("contracts.products_tab.count_value", { count: totalCount })}</p>
        </div>
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-4">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t("contracts.products_tab.total_amount_label")}</p>
          <p className="text-lg font-semibold text-gray-800 dark:text-white/90">{formatAmount(totalAmount)}</p>
        </div>
      </div>

      {/* Products table */}
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
        <div className="max-w-full overflow-x-auto">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-white/[0.05]">
              <TableRow>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  №
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  {t("contracts.products_tab.column_name")}
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
                >
                  IKPU
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                >
                  {t("contracts.products_tab.column_price")}
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-center text-theme-xs dark:text-gray-400"
                >
                  {t("contracts.products_tab.column_quantity")}
                </TableCell>
                <TableCell
                  isHeader
                  className="px-5 py-3 font-medium text-gray-500 text-end text-theme-xs dark:text-gray-400"
                >
                  {t("contracts.products_tab.column_amount")}
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
              {products.map((product: any, index: number) => (
                <TableRow key={product.guid}>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-center">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 font-medium">
                    {product.name}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 font-mono text-xs">
                    {product.ikpu || "-"}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-end font-medium">
                    {formatAmount(product.price)}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-center">
                    {product.quantity || 1}
                  </TableCell>
                  <TableCell className="px-5 py-4 text-gray-800 text-theme-sm dark:text-white/90 text-end font-medium">
                    {formatAmount(product.price * (product.quantity || 1))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
