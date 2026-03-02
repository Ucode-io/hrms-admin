import { useState } from "react";
import { useDocumentsQuery } from "../../../../api/services/document.service";
import Spinner from "../../../../components/ui/Spinner";
import { Modal } from "../../../../components/ui/modal";
import { Eye, Download, Image, Video, FileText, File, FileSpreadsheet } from "lucide-react";

interface DocumentsTabProps {
  contractId: string;
}

// Document type icons using lucide-react
const DocumentIcon = ({ type, className = "w-8 h-8" }: { type: string; className?: string }) => {
  switch (type) {
    case "image":
      return <Image className={className} />;
    case "video":
      return <Video className={className} />;
    case "pdf":
      return <FileText className={className} />;
    case "doc":
      return <File className={className} />;
    case "xlsx":
      return <FileSpreadsheet className={className} />;
    default:
      return <File className={className} />;
  }
};

// Type badge colors
const getTypeBadgeColor = (type: string) => {
  switch (type) {
    case "image":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
    case "video":
      return "bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400";
    case "pdf":
      return "bg-red-100 text-red-700 dark:bg-red-500/20 dark:text-red-400";
    case "doc":
      return "bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400";
    case "xlsx":
      return "bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-500/20 dark:text-gray-400";
  }
};

// Type icon background colors
const getTypeIconBg = (type: string) => {
  switch (type) {
    case "image":
      return "bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400";
    case "video":
      return "bg-purple-50 text-purple-500 dark:bg-purple-500/10 dark:text-purple-400";
    case "pdf":
      return "bg-red-50 text-red-500 dark:bg-red-500/10 dark:text-red-400";
    case "doc":
      return "bg-blue-50 text-blue-500 dark:bg-blue-500/10 dark:text-blue-400";
    case "xlsx":
      return "bg-green-50 text-green-500 dark:bg-green-500/10 dark:text-green-400";
    default:
      return "bg-gray-50 text-gray-500 dark:bg-gray-500/10 dark:text-gray-400";
  }
};

export default function DocumentsTab({ contractId }: DocumentsTabProps) {
  const [previewModal, setPreviewModal] = useState<{ open: boolean; url: string; name: string; type: string }>({
    open: false,
    url: "",
    name: "",
    type: "",
  });

  // Fetch documents by contracts_id
  const { data: documentsData, isLoading } = useDocumentsQuery({
    data: { contracts_id: contractId },
  });

  const documents = documentsData?.response || [];

  const handlePreview = (doc: any) => {
    const type = doc.type?.[0] || "file";
    if (type === "image") {
      setPreviewModal({ open: true, url: doc.file, name: doc.name, type });
    } else {
      window.open(doc.file, "_blank");
    }
  };

  const handleDownload = (e: React.MouseEvent, url: string, name: string) => {
    e.stopPropagation();
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Spinner />
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] p-8 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
          <File className="w-8 h-8 text-gray-400" />
        </div>
        <p className="text-gray-500 dark:text-gray-400">Нет прикреплённых документов</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {documents.map((doc: any) => {
          const type = doc.type?.[0] || "file";
          return (
            <div
              key={doc.guid}
              className="group rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden hover:border-brand-200 dark:hover:border-brand-800 transition-colors cursor-pointer"
              onClick={() => handlePreview(doc)}
            >
              {/* Preview area */}
              <div className="relative h-40 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center">
                {type === "image" ? (
                  <img
                    src={doc.file}
                    alt={doc.name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                    }}
                  />
                ) : (
                  <div className={`p-4 rounded-xl ${getTypeIconBg(type)}`}>
                    <DocumentIcon type={type} />
                  </div>
                )}

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-black/40 dark:bg-black/60 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(doc);
                    }}
                    className="bg-white dark:bg-gray-800 p-3 rounded-full shadow-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    title="Открыть"
                  >
                    <Eye className="w-5 h-5 text-gray-800 dark:text-white/90" />
                  </button>
                  <button
                    onClick={(e) => handleDownload(e, doc.file, doc.name)}
                    className="bg-brand-500 hover:bg-brand-600 p-3 rounded-full shadow-lg transition-colors"
                    title="Скачать"
                  >
                    <Download className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h4 className="text-sm font-medium text-gray-800 dark:text-white/90 line-clamp-2">
                    {doc.name}
                  </h4>
                  <span className={`flex-shrink-0 px-2 py-0.5 text-xs font-medium rounded ${getTypeBadgeColor(type)}`}>
                    {type.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Image Preview Modal */}
      <Modal
        isOpen={previewModal.open}
        onClose={() => setPreviewModal({ open: false, url: "", name: "", type: "" })}
        className="max-w-4xl p-0 overflow-hidden"
      >
        <div className="relative">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              {previewModal.name}
            </h3>
            <button
              onClick={() => setPreviewModal({ open: false, url: "", name: "", type: "" })}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-900">
            <img
              src={previewModal.url}
              alt={previewModal.name}
              className="max-w-full max-h-[70vh] mx-auto rounded-lg"
            />
          </div>
        </div>
      </Modal>
    </>
  );
}
