import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import DOMPurify from "dompurify";
import Editor, { Toolbar, createButton, useEditorState } from "react-simple-wysiwyg";
import {
  ArrowLeft,
  Bold,
  Copy,
  FileText,
  ImagePlus,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Plus,
  Quote,
  RemoveFormatting,
  Send,
  Strikethrough,
  Trash2,
  TriangleAlert,
  Underline,
  Undo2,
  X,
} from "lucide-react";

import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import Spinner from "../../../components/ui/Spinner";
import Checkbox from "../../../components/form/input/Checkbox";
import Radio from "../../../components/form/input/Radio";
import Input from "../../../components/form/input/InputField";
import { Modal } from "../../../components/ui/modal";
import { blockToggle, isEditorEmpty } from "../../../components/form/RichTextEditor";
import LocationsInfiniteMultiSelect from "../../../components/autocomplete/LocationsInfiniteMultiSelect";
import { uploadFileToCdn } from "../../../api/services/file-upload.service";
import { useTranslation } from "../../../i18n";
import type { MessageKey } from "../../../i18n/messages";
import {
  broadcastsService,
  type Broadcast,
  type BroadcastAudience,
  type BroadcastForm,
  type BroadcastPreview,
  type Problem,
} from "../../../api/services/broadcasts.service";
import { DeliveryCounters, POLL_MS, StatusBadge, broadcastError, formatDateTime, isForbidden } from "./Broadcasts";

const LIST_PATH = "/settings/notifications/broadcasts";

// Пределы multipart-загрузки Bot API: sendPhoto — 10 МБ, sendDocument — 50 МБ.
const FILE_LIMIT_MB = { photo: 10, document: 50 };
const PHOTO_TYPES = "image/jpeg,image/png,image/webp";

const VARIABLES = [
  { key: "first_name", label: "settings_misc.broadcasts.var_first_name" },
  { key: "username", label: "settings_misc.broadcasts.var_username" },
  { key: "branch", label: "settings_misc.broadcasts.var_branch" },
] as const;

const emptyForm = (): BroadcastForm => ({
  audience: "company",
  locations: [],
  include_no_branch: false,
  to_employees: true,
  to_groups: false,
  body: "",
  attachment: null,
  with_app_button: false,
});

// Превью — HTML Telegram от серверного конвертера, он и так безопасен.
// Фильтр здесь — вторая линия: без него любая ошибка конвертера стала бы XSS.
const safePreview = (html: string) =>
  DOMPurify.sanitize(html, { ALLOWED_TAGS: ["b", "i", "u", "s", "a", "blockquote"], ALLOWED_ATTR: ["href"] });

const toolbarBtn =
  "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent text-gray-500 transition hover:border-gray-200 hover:bg-white hover:text-gray-700 data-[active=true]:border-brand-200 data-[active=true]:bg-brand-50 data-[active=true]:text-brand-600";

// Только то, что умеет HTML Telegram: b, i, u, s, a, blockquote и списки
// (сервер превращает их в строки с «•» и номерами).
const BtnBold = createButton("Bold", <Bold size={15} />, "bold");
const BtnItalic = createButton("Italic", <Italic size={15} />, "italic");
const BtnUnderline = createButton("Underline", <Underline size={15} />, "underline");
const BtnStrike = createButton("Strikethrough", <Strikethrough size={15} />, "strikeThrough");
const BtnQuote = createButton("Quote", <Quote size={15} />, blockToggle("blockquote"));
const BtnBullets = createButton("Bulleted list", <List size={15} />, "insertUnorderedList");
const BtnNumbers = createButton("Numbered list", <ListOrdered size={15} />, "insertOrderedList");
const BtnUndo = createButton("Undo", <Undo2 size={15} />, "undo");
const BtnClear = createButton("Clear formatting", <RemoveFormatting size={15} />, "removeFormat");

type LinkRequest = { range: Range | null; editable: HTMLElement | undefined };

/**
 * Ссылка без window.prompt: выделение запоминается до открытия окна (поле
 * ввода заберёт фокус) и восстанавливается перед createLink.
 */
