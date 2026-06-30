import logoImg from '../../assets/logo3.png';
import './CrateLogo.css';

/**
 * The Crate logo image component.
 * size: pixel dimension of the logo.
 */
export default function CrateLogo({ size = 96 }) {
  return (
    <div className="crate-logo" style={{ width: size, height: size }}>
      <img
        src={logoImg}
        alt="Crate Logo"
        className="crate-logo__image"
        style={{ width: size * 1, height: size * 1, objectFit: 'contain' }}
      />
    </div>
  );
}
