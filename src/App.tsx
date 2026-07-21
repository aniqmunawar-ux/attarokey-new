import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Home, FileText, GraduationCap, Users, Shield } from 'lucide-react';
import Header from './components/Header';
import Drawer from './components/Drawer';
import Sidebar from './components/Sidebar';
import HelpModal from './components/HelpModal';
import { fetchTableData, insertTableRow, insertTableRows, updateTableRow, deleteTableRow } from './lib/api';

// Views
import HomeView from './components/HomeView';
import SekretarisView from './components/SekretarisView';
import BendaharaView from './components/BendaharaView';
import PendidikanView from './components/PendidikanView';
import HumasyView from './components/HumasyView';
import KeamananView from './components/KeamananView';
import PengaturanView from './components/PengaturanView';
import LoginView from './components/LoginView';

// Initial Mock Data
import { 
  INITIAL_SANTRI, 
  INITIAL_BENDAHARA, 
  INITIAL_KEAMANAN, 
  INITIAL_HUMAS, 
  INITIAL_PENDIDIKAN 
} from './data';

import { 
  Santri, 
  BendaharaRecord, 
  KeamananRecord, 
  HumasAgenda, 
  KelasPendidikan 
} from './types';
import { DEFAULT_ROLES, fetchAndSyncPermissionsFromSupabase } from './lib/permissions';