function BtnLink({ className, title, onRequest }: { className: string; title: string; onRequest: (request: LinkRequest) => void }) {
  const { $el, $selection } = useEditorState();
  return (
    <button
      type="button"
      title={title}
      tabIndex={-1}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => {
        const element = $selection instanceof Element ? $selection : ($selection?.parentElement ?? null);
        if (element?.closest("a")) {
          document.execCommand("unlink");
          return;
        }
        const selection = window.getSelection();
        const range = selection?.rangeCount && $el?.contains(selection.anchorNode) ? selection.getRangeAt(0).cloneRange() : null;
        onRequest({ range, editable: $el });
      }}
      className={className}
    >
      <LinkIcon size={15} />
    </button>
  );
}

function Dialog({ title, onClose, children, footer, wide = false }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode; wide?: boolean }) {
  const { t } = useTranslation();
  return (
    <Modal isOpen onClose={onClose} showCloseButton={false} className={`mx-4 w-full ${wide ? "max-w-[520px]" : "max-w-[400px]"} overflow-hidden rounded-2xl border border-gray-200 p-0 shadow-xl dark:border-gray-800`}>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3 dark:border-gray-800">
        <h3 className="text-base font-semibold text-gray-900 dark:text-white/90">{title}</h3>
        <button type="button" onClick={onClose} aria-label={t("settings_misc.broadcasts.close")} className="inline-flex h-7 w-7 items-center justify-center rounded-full text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/5">
          <X size={16} />
        </button>
      </div>
      <div className="max-h-[65vh] space-y-3 overflow-y-auto px-4 py-4 text-sm text-gray-700 dark:text-gray-300">{children}</div>
      <div className="flex gap-2 border-t border-gray-100 px-4 py-3 dark:border-gray-800">{footer}</div>
    </Modal>
  );
}

/** Отказ в отправке целиком — у кого текст пустой или длиннее предела. */
function ProblemList({ problems, total }: { problems: Problem[]; total: number }) {
  const { t } = useTranslation();
  const who = (problem: Problem) =>
    problem.kind === "employee"
      ? problem.name || t("settings_misc.broadcasts.unnamed")
      : problem.company
        ? t("settings_misc.broadcasts.group_company")
        : t("settings_misc.broadcasts.group_of", { names: (problem.branches || []).join(", ") });
  return (
    <div className="rounded-lg border border-error-200 bg-error-50 p-3 text-error-700 dark:border-error-500/30 dark:bg-error-500/10 dark:text-error-400">
      <p className="font-medium">{t("settings_misc.broadcasts.problems_title", { count: total })}</p>
      <ul className="mt-1.5 space-y-0.5 text-xs">
        {problems.map((problem, index) => (
          <li key={index}>
            {who(problem)} —{" "}
            {problem.reason === "too_long"
              ? t("settings_misc.broadcasts.problem_too_long", { length: problem.length ?? 0, limit: problem.limit ?? 0 })
              : t("settings_misc.broadcasts.problem_empty")}
          </li>
        ))}
        {total > problems.length && <li>{t("settings_misc.broadcasts.problems_more", { count: total - problems.length })}</li>}
      </ul>
    </div>
  );
}

type Confirm = "delete" | "recall" | null;
type PreviewTab = "personal" | "group_branch" | "group_company";

/**
 * Рассылка: черновик правится здесь же, отправленная — журнал с отзывом и
 * копией в черновик (ADR-0011). Текст, охват и превью считает reports — у
 * админки нет своего конвертера, чтобы превью не разошлось с отправкой.
 */
