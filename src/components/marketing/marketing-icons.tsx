import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function base(props: IconProps) {
  return {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M4 4h16v11H8l-4 4z" />
      <path d="M8 9h8" />
      <path d="M8 12.5h5" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  );
}

export function SendIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M21 3L3 10.5l7.5 3L14 21z" />
      <path d="M10.5 13.5L21 3" />
    </svg>
  );
}

export function MailIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3.5 6.5L12 13l8.5-6.5" />
    </svg>
  );
}

export function CalendarDotIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 3v4" />
      <path d="M16 3v4" />
      <circle cx="12" cy="15" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function UsersIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="9" cy="8" r="3.3" />
      <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
      <path d="M16.5 4.6c1.7.4 3 1.9 3 3.7 0 1.8-1.3 3.3-3 3.7" />
      <path d="M19 14.3c2 .5 3.5 2.2 3.5 4.4" />
    </svg>
  );
}

export function ArrowRightIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M5 12h14" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function ShieldIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l7 3v6c0 4.5-3 7.7-7 9-4-1.3-7-4.5-7-9V6z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}

export function SparkIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" />
    </svg>
  );
}

export function TargetIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function CompassIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <circle cx="12" cy="12" r="9" />
      <path d="M15 9l-2 6-6 2 2-6z" />
    </svg>
  );
}

export function HeartHandshakeIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M12 6.5c-1.2-1.7-3.6-2.4-5.5-1.1C4 6.9 3.5 10.1 5.8 12.5L12 19l6.2-6.5c2.3-2.4 1.8-5.6-.7-7.1-1.9-1.3-4.3-.6-5.5 1.1z" />
    </svg>
  );
}

export function PhoneIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <path d="M6 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2L20 15v3a2 2 0 0 1-2 2C10.8 20 4 13.2 4 5a2 2 0 0 1 2-2z" />
    </svg>
  );
}

export function BuildingIcon(props: IconProps) {
  return (
    <svg {...base(props)}>
      <rect x="4" y="3" width="10" height="18" rx="1" />
      <rect x="16" y="9" width="4" height="12" rx="1" />
      <path d="M7 7h.01" />
      <path d="M10.5 7h.01" />
      <path d="M7 11h.01" />
      <path d="M10.5 11h.01" />
      <path d="M7 15h.01" />
      <path d="M10.5 15h.01" />
    </svg>
  );
}
