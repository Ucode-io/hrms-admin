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

export default function CompensationSettingsPage() {
  const [activeTab, setActiveTab] = useState("compensation-types");
  const [createRequestId, setCreateRequestId] = useState(0);

  const pageTitle =
    activeTab === "payment-schedule" ? "Графики оплаты" : "Виды компенсаций";

  return (
    <>
      <PageMeta title="Компенсация | Настройки" description="Настройки компенсации" />

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-3xl font-semibold text-gray-900">{pageTitle}</h1>
          <Button
            className="h-11"
            startIcon={<Plus size={16} />}
            onClick={() => setCreateRequestId((prev) => prev + 1)}
          >
            Добавить
          </Button>
        </div>

        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          defaultValue="compensation-types"
        >
          <TabsList className="mb-4">
            <TabsTrigger value="compensation-types">Виды компенсаций</TabsTrigger>
            <TabsTrigger value="payment-schedule">Графики оплаты</TabsTrigger>
          </TabsList>

          <TabsContent value="compensation-types">
            <CompensationDirectoryTab
              slug="compensation_types"
              emptyText="Виды компенсаций не найдены"
              createRequestId={createRequestId}
            />
          </TabsContent>

          <TabsContent value="payment-schedule">
            <CompensationDirectoryTab
              slug="payment_schedule"
              emptyText="Графики оплаты не найдены"
              createRequestId={createRequestId}
            />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
