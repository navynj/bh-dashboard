/**
 * Cost History Timeline Types
 */

export interface CostHistoryEntry {
  id: string;
  costId: string;
  userId: string;
  log: {
    action: 'created' | 'updated' | 'locked' | 'unlocked';
    changes?: Record<string, unknown>;
    timestamp: string;
  };
  createdAt: Date | string;
  User: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

export interface CostHistoryData {
  history: CostHistoryEntry[];
  creationEntry: CostHistoryEntry | null;
  totalCount: number;
  hasMore: boolean;
}

