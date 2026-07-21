import React from 'react';
import { Search, ShieldAlert, CheckCircle2, GraduationCap, User, HeartCrack } from 'lucide-react';
import { Surat } from '../../../types';

/* Helper Component: Empty State */
export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-50 text-slate-400 mb-3">
        <Search className="h-6 w-6" />
      </div>
      <h3 className="font-display text-sm font-bold text-slate-800">Tidak Ada Hasil</h3>
      <p className="mt-1 text-xs text-slate-400 max-w-xs">{message}</p>
    </div>
  );
}

/* Helper Component: Status Badge for Surat */
export function StatusSuratBadge({ status }: { status: Surat['status'] }) {
  switch (status) {
    case 'Diarsipkan':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-600">
          Diarsipkan
        </span>
      );
    case 'Dalam Proses':
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700 border border-indigo-100">
          Dalam Proses
        </span>
      );
    case 'Mendesak':
      return (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700 border border-rose-100 animate-pulse">
          <ShieldAlert className="h-3.5 w-3.5" />
          Mendesak
        </span>
      );
  }
}

/* Helper Component: Status Keanggotaan Badge */
export function MembershipBadge({ status }: { status: 'Aktif' | 'Alumni' | 'Meninggal' }) {
  if (status === 'Alumni') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold text-indigo-700 border border-indigo-100">
        <GraduationCap className="h-3 w-3" />
        Alumni
      </span>
    );
  }
  if (status === 'Meninggal') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-700 border border-slate-200">
        <HeartCrack className="h-3 w-3" />
        Meninggal
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-100">
      <CheckCircle2 className="h-3 w-3" />
      Aktif
    </span>
  );
}
