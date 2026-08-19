/**
 * Admin sign-in.
 *
 * The left half carries the cosmic hero the mobile apps open on (star field,
 * orbit rings, the sun-star mark); the right half is the form. Credentials are
 * step one, the six-digit verification code step two — the same OTP pattern the
 * customer app uses, applied here as the admin's second factor.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { BrandMark, Icon } from '../components/Icon';
import { Button, Checkbox, Field, Input, Note } from '../components/ui';
import { completeSignIn, resendOtp, signIn, verifyOtp } from '../services/admin';

/** Seeded by `npm run seed:admin`; shown as a hint on the form. */
const SEEDED = { email: 'admin@shreeastro.com', password: 'admin@123' };
const OTP_LENGTH = 6;

/** A fixed scatter of stars — seeded so the field does not twitch on re-render. */
const STARS = [
  [8, 12, 1.4, 0.5], [18, 30, 1, 0.35], [27, 8, 1.8, 0.6], [36, 22, 1.1, 0.4],
  [46, 6, 1.3, 0.5], [58, 18, 1.6, 0.45], [67, 9, 1, 0.3], [76, 26, 1.4, 0.55],
  [88, 14, 1.2, 0.4], [12, 48, 1.5, 0.45], [24, 62, 1, 0.3], [33, 78, 1.7, 0.5],
  [44, 55, 1.2, 0.4], [54, 71, 1.4, 0.45], [63, 88, 1, 0.3], [72, 60, 1.6, 0.5],
  [82, 74, 1.2, 0.35], [92, 52, 1.5, 0.45], [6, 88, 1.3, 0.4], [50, 40, 1, 0.3],
  [95, 34, 1.1, 0.35], [40, 94, 1.3, 0.4], [20, 92, 1, 0.28], [86, 92, 1.4, 0.4],
];

const ZODIAC = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(
  (glyph) => `${glyph}\uFE0E`,
);

function CosmicPanel() {
  return (
    <section className="login__hero" aria-hidden="true">
      <svg className="login__stars" viewBox="0 0 100 100" preserveAspectRatio="none">
        {STARS.map(([x, y, r, o], index) => (
          <circle key={index} cx={x} cy={y} r={r / 6} fill="#fff" opacity={o} />
        ))}
      </svg>

      <div className="login__orbit">
        <span className="login__orbit-ring login__orbit-ring--outer" />
        <span className="login__orbit-ring login__orbit-ring--inner" />
        {ZODIAC.map((glyph, index) => {
          const angle = (index / ZODIAC.length) * 2 * Math.PI - Math.PI / 2;
          return (
            <span
              key={glyph}
              className="login__glyph"
              style={{
                left: `${50 + Math.cos(angle) * 44}%`,
                top: `${50 + Math.sin(angle) * 44}%`,
              }}
            >
              {glyph}
            </span>
          );
        })}
        <span className="login__orbit-core">
          <BrandMark size={38} color="#FFFDF8" />
        </span>
      </div>

      <div className="login__hero-copy">
        <h2>
          Run the whole
          <br />
          cosmos from one desk
        </h2>
        <p>
          Users, astrologers, consultations, wallets and content — every module of
          Shree Astro, monitored in one place.
        </p>
        <ul className="login__hero-list">
          <li>
            <Icon name="userCheck" size={15} /> Approve astrologers &amp; verify documents
          </li>
          <li>
            <Icon name="activity" size={15} /> Watch live chat and voice consultations
          </li>
          <li>
            <Icon name="shield" size={15} /> Reconcile Razorpay settlements daily
          </li>
        </ul>
      </div>
    </section>
  );
}

function OtpBoxes({ value, onChange, invalid }) {
  const refs = useRef([]);

  const setDigit = (index, digit) => {
    const next = value.split('');
    next[index] = digit;
    onChange(next.join('').slice(0, OTP_LENGTH));
    if (digit && index < OTP_LENGTH - 1) refs.current[index + 1]?.focus();
  };

  return (
    <div className="otp">
      {Array.from({ length: OTP_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            refs.current[index] = node;
          }}
          className={`otp__box${invalid ? ' is-invalid' : ''}`}
          inputMode="numeric"
          maxLength={1}
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          aria-label={`Digit ${index + 1}`}
          value={value[index] || ''}
          onChange={(event) => setDigit(index, event.target.value.replace(/\D/g, ''))}
          onKeyDown={(event) => {
            if (event.key === 'Backspace' && !value[index] && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
            if (pasted) onChange(pasted.slice(0, OTP_LENGTH));
          }}
        />
      ))}
    </div>
  );
}

