import { ChevronLeft, ChevronRight } from "lucide-react";
import SidebarAwareFixedFooter from "../../../../components/layout/SidebarAwareFixedFooter";

type PaginationItem = number | string;

interface EmployeesPaginationFooterProps {
  visibleRangeLabel: string;
  paginationItems: PaginationItem[];
  currentPage: number;
  totalPages: number;
  brandColor: string;
  onPrevious: () => void;
  onNext: () => void;
  onPageChange: (page: number) => void;
}

export default function EmployeesPaginationFooter({
  visibleRangeLabel,
  paginationItems,
  currentPage,
  totalPages,
  brandColor,
  onPrevious,
  onNext,
  onPageChange,
}: EmployeesPaginationFooterProps) {
  return (
    <SidebarAwareFixedFooter>
      <span style={{ fontSize: "13px", color: "#475569", fontWeight: 500 }}>
        {visibleRangeLabel}
      </span>

      <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button
            id="employees-page-prev"
            onClick={onPrevious}
            disabled={currentPage === 1}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              border: "1px solid #e2e8f0",
              borderRadius: "9px",
              backgroundColor: "#fff",
              color: currentPage === 1 ? "#cbd5e1" : "#1e293b",
              cursor: currentPage === 1 ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <ChevronLeft style={{ width: "16px", height: "16px" }} />
          </button>

          {paginationItems.map((item) => {
            if (typeof item !== "number") {
              return (
                <span
                  key={item}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minWidth: "32px",
                    height: "32px",
                    color: "#94a3b8",
                    fontSize: "13px",
                  }}
                >
                  ...
                </span>
              );
            }

            const isActivePage = currentPage === item;

            return (
              <button
                key={item}
                onClick={() => onPageChange(item)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "34px",
                  height: "34px",
                  padding: "0 8px",
                  border: isActivePage ? `1px solid ${brandColor}` : "1px solid #e2e8f0",
                  borderRadius: "9px",
                  backgroundColor: isActivePage ? brandColor : "#fff",
                  color: isActivePage ? "#fff" : "#1e293b",
                  fontWeight: isActivePage ? 600 : 500,
                  fontSize: "13px",
                  cursor: "pointer",
                  transition: "all 0.15s",
                }}
              >
                {item}
              </button>
            );
          })}

          <button
            id="employees-page-next"
            onClick={onNext}
            disabled={currentPage === totalPages}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              border: "1px solid #e2e8f0",
              borderRadius: "9px",
              backgroundColor: "#fff",
              color: currentPage === totalPages ? "#cbd5e1" : "#1e293b",
              cursor: currentPage === totalPages ? "default" : "pointer",
              transition: "all 0.15s",
            }}
          >
            <ChevronRight style={{ width: "16px", height: "16px" }} />
          </button>
      </div>
    </SidebarAwareFixedFooter>
  );
}
