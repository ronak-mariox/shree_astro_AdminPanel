/**
 * Every endpoint the panel uses, named after what it does.
 *
 * Pages call these rather than building URLs themselves, so a change to a path
 * is a change here and nowhere else. Each one returns exactly what the API
 * answered — shaping for the screen happens in the page.
 */

import { api } from './client';
import { clearSession, saveSession } from './session';

/* ------------------------------------------------------------------- auth */

/**
 * Step one. Answers `{ requiresOtp: true, ... }` when two-factor is on, and a
 * session when it is not.
 */
export const signIn = (email, password) =>
  api.post('/auth/admin/login', { email, password }, { auth: false });

/** Step two: the code from the admin's inbox. Saves the session. */
export async function verifyOtp(email, code) {
  const data = await api.post('/auth/admin/login/verify', { email, code }, { auth: false });
  saveSession(data);
  return data;
}

export const resendOtp = (email) =>
  api.post('/auth/admin/login/resend', { email }, { auth: false });

/** Forgotten password, step one: asks for a code to be emailed. */
export const requestPasswordReset = (email) =>
  api.post('/auth/admin/forgot-password', { email }, { auth: false });

export const resendPasswordReset = (email) =>
  api.post('/auth/admin/forgot-password/resend', { email }, { auth: false });

/** Step two: the emailed code and a new password. No session comes back — sign in fresh with it. */
export const confirmPasswordReset = (email, code, password) =>
  api.post('/auth/admin/reset-password', { email, code, password }, { auth: false });

/** Saves the session for the one-step case (two-factor off). */
export function completeSignIn(data) {
  saveSession(data);
  return data;
}

export async function signOut() {
  try {
    await api.post('/auth/logout');
  } catch {
    /** Signing out is a local act; a failed call must not block it. */
  }
  clearSession();
}

/* -------------------------------------------------------------------- me */

/**
 * The signed-in admin's own name and/or photo — any role may call this, no
 * `admins.manage` needed. `photo` is the file picked in the browser, if any.
 */
export const updateOwnProfile = ({ name, photo }) => {
  const form = new FormData();
  if (name !== undefined) form.append('name', name);
  if (photo) form.append('photo', photo);
  return api.patch('/admin/me', form);
};

/* -------------------------------------------------------------- dashboard */

export const getDashboard = (days = 7) => api.get('/admin/dashboard', { days });
export const getReports = (days = 30) => api.get('/admin/reports', { days });

/* ------------------------------------------------------------------ users */

export const listUsers = (query) => api.get('/admin/users', query);
export const getUser = (userId) => api.get(`/admin/users/${userId}`);
export const setUserStatus = (userId, status, reason) =>
  api.patch(`/admin/users/${userId}/status`, { status, reason });

/* ------------------------------------------------------------ astrologers */

export const listAstrologers = (query) => api.get('/admin/astrologers', query);
export const getAstrologer = (id) => api.get(`/admin/astrologers/${id}`);

export const approveAstrologer = (id, body) =>
  api.post(`/admin/astrologers/${id}/approve`, body);
export const rejectAstrologer = (id, reason) =>
  api.post(`/admin/astrologers/${id}/reject`, { reason });
export const setAstrologerStatus = (id, status, reason) =>
  api.patch(`/admin/astrologers/${id}/status`, { status, reason });

export const reviewDocument = (astrologerId, documentId, status, reason) =>
  api.patch(`/admin/astrologers/${astrologerId}/documents/${documentId}`, { status, reason });
export const reviewBankAccount = (astrologerId, accountId, status, reason) =>
  api.patch(`/admin/astrologers/${astrologerId}/bank-accounts/${accountId}`, { status, reason });
export const reviewPriceChange = (astrologerId, requestId, status, reason) =>
  api.patch(`/admin/astrologers/${astrologerId}/price-changes/${requestId}`, { status, reason });

/* --------------------------------------------------------- consultations */

export const listConsultations = (query) => api.get('/admin/consultations', query);
export const getConsultation = (chatId) => api.get(`/admin/consultations/${chatId}`);
export const endConsultation = (chatId, reason) =>
  api.post(`/admin/consultations/${chatId}/end`, { reason });

/* ------------------------------------------------- payments and wallets */

export const listTransactions = (query) => api.get('/admin/transactions', query);
export const refundTransaction = (transactionId, reason) =>
  api.post(`/admin/transactions/${transactionId}/refund`, { reason });

export const listWallets = (query) => api.get('/admin/wallets', query);
export const adjustWallet = (body) => api.post('/admin/wallets/adjust', body);

export const listWithdrawals = (query) => api.get('/admin/withdrawals', query);
export const reviewWithdrawal = (withdrawalId, body) =>
  api.patch(`/admin/withdrawals/${withdrawalId}`, body);

/* ---------------------------------------------------------------- content */

export const listArticles = (query) => api.get('/admin/articles', query);
export const createArticle = (body) => api.post('/admin/articles', body);
export const updateArticle = (id, body) => api.put(`/admin/articles/${id}`, body);
export const deleteArticle = (id) => api.delete(`/admin/articles/${id}`);

/* --------------------------------------------------------------- settings */

export const getSettings = () => api.get('/admin/settings');
export const updateSettings = (body) => api.patch('/admin/settings', body);

/** Third parties: masked values only — a saved secret never comes back in the clear. */
export const listIntegrations = () => api.get('/admin/integrations');
export const saveIntegration = (provider, fields) =>
  api.put(`/admin/integrations/${provider}`, fields);
export const setIntegrationEnabled = (provider, enabled) =>
  api.patch(`/admin/integrations/${provider}/enabled`, { enabled });

/** The "Other" list — anything not one of the six fixed providers above. Reference only, same as the field it's collected under implies. */
export const listThirdParties = () => api.get('/admin/third-parties');
export const createThirdParty = (body) => api.post('/admin/third-parties', body);
export const updateThirdParty = (id, body) => api.put(`/admin/third-parties/${id}`, body);
export const deleteThirdParty = (id) => api.delete(`/admin/third-parties/${id}`);

/* -------------------------------------------------------------- the team */

export const listAdmins = (query) => api.get('/admin/team', query);
export const createAdmin = (body) => api.post('/admin/team', body);
export const updateAdmin = (id, body) => api.patch(`/admin/team/${id}`, body);
export const revokeAdmin = (id) => api.delete(`/admin/team/${id}`);

/* --------------------------------------------------------------- support */

export const listTickets = (query) => api.get('/admin/support-tickets', query);
export const resolveTicket = (id, body) => api.patch(`/admin/support-tickets/${id}`, body);

/* ------------------------------------------------------------------ audit */

export const listAuditLogs = (query) => api.get('/admin/audit-logs', query);

/* --------------------------------------------------------- notifications */

/**
 * Not under `/admin` — this is the same endpoint pair user_app and astro_app
 * call; the account's role on the token decides whose rows come back.
 */
export const listNotifications = (query) => api.get('/notifications', query);
export const markNotificationsRead = (notificationId) =>
  api.post('/notifications/read', { notificationId });
