import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";
import { useTranslation } from "../../i18n";

export default function SignIn() {
  const { t } = useTranslation();
  return (
    <>
      <PageMeta
        title={`${t("auth.meta_title")} — NSTEX`}
        description={t("auth.meta_description", { brand: "NSTEX" })}
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}

