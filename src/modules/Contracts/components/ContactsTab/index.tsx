import { useContactsQuery } from "../../../../api/services/contact.service";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../../components/ui/table";
import { useTranslation } from "../../../../i18n";

interface ContactsTabProps {
  contractId: string;
}

export default function ContactsTab({ contractId }: ContactsTabProps) {
  const { t } = useTranslation();
  const { data, isLoading } = useContactsQuery({
    data: { contracts_id: contractId },
  });

  const contacts = data?.response || [];

  const formatPhoneNumber = (phone: number | string) => {
    if (!phone) return "-";
    const phoneStr = String(phone);
    // Format as +998 XX XXX XX XX if it's 9 digits
    if (phoneStr.length === 9) {
      return `+998 ${phoneStr.slice(0, 2)} ${phoneStr.slice(2, 5)} ${phoneStr.slice(5, 7)} ${phoneStr.slice(7)}`;
    }
    return phoneStr;
  };

  return (
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
                {t("contracts.contacts_tab.column_name")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.contacts_tab.column_phone")}
              </TableCell>
              <TableCell
                isHeader
                className="px-3 py-2 font-medium text-gray-500 text-start text-theme-xs dark:text-gray-400"
              >
                {t("contracts.contacts_tab.column_relation")}
              </TableCell>
            </TableRow>
          </TableHeader>

          <TableBody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <TableRow key={`skeleton-${index}`}>
                  <TableCell className="px-3 py-2.5">
                    <div className="h-4 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
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
                </TableRow>
              ))
            ) : contacts.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400"
                >
                  {t("contracts.contacts_tab.empty")}
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact: any, index: number) => (
                <TableRow
                  key={contact.guid}
                  className="hover:bg-gray-50 dark:hover:bg-white/[0.02] transition-colors"
                >
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {index + 1}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    {contact.full_name || "-"}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-gray-800 text-theme-sm dark:text-white/90">
                    <a
                      href={`tel:+998${contact.phone_number}`}
                      className="text-brand-500 hover:text-brand-600 hover:underline"
                    >
                      {formatPhoneNumber(contact.phone_number)}
                    </a>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400">
                      {contact.kinship_id_data?.kinship_type || "-"}
                    </span>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
