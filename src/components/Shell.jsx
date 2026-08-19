/** The persistent chrome: ink sidebar on the left, sticky topbar above the page. */

import { useState } from 'react';
import { BrandMark, Icon } from './Icon';
import { Avatar, Button, Input, OverlayPortal } from './ui';
import { cx } from '../utils/cx';
import { navGroups, routeTitles } from '../data/nav';

/** The API stores a role id; the panel prints it in words. */
const ROLE_LABELS = {
  super_admin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  support_lead: 'Support Lead',
  content_manager: 'Content Manager',
  consultation_manager: 'Consultation Manager',
  user_manager: 'User Manager',
};

export function Sidebar({ route, onNavigate, collapsed, onSignOut }) {
  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <span className="sidebar__mark">
          <BrandMark size={19} />
        </span>
        <span className="sidebar__wordmark">
          Shree Astro
          <span>Admin</span>
        </span>
      </div>

      <nav className="sidebar__nav">
        {navGroups.map((group) => (
          <div key={group.label}>
            <p className="sidebar__group">{group.label}</p>
            {group.items.map((item) => (
              <button
                key={item.key}
                type="button"
                className={cx('nav-item', route === item.key && 'is-active')}
                onClick={() => onNavigate(item.key)}
                title={collapsed ? item.label : undefined}
              >
                <span className="nav-item__icon">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="nav-item__label">{item.label}</span>
                {item.count ? <span className="nav-item__count">{item.count}</span> : null}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__support">
          <span style={{ color: 'var(--brand-yellow)' }}>
            <Icon name="help" size={17} />
          </span>
          <p>
            <strong>Need a hand?</strong>
            Reach the platform team at admin@marioxsoftware.com
          </p>
        </div>
        <button type="button" className="sidebar__signout" onClick={onSignOut}>
          <span className="nav-item__icon">
            <Icon name="logout" size={18} />
          </span>
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export function Topbar({ route, collapsed, onToggle, onNavigate, onSignOut, admin }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const crumb = routeTitles[route] || routeTitles.dashboard;

  return (
    <header className="topbar">
      <button
        type="button"
        className="topbar__toggle"
        onClick={onToggle}
        aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
      >
        <Icon name="menu" size={17} />
      </button>

      <div className="topbar__crumbs">
        <span>{crumb.group}</span>
        <Icon name="chevronRight" size={12} />
        <strong>{crumb.title}</strong>
      </div>

      <div className="topbar__spacer" />

      <div className="topbar__search search">
        <Input icon="search" type="search" placeholder="Search users, astrologers, payments…" />
      </div>

      <div className="topbar__actions">
        <Button
          variant="ghost"
          size="sm"
          icon="refresh"
          aria-label="Refresh data"
          title="Refresh data"
          className="icon-button"
        />

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            className="topbar__user"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
          >
            <Avatar name={admin?.name} size="sm" />
            <span style={{ textAlign: 'left' }}>
              <span className="topbar__user-name" style={{ display: 'block' }}>
                {admin?.name}
              </span>
              <span className="topbar__user-role" style={{ display: 'block' }}>
                {ROLE_LABELS[admin?.role] || admin?.role}
              </span>
            </span>
            <Icon name="chevronDown" size={14} />
          </button>

          {menuOpen && (
            <>
              {/* Portalled: the topbar's backdrop-filter would otherwise clip this
                  fixed catcher to the topbar, so clicks on the page never closed the menu. */}
              <OverlayPortal>
                <div
                  style={{ position: 'fixed', inset: 0, zIndex: 39 }}
                  onClick={() => setMenuOpen(false)}
                />
              </OverlayPortal>
              <div className="menu">
                <p className="menu__header">
                  <strong>{admin?.name}</strong>
                  <span>{admin?.email}</span>
                </p>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('settings');
                  }}
                >
                  <Icon name="user" size={16} /> Account settings
                </button>
                <button
                  type="button"
                  className="menu__item"
                  onClick={() => {
                    setMenuOpen(false);
                    onNavigate('reports');
                  }}
                >
                  <Icon name="chart" size={16} /> Reports
                </button>
                <button
                  type="button"
                  className="menu__item menu__item--danger"
                  onClick={onSignOut}
                >
                  <Icon name="logout" size={16} /> Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PageHeader({ title, subtitle, actions }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="page-head__actions">{actions}</div>}
    </div>
  );
}
