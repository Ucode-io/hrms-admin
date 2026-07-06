import { useInView } from "./Reveal";

function Frame({ children }: { children: React.ReactNode }) {
  const { ref, inView } = useInView<HTMLDivElement>(0.3);
  return (
    <div ref={ref} className={inView ? "[&_.ld-anim]:[animation-play-state:running]" : "[&_.ld-anim]:[animation-play-state:paused]"}>
      {children}
    </div>
  );
}

/** Воронка рекрутинга */
export function RecruitingIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 420 320" fill="none" className="w-full">
        <rect x="20" y="20" width="380" height="280" rx="24" fill="#f7f9ff" />
        {/* Funnel stages */}
        {[
          { w: 280, y: 60, fill: "#1858F3", label: "Отклики · 128" },
          { w: 220, y: 116, fill: "#4f7ef6", label: "Скрининг · 64" },
          { w: 160, y: 172, fill: "#86a6f9", label: "Интервью · 22" },
          { w: 100, y: 228, fill: "#bdcffb", label: "Оффер · 6" },
        ].map((s, i) => (
          <g key={i} className="ld-anim ld-reveal is-in" style={{ ["--ld-delay" as string]: `${i * 150}ms` }}>
            <rect
              x={210 - s.w / 2}
              y={s.y}
              width={s.w}
              height={40}
              rx={12}
              fill={s.fill}
            />
            <text
              x={210}
              y={s.y + 25}
              textAnchor="middle"
              fontSize="14"
              fontWeight="600"
              fill={i < 2 ? "#ffffff" : "#1c3fa8"}
            >
              {s.label}
            </text>
          </g>
        ))}
        {/* Candidate avatars */}
        {[
          { cx: 60, cy: 70 },
          { cx: 360, cy: 100 },
          { cx: 52, cy: 180 },
          { cx: 368, cy: 210 },
        ].map((a, i) => (
          <g key={i} className={`ld-anim ${i % 2 ? "ld-float-slow" : "ld-float"}`}>
            <circle cx={a.cx} cy={a.cy} r="18" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
            <circle cx={a.cx} cy={a.cy - 4} r="6" fill="#86a6f9" />
            <path
              d={`M ${a.cx - 9} ${a.cy + 10} q 9 -10 18 0`}
              fill="#86a6f9"
            />
          </g>
        ))}
        {/* Dashed connectors */}
        <path className="ld-dash ld-anim" d="M 78 76 Q 120 80 130 76" stroke="#9cb9ff" strokeWidth="2" fill="none" />
        <path className="ld-dash ld-anim" d="M 342 104 Q 310 120 300 126" stroke="#9cb9ff" strokeWidth="2" fill="none" />
      </svg>
    </Frame>
  );
}

/** Учёт времени: календарь + часы */
export function TimeIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 420 320" fill="none" className="w-full">
        <rect x="20" y="20" width="380" height="280" rx="24" fill="#f7f9ff" />
        {/* Calendar */}
        <rect x="60" y="60" width="220" height="200" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
        <rect x="60" y="60" width="220" height="48" rx="16" fill="#1858F3" />
        <rect x="60" y="92" width="220" height="16" fill="#1858F3" />
        <text x="170" y="90" textAnchor="middle" fontSize="15" fontWeight="600" fill="#ffffff">
          Июль 2026
        </text>
        {Array.from({ length: 21 }).map((_, i) => {
          const col = i % 7;
          const row = Math.floor(i / 7);
          const highlighted = [3, 9, 10, 16].includes(i);
          return (
            <rect
              key={i}
              className="ld-anim ld-reveal is-in"
              style={{ ["--ld-delay" as string]: `${i * 40}ms` }}
              x={76 + col * 28}
              y={124 + row * 40}
              width={20}
              height={28}
              rx={6}
              fill={highlighted ? "#1858F3" : "#eef3fe"}
              opacity={highlighted ? 1 : 0.9}
            />
          );
        })}
        {/* Clock */}
        <g className="ld-anim ld-float">
          <circle cx="330" cy="150" r="52" fill="#ffffff" stroke="#1858F3" strokeWidth="3" />
          <circle cx="330" cy="150" r="4" fill="#1858F3" />
          <line x1="330" y1="150" x2="330" y2="118" stroke="#1858F3" strokeWidth="4" strokeLinecap="round" />
          <line x1="330" y1="150" x2="352" y2="162" stroke="#7592ff" strokeWidth="4" strokeLinecap="round" />
        </g>
        {/* Check chip */}
        <g className="ld-anim ld-float-fast">
          <rect x="286" y="222" width="104" height="36" rx="18" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
          <circle cx="306" cy="240" r="8" fill="#12b76a" />
          <path d="M 302 240 l 3 3 l 6 -6" stroke="#ffffff" strokeWidth="2" fill="none" strokeLinecap="round" />
          <text x="322" y="245" fontSize="12" fontWeight="600" fill="#344054">
            09:00
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** Зарплата и финансы */
export function PayrollIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 420 320" fill="none" className="w-full">
        <rect x="20" y="20" width="380" height="280" rx="24" fill="#f7f9ff" />
        {/* Payslip */}
        <rect x="70" y="52" width="200" height="216" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
        <rect x="90" y="76" width="90" height="12" rx="6" fill="#1858F3" />
        <rect x="90" y="100" width="160" height="8" rx="4" fill="#eef3fe" />
        <rect x="90" y="118" width="130" height="8" rx="4" fill="#eef3fe" />
        {[0, 1, 2].map((i) => (
          <g key={i} className="ld-anim ld-reveal is-in" style={{ ["--ld-delay" as string]: `${200 + i * 180}ms` }}>
            <rect x="90" y={146 + i * 34} width="160" height="24" rx="8" fill="#f7f9ff" />
            <rect x="98" y={154 + i * 34} width="60" height="8" rx="4" fill="#c2d6ff" />
            <rect x="200" y={154 + i * 34} width="42" height="8" rx="4" fill="#1858F3" opacity="0.7" />
          </g>
        ))}
        <rect x="90" y="248" width="160" height="1.5" fill="#dbe5fd" />
        {/* Coin stack */}
        <g className="ld-anim ld-float">
          <ellipse cx="330" cy="240" rx="46" ry="14" fill="#1858F3" />
          <ellipse cx="330" cy="228" rx="46" ry="14" fill="#4f7ef6" />
          <ellipse cx="330" cy="216" rx="46" ry="14" fill="#7592ff" />
          <ellipse cx="330" cy="204" rx="46" ry="14" fill="#9cb9ff" />
          <ellipse cx="330" cy="200" rx="46" ry="13" fill="#c2d6ff" />
          <text x="330" y="205" textAnchor="middle" fontSize="14" fontWeight="700" fill="#1c3fa8">
            UZS
          </text>
        </g>
        {/* Rising arrow */}
        <path
          className="ld-draw ld-anim"
          d="M 290 150 Q 320 120 344 128 Q 372 136 382 96"
          stroke="#12b76a"
          strokeWidth="4"
          fill="none"
          strokeLinecap="round"
        />
        <path d="M 372 94 l 12 -4 l -2 13" stroke="#12b76a" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        {/* Percent chip */}
        <g className="ld-anim ld-float-fast">
          <rect x="286" y="52" width="72" height="30" rx="15" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
          <text x="322" y="72" textAnchor="middle" fontSize="13" fontWeight="700" fill="#12b76a">
            +24%
          </text>
        </g>
      </svg>
    </Frame>
  );
}