export default function BroadcastFormPage() {
  const { t, locale } = useTranslation();
  const { id } = useParams();
  const navigate = useNavigate();

  const [saved, setSaved] = useState<Broadcast | null>(null);
  const [form, setForm] = useState<BroadcastForm>(emptyForm);
  const [baseline, setBaseline] = useState(() => JSON.stringify(emptyForm()));
  const [loadError, setLoadError] = useState<"forbidden" | "failed" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<BroadcastPreview | null>(null);
  const [previewError, setPreviewError] = useState("");
  const [previewTab, setPreviewTab] = useState<PreviewTab>("personal");
  const [linkRequest, setLinkRequest] = useState<LinkRequest | null>(null);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [confirm, setConfirm] = useState<Confirm>(null);
  const [sendDialog, setSendDialog] = useState<{ guid: string; audience: BroadcastAudience } | null>(null);
  const [sendProblems, setSendProblems] = useState<{ problems: Problem[]; total: number } | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const isDraft = !saved || saved.status === "draft";
  const dirty = JSON.stringify(form) !== baseline;

  const adopt = (broadcast: Broadcast) => {
    setSaved(broadcast);
    setForm(broadcast.form);
    setBaseline(JSON.stringify(broadcast.form));
  };

  // После сохранения нового черновика адрес меняется на /:id, а данные уже на
  // руках — второй раз их не грузим, иначе редактор перерисуется под курсором.
  useEffect(() => {
    if (!id || id === "new" || saved?.guid === id) return;
    let cancelled = false;
    setLoadError(null);
    broadcastsService
      .get(id)
      .then((broadcast) => !cancelled && adopt(broadcast))
      .catch((error) => {
        if (cancelled) return;
        console.error("broadcast: загрузка не удалась", error);
        setLoadError(isForbidden(error) ? "forbidden" : "failed");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Счётчики отправляющейся рассылки обновляются опросом.
  useEffect(() => {
    if (!saved?.in_progress) return;
    const timer = window.setTimeout(() => {
      broadcastsService.get(saved.guid).then(setSaved).catch(() => undefined);
    }, POLL_MS);
    return () => clearTimeout(timer);
  }, [saved]);

  // Превью считает сервер тем же конвертером, что и отправка.
  const previewSeq = useRef(0);
  const previewKey = JSON.stringify(form);
  useEffect(() => {
    const seq = ++previewSeq.current;
    const timer = window.setTimeout(() => {
      broadcastsService
        .preview(form)
        .then((result) => {
          if (seq !== previewSeq.current) return;
          setPreview(result);
          setPreviewError("");
        })
        .catch((error) => seq === previewSeq.current && setPreviewError(broadcastError(error, t)));
    }, 500);
    return () => clearTimeout(timer);
  }, [previewKey]);

  const hasBranchVar = /\{\{\s*branch\s*\}\}/.test(form.body);
  const previewTabs = useMemo<PreviewTab[]>(() => {
    const tabs: PreviewTab[] = [];
    if (form.to_employees) tabs.push("personal");
    if (form.to_groups) {
      if (form.audience === "branches") tabs.push("group_branch");
      else if (hasBranchVar) tabs.push("group_branch", "group_company");
      else tabs.push("group_company");
    }
    return tabs.length ? tabs : ["personal"];
  }, [form.to_employees, form.to_groups, form.audience, hasBranchVar]);
  const activeTab = previewTabs.includes(previewTab) ? previewTab : previewTabs[0];
  const shown = preview?.[activeTab];

  const patch = (next: Partial<BroadcastForm>) => setForm((current) => ({ ...current, ...next }));

  const run = async (name: string, action: () => Promise<void>) => {
    setBusy(name);
    try {
      await action();
    } catch (error) {
      toast.error(broadcastError(error, t));
    } finally {
      setBusy(null);
    }
  };

  /** Сохранённая версия того, что на экране: отправка и «Отправить мне» идут по ней. */
  const persist = async (): Promise<Broadcast> => {
    if (saved && !dirty) return saved;
    const next = await broadcastsService.save(form, saved?.guid, saved?.revision);
    // Ответ сохранения без editor_body — форму оставляем свою.
    setSaved(next);
    setBaseline(JSON.stringify(form));
    if (!saved) navigate(`${LIST_PATH}/${next.guid}`, { replace: true });
    return next;
  };

  const save = () =>
    run("save", async () => {
      await persist();
      toast.success(t("settings_misc.broadcasts.saved"));
    });

  const sendTest = () =>
    run("test", async () => {
      const current = await persist();
      const result = await broadcastsService.sendTest(current.guid);
      if (result.sent) return void toast.success(t("settings_misc.broadcasts.test_sent"));
      toast.error(
        result.reason === "too_long"
          ? t("settings_misc.broadcasts.problem_too_long", { length: result.length ?? 0, limit: result.limit ?? 0 })
          : result.reason === "failed"
            ? result.description || t("settings_misc.broadcasts.error_generic")
            : t(`settings_misc.broadcasts.test_${result.reason || "failed"}` as MessageKey)
      );
    });

  const openSend = () =>
    run("send", async () => {
      const current = await persist();
      setSendProblems(null);
      setSendDialog({ guid: current.guid, audience: await broadcastsService.audience(current.guid) });
    });

  const confirmSend = () =>
    run("confirm", async () => {
      const audience = sendDialog?.audience;
      if (!sendDialog || !audience?.ready) return;
      const result = await broadcastsService.send(sendDialog.guid, audience.revision);
      if (!result.sent) {
        if (result.reason === "problems") {
          setSendProblems({ problems: result.problems || [], total: result.problems_total || 0 });
          return;
        }
        setSendDialog(null);
        toast.error(t(`settings_misc.broadcasts.reason_${result.reason || "no_recipients"}` as MessageKey));
        return;
      }
      setSendDialog(null);
      toast.success(t("settings_misc.broadcasts.sent"));
      adopt(await broadcastsService.get(sendDialog.guid));
    });

  const remove = () =>
    run("delete", async () => {
      if (saved) await broadcastsService.remove(saved.guid);
      navigate(LIST_PATH);
    });

  const recall = () =>
    run("recall", async () => {
      if (!saved) return;
      await broadcastsService.recall(saved.guid);
      setConfirm(null);
      toast.success(t("settings_misc.broadcasts.recalled"));
      adopt(await broadcastsService.get(saved.guid));
    });

  // «Отозвал, исправил, отправил»: копия — новый черновик того же содержания.
  const copy = () =>
    run("copy", async () => {
      if (!saved) return;
      const next = await broadcastsService.save(saved.form);
      setSaved(next);
      setForm(saved.form);
      setBaseline(JSON.stringify(saved.form));
      navigate(`${LIST_PATH}/${next.guid}`);
      toast.success(t("settings_misc.broadcasts.copied"));
    });

  const attach = async (file: File | undefined, kind: "photo" | "document") => {
    if (!file) return;
    if (file.size > FILE_LIMIT_MB[kind] * 1024 * 1024) {
      toast.error(t("settings_misc.broadcasts.file_too_large", { limit: FILE_LIMIT_MB[kind] }));
      return;
    }
    setUploading(true);
    try {
      const url = await uploadFileToCdn(file, { folder: "Media" });
      patch({ attachment: { url, name: file.name, kind } });
    } catch (error) {
      console.error("broadcast: загрузка файла не удалась", error);
      toast.error(t("settings_misc.broadcasts.upload_error"));
    } finally {
      setUploading(false);
    }
  };

  // Переменная встаёт под курсор; редактор не в фокусе — в конец текста.
  const insertVariable = (key: string) => {
    const token = `{{${key}}}`;
    const editable = editorRef.current?.querySelector(".rsw-ce");
    const selection = window.getSelection();
    if (editable && selection?.rangeCount && editable.contains(selection.anchorNode)) {
      document.execCommand("insertText", false, token);
    } else {
      patch({ body: `${form.body}<div>${token}</div>` });
    }
  };

  const applyLink = () => {
    const url = linkUrl.trim();
    if (!/^https?:\/\/\S+$/i.test(url)) {
      toast.error(t("settings_misc.broadcasts.link_invalid"));
      return;
    }
    const { range, editable } = linkRequest || {};
    setLinkRequest(null);
    editable?.focus();
    const selection = window.getSelection();
    if (range && selection) {
      selection.removeAllRanges();
      selection.addRange(range);
    }
    if (!range || range.collapsed) {
      const safe = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
      document.execCommand("insertHTML", false, `<a href="${safe}">${safe}</a>`);
    } else {
      document.execCommand("createLink", false, url);
    }
  };

  if (loadError) {
    return (
      <div className="rounded-xl border border-gray-200 p-8 text-center dark:border-gray-800">
        <p className="text-sm text-gray-700 dark:text-gray-300">
          {t(loadError === "forbidden" ? "settings_misc.broadcasts.forbidden" : "settings_misc.broadcasts.load_error")}
        </p>
        <Link to={LIST_PATH} className="mt-4 inline-block text-sm font-medium text-brand-500 hover:text-brand-600">
          {t("settings_misc.broadcasts.back")}
        </Link>
      </div>
    );
  }
  if (id && id !== "new" && !saved) {
    return <div className="flex justify-center py-16"><Spinner /></div>;
  }

  const audience = sendDialog?.audience;
  const sectionCls = "rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03]";
  const sectionTitle = "mb-4 text-base font-semibold text-gray-800 dark:text-white/90";

  return (
    <>
      <PageMeta title={t("settings_misc.broadcasts.page_title")} description={t("settings_misc.broadcasts.page_subtitle")} />

      <div className="space-y-5">
        <Link to={LIST_PATH} className="inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-gray-700 dark:text-gray-400">
          <ArrowLeft size={16} />
          {t("settings_misc.broadcasts.back")}
        </Link>

        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            {saved ? t("settings_misc.broadcasts.title") : t("settings_misc.broadcasts.new")}
          </h1>
          {saved && <StatusBadge broadcast={saved} />}
          {saved?.sent_at && (
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {t("settings_misc.broadcasts.sent_at", { date: formatDateTime(saved.sent_at, locale) })}
            </span>
          )}
        </div>

        {saved && !isDraft && (
          <section className={sectionCls}>
            <h2 className={sectionTitle}>{t("settings_misc.broadcasts.delivery")}</h2>
            <DeliveryCounters broadcast={saved} />
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              {saved.status === "recalled"
                ? t("settings_misc.broadcasts.recalled_hint")
                : saved.can_recall
                  ? t("settings_misc.broadcasts.recall_hint")
                  : t("settings_misc.broadcasts.recall_expired_hint")}
            </p>
          </section>
        )}

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-12">
          <div className="space-y-5 xl:col-span-7">
            <section className={sectionCls}>
              <h2 className={sectionTitle}>{t("settings_misc.broadcasts.audience")}</h2>
              <fieldset disabled={!isDraft} className="space-y-4">
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  <Radio id="audience-company" name="audience" value="company" checked={form.audience === "company"} disabled={!isDraft} label={t("settings_misc.broadcasts.audience_company")} onChange={() => patch({ audience: "company" })} />
                  <Radio id="audience-branches" name="audience" value="branches" checked={form.audience === "branches"} disabled={!isDraft} label={t("settings_misc.broadcasts.audience_branches")} onChange={() => patch({ audience: "branches" })} />
                </div>

                {form.audience === "branches" && (
                  <div className="space-y-3">
                    {isDraft ? (
                      <LocationsInfiniteMultiSelect value={form.locations} onChange={(locations) => patch({ locations })} menuPortalTarget={document.body} />
                    ) : (
                      <p className="text-sm text-gray-800 dark:text-white/90">{form.locations.map((item) => item.label).join(", ") || "—"}</p>
                    )}
                    <Checkbox checked={form.include_no_branch} disabled={!isDraft} onChange={(include_no_branch) => patch({ include_no_branch })} label={t("settings_misc.broadcasts.include_no_branch")} />
                  </div>
                )}

                <div className="space-y-2 border-t border-gray-100 pt-4 dark:border-gray-800">
                  <Checkbox checked={form.to_employees} disabled={!isDraft} onChange={(to_employees) => patch({ to_employees })} label={t("settings_misc.broadcasts.to_employees")} />
                  <Checkbox checked={form.to_groups} disabled={!isDraft} onChange={(to_groups) => patch({ to_groups })} label={t("settings_misc.broadcasts.to_groups")} />
                  {form.to_groups && (
                    <p className="pl-8 text-xs text-gray-500 dark:text-gray-400">
                      {t(form.audience === "company" ? "settings_misc.broadcasts.groups_company_hint" : "settings_misc.broadcasts.groups_branches_hint")}
                    </p>
                  )}
                </div>
              </fieldset>
            </section>

            <section className={sectionCls}>
              <h2 className={sectionTitle}>{t("settings_misc.broadcasts.message")}</h2>

              {isDraft && (
                <>
                  <div ref={editorRef} data-editor-empty={isEditorEmpty(form.body) || undefined} className="overflow-hidden rounded-xl border border-gray-200 bg-white focus-within:border-brand-400 focus-within:ring-2 focus-within:ring-brand-100 dark:border-gray-700 dark:bg-gray-900">
                    <Editor
                      value={form.body}
                      onChange={(event) => patch({ body: event.target.value })}
                      placeholder={t("settings_misc.broadcasts.text_placeholder")}
                      containerProps={{ style: { border: 0, borderRadius: 0 } }}
                      style={{ minHeight: 200, padding: "12px 14px", fontSize: "14px" }}
                    >
                      <Toolbar className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 bg-gray-50/70 px-2 py-1.5 dark:border-gray-800 dark:bg-white/[0.02]">
                        <BtnBold className={toolbarBtn} title={t("rich_text.bold")} />
                        <BtnItalic className={toolbarBtn} title={t("rich_text.italic")} />
                        <BtnUnderline className={toolbarBtn} title={t("rich_text.underline")} />
                        <BtnStrike className={toolbarBtn} title={t("rich_text.strike")} />
                        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
                        <BtnQuote className={toolbarBtn} title={t("rich_text.quote")} />
                        <BtnBullets className={toolbarBtn} title={t("rich_text.bullet_list")} />
                        <BtnNumbers className={toolbarBtn} title={t("rich_text.ordered_list")} />
                        <BtnLink className={toolbarBtn} title={t("rich_text.link")} onRequest={(request) => { setLinkUrl("https://"); setLinkRequest(request); }} />
                        <div className="mx-1 h-5 w-px bg-gray-200 dark:bg-gray-700" />
                        <BtnUndo className={toolbarBtn} title={t("news_form.undo")} />
                        <BtnClear className={toolbarBtn} title={t("rich_text.clear_format")} />
                      </Toolbar>
                    </Editor>
                  </div>

                  <p className="mb-1.5 mt-3 text-xs font-medium text-gray-500 dark:text-gray-400">
                    {t("settings_misc.bot_notifications.text_variables")}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {VARIABLES.map((variable) => (
                      <button
                        key={variable.key}
                        type="button"
                        title={`{{${variable.key}}}`}
                        // Курсор в редакторе не должен уйти на кнопку.
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => insertVariable(variable.key)}
                        className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs text-gray-700 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-gray-700 dark:bg-white/[0.03] dark:text-gray-300"
                      >
                        <Plus className="size-3" aria-hidden />
                        {t(variable.label)}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{t("settings_misc.broadcasts.variables_hint")}</p>
                </>
              )}

              <div className="mt-5 space-y-3 border-t border-gray-100 pt-4 dark:border-gray-800">
                {form.attachment ? (
                  <div className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2 dark:border-gray-700">
                    {form.attachment.kind === "photo" ? (
                      <img src={form.attachment.url} alt="" className="h-12 w-12 rounded object-cover" />
                    ) : (
                      <FileText className="size-6 shrink-0 text-gray-400" aria-hidden />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-gray-800 dark:text-white/90">{form.attachment.name || t("settings_misc.broadcasts.attachment")}</p>
                      <p className="text-xs text-gray-500">
                        {t(form.attachment.kind === "photo" ? "settings_misc.broadcasts.attach_photo" : "settings_misc.broadcasts.attach_file")}
                      </p>
                    </div>
                    {isDraft && (
                      <button type="button" onClick={() => patch({ attachment: null })} aria-label={t("settings_misc.broadcasts.remove_attachment")} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-error-600 dark:hover:bg-white/5">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ) : isDraft ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <Button size="sm" variant="outline" disabled={uploading} startIcon={uploading ? <Loader2 className="size-4 animate-spin" /> : <ImagePlus className="size-4" />} onClick={() => photoInput.current?.click()}>
                      {t("settings_misc.broadcasts.attach_photo")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={uploading} startIcon={<Paperclip className="size-4" />} onClick={() => fileInput.current?.click()}>
                      {t("settings_misc.broadcasts.attach_file")}
                    </Button>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{t("settings_misc.broadcasts.attach_hint")}</span>
                    <input ref={photoInput} type="file" accept={PHOTO_TYPES} hidden onChange={(event) => { void attach(event.target.files?.[0], "photo"); event.target.value = ""; }} />
                    <input ref={fileInput} type="file" hidden onChange={(event) => { void attach(event.target.files?.[0], "document"); event.target.value = ""; }} />
                  </div>
                ) : null}

                <Checkbox checked={form.with_app_button} disabled={!isDraft} onChange={(with_app_button) => patch({ with_app_button })} label={t("settings_misc.broadcasts.app_button")} />
              </div>
            </section>

            <div className="flex flex-wrap items-center gap-2">
              {isDraft ? (
                <>
                  {saved && (
                    <Button variant="outline" size="sm" disabled={!!busy} startIcon={<Trash2 className="size-4" />} onClick={() => setConfirm("delete")}>
                      {t("settings_misc.broadcasts.delete")}
                    </Button>
                  )}
                  <div className="ml-auto flex flex-wrap gap-2">
                    <span title={preview && !preview.self_linked ? t("settings_misc.broadcasts.test_not_linked") : undefined}>
                      <Button variant="outline" size="sm" disabled={!!busy || uploading || preview?.self_linked === false} onClick={sendTest}>
                        {busy === "test" ? t("settings_misc.broadcasts.sending") : t("settings_misc.broadcasts.send_test")}
                      </Button>
                    </span>
                    <Button variant="outline" size="sm" disabled={!!busy || uploading || (!!saved && !dirty)} onClick={save}>
                      {busy === "save" ? t("settings_misc.broadcasts.saving") : t("settings_misc.broadcasts.save")}
                    </Button>
                    <Button size="sm" disabled={!!busy || uploading} startIcon={<Send className="size-4" />} onClick={openSend}>
                      {t("settings_misc.broadcasts.send")}
                    </Button>
                  </div>
                </>
              ) : (
                <div className="ml-auto flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" disabled={!!busy} onClick={sendTest}>
                    {t("settings_misc.broadcasts.send_test")}
                  </Button>
                  <Button variant="outline" size="sm" disabled={!!busy} startIcon={<Copy className="size-4" />} onClick={copy}>
                    {t("settings_misc.broadcasts.copy")}
                  </Button>
                  {saved?.can_recall && (
                    <Button size="sm" disabled={!!busy} className="bg-error-600 hover:bg-error-700" onClick={() => setConfirm("recall")}>
                      {t("settings_misc.broadcasts.recall")}
                    </Button>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="xl:col-span-5">
            <section className={`${sectionCls} xl:sticky xl:top-24`}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-semibold text-gray-800 dark:text-white/90">{t("settings_misc.bot_notifications.text_preview")}</h2>
                {previewTabs.length > 1 && (
                  <div role="tablist" className="inline-flex rounded-lg bg-gray-100 p-0.5 dark:bg-gray-900">
                    {previewTabs.map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab}
                        onClick={() => setPreviewTab(tab)}
                        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                          activeTab === tab ? "bg-white text-gray-900 shadow-theme-xs dark:bg-gray-800 dark:text-white" : "text-gray-500 hover:text-gray-700 dark:text-gray-400"
                        }`}
                      >
                        {t(`settings_misc.broadcasts.preview_${tab}` as MessageKey)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="rounded-xl bg-[#8fb3cf] p-4 dark:bg-gray-900">
                <div className="max-w-sm overflow-hidden rounded-2xl rounded-bl-md bg-white shadow-theme-xs dark:bg-gray-800">
                  {form.attachment?.kind === "photo" && <img src={form.attachment.url} alt="" className="max-h-72 w-full object-cover" />}
                  {form.attachment?.kind === "document" && (
                    <div className="flex items-center gap-2.5 px-3.5 pt-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white"><FileText size={18} /></span>
                      <span className="truncate text-sm font-medium text-gray-800 dark:text-white/90">{form.attachment.name || t("settings_misc.broadcasts.attachment")}</span>
                    </div>
                  )}
                  {shown?.text ? (
                    <div
                      className="whitespace-pre-wrap break-words px-3.5 py-2.5 text-sm leading-relaxed text-gray-800 dark:text-white/90 [&_a]:text-brand-500 [&_a]:underline [&_blockquote]:my-0.5 [&_blockquote]:border-l-2 [&_blockquote]:border-brand-400 [&_blockquote]:pl-2"
                      dangerouslySetInnerHTML={{ __html: safePreview(shown.text) }}
                    />
                  ) : (
                    <p className="px-3.5 py-2.5 text-sm text-gray-400">
                      {form.attachment ? t("settings_misc.broadcasts.preview_no_caption") : t("settings_misc.broadcasts.preview_empty")}
                    </p>
                  )}
                </div>
                {form.with_app_button && (
                  <div className="mt-1 max-w-sm rounded-lg bg-white/60 py-1.5 text-center text-sm font-medium text-gray-800 dark:bg-white/10 dark:text-white/90">
                    {preview?.button_text || t("settings_misc.broadcasts.app_button_default")} ↗
                  </div>
                )}
              </div>

              {shown && shown.limit > 0 && (
                <p className={`mt-2 text-right text-xs tabular-nums ${shown.length > shown.limit ? "text-error-600 dark:text-error-500" : "text-gray-500 dark:text-gray-400"}`}>
                  {shown.length} / {shown.limit}
                </p>
              )}
              {shown && shown.length > shown.limit && (
                <p className="mt-1 flex items-start gap-1.5 text-xs text-error-600 dark:text-error-500">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t(form.attachment ? "settings_misc.broadcasts.caption_too_long" : "settings_misc.broadcasts.text_too_long")}
                </p>
              )}
              {previewError && <p className="mt-2 text-xs text-error-600">{previewError}</p>}
              {activeTab === "personal" && hasBranchVar && preview?.branch_example && (
                <p className="mt-2 flex items-start gap-1.5 text-xs text-warning-700 dark:text-warning-400">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t("settings_misc.broadcasts.branch_example_hint", { branch: preview.branch_example })}
                </p>
              )}
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                {t(activeTab === "personal" ? "settings_misc.broadcasts.preview_personal_hint" : "settings_misc.broadcasts.preview_group_hint")}
              </p>
            </section>
          </div>
        </div>
      </div>

      {linkRequest && (
        <Dialog
          title={t("rich_text.link")}
          onClose={() => setLinkRequest(null)}
          footer={
            <>
              <Button variant="outline" size="sm" className="w-full" onClick={() => setLinkRequest(null)}>{t("settings_misc.broadcasts.cancel")}</Button>
              <Button size="sm" className="w-full" onClick={applyLink}>{t("settings_misc.broadcasts.link_apply")}</Button>
            </>
          }
        >
          <Input value={linkUrl} onChange={(event) => setLinkUrl(event.target.value)} placeholder="https://" />
        </Dialog>
      )}

      {confirm && (
        <Dialog
          title={t(confirm === "delete" ? "settings_misc.broadcasts.delete_title" : "settings_misc.broadcasts.recall_title")}
          onClose={() => setConfirm(null)}
          footer={
            <>
              <Button variant="outline" size="sm" className="w-full" disabled={!!busy} onClick={() => setConfirm(null)}>{t("settings_misc.broadcasts.cancel")}</Button>
              <Button size="sm" className="w-full bg-error-600 hover:bg-error-700" disabled={!!busy} onClick={confirm === "delete" ? remove : recall}>
                {t(confirm === "delete" ? "settings_misc.broadcasts.delete" : "settings_misc.broadcasts.recall")}
              </Button>
            </>
          }
        >
          <p>{t(confirm === "delete" ? "settings_misc.broadcasts.delete_text" : "settings_misc.broadcasts.recall_text")}</p>
        </Dialog>
      )}

      {sendDialog && audience && (
        <Dialog
          wide
          title={t("settings_misc.broadcasts.send_title")}
          onClose={() => setSendDialog(null)}
          footer={
            <>
              <Button variant="outline" size="sm" className="w-full" disabled={!!busy} onClick={() => setSendDialog(null)}>{t("settings_misc.broadcasts.cancel")}</Button>
              {audience.ready && !audience.problems_total && !sendProblems && (
                <Button size="sm" className="w-full" disabled={!!busy} startIcon={<Send className="size-4" />} onClick={confirmSend}>
                  {busy === "confirm" ? t("settings_misc.broadcasts.sending") : t("settings_misc.broadcasts.send")}
                </Button>
              )}
            </>
          }
        >
          {!audience.ready ? (
            <p>{t(`settings_misc.broadcasts.reason_${audience.reason}` as MessageKey)}</p>
          ) : (
            <>
              {form.to_employees && (
                <p>
                  {t("settings_misc.broadcasts.summary_employees", { count: audience.employees.linked })}
                  {audience.employees.not_linked > 0 && (
                    <span className="text-warning-700 dark:text-warning-400">
                      {" "}{t("settings_misc.broadcasts.summary_not_linked", { count: audience.employees.not_linked })}
                    </span>
                  )}
                </p>
              )}
              {form.to_groups && (
                <div>
                  <p>{t("settings_misc.broadcasts.summary_groups", { count: audience.groups.length })}</p>
                  {audience.groups.length > 0 && (
                    <ul className="mt-1 list-disc pl-5 text-xs text-gray-600 dark:text-gray-400">
                      {audience.groups.map((group, index) => (
                        <li key={index}>
                          {group.company
                            ? t("settings_misc.broadcasts.group_company")
                            : t("settings_misc.broadcasts.group_of", { names: group.branches.join(", ") })}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {audience.branches_without_group.length > 0 && (
                <p className="flex items-start gap-1.5 rounded-lg bg-warning-50 p-2.5 text-xs text-warning-700 dark:bg-warning-500/10 dark:text-warning-400">
                  <TriangleAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {t("settings_misc.broadcasts.summary_no_group", { names: audience.branches_without_group.map((item) => item.title).join(", ") })}
                </p>
              )}
              {(sendProblems || audience.problems_total > 0) && (
                <ProblemList
                  problems={sendProblems?.problems || audience.problems}
                  total={sendProblems?.total || audience.problems_total}
                />
              )}
              {!sendProblems && !audience.problems_total && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{t("settings_misc.broadcasts.send_warning")}</p>
              )}
            </>
          )}
        </Dialog>
      )}
    </>
  );
}
