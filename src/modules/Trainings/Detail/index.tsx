import { useMemo, useState } from "react";

import {
  Check,
  CheckCircle2,
  CircleDashed,
  Download,
  FileText,
  GraduationCap,
  Link2,
  Pencil,
  Users,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import Button from "../../../components/ui/button/Button";
import { Modal } from "../../../components/ui/modal";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "../../../components/ui/table";
import { type Training, useTrainingQuery } from "../../../api/services/training.service";
import {
  type TrainingResultEmployee,
  type TrainingSubmissionStatus,
  useReviewTrainingSubmission,
  useTrainingMaterialsQuery,
  useTrainingResultsQuery,
} from "../../../api/services/trainingGateway.service";
import { useTranslation } from "../../../i18n";

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  draft: { label: "Черновик", className: "bg-gray-100 text-gray-600" },
  active: { label: "Активный", className: "bg-success-50 text-success-700" },
  archived: { label: "Архив", className: "bg-warning-50 text-warning-700" },
};

const SUBMISSION_BADGES: Record<string, { label: string; className: string }> = {
  submitted: { label: "На проверке", className: "bg-blue-50 text-blue-700" },
  accepted: { label: "Принято", className: "bg-success-50 text-success-700" },
  rejected: { label: "Отклонено", className: "bg-error-50 text-error-700" },
  none: { label: "Не сдано", className: "bg-gray-100 text-gray-500" },
};

const MATERIAL_ICONS = { file: FileText, link: Link2, video: Video } as const;

const resolveStatus = (training?: Training | null) => {
  const raw = Array.isArray(training?.status)
    ? String(training?.status?.[0] || "")
    : String(training?.status || "");
  return STATUS_LABELS[raw] || STATUS_LABELS.draft;
};

const formatDate = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" });
};

const formatDateTime = (value?: string | null): string => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatFileSize = (bytes?: number | null): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
};

type ReviewTarget = {
  employee: TrainingResultEmployee;
  nextStatus: Extract<TrainingSubmissionStatus, "accepted" | "rejected">;
};

