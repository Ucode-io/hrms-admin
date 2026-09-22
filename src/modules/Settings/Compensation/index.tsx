import { useState } from "react";

import { Plus } from "lucide-react";
import PageMeta from "../../../components/common/PageMeta";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../../../components/ui/tabs";
import Button from "../../../components/ui/button/Button";
import CompensationDirectoryTab from "./components/CompensationDirectoryTab";
import { useTranslation } from "../../../i18n";

export default function CompensationSettingsPage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState("compensation-types");
  const [createRequestId, setCreateRequestId] = useState(0);

  const pageTitle =
    activeTab === "payment-schedule"
      ? t("settings_compensation.tab.payment_schedule")
      : t("settings_compensation.tab.compensation_types");

  return (
    <>
      <PageMeta title={t("settings_compensation.page_meta.title")} description={t("settings_compensation.page_meta.description")} />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateRequestId((prev) => prev + 1)}
          >
            {t("settings_compensation.action.add")}
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="compensation-types"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="compensation-types">{t("settings_compensation.tab.compensation_types")}</TabsTrigger>
            <TabsTrigger value="payment-schedule">{t("settings_compensation.tab.payment_schedule")}</TabsTrigger>
          </TabsList>

          <TabsContent value="compensation-types">
            <CompensationDirectoryTab
              slug="compensation_types"
              emptyText={t("settings_compensation.empty.compensation_types")}
              createRequestId={createRequestId}
            />
          </TabsContent>

          <TabsContent value="payment-schedule">
            <CompensationDirectoryTab
              slug="payment_schedule"
              emptyText={t("settings_compensation.empty.payment_schedule")}
              createRequestId={createRequestId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
