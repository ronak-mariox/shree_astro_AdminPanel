/** Joins class names, dropping anything falsy — `cx('btn', active && 'is-on')`. */
export const cx = (...parts) => parts.filter(Boolean).join(' ');

export default cx;
