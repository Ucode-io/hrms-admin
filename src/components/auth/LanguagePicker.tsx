import { useState, useRef, useEffect } from "react";

interface Language {
  code: string;
  name: string;
  flag: React.ReactNode;
}

const UzbekFlag = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="20" rx="10" fill="#1EB53A" />
    <path d="M0 3.333C1.55 1.302 4.012 0 6.667 0h6.666C15.988 0 18.45 1.302 20 3.333H0Z" fill="#0099B5" />
    <path d="M0 6.667h20V3.333H0v3.334Z" fill="#CE1126" />
    <path d="M0 6.667C0 6.444 0 6.222 0 6h20c0 .222 0 .444 0 .667H0Z" fill="white" />
    <path d="M0 13.333h20V6.667H0v6.666Z" fill="#1EB53A" />
    <path d="M0 16.667h20v-3.334H0v3.334Z" fill="white" />
    <path d="M0 16.667C1.55 18.698 4.012 20 6.667 20h6.666c2.655 0 5.117-1.302 6.667-3.333H0Z" fill="#CE1126" />
    <circle cx="6" cy="5" r="2.5" fill="white" />
    <circle cx="7" cy="5" r="2.5" fill="#0099B5" />
  </svg>
);

const RussianFlag = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="20" height="20" rx="10" fill="#0039A6" />
    <path d="M0 3.333C1.55 1.302 4.012 0 6.667 0h6.666C15.988 0 18.45 1.302 20 3.333H0Z" fill="white" />
    <path d="M0 6.667h20V3.333H0v3.334Z" fill="white" />
    <path d="M0 13.333h20V6.667H0v6.666Z" fill="#0039A6" />
    <path d="M0 16.667h20v-3.334H0v3.334Z" fill="#D52B1E" />
    <path d="M0 16.667C1.55 18.698 4.012 20 6.667 20h6.666c2.655 0 5.117-1.302 6.667-3.333H0Z" fill="#D52B1E" />
  </svg>
);

const languages: Language[] = [
  { code: "uz", name: "O'zbek", flag: <UzbekFlag /> },
  { code: "ru", name: "Русский", flag: <RussianFlag /> },
];

export default function LanguagePicker() {
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<Language>(languages[1]); // Russian by default
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return null

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg text-white/90 hover:bg-white/10 transition-colors cursor-pointer"
        type="button"
      >
        {selected.flag}
        <span className="text-sm font-medium">{selected.name}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          <path
            d="M3 4.5L6 7.5L9 4.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-44 bg-white rounded-xl shadow-theme-lg py-1.5 z-50">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setSelected(lang);
                setIsOpen(false);
              }}
              className="flex items-center gap-3 w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer"
              type="button"
            >
              {lang.flag}
              <span className="flex-1 text-left">{lang.name}</span>
              {selected.code === lang.code && (
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 16 16"
                  fill="none"
                >
                  <path
                    d="M3.333 8L6.667 11.333 12.667 5.333"
                    stroke="#B38D80"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
