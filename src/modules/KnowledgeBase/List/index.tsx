// Knowledge Base entry point. The module is a single article tree, so the home
// route just opens the root article. If there are no articles yet, it offers to
// create the first page.

import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import PageMeta from "../../../components/common/PageMeta";
import Button from "../../../components/ui/button/Button";
import { useHeaderBreadcrumbItems } from "../../../context/HeaderBreadcrumbContext";
import { useCreateKbArticle, useKbArticlesQuery } from "../../../api/services/knowledgeBase.service";

const BREADCRUMBS = [{ label: "База знаний", to: "/knowledge-base" }];

export default function KnowledgeBaseHome() {
  useHeaderBreadcrumbItems(useMemo(() => BREADCRUMBS, []));
  const navigate = useNavigate();
  const { data: articles, isLoading } = useKbArticlesQuery();
  const createArticle = useCreateKbArticle();

  const root = useMemo(
    () => (articles ?? []).find((a) => a.parentArticleId === null),
    [articles]
  );

  useEffect(() => {
    if (root) navigate(`/knowledge-base/articles/${root.id}`, { replace: true });
  }, [root, navigate]);

  const handleCreateFirst = () => {
    createArticle.mutate(
      { parentArticleId: null, title: "Без названия", icon: "📄" },
      {
        onSuccess: (res) => navigate(`/knowledge-base/articles/${res.guid}`),
        onError: () => toast.error("Не удалось создать страницу"),
      }
    );
  };

  return (
    <>
      <PageMeta title="База знаний" description="Внутренняя база знаний компании" />
      {!isLoading && !root && (
        <div className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-24 text-center">
          <BookOpen size={44} className="mb-4 text-gray-300" />
          <h1 className="text-lg font-semibold text-gray-800">База знаний пуста</h1>
          <p className="mt-1 text-sm text-gray-500">
            Создайте первую страницу — дальше вкладывайте подстраницы прямо внутри неё.
          </p>
          <Button
            size="sm"
            className="mt-5"
            startIcon={<Plus size={16} />}
            disabled={createArticle.isLoading}
            onClick={handleCreateFirst}
          >
            Создать первую страницу
          </Button>
        </div>
      )}
    </>
  );
}
