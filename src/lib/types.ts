export type PaymentStatus = "lunas" | "sebagian" | "belum_bayar" | "batal";
export type TransaksiStatusFilter = "semua" | "lunas" | "sebagian" | "belum_bayar";
export type ReceivableFilter = "semua" | "jatuh_tempo" | "lancar";

export type Vehicle = {
  id: number;
  customerId: number;
  plateNumber: string;
  brand: string;
  model: string;
  year: number | null;
  color: string | null;
  odometer: number | null;
  createdAt: string;
};

export type Customer = {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  vehicleCount?: number;
  transactionCount?: number;
  outstanding?: number;
  lastVisit?: string | null;
  vehicles?: Vehicle[];
};

export type CustomerWithVehicles = Customer & {
  vehicles: Vehicle[];
};

export type Item = {
  id: number;
  sku: string;
  name: string;
  category: "jasa" | "sparepart";
  unit: string;
  price: number;
  cost: number;
  stock: number;
  minStock: number;
  stockValue?: number;
  isActive: boolean;
  createdAt: string;
};

export type TransactionListRow = {
  id: string;
  invoiceNo: string;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  plateNumber: string | null;
  vehicleLabel: string | null;
  mechanic: string | null;
  total: number;
  paid: number;
  remaining: number;
  dueDate: string | null;
  businessDate: string;
  createdAt: string;
  status: "selesai" | "batal";
  paymentStatus: PaymentStatus;
};

export type TransactionItem = {
  id: number;
  itemId: number | null;
  name: string;
  category: "jasa" | "sparepart";
  qty: number;
  unitPrice: number;
  unitCost: number;
  stockBatchCode?: string | null;
  subtotal: number;
};

export type Payment = {
  id: number;
  amount: number;
  method: "tunai" | "transfer" | "qris";
  notes: string | null;
  businessDate: string;
  paidAt: string;
  receivedByName: string;
};

export type TransactionDetail = TransactionListRow & {
  subtotal: number;
  discount: number;
  notes: string | null;
  customerAddress: string | null;
  vehicle: Vehicle | null;
  items: TransactionItem[];
  payments: Payment[];
  createdByName: string;
  voidedAt: string | null;
  voidReason: string | null;
};

export type Expense = {
  id: number;
  expenseDate: string;
  category: string;
  description: string;
  amount: number;
  createdByName: string;
  createdAt: string;
};

export type Supplier = {
  id: number;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  notes: string | null;
  createdAt: string;
};

export type Payable = {
  purchaseId?: number | null;
  id: number;
  supplierId: number;
  supplierName: string;
  supplierPhone: string | null;
  referenceNo: string | null;
  description: string;
  amount: number;
  paid: number;
  remaining: number;
  businessDate: string;
  dueDate: string | null;
  createdAt: string;
  payments: PayablePayment[];
};

export type PayablePayment = {
  id: number;
  amount: number;
  method: "tunai" | "transfer" | "qris";
  businessDate: string;
  paidAt: string;
  notes: string | null;
};

export type DashboardData = {
  today: string;
  todayRevenue: number;
  todayCash: number;
  todayTransactions: number;
  yesterdayRevenue: number;
  monthRevenue: number;
  monthCash: number;
  monthExpenses: number;
  monthProfit: number;
  receivables: {
    total: number;
    count: number;
    overdueTotal: number;
    overdueCount: number;
    dueSoonTotal: number;
  };
  payables: {
    total: number;
    count: number;
    overdueCount: number;
  };
  weekly: { date: string; revenue: number; cash: number }[];
  recentTransactions: TransactionListRow[];
  dueSoon: (TransactionListRow & { daysLeft: number })[];
  lowStock: Item[];
};

export type ReportData = {
  month: string;
  start: string;
  end: string;
  revenue: number;
  previousRevenue: number;
  transactions: number;
  cogs: number;
  grossProfit: number;
  expenses: number;
  previousExpenses: number;
  netProfit: number;
  cashIn: number;
  cashOut: number;
  netCash: number;
  outstanding: number;
  overdue: number;
  daily: { date: string; revenue: number; cash: number; transactions: number }[];
  expenseByCategory: { category: string; amount: number }[];
  paymentMethods: { method: string; amount: number; count: number }[];
  topItems: { name: string; qty: number; revenue: number; category: "jasa" | "sparepart" }[];
  recentPayments: {
    id: number;
    invoiceNo: string;
    customerName: string;
    amount: number;
    method: string;
    businessDate: string;
  }[];
};

export type CustomerDetail = CustomerWithVehicles & {
  transactions: TransactionListRow[];
  totalSpend: number;
  outstanding: number;
};
