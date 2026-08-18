/**
 * The table every listing page is built on.
 *
 * Search, sort and paging live here; anything domain-specific (status filters,
 * bulk actions) is passed in through `toolbar` so the pages stay declarative.
 *
 *   <DataTable
 *     columns={[{ key: 'name', label: 'Name', render: row => … }]}
 *     rows={users}
 *     searchKeys={['name', 'email']}
 *   />
 */

import { useMemo, useState } from 'react';
import { Icon } from './Icon';
import { Button, EmptyState, SearchInput } from './ui';
import { cx } from '../utils/cx';

const PAGE_SIZE = 8;

export function DataTable({
  columns,
  rows,
  searchKeys = [],
  searchPlaceholder = 'Search…',
  toolbar,
  toolbarEnd,
  onRowClick,
  pageSize = PAGE_SIZE,
  empty,
  dense,
}) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState(null);
  const [page, setPage] = useState(1);

  const searched = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle || !searchKeys.length) return rows;
    return rows.filter((row) =>
      searchKeys.some((key) => String(row[key] ?? '').toLowerCase().includes(needle)),
    );
  }, [rows, query, searchKeys]);

  const sorted = useMemo(() => {
    if (!sort) return searched;
    const column = columns.find((item) => item.key === sort.key);
    const value = column?.sortValue || ((row) => row[sort.key]);
    return [...searched].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const cmp =
        typeof left === 'number' && typeof right === 'number'
          ? left - right
          : String(left).localeCompare(String(right));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [searched, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const current = Math.min(page, pageCount);
  const visible = sorted.slice((current - 1) * pageSize, current * pageSize);

  const toggleSort = (key) =>
    setSort((previous) =>
      previous?.key === key
        ? { key, dir: previous.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: 'asc' },
    );

  const showToolbar = Boolean(searchKeys.length || toolbar || toolbarEnd);

  return (
    <div className="card">
      {showToolbar && (
        <div className="table-toolbar">
          {searchKeys.length > 0 && (
            <SearchInput
              value={query}
              onChange={(next) => {
                setQuery(next);
                setPage(1);
              }}
              placeholder={searchPlaceholder}
            />
          )}
          {toolbar}
          {toolbarEnd && <div style={{ marginLeft: 'auto' }}>{toolbarEnd}</div>}
        </div>
      )}

      <div className="table-wrap">
        <table className={cx('table', dense && 'table--dense')}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={column.align === 'right' ? 'num' : undefined}
                  style={column.width ? { width: column.width } : undefined}
                >
                  {column.sortable ? (
                    <button
                      type="button"
                      className={cx('table__sort', sort?.key === column.key && 'is-sorted')}
                      onClick={() => toggleSort(column.key)}
                    >
                      {column.label}
                      <Icon
                        className="sort-caret"
                        name={
                          sort?.key === column.key && sort.dir === 'desc'
                            ? 'chevronDown'
                            : 'chevronUp'
                        }
                        size={12}
                        strokeWidth={2.4}
                      />
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, index) => (
              <tr
                key={row.id ?? index}
                className={onRowClick ? 'is-clickable' : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cx(
                      column.align === 'right' && 'num',
                      column.align === 'actions' && 'actions',
                    )}
                  >
                    {column.render ? column.render(row) : row[column.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        {visible.length === 0 && (
          <EmptyState
            icon={empty?.icon}
            title={empty?.title || 'Nothing to show'}
            desc={
              empty?.desc ||
              (query
                ? `No results for “${query}”. Try a different search.`
                : 'Records will appear here as soon as there are any.')
            }
          />
        )}
      </div>

      {sorted.length > pageSize && (
        <div className="pagination">
          <span>
            Showing <strong>{(current - 1) * pageSize + 1}</strong>–
            <strong>{Math.min(current * pageSize, sorted.length)}</strong> of{' '}
            <strong>{sorted.length}</strong>
          </span>
          <div className="pagination__pages">
            <button
              type="button"
              className="pagination__page"
              disabled={current === 1}
              onClick={() => setPage(current - 1)}
              aria-label="Previous page"
            >
              <Icon name="chevronLeft" size={14} />
            </button>
            {Array.from({ length: pageCount }, (_, index) => index + 1)
              .filter(
                (number) =>
                  number === 1 ||
                  number === pageCount ||
                  Math.abs(number - current) <= 1,
              )
              .map((number, index, list) => (
                <span key={number} style={{ display: 'contents' }}>
                  {index > 0 && number - list[index - 1] > 1 && (
                    <span className="faint">…</span>
                  )}
                  <button
                    type="button"
                    className={cx('pagination__page', number === current && 'is-active')}
                    onClick={() => setPage(number)}
                  >
                    {number}
                  </button>
                </span>
              ))}
            <button
              type="button"
              className="pagination__page"
              disabled={current === pageCount}
              onClick={() => setPage(current + 1)}
              aria-label="Next page"
            >
              <Icon name="chevronRight" size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** The row-action cluster listing pages repeat. */
export function RowActions({ actions }) {
  return (
    <div className="row" style={{ justifyContent: 'flex-end', gap: 6 }}>
      {actions.map((action) => (
        <Button
          key={action.label}
          size="sm"
          variant={action.variant || 'ghost'}
          icon={action.icon}
          aria-label={action.label}
          title={action.label}
          onClick={(event) => {
            event.stopPropagation();
            action.onClick?.();
          }}
        >
          {action.showLabel ? action.label : null}
        </Button>
      ))}
    </div>
  );
}

export default DataTable;
