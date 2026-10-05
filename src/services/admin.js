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

/* -------------------------------------------------------------- uploads */

/**
 * A write that may carry an image.
 *
 * With no file the body goes as JSON, exactly as typed. With one, the same
 * fields are packed into a `FormData` beside it: scalars as strings, arrays
 * (`highlights`, `benefits`, `images`, `tags`, `timeSlots`) as JSON strings —
 * the API parses those back on a multipart request. `null` is left out of a
 * form, since a form field cannot say "clear this"; send JSON for that.
 */
function withImage(body, file, field) {
  return withFiles(body, file ? { [field]: file } : {});
}

/**
 * The same, for a write that may carry more than one file — `files` maps a
 * multipart field name to the File picked for it (`{ avatar, thumbnail }`), or
 * to an array of Files for a field that takes several (`{ images: [a, b] }` —
 * each is appended under the same name). Fields with no file are skipped; with
 * none at all the body goes as JSON.
 */
function withFiles(body, files = {}) {
  const picked = Object.entries(files)
    .map(([field, value]) => [field, (Array.isArray(value) ? value : [value]).filter(Boolean)])
    .filter(([, list]) => list.length > 0);
  if (!picked.length) return body;

  const form = new FormData();
  for (const [key, value] of Object.entries(body)) {
    if (value === undefined || value === null) continue;
    form.append(
      key,
      Array.isArray(value) || (typeof value === 'object' && !(value instanceof Blob))
        ? JSON.stringify(value)
        : String(value),
    );
  }
  for (const [field, list] of picked) {
    for (const file of list) form.append(field, file);
  }
  return form;
}

/* ---------------------------------------------------------------- content */

export const listArticles = (query) => api.get('/admin/articles', query);
export const getArticle = (id) => api.get(`/admin/articles/${id}`);
/** `coverImage` is the File picked in the browser, if any (multipart field `coverImage`). */
export const createArticle = (body, coverImage) =>
  api.post('/admin/articles', withImage(body, coverImage, 'coverImage'));
export const updateArticle = (id, body, coverImage) =>
  api.put(`/admin/articles/${id}`, withImage(body, coverImage, 'coverImage'));
export const deleteArticle = (id) => api.delete(`/admin/articles/${id}`);

/* ------------------------------------------------------------------- shop */

export const listProducts = (query) => api.get('/admin/products', query);
/**
 * `files` is `{ image, images }` — `image` the cover File (multipart field
 * `image`), `images` an array of up to 6 gallery Files (field `images`); either
 * may be missing. `body.keepImages` lists the existing gallery URLs to retain
 * (in order) and `body.imageUrl` may name a gallery URL to promote to cover.
 */
export const createProduct = (body, files = {}) =>
  api.post('/admin/products', withFiles(body, files));
export const updateProduct = (id, body, files = {}) =>
  api.put(`/admin/products/${id}`, withFiles(body, files));
export const setProductStatus = (id, status) =>
  api.patch(`/admin/products/${id}/status`, { status });
/** Soft: the product becomes `archived`. */
export const deleteProduct = (id) => api.delete(`/admin/products/${id}`);

export const listOrders = (query) => api.get('/admin/orders', query);
export const getOrder = (id) => api.get(`/admin/orders/${id}`);
/** Forward moves only (placed → packed → shipped → out_for_delivery → delivered), or `cancelled` from anything undelivered. */
export const updateOrderStatus = (id, { status, note }) =>
  api.patch(`/admin/orders/${id}/status`, { status, note });

/* ------------------------------------------------------------------ pujas */

export const listPujas = (query) => api.get('/admin/pujas', query);
export const createPuja = (body, image) =>
  api.post('/admin/pujas', withImage(body, image, 'image'));
export const updatePuja = (id, body, image) =>
  api.put(`/admin/pujas/${id}`, withImage(body, image, 'image'));
export const setPujaStatus = (id, status) => api.patch(`/admin/pujas/${id}/status`, { status });
export const deletePuja = (id) => api.delete(`/admin/pujas/${id}`);

