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

/** The short form: email, commission, availability, status. */
export const createAstrologer = (draft) => api.post('/admin/astrologers', draft);

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
