/** 16px outline icons, 1.5px stroke, one set. Decorative: labels always carry the meaning. */
type IconProps = { className?: string };

function Svg({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      {children}
    </svg>
  );
}

export function DriftIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <rect x="4.5" y="2.5" width="8" height="11" rx="1.25" transform="rotate(8 8.5 8)" />
      <path d="M3.2 4.6 2.6 12a1.2 1.2 0 0 0 1.1 1.3l1.6.1" />
    </Svg>
  );
}

export function TripsIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="3.5" cy="12.5" r="1.5" />
      <circle cx="12.5" cy="3.5" r="1.5" />
      <path d="M5 12.5h4.5a2.25 2.25 0 0 0 0-4.5h-3a2.25 2.25 0 0 1 0-4.5H11" />
    </Svg>
  );
}

export function AtlasIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="8" r="6.25" />
      <path d="M1.75 8h12.5M8 1.75c1.7 1.8 2.5 3.9 2.5 6.25S9.7 12.45 8 14.25C6.3 12.45 5.5 10.35 5.5 8S6.3 3.55 8 1.75Z" />
    </Svg>
  );
}

export function NotesIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M3.5 2.25h7.25a1.75 1.75 0 0 1 1.75 1.75v8.75a1 1 0 0 1-1 1H3.5Z" />
      <path d="M3.5 2.25v11.5M6 5.5h4M6 8h4" />
    </Svg>
  );
}

export function AccountIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="8" cy="5.5" r="2.75" />
      <path d="M2.75 13.75a5.25 5.25 0 0 1 10.5 0" />
    </Svg>
  );
}

export function DnaIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M5 1.75c0 4.25 6 4.25 6 8.5s-6 1.75-6 4M11 1.75c0 4.25-6 4.25-6 8.5" />
      <path d="M6 4.5h4M6.5 8h3M6 11.5h4" />
    </Svg>
  );
}

export function PlaneIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <path d="M14 2 9.2 6.8 3 5.2l-1 1 5 2.6-2.2 2.4-1.9-.3-.7.7 2.5 1.1 1.1 2.5.7-.7-.3-1.9L8.6 10.4l2.6 5 1-1-1.6-6.2L14 4.4a1.7 1.7 0 0 0 0-2.4Z" />
    </Svg>
  );
}

export function HuddleIcon(props: IconProps) {
  return (
    <Svg {...props}>
      <circle cx="5.5" cy="5.5" r="2" />
      <circle cx="11.2" cy="6.2" r="1.6" />
      <path d="M1.8 13.2a3.7 3.7 0 0 1 7.4 0M9.6 10a3 3 0 0 1 4.6 2.6" />
    </Svg>
  );
}