export const listPujaBookings = (query) => api.get('/admin/puja-bookings', query);
export const getPujaBooking = (id) => api.get(`/admin/puja-bookings/${id}`);
/** Any of the three may be sent alone; `status` is `completed` or `cancelled` (refunds). */
export const updatePujaBooking = (id, { status, streamUrl, adminNote }) =>
  api.patch(`/admin/puja-bookings/${id}`, { status, streamUrl, adminNote });

/* -------------------------------------------------------------- loyalty */

/** Signed `points` (negative to take away) with a reason; needs `wallets.adjust`. */
export const adjustLoyalty = ({ userId, points, reason }) =>
  api.post('/admin/loyalty/adjust', { userId, points, reason });

/* ------------------------------------------------------------- referrals */

export const listReferrals = (query) => api.get('/admin/referrals', query);

/* ---------------------------------------------------- coupons and offers */

export const listCoupons = (query) => api.get('/admin/coupons', query);
export const createCoupon = (body) => api.post('/admin/coupons', body);
export const updateCoupon = (id, body) => api.put(`/admin/coupons/${id}`, body);
/** `active`, `paused` or `expired`. */
export const setCouponStatus = (id, status) =>
  api.patch(`/admin/coupons/${id}/status`, { status });
/** Refused (409) once the coupon has been redeemed — pause it instead. */
export const deleteCoupon = (id) => api.delete(`/admin/coupons/${id}`);
export const listCouponRedemptions = (id, query) =>
  api.get(`/admin/coupons/${id}/redemptions`, query);

export const listFestivalOffers = (query) => api.get('/admin/festival-offers', query);
/** `image` is the File picked in the browser, if any (multipart field `image`). */
export const createFestivalOffer = (body, image) =>
  api.post('/admin/festival-offers', withImage(body, image, 'image'));
export const updateFestivalOffer = (id, body, image) =>
  api.put(`/admin/festival-offers/${id}`, withImage(body, image, 'image'));
/** `active` or `hidden`. */
export const setFestivalOfferStatus = (id, status) =>
  api.patch(`/admin/festival-offers/${id}/status`, { status });
export const deleteFestivalOffer = (id) => api.delete(`/admin/festival-offers/${id}`);

/* ---------------------------------------------- reviews and testimonials */

export const listReviews = (query) => api.get('/admin/reviews', query);
/**
 * `kind` is `consultation` (id = chat id), `puja` (id = booking id) or
 * `product` (id = product review id); `patch` is any of
 * `{ hidden, pinned, flagged, flagReason, reply }`.
 */
export const moderateReview = (kind, id, patch) => api.patch(`/admin/reviews/${kind}/${id}`, patch);

export const listTestimonials = (query) => api.get('/admin/testimonials', query);
/** `files` is `{ avatar, thumbnail }` — either File may be missing (multipart fields of the same names). */
export const createTestimonial = (body, files) =>
  api.post('/admin/testimonials', withFiles(body, files));
export const updateTestimonial = (id, body, files) =>
  api.put(`/admin/testimonials/${id}`, withFiles(body, files));
/** `published` or `draft`. */
export const setTestimonialStatus = (id, status) =>
  api.patch(`/admin/testimonials/${id}/status`, { status });
export const deleteTestimonial = (id) => api.delete(`/admin/testimonials/${id}`);

/* --------------------------------------------------------------- careers */

export const listJobs = (query) => api.get('/admin/jobs', query);
export const createJob = (body) => api.post('/admin/jobs', body);
export const updateJob = (id, body) => api.put(`/admin/jobs/${id}`, body);
/** `open`, `closed` or `draft`. */
export const setJobStatus = (id, status) => api.patch(`/admin/jobs/${id}/status`, { status });
export const deleteJob = (id) => api.delete(`/admin/jobs/${id}`);

export const listApplications = (query) => api.get('/admin/applications', query);
export const getApplication = (id) => api.get(`/admin/applications/${id}`);
/** Either may be sent alone; `status` is received / shortlisted / interview / rejected / hired. */
export const updateApplication = (id, { status, adminNote }) =>
  api.patch(`/admin/applications/${id}`, { status, adminNote });

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
