import {
  useState,
  useEffect,
  useCallback,
  useRef,
} from "react";
import { Link } from "react-router";
import PageMeta from "../../../components/common/PageMeta";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSetting,
} from "../../../api/services/platformSetting.service";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import Spinner from "../../../components/ui/Spinner";
import { useTranslation } from "../../../i18n";

interface Setting {
  guid: string;
  key: string;
  title: string;
  type: string[];
  value: string;
}

export default function PlatformSettingsPage() {
  const { t } = useTranslation();
  const { data, isLoading } = usePlatformSettingsQuery();
  const updateMutation = useUpdatePlatformSetting();

  const [localValues, setLocalValues] = useState<Record<string, string>>({});
  const [savingFields, setSavingFields] = useState<Record<string, boolean>>({});
  const [savedFields, setSavedFields] = useState<Record<string, boolean>>({});
  const debounceTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const settings: Setting[] = data?.response || [];

  // Initialize local values when data loads
  useEffect(() => {
    if (settings.length > 0) {
      const values: Record<string, string> = {};
      settings.forEach((setting) => {
        values[setting.guid] = setting.value;
      });
      setLocalValues(values);
    }
  }, [settings]);

  const handleSave = useCallback(async (setting: Setting, value: string) => {
    setSavingFields((prev) => ({ ...prev, [setting.guid]: true }));
    setSavedFields((prev) => ({ ...prev, [setting.guid]: false }));

    try {
      await updateMutation.mutateAsync({
        guid: setting.guid,
        data: {
          guid: setting.guid,
          key: setting.key,
          title: setting.title,
          type: setting.type,
          value: value,
        },
      });
      setSavedFields((prev) => ({ ...prev, [setting.guid]: true }));
      // Clear saved indicator after 2 seconds
      setTimeout(() => {
        setSavedFields((prev) => ({ ...prev, [setting.guid]: false }));
      }, 2000);
    } catch (error) {
      console.error("Error saving setting:", error);
    } finally {
      setSavingFields((prev) => ({ ...prev, [setting.guid]: false }));
    }
  }, [updateMutation]);

  const handleChange = useCallback((setting: Setting, value: string) => {
    setLocalValues((prev) => ({ ...prev, [setting.guid]: value }));

    // Clear existing timer
    if (debounceTimers.current[setting.guid]) {
      clearTimeout(debounceTimers.current[setting.guid]);
    }

    // Set new debounce timer (800ms)
    debounceTimers.current[setting.guid] = setTimeout(() => {
      handleSave(setting, value);
    }, 800);
  }, [handleSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      Object.values(debounceTimers.current).forEach(clearTimeout);
    };
  }, []);

  if (isLoading) {
    return (
      <>
        <PageMeta title={t("settings_misc.platform_settings.page_title")} description={t("settings_misc.platform_settings.page_description")} />
        <div className="flex items-center justify-center min-h-[400px]">
          <Spinner />
        </div>
      </>
    );
  }

  return (
    <>
      <PageMeta
        title={t("settings_misc.platform_settings.page_title")}
        description={t("settings_misc.platform_settings.page_description")}
      />
      <div className="space-y-6">
        {/* Breadcrumb */}
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
                  {t("settings_misc.platform_settings.heading")}
                </li>
              </ol>
            </nav>
            <h3 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              {t("settings_misc.platform_settings.heading")}
            </h3>
          </div>
        </div>

        {/* Settings Form */}
        <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
          <div className="p-6">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {settings.map((setting) => (
                <div key={setting.guid} className="relative">
                  <div className="flex items-center justify-between mb-2">
                    <Label>{setting.title}</Label>
                    <div className="flex items-center gap-2">
                      {savingFields[setting.guid] && (
                        <span className="text-xs text-gray-400 flex items-center gap-1">
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          {t("settings_misc.platform_settings.saving")}
                        </span>
                      )}
                      {savedFields[setting.guid] && !savingFields[setting.guid] && (
                        <span className="text-xs text-success-500 flex items-center gap-1">
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          {t("settings_misc.platform_settings.saved")}
                        </span>
                      )}
                    </div>
                  </div>
                  <Input
                    type={setting.type[0] === "number_input" ? "number" : "text"}
                    value={localValues[setting.guid] ?? setting.value}
                    onChange={(e) => handleChange(setting, e.target.value)}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