export default function TrainingDetailPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const trainingGuid = id || "";

  const { data: training, isLoading: isTrainingLoading } = useTrainingQuery(trainingGuid);
  const { data: results, isLoading: isResultsLoading } = useTrainingResultsQuery(trainingGuid);
  const { data: materials = [] } = useTrainingMaterialsQuery(trainingGuid);
  const reviewMutation = useReviewTrainingSubmission();

  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);
  const [reviewComment, setReviewComment] = useState("");

  useHeaderBreadcrumbItems(
    useMemo(
      () => [
        { label: "Тренинги", to: "/trainings" },
        { label: String(training?.title || "Детали"), to: "#" },
      ],
      [training?.title]
    )
  );

  const status = resolveStatus(training);
  const employees = results?.employees || [];

  const periodLabel = useMemo(() => {
    const start = formatDate(training?.starts_at);
    const end = formatDate(training?.ends_at);
    if (start && end) return `${start} — ${end}`;
    if (start) return `с ${start}`;
    if (end) return `до ${end}`;
    return "Без периода";
  }, [training?.starts_at, training?.ends_at]);

  const openReviewModal = (employee: TrainingResultEmployee, nextStatus: ReviewTarget["nextStatus"]) => {
    setReviewTarget({ employee, nextStatus });
    setReviewComment("");
  };

  const closeReviewModal = () => {
    setReviewTarget(null);
    setReviewComment("");
  };

  const confirmReview = async () => {
    if (!reviewTarget) return;

    try {
      await reviewMutation.mutateAsync({
        trainingGuid,
        userBaseId: reviewTarget.employee.user_base_id,
        status: reviewTarget.nextStatus,
        reviewComment: reviewComment.trim() || undefined,
      });
      toast.success(
        reviewTarget.nextStatus === "accepted"
          ? "Домашнее задание принято."
          : "Домашнее задание отклонено."
      );
      closeReviewModal();
    } catch (error) {
      console.error("Failed to review submission:", error);
      toast.error("Не удалось сохранить проверку.");
    }
  };

  const statCards = [
    {
      label: "Назначено",
      value: results?.assigned_count ?? 0,
      icon: <Users size={18} />,
      className: "bg-brand-50 text-brand-600",
    },
    {
      label: "Сдали ДЗ",
      value: results?.submitted_count ?? 0,
      icon: <CircleDashed size={18} />,
      className: "bg-blue-50 text-blue-600",
    },
    {
      label: "Принято",
      value: results?.accepted_count ?? 0,
      icon: <CheckCircle2 size={18} />,
      className: "bg-success-50 text-success-600",
    },
    {
      label: "Отклонено",
      value: results?.rejected_count ?? 0,
      icon: <XCircle size={18} />,
      className: "bg-error-50 text-error-600",
    },
  ];

  return (
    <>
      <PageMeta title="Тренинг | Обучение" description="Результаты тренинга" />

      <div className="space-y-5">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-gray-200 bg-white px-6 py-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <GraduationCap size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-gray-900">
                {isTrainingLoading ? "Загрузка..." : String(training?.title || "Без названия")}
              </h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${status.className}`}
              >
                {status.label}
              </span>
            </div>
            <p className="text-sm text-gray-500">
              {[
                periodLabel,
                results?.trainer_name ? `Тренер: ${results.trainer_name}` : "",
                results?.location || String(training?.location || "")
                  ? `Место: ${results?.location || String(training?.location || "")}`
                  : "",
                training?.homework_required
                  ? `ДЗ${training?.homework_deadline ? ` до ${formatDate(training.homework_deadline)}` : " требуется"}`
                  : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <Button
            variant="outline"
            onClick={() => navigate(`/trainings/${trainingGuid}/edit`)}
            startIcon={<Pencil size={14} />}
            className="h-9 px-3 py-2 text-sm"
          >
            Изменить
          </Button>
        </div>

        {/* Description */}
        {training?.description ? (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-4">
            <p className="whitespace-pre-wrap text-sm text-gray-600">{String(training.description)}</p>
          </div>
        ) : null}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((card) => (
            <div
              key={card.label}
              className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-4"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${card.className}`}>
                {card.icon}
              </span>
              <div>
                <p className="text-xl font-semibold text-gray-900">{card.value}</p>
                <p className="text-xs text-gray-500">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Materials */}
        <div className="rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
            Материалы ({materials.length})
          </div>
          <div className="p-6">
            {materials.length === 0 ? (
              <p className="rounded-lg bg-gray-50 px-3 py-3 text-sm text-gray-400">
                Материалы не добавлены.
              </p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {materials.map((material, index) => {
                  const MetaIcon = MATERIAL_ICONS[material.material_type] || FileText;
                  const sizeLabel = formatFileSize(material.file_size);

                  return (
                    <li key={material.guid || index}>
                      <a
                        href={material.url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 px-3 py-2.5 transition hover:bg-gray-50"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                          <MetaIcon size={16} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-800">{material.title}</p>
                          <p className="truncate text-xs text-gray-400">
                            {material.url}
                            {sizeLabel ? ` · ${sizeLabel}` : ""}
                          </p>
                        </div>
                      </a>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* Employees & homework */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white">
          <div className="border-b border-gray-100 px-6 py-4 text-[15px] font-semibold text-gray-900">
            Сотрудники и домашние задания
          </div>

          <div className="max-w-full overflow-x-auto">
            <Table>
              <TableHeader className="border-b border-gray-100">
                <TableRow>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Сотрудник
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Статус ДЗ
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Файл
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-left text-theme-xs font-medium text-gray-500">
                    Сдано
                  </TableCell>
                  <TableCell isHeader className="px-4 py-3 text-right text-theme-xs font-medium text-gray-500">
                    Проверка
                  </TableCell>
                </TableRow>
              </TableHeader>

              <TableBody className="divide-y divide-gray-100">
                {isResultsLoading ? (
                  Array.from({ length: 5 }).map((_, index) => (
                    <TableRow key={`results-skeleton-${index}`}>
                      {Array.from({ length: 5 }).map((__, cellIndex) => (
                        <TableCell key={cellIndex} className="px-4 py-4">
                          <div className="h-4 w-28 animate-pulse rounded bg-gray-200" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : employees.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-4 py-12 text-center">
                      <p className="text-sm text-gray-500">Сотрудники не назначены</p>
                    </TableCell>
                  </TableRow>
                ) : (
                  employees.map((employee) => {
                    const submission = employee.submission;
                    const badge = SUBMISSION_BADGES[submission?.status || "none"] || SUBMISSION_BADGES.none;

                    return (
                      <TableRow key={employee.user_base_id} className="hover:bg-gray-50 transition-colors">
                        <TableCell className="px-4 py-3 text-sm font-medium text-gray-800">
                          {employee.full_name}
                          {submission?.comment ? (
                            <p className="mt-0.5 text-xs font-normal text-gray-400">
                              «{submission.comment}»
                            </p>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}
                          >
                            {badge.label}
                          </span>
                          {submission?.status === "rejected" && submission.review_comment ? (
                            <p className="mt-0.5 text-xs text-gray-400">{submission.review_comment}</p>
                          ) : null}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm">
                          {submission ? (
                            <a
                              href={submission.file_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm text-brand-600 hover:text-brand-700"
                            >
                              <Download size={14} />
                              <span className="max-w-[220px] truncate">
                                {submission.file_name || "Скачать"}
                              </span>
                              {submission.file_size ? (
                                <span className="text-xs text-gray-400">
                                  ({formatFileSize(submission.file_size)})
                                </span>
                              ) : null}
                            </a>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-3 text-sm text-gray-600">
                          {submission?.submitted_at ? formatDateTime(submission.submitted_at) : "—"}
                        </TableCell>
                        <TableCell className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {submission && submission.status === "submitted" ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(employee, "accepted")}
                                  className="inline-flex items-center gap-1 rounded-lg bg-success-50 px-2.5 py-1.5 text-xs font-medium text-success-700 transition hover:bg-success-100"
                                >
                                  <Check size={13} /> Принять
                                </button>
                                <button
                                  type="button"
                                  onClick={() => openReviewModal(employee, "rejected")}
                                  className="inline-flex items-center gap-1 rounded-lg bg-error-50 px-2.5 py-1.5 text-xs font-medium text-error-700 transition hover:bg-error-100"
                                >
                                  <X size={13} /> Отклонить
                                </button>
                              </>
                            ) : submission?.reviewed_at ? (
                              <span className="text-xs text-gray-400">
                                {formatDateTime(submission.reviewed_at)}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-300">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Review modal */}
      <Modal
        isOpen={Boolean(reviewTarget)}
        onClose={closeReviewModal}
        showCloseButton={false}
        className="mx-4 w-full max-w-[400px] overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl"
      >
        <div className="border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-gray-900">
              {reviewTarget?.nextStatus === "accepted" ? "Принять задание" : "Отклонить задание"}
            </h3>
            <button
              type="button"
              onClick={closeReviewModal}
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600"
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-gray-700">
            {reviewTarget
              ? `${reviewTarget.nextStatus === "accepted" ? "Принять" : "Отклонить"} домашнее задание сотрудника ${reviewTarget.employee.full_name}?`
              : ""}
          </p>

          <textarea
            value={reviewComment}
            onChange={(event) => setReviewComment(event.target.value)}
            placeholder={
              reviewTarget?.nextStatus === "rejected"
                ? "Комментарий (что нужно исправить)"
                : "Комментарий (необязательно)"
            }
            rows={3}
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-brand-400 focus:outline-none focus:ring-3 focus:ring-brand-500/10"
          />

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={closeReviewModal}
              className="w-full justify-center px-3 py-2 text-sm"
            >
              Отмена
            </Button>
            <Button
              onClick={confirmReview}
              disabled={reviewMutation.isLoading}
              className={`w-full justify-center px-3 py-2 text-sm ${
                reviewTarget?.nextStatus === "rejected"
                  ? "bg-error-600 hover:bg-error-700"
                  : ""
              }`}
            >
              {reviewMutation.isLoading
                ? "Сохранение..."
                : reviewTarget?.nextStatus === "accepted"
                  ? "Принять"
                  : "Отклонить"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
