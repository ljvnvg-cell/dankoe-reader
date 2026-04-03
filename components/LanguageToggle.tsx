"use client";

export type Lang = "en" | "zh" | "dual";

export default function LanguageToggle({
  lang,
  onChange,
}: {
  lang: Lang;
  onChange: (lang: Lang) => void;
}) {
  const options: { value: Lang; label: string }[] = [
    { value: "en", label: "EN" },
    { value: "zh", label: "中" },
    { value: "dual", label: "双语" },
  ];

  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden text-sm">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1.5 transition-colors ${
            lang === opt.value
              ? "bg-accent text-white"
              : "bg-card-bg text-muted hover:text-foreground"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
