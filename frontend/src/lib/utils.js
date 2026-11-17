import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatDate(date) {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(date) {
  if (!date) return '-';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const STATUS_COLORS = {
  PLANNED: 'bg-gray-100 text-gray-700',
  UNASSIGNED: 'bg-yellow-100 text-yellow-700',
  ASSIGNED: 'bg-blue-100 text-blue-700',
  AWAITING_ACKNOWLEDGEMENT: 'bg-orange-100 text-orange-700',
  ACCEPTED: 'bg-cyan-100 text-cyan-700',
  SCHEDULED: 'bg-indigo-100 text-indigo-700',
  IN_PROGRESS: 'bg-purple-100 text-purple-700',
  COMPLETED: 'bg-teal-100 text-teal-700',
  SUBMITTED: 'bg-lime-100 text-lime-700',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700',
  RETURNED: 'bg-rose-100 text-rose-700',
  APPROVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-700',
  ON_HOLD: 'bg-gray-100 text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  REASSIGNMENT_REQUESTED: 'bg-orange-100 text-orange-700',
  REASSIGNED: 'bg-gray-100 text-gray-600',
};

export const PRIORITY_COLORS = {
  Low: 'bg-gray-100 text-gray-600',
  Normal: 'bg-blue-100 text-blue-600',
  High: 'bg-orange-100 text-orange-600',
  Critical: 'bg-red-100 text-red-600',
};