/** Аналитика и отчёты */
export function AnalyticsIllustration() {
  return (
    <Frame>
      <svg viewBox="0 0 420 320" fill="none" className="w-full">
        <rect x="20" y="20" width="380" height="280" rx="24" fill="#f7f9ff" />
        {/* Line chart card */}
        <rect x="52" y="48" width="230" height="150" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
        <rect x="70" y="66" width="80" height="10" rx="5" fill="#1858F3" />
        {[0, 1, 2, 3].map((i) => (
          <line key={i} x1="70" y1={100 + i * 24} x2="264" y2={100 + i * 24} stroke="#eef3fe" strokeWidth="1.5" />
        ))}
        <path
          className="ld-draw ld-anim"
          d="M 70 168 L 105 150 L 138 158 L 170 122 L 202 132 L 234 100 L 264 108"
          stroke="#1858F3"
          strokeWidth="3.5"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="234" cy="100" r="6" fill="#1858F3" stroke="#ffffff" strokeWidth="2.5" />
        {/* Donut card */}
        <g className="ld-anim ld-float">
          <rect x="256" y="150" width="130" height="130" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
          <g transform="rotate(-90 321 215)">
            <circle cx="321" cy="215" r="36" fill="none" stroke="#eef3fe" strokeWidth="14" />
            <circle
              className="ld-ring ld-anim"
              cx="321"
              cy="215"
              r="36"
              fill="none"
              stroke="#1858F3"
              strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray="226"
              strokeDashoffset="70"
            />
          </g>
          <text x="321" y="220" textAnchor="middle" fontSize="15" fontWeight="700" fill="#101828">
            69%
          </text>
        </g>
        {/* Mini bars card */}
        <g className="ld-anim ld-float-slow">
          <rect x="300" y="48" width="86" height="86" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
          {[34, 52, 24, 44].map((h, i) => (
            <rect
              key={i}
              className="ld-bar ld-anim"
              style={{ ["--ld-bar-delay" as string]: `${i * 120}ms` }}
              x={314 + i * 16}
              y={118 - h}
              width={10}
              height={h}
              rx={4}
              fill={i === 1 ? "#1858F3" : "#c2d6ff"}
            />
          ))}
        </g>
        {/* Stat chips */}
        <g className="ld-anim ld-float-fast">
          <rect x="52" y="222" width="180" height="52" rx="16" fill="#ffffff" stroke="#dbe5fd" strokeWidth="2" />
          <circle cx="80" cy="248" r="14" fill="#eef3fe" />
          <path d="M 74 248 l 4 4 l 8 -8" stroke="#1858F3" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <rect x="104" y="236" width="90" height="9" rx="4.5" fill="#344054" opacity="0.85" />
          <rect x="104" y="252" width="60" height="8" rx="4" fill="#eef3fe" />
        </g>
      </svg>
    </Frame>
  );
}
