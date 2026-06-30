import './TopNav.css';

export default function TopNav({ displayName = 'User', onLogout }) {
  return (
    <header className="topnav">
      <div className="topnav__inner">
        <div className="topnav__brand">
          <div className="topnav__logo">♪</div>
          <span className="topnav__name">Crate</span>
        </div>

        <div className="topnav__right">
          <div className="topnav__user">
            <div className="topnav__avatar">{displayName?.charAt(0) || 'U'}</div>
            <span className="topnav__username">{displayName}</span>
          </div>
          <button className="topnav__logout" onClick={onLogout}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Log out
          </button>
        </div>
      </div>
    </header>
  );
}