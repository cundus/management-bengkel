export type ActionWarning = {
  kind: "duplikat-pembelian";
  purchaseId: number;
  supplierName: string;
  total: number;
};

export type ActionState = {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string>;
  redirectTo?: string;
  warning?: ActionWarning;
};

export const initialActionState: ActionState = { ok: false };

export function actionError(message: string, fieldErrors?: Record<string, string>): ActionState {
  return { ok: false, message, fieldErrors };
}
