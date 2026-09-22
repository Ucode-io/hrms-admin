import { useState, useEffect } from "react";
import { Modal } from "../../../components/ui/modal";
import Button from "../../../components/ui/button/Button";
import Input from "../../../components/form/input/InputField";
import Label from "../../../components/form/Label";
import { useCreateMerchant, useUpdateMerchant } from "../../../api/services/merchant.service";
import { useTranslation } from "../../../i18n";

interface MerchantFormProps {
  isOpen: boolean;
  onClose: () => void;
  merchant?: any;
  mode: "create" | "edit";
}

export default function MerchantForm({ isOpen, onClose, merchant, mode }: MerchantFormProps) {
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    name: "",
    director_fio: "",
    phone: "",
    tin: "",
    bank: "",
    mfo: "",
    bank_account: "",
    area: "",
    region: "",
    address: "",
    status: ["active"],
  });

  const createMutation = useCreateMerchant();
  const updateMutation = useUpdateMerchant();

  useEffect(() => {
    if (merchant && mode === "edit") {
      setFormData({
        name: merchant.name || "",
        director_fio: merchant.director_fio || "",
        phone: merchant.phone || "",
        tin: merchant.tin || "",
        bank: merchant.bank || "",
        mfo: merchant.mfo || "",
        bank_account: merchant.bank_account || "",
        area: merchant.area || "",
        region: merchant.region || "",
        address: merchant.address || "",
        status: merchant.status || ["active"],
      });
    } else {
      setFormData({
        name: "",
        director_fio: "",
        phone: "",
        tin: "",
        bank: "",
        mfo: "",
        bank_account: "",
        area: "",
        region: "",
        address: "",
        status: ["active"],
      });
    }
  }, [merchant, mode, isOpen]);

  const handleChange = (field: string, value: string | number) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (mode === "create") {
        await createMutation.mutateAsync(formData);
      } else {
        await updateMutation.mutateAsync({
          guid: merchant.guid,
          data: {
            ...formData,
            guid: merchant.guid
          },
        });
      }
      onClose();
    } catch (error) {
      console.error("Error saving merchant:", error);
    }
  };

  const isLoading = createMutation.isLoading || updateMutation.isLoading;

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="max-w-[800px] m-4">
      <div className="no-scrollbar relative w-full max-w-[800px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-11">
        <div className="px-2 pr-14">
          <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">
            {mode === "create" ? "Добавить партнера" : "Редактировать партнера"}
          </h4>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400 lg:mb-7">
            {mode === "create"
              ? "Заполните форму для добавления нового партнера"
              : "Обновите информацию о партнере"}
          </p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="custom-scrollbar max-h-[500px] overflow-y-auto px-2 pb-3">
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div className="col-span-2 lg:col-span-1">
                <Label>Название магазина *</Label>
                <Input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  required
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>Ф.И.О партнера *</Label>
                <Input
                  type="text"
                  value={formData.director_fio}
                  onChange={(e) => handleChange("director_fio", e.target.value)}
                  required
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>Номер телефона *</Label>
                <Input
                  type="text"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  required
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>ИНН/ПИНФЛ *</Label>
                <Input
                  type="number"
                  value={formData.tin}
                  onChange={(e) => handleChange("tin", e.target.value)}
                  required
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>Банк</Label>
                <Input
                  type="text"
                  value={formData.bank}
                  onChange={(e) => handleChange("bank", e.target.value)}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>МФО</Label>
                <Input
                  type="text"
                  value={formData.mfo}
                  onChange={(e) => handleChange("mfo", e.target.value)}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>P/C</Label>
                <Input
                  type="number"
                  value={formData.bank_account}
                  onChange={(e) => handleChange("bank_account", e.target.value)}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>Область</Label>
                <Input
                  type="text"
                  value={formData.area}
                  onChange={(e) => handleChange("area", e.target.value)}
                />
              </div>

              <div className="col-span-2 lg:col-span-1">
                <Label>Регион</Label>
                <Input
                  type="text"
                  value={formData.region}
                  onChange={(e) => handleChange("region", e.target.value)}
                />
              </div>

              <div className="col-span-2">
                <Label>Адрес</Label>
                <Input
                  type="text"
                  value={formData.address}
                  onChange={(e) => handleChange("address", e.target.value)}
                />
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Отмена
            </Button>
            <Button size="sm" type="submit" disabled={isLoading}>
              {isLoading ? "Сохранение..." : mode === "create" ? "Создать" : "Сохранить"}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}

