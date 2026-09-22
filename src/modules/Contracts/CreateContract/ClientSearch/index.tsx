import { useState } from "react";
import { useNavigate } from "react-router";
import PageMeta from "../../../../components/common/PageMeta";
import { useUserSearch, useUserInvite } from "../../../../api/services/financeApi.service";
import Button from "../../../../components/ui/button/Button";
import Spinner from "../../../../components/ui/Spinner";
import { useTranslation } from "../../../../i18n";

interface UserData {
  guid: string;
  first_name: string;
  second_name: string;
  middle_name: string | null;
  phone_number: string;
  status: string;
  available_installment: number;
  limit_amount: number | null;
  total_debt: number;
}

export default function ClientSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [searchResult, setSearchResult] = useState<{
    searched: boolean;
    found: boolean;
    data: UserData | null;
    searchedPhone: string;
  }>({ searched: false, found: false, data: null, searchedPhone: "" });

  const userSearchMutation = useUserSearch();
  const userInviteMutation = useUserInvite();
  const [invitationSent, setInvitationSent] = useState(false);

  const formatPhoneInput = (value: string) => {
    const digits = value.replace(/\D/g, "");
    let formatted = "";
    if (digits.length > 0) {
      formatted = digits.slice(0, 2);
    }
    if (digits.length > 2) {
      formatted += " " + digits.slice(2, 5);
    }
    if (digits.length > 5) {
      formatted += "-" + digits.slice(5, 7);
    }
    if (digits.length > 7) {
      formatted += "-" + digits.slice(7, 9);
    }
    return formatted;
  };

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "").slice(-9);
    if (digits.length === 9) {
      return `+998 ${digits.slice(0, 2)} ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
    }
    return phone;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneInput(e.target.value);
    setPhoneNumber(formatted);
  };

  const getFullPhoneNumber = () => {
    const digits = phoneNumber.replace(/\D/g, "");
    return `+998${digits}`;
  };

  const handleSearch = async () => {
    const fullPhone = getFullPhoneNumber();
    setInvitationSent(false);

    try {
      const result = await userSearchMutation.mutateAsync(fullPhone);

      if (result?.data && result.data.length > 0) {
        setSearchResult({
          searched: true,
          found: true,
          data: result.data[0],
          searchedPhone: fullPhone,
        });
      } else {
        setSearchResult({
          searched: true,
          found: false,
          data: null,
          searchedPhone: fullPhone,
        });
      }
    } catch (error) {
      console.error("Search error:", error);
      setSearchResult({
        searched: true,
        found: false,
        data: null,
        searchedPhone: fullPhone,
      });
    }
  };

  const handleSendInvitation = async () => {
    const fullPhone = searchResult.searchedPhone || getFullPhoneNumber();
    try {
      await userInviteMutation.mutateAsync(fullPhone);
      setInvitationSent(true);
    } catch (error) {
      console.error("Invitation error:", error);
    }
  };

  const formatAmount = (amount: number) => {
    if (!amount && amount !== 0) return "0";
    return new Intl.NumberFormat("ru-RU").format(amount);
  };

  const isSearchDisabled = phoneNumber.replace(/\D/g, "").length < 9;

  return (
    <>
      <PageMeta title={t("contracts.client_search.page_title")} description={t("contracts.client_search.page_description")} />

      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          {t("contracts.client_search.title")}
        </h1>

        {/* Search Section */}
        <div className="mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            <label className="text-sm text-gray-600 dark:text-gray-400 whitespace-nowrap">
              {t("contracts.client_search.check_label")}
            </label>

            <div className="flex flex-1 items-center w-full max-w-sm">
              <div className="flex items-center px-3 py-2.5 bg-white dark:bg-gray-900 border border-r-0 border-gray-300 dark:border-gray-600 rounded-l-lg">
                <span className="text-gray-400 dark:text-gray-500 font-medium">+998</span>
              </div>
              <input
                type="text"
                value={phoneNumber}
                onChange={handlePhoneChange}
                placeholder={t("contracts.client_search.phone_placeholder")}
                maxLength={12}
                className="flex-1 min-w-0 px-3 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-r-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
              />
            </div>

            <Button
              variant="primary"
              onClick={handleSearch}
              disabled={isSearchDisabled || userSearchMutation.isLoading}
              className="whitespace-nowrap"
            >
              {t("contracts.client_search.check_button")}
            </Button>
          </div>
        </div>

        {/* Loading State */}
        {userSearchMutation.isLoading && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-6">
            <div className="flex flex-col items-center justify-center gap-3">
              <Spinner className="w-6 h-6" />
              <p className="text-gray-500 dark:text-gray-400 text-sm">{t("contracts.client_search.searching")}</p>
            </div>
          </div>
        )}

        {/* Results Section */}
        {!userSearchMutation.isLoading && searchResult.searched && (
          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-5">
            {searchResult.found && searchResult.data ? (
              <>
                <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">
                  {t("contracts.client_search.result_title")}
                </h2>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                  {/* Client Info */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center">
                      <svg className="w-4 h-4 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-brand-600 dark:text-brand-400 text-sm">
                        {searchResult.data.second_name} {searchResult.data.first_name}
                      </p>
                      <p className="text-xs text-brand-500 dark:text-brand-400">
                        {formatPhoneDisplay(searchResult.data.phone_number)}
                      </p>
                    </div>
                  </div>

                  {/* Available Installment */}
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{t("contracts.client_search.available_limit_label")}</p>
                      <p className="font-medium text-brand-600 dark:text-brand-400 text-sm">
                        {t("contracts.client_search.amount_suffix", {
                          amount: formatAmount(searchResult.data.available_installment || searchResult.data.limit_amount || 0),
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Total Debt */}
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{t("contracts.client_search.total_debt_label")}</p>
                    <p className="font-medium text-amber-600 dark:text-amber-400 text-sm">
                      {t("contracts.client_search.amount_suffix", { amount: formatAmount(searchResult.data.total_debt) })}
                    </p>
                  </div>

                  {/* Status Badge */}
                  <div className="ml-auto">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${searchResult.data.status === 'approved'
                      ? 'bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800'
                      : searchResult.data.status === 'pending'
                        ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800'
                        : 'bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'
                      }`}>
                      {searchResult.data.status === 'approved'
                        ? t("contracts.client_search.status_approved")
                        : searchResult.data.status === 'pending'
                          ? t("contracts.client_search.status_pending")
                          : searchResult.data.status}
                    </span>
                  </div>
                </div>

                {/* Action Button */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      sessionStorage.setItem('contractClientData', JSON.stringify(searchResult.data));
                      navigate(`/contracts/create/form?client=${searchResult.data?.guid}`);
                    }}
                  >
                    {t("contracts.client_search.create_contract")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-6">
                  {invitationSent ? (
                    <>
                      {/* Success Illustration */}
                      <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                        {t("contracts.client_search.invitation_sent")}
                      </h3>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {t("contracts.client_search.invitation_sent_to", { phone: formatPhoneDisplay(searchResult.searchedPhone) })}
                      </p>
                    </>
                  ) : (
                    <>
                      {/* Not Found Illustration */}
                      <div className="flex justify-center mb-6">
                        <div className="relative w-36 h-36">
                          {/* Background blob */}
                          <div className="absolute inset-0 rounded-full bg-gradient-to-br from-brand-100 via-purple-100 to-brand-50 dark:from-brand-900/30 dark:via-purple-900/20 dark:to-brand-800/10" />

                          {/* Documents illustration */}
                          <div className="absolute inset-0 flex items-center justify-center">
                            {/* Back document */}
                            <div className="absolute w-16 h-20 bg-white dark:bg-gray-700 rounded-lg shadow-md transform rotate-6 translate-x-3">
                              <div className="p-1.5 space-y-1">
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded w-full" />
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded w-3/4" />
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded w-1/2" />
                              </div>
                            </div>

                            {/* Front document */}
                            <div className="absolute w-16 h-20 bg-white dark:bg-gray-700 rounded-lg shadow-lg transform -rotate-6 -translate-x-1">
                              <div className="p-1.5 space-y-1">
                                <div className="h-1.5 bg-brand-200 dark:bg-brand-700 rounded w-full" />
                                <div className="h-1.5 bg-gray-200 dark:bg-gray-600 rounded w-3/4" />
                                <div className="h-6 bg-gray-100 dark:bg-gray-600 rounded mt-1.5" />
                              </div>
                              {/* X mark */}
                              <div className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-0.5">
                        {t("contracts.client_search.not_found_title")}
                      </h3>
                      <p className="text-lg font-bold text-gray-900 dark:text-white mb-3">
                        {t("contracts.client_search.not_found_phone", { phone: formatPhoneDisplay(searchResult.searchedPhone) })}
                      </p>
                      <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-xs mx-auto text-sm leading-relaxed">
                        {t("contracts.client_search.not_found_hint_1")}<br />
                        {t("contracts.client_search.not_found_hint_2")}
                      </p>

                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                          variant="outline"
                          className="min-w-[180px]"
                          onClick={() => {
                            navigate(`/contracts/create/form?client_phone=${encodeURIComponent(searchResult.searchedPhone)}`);
                          }}
                        >
                          {t("contracts.client_search.create_contract")}
                        </Button>
                        <Button
                          variant="primary"
                          className="bg-gray-900 hover:bg-gray-800 dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100 min-w-[180px]"
                          onClick={handleSendInvitation}
                          disabled={userInviteMutation.isLoading}
                        >
                          {userInviteMutation.isLoading ? t("contracts.client_search.sending") : t("contracts.client_search.send_invitation_button")}
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </>
  );
}
