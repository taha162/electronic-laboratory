/**
 * The lab's own icon set: 24 px line drawings, round caps, drawn in currentColor
 * so they follow the button state. Replaces the emoji / unicode glyphs, which
 * looked different on every phone and could not be styled.
 */
import type { CSSProperties, ReactNode } from "react";

const P: Record<string, ReactNode> = {
  // experiments: lab flask with liquid level and bubbles
  flask: (
    <>
      <path d="M9 3h6M10 3v6.2L4.9 18a2 2 0 0 0 1.8 3h10.6a2 2 0 0 0 1.8-3L14 9.2V3" />
      <path d="M7.2 15h9.6" />
      <circle cx="11" cy="18" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="14" cy="17" r="0.7" fill="currentColor" stroke="none" />
    </>
  ),
  // saved work: drawer with an arrow into it
  saves: (
    <>
      <path d="M12 3.5v9M8.3 9l3.7 3.7L15.7 9" />
      <path d="M4 13.5l1.6-3.2h2.2M20 13.5l-1.6-3.2h-2.2M4 13.5V19a1.5 1.5 0 0 0 1.5 1.5h13A1.5 1.5 0 0 0 20 19v-5.5h-4.6a3.4 3.4 0 0 1-6.8 0z" />
    </>
  ),
  // X-ray: scope screen with a live trace and a node dot
  xray: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2.2" />
      <path d="M5.5 13.5l2.6-4.2 3 6.2 2.6-5 2 3h2.8" />
      <circle cx="18.5" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  more: (
    <>
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  soundOn: (
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9.3a3.8 3.8 0 0 1 0 5.4M18 6.8a7.3 7.3 0 0 1 0 10.4" />
    </>
  ),
  soundOff: (
    <>
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      <path d="M15.5 9.5l5 5M20.5 9.5l-5 5" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.6 9.4a2.5 2.5 0 1 1 3.6 2.3c-.8.4-1.2 1-1.2 1.8v.5" />
      <circle cx="12" cy="17" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  // render quality: meter dial
  gauge: (
    <>
      <path d="M4.2 16.5a8 8 0 1 1 15.6 0" />
      <path d="M12 16.5l3.6-4.6" />
      <circle cx="12" cy="16.5" r="1.3" fill="currentColor" stroke="none" />
      <path d="M6.8 11l1 .6M12 7.6v1.1M17.2 11l-1 .6" />
    </>
  ),
  undo: <path d="M9 14.5L4.5 10 9 5.5M4.5 10h10a5.2 5.2 0 0 1 0 10.4H12" />,
  redo: <path d="M15 14.5l4.5-4.5L15 5.5M19.5 10h-10a5.2 5.2 0 0 0 0 10.4H12" />,
  // clear the bench: patch cord with a cut
  clear: (
    <>
      <path d="M4 18c3-6 6 1 9-4.5" />
      <path d="M15.5 9.5l5-5M17 4.5h3.5V8" />
      <path d="M13.5 6.5l4 4M17.5 6.5l-4 4" />
    </>
  ),
  power: (
    <>
      <path d="M12 3.5V12" />
      <path d="M7.2 6.6a7.2 7.2 0 1 0 9.6 0" />
    </>
  ),
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  // views: camera
  camera: (
    <>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h2.4l1.6-2.2h6l1.6 2.2H19a1.5 1.5 0 0 1 1.5 1.5V18A1.5 1.5 0 0 1 19 19.5H5A1.5 1.5 0 0 1 3.5 18z" />
      <circle cx="12" cy="13" r="3.4" />
    </>
  ),
  chart: (
    <>
      <path d="M4 4v16h16" />
      <path d="M7.5 15l3.5-4.5 3 2.8 4.5-6" />
    </>
  ),
  // guide me: target with the next socket
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.6" />
      <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
    </>
  ),
  // auto-wire: banana plug
  plug: (
    <>
      <path d="M8.5 15.5L4 20" />
      <path d="M8 12l4 4 4.5-4.5-4-4z" />
      <path d="M14.5 9.5l3-3M12.5 7.5l2.2-2.2M16.5 11.5l2.2-2.2" />
    </>
  ),
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  next: <path d="M9.5 5.5L16 12l-6.5 6.5" />,
  prev: <path d="M14.5 5.5L8 12l6.5 6.5" />,
  download: (
    <>
      <path d="M12 4v11M7.5 10.5L12 15l4.5-4.5" />
      <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </>
  ),
  upload: (
    <>
      <path d="M12 15V4M7.5 8.5L12 4l4.5 4.5" />
      <path d="M4.5 16.5v2A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </>
  ),
  bolt: <path d="M13.5 2.8L5.5 13h6l-1 8.2 8-10.2h-6z" />,
  flame: <path d="M12 21c-3.8 0-6.2-2.6-6.2-6 0-3.6 3.1-5.6 3.6-9.3 2 1.5 3.1 3.2 3.1 5.2 1-.9 1.6-2 1.7-3.2 2.2 2 4 4.6 4 7.3 0 3.4-2.4 6-6.2 6z" />,
  burst: <path d="M12 3l1.9 4.9 5-2-2 5 4.9 1.9-4.9 1.9 2 5-5-2L12 21l-1.9-4.9-5 2 2-5L2.2 11.2l4.9-1.9-2-5 5 2z" />,
  sine: <path d="M2.5 12c1.6-5.4 4.8-5.4 6.3 0s4.8 5.4 6.4 0 4.7-5.4 6.3 0" />,
  triangle: <path d="M2.5 15.5l4.8-7 4.7 7 4.7-7 4.8 7" />,
  square: <path d="M2.5 15.5h4V8.5h5.5v7h5.5v-7h4" />,
  plus: <path d="M12 5.5v13M5.5 12h13" />,
  minus: <path d="M5.5 12h13" />,
  up: <path d="M6 15l6-6 6 6" />,
  down: <path d="M6 9l6 6 6-6" />,
  play: <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />,
  stop: <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" />,
  knob: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M12 12V5.8" />
      <path d="M4 19.5l1.6-1.6M20 19.5l-1.6-1.6" />
    </>
  ),
};

export type IconName = keyof typeof P;

export function Icon({ name, size = 18, className, style }: { name: IconName | string; size?: number; className?: string; style?: CSSProperties }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`inline-block shrink-0 ${className ?? ""}`}
      style={style}
      aria-hidden
    >
      {P[name]}
    </svg>
  );
}