export function LoginPage({ onAuthenticated }) {
  const [step, setStep] = useState('credentials');
  const [email, setEmail] = useState(SEEDED.email);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [otp, setOtp] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [seconds, setSeconds] = useState(0);
  /**
   * The real code, which the API returns while there is no mail transport
   * wired up. Never present in production — see deliverOtp on the server.
   */
  const [devCode, setDevCode] = useState(null);

  useEffect(() => {
    if (step !== 'otp' || seconds === 0) return undefined;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [step, seconds]);

  const masked = useMemo(() => {
    const [name, domain] = email.split('@');
    if (!domain) return email;
    return `${name.slice(0, 2)}${'•'.repeat(Math.max(name.length - 2, 2))}@${domain}`;
  }, [email]);

  /**
   * Step one. The API checks the password and, when two-factor is on, sends a
   * code and answers `requiresOtp` instead of a session. With it switched off
   * the session comes straight back and there is no second step.
   */
  const submitCredentials = async (event) => {
    event.preventDefault();

    const next = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) next.email = 'Enter a valid email address';
    if (password.length < 6) next.password = 'Password must be at least 6 characters';
    setErrors(next);
    if (Object.keys(next).length) return;

    setBusy(true);
    try {
      const result = await signIn(email.trim(), password);

      if (!result.requiresOtp) {
        completeSignIn(result);
        onAuthenticated(result.admin);
        return;
      }

      setStep('otp');
      setOtp('');
      setSeconds(result.resendInSeconds || 30);
      setDevCode(result.devCode || null);
    } catch (error) {
      /** The API answers the same way for a wrong email and a wrong password. */
      setErrors({ password: error.message });
    } finally {
      setBusy(false);
    }
  };

  /** Step two: the code from the admin's inbox. */
  const submitOtp = async (event) => {
    event.preventDefault();

    if (otp.length < OTP_LENGTH) {
      setErrors({ otp: 'Enter all six digits' });
      return;
    }

    setBusy(true);
    try {
      const session = await verifyOtp(email.trim(), otp);
      onAuthenticated(session.admin);
    } catch (error) {
      setErrors({ otp: error.message });
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (seconds > 0) return;
    try {
      const sent = await resendOtp(email.trim());
      setSeconds(sent.resendInSeconds || 30);
      setDevCode(sent.devCode || null);
      setOtp('');
      setErrors({});
    } catch (error) {
      setErrors({ otp: error.message });
    }
  };

  return (
    <main className="login">
      <CosmicPanel />

      <section className="login__panel">
        <div className="login__form">
          <div className="login__brand">
            <span className="login__brand-mark">
              <BrandMark size={20} />
            </span>
            <span>
              <strong>Shree Astro</strong>
              <span>Admin Console</span>
            </span>
          </div>

          {step === 'credentials' ? (
            <form onSubmit={submitCredentials} noValidate>
              <header className="login__head">
                <h1>Welcome back ✨</h1>
                <p>Sign in to manage the platform.</p>
              </header>

              <div className="stack" style={{ gap: 16 }}>
                <Field label="Email address" error={errors.email} htmlFor="admin-email">
                  <Input
                    id="admin-email"
                    icon="mail"
                    type="email"
                    autoComplete="username"
                    placeholder="you@shreeastro.com"
                    value={email}
                    invalid={Boolean(errors.email)}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </Field>

                <Field label="Password" error={errors.password} htmlFor="admin-password">
                  <Input
                    id="admin-password"
                    icon="lock"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    invalid={Boolean(errors.password)}
                    onChange={(event) => setPassword(event.target.value)}
                    action={
                      <button
                        type="button"
                        className="input-group__action"
                        onClick={() => setShowPassword((shown) => !shown)}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                      </button>
                    }
                  />
                </Field>

                <div className="row row--between">
                  <Checkbox
                    label="Keep me signed in"
                    checked={remember}
                    onChange={(event) => setRemember(event.target.checked)}
                  />
                  <button type="button" className="login__link">
                    Forgot password?
                  </button>
                </div>

                <Button variant="primary" size="lg" block type="submit" disabled={busy}>
                  {busy ? 'Verifying…' : 'Continue'}
                  {!busy && <Icon name="chevronRight" size={16} />}
                </Button>
              </div>

              <p className="login__hint">
                Seeded by <strong>npm run seed:admin</strong> — {SEEDED.email} / {SEEDED.password}
              </p>
            </form>
          ) : (
            <form onSubmit={submitOtp} noValidate>
              <header className="login__head">
                <button
                  type="button"
                  className="login__back"
                  onClick={() => {
                    setStep('credentials');
                    setOtp('');
                    setErrors({});
                  }}
                >
                  <Icon name="arrowLeft" size={16} /> Back
                </button>
                <h1>Verify it&rsquo;s you</h1>
                <p>
                  We sent a six-digit code to <strong>{masked}</strong>.
                </p>
              </header>

              <div className="stack" style={{ gap: 18 }}>
                <OtpBoxes value={otp} onChange={setOtp} invalid={Boolean(errors.otp)} />
                {errors.otp && (
                  <span className="field__error">
                    <Icon name="alert" size={13} strokeWidth={2} />
                    {errors.otp}
                  </span>
                )}

                <div className="row row--between">
                  <span className="faint" style={{ fontSize: 12.5 }}>
                    {seconds > 0 ? `Resend code in 0:${String(seconds).padStart(2, '0')}` : 'Didn’t get the code?'}
                  </span>
                  <button
                    type="button"
                    className="login__link"
                    disabled={seconds > 0}
                    style={{ opacity: seconds > 0 ? 0.45 : 1 }}
                    onClick={resend}
                  >
                    Resend OTP
                  </button>
                </div>

                <Button variant="primary" size="lg" block type="submit" disabled={busy}>
                  {busy ? 'Signing in…' : 'Verify & sign in'}
                </Button>

                {devCode && (
                  <Note tone="info" icon="info">
                    No mail transport is wired up yet, so the code is{' '}
                    <strong>{devCode}</strong>. It is also printed to the server log,
                    and is never returned in production.
                  </Note>
                )}
              </div>
            </form>
          )}

          <footer className="login__foot">
            <span>Protected by two-factor verification</span>
            <span>© 2026 Shree Astro · Mariox Software</span>
          </footer>
        </div>
      </section>
    </main>
  );
}

export default LoginPage;
