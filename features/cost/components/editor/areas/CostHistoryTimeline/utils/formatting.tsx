/**
 * Cost History Formatting Utilities
 * Functions for formatting history entries and changes
 */

import {
  Clock,
  Lock,
  Unlock,
  Plus,
  Edit,
} from 'lucide-react';
import { useTranslations } from 'next-intl';

/**
 * Gets the icon for a history action
 */
export function getActionIcon(action: string) {
  switch (action) {
    case 'created':
      return <Plus size={16} className="text-green-tone" />;
    case 'updated':
      return <Edit size={16} className="text-blue-tone" />;
    case 'locked':
      return <Lock size={16} className="text-yellow-tone" />;
    case 'unlocked':
      return <Unlock size={16} className="text-orange-tone" />;
    default:
      return <Clock size={16} className="text-gray-600" />;
  }
}

/**
 * Gets the translated label for a history action
 */
export function getActionLabel(action: string, t: (key: string) => string): string {
  switch (action) {
    case 'created':
      return t('Cost.history.created');
    case 'updated':
      return t('Cost.history.updated');
    case 'locked':
      return t('Cost.history.locked');
    case 'unlocked':
      return t('Cost.history.unlocked');
    default:
      return action;
  }
}

/**
 * Formats user display name
 */
export function getUserDisplayName(
  user: { name: string | null; email: string | null },
  t: (key: string) => string
): string {
  return user.name || user.email || t('Cost.history.unknownUser');
}

/**
 * Gets user initials for avatar
 */
export function getUserInitials(user: {
  name: string | null;
  email: string | null;
}): string {
  if (user.name) {
    return user.name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  }
  if (user.email) {
    return user.email[0].toUpperCase();
  }
  return '?';
}

/**
 * Formats changes for display
 */
export function formatChanges(
  changes: Record<string, unknown> | undefined,
  action: string,
  t: (key: string) => string
): React.ReactNode[] | null {
  if (!changes || Object.keys(changes).length === 0) {
    return null;
  }

  // For creation, show the initial values
  if (action === 'created') {
    return Object.entries(changes)
      .map(([key, value]) => {
        if (value !== null && value !== undefined) {
          return (
            <div key={key} className="text-sm text-gray-600">
              <span className="font-extrabold">{t(`Cost.${key}`)}:</span>{' '}
              <span className="text-gray-700">{String(value)}</span>
            </div>
          );
        }
        return null;
      })
      .filter((node): node is React.ReactElement => node !== null);
  }

  // For updates, show before/after
  return Object.entries(changes)
    .map(([key, value]) => {
      // Handle item changes (ingredients, packaging, labors, other, price)
      if (Array.isArray(value)) {
        return (
          <div key={key} className="text-sm text-gray-600 mt-1">
            <span className="font-extrabold">{t(`Cost.${key}`)}:</span>
            <div className="ml-4 mt-1 space-y-1">
              {value.map((itemChange: unknown, idx: number) => {
                const change = itemChange as {
                  type?: string;
                  item?: { title?: string; id?: string };
                  changes?: Record<string, { from?: unknown; to?: unknown }>;
                };

                if (change.type === 'added') {
                  return (
                    <div key={idx} className="text-xs">
                      <span className="text-green-600">+</span>{' '}
                      <span>{change.item?.title || change.item?.id}</span>
                    </div>
                  );
                } else if (change.type === 'deleted') {
                  return (
                    <div key={idx} className="text-xs">
                      <span className="text-red-600">-</span>{' '}
                      <span className="line-through">
                        {change.item?.title || change.item?.id}
                      </span>
                    </div>
                  );
                } else if (change.type === 'modified') {
                  return (
                    <div key={idx} className="text-xs">
                      <span className="font-bold">
                        {change.item?.title || change.item?.id}:
                      </span>{' '}
                      {Object.entries(change.changes || {}).map(
                        ([field, fieldChange]: [string, unknown]) => {
                          const fc = fieldChange as {
                            from?: unknown;
                            to?: unknown;
                          };
                          if (
                            fc &&
                            typeof fc === 'object' &&
                            'from' in fc &&
                            'to' in fc
                          ) {
                            return (
                              <span key={field} className="ml-2">
                                <span className="text-red-600 line-through">
                                  {fc.from === null || fc.from === undefined
                                    ? '-'
                                    : String(fc.from)}
                                </span>{' '}
                                →{' '}
                                <span className="text-green-600">
                                  {fc.to === null || fc.to === undefined
                                    ? '-'
                                    : String(fc.to)}
                                </span>
                              </span>
                            );
                          }
                          return null;
                        }
                      )}
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        );
      }

      // Handle regular field changes (from/to)
      if (
        value &&
        typeof value === 'object' &&
        'from' in value &&
        'to' in value
      ) {
        const fieldChange = value as { from?: unknown; to?: unknown };
        return (
          <div key={key} className="text-sm text-gray-600">
            <span className="font-extrabold">{t(`Cost.${key}`)}:</span>{' '}
            <span className="text-red-600 line-through">
              {fieldChange.from === null || fieldChange.from === undefined
                ? '-'
                : String(fieldChange.from)}
            </span>{' '}
            →{' '}
            <span className="text-green-600">
              {fieldChange.to === null || fieldChange.to === undefined
                ? '-'
                : String(fieldChange.to)}
            </span>
          </div>
        );
      }
      return null;
    })
    .filter((node): node is React.ReactElement => node !== null);
}

