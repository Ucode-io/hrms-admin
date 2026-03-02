import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router";

export default function UnderDevelopment() {
  return (
    <>
      <PageMeta
        title="В разработке | Ayva Finance"
        description="Этот модуль находится в разработке"
      />
      <div className="flex items-center justify-center p-0 bg-gray-50 dark:bg-gray-900">
        <div className="w-full max-w-2xl">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg pb-8 px-8 md:pb-12 md:px-12 text-center">

            <div className="mb-0 flex justify-center">
              <img
                src="/images/under-development.jpg"
                alt="Under Development"
                className="max-w-sm w-full h-auto rounded-lg"
              />
            </div>
            <h1 className="mb-8 text-3xl md:text-4xl font-bold text-gray-800 dark:text-white">
              В разработке
            </h1>
            <p className="mb-10 text-base md:text-lg text-gray-600 dark:text-gray-300 max-w-md mx-auto">
              Этот модуль находится на этапе разработки и скоро будет доступен.
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2.5 bg-brand-600 hover:bg-brand-700 px-8 py-3.5 font-medium text-white rounded-lg transition-colors duration-200 shadow-sm hover:shadow-md"
            >
              <svg
                className="fill-current"
                width="16"
                height="14"
                viewBox="0 0 16 14"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M14.7492 6.38125H2.73984L7.52109 1.51562C7.77422 1.2625 7.77422 0.86875 7.52109 0.615625C7.26797 0.3625 6.87422 0.3625 6.62109 0.615625L0.799219 6.52187C0.546094 6.775 0.546094 7.16875 0.799219 7.42188L6.62109 13.3281C6.73359 13.4406 6.90234 13.525 7.07109 13.525C7.23984 13.525 7.38047 13.4687 7.52109 13.3562C7.77422 13.1031 7.77422 12.7094 7.52109 12.4563L2.76797 7.64687H14.7492C15.0867 7.64687 15.368 7.36562 15.368 7.02812C15.368 6.6625 15.0867 6.38125 14.7492 6.38125Z"
                  fill=""
                />
              </svg>
              Вернуться на главную
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
