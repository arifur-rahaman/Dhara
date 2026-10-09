/** Shapes shared by the server snapshot, the phone's storage and the offline page (F21). */
export type OfflineHearing = {
  hearingId: string;
  caseId: string;
  title: string;
  court: string;
  serial: string | null;
  party: string | null;
  canAddHearing: boolean;
};

export type OfflineSnapshot = {
  version: 1;
  generatedAt: string;
  userId: string;
  chamberId: string;
  role: string;
  canUploadOrders: boolean;
  today: { date: string; label: string; hearings: OfflineHearing[] };
  tomorrow: { date: string; label: string; hearings: OfflineHearing[] };
  tasks: { id: string; title: string; due: string | null }[];
  cases: { id: string; title: string; court: string; party: string | null; next: string | null }[];
};

export type OutboxItem =
  | {
      key: string;
      kind: 'nextDate';
      createdAt: string;
      label: string;
      payload: { caseId: string; date: string; note: string };
    }
  | { key: string; kind: 'taskDone'; createdAt: string; label: string; payload: { taskId: string } }
  | {
      key: string;
      kind: 'orderPhoto';
      createdAt: string;
      label: string;
      payload: { caseId: string; title: string; file: Blob; fileName: string };
    };

export type SyncResult = { key: string; result: 'ok' | 'exists' | 'denied' | 'notFound' | 'invalid' };