export default function App() {
  // Initialize default roles permissions and fetch latest in real-time from Supabase
  React.useEffect(() => {
    if (!localStorage.getItem('smartsantri_roles_permissions')) {
      try {
        localStorage.setItem('smartsantri_roles_permissions', JSON.stringify(DEFAULT_ROLES));
      } catch (e) {
        console.error(e);
      }
    }
    
    // Background sync on app load to ensure permissions are always up to date in real-time
    fetchAndSyncPermissionsFromSupabase().catch(err => {
      console.warn("Gagal sinkronisasi hak akses background dari Supabase:", err);
    });
  }, []);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem('smartsantri_is_logged_in') === 'true';
  });

  // Navigation
  const [activeModule, setActiveModule] = useState<string>('home');

  const [activeSubTab, setActiveSubTab] = useState<string>('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);

  const handleChangeModule = (mod: string, subTab?: string) => {
    if (isSelectionMode) return;
    setActiveModule(mod);
    if (subTab) {
      setActiveSubTab(subTab);
    } else {
      switch (mod) {
        case 'home':
          setActiveSubTab('dashboard');
          break;
        case 'sekretaris':
          setActiveSubTab('santri');
          break;
        case 'bendahara':
          setActiveSubTab('');
          break;
        case 'pendidikan':
          setActiveSubTab('lembaga');
          break;
        case 'humasy':
          setActiveSubTab('kamar');
          break;
        case 'keamanan':
          setActiveSubTab('overview');
          break;
        case 'pengaturan':
          setActiveSubTab('akses');
          break;
        default:
          setActiveSubTab('');
          break;
      }
    }
  };

  // Unified States for Pesantren Records with localStorage persistence
  const [santriList, setSantriList] = useState<Santri[]>(() => {
    const local = localStorage.getItem('smartsantri_santriList');
    if (local) {
      try {
        const parsed: Santri[] = JSON.parse(local);
        return parsed.map(s => {
          let updated = { ...s };
          if (s.kelas === 'VII Tsanawiyah A') {
            updated.kelas = 'Tanpa Kelas';
          }
          if (s.kamar === 'Al-Ghazali 01' || s.kamar === 'Al Ghazali 01') {
            updated.kamar = 'Tanpa Kamar';
          }
          return updated;
        });
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [bendaharaList, setBendaharaList] = useState<BendaharaRecord[]>(() => {
    try {
      const local = localStorage.getItem('smartsantri_bendaharaList');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      console.error("Gagal membaca data bendahara dari localStorage:", e);
      return [];
    }
  });
  const [keamananList, setKeamananList] = useState<KeamananRecord[]>(() => {
    try {
      const local = localStorage.getItem('smartsantri_keamananList');
      return local ? JSON.parse(local) : [];
    } catch (e) {
      console.error("Gagal membaca data keamanan dari localStorage:", e);
      return [];
    }
  });
  const [humasList, setHumasList] = useState<HumasAgenda[]>([]);
  const [pendidikanList, setPendidikanList] = useState<KelasPendidikan[]>([]);
  
  // Track newly added or modified santri to prevent polling from overwriting them while async requests are pending
  const pendingOperations = React.useRef<Map<string, { data: Santri; timestamp: number }>>(new Map());
 
  // On mount, load data from Supabase with localStorage fallback and set up automatic background polling
  React.useEffect(() => {
    const loadAllData = () => {
      fetchTableData<Santri>('santri', 'smartsantri_santriList', [])
        .then(list => {
          let hasDummy = false;
          const cleaned = list.map(s => {
            let updated = { ...s };
            // Ensure statusKeanggotaan is always set
            const unifiedStatus = s.statusKeanggotaan || (s as any).status || 'Aktif';
            updated.statusKeanggotaan = unifiedStatus as any;

            if (s.kelas === 'VII Tsanawiyah A') {
              hasDummy = true;
              updated.kelas = 'Tanpa Kelas';
            }
            if (s.kamar === 'Al-Ghazali 01' || s.kamar === 'Al Ghazali 01') {
              hasDummy = true;
              updated.kamar = 'Tanpa Kamar';
            }
            return updated;
          });

          setSantriList((prev) => {
            const now = Date.now();
            // Clean up operations older than 15 seconds
            for (const [id, op] of pendingOperations.current.entries()) {
              if (now - op.timestamp > 15000) {
                pendingOperations.current.delete(id);
              }
            }

            // Map server's cleaned list, overriding any items with active pending updates
            const updatedCleaned = cleaned.map(item => {
              const pending = pendingOperations.current.get(item.id);
              if (pending) {
                return pending.data;
              }
              return item;
            });

            // Find pending items that are not yet in the cleaned list (such as brand new ones)
            const brandNewPending = Array.from(pendingOperations.current.values())
              .filter((op: { data: Santri; timestamp: number }) => !cleaned.some(c => c.id === op.data.id))
              .map((op: { data: Santri; timestamp: number }) => op.data);

            return [...brandNewPending, ...updatedCleaned];
          });

          if (hasDummy) {
            localStorage.setItem('smartsantri_santriList', JSON.stringify(cleaned));
            list.forEach(async (s) => {
              if (s.kelas === 'VII Tsanawiyah A' || s.kamar === 'Al-Ghazali 01' || s.kamar === 'Al Ghazali 01') {
                try {
                  const updatedKamar = s.kamar === 'Al-Ghazali 01' || s.kamar === 'Al Ghazali 01' ? 'Tanpa Kamar' : s.kamar;
                  const updatedKelas = s.kelas === 'VII Tsanawiyah A' ? 'Tanpa Kelas' : s.kelas;
                  await updateTableRow('santri', 'smartsantri_santriList', s.id, { ...s, kelas: updatedKelas, kamar: updatedKamar });
                } catch (e) {
                  console.error('Failed to update dummy class/room in DB:', e);
                }
              }
            });
          }
        });
      fetchTableData<BendaharaRecord>('bendahara', 'smartsantri_bendaharaList', [])
        .then(setBendaharaList);
      fetchTableData<KeamananRecord>('keamanan', 'smartsantri_keamananList', [])
        .then(setKeamananList);
    };

    loadAllData();

    // Poll data every 4 seconds to provide a virtually instant, real-time feel while optimizing network/server requests
    const interval = setInterval(loadAllData, 4000);

    return () => clearInterval(interval);
  }, []);

  // Sync state to localStorage
  React.useEffect(() => {
    localStorage.setItem('smartsantri_santriList', JSON.stringify(santriList));
  }, [santriList]);

  React.useEffect(() => {
    localStorage.setItem('smartsantri_bendaharaList', JSON.stringify(bendaharaList));
  }, [bendaharaList]);

  React.useEffect(() => {
    localStorage.setItem('smartsantri_keamananList', JSON.stringify(keamananList));
  }, [keamananList]);

  // Route newly logged-in users to their corresponding view immediately
  React.useEffect(() => {
    if (isLoggedIn) {
      setActiveModule('home');
      setActiveSubTab('dashboard');
    }
  }, [isLoggedIn]);

  // Handle resetting all local data
  const handleResetAllLocalData = () => {
    localStorage.removeItem('smartsantri_santriList');
    localStorage.removeItem('smartsantri_bendaharaList');
    localStorage.removeItem('smartsantri_keamananList');
    localStorage.removeItem('smartsantri_kompleks');
    localStorage.removeItem('smartsantri_kamar');
    localStorage.removeItem('smartsantri_rombel_assignments');
    localStorage.removeItem('smartsantri_lembaga_kelas');
    setSantriList([]);
    setBendaharaList([]);
    setKeamananList([]);
    setHumasList([]);
    setPendidikanList([]);
  };

  // Administrative handlers passed down as props
  const handleAddSantri = async (newSantri: Santri) => {
    // 1. Fetch the absolute latest list of santri from the database to detect any extremely recent additions
    let latestList: Santri[] = [];
    try {
      latestList = await fetchTableData<Santri>('santri', 'smartsantri_santriList', []);
    } catch (e) {
      console.warn("Gagal fetch data santri terbaru sebelum simpan:", e);
      latestList = santriList;
    }

    let finalSantri = { ...newSantri };

    // 2. If finalSantri has a NIS, check if that NIS already exists in the absolute latest database list
    if (finalSantri.nis && finalSantri.nis.trim() !== "") {
      const activeNis = finalSantri.nis.trim();
      const isConflicting = latestList.some(s => s.nis && s.nis.trim() === activeNis && s.id !== finalSantri.id);
      
      if (isConflicting) {
        // High-precision dynamic generation of the next sequence on the fly!
        const entryYear = finalSantri.tanggalMasuk ? finalSantri.tanggalMasuk.split('-')[0] : new Date().getFullYear().toString();
        const prefix = entryYear; // 4 digits year, e.g. '2026'
        
        // Find all NIS already present in the latest database list starting with this prefix
        const allocatedNisSet = new Set<string>();
        latestList.forEach(s => {
          if (s.nis && s.nis.trim() !== "") {
            allocatedNisSet.add(s.nis.trim());
          }
        });

        let nextSeq = 1;
        while (true) {
          const candidate = `${prefix}${String(nextSeq).padStart(3, '0')}`;
          if (!allocatedNisSet.has(candidate)) {
            finalSantri.nis = candidate;
            break;
          }
          nextSeq++;
        }
        
        console.warn(`Deteksi tabrakan NIS! NIS ${activeNis} dialihkan menjadi ${finalSantri.nis}.`);
        // Store a collision toast message in localStorage for SekretarisView to display
        localStorage.setItem(
          'smartsantri_nis_conflict_toast', 
          `Tabrakan NIS Teratasi: NIS ${activeNis} baru saja digunakan oleh admin lain. Data disimpan dengan NIS unik baru ${finalSantri.nis} secara aman.`
        );
      }
    }

    // Update state first with the final sanitized santri details
    pendingOperations.current.set(finalSantri.id, { data: finalSantri, timestamp: Date.now() });
    setSantriList((prev) => [finalSantri, ...prev.filter(x => x.id !== finalSantri.id)]);
    
    // Commit to database
    try {
      const saved = await insertTableRow('santri', 'smartsantri_santriList', finalSantri);
      const savedUnifiedStatus = saved.statusKeanggotaan || (saved as any).status || finalSantri.statusKeanggotaan || 'Aktif';
      saved.statusKeanggotaan = savedUnifiedStatus;
      pendingOperations.current.delete(finalSantri.id);
      setSantriList((prev) => prev.map(s => s.id === finalSantri.id ? saved : s));
    } catch (dbErr: any) {
      pendingOperations.current.delete(finalSantri.id);
      console.error("Gagal melakukan insert ke database:", dbErr);
      // Re-fetch latest list to ensure correct state in case of failure
      fetchTableData<Santri>('santri', 'smartsantri_santriList', []).then(setSantriList);
      throw dbErr;
    }
  };

  const handleBulkAddSantri = async (newSantriList: Santri[]) => {
    setSantriList((prev) => [...newSantriList, ...prev]);
    await insertTableRows('santri', 'smartsantri_santriList', newSantriList);
  };

  const handleUpdateSantri = async (updatedSantri: Santri) => {
    let processed = { ...updatedSantri };
    
    // Check if status is updated to Alumni
    const isNowAlumni = updatedSantri.statusKeanggotaan === 'Alumni';
    if (isNowAlumni) {
      processed.statusKeanggotaan = 'Alumni';
      processed.kelas = '';
      processed.kamar = '';
      processed.nomorLemari = '';

      // Also automatically remove from all rombel assignments in localStorage!
      const localAssignments = localStorage.getItem('smartsantri_rombel_assignments');
      if (localAssignments) {
        try {
          const parsed = JSON.parse(localAssignments);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter((a: any) => a.santriId !== updatedSantri.id);
            localStorage.setItem('smartsantri_rombel_assignments', JSON.stringify(filtered));
          }
        } catch (e) {
          console.error("Error updating rombel assignments on alumni status change:", e);
        }
      }
    }

    pendingOperations.current.set(processed.id, { data: processed, timestamp: Date.now() });
    setSantriList((prev) => prev.map((s) => s.id === processed.id ? processed : s));
    
    try {
      const saved = await updateTableRow('santri', 'smartsantri_santriList', processed.id, processed);
      const savedUnifiedStatus = saved.statusKeanggotaan || (saved as any).status || processed.statusKeanggotaan || 'Aktif';
      saved.statusKeanggotaan = savedUnifiedStatus;
      pendingOperations.current.delete(processed.id);
      setSantriList((prev) => prev.map(s => s.id === processed.id ? saved : s));
    } catch (dbErr: any) {
      pendingOperations.current.delete(processed.id);
      console.error("Gagal melakukan update ke database:", dbErr);
      // Re-fetch latest list to ensure correct state in case of failure
      fetchTableData<Santri>('santri', 'smartsantri_santriList', []).then(setSantriList);
      throw dbErr;
    }
  };

  const handleDeleteSantri = async (id: string) => {
    const santriToDelete = santriList.find((s) => s.id === id);
    if (!santriToDelete) {
      setSantriList((prev) => prev.filter((s) => s.id !== id));
      await deleteTableRow('santri', 'smartsantri_santriList', id);
      return;
    }

    const { nama: targetNama, id: targetId } = santriToDelete;

    // 1. Cascade delete in Keamanan (Riwayat Pelanggaran)
    const matchingKeamanan = keamananList.filter((k) => k.namaSantri === targetNama);
    if (matchingKeamanan.length > 0) {
      setKeamananList((prev) => prev.filter((k) => k.namaSantri !== targetNama));
      for (const rec of matchingKeamanan) {
        try {
          await deleteTableRow('keamanan', 'smartsantri_keamananList', rec.id);
        } catch (err) {
          console.error(`Error deleting keamanan record ${rec.id}:`, err);
        }
      }
    }

    // 2. Cascade delete in Bendahara (Keuangan / Pembayaran Bulanan)
    const matchingBendahara = bendaharaList.filter((b) => b.namaSantri === targetNama);
    if (matchingBendahara.length > 0) {
      setBendaharaList((prev) => prev.filter((b) => b.namaSantri !== targetNama));
      for (const rec of matchingBendahara) {
        try {
          await deleteTableRow('bendahara', 'smartsantri_bendaharaList', rec.id);
        } catch (err) {
          console.error(`Error deleting bendahara record ${rec.id}:`, err);
        }
      }
    }

    // 3. Cascade delete in Perizinan (Log Perizinan & Data Keluar Masuk)
    const localIzin = localStorage.getItem('smartsantri_perizinan');
    if (localIzin) {
      try {
        const parsed = JSON.parse(localIzin);
        if (Array.isArray(parsed)) {
          const matchingIzin = parsed.filter((p: any) => p.namaSantri === targetNama);
          const remainingIzin = parsed.filter((p: any) => p.namaSantri !== targetNama);
          localStorage.setItem('smartsantri_perizinan', JSON.stringify(remainingIzin));
          
          for (const rec of matchingIzin) {
            try {
              await deleteTableRow('perizinan', 'smartsantri_perizinan', rec.id);
            } catch (err) {
              console.error(`Error deleting perizinan record ${rec.id}:`, err);
            }
          }
        }
      } catch (e) {
        console.error("Error updating perizinan on santri delete:", e);
      }
    }

    // 4. Clean up Rombel Assignments in localStorage
    const localAssignments = localStorage.getItem('smartsantri_rombel_assignments');
    if (localAssignments) {
      try {
        const parsed = JSON.parse(localAssignments);
        if (Array.isArray(parsed)) {
          const remainingAssignments = parsed.filter((a: any) => a.santriId !== targetId);
          localStorage.setItem('smartsantri_rombel_assignments', JSON.stringify(remainingAssignments));
        }
      } catch (e) {
        console.error("Error updating rombel assignments on santri delete:", e);
      }
    }

    // 5. Clean up Kamar (if the deleted santri is ketua kamar)
    const localKamar = localStorage.getItem('smartsantri_kamar');
    if (localKamar) {
      try {
        const parsed = JSON.parse(localKamar);
        if (Array.isArray(parsed)) {
          let updated = false;
          const mappedKamar = parsed.map((k: any) => {
            if (k.ketuaKamar === targetNama) {
              updated = true;
              return { ...k, ketuaKamar: "" };
            }
            return k;
          });
          if (updated) {
            localStorage.setItem('smartsantri_kamar', JSON.stringify(mappedKamar));
            // Update in Supabase for each updated kamar
            const updatedKamars = mappedKamar.filter((k: any, idx: number) => parsed[idx].ketuaKamar === targetNama);
            for (const k of updatedKamars) {
              try {
                await updateTableRow('kamar', 'smartsantri_kamar', k.id, k);
              } catch (err) {
                console.error(`Error updating kamar ${k.id} on santri delete:`, err);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error updating kamar on santri delete:", e);
      }
    }

    // 6. Delete the Santri itself
    setSantriList((prev) => prev.filter((s) => s.id !== id));
    await deleteTableRow('santri', 'smartsantri_santriList', id);
  };

  const handleToggleBendahara = async (id: string) => {
    let targetRec = bendaharaList.find((r) => r.id === id);
    if (!targetRec) return;

    const isLunasNow = targetRec.status === 'Belum Lunas';
    const updated = {
      ...targetRec,
      status: isLunasNow ? 'Lunas' : 'Belum Lunas',
      tanggalBayar: isLunasNow ? new Date().toISOString().split('T')[0] : undefined
    };

    setBendaharaList((prev) => 
      prev.map((rec) => (rec.id === id ? updated : rec))
    );

    await updateTableRow<BendaharaRecord>('bendahara', 'smartsantri_bendaharaList', id, {
      status: updated.status,
      tanggalBayar: updated.tanggalBayar
    });
  };

  const handleAddKeamanan = async (newRec: KeamananRecord) => {
    setKeamananList((prev) => [newRec, ...prev]);
    await insertTableRow('keamanan', 'smartsantri_keamananList', newRec);
  };

  const handleDeleteKeamanan = async (id: string) => {
    setKeamananList((prev) => prev.filter((item) => item.id !== id));
    await deleteTableRow('keamanan', 'smartsantri_keamananList', id);
  };

  // Helper to render current screen
  const renderView = () => {
    switch (activeModule) {
      case 'home':
        return (
          <HomeView
            santriList={santriList}
            keamananList={keamananList}
            bendaharaList={bendaharaList}
            onChangeModule={handleChangeModule}
            onResetAllLocalData={handleResetAllLocalData}
          />
        );
      case 'sekretaris':
        return (
          <SekretarisView
            santriList={santriList}
            onAddSantri={handleAddSantri}
            onBulkAddSantri={handleBulkAddSantri}
            onUpdateSantri={handleUpdateSantri}
            onDeleteSantri={handleDeleteSantri}
            initialSubTab={activeSubTab as any}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
          />
        );
      case 'bendahara':
        return (
          <BendaharaView
            bendaharaList={bendaharaList}
            onToggleStatus={handleToggleBendahara}
          />
        );
      case 'pendidikan':
        return (
          <PendidikanView
            pendidikanList={pendidikanList}
            santriList={santriList}
            onUpdateSantri={handleUpdateSantri}
            setSantriList={setSantriList}
            activeSubTab={activeSubTab}
            onChangeSubTab={setActiveSubTab}
          />
        );
      case 'humasy':
        return (
          <HumasyView
            humasList={humasList}
            santriList={santriList}
            onUpdateSantri={handleUpdateSantri}
            setSantriList={setSantriList}
            activeSubTab={activeSubTab}
            onChangeSubTab={setActiveSubTab}
            isSelectionMode={isSelectionMode}
            setIsSelectionMode={setIsSelectionMode}
          />
        );
      case 'keamanan':
        return (
          <KeamananView
            keamananList={keamananList}
            onAddKeamanan={handleAddKeamanan}
            onDeleteKeamanan={handleDeleteKeamanan}
            santriList={santriList}
            activeSubTab={activeSubTab}
            onChangeSubTab={setActiveSubTab}
          />
        );
      case 'pengaturan':
        return (
          <PengaturanView 
            activeCategory={activeSubTab as any} 
            setActiveCategory={setActiveSubTab as any} 
          />
        );
      default:
        return (
          <HomeView
            santriList={santriList}
            keamananList={keamananList}
            bendaharaList={bendaharaList}
            onChangeModule={handleChangeModule}
            onResetAllLocalData={handleResetAllLocalData}
          />
        );
    }
  };

  if (!isLoggedIn) {
    return <LoginView onLoginSuccess={() => setIsLoggedIn(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 antialiased flex flex-row selection:bg-emerald-200 selection:text-emerald-950">
      
      {/* Sidebar - Persistent floating sidebar on desktop, hidden on mobile */}
      <Sidebar 
        activeModule={activeModule}
        activeSubTab={activeSubTab}
        onChangeModule={handleChangeModule}
        isSelectionMode={isSelectionMode}
        onLogout={() => setIsLoggedIn(false)}
        onOpenHelp={() => setShowHelpModal(true)}
      />

      {/* Main Container */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0">
        
        {/* Upper Navigation Header bar */}
        <Header 
          activeModule={activeModule}
          activeSubTab={activeSubTab}
          onOpenDrawer={() => setIsDrawerOpen(true)}
        />

        {/* Main Drawer Container (Mobile Menu) */}
        <Drawer
          isOpen={isDrawerOpen}
          onClose={() => setIsDrawerOpen(false)}
          activeModule={activeModule}
          activeSubTab={activeSubTab}
          onChangeModule={handleChangeModule}
          isSelectionMode={isSelectionMode}
          onLogout={() => setIsLoggedIn(false)}
          onOpenHelp={() => setShowHelpModal(true)}
        />

        {/* Global Help Modal */}
        <HelpModal 
          isOpen={showHelpModal} 
          onClose={() => setShowHelpModal(false)} 
        />

        {/* Main Responsive Content Zone */}
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-6 pb-6 sm:px-6 lg:px-8 focus:outline-none">
          
          {/* Animated slide transitions for active module view */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeModule}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>

        </main>

        {/* Modern minimal footer */}
        <footer className="w-full border-t border-slate-200/60 bg-white py-5 text-center mt-12 hidden md:block">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-slate-400 text-xs font-semibold">
            <p>© 2026 AttarOkey 4.0. Hak Cipta Dilindungi Pengurus Pesantren.</p>
            <div className="flex gap-4">
              <span className="text-emerald-700">Tepat • Cepat • Teratur</span>
              <span>v1.2.0 Stable</span>
            </div>
          </div>
        </footer>

      </div>

    </div>
  );
}
