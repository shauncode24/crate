import './CrateLogo.css';

/**
 * The round green music-note mark used on the welcome screen.
 * size: pixel diameter of the circle.
 */
export default function CrateLogo({ size = 96 }) {
  return (
    <div className="crate-logo" style={{ width: size, height: size }}>
      <svg
        width={size * 0.5}
        height={size * 0.5}
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M9 18V5l12-2v13"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8" />
        <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    </div>
  );
}