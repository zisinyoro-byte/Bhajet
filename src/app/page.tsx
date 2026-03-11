'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { InstallButton } from '@/components/PWARegister';
import { AuthScreen } from '@/components/AuthScreen';
import { NotificationManager, requestNotificationPermission } from '@/components/Notifications';
import { GamificationPanel, ChallengesView, AchievementsView, useGamification } from '@/components/Gamification';

// Types
interface Transaction {
  id: string;
  type: 'income' | 'expenditure';
  expenditureType?: 'regular' | 'capital';
  amount: number;
  category: string;
  date: string;
  note: string | null;
  receipt: string | null;
  merchantName?: string | null;
  receiptDate?: string | null;
  receiptTotal?: number | null;
  isFromReceipt?: boolean;
  createdAt: string;
}

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'expenditure';
  icon: string;
}

interface Budget {
  id: string;
  category: string;
  month: string;
  limit: number;
}

interface Goal {
  id: string;
  name: string;
  target: number;
  current: number;
}

interface Recurring {
  id: string;
  name: string;
  amount: number;
  category: string;
  lastDate: string | null;
}

interface Loan {
  id: string;
  borrowerName: string;
  amount: number;
  remainingAmount: number;
  dateLoaned: string;
  dueDate: string | null;
  status: 'active' | 'partially_paid' | 'paid' | 'written_off';
  note: string | null;
  repayments: LoanRepayment[];
}

interface LoanRepayment {
  id: string;
  loanId: string;
  amount: number;
  date: string;
  note: string | null;
}

interface Settings {
  id: string;
  currency: string;
  theme: string;
  pin: string | null;
  biometricEnabled: boolean;
  // Email Reports
  email: string | null;
  emailReportFrequency: string;
  lastReportSent: string | null;
  // Notifications
  notificationsEnabled: boolean;
  billReminderDays: number;
  // Gamification
  totalPoints: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityDate: string | null;
}

interface Summary {
  balance: number;
  totalIncome: number;
  totalExpenditure: number;
  regularExpenditure: number;
  capitalExpenditure: number;
  totalSavings: number;
  categorySpending: Record<string, number>;
  monthSpending: Record<string, number>;
  budgets: Budget[];
  pendingRecurring: Recurring[];
  loans: {
    totalLoaned: number;
    totalRepaid: number;
    totalOutstanding: number;
    activeLoans: number;
  };
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const CURRENCIES = [
  { code: 'USD', symbol: '$' },
  { code: 'EUR', symbol: '€' },
  { code: 'GBP', symbol: '£' },
  { code: 'JPY', symbol: '¥' },
  { code: 'INR', symbol: '₹' },
];

const DEFAULT_ICONS: Record<string, string> = {
  'Salary': '💰', 'Investment': '📈', 'Other Income': '💵',
  'Food': '🍔', 'Transport': '🚗', 'Shopping': '🛍️',
  'Housing': '🏠', 'Health': '🏥', 'Entertainment': '🎬',
  'Utilities': '💡', 'Education': '📚', 'Other': '📄',
};

// API helpers
const fetchData = async <T,>(url: string): Promise<T> => {
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to fetch');
  return res.json();
};

const postData = async <T,>(url: string, data: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to save');
  return res.json();
};

const putData = async <T,>(url: string, data: unknown): Promise<T> => {
  const res = await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to update');
  return res.json();
};

const deleteData = async (url: string): Promise<void> => {
  const res = await fetch(url, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete');
};

export default function BudgetApp() {
  const queryClient = useQueryClient();
  const [view, setView] = useState<string>('dashboard');
  const [txType, setTxType] = useState<'income' | 'expenditure'>('expenditure');
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expenditure'>('all');
  const [currentMonth, setCurrentMonth] = useState(MONTHS[new Date().getMonth()]);
  const [searchQuery, setSearchQuery] = useState('');
  const [analysisPeriod, setAnalysisPeriod] = useState('all');
  const [pin, setPin] = useState('');
  const [pinVerified, setPinVerified] = useState(false);
  const [pinError, setPinError] = useState('');
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [toast, setToast] = useState('');
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<string | null>(null);

  // Form states
  const [txForm, setTxForm] = useState({
    amount: '',
    category: '',
    date: new Date().toISOString().split('T')[0],
    note: '',
    receipt: '',
  });
  const [expenditureType, setExpenditureType] = useState<'regular' | 'capital'>('regular');
  const [budgetForm, setBudgetForm] = useState({ category: '', limit: '' });
  const [goalForm, setGoalForm] = useState({ name: '', target: '' });
  const [recurringForm, setRecurringForm] = useState({ name: '', amount: '', category: '' });
  const [categoryForm, setCategoryForm] = useState({ name: '', type: 'expense' as 'income' | 'expense' });
  const [emailForm, setEmailForm] = useState({ email: '', frequency: 'weekly' });
  const [exportPeriod, setExportPeriod] = useState('month');
  const [exportType, setExportType] = useState('full');
  const [aiSuggestion, setAiSuggestion] = useState<{ category: string; confidence: number } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptScanData, setReceiptScanData] = useState<{
    merchantName: string | null;
    date: string | null;
    total: number | null;
    category: string | null;
    confidence: number;
  } | null>(null);
  const [loanForm, setLoanForm] = useState({
    borrowerName: '',
    amount: '',
    dateLoaned: new Date().toISOString().split('T')[0],
    dueDate: '',
    note: '',
  });
  const [repaymentForm, setRepaymentForm] = useState({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
  const [activeLoanId, setActiveLoanId] = useState<string | null>(null);

  // AI Categorization function
  const aiCategorize = useCallback(async (description: string) => {
    if (!description || description.length < 2) return;
    
    setAiLoading(true);
    try {
      const res = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, type: txType }),
      });
      const data = await res.json();
      
      if (data.category && data.confidence > 0.5) {
        setAiSuggestion({ category: data.category, confidence: data.confidence });
      } else {
        setAiSuggestion(null);
      }
    } catch {
      setAiSuggestion(null);
    }
    setAiLoading(false);
  }, [txType]);

  // Toast helper - defined before other functions that use it
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  }, []);

  // Receipt scanning function
  const scanReceipt = useCallback(async (imageBase64: string) => {
    setScanningReceipt(true);
    try {
      const res = await fetch('/api/receipt/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64 }),
      });
      const data = await res.json();
      
      if (data.success && data.data) {
        setReceiptScanData(data.data);
        // Auto-fill the form with extracted data
        setTxForm(prev => ({
          ...prev,
          amount: data.data.total?.toString() || prev.amount,
          date: data.data.date || prev.date,
          note: data.data.merchantName ? `Merchant: ${data.data.merchantName}` : prev.note,
          receipt: imageBase64,
        }));
        if (data.data.category) {
          setAiSuggestion({ category: data.data.category, confidence: data.data.confidence });
        }
        showToast('Receipt scanned successfully!');
      } else {
        showToast('Could not extract data from receipt');
      }
    } catch {
      showToast('Failed to scan receipt');
    }
    setScanningReceipt(false);
  }, [showToast]);

  // Reset form helper - defined before mutations
  const resetTxForm = useCallback(() => {
    setTxForm({ amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', receipt: '' });
    setEditTx(null);
    setTxType('expenditure');
  }, []);

  // Queries - all hooks must be called unconditionally
  const { data: settings } = useQuery<Settings>({
    queryKey: ['settings'],
    queryFn: () => fetchData<Settings>('/api/settings'),
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => fetchData<Category[]>('/api/categories'),
  });

  const { data: transactions = [] } = useQuery<Transaction[]>({
    queryKey: ['transactions'],
    queryFn: () => fetchData<Transaction[]>('/api/transactions'),
  });

  const { data: budgets = [] } = useQuery<Budget[]>({
    queryKey: ['budgets', currentMonth],
    queryFn: () => fetchData<Budget[]>(`/api/budgets?month=${currentMonth}`),
  });

  const { data: goals = [] } = useQuery<Goal[]>({
    queryKey: ['goals'],
    queryFn: () => fetchData<Goal[]>('/api/goals'),
  });

  const { data: recurring = [] } = useQuery<Recurring[]>({
    queryKey: ['recurring'],
    queryFn: () => fetchData<Recurring[]>('/api/recurring'),
  });

  const { data: loansData } = useQuery<{ loans: Loan[]; stats: { totalLoaned: number; totalRepaid: number; totalOutstanding: number; activeLoans: number } }>({
    queryKey: ['loans'],
    queryFn: async () => {
      const res = await fetch('/api/loans');
      return res.json();
    },
  });

  const loans = loansData?.loans || [];

  // All mutations defined here, before any early returns
  const addTransaction = useMutation({
    mutationFn: (data: Partial<Transaction>) => postData<Transaction>('/api/transactions', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Transaction saved');
      resetTxForm();
      setView('dashboard');
    },
  });

  const updateTransaction = useMutation({
    mutationFn: (data: Partial<Transaction> & { id: string }) =>
      putData<Transaction>(`/api/transactions/${data.id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Transaction updated');
      resetTxForm();
      setView('dashboard');
    },
  });

  const deleteTransaction = useMutation({
    mutationFn: (id: string) => deleteData(`/api/transactions/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Transaction deleted');
    },
  });

  const addBudget = useMutation({
    mutationFn: (data: { category: string; month: string; limit: number }) =>
      postData<Budget>('/api/budgets', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Budget saved');
      setBudgetForm({ category: '', limit: '' });
    },
  });

  const addGoal = useMutation({
    mutationFn: (data: { name: string; target: number }) =>
      postData<Goal>('/api/goals', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      showToast('Goal created');
      setGoalForm({ name: '', target: '' });
      setShowModal(null);
    },
  });

  const depositToGoal = useMutation({
    mutationFn: ({ id, deposit }: { id: string; deposit: number }) =>
      putData<Goal>(`/api/goals/${id}`, { deposit }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Deposit successful');
    },
  });

  const withdrawFromGoal = useMutation({
    mutationFn: ({ id, withdraw }: { id: string; withdraw: number }) =>
      putData<Goal>(`/api/goals/${id}`, { withdraw }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Withdrawal successful');
    },
  });

  const deleteGoal = useMutation({
    mutationFn: (id: string) => deleteData(`/api/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      showToast('Goal deleted');
    },
  });

  const addRecurring = useMutation({
    mutationFn: (data: { name: string; amount: number; category: string }) =>
      postData<Recurring>('/api/recurring', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      showToast('Recurring bill added');
      setRecurringForm({ name: '', amount: '', category: '' });
    },
  });

  const deleteRecurring = useMutation({
    mutationFn: (id: string) => deleteData(`/api/recurring/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      showToast('Recurring bill deleted');
    },
  });

  const addPendingRecurring = useMutation({
    mutationFn: async () => {
      if (!summary?.pendingRecurring) return;
      const today = new Date().toISOString().split('T')[0];
      for (const r of summary.pendingRecurring) {
        await postData('/api/transactions', {
          type: 'expenditure',
          amount: r.amount,
          category: r.category,
          date: today,
          note: r.name,
        });
        await putData(`/api/recurring/${r.id}`, { lastDate: today });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['recurring'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      setShowModal(null);
      showToast('Bills added');
    },
  });

  const addCategory = useMutation({
    mutationFn: (data: { name: string; type: 'income' | 'expense'; icon: string }) =>
      postData<Category>('/api/categories', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      showToast('Category added');
      setCategoryForm({ name: '', type: 'expense' });
      setShowModal(null);
    },
  });

  const updateSettings = useMutation({
    mutationFn: (data: Partial<Settings>) => putData<Settings>('/api/settings', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      showToast('Settings updated');
    },
  });

  // Loan mutations
  const addLoan = useMutation({
    mutationFn: (data: { borrowerName: string; amount: number; dateLoaned: string; dueDate?: string; note?: string }) =>
      postData<Loan>('/api/loans', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Loan recorded');
    },
  });

  const addLoanRepayment = useMutation({
    mutationFn: (data: { id: string; repaymentAmount: number; repaymentDate: string; note?: string }) =>
      fetch('/api/loans', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'repayment', ...data }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Repayment recorded');
    },
  });

  const deleteLoan = useMutation({
    mutationFn: (id: string) => deleteData(`/api/loans?id=${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['loans'] });
      queryClient.invalidateQueries({ queryKey: ['summary'] });
      showToast('Loan deleted');
    },
  });

  // Summary query - depends on currentMonth
  const { data: summary } = useQuery<Summary>({
    queryKey: ['summary', currentMonth],
    queryFn: () => fetchData<Summary>(`/api/summary?month=${currentMonth}`),
  });

  // Initialize app
  useEffect(() => {
    const initApp = async () => {
      try {
        await postData('/api/init', {});
      } catch (e) {
        console.log('Init error:', e);
      }
    };
    initApp();
  }, []);

  // PIN status - derived from settings
  const hasPinSet = useMemo(() => !!settings?.pin, [settings?.pin]);

  // Dark mode
  useEffect(() => {
    if (settings?.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [settings?.theme]);

  // Show recurring alert when appropriate
  useEffect(() => {
    const timer = setTimeout(() => {
      if (summary?.pendingRecurring && summary.pendingRecurring.length > 0 && view === 'dashboard' && pinVerified) {
        setShowModal('recurring-alert');
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [summary?.pendingRecurring, view, pinVerified]);

  // Currency formatter
  const formatCurrency = useCallback((amount: number, showSymbol = true) => {
    const currency = CURRENCIES.find(c => c.code === settings?.currency) || CURRENCIES[0];
    return new Intl.NumberFormat('en-US', {
      style: showSymbol ? 'currency' : 'decimal',
      currency: currency.code,
      minimumFractionDigits: 2,
    }).format(amount);
  }, [settings?.currency]);

  // Escape HTML
  const escapeHtml = (str: string) => str.replace(/</g, '&lt;').replace(/>/g, '&gt;');

  // PIN handling
  const handlePinInput = (digit: string | number) => {
    if (digit === 'clear') {
      setPin('');
      setPinError('');
    } else if (digit === 'back') {
      setPin(prev => prev.slice(0, -1));
    } else if (pin.length < 4) {
      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === 4) {
        setTimeout(() => {
          if (!hasPinSet) {
            putData('/api/settings', { pin: newPin }).then(() => {
              setPinVerified(true);
              showToast('PIN set successfully');
            });
          } else if (newPin === settings?.pin) {
            setPinVerified(true);
          } else {
            setPin('');
            setPinError('Incorrect PIN');
          }
        }, 200);
      }
    }
  };

  // Get categories by type
  const incomeCategories = useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenditureCategories = useMemo(() => categories.filter(c => c.type === 'expense' || c.type === 'expenditure'), [categories]);

  // Filtered transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      if (filterType !== 'all' && t.type !== filterType) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return t.category.toLowerCase().includes(q) || (t.note?.toLowerCase().includes(q));
      }
      return true;
    });
  }, [transactions, filterType, searchQuery]);

  // Get category icon
  const getCategoryIcon = useCallback((name: string) => {
    const cat = categories.find(c => c.name === name);
    return cat?.icon || DEFAULT_ICONS[name] || '📄';
  }, [categories]);

  // Analysis calculation
  const analysisData = useMemo(() => {
    const now = new Date();
    const filtered = transactions.filter((t) => {
      if (t.type !== 'expenditure') return false;
      if (analysisPeriod === 'month') {
        return new Date(t.date).getMonth() === now.getMonth() &&
               new Date(t.date).getFullYear() === now.getFullYear();
      }
      if (analysisPeriod === '3months') {
        const txDate = new Date(t.date);
        const diffDays = (now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays <= 90;
      }
      return true;
    });

    const spending: Record<string, number> = {};
    filtered.forEach((t) => {
      spending[t.category] = (spending[t.category] || 0) + t.amount;
    });
    return spending;
  }, [transactions, analysisPeriod]);

  const maxSpending = Math.max(...Object.values(analysisData), 1);

  // Helpers
  const handleEditTx = useCallback((tx: Transaction) => {
    setEditTx(tx);
    setTxType(tx.type);
    setTxForm({
      amount: tx.amount.toString(),
      category: tx.category,
      date: tx.date,
      note: tx.note || '',
      receipt: tx.receipt || '',
    });
    setView('add');
  }, []);

  const handleSaveTx = useCallback(() => {
    if (!txForm.amount || parseFloat(txForm.amount) <= 0) {
      showToast('Please enter a valid amount');
      return;
    }
    const data = {
      type: txType,
      amount: parseFloat(txForm.amount),
      category: txForm.category || 'Other',
      date: txForm.date,
      note: txForm.note || null,
      receipt: txForm.receipt || null,
      expenditureType: txType === 'expenditure' ? expenditureType : null,
      merchantName: receiptScanData?.merchantName || null,
      receiptDate: receiptScanData?.date || null,
      receiptTotal: receiptScanData?.total || null,
      isFromReceipt: !!receiptScanData,
    };

    if (editTx) {
      updateTransaction.mutate({ ...data, id: editTx.id });
    } else {
      addTransaction.mutate(data);
    }
  }, [txForm, txType, expenditureType, receiptScanData, editTx, updateTransaction, addTransaction, showToast]);

  const handleReceiptUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setTxForm(prev => ({ ...prev, receipt: result }));
      setReceiptPreview(result);
      // Auto-trigger receipt scanning
      scanReceipt(result);
    };
    reader.readAsDataURL(file);
  }, [scanReceipt]);

  // Export/Import
  const exportData = useCallback(() => {
    const data = { transactions, budgets, goals, recurring, categories };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'techmari-budget-backup.json';
    a.click();
    showToast('Backup downloaded');
  }, [transactions, budgets, goals, recurring, categories, showToast]);

  const importData = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.transactions) {
        for (const tx of data.transactions) {
          await postData('/api/transactions', {
            type: tx.type,
            amount: tx.amount,
            category: tx.category,
            date: tx.date,
            note: tx.note,
            receipt: tx.receipt,
          });
        }
      }

      if (data.budgets) {
        for (const b of data.budgets) {
          await postData('/api/budgets', {
            category: b.category,
            month: b.month,
            limit: b.limit,
          });
        }
      }

      if (data.goals) {
        for (const g of data.goals) {
          await postData('/api/goals', {
            name: g.name,
            target: g.target,
          });
          if (g.current > 0) {
            const newGoals = await fetchData<Goal[]>('/api/goals');
            const newGoal = newGoals[newGoals.length - 1];
            await putData(`/api/goals/${newGoal.id}`, { current: g.current });
          }
        }
      }

      queryClient.invalidateQueries();
      showToast('Data restored');
    } catch {
      showToast('Invalid backup file');
    }
  }, [queryClient, showToast]);

  const resetAllData = useCallback(async () => {
    if (!confirm('This will delete ALL data. Are you sure?')) return;
    for (const tx of transactions) {
      await deleteData(`/api/transactions/${tx.id}`);
    }
    for (const b of budgets) {
      await deleteData(`/api/budgets/${b.id}`);
    }
    for (const g of goals) {
      await deleteData(`/api/goals/${g.id}`);
    }
    for (const r of recurring) {
      await deleteData(`/api/recurring/${r.id}`);
    }
    queryClient.invalidateQueries();
    showToast('All data reset');
  }, [transactions, budgets, goals, recurring, queryClient, showToast]);

  // Voice input
  const startVoiceInput = useCallback(() => {
    const SpeechRecognition = (window as unknown as { SpeechRecognition?: typeof window.SpeechRecognition; webkitSpeechRecognition?: typeof window.SpeechRecognition }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: typeof window.SpeechRecognition }).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice input not supported');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      const match = transcript.match(/[\d.]+/);
      if (match) {
        setTxForm(prev => ({ ...prev, amount: match[0] }));
      }
      setTxForm(prev => ({ ...prev, note: transcript }));
    };
    recognition.start();
    showToast('Listening...');
  }, [showToast]);

  // PIN Screen - rendered after all hooks
  // Show when: (has PIN and not verified) OR (user wants to set up PIN)
  if ((hasPinSet && !pinVerified) || showPinSetup) {
    return (
      <AuthScreen
        hasPin={hasPinSet}
        storedPin={settings?.pin || null}
        biometricEnabled={settings?.biometricEnabled ?? false}
        onVerified={() => {
          setPinVerified(true);
          setShowPinSetup(false);
        }}
        onSetPin={async (newPin) => {
          try {
            await putData('/api/settings', { pin: newPin });
            await queryClient.invalidateQueries({ queryKey: ['settings'] });
            showToast('PIN set successfully');
          } catch (error) {
            showToast('Failed to save PIN');
            throw error;
          }
        }}
        onResetApp={async () => {
          try {
            await putData('/api/settings', { pin: null, biometricEnabled: false });
            await queryClient.invalidateQueries({ queryKey: ['settings'] });
            setPinVerified(false);
            showToast('PIN removed');
          } catch (error) {
            showToast('Failed to reset PIN');
          }
        }}
      />
    );
  }

  // Main App
  return (
    <>
      <NotificationManager />
      <div className="min-h-screen bg-background flex justify-center">
        <div className="w-full max-w-[480px] min-h-screen flex flex-col relative bg-background shadow-xl">
          {/* Header */}
        <header className="bg-gradient-to-br from-blue-600 to-blue-800 text-white p-5 rounded-b-3xl shadow-lg">
          <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2 font-bold text-lg">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1.41 16.09V20h-2.67v-1.93c-1.71-.36-3.16-1.46-3.27-3.4h1.96c.1 1.05 1.18 1.91 2.53 1.91 1.29 0 2.13-.81 2.13-1.88 0-1.09-.75-1.72-2.89-2.24-2.05-.5-4.21-1.29-4.21-3.71 0-1.92 1.48-3.03 3.12-3.4V4h2.67v1.93c1.61.32 2.89 1.44 3.03 3.23h-1.97c-.1-.94-1.01-1.64-2.25-1.64-1.25 0-2.01.76-2.01 1.64 0 1.03.87 1.64 2.74 2.09 2.4.56 4.35 1.35 4.35 3.85 0 1.98-1.54 3.14-3.26 3.49z"/>
              </svg>
              Techmari Budget
            </div>
            <div className="text-sm opacity-80">
              {new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div className="text-center mb-4">
            <div className="text-sm opacity-90">Total Balance</div>
            <div className="text-3xl font-extrabold tracking-tight">
              {formatCurrency(summary?.balance || 0)}
            </div>
          </div>
          <div className="flex justify-around">
            <div className="text-center">
              <div className="text-xs opacity-80">Income</div>
              <div className="font-semibold text-green-200">{formatCurrency(summary?.totalIncome || 0)}</div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-80">Expenditure</div>
              <div className="font-semibold text-red-200">{formatCurrency(summary?.totalExpenditure || 0)}</div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-4 pb-24">
          {/* Dashboard View */}
          {view === 'dashboard' && (
            <div className="animate-fadeIn">
              <h2 className="text-lg font-bold mb-3">Recent Transactions</h2>
              <div className="flex gap-2 mb-3">
                {(['all', 'income', 'expenditure'] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilterType(f)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                      filterType === f ? 'bg-blue-600 text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
              <div className="bg-card rounded-2xl p-3 border shadow-sm">
                {filteredTransactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No transactions</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredTransactions.slice(0, 5).map((tx) => (
                      <li key={tx.id} className="flex items-center gap-3 py-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-lg">
                          {getCategoryIcon(tx.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{escapeHtml(tx.category)}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {tx.date} {tx.note && `• ${escapeHtml(tx.note)}`}
                            {tx.receipt && (
                              <button
                                onClick={() => { setReceiptPreview(tx.receipt); setShowModal('receipt'); }}
                                className="ml-2"
                              >
                                📷
                              </button>
                            )}
                          </div>
                        </div>
                        <div className={`font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, false)}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleEditTx(tx)} className="text-muted-foreground hover:text-primary">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button onClick={() => deleteTransaction.mutate(tx.id)} className="text-muted-foreground hover:text-red-500">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <h2 className="text-lg font-bold mt-5 mb-3">Budget Status</h2>
              <div className="bg-card rounded-2xl p-3 border shadow-sm">
                {summary?.budgets && summary.budgets.length > 0 ? (
                  summary.budgets.map((b) => {
                    const spent = summary.monthSpending[b.category] || 0;
                    const pct = Math.min((spent / b.limit) * 100, 100);
                    const isOver = spent > b.limit;
                    return (
                      <div key={b.id} className="mb-4 last:mb-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{escapeHtml(b.category)}</span>
                          <span>{formatCurrency(spent, false)} / {formatCurrency(b.limit, false)}</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground">No budgets set</div>
                )}
              </div>

              {/* Savings Quick Access */}
              {summary?.totalSavings && summary.totalSavings > 0 && (
                <div className="mt-5">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold">🎯 Savings</h2>
                    <button
                      onClick={() => setView('goals')}
                      className="text-xs border rounded-lg px-3 py-1.5 text-purple-600 border-purple-600"
                    >
                      View All
                    </button>
                  </div>
                  <div className="bg-purple-50 dark:bg-purple-950 rounded-2xl p-4 border border-purple-200 dark:border-purple-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-muted-foreground">Total Saved</div>
                        <div className="text-2xl font-bold text-purple-600">{formatCurrency(summary.totalSavings)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {goals.length} goal{goals.length !== 1 ? 's' : ''} in progress
                        </div>
                      </div>
                      <button
                        onClick={() => setView('goals')}
                        className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                      >
                        Manage
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Loans Quick Access */}
              {summary?.loans && summary.loans.activeLoans > 0 && (
                <div className="mt-5">
                  <div className="flex justify-between items-center mb-3">
                    <h2 className="text-lg font-bold">💸 Loans Given Out</h2>
                    <button 
                      onClick={() => setView('loans')}
                      className="text-xs border rounded-lg px-3 py-1.5 text-orange-600 border-orange-600"
                    >
                      View All
                    </button>
                  </div>
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-2xl p-4 border border-orange-200 dark:border-orange-800">
                    <div className="flex justify-between items-center">
                      <div>
                        <div className="text-sm text-muted-foreground">Outstanding</div>
                        <div className="text-2xl font-bold text-orange-600">{formatCurrency(summary.loans.totalOutstanding)}</div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {summary.loans.activeLoans} active loan{summary.loans.activeLoans !== 1 ? 's' : ''}
                        </div>
                      </div>
                      <button
                        onClick={() => setShowModal('loan')}
                        className="bg-orange-600 text-white px-3 py-2 rounded-lg text-sm font-semibold"
                      >
                        + New Loan
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Gamification Panel */}
              <div className="mt-5">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-lg font-bold">🎮 Progress</h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setView('challenges')}
                      className="text-xs border rounded-lg px-3 py-1.5 text-purple-600 border-purple-600"
                    >
                      Challenges
                    </button>
                    <button 
                      onClick={() => setView('achievements')}
                      className="text-xs border rounded-lg px-3 py-1.5 text-orange-600 border-orange-600"
                    >
                      Badges
                    </button>
                  </div>
                </div>
                <GamificationPanel compact onSelectSection={(section) => setView(section)} />
              </div>
            </div>
          )}

          {/* Transactions View */}
          {view === 'transactions' && (
            <div className="animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">Transactions</h2>
                <button onClick={() => setView('recurring')} className="text-xs border rounded-lg px-3 py-1.5 text-blue-600 border-blue-600">
                  Recurring
                </button>
              </div>
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full p-3 rounded-xl bg-card border mb-3 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="bg-card rounded-2xl p-3 border shadow-sm">
                {transactions.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">No transactions</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {filteredTransactions.map((tx) => (
                      <li key={tx.id} className="flex items-center gap-3 py-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-lg">
                          {getCategoryIcon(tx.category)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold truncate">{escapeHtml(tx.category)}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {tx.date} {tx.note && `• ${escapeHtml(tx.note)}`}
                          </div>
                        </div>
                        <div className={`font-bold ${tx.type === 'income' ? 'text-green-500' : 'text-red-500'}`}>
                          {tx.type === 'income' ? '+' : '-'}{formatCurrency(tx.amount, false)}
                        </div>
                        <div className="flex flex-col gap-2">
                          <button onClick={() => handleEditTx(tx)} className="text-muted-foreground hover:text-primary">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
                            </svg>
                          </button>
                          <button onClick={() => deleteTransaction.mutate(tx.id)} className="text-muted-foreground hover:text-red-500">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* Budgets View */}
          {view === 'budgets' && (
            <div className="animate-fadeIn">
              <div className="bg-blue-50 dark:bg-blue-950 rounded-2xl p-3 mb-4 border border-blue-200 dark:border-blue-800">
                <label className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1 block">Month:</label>
                <select value={currentMonth} onChange={(e) => setCurrentMonth(e.target.value)} className="w-full p-2 rounded-lg bg-card border outline-none">
                  {MONTHS.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </div>

              <div className="bg-card rounded-2xl p-3 border shadow-sm mb-4">
                {summary?.budgets && summary.budgets.length > 0 ? (
                  summary.budgets.map((b) => {
                    const spent = summary.monthSpending[b.category] || 0;
                    const pct = Math.min((spent / b.limit) * 100, 100);
                    const isOver = spent > b.limit;
                    return (
                      <div key={b.id} className="mb-4 last:mb-0">
                        <div className="flex justify-between text-sm mb-1">
                          <span>{escapeHtml(b.category)}</span>
                          <span>{formatCurrency(spent, false)} / {formatCurrency(b.limit, false)}</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-blue-600'}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-muted-foreground">No budgets set</div>
                )}
              </div>

              <div className="bg-card rounded-2xl p-4 border shadow-sm">
                <h3 className="font-semibold mb-3">Set Budget</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                    <select
                      value={budgetForm.category}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    >
                      <option value="">Select category</option>
                      {expenditureCategories.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Limit ($)</label>
                    <input
                      type="number"
                      placeholder="500"
                      value={budgetForm.limit}
                      onChange={(e) => setBudgetForm(prev => ({ ...prev, limit: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (budgetForm.category && budgetForm.limit) {
                        addBudget.mutate({ category: budgetForm.category, month: currentMonth, limit: parseFloat(budgetForm.limit) });
                      }
                    }}
                    className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                  >
                    Save Budget
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Goals View */}
          {view === 'goals' && (
            <div className="animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">🎯 Savings Goals</h2>
                <button onClick={() => setShowModal('goal')} className="bg-purple-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  + New
                </button>
              </div>

              {/* Savings Summary */}
              {goals.length > 0 && (
                <div className="bg-purple-50 dark:bg-purple-950 rounded-2xl p-4 mb-4 border border-purple-200 dark:border-purple-800">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-sm text-muted-foreground">Total Savings</div>
                      <div className="text-2xl font-bold text-purple-600">{formatCurrency(summary?.totalSavings || 0)}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {goals.length} goal{goals.length !== 1 ? 's' : ''} • Reduces available balance
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>Available Balance:</div>
                      <div className={`font-semibold ${summary?.balance && summary.balance >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                        {formatCurrency(summary?.balance || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {goals.length === 0 ? (
                <div className="bg-card rounded-2xl p-8 text-center border shadow-sm">
                  <div className="text-muted-foreground">No goals yet</div>
                </div>
              ) : (
                <div className="space-y-3">
                  {goals.map((g) => {
                    const pct = Math.min((g.current / g.target) * 100, 100);
                    return (
                      <div key={g.id} className="bg-card rounded-2xl p-4 border shadow-sm">
                        <div className="flex justify-between items-center mb-2">
                          <div className="font-semibold">{escapeHtml(g.name)}</div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => {
                                const amount = prompt('Amount to withdraw:');
                                if (amount && parseFloat(amount) > 0) {
                                  withdrawFromGoal.mutate({ id: g.id, withdraw: parseFloat(amount) });
                                }
                              }}
                              className="text-green-600 font-semibold text-sm"
                            >
                              Withdraw
                            </button>
                            <button
                              onClick={() => {
                                const amount = prompt('Amount to deposit:');
                                if (amount && parseFloat(amount) > 0) {
                                  depositToGoal.mutate({ id: g.id, deposit: parseFloat(amount) });
                                }
                              }}
                              className="text-purple-600 font-semibold text-sm"
                            >
                              + Add Funds
                            </button>
                          </div>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>{formatCurrency(g.current)} saved</span>
                          <span>Target: {formatCurrency(g.target)}</span>
                        </div>
                        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-purple-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <button onClick={() => deleteGoal.mutate(g.id)} className="mt-2 text-xs text-red-500">Delete</button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Loans View */}
          {view === 'loans' && (
            <div className="animate-fadeIn">
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-lg font-bold">💸 Loans Given Out</h2>
                <button onClick={() => setShowModal('loan')} className="bg-orange-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                  + New Loan
                </button>
              </div>
              
              {/* Loans Summary */}
              {summary?.loans && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-orange-50 dark:bg-orange-950 rounded-xl p-3 text-center border border-orange-200 dark:border-orange-800">
                    <div className="text-lg font-bold text-orange-600">{formatCurrency(summary.loans.totalOutstanding)}</div>
                    <div className="text-xs text-muted-foreground">Outstanding</div>
                  </div>
                  <div className="bg-green-50 dark:bg-green-950 rounded-xl p-3 text-center border border-green-200 dark:border-green-800">
                    <div className="text-lg font-bold text-green-600">{formatCurrency(summary.loans.totalRepaid)}</div>
                    <div className="text-xs text-muted-foreground">Repaid</div>
                  </div>
                  <div className="bg-blue-50 dark:bg-blue-950 rounded-xl p-3 text-center border border-blue-200 dark:border-blue-800">
                    <div className="text-lg font-bold text-blue-600">{summary.loans.activeLoans}</div>
                    <div className="text-xs text-muted-foreground">Active</div>
                  </div>
                </div>
              )}
              
              {/* Active Loans */}
              {loans.filter(l => l.status === 'active' || l.status === 'partially_paid').length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Active Loans</h3>
                  <div className="space-y-3">
                    {loans.filter(l => l.status === 'active' || l.status === 'partially_paid').map(loan => (
                      <div key={loan.id} className="bg-card rounded-2xl p-4 border shadow-sm">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="font-semibold">{escapeHtml(loan.borrowerName)}</div>
                            <div className="text-xs text-muted-foreground">
                              Loaned: {loan.dateLoaned} {loan.dueDate && `• Due: ${loan.dueDate}`}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-red-500">{formatCurrency(loan.remainingAmount)}</div>
                            <div className="text-xs text-muted-foreground">remaining</div>
                          </div>
                        </div>
                        
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div 
                            className="h-full bg-green-500 rounded-full transition-all" 
                            style={{ width: `${Math.min((1 - loan.remainingAmount / loan.amount) * 100, 100)}%` }} 
                          />
                        </div>
                        
                        <div className="flex justify-between text-xs text-muted-foreground mb-2">
                          <span>{formatCurrency(loan.amount - loan.remainingAmount)} repaid</span>
                          <span>of {formatCurrency(loan.amount)}</span>
                        </div>
                        
                        {loan.note && <div className="text-xs text-muted-foreground mb-2">📝 {escapeHtml(loan.note)}</div>}
                        
                        <div className="flex gap-2">
                          <button
                            onClick={() => setActiveLoanId(activeLoanId === loan.id ? null : loan.id)}
                            className="flex-1 text-sm bg-green-100 text-green-700 py-2 rounded-lg font-semibold"
                          >
                            + Repay
                          </button>
                          <button
                            onClick={() => deleteLoan.mutate(loan.id)}
                            className="text-red-500 text-sm px-3"
                          >
                            Delete
                          </button>
                        </div>
                        
                        {activeLoanId === loan.id && (
                          <div className="mt-3 p-3 bg-muted rounded-xl">
                            <input
                              type="number"
                              placeholder="Amount"
                              value={repaymentForm.amount}
                              onChange={(e) => setRepaymentForm(prev => ({ ...prev, amount: e.target.value }))}
                              className="w-full p-2 rounded-lg bg-background border mb-2 outline-none"
                            />
                            <input
                              type="date"
                              value={repaymentForm.date}
                              onChange={(e) => setRepaymentForm(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full p-2 rounded-lg bg-background border mb-2 outline-none"
                            />
                            <button
                              onClick={() => {
                                if (repaymentForm.amount) {
                                  addLoanRepayment.mutate({
                                    id: loan.id,
                                    repaymentAmount: parseFloat(repaymentForm.amount),
                                    repaymentDate: repaymentForm.date,
                                  });
                                  setRepaymentForm({ amount: '', date: new Date().toISOString().split('T')[0], note: '' });
                                  setActiveLoanId(null);
                                }
                              }}
                              className="w-full bg-green-600 text-white py-2 rounded-lg font-semibold"
                            >
                              Record Repayment
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Paid Loans */}
              {loans.filter(l => l.status === 'paid').length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-2">Paid Off ✓</h3>
                  <div className="space-y-2">
                    {loans.filter(l => l.status === 'paid').map(loan => (
                      <div key={loan.id} className="bg-green-50 dark:bg-green-950 rounded-xl p-3 border border-green-200 dark:border-green-800">
                        <div className="flex justify-between">
                          <span className="font-medium">{escapeHtml(loan.borrowerName)}</span>
                          <span className="text-green-600 font-semibold">{formatCurrency(loan.amount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {loans.length === 0 && (
                <div className="bg-card rounded-2xl p-8 text-center border shadow-sm">
                  <div className="text-muted-foreground">No loans recorded</div>
                </div>
              )}
            </div>
          )}

          {/* Settings View */}
          {view === 'settings' && (
            <div className="animate-fadeIn">
              <h2 className="text-lg font-bold mb-3">Analysis</h2>
              <div className="bg-card rounded-2xl p-4 border shadow-sm mb-4">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm text-muted-foreground">Period:</span>
                  <select value={analysisPeriod} onChange={(e) => setAnalysisPeriod(e.target.value)} className="p-2 rounded-lg bg-muted border outline-none text-sm">
                    <option value="all">All Time</option>
                    <option value="month">This Month</option>
                    <option value="3months">Last 3 Months</option>
                  </select>
                </div>
                {Object.keys(analysisData).length > 0 ? (
                  <div className="flex items-end justify-between h-48 pt-4">
                    {Object.entries(analysisData).map(([cat, amount]) => {
                      const height = (amount / maxSpending) * 100;
                      return (
                        <div key={cat} className="flex flex-col items-center w-[14%]">
                          <div className="w-full bg-blue-600 rounded-t-lg transition-all min-h-[4px]" style={{ height: `${height}%` }} />
                          <div className="text-xs text-muted-foreground mt-1 truncate w-full text-center">{cat.slice(0, 4)}</div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No expenditure data</div>
                )}
              </div>

              <div className="bg-card rounded-2xl p-4 border shadow-sm">
                <h3 className="font-semibold mb-3">Settings</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Currency</label>
                    <select
                      value={settings?.currency || 'USD'}
                      onChange={(e) => updateSettings.mutate({ currency: e.target.value })}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    >
                      {CURRENCIES.map((c) => (<option key={c.code} value={c.code}>{c.code} ({c.symbol})</option>))}
                    </select>
                  </div>
                  
                  {/* Security Section */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground mb-2 block">Security</label>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-xl">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔐</span>
                        <div>
                          <div className="font-medium text-sm">PIN Lock</div>
                          <div className="text-xs text-muted-foreground">
                            {hasPinSet ? 'PIN is set' : 'No PIN set'}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (hasPinSet) {
                            if (confirm('Remove PIN lock? This will also disable biometric login.')) {
                              setPinVerified(false); // Log user out
                              updateSettings.mutate({ pin: null, biometricEnabled: false });
                            }
                          } else {
                            setShowPinSetup(true);
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                          hasPinSet 
                            ? 'bg-red-100 text-red-600 hover:bg-red-200' 
                            : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                      >
                        {hasPinSet ? 'Remove' : 'Set PIN'}
                      </button>
                    </div>
                    
                    {/* Biometric Toggle - only show if PIN is set */}
                    {hasPinSet && (
                      <div className="flex items-center justify-between p-3 bg-muted rounded-xl mt-2">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">👆</span>
                          <div>
                            <div className="font-medium text-sm">Biometric Login</div>
                            <div className="text-xs text-muted-foreground">
                              Face ID / Fingerprint
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            const newValue = !settings?.biometricEnabled;
                            updateSettings.mutate({ 
                              biometricEnabled: newValue 
                            });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                            settings?.biometricEnabled 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                          }`}
                        >
                          {settings?.biometricEnabled ? '✓ On' : 'Off'}
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Quick Access */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground mb-2 block">Quick Access</label>
                    <button
                      onClick={() => setView('loans')}
                      className="w-full flex items-center justify-between p-3 rounded-xl bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 mb-2"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-lg">💸</span>
                        <div className="text-left">
                          <div className="font-medium text-sm text-orange-700 dark:text-orange-300">Loans Given Out</div>
                          <div className="text-xs text-muted-foreground">
                            {summary?.loans?.activeLoans || 0} active • {formatCurrency(summary?.loans?.totalOutstanding || 0)} outstanding
                          </div>
                        </div>
                      </div>
                      <svg className="w-4 h-4 text-orange-600" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
                      </svg>
                    </button>
                  </div>
                  
                  <button
                    onClick={() => updateSettings.mutate({ theme: settings?.theme === 'dark' ? 'light' : 'dark' })}
                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-muted border font-semibold"
                  >
                    {settings?.theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
                  </button>
                  <InstallButton />
                  
                  {/* PDF Export Section */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground mb-2 block">📄 Export PDF Report</label>
                    <div className="flex gap-2 mb-2">
                      <select 
                        value={exportPeriod} 
                        onChange={(e) => setExportPeriod(e.target.value)}
                        className="flex-1 p-2 rounded-lg bg-muted border outline-none text-sm"
                      >
                        <option value="month">This Month</option>
                        <option value="3months">Last 3 Months</option>
                        <option value="all">All Time</option>
                      </select>
                      <select 
                        value={exportType} 
                        onChange={(e) => setExportType(e.target.value)}
                        className="flex-1 p-2 rounded-lg bg-muted border outline-none text-sm"
                      >
                        <option value="summary">Summary Only</option>
                        <option value="transactions">With Transactions</option>
                        <option value="full">Full Report</option>
                      </select>
                    </div>
                    <button 
                      onClick={() => window.open(`/api/export/pdf?period=${exportPeriod}&type=${exportType}`, '_blank')}
                      className="w-full p-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
                    >
                      📄 Download PDF Report
                    </button>
                  </div>
                  
                  {/* Email Reports Section */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground mb-2 block">📧 Email Reports</label>
                    <div className="space-y-2">
                      <input
                        type="email"
                        placeholder="Enter your email"
                        value={emailForm.email || settings?.email || ''}
                        onChange={(e) => setEmailForm(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full p-2.5 rounded-xl bg-muted border outline-none text-sm"
                      />
                      <select
                        value={emailForm.frequency || settings?.emailReportFrequency || 'none'}
                        onChange={(e) => {
                          setEmailForm(prev => ({ ...prev, frequency: e.target.value }));
                          updateSettings.mutate({ emailReportFrequency: e.target.value });
                        }}
                        className="w-full p-2.5 rounded-xl bg-muted border outline-none text-sm"
                      >
                        <option value="none">No automatic reports</option>
                        <option value="weekly">Weekly Reports</option>
                        <option value="monthly">Monthly Reports</option>
                      </select>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const email = emailForm.email || settings?.email;
                            if (!email) {
                              showToast('Please enter an email address');
                              return;
                            }
                            updateSettings.mutate({ email, emailReportFrequency: emailForm.frequency });
                            try {
                              const res = await fetch('/api/reports/email', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, period: 'weekly' }),
                              });
                              const data = await res.json();
                              if (data.success) {
                                showToast('Report sent to ' + email);
                              } else {
                                showToast(data.error || 'Failed to send report');
                              }
                            } catch {
                              showToast('Failed to send report');
                            }
                          }}
                          className="flex-1 p-2.5 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition-colors text-sm"
                        >
                          📧 Send Now
                        </button>
                        <button 
                          onClick={() => window.open('/api/reports/email?period=weekly', '_blank')}
                          className="flex-1 p-2.5 rounded-xl border font-semibold hover:bg-muted transition-colors text-sm"
                        >
                          👁️ Preview
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Notifications Section */}
                  <div className="pt-2 border-t">
                    <label className="text-xs text-muted-foreground mb-2 block">🔔 Notifications</label>
                    <div className="flex items-center justify-between p-3 bg-muted rounded-xl mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">🔔</span>
                        <div>
                          <div className="font-medium text-sm">Bill Reminders</div>
                          <div className="text-xs text-muted-foreground">Get notified before bills are due</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          const hasPermission = await requestNotificationPermission();
                          if (hasPermission) {
                            updateSettings.mutate({ notificationsEnabled: !settings?.notificationsEnabled });
                            showToast(settings?.notificationsEnabled ? 'Notifications disabled' : 'Notifications enabled');
                          } else {
                            showToast('Please allow notifications in your browser');
                          }
                        }}
                        className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${
                          settings?.notificationsEnabled 
                            ? 'bg-green-100 text-green-600' 
                            : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                        }`}
                      >
                        {settings?.notificationsEnabled ? '✓ On' : 'Off'}
                      </button>
                    </div>
                    {settings?.notificationsEnabled && (
                      <div className="flex items-center gap-2 p-3 bg-muted rounded-xl">
                        <label className="text-sm">Remind me</label>
                        <select
                          value={settings?.billReminderDays || 3}
                          onChange={(e) => updateSettings.mutate({ billReminderDays: parseInt(e.target.value) })}
                          className="flex-1 p-2 rounded-lg bg-background border outline-none text-sm"
                        >
                          <option value={1}>1 day before</option>
                          <option value={2}>2 days before</option>
                          <option value={3}>3 days before</option>
                          <option value={5}>5 days before</option>
                          <option value={7}>1 week before</option>
                        </select>
                      </div>
                    )}
                  </div>
                  
                  <button onClick={exportData} className="w-full p-3 rounded-xl border font-semibold hover:bg-muted transition-colors">
                    📦 Backup Data (JSON)
                  </button>
                  <input type="file" accept=".json" onChange={importData} className="hidden" id="import-file" />
                  <button onClick={() => document.getElementById('import-file')?.click()} className="w-full p-3 rounded-xl border font-semibold hover:bg-muted transition-colors">
                    📥 Restore Backup
                  </button>
                  <button onClick={resetAllData} className="w-full p-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors">
                    🗑️ Reset All Data
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Challenges View */}
          {view === 'challenges' && (
            <div className="animate-fadeIn">
              <ChallengesView />
            </div>
          )}

          {/* Achievements View */}
          {view === 'achievements' && (
            <div className="animate-fadeIn">
              <AchievementsView />
            </div>
          )}

          {/* Recurring View */}
          {view === 'recurring' && (
            <div className="animate-fadeIn">
              <h2 className="text-lg font-bold mb-3">Recurring Bills</h2>
              <div className="bg-card rounded-2xl p-4 border shadow-sm mb-4">
                <div className="space-y-3">
                  <input
                    type="text"
                    placeholder="Name (e.g., Rent)"
                    value={recurringForm.name}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={recurringForm.amount}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, amount: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                  />
                  <select
                    value={recurringForm.category}
                    onChange={(e) => setRecurringForm(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                  >
                    <option value="">Select category</option>
                    {expenditureCategories.map((c) => (<option key={c.id} value={c.name}>{c.name}</option>))}
                  </select>
                  <button
                    onClick={() => {
                      if (recurringForm.name && recurringForm.amount && recurringForm.category) {
                        addRecurring.mutate({ name: recurringForm.name, amount: parseFloat(recurringForm.amount), category: recurringForm.category });
                      }
                    }}
                    className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold"
                  >
                    Add Recurring Bill
                  </button>
                </div>
              </div>
              <div className="bg-card rounded-2xl p-3 border shadow-sm">
                {recurring.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground">No recurring bills</div>
                ) : (
                  <ul className="divide-y divide-border">
                    {recurring.map((r) => (
                      <li key={r.id} className="flex items-center justify-between py-3">
                        <div>
                          <div className="font-semibold">{escapeHtml(r.name)}</div>
                          <div className="text-xs text-muted-foreground">{r.category}</div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-bold text-red-500">{formatCurrency(r.amount, false)}</span>
                          <button onClick={() => deleteRecurring.mutate(r.id)} className="text-muted-foreground hover:text-red-500">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>
                            </svg>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setView('transactions')} className="w-full mt-4 text-muted-foreground">← Back</button>
            </div>
          )}

          {/* Add Transaction View */}
          {view === 'add' && (
            <div className="animate-fadeIn">
              <h2 className="text-lg font-bold mb-3">{editTx ? 'Edit Transaction' : 'Add Transaction'}</h2>
              <div className="bg-card rounded-2xl p-4 border shadow-sm">
                <div className="flex bg-muted rounded-xl p-1 mb-4">
                  <button
                    onClick={() => setTxType('income')}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${txType === 'income' ? 'bg-card text-blue-600 shadow' : 'text-muted-foreground'}`}
                  >
                    Income
                  </button>
                  <button
                    onClick={() => setTxType('expenditure')}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${txType === 'expenditure' ? 'bg-card text-red-600 shadow' : 'text-muted-foreground'}`}
                  >
                    Expenditure
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Amount</label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        value={txForm.amount}
                        onChange={(e) => setTxForm(prev => ({ ...prev, amount: e.target.value }))}
                        className="w-full p-2.5 pr-12 rounded-xl bg-muted border outline-none"
                      />
                      <button onClick={startVoiceInput} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full hover:bg-border">🎤</button>
                    </div>
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Category</label>
                    
                    {/* Receipt Scan Result */}
                    {receiptScanData && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                        <span className="text-lg">📷</span>
                        <div className="text-xs text-blue-700 dark:text-blue-300">
                          <div><strong>Merchant:</strong> {receiptScanData.merchantName || 'N/A'}</div>
                          <div><strong>Total:</strong> {receiptScanData.total ? formatCurrency(receiptScanData.total) : 'N/A'}</div>
                          <div><strong>Date:</strong> {receiptScanData.date || 'N/A'}</div>
                        </div>
                        <button 
                          onClick={() => setReceiptScanData(null)}
                          className="ml-auto text-xs text-blue-600"
                        >
                          Clear
                        </button>
                      </div>
                    )}
                    
                    {/* AI Suggestion */}
                    {aiSuggestion && (
                      <div className="flex items-center gap-2 mb-2 p-2 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                        <span className="text-lg">✨</span>
                        <span className="text-xs text-purple-700 dark:text-purple-300">
                          AI suggests: <strong>{aiSuggestion.category}</strong> ({Math.round(aiSuggestion.confidence * 100)}% confidence)
                        </span>
                        <button 
                          onClick={() => setTxForm(prev => ({ ...prev, category: aiSuggestion.category }))}
                          className="ml-auto text-xs bg-purple-600 text-white px-2 py-1 rounded"
                        >
                          Use
                        </button>
                      </div>
                    )}
                    
                    <select
                      value={txForm.category}
                      onChange={(e) => setTxForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    >
                      <option value="">Select category</option>
                      {(txType === 'income' ? incomeCategories : expenditureCategories).map((c) => (
                        <option key={c.id} value={c.name}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => setShowModal('category')} className="text-xs text-blue-600">+ New Category</button>
                      <button 
                        onClick={() => {
                          if (txForm.note) {
                            aiCategorize(txForm.note);
                          } else {
                            showToast('Enter a note first for AI suggestion');
                          }
                        }}
                        disabled={aiLoading}
                        className="text-xs text-purple-600 disabled:opacity-50"
                      >
                        {aiLoading ? '🤔 Thinking...' : '✨ AI Suggest'}
                      </button>
                    </div>
                  </div>

                  {/* Expenditure Type Selector */}
                  {txType === 'expenditure' && (
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Expenditure Type</label>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setExpenditureType('regular')}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            expenditureType === 'regular' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          🛒 Regular
                        </button>
                        <button
                          onClick={() => setExpenditureType('capital')}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                            expenditureType === 'capital' 
                              ? 'bg-orange-600 text-white' 
                              : 'bg-muted text-muted-foreground hover:bg-muted/80'
                          }`}
                        >
                          🏗️ Capital
                        </button>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {expenditureType === 'capital' 
                          ? 'Capital expenditure: Long-term assets (equipment, property, investments)'
                          : 'Regular expenditure: Day-to-day operational costs'}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Date</label>
                    <input
                      type="date"
                      value={txForm.date}
                      onChange={(e) => setTxForm(prev => ({ ...prev, date: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Note</label>
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={txForm.note}
                      onChange={(e) => setTxForm(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-muted-foreground mb-1 block">Receipt (Optional)</label>
                    <div className="border-2 border-dashed rounded-xl p-4 text-center relative">
                      <input type="file" accept="image/*" onChange={handleReceiptUpload} className="absolute inset-0 opacity-0 cursor-pointer" disabled={scanningReceipt} />
                      {scanningReceipt ? (
                        <div className="flex items-center justify-center gap-2">
                          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                          <span className="text-blue-600">Scanning receipt...</span>
                        </div>
                      ) : txForm.receipt ? (
                        <img src={txForm.receipt} alt="Receipt" className="max-h-32 mx-auto rounded-lg" />
                      ) : (
                        <div>
                          <span className="text-muted-foreground">📷 Tap to scan receipt</span>
                          <div className="text-xs text-muted-foreground mt-1">AI will extract amount, date & merchant</div>
                        </div>
                      )}
                    </div>
                  </div>

                  <button onClick={handleSaveTx} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors">
                    {editTx ? 'Update Transaction' : 'Save Transaction'}
                  </button>
                  <button onClick={() => { resetTxForm(); setView('dashboard'); }} className="w-full text-muted-foreground">Cancel</button>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* Bottom Navigation */}
        <nav className="absolute bottom-0 left-0 right-0 h-[70px] bg-card border-t flex justify-around items-center px-2">
          <button onClick={() => { resetTxForm(); setView('dashboard'); }} className={`flex flex-col items-center gap-0.5 ${view === 'dashboard' ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z"/></svg>
            <span className="text-xs">Home</span>
          </button>
          <button onClick={() => setView('transactions')} className={`flex flex-col items-center gap-0.5 ${view === 'transactions' ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/></svg>
            <span className="text-xs">List</span>
          </button>
          <button onClick={() => setView('budgets')} className={`flex flex-col items-center gap-0.5 ${view === 'budgets' ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>
            <span className="text-xs">Budget</span>
          </button>
          <button onClick={() => { resetTxForm(); setView('add'); }} className="w-14 h-14 bg-blue-600 rounded-full flex items-center justify-center text-white shadow-lg -translate-y-5 border-4 border-background">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          </button>
          <button onClick={() => setView('goals')} className={`flex flex-col items-center gap-0.5 ${view === 'goals' ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M16 6l2.29 2.29-4.88 4.88-4-4L2 12.59 3.41 14l6 6 10-10z"/></svg>
            <span className="text-xs">Goals</span>
          </button>
          <button onClick={() => setView('settings')} className={`flex flex-col items-center gap-0.5 ${view === 'settings' ? 'text-blue-600' : 'text-muted-foreground'}`}>
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"/></svg>
            <span className="text-xs">More</span>
          </button>
        </nav>

        {/* Toast */}
        <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-4 py-2 rounded-full text-sm transition-all ${toast ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
          {toast}
        </div>

        {/* Modals */}
        {showModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-card rounded-2xl p-5 w-full max-w-sm">
              {showModal === 'category' && (
                <>
                  <h3 className="font-bold text-lg mb-4">New Category</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Category name"
                      value={categoryForm.name}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <select
                      value={categoryForm.type}
                      onChange={(e) => setCategoryForm(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    >
                      <option value="expense">Expenditure</option>
                      <option value="income">Income</option>
                    </select>
                    <button
                      onClick={() => {
                        if (categoryForm.name) {
                          addCategory.mutate({ name: categoryForm.name, type: categoryForm.type, icon: DEFAULT_ICONS[categoryForm.name] || '📄' });
                        }
                      }}
                      className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold"
                    >
                      Create
                    </button>
                    <button onClick={() => setShowModal(null)} className="w-full text-muted-foreground">Cancel</button>
                  </div>
                </>
              )}

              {showModal === 'goal' && (
                <>
                  <h3 className="font-bold text-lg mb-4">New Goal</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Goal name (e.g., Vacation)"
                      value={goalForm.name}
                      onChange={(e) => setGoalForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Target amount"
                      value={goalForm.target}
                      onChange={(e) => setGoalForm(prev => ({ ...prev, target: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <button
                      onClick={() => {
                        if (goalForm.name && goalForm.target) {
                          addGoal.mutate({ name: goalForm.name, target: parseFloat(goalForm.target) });
                        }
                      }}
                      className="w-full bg-purple-600 text-white py-3 rounded-xl font-semibold"
                    >
                      Create
                    </button>
                    <button onClick={() => setShowModal(null)} className="w-full text-muted-foreground">Cancel</button>
                  </div>
                </>
              )}

              {showModal === 'loan' && (
                <>
                  <h3 className="font-bold text-lg mb-4">💸 Record a Loan</h3>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Borrower name"
                      value={loanForm.borrowerName}
                      onChange={(e) => setLoanForm(prev => ({ ...prev, borrowerName: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={loanForm.amount}
                      onChange={(e) => setLoanForm(prev => ({ ...prev, amount: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Date Loaned</label>
                      <input
                        type="date"
                        value={loanForm.dateLoaned}
                        onChange={(e) => setLoanForm(prev => ({ ...prev, dateLoaned: e.target.value }))}
                        className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">Due Date (Optional)</label>
                      <input
                        type="date"
                        value={loanForm.dueDate}
                        onChange={(e) => setLoanForm(prev => ({ ...prev, dueDate: e.target.value }))}
                        className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Note (optional)"
                      value={loanForm.note}
                      onChange={(e) => setLoanForm(prev => ({ ...prev, note: e.target.value }))}
                      className="w-full p-2.5 rounded-xl bg-muted border outline-none"
                    />
                    <div className="text-xs text-muted-foreground">
                      ℹ️ This is money you've loaned out. It reduces your available balance but is not an expenditure.
                    </div>
                    <button
                      onClick={() => {
                        if (loanForm.borrowerName && loanForm.amount) {
                          addLoan.mutate({
                            borrowerName: loanForm.borrowerName,
                            amount: parseFloat(loanForm.amount),
                            dateLoaned: loanForm.dateLoaned,
                            dueDate: loanForm.dueDate || undefined,
                            note: loanForm.note || undefined,
                          });
                          setLoanForm({ borrowerName: '', amount: '', dateLoaned: new Date().toISOString().split('T')[0], dueDate: '', note: '' });
                          setShowModal(null);
                        }
                      }}
                      className="w-full bg-orange-600 text-white py-3 rounded-xl font-semibold"
                    >
                      Record Loan
                    </button>
                    <button onClick={() => setShowModal(null)} className="w-full text-muted-foreground">Cancel</button>
                  </div>
                </>
              )}

              {showModal === 'recurring-alert' && (
                <>
                  <h3 className="font-bold text-lg mb-2">Pending Bills</h3>
                  <p className="text-sm text-muted-foreground mb-4">Bills due this month:</p>
                  <ul className="space-y-2 mb-4">
                    {summary?.pendingRecurring?.map((r) => (
                      <li key={r.id} className="text-sm">{r.name} - {formatCurrency(r.amount)}</li>
                    ))}
                  </ul>
                  <button onClick={() => addPendingRecurring.mutate()} className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold">Add All</button>
                  <button onClick={() => setShowModal(null)} className="w-full text-muted-foreground mt-2">Skip</button>
                </>
              )}

              {showModal === 'receipt' && receiptPreview && (
                <>
                  <img src={receiptPreview} alt="Receipt" className="max-h-[70vh] mx-auto rounded-lg" />
                  <button onClick={() => { setShowModal(null); setReceiptPreview(null); }} className="w-full mt-4 bg-white/20 text-white py-2 rounded-full font-semibold backdrop-blur">Close</button>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
