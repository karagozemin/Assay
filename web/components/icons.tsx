/**
 * Hand-tuned 24px stroke icon set (1.5px, rounded) so the product never leans
 * on emoji. Consistent optical weight = instant "real product" feel.
 */
type P = { className?: string };

const base = "h-4 w-4";

export function FlaskIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 3h5M10 3v5.2c0 .5-.15 1-.42 1.42L4.9 16.9C3.63 18.9 5.06 21.5 7.42 21.5h9.16c2.36 0 3.79-2.6 2.52-4.6l-4.68-7.28A2.6 2.6 0 0 1 14 8.2V3"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7.5 15h9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <circle cx="11" cy="18" r="1" fill="currentColor" />
      <circle cx="14.5" cy="17" r=".75" fill="currentColor" />
    </svg>
  );
}

export function BoltIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M13 2.5 4.5 13.5H11l-.9 8L18.5 10.5H12l1-8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShieldIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M12 2.8 4.5 5.6v5.2c0 4.6 3.2 8.6 7.5 10.4 4.3-1.8 7.5-5.8 7.5-10.4V5.6L12 2.8Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="m9 11.8 2.2 2.2L15.4 9.7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CoinIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M15 9.3c-.6-.8-1.7-1.3-3-1.3-1.8 0-3 .9-3 2s1 1.7 3 2 3 .9 3 2-1.2 2-3 2c-1.3 0-2.4-.5-3-1.3M12 6.5V8m0 8v1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function WalletIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M3.5 7.5a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v0h-13a2 2 0 0 1-2-2v0Zm0 0V17a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" />
    </svg>
  );
}

export function LedgerIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M5 4.5A1.5 1.5 0 0 1 6.5 3h11A1.5 1.5 0 0 1 19 4.5v15A1.5 1.5 0 0 1 17.5 21h-11A1.5 1.5 0 0 1 5 19.5v-15Z"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M8.5 8h7M8.5 12h7M8.5 16h4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function BanIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M6 6l12 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function XIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M6.5 6.5l11 11m0-11-11 11"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CacheIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 12a8 8 0 0 1 13.6-5.7L20 8.5M20 8.5V4m0 4.5h-4.5M20 12a8 8 0 0 1-13.6 5.7L4 15.5m0 0V20m0-4.5h4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ArrowRightIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M4 12h16m0 0-6-6m6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PlayIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M8 5.8v12.4c0 .8.9 1.3 1.6.9l10-6.2a1 1 0 0 0 0-1.8l-10-6.2A1.05 1.05 0 0 0 8 5.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function ChainIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M10 14a4.2 4.2 0 0 0 6 0l3-3a4.24 4.24 0 0 0-6-6l-1.5 1.5M14 10a4.2 4.2 0 0 0-6 0l-3 3a4.24 4.24 0 0 0 6 6l1.5-1.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function BrainIcon({ className = base }: P) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M9.5 4a2.7 2.7 0 0 0-2.7 2.7c-1.6.3-2.8 1.6-2.8 3.3 0 .9.3 1.6.9 2.2A3.4 3.4 0 0 0 4 14.7 3.3 3.3 0 0 0 7.3 18c.2 1.4 1.4 2.5 2.9 2.5 1 0 1.8-.5 2.3-1.2V6.2A2.68 2.68 0 0 0 9.5 4ZM14.5 4a2.7 2.7 0 0 1 2.7 2.7c1.6.3 2.8 1.6 2.8 3.3 0 .9-.3 1.6-.9 2.2a3.4 3.4 0 0 1 .9 2.5 3.3 3.3 0 0 1-3.3 3.3c-.2 1.4-1.4 2.5-2.9 2.5-1 0-1.8-.5-2.3-1.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Brand mark: flask inside a rounded square gradient. */
export function LogoMark({ className = "h-8 w-8" }: P) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} aria-hidden>
      <rect width="32" height="32" rx="9" fill="url(#lg)" />
      <path
        d="M13.6 8h4.8M14 8v3.9c0 .4-.12.79-.34 1.13l-3.4 5.32c-.95 1.5.12 3.45 1.9 3.45h7.68c1.78 0 2.85-1.95 1.9-3.45l-3.4-5.32A2.1 2.1 0 0 1 18 11.9V8"
        stroke="#fff"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M12.4 17h7.2" stroke="#fff" strokeWidth="1.7" strokeLinecap="round" />
      <defs>
        <linearGradient id="lg" x1="0" y1="0" x2="32" y2="32">
          <stop stopColor="#9d8ffa" />
          <stop offset="1" stopColor="#6650e8" />
        </linearGradient>
      </defs>
    </svg>
  );
}
