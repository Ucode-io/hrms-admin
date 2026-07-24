// ВРЕМЕННЫЙ entry для локальной визуальной проверки KPI-модуля (см. kpi-verify.html).
// Мок-адаптер обязан импортироваться первым — до модулей с axios.create().
import "./kpi-verify-mock";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router";
import { QueryClient, QueryClientProvider } from "react-query";
import { Toaster } from "sonner";
import "./index.css";
import "swiper/swiper-bundle.css";
import "flatpickr/dist/flatpickr.css";
import { AppWrapper } from "./components/common/PageMeta.tsx";
import { ThemeProvider } from "./context/ThemeContext.tsx";
import KpiPage from "./modules/KPI";

const queryClient = new QueryClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ThemeProvider>
      <AppWrapper>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <Toaster position="top-right" richColors closeButton />
            <div className="p-4">
              <KpiPage />
            </div>
          </BrowserRouter>
        </QueryClientProvider>
      </AppWrapper>
    </ThemeProvider>
  </StrictMode>
);
