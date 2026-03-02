import PageMeta from "../../components/common/PageMeta";
import AuthLayout from "./AuthPageLayout";
import SignInForm from "../../components/auth/SignInForm";

export default function SignIn() {
  return (
    <>
      <PageMeta
        title="Вход — NSTEX"
        description="Войдите в систему управления NSTEX"
      />
      <AuthLayout>
        <SignInForm />
      </AuthLayout>
    </>
  );
}

