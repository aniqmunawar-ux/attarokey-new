import React from 'react';
import { Wallet, Clock, Lock, Sparkles, CheckCircle2 } from 'lucide-react';

export default function BendaharaView() {
  return (
    <div className="space-y-6">
      {/* Module Header */}
      <div>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
          Bendahara
        </h1>
        <p className="text-sm text-slate-500">
          Kelola syahriah bulanan, tabungan santri, dan laporan keuangan terpadu.
        </p>
      </div>

      {/* Main Status Container */}
      <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/20 p-6 sm:p-8 shadow-sm">
        {/* Background decorative blob */}
        <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-amber-200/20 blur-3xl" />
        <div className="absolute -left-16 -bottom-16 h-48 w-48 rounded-full bg-amber-100/30 blur-3xl" />

        <div className="relative flex flex-col items-center text-center max-w-xl mx-auto space-y-5 py-6">
          {/* Animated Icon Circle */}
          <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500 text-white shadow-lg shadow-amber-500/20">
            <Wallet className="h-8 w-8" />
            <div className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-600 ring-2 ring-white">
              <Clock className="h-2.5 w-2.5 animate-spin" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
              <Sparkles className="h-3.5 w-3.5" />
              Modul Sedang Dikembangkan
            </span>
            <h2 className="font-display text-xl font-extrabold text-slate-900 sm:text-2xl tracking-tight">
              Sistem Syahriah & Transaksi Terpadu
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Fitur keuangan syahriah bulanan, pencatatan donasi, integrasi gerbang pembayaran otomatis, 
              dan visualisasi grafik kas pesantren sedang dipersiapkan untuk mempermudah operasional bendahara.
            </p>
          </div>

          {/* Development Progress Indicator */}
          <div className="w-full max-w-sm space-y-2 pt-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
              <span>SINKRONISASI COLD-STORAGE</span>
              <span className="text-amber-700">75% SELESAI</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-slate-100 overflow-hidden border border-slate-200/50">
              <div className="h-full bg-amber-500 rounded-full transition-all duration-500 animate-pulse" style={{ width: '75%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Planned Features List (Roadmap) */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-500">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider">Syahriah Elektronik</h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Penetapan tarif bulanan santri secara dinamis, laporan tunggakan otomatis, serta rekapitulasi data pembayaran digital.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            Dalam Antrean
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider">Notifikasi WhatsApp</h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Kirim pengingat tagihan bulanan langsung ke WhatsApp wali santri hanya dengan satu klik konfirmasi.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-ping" />
            Sedang Pengkodean
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm space-y-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider">Arus Kas Pesantren</h3>
            <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
              Modul pelaporan pemasukan dan pengeluaran operasional pondok yang transparan dan akuntabel.
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-600">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Desain Siap
          </div>
        </div>
      </div>
    </div>
  );
}
