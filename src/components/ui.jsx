/**
 * Primitive building blocks shared by every admin page.
 *
 * They are deliberately thin — a class name and the markup the stylesheet
 * expects — so a page reads as layout rather than as styling.
 */

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';
import { cx } from '../utils/cx';

/* ————————————————————————————————— Button */

export function Button({
  variant = 'ghost',
  size,
  icon,
  iconRight,
  block,
  children,
  className,
  ...rest
}) {
  return (
    <button
      type="button"
      className={cx(
        'btn',
        `btn--${variant}`,
        size && `btn--${size}`,
        block && 'btn--block',
        !children && 'btn--icon',
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} size={size === 'sm' ? 14 : 16} />}
      {children}
      {iconRight && <Icon name={iconRight} size={size === 'sm' ? 14 : 16} />}
    </button>
  );
}

/* ————————————————————————————————— Card */

export function Card({ title, subtitle, action, footer, flush, children, className }) {
  return (
    <section className={cx('card', className)}>
      {(title || action) && (
        <header className="card__head">
          <div>
            {title && <h2 className="card__title">{title}</h2>}
            {subtitle && <p className="card__subtitle">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      <div className={cx('card__body', flush && 'card__body--flush')}>{children}</div>
      {footer && <footer className="card__foot">{footer}</footer>}
    </section>
  );
}

/* ————————————————————————————————— Stat */

export function StatCard({ label, value, icon, tone = 'plain', delta, deltaTone, hint }) {
  return (
    <article className="stat">
      <div className="stat__top">
        <div>
          <p className="stat__label">{label}</p>
          <p className="stat__value">{value}</p>
        </div>
        {icon && (
          <span className={cx('stat__icon', tone !== 'plain' && `stat__icon--${tone}`)}>
            <Icon name={icon} size={19} />
          </span>
        )}
      </div>
      <div className="stat__foot">
        {delta && (
          <span className={cx('delta', `delta--${deltaTone || 'up'}`)}>
            <Icon
              name={
                deltaTone === 'down'
                  ? 'trendingDown'
                  : deltaTone === 'flat'
                    ? 'minus'
                    : 'trendingUp'
              }
              size={11}
              strokeWidth={2.2}
            />
            {delta}
          </span>
        )}
        {hint && <span>{hint}</span>}
      </div>
    </article>
  );
}

/* ————————————————————————————————— Badge */

export function Badge({ tone = 'neutral', dot, children }) {
  return (
    <span className={cx('badge', `badge--${tone}`)}>
      {dot && <span className="badge__dot" />}
      {children}
    </span>
  );
}

/** Maps a domain status onto a badge tone, so every table agrees on colour. */
const STATUS_TONES = {
  active: 'success',
  online: 'success',
  approved: 'success',
  verified: 'success',
  completed: 'success',
  success: 'success',
  captured: 'success',
  published: 'success',
  paid: 'success',
  sent: 'success',
  delivered: 'success',
  live: 'success',
  operational: 'success',

  pending: 'warning',
  degraded: 'warning',
  review: 'warning',
  'under review': 'warning',
  processing: 'warning',
  scheduled: 'warning',
  draft: 'warning',
  queued: 'warning',
  'awaiting payout': 'warning',

  suspended: 'danger',
  blocked: 'danger',
  rejected: 'danger',
  failed: 'danger',
  refunded: 'danger',
  cancelled: 'danger',
  missed: 'danger',

  ongoing: 'info',
  busy: 'info',
  chat: 'info',

  offline: 'neutral',
  inactive: 'neutral',
  archived: 'neutral',
  hidden: 'neutral',

  call: 'lilac',
  voice: 'lilac',
};

export function StatusBadge({ status, dot = true }) {
  const tone = STATUS_TONES[String(status).toLowerCase()] || 'neutral';
  const label = String(status).replace(/(^|\s)\S/g, (c) => c.toUpperCase());
  return (
    <Badge tone={tone} dot={dot}>
      {label}
    </Badge>
  );
}

/* ————————————————————————————————— Form */

export function Field({ label, hint, error, htmlFor, children }) {
  return (
    <div className="field">
      {label && (
        <label className="field__label" htmlFor={htmlFor}>
          {label}
        </label>
      )}
      {children}
      {error ? (
        <span className="field__error">
          <Icon name="alert" size={13} strokeWidth={2} />
          {error}
        </span>
      ) : (
        hint && <span className="field__hint">{hint}</span>
      )}
    </div>
  );
}

export function Input({ icon, action, invalid, className, ...rest }) {
  const input = (
    <input className={cx('input', invalid && 'is-invalid', className)} {...rest} />
  );
  if (!icon && !action) return input;

  return (
    <span className={cx('input-group', action && 'input-group--action')}>
      {icon && (
        <span className="input-group__icon">
          <Icon name={icon} size={16} />
        </span>
      )}
      {input}
      {action}
    </span>
  );
}

export function Select({ options, className, ...rest }) {
  return (
    <select className={cx('select', className)} {...rest}>
      {options.map((option) =>
        typeof option === 'string' ? (
          <option key={option} value={option}>
            {option}
          </option>
        ) : (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ),
      )}
    </select>
  );
}

export function Textarea({ invalid, className, ...rest }) {
  return <textarea className={cx('textarea', invalid && 'is-invalid', className)} {...rest} />;
}

export function Checkbox({ label, ...rest }) {
  return (
    <label className="checkbox">
      <input type="checkbox" {...rest} />
      {label}
    </label>
  );
}

export function Toggle({ on, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={cx('toggle', on && 'is-on')}
      onClick={() => onChange?.(!on)}
    />
  );
}

export function ToggleRow({ title, desc, on, onChange }) {
  return (
    <div className="toggle-row">
      <div>
        <p className="toggle-row__title">{title}</p>
        {desc && <p className="toggle-row__desc">{desc}</p>}
      </div>
      <Toggle on={on} onChange={onChange} label={title} />
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…' }) {
  return (
    <div className="search">
      <Input
        icon="search"
        type="search"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}

/* ————————————————————————————————— Chips & tabs */

export function Chips({ items, value, onChange }) {
  return (
    <div className="chips">
      {items.map((item) => {
        const key = item.key ?? item;
        const label = item.label ?? item;
        return (
          <button
            key={key}
            type="button"
            className={cx('chip', value === key && 'is-active')}
            onClick={() => onChange(key)}
          >
            {item.dot && <span className="badge__dot" style={{ background: '#16A34A' }} />}
            {label}
            {item.count != null && <span className="chip__count">{item.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => {
        const key = item.key ?? item;
        const label = item.label ?? item;
        return (
          <button
            key={key}
            role="tab"
            aria-selected={value === key}
            type="button"
            className={cx('tabs__tab', value === key && 'is-active')}
            onClick={() => onChange(key)}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

/* ————————————————————————————————— Identity */

export function Avatar({ name = '', src, size = 'md', tone, round, online }) {
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <span
      className={cx(
        'avatar',
        size !== 'md' && `avatar--${size}`,
        tone && `avatar--${tone}`,
        round && 'avatar--round',
      )}
    >
      {src ? <img src={src} alt="" width="100%" height="100%" /> : initials}
      {online != null && <span className={cx('avatar__status', online && 'is-online')} />}
    </span>
  );
}

export function Identity({ name, meta, src, size, tone, online }) {
  return (
    <div className="identity">
      <Avatar name={name} src={src} size={size} tone={tone} online={online} />
      <div className="truncate">
        <div className="identity__name truncate">{name}</div>
        {meta && <div className="identity__meta truncate">{meta}</div>}
      </div>
    </div>
  );
}

/* ————————————————————————————————— Misc */

export function DetailList({ rows }) {
  return (
    <div className="detail-list">
      {rows.map((row) => (
        <div className="detail-list__row" key={row.label}>
          <span className="detail-list__label">{row.label}</span>
          <span className="detail-list__value">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

export function Note({ tone = 'info', icon = 'info', children }) {
  return (
    <div className={cx('note', tone !== 'info' && `note--${tone}`)}>
      <span className="note__icon">
        <Icon name={icon} size={16} />
      </span>
      <div>{children}</div>
    </div>
  );
}

export function Progress({ value, tone }) {
  return (
    <div className="progress">
      <div
        className={cx('progress__fill', tone && `progress__fill--${tone}`)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** A small spinner for anything that is still loading. */
export function Spinner({ size = 18 }) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

/** Fills a card while its contents are being fetched. */
export function LoadingBlock({ label = 'Loading…' }) {
  return (
    <div className="table-state">
      <Spinner />
      <span>{label}</span>
    </div>
  );
}

/** What a card shows when its fetch failed. */
export function ErrorBlock({ error, onRetry }) {
  return (
    <EmptyState
      icon="alert"
      title="Could not load this"
      desc={error?.message || 'Something went wrong.'}
      action={onRetry ? <Button onClick={onRetry} icon="refresh">Try again</Button> : undefined}
    />
  );
}

export function EmptyState({ icon = 'inbox', title, desc, action }) {
  return (
    <div className="empty">
      <span className="empty__icon">
        <Icon name={icon} size={22} />
      </span>
      <p className="empty__title">{title}</p>
      {desc && <p className="empty__desc">{desc}</p>}
      {action}
    </div>
  );
}

export function Timeline({ items }) {
  return (
    <ol className="timeline">
      {items.map((item, index) => (
        <li
          key={`${item.title}-${index}`}
          className={cx(
            'timeline__item',
            item.state === 'done' && 'is-done',
            item.state === 'active' && 'is-active',
          )}
        >
          <p className="timeline__title">{item.title}</p>
          <p className="timeline__meta">{item.meta}</p>
        </li>
      ))}
    </ol>
  );
}

/* ————————————————————————————————— Overlays */

/* Overlays are portalled to <body>. Rendered in place they inherit whatever the
   page does — `.page` animates a transform, which makes it the containing block
   for `position: fixed` children, so the scrim and modal would size to the page
   box (max-width 1560px, inset by the sidebar) and get cropped on a wide screen. */
export function OverlayPortal({ children }) {
  return createPortal(children, document.body);
}

/* One shared stack keeps nested overlays honest: only the topmost answers
   Escape, and the scroll lock lifts when the last one closes. */
const overlayStack = [];
let scrollLock = null;

function lockScroll() {
  const { body, documentElement } = document;
  const gap = window.innerWidth - documentElement.clientWidth;
  scrollLock = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
  body.style.overflow = 'hidden';
  // Stand in for the scrollbar we just removed, so the page doesn't jump sideways.
  if (gap > 0) body.style.paddingRight = `${gap}px`;
}

function unlockScroll() {
  if (!scrollLock) return;
  document.body.style.overflow = scrollLock.overflow;
  document.body.style.paddingRight = scrollLock.paddingRight;
  scrollLock = null;
}

function useOverlay(onClose) {
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });

  useEffect(() => {
    const entry = { close: () => closeRef.current?.() };
    overlayStack.push(entry);
    if (overlayStack.length === 1) lockScroll();

    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      if (overlayStack[overlayStack.length - 1] !== entry) return;
      event.stopPropagation();
      entry.close();
    };
    document.addEventListener('keydown', onKey);

    return () => {
      document.removeEventListener('keydown', onKey);
      overlayStack.splice(overlayStack.indexOf(entry), 1);
      if (!overlayStack.length) unlockScroll();
    };
  }, []);
}

function OverlayHead({ title, subtitle, onClose }) {
  return (
    <header className="overlay__head">
      <div>
        <h2 className="overlay__title">{title}</h2>
        {subtitle && <p className="overlay__subtitle">{subtitle}</p>}
      </div>
      <Button variant="quiet" size="sm" icon="x" onClick={onClose} aria-label="Close" />
    </header>
  );
}

export function Modal({ title, subtitle, onClose, footer, wide, children }) {
  useOverlay(onClose);
  const ref = useRef(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <OverlayPortal>
      <div className="scrim" onClick={onClose} />
      <div className="modal-layer">
        <div
          className={cx('modal', wide && 'modal--wide')}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          tabIndex={-1}
          ref={ref}
        >
          <OverlayHead title={title} subtitle={subtitle} onClose={onClose} />
          <div className="overlay__body">{children}</div>
          {footer && <footer className="overlay__foot">{footer}</footer>}
        </div>
      </div>
    </OverlayPortal>
  );
}

export function Drawer({ title, subtitle, onClose, footer, wide, children }) {
  useOverlay(onClose);

  return (
    <OverlayPortal>
      <div className="scrim" onClick={onClose} />
      <aside
        className={cx('drawer', wide && 'drawer--wide')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <OverlayHead title={title} subtitle={subtitle} onClose={onClose} />
        <div className="overlay__body">{children}</div>
        {footer && <footer className="overlay__foot">{footer}</footer>}
      </aside>
    </OverlayPortal>
  );
}

export function Toasts({ items }) {
  if (!items.length) return null;
  return (
    <OverlayPortal>
      <div className="toasts">
        {items.map((toast) => (
          <div key={toast.id} className={cx('toast', toast.tone && `toast--${toast.tone}`)}>
            <span className="toast__icon">
              <Icon name={toast.icon || 'checkCircle'} size={16} />
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </OverlayPortal>
  );
}
