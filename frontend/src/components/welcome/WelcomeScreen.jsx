import CrateLogo from './CrateLogo';
import Button from '../ui/Button';
import ThemeToggle from '../ui/ThemeToggle';
import './WelcomeScreen.css';

/**
 * WelcomeScreen — shown when the user is not authenticated yet.
 * 
 * Props:
 *   authStatus — 'checking' | 'logged-out' | 'error'
 *   error      — string | null, surfaced when authStatus === 'error'
 *   onLogin    — () => void, should call loginWithSpotify()
 */
export default function WelcomeScreen({ authStatus, error, onLogin }) {
  if (authStatus === 'checking') {
    return (
      <div className="welcome welcome--checking">
        <ThemeToggle />
        <div className="welcome__checking-mark spin">
          <CrateLogo size={64} />
        </div>
      </div>
    );
  }

  return (
    <div className="welcome">
      <ThemeToggle />

      <div className="welcome__card">
        <CrateLogo size={96} />

        <div className="welcome__copy">
          <h1 className="welcome__title">Crate</h1>
          <p className="welcome__subtitle">
            Turn random lists of songs into Spotify playlists. <br/> 
            Paste raw text, match tracks automatically, and save directly to your library.
          </p>
        </div>

        <Button size="lg" onClick={onLogin} className="welcome__cta">
          <svg
            className="welcome__cta-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            style={{ width: '30px', height: '30px', flexShrink: 0 }}
          >
            <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.586 14.424c-.18.295-.565.387-.86.207-2.377-1.454-5.37-1.783-8.893-.982-.336.076-.67-.135-.747-.472-.076-.336.135-.67.472-.747 3.856-.882 7.15-.506 9.822 1.13.295.18.387.563.206.864zm1.225-2.72c-.226.367-.707.487-1.074.26-2.72-1.672-6.87-2.157-10.076-1.182-.413.125-.847-.107-.972-.52-.125-.413.107-.847.52-.972 3.668-1.112 8.243-.57 11.34 1.333.367.226.488.707.262 1.08zm.106-2.833C14.792 8.9 9.3 8.72 6.13 9.683c-.482.146-.988-.128-1.134-.61-.147-.482.128-.988.61-1.134 3.653-1.108 9.7-.9 13.346 1.264.433.257.575.815.318 1.248-.258.433-.815.575-1.248.318z"/>
          </svg>
          Log in with Spotify
        </Button>

        {authStatus === 'error' && error && (
          <p className="welcome__error" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}