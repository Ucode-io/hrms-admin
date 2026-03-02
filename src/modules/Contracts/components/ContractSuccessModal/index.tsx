import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { QRCodeSVG } from 'qrcode.react';
import { Modal } from '../../../../components/ui/modal';
import Button from '../../../../components/ui/button/Button';
import { CheckCircle, Smartphone, XCircle, Loader2, Clock } from 'lucide-react';
import contractService from '../../../../api/services/contract.service';

interface ContractSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  contractId: string;
  isNewClient?: boolean; // Indicates if contract was created with phone number only (no client_id)
}

type ContractStatus = 'new' | 'accepted' | 'cancelled' | 'loading';

export default function ContractSuccessModal({ isOpen, onClose, contractId, isNewClient = false }: ContractSuccessModalProps) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ContractStatus>('new');
  const [isPolling, setIsPolling] = useState(true);

  const checkContractStatus = useCallback(async () => {
    if (!contractId || !isOpen) return;

    try {
      const response = await contractService.get(contractId);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = response as any;
      const contractStatus = data?.status?.[0]?.toLowerCase() || data?.response?.status?.[0]?.toLowerCase() || 'new';

      if (contractStatus === 'accepted' || contractStatus === 'cancelled') {
        setStatus(contractStatus);
        setIsPolling(false);
      }
    } catch (error) {
      console.error('Error checking contract status:', error);
    }
  }, [contractId, isOpen]);

  useEffect(() => {
    if (!isOpen || !contractId) {
      setStatus('new');
      setIsPolling(true);
      return;
    }

    // Начальная проверка
    checkContractStatus();

    // Polling каждые 5 секунд
    const interval = setInterval(() => {
      if (isPolling) {
        checkContractStatus();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isOpen, contractId, isPolling, checkContractStatus]);

  const handleClose = () => {
    setStatus('new');
    setIsPolling(true);
    onClose();
    navigate('/contracts');
  };

  // Контент для разных статусов
  const renderContent = () => {
    switch (status) {
      case 'accepted':
        return (
          <>
            {/* Success Icon */}
            <div className="mb-4 text-green-500 bg-green-50 dark:bg-green-900/20 p-4 rounded-full">
              <CheckCircle className="w-12 h-12" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Контракт подтверждён!
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Клиент успешно подтвердил контракт в мобильном приложении.
            </p>

            {/* Contract ID */}
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6 w-full">
              <p className="text-sm text-green-700 dark:text-green-400">
                ID контракта: <span className="font-mono font-medium">{contractId}</span>
              </p>
            </div>

            {/* Close Button */}
            <Button
              variant="primary"
              onClick={handleClose}
              className="w-full justify-center"
            >
              Готово
            </Button>
          </>
        );

      case 'cancelled':
        return (
          <>
            {/* Error Icon */}
            <div className="mb-4 text-red-500 bg-red-50 dark:bg-red-900/20 p-4 rounded-full">
              <XCircle className="w-12 h-12" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Контракт отклонён
            </h2>

            {/* Description */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              Клиент отклонил контракт в мобильном приложении.
            </p>

            {/* Contract ID */}
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 w-full">
              <p className="text-sm text-red-700 dark:text-red-400">
                ID контракта: <span className="font-mono font-medium">{contractId}</span>
              </p>
            </div>

            {/* Close Button */}
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full justify-center"
            >
              Закрыть
            </Button>
          </>
        );

      default: // 'new' status
        // If this is a new client (created with phone number), show registration message
        if (isNewClient) {
          return (
            <>
              {/* Info Icon */}
              <div className="mb-4 text-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-full">
                <CheckCircle className="w-12 h-12" />
              </div>

              {/* Title */}
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                Контракт создан!
              </h2>

              {/* Description */}
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                ID контракта: <span className="font-mono text-gray-700 dark:text-gray-300">{contractId}</span>
              </p>

              {/* Registration Info */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 w-full">
                <div className="flex items-start gap-3">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-2">
                      Уведомление клиента
                    </p>
                    <p className="text-sm text-blue-700 dark:text-blue-400">
                      После регистрации клиента в приложении <strong>AYVA FINANCE</strong>, этот контракт появится у него в списке и он должен будет подтвердить его.
                    </p>
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <Button
                variant="primary"
                onClick={handleClose}
                className="w-full justify-center"
              >
                Готово
              </Button>
            </>
          );
        }

        // Default: waiting for confirmation (existing client)
        return (
          <>
            {/* Waiting Icon */}
            <div className="mb-4 text-amber-500 bg-amber-50 dark:bg-amber-900/20 p-4 rounded-full">
              <Clock className="w-10 h-10" />
            </div>

            {/* Title */}
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
              Ожидание подтверждения
            </h2>

            {/* Contract ID */}
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              ID контракта: <span className="font-mono text-gray-700 dark:text-gray-300">{contractId}</span>
            </p>

            {/* QR Code */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
              <QRCodeSVG
                value={contractId}
                size={200}
                level="H"
                includeMargin={true}
              />
            </div>

            {/* Polling indicator */}
            <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>Проверка статуса...</span>
            </div>

            {/* Instructions */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6 w-full">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-left">
                  <p className="text-sm font-medium text-blue-800 dark:text-blue-300 mb-1">
                    Подтверждение контракта
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-400">
                    Для подтверждения контракта клиент должен отсканировать QR-код или выбрать контракт из списка в мобильном приложении <strong>AYVA FINANCE</strong>
                  </p>
                </div>
              </div>
            </div>

            {/* Close Button */}
            <Button
              variant="outline"
              onClick={handleClose}
              className="w-full justify-center"
            >
              Закрыть
            </Button>
          </>
        );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} className="max-w-md p-6">
      <div className="flex flex-col items-center text-center">
        {renderContent()}
      </div>
    </Modal>
  );
}
