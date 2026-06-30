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
            Import your raw tracklists into Spotify seamlessly. <br/> Paste text,
            let AI find the songs, and create your playlist.
          </p>
        </div>

        <Button size="lg" onClick={onLogin} className="welcome__cta">
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