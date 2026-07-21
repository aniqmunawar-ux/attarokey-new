import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  School, Users, GraduationCap, Compass, LayoutGrid, BookOpen, AlertTriangle, CheckCircle2, Trophy, ArrowRight,
  Sparkles, ChevronRight, ClipboardCheck, Award, Activity
} from 'lucide-react';
import { 
  Lembaga, Kelas, KategoriRombel, KelompokRombel, RombelAssignment, Santri, KelasPendidikan 
} from '../types';
import { INITIAL_ASSIGNMENTS } from '../data';
import { DEFAULT_ROLES } from '../lib/permissions';

// Sub-modules
import LembagaKelasSub from './pendidikan/LembagaKelasSub';
import RombelSub from './pendidikan/RombelSub';
import DataAkademikSub from './pendidikan/DataAkademikSub';
import { fetchTableData, insertTableRow, updateTableRow, deleteTableRow, safeLocalStorageSetItem } from '../lib/api';

// Initial Mock Data matching SQL seeds
const INITIAL_LEMBAGA: Lembaga[] = [];

const INITIAL_KELAS: Kelas[] = [];

const INITIAL_ROMBEL_CAT: KategoriRombel[] = [];

const INITIAL_ROMBEL_GROUP: KelompokRombel[] = [];


interface PendidikanViewProps {
  pendidikanList: KelasPendidikan[]; // Compatible with original state but we focus on local, persistent, expanded models
  santriList: Santri[];
  onUpdateSantri: (updatedSantri: Santri) => void;
  setSantriList: React.Dispatch<React.SetStateAction<Santri[]>>;
  activeSubTab: string;
  onChangeSubTab: (tab: any) => void;
}

export default function PendidikanView({ 
  pendidikanList, 
  santriList, 
  onUpdateSantri,
  setSantriList,
  activeSubTab,
  onChangeSubTab
}: PendidikanViewProps) {
  
  // Load permissions from localStorage
  let canViewPutra = true;
  let canViewPutri = true;
  let canWritePutra = true;
  let canWritePutri = true;

  try {
    const activeRole = localStorage.getItem('smartsantri_active_role') || 'superadmin';
    if (activeRole !== 'superadmin') {
      const permissionsStr = localStorage.getItem('smartsantri_roles_permissions');
      let roleObj;
      if (permissionsStr) {
        try {
          const parsedRoles = JSON.parse(permissionsStr);
          roleObj = parsedRoles.find((r: any) => r.id === activeRole);
        } catch (e) {
          console.error(e);
        }
      }
      if (!roleObj) {
        roleObj = DEFAULT_ROLES.find((r: any) => r.id === activeRole);
      }

      if (roleObj && roleObj.permissions) {
        canViewPutra = !!roleObj.permissions['pendidikan_putra.view'];
        canViewPutri = !!roleObj.permissions['pendidikan_putri.view'];
        canWritePutra = !!roleObj.permissions['pendidikan_putra.write'];
        canWritePutri = !!roleObj.permissions['pendidikan_putri.write'];
      } else {
        canViewPutra = false;
        canViewPutri = false;
        canWritePutra = false;
        canWritePutri = false;
      }
    }
  } catch (e) {
    console.error('Error parsing permissions in PendidikanView:', e);
  }

  const [genderFilter, setGenderFilter] = useState<'Putra' | 'Putri'>(() => {
    let defaultGender: 'Putra' | 'Putri' = 'Putra';
    try {
      const activeRole = localStorage.getItem('smartsantri_active_role') || 'superadmin';
      if (activeRole !== 'superadmin') {
        const permissionsStr = localStorage.getItem('smartsantri_roles_permissions');
        let roleObj;
        if (permissionsStr) {
          try {
            const parsedRoles = JSON.parse(permissionsStr);
            roleObj = parsedRoles.find((r: any) => r.id === activeRole);
          } catch (e) {
            console.error(e);
          }
        }
        if (roleObj && roleObj.permissions) {
          const cvPutra = !!roleObj.permissions['pendidikan_putra.view'];
          const cvPutri = !!roleObj.permissions['pendidikan_putri.view'];
          if (!cvPutra && cvPutri) {
            defaultGender = 'Putri';
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    return defaultGender;
  });
  
  // --- PERSISTENT DATA STATE MANAGERS ---
  const [lembagasList, setLembagasList] = useState<Lembaga[]>(() => {
    const local = localStorage.getItem('smartsantri_lembagas');
    const raw: Lembaga[] = local ? JSON.parse(local) : INITIAL_LEMBAGA;
    const seenIds = new Set<string>();
    let hasDuplicates = false;
    const sanitized = raw.map((l, idx) => {
      if (!l.id || seenIds.has(l.id)) {
        hasDuplicates = true;
        const newId = `L${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
        return { ...l, id: newId };
      }
      seenIds.add(l.id);
      return l;
    });

    const parsedLems = sanitized.map(l => {
      if (l.deskripsi) {
        const match = l.deskripsi.match(/\[TA_META:(.*?)\]/);
        if (match) {
          try {
            const meta = JSON.parse(match[1]);
            return {
              ...l,
              taMulaiTanggal: l.taMulaiTanggal !== undefined ? l.taMulaiTanggal : meta.taMulaiTanggal,
              taMulaiBulan: l.taMulaiBulan !== undefined ? l.taMulaiBulan : meta.taMulaiBulan,
              taSelesaiTanggal: l.taSelesaiTanggal !== undefined ? l.taSelesaiTanggal : meta.taSelesaiTanggal,
              taSelesaiBulan: l.taSelesaiBulan !== undefined ? l.taSelesaiBulan : meta.taSelesaiBulan,
              deskripsi: l.deskripsi.replace(/\[TA_META:.*?\]/g, "").trim()
            };
          } catch (e) {}
        }
      }
      return l;
    });

    if (hasDuplicates) {
      localStorage.setItem('smartsantri_lembagas', JSON.stringify(parsedLems));
    }
    return parsedLems;
  });

  const deserializeKelas = (k: Kelas): Kelas => {
    if (k && k.waliKelas) {
      const match = k.waliKelas.match(/\[KELAS_META:(.*?)\]/);
      if (match) {
        try {
          const meta = JSON.parse(match[1]);
          return {
            ...k,
            tingkatan: k.tingkatan !== undefined ? k.tingkatan : meta.tingkatan,
            kapasitas: k.kapasitas !== undefined ? k.kapasitas : meta.kapasitas,
            batasUsiaHari: k.batasUsiaHari !== undefined ? k.batasUsiaHari : meta.batasUsiaHari,
            batasUsiaBulan: k.batasUsiaBulan !== undefined ? k.batasUsiaBulan : meta.batasUsiaBulan,
            batasUsiaUmurMin: k.batasUsiaUmurMin !== undefined ? k.batasUsiaUmurMin : meta.batasUsiaUmurMin,
            batasUsiaUmurMax: k.batasUsiaUmurMax !== undefined ? k.batasUsiaUmurMax : meta.batasUsiaUmurMax,
            waliKelas: k.waliKelas.replace(/\[KELAS_META:.*?\]/g, "").trim()
          };
        } catch (e) {}
      }
    }
    return k;
  };

  const serializeKelas = (k: Kelas): Kelas => {
    const meta = {
      tingkatan: k.tingkatan,
      kapasitas: k.kapasitas,
      batasUsiaHari: k.batasUsiaHari,
      batasUsiaBulan: k.batasUsiaBulan,
      batasUsiaUmurMin: k.batasUsiaUmurMin,
      batasUsiaUmurMax: k.batasUsiaUmurMax
    };
    const cleanWali = (k.waliKelas || "").replace(/\[KELAS_META:.*?\]/g, "").trim();
    return {
      ...k,
      waliKelas: `${cleanWali} [KELAS_META:${JSON.stringify(meta)}]`.trim()
    };
  };

  const [kelasList, setKelasList] = useState<Kelas[]>(() => {
    const local = localStorage.getItem('smartsantri_kelas');
    const raw: Kelas[] = local ? JSON.parse(local) : INITIAL_KELAS;
    const seenIds = new Set<string>();
    let hasDuplicates = false;
    const sanitized = raw.map((c, idx) => {
      if (!c.id || seenIds.has(c.id)) {
        hasDuplicates = true;
        const newId = `K${Date.now()}-${idx}-${Math.floor(Math.random() * 1000)}`;
        return deserializeKelas({ ...c, id: newId });
      }
      seenIds.add(c.id);
      return deserializeKelas(c);
    });
    if (hasDuplicates) {
      localStorage.setItem('smartsantri_kelas', JSON.stringify(sanitized));
    }
    return sanitized;
  });

  const [categoriesList, setCategoriesList] = useState<KategoriRombel[]>(() => {
    const local = localStorage.getItem('smartsantri_rombel_categories');
    return local ? JSON.parse(local) : INITIAL_ROMBEL_CAT;
  });

  const [groupsList, setGroupsList] = useState<KelompokRombel[]>(() => {
    const local = localStorage.getItem('smartsantri_rombel_groups');
    return local ? JSON.parse(local) : INITIAL_ROMBEL_GROUP;
  });

  const [assignmentsList, setAssignmentsList] = useState<RombelAssignment[]>(() => {
    const local = localStorage.getItem('smartsantri_rombel_assignments');
    return local ? JSON.parse(local) : INITIAL_ASSIGNMENTS;
  });

  const [lembagaActiveTab, setLembagaActiveTab] = useState<'Formal' | 'Internal' | 'Rombel'>('Formal');

  // Fetch education records from Supabase / Local fallback on mount with automatic background polling and de-duplication
  useEffect(() => {
    const loadEducationData = async () => {
      try {
        const lemData = await fetchTableData<Lembaga>('lembaga', 'smartsantri_lembagas', INITIAL_LEMBAGA);
        const uniqueLems = lemData.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
        
        const processedLems = uniqueLems.map(l => {
          if (l.deskripsi) {
            const match = l.deskripsi.match(/\[TA_META:(.*?)\]/);
            if (match) {
              try {
                const meta = JSON.parse(match[1]);
                return {
                  ...l,
                  taMulaiTanggal: l.taMulaiTanggal !== undefined ? l.taMulaiTanggal : meta.taMulaiTanggal,
                  taMulaiBulan: l.taMulaiBulan !== undefined ? l.taMulaiBulan : meta.taMulaiBulan,
                  taSelesaiTanggal: l.taSelesaiTanggal !== undefined ? l.taSelesaiTanggal : meta.taSelesaiTanggal,
                  taSelesaiBulan: l.taSelesaiBulan !== undefined ? l.taSelesaiBulan : meta.taSelesaiBulan,
                  deskripsi: l.deskripsi.replace(/\[TA_META:.*?\]/g, "").trim()
                };
              } catch (e) {}
            }
          }
          return l;
        });

        setLembagasList(processedLems);

        const kelData = await fetchTableData<Kelas>('kelas', 'smartsantri_kelas', INITIAL_KELAS);
        const uniqueKels = kelData.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx).map(deserializeKelas);

        // De-duplicate "Calon Pelajar" immediately to prevent duplicate default classes
        const seenCalonPelajarLembagas = new Set<string>();
        const deDuplicatedKels: Kelas[] = [];
        const duplicatesToDelete: string[] = [];

        for (const k of uniqueKels) {
          if (k.nama.toLowerCase() === 'calon pelajar') {
            if (!seenCalonPelajarLembagas.has(k.lembagaId)) {
              seenCalonPelajarLembagas.add(k.lembagaId);
              deDuplicatedKels.push(k);
            } else {
              duplicatesToDelete.push(k.id);
            }
          } else {
            deDuplicatedKels.push(k);
          }
        }

        // Asynchronously delete duplicate Calon Pelajar classes from persistent storage
        for (const dupId of duplicatesToDelete) {
          console.log(`Self-healing: Deleting duplicate Calon Pelajar class with ID: ${dupId}`);
          deleteTableRow('kelas', 'smartsantri_kelas', dupId);
        }

        let updatedKels = [...deDuplicatedKels];
        let hasHealed = false;

        for (const lem of uniqueLems) {
          const hasDefaultClass = deDuplicatedKels.some(k => k.lembagaId === lem.id && k.nama.toLowerCase() === 'calon pelajar');
          if (!hasDefaultClass) {
            console.log(`Self-healing: Creating missing default class 'Calon Pelajar' for lembaga ${lem.nama} (${lem.id})`);
            const defaultClassPayload: Kelas = {
              id: 'K-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '-default',
              lembagaId: lem.id,
              nama: 'Calon Pelajar',
              waliKelas: '-',
              tingkatan: 'Lainnya',
            };
            try {
              const savedClass = await insertTableRow('kelas', 'smartsantri_kelas', serializeKelas(defaultClassPayload));
              updatedKels.push(deserializeKelas(savedClass));
              hasHealed = true;
            } catch (err) {
              console.error(`Failed self-healing default class for ${lem.nama}:`, err);
            }
          }
        }

        setKelasList(updatedKels);

        fetchTableData<KategoriRombel>('kategori_rombel', 'smartsantri_rombel_categories', INITIAL_ROMBEL_CAT)
          .then(data => {
            const unique = data.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
            setCategoriesList(unique);
          });
        fetchTableData<KelompokRombel>('kelompok_rombel', 'smartsantri_rombel_groups', INITIAL_ROMBEL_GROUP)
          .then(data => {
            const unique = data.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
            setGroupsList(unique);
          });
        fetchTableData<RombelAssignment>('rombel_assignment', 'smartsantri_rombel_assignments', INITIAL_ASSIGNMENTS)
          .then(setAssignmentsList);

      } catch (err) {
        console.error("Error loading education data:", err);
      }
    };

    loadEducationData();

    // Poll education tables every 10 seconds to sync multi-device modifications
    const interval = setInterval(loadEducationData, 10000);

    return () => clearInterval(interval);
  }, []);

  // Backup state changes to localStorage safely
  useEffect(() => {
    safeLocalStorageSetItem('smartsantri_lembagas', JSON.stringify(lembagasList));
  }, [lembagasList]);

  useEffect(() => {
    safeLocalStorageSetItem('smartsantri_kelas', JSON.stringify(kelasList));
  }, [kelasList]);

  useEffect(() => {
    safeLocalStorageSetItem('smartsantri_rombel_categories', JSON.stringify(categoriesList));
  }, [categoriesList]);

  useEffect(() => {
    safeLocalStorageSetItem('smartsantri_rombel_groups', JSON.stringify(groupsList));
  }, [groupsList]);

  useEffect(() => {
    safeLocalStorageSetItem('smartsantri_rombel_assignments', JSON.stringify(assignmentsList));
  }, [assignmentsList]);


  // --- ACADEMIC STATE HANDLERS ---
  // 1. LEMBAGA CALLBACKS
  const handleAddLembaga = async (newLem: Lembaga) => {
    const meta = {
      taMulaiTanggal: newLem.taMulaiTanggal,
      taMulaiBulan: newLem.taMulaiBulan,
      taSelesaiTanggal: newLem.taSelesaiTanggal,
      taSelesaiBulan: newLem.taSelesaiBulan
    };
    const cleanDeskripsi = (newLem.deskripsi || "").replace(/\[TA_META:.*?\]/g, "").trim();
    const serializedDeskripsi = `${cleanDeskripsi}\n\n[TA_META:${JSON.stringify(meta)}]`.trim();
    
    const dbPayload = {
      ...newLem,
      deskripsi: serializedDeskripsi
    };

    const saved = await insertTableRow('lembaga', 'smartsantri_lembagas', dbPayload);
    
    const processedSaved = {
      ...saved,
      taMulaiTanggal: saved.taMulaiTanggal !== undefined ? saved.taMulaiTanggal : newLem.taMulaiTanggal,
      taMulaiBulan: saved.taMulaiBulan !== undefined ? saved.taMulaiBulan : newLem.taMulaiBulan,
      taSelesaiTanggal: saved.taSelesaiTanggal !== undefined ? saved.taSelesaiTanggal : newLem.taSelesaiTanggal,
      taSelesaiBulan: saved.taSelesaiBulan !== undefined ? saved.taSelesaiBulan : newLem.taSelesaiBulan,
      deskripsi: cleanDeskripsi
    };

    setLembagasList(prev => {
      if (prev.some(l => l.id === processedSaved.id)) return prev;
      return [...prev, processedSaved];
    });
    return processedSaved;
  };

  const handleUpdateLembaga = async (upLem: Lembaga) => {
    const meta = {
      taMulaiTanggal: upLem.taMulaiTanggal,
      taMulaiBulan: upLem.taMulaiBulan,
      taSelesaiTanggal: upLem.taSelesaiTanggal,
      taSelesaiBulan: upLem.taSelesaiBulan
    };
    const cleanDeskripsi = (upLem.deskripsi || "").replace(/\[TA_META:.*?\]/g, "").trim();
    const serializedDeskripsi = `${cleanDeskripsi}\n\n[TA_META:${JSON.stringify(meta)}]`.trim();

    const dbPayload = {
      ...upLem,
      deskripsi: serializedDeskripsi
    };

    setLembagasList(prev => prev.map(l => l.id === upLem.id ? { ...upLem, deskripsi: cleanDeskripsi } : l));
    await updateTableRow('lembaga', 'smartsantri_lembagas', upLem.id, dbPayload);
  };

  const handleDeleteLembaga = async (id: string) => {
    setLembagasList(prev => prev.filter(l => l.id !== id));
    // Cascade delete classes under this institution in state
    setKelasList(prev => prev.filter(c => c.lembagaId !== id));
    await deleteTableRow('lembaga', 'smartsantri_lembagas', id);
  };

  // 2. KELAS CALLBACKS
  const handleAddKelas = async (newKel: Kelas) => {
    const serialized = serializeKelas(newKel);
    const saved = await insertTableRow('kelas', 'smartsantri_kelas', serialized);
    const deserialized = deserializeKelas(saved);
    setKelasList(prev => {
      if (prev.some(c => c.id === deserialized.id)) return prev;
      return [...prev, deserialized];
    });
    return deserialized;
  };

  const handleUpdateKelas = async (upKel: Kelas) => {
    setKelasList(prev => prev.map(c => c.id === upKel.id ? upKel : c));
    const serialized = serializeKelas(upKel);
    await updateTableRow('kelas', 'smartsantri_kelas', upKel.id, serialized);
  };

  const handleDeleteKelas = async (id: string) => {
    setKelasList(prev => prev.filter(c => c.id !== id));
    await deleteTableRow('kelas', 'smartsantri_kelas', id);
  };

  const handleResetAllClasses = async () => {
    const keepClasses: Kelas[] = [];
    const deleteIds: string[] = [];
    
    for (const lem of lembagasList) {
      const lemClasses = kelasList.filter(k => k.lembagaId === lem.id);
      const defaultClass = lemClasses.find(k => k.nama.toLowerCase() === 'calon pelajar');
      
      if (defaultClass) {
        keepClasses.push(defaultClass);
        lemClasses.forEach(k => {
          if (k.id !== defaultClass.id) {
            deleteIds.push(k.id);
          }
        });
      } else {
        const defaultClassPayload: Kelas = {
          id: 'K-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7) + '-default',
          lembagaId: lem.id,
          nama: 'Calon Pelajar',
          waliKelas: '-',
          tingkatan: 'Lainnya',
        };
        try {
          const saved = await insertTableRow('kelas', 'smartsantri_kelas', defaultClassPayload);
          keepClasses.push(saved);
        } catch (e) {
          console.error('Error creating default class during reset:', e);
        }
      }
    }
    
    const orphans = kelasList.filter(k => !lembagasList.some(l => l.id === k.lembagaId));
    orphans.forEach(k => deleteIds.push(k.id));
    
    for (const id of deleteIds) {
      await deleteTableRow('kelas', 'smartsantri_kelas', id);
    }
    
    setKelasList(keepClasses);
  };

  // 3. ROMBEL CATEGORY CALLBACKS
  const handleAddCategory = async (newCat: KategoriRombel) => {
    const saved = await insertTableRow('kategori_rombel', 'smartsantri_rombel_categories', newCat);
    setCategoriesList(prev => {
      if (prev.some(c => c.id === saved.id)) return prev;
      return [...prev, saved];
    });
  };

  const handleUpdateCategory = async (upCat: KategoriRombel) => {
    setCategoriesList(prev => prev.map(c => c.id === upCat.id ? upCat : c));
    await updateTableRow('kategori_rombel', 'smartsantri_rombel_categories', upCat.id, upCat);
  };

  const handleDeleteCategory = async (id: string) => {
    setCategoriesList(prev => prev.filter(c => c.id !== id));
    // Cascade delete groups under this category
    const cascadingGroups = groupsList.filter(g => g.kategoriId === id).map(g => g.id);
    setGroupsList(prev => prev.filter(g => g.kategoriId !== id));
    // Cascade delete assignments for these groups
    setAssignmentsList(prev => prev.filter(a => !cascadingGroups.includes(a.kelompokId) && a.kategoriId !== id));
    await deleteTableRow('kategori_rombel', 'smartsantri_rombel_categories', id);
  };

  // 4. ROMBEL GROUP CALLBACKS
  const handleAddGroup = async (newGrp: KelompokRombel) => {
    const saved = await insertTableRow('kelompok_rombel', 'smartsantri_rombel_groups', newGrp);
    setGroupsList(prev => {
      if (prev.some(g => g.id === saved.id)) return prev;
      return [...prev, saved];
    });
  };

  const handleUpdateGroup = async (upGrp: KelompokRombel) => {
    setGroupsList(prev => prev.map(g => g.id === upGrp.id ? upGrp : g));
    await updateTableRow('kelompok_rombel', 'smartsantri_rombel_groups', upGrp.id, upGrp);
  };

  const handleDeleteGroup = async (id: string) => {
    setGroupsList(prev => prev.filter(g => g.id !== id));
    // Cascade delete assignments for this group
    setAssignmentsList(prev => prev.filter(a => a.kelompokId !== id));
    await deleteTableRow('kelompok_rombel', 'smartsantri_rombel_groups', id);
  };

  // 5. MEMBERSHIP MAPPING & ASSIGNMENTS CALLBACKS
  const handleUpdateSantriClass = (santriId: string, classText: string, lembagaId?: string) => {
    const target = santriList.find(s => s.id === santriId);
    if (target) {
      let currentClasses = target.kelas ? target.kelas.split(',').map(x => x.trim()).filter(Boolean) : [];
      currentClasses = currentClasses.filter(c => c.toLowerCase() !== 'tanpa kelas');
      
      if (classText === 'Tanpa Kelas') {
        if (lembagaId) {
          currentClasses = currentClasses.filter(cls => {
            const c = kelasList.find(x => x.nama.toLowerCase() === cls.toLowerCase() && x.lembagaId === lembagaId);
            return !c || c.lembagaId !== lembagaId;
          });
        } else {
          currentClasses = [];
        }
      } else {
        const targetClass = kelasList.find(c => 
          c.nama.toLowerCase() === classText.toLowerCase() && 
          (!lembagaId || c.lembagaId === lembagaId)
        );
        const targetLembagaId = targetClass?.lembagaId || lembagaId;
        
        if (targetLembagaId) {
          currentClasses = currentClasses.filter(cls => {
            const c = kelasList.find(x => 
              x.nama.toLowerCase() === cls.toLowerCase() && 
              x.lembagaId === targetLembagaId
            );
            return !c || c.lembagaId !== targetLembagaId;
          });
        }
        
        if (!currentClasses.some(cls => cls.toLowerCase() === classText.toLowerCase())) {
          currentClasses.push(classText);
        }
      }
      
      const finalKelasString = currentClasses.join(', ') || 'Tanpa Kelas';

      // Bi-directional synchronization: calculate pendidikanFormal and pendidikanInternal based on currentClasses
      const getLembagaJenis = (l: Lembaga): 'Formal' | 'Internal' => {
        if (l.jenis) return l.jenis;
        const lower = l.nama.toLowerCase();
        if (
          lower.includes('madin') || 
          lower.includes('diniyah') || 
          lower.includes('tpq') || 
          lower.includes('tahfidz') || 
          lower.includes('pondok') || 
          lower.includes('kitab') || 
          lower.includes('internal') ||
          (l.kode && l.kode.toLowerCase().includes('madin')) ||
          (l.kode && l.kode.toLowerCase().includes('tahf'))
        ) {
          return 'Internal';
        }
        return 'Formal';
      };

      const activeLembagasOfStudent = currentClasses.map(clsName => {
        const c = kelasList.find(x => 
          x.nama.toLowerCase() === clsName.toLowerCase() && 
          (x.lembagaId === target.pendidikanFormal || 
           (target.pendidikanInternal?.split(',').includes(x.lembagaId)) || 
           x.lembagaId === lembagaId)
        ) || kelasList.find(x => x.nama.toLowerCase() === clsName.toLowerCase());
        return c ? lembagasList.find(l => l.id === c.lembagaId) : null;
      }).filter(Boolean) as Lembaga[];

      let newFormal = target.pendidikanFormal;
      const activeFormalLembaga = activeLembagasOfStudent.find(l => getLembagaJenis(l) === 'Formal');
      if (activeFormalLembaga) {
        newFormal = activeFormalLembaga.id;
      } else {
        // If they had a formal class, but now no active formal classes are in the list, clear it
        if (target.pendidikanFormal) {
          const stillHasClassOfFormal = currentClasses.some(clsName => {
            const c = kelasList.find(k => k.nama.toLowerCase() === clsName.toLowerCase() && k.lembagaId === target.pendidikanFormal);
            return !!c;
          });
          if (!stillHasClassOfFormal) {
            newFormal = undefined;
          }
        }
      }

      const activeInternalLembagaIds = activeLembagasOfStudent
        .filter(l => getLembagaJenis(l) === 'Internal')
        .map(l => l.id);
      const newInternal = activeInternalLembagaIds.length > 0 
        ? Array.from(new Set(activeInternalLembagaIds)).join(',') 
        : undefined;
      
      onUpdateSantri({
        ...target,
        kelas: finalKelasString,
        pendidikanFormal: newFormal,
        pendidikanInternal: newInternal
      });
    }
  };

  const handleUpdateSantriClassBatch = async (santriIds: string[], targetClassName: string) => {
    const targetClass = kelasList.find(c => c.nama.toLowerCase() === targetClassName.toLowerCase());
    const targetLembaga = targetClass ? lembagasList.find(l => l.id === targetClass.lembagaId) : null;

    const getLembagaJenis = (l: Lembaga): 'Formal' | 'Internal' => {
      if (l.jenis) return l.jenis;
      const lower = l.nama.toLowerCase();
      if (
        lower.includes('madin') || 
        lower.includes('diniyah') || 
        lower.includes('tpq') || 
        lower.includes('tahfidz') || 
        lower.includes('pondok') || 
        lower.includes('kitab') || 
        lower.includes('internal') ||
        (l.kode && l.kode.toLowerCase().includes('madin')) ||
        (l.kode && l.kode.toLowerCase().includes('tahf'))
      ) {
        return 'Internal';
      }
      return 'Formal';
    };

    const updatedList = santriList.map(s => {
      if (santriIds.includes(s.id)) {
        let currentClasses = s.kelas ? s.kelas.split(',').map(x => x.trim()).filter(Boolean) : [];
        currentClasses = currentClasses.filter(c => c.toLowerCase() !== 'tanpa kelas');
        
        if (targetLembaga) {
          currentClasses = currentClasses.filter(cls => {
            const c = kelasList.find(x => x.nama.toLowerCase() === cls.toLowerCase());
            return !c || c.lembagaId !== targetLembaga.id;
          });
        }
        
        if (!currentClasses.some(cls => cls.toLowerCase() === targetClassName.toLowerCase())) {
          currentClasses.push(targetClassName);
        }
        
        const finalKelasString = currentClasses.join(', ') || 'Tanpa Kelas';
        
        const activeLembagasOfStudent = currentClasses.map(clsName => {
          const c = kelasList.find(x => x.nama.toLowerCase() === clsName.toLowerCase());
          return c ? lembagasList.find(l => l.id === c.lembagaId) : null;
        }).filter(Boolean) as Lembaga[];

        const activeFormalLembaga = activeLembagasOfStudent.find(l => getLembagaJenis(l) === 'Formal');
        const newFormal = activeFormalLembaga ? activeFormalLembaga.id : (s.pendidikanFormal);

        const activeInternalLembagaIds = activeLembagasOfStudent
          .filter(l => getLembagaJenis(l) === 'Internal')
          .map(l => l.id);
        const newInternal = activeInternalLembagaIds.length > 0 
          ? Array.from(new Set(activeInternalLembagaIds)).join(',') 
          : undefined;

        return {
          ...s,
          kelas: finalKelasString,
          pendidikanFormal: newFormal,
          pendidikanInternal: newInternal
        };
      }
      return s;
    });

    setSantriList(updatedList);

    try {
      for (const id of santriIds) {
        const s = updatedList.find(x => x.id === id);
        if (s) {
          await onUpdateSantri(s);
        }
      }
    } catch (err) {
      console.error("Error in batch updating santri classes:", err);
    }
  };

  const handleAddAssignment = async (newAss: RombelAssignment) => {
    // 1. Optimistic local update
    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const tempAss = { ...newAss, id: tempId };
    setAssignmentsList(prev => {
      const cleaned = prev.filter(a => !(a.santriId === newAss.santriId && a.kategoriId === newAss.kategoriId));
      return [...cleaned, tempAss];
    });

    try {
      // 2. Since there's a unique constraint on (santri_id, kategori_id) in database, check if existing on DB
      const existing = assignmentsList.find(a => a.santriId === newAss.santriId && a.kategoriId === newAss.kategoriId);
      if (existing && existing.id && !existing.id.startsWith('temp-')) {
        await deleteTableRow('rombel_assignment', 'smartsantri_rombel_assignments', existing.id);
      }
      
      const saved = await insertTableRow('rombel_assignment', 'smartsantri_rombel_assignments', newAss);
      setAssignmentsList(prev => {
        // Replace tempId with real saved.id
        return prev.map(a => a.id === tempId ? saved : a);
      });
    } catch (err) {
      console.error("Error adding rombel assignment:", err);
      // Revert on failure
      setAssignmentsList(prev => prev.filter(a => a.id !== tempId));
    }
  };

  const handleRemoveAssignment = async (santriId: string, kelompokId: string) => {
    // 1. Optimistic local update
    setAssignmentsList(prev => prev.filter(a => !(a.santriId === santriId && a.kelompokId === kelompokId)));

    // 2. DB delete
    const target = assignmentsList.find(a => a.santriId === santriId && a.kelompokId === kelompokId);
    if (target && target.id && !target.id.startsWith('temp-')) {
      try {
        await deleteTableRow('rombel_assignment', 'smartsantri_rombel_assignments', target.id);
      } catch (err) {
        console.error("Error removing assignment:", err);
        // Revert on failure
        setAssignmentsList(prev => {
          if (prev.some(a => a.santriId === santriId && a.kelompokId === kelompokId)) return prev;
          return [...prev, target];
        });
      }
    }
  };

  const handleUpdateRombelBatch = async (santriIds: string[], categoryId: string, targetGroupId: string | null) => {
    // 1. Save original state for possible reversion
    const originalAssignments = [...assignmentsList];

    // 2. Optimistic local update
    const tempAssignments = targetGroupId 
      ? santriIds.map(sid => ({
          id: `temp-${Date.now()}-${Math.random()}-${sid}`,
          santriId: sid,
          kategoriId: categoryId,
          kelompokId: targetGroupId
        }))
      : [];

    setAssignmentsList(prev => {
      const filtered = prev.filter(a => !(santriIds.includes(a.santriId) && a.kategoriId === categoryId));
      return [...filtered, ...tempAssignments];
    });

    try {
      // 3. Find and delete existing database assignments for these students in this category
      const toDelete = originalAssignments.filter(a => santriIds.includes(a.santriId) && a.kategoriId === categoryId);
      for (const a of toDelete) {
        if (a.id && !a.id.startsWith('temp-')) {
          await deleteTableRow('rombel_assignment', 'smartsantri_rombel_assignments', a.id);
        }
      }

      // 4. Insert new assignments if targetGroupId is provided
      if (targetGroupId) {
        const savedAssignments: RombelAssignment[] = [];
        for (const sid of santriIds) {
          const newAss: RombelAssignment = {
            santriId: sid,
            kategoriId: categoryId,
            kelompokId: targetGroupId
          };
          const saved = await insertTableRow('rombel_assignment', 'smartsantri_rombel_assignments', newAss);
          savedAssignments.push(saved);
        }

        // Replace optimistic temp assignments with real saved ones
        setAssignmentsList(prev => {
          const filtered = prev.filter(a => !(santriIds.includes(a.santriId) && a.kategoriId === categoryId));
          return [...filtered, ...savedAssignments];
        });
      }
    } catch (err) {
      console.error("Error in batch updating rombel assignments:", err);
      // Revert to original
      setAssignmentsList(originalAssignments);
    }
  };


  // --- CALCULATE SUMMARY METRICS ---
  const activeClassNames = kelasList.map(c => c.nama.toLowerCase());
  const santriWithClass = santriList.filter(s => {
    const sClasses = s.kelas ? s.kelas.split(',').map(x => x.trim().toLowerCase()) : [];
    return sClasses.some(c => c && c !== 'tanpa kelas' && activeClassNames.includes(c));
  });
  const santriWithoutClass = santriList.filter(s => {
    const sClasses = s.kelas ? s.kelas.split(',').map(x => x.trim().toLowerCase()) : [];
    const validClasses = sClasses.filter(c => c && c !== 'tanpa kelas' && activeClassNames.includes(c));
    return validClasses.length === 0;
  });

  const totalSantriCount = santriList.length;

  return (
    <div className="space-y-6">
      
      {/* --- RENDER SUB-TAB WORKSPACES --- */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSubTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.15 }}
          className="min-h-[400px]"
        >
          {activeSubTab === 'overview' && (() => {
            // Filter everything dynamically based on genderFilter
            const activeSantri = santriList.filter(s => 
              s.gender === genderFilter && 
              s.statusKeanggotaan !== 'Alumni'
            );

            const activeLembagas = lembagasList.filter(l => l.gender === genderFilter);
            
            const activeLembagaIds = activeLembagas.map(l => l.id);
            const activeKelas = kelasList.filter(c => activeLembagaIds.includes(c.lembagaId));
            const activeClassNames = activeKelas.map(c => c.nama.toLowerCase());

            // Count placed / unplaced
            const placedCount = activeSantri.filter(s => {
              const sClasses = s.kelas ? s.kelas.split(',').map(x => x.trim().toLowerCase()) : [];
              return sClasses.some(cls => cls && cls !== 'tanpa kelas' && activeClassNames.includes(cls));
            }).length;
            const unplacedCount = activeSantri.length - placedCount;
            const classFulfillmentRate = activeSantri.length > 0 ? Math.round((placedCount / activeSantri.length) * 100) : 0;

            // Rombel calculations
            const rombelParticipatingCount = activeSantri.filter(s => 
              assignmentsList.some(a => a.santriId === s.id)
            ).length;
            const rombelParticipationRate = activeSantri.length > 0 ? Math.round((rombelParticipatingCount / activeSantri.length) * 100) : 0;

            // Group Rombel counts for this gender
            const activeGroupsForGender = groupsList.map(g => {
              const count = assignmentsList.filter(a => {
                if (a.kelompokId !== g.id) return false;
                const s = santriList.find(x => x.id === a.santriId);
                return s && s.gender === genderFilter && s.statusKeanggotaan !== 'Alumni';
              }).length;
              return { ...g, activeMembersCount: count };
            }).filter(g => g.activeMembersCount > 0 || activeLembagas.length > 0);

            // Level distributions for this gender
            const levelCounts = {
              'Ula': 0,
              'Wustho': 0,
              'Ulya': 0,
              'Tahfidz': 0,
              'Lainnya': 0
            };
            
            activeSantri.forEach(s => {
              const sClasses = s.kelas ? s.kelas.split(',').map(x => x.trim().toLowerCase()) : [];
              const myClass = activeKelas.find(c => sClasses.includes(c.nama.toLowerCase()));
              if (myClass) {
                const tingk = myClass.tingkatan;
                if (tingk === 'Ula' || tingk === 'Wustho' || tingk === 'Ulya' || tingk === 'Lainnya') {
                  levelCounts[tingk]++;
                } else {
                  levelCounts['Lainnya']++;
                }
              } else {
                const isTahfidz = sClasses.some(cls => cls.includes('tahfidz') || cls.includes('halaqah'));
                if (isTahfidz) {
                  levelCounts['Tahfidz']++;
                } else {
                  levelCounts['Lainnya']++;
                }
              }
            });

            const isPutra = genderFilter === 'Putra';
            const textClass = isPutra ? 'text-indigo-600' : 'text-rose-600';
            const bgClass = isPutra ? 'bg-indigo-600' : 'bg-rose-600';
            const bgLightClass = isPutra ? 'bg-indigo-50/45' : 'bg-rose-50/45';
            const borderClass = isPutra ? 'border-indigo-100' : 'border-rose-100';
            const textPrimary950 = isPutra ? 'text-indigo-950' : 'text-rose-950';
            const textPrimary500 = isPutra ? 'text-indigo-500' : 'text-rose-500';

            return (
              <div className="space-y-6">
                
                {/* Custom Interactive Header with Gender Toggle */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-50 p-4.5 rounded-2xl border border-slate-100 shadow-3xs">
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${isPutra ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'} shadow-sm`}>
                      <Sparkles className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h2 className="text-sm font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                        Overview Akademik {genderFilter}
                      </h2>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Ringkasan real-time integrasi data madrasah formal, rombel, dan progres akademik {genderFilter.toLowerCase()}.
                      </p>
                    </div>
                  </div>

                  {/* Gender Switch Toggle */}
                  {canViewPutra && canViewPutri && (
                    <div className="flex items-center gap-2 self-start sm:self-center">
                      <span className="text-[11px] font-bold text-slate-500">Pilih Gender:</span>
                      <div className="relative bg-slate-200/80 p-1 rounded-full flex items-center gap-1 w-44">
                        {/* Sliding Background */}
                        <motion.div
                          className={`absolute top-1 bottom-1 rounded-full ${bgClass}`}
                          layoutId="activeGenderBg"
                          transition={{ type: "spring", stiffness: 350, damping: 25 }}
                          style={{
                            left: isPutra ? '4px' : 'calc(50% + 2px)',
                            width: 'calc(50% - 6px)'
                          }}
                        />
                        <button
                          onClick={() => setGenderFilter('Putra')}
                          className={`relative flex-1 text-center py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors z-10 ${
                            isPutra ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Putra
                        </button>
                        <button
                          onClick={() => setGenderFilter('Putri')}
                          className={`relative flex-1 text-center py-1 rounded-full text-[10px] font-black uppercase tracking-wider transition-colors z-10 ${
                            !isPutra ? 'text-white' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          Putri
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Dynamic Metrics Cards (Filtered by Selected Gender) */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  
                  <div className={`rounded-2xl border ${borderClass} ${bgLightClass} p-4.5 shadow-xs flex items-center gap-4 transition-colors duration-300`}>
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${bgClass} text-white shadow-sm transition-colors duration-300`}>
                      <School className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <p className={`text-[9px] font-extrabold ${textPrimary500} uppercase tracking-widest leading-none`}>Lembaga ({genderFilter})</p>
                      <p className={`text-xl font-display font-extrabold ${textPrimary950} mt-1.5`}>{activeLembagas.length} Unit</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <GraduationCap className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Kelas Formal ({genderFilter})</p>
                      <p className="text-xl font-display font-extrabold text-slate-950 mt-1.5">{activeKelas.length} Ruang</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Compass className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Rombel Aktif</p>
                      <p className="text-xl font-display font-extrabold text-slate-950 mt-1.5">{activeGroupsForGender.filter(g => g.activeMembersCount > 0).length} Halaqah</p>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs flex items-center gap-4">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                      <Users className="h-5.5 w-5.5" />
                    </div>
                    <div>
                      <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-widest leading-none">Santri Aktif ({genderFilter})</p>
                      <p className="text-xl font-display font-extrabold text-slate-950 mt-1.5">{activeSantri.length} Santri</p>
                    </div>
                  </div>

                </div>

                {/* Alerts and Quick Complete Cards */}
                <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                  
                  {/* Left Side: Bento of Placement Statistics */}
                  <div className="lg:col-span-3 space-y-4">
                    
                    {/* Classless Students Warning Alert specifically for this gender */}
                    {unplacedCount > 0 ? (
                      <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4 flex items-start gap-3.5 shadow-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-600 text-white shadow-sm">
                          <AlertTriangle className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-amber-950">
                            Terdapat {unplacedCount} Santri {genderFilter} Belum Terdaftar Kelas!
                          </h4>
                          <p className="text-[10px] text-amber-800/90 mt-1">
                            Beberapa santri baru atau pindahan dari gender {genderFilter.toLowerCase()} belum memiliki kelas pendidikan formal yang valid. Gunakan sub-modul Akademik untuk mengatur penempatan mereka secara massal.
                          </p>
                          <button
                            onClick={() => onChangeSubTab('akademik')}
                            className="mt-2 text-[10px] font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <span>Atur Kelas Massal</span>
                            <ArrowRight className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/30 p-4 flex items-start gap-3.5 shadow-xs">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
                          <CheckCircle2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-bold text-emerald-950">
                            Sempurna! Penempatan Kelas {genderFilter} Lengkap
                          </h4>
                          <p className="text-[10px] text-emerald-800/95 mt-1">
                            Hebat, seluruh {activeSantri.length} santri {genderFilter.toLowerCase()} aktif telah berhasil ditempatkan pada masing-masing kelas Madrasah yang resmi.
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Integrated Completeness Stats */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      
                      {/* Class completeness meter */}
                      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col justify-between h-36">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Kerapian Kelas</span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            classFulfillmentRate >= 90 ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                          }`}>{classFulfillmentRate}%</span>
                        </div>
                        <div className="my-2">
                          <p className="text-xs font-extrabold text-slate-700 leading-tight">Penempatan Kelas Formal</p>
                          <p className="text-[9px] text-slate-400 mt-1">{placedCount} dari {activeSantri.length} santri terkelompokkan.</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${bgClass} transition-all duration-500`}
                            style={{ width: `${classFulfillmentRate}%` }}
                          />
                        </div>
                      </div>

                      {/* Rombel completeness meter */}
                      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm flex flex-col justify-between h-36">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">Keaktifan Rombel</span>
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            rombelParticipationRate >= 75 ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700'
                          }`}>{rombelParticipationRate}%</span>
                        </div>
                        <div className="my-2">
                          <p className="text-xs font-extrabold text-slate-700 leading-tight">Keikutsertaan Rombongan Belajar</p>
                          <p className="text-[9px] text-slate-400 mt-1">{rombelParticipatingCount} santri mengikuti setidaknya satu rombel.</p>
                        </div>
                        <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                          <div 
                            className={`h-full bg-emerald-500 transition-all duration-500`}
                            style={{ width: `${rombelParticipationRate}%` }}
                          />
                        </div>
                      </div>

                    </div>

                    {/* Class Levels Distribution Breakdown */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-slate-400" />
                          Sebaran Jenjang Tingkat ({genderFilter})
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                        {Object.entries(levelCounts).map(([lvl, val]) => {
                          const levelPct = activeSantri.length > 0 ? Math.round((val / activeSantri.length) * 100) : 0;
                          return (
                            <div key={lvl} className="bg-slate-50 border border-slate-100 p-2.5 rounded-xl text-center flex flex-col justify-between min-h-[76px]">
                              <span className="text-[9px] text-slate-400 uppercase font-extrabold tracking-wider truncate">{lvl}</span>
                              <div className="my-1">
                                <span className="text-sm font-extrabold text-slate-800 font-mono">{val}</span>
                                <span className="text-[8px] text-slate-400 ml-0.5 font-bold">Sntr</span>
                              </div>
                              <div className="flex items-center justify-center gap-1">
                                <div className="w-8 bg-slate-200 h-1 rounded-full overflow-hidden">
                                  <div className={`h-full ${bgClass}`} style={{ width: `${levelPct}%` }} />
                                </div>
                                <span className="text-[8px] font-mono font-bold text-slate-500">{levelPct}%</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                  </div>

                  {/* Right Side: Institution Lists & Class Capacity Fullness */}
                  <div className="lg:col-span-2 space-y-4">
                    
                    {/* Lembaga Card Deck with Classes Progress bar */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <ClipboardCheck className="w-3.5 h-3.5 text-slate-400" />
                          Daftar Madrasah ({genderFilter})
                        </span>
                        <button 
                          onClick={() => onChangeSubTab('lembaga')}
                          className={`text-[9px] font-black ${textClass} hover:underline cursor-pointer`}
                        >
                          Kelola Unit
                        </button>
                      </div>

                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {activeLembagas.length === 0 ? (
                          <div className="text-center py-6 text-slate-400 text-xs">
                            Belum ada unit lembaga terdaftar untuk gender {genderFilter}.
                          </div>
                        ) : (
                          activeLembagas.map(l => {
                            const classes = activeKelas.filter(c => c.lembagaId === l.id);
                            const classNames = classes.map(c => c.nama.toLowerCase());
                            const totalLembagaStudents = activeSantri.filter(s => {
                              const sClasses = s.kelas ? s.kelas.split(',').map(x => x.trim().toLowerCase()) : [];
                              return sClasses.some(cls => cls && classNames.includes(cls));
                            }).length;
                            
                            const totalCapacity = classes.reduce((sum, curr) => sum + (curr.kapasitas || 30), 0);
                            const progressPercentage = totalCapacity > 0 ? Math.min(100, Math.round((totalLembagaStudents / totalCapacity) * 100)) : 0;

                            return (
                              <div key={l.id} className="p-3 rounded-xl border border-slate-100 bg-slate-50/40 hover:bg-slate-50/80 transition-colors space-y-2">
                                <div className="flex items-start justify-between">
                                  <div className="min-w-0">
                                    <h5 className="text-[11px] font-black text-slate-800 leading-tight truncate">{l.nama}</h5>
                                    <span className="inline-flex rounded bg-slate-200/60 text-slate-700 text-[8px] font-black px-1.5 py-0.2 mt-1">{l.kode}</span>
                                  </div>
                                  <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">{totalLembagaStudents} / {totalCapacity} Sntr</span>
                                </div>

                                <div className="space-y-1">
                                  <div className="relative w-full h-1.5 bg-slate-200/70 rounded-full overflow-hidden">
                                    <div 
                                      className={`absolute left-0 top-0 h-full ${bgClass} rounded-full transition-all duration-300`}
                                      style={{ width: `${progressPercentage}%` }}
                                    />
                                  </div>
                                  <div className="flex items-center justify-between text-[8.5px] text-slate-400">
                                    <span>Menaungi {classes.length} kelas</span>
                                    <span className={`font-bold ${textClass}`}>{progressPercentage}% Kuota</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Active Rombel Groups participation summary */}
                    <div className="rounded-2xl border border-slate-100 bg-white p-4.5 shadow-xs space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-50 pb-2">
                        <span className="font-display text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5 text-slate-400" />
                          Keterisian Rombel ({genderFilter})
                        </span>
                        <button 
                          onClick={() => {
                            setLembagaActiveTab('Rombel');
                            onChangeSubTab('lembaga');
                          }}
                          className={`text-[9px] font-black ${textClass} hover:underline cursor-pointer`}
                        >
                          Kelola Rombel
                        </button>
                      </div>

                      <div className="space-y-2 max-h-[190px] overflow-y-auto pr-1">
                        {activeGroupsForGender.slice(0, 3).map(g => {
                          const percentage = Math.min(100, Math.round((g.activeMembersCount / (g.kuota || 20)) * 100));
                          return (
                            <div key={g.id} className="p-2.5 rounded-xl border border-slate-50 bg-slate-50/50 flex items-center justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[11px] font-extrabold text-slate-800 truncate leading-tight">{g.nama}</p>
                                <p className="text-[8.5px] text-slate-400 mt-0.5 truncate">Guru: {g.pembimbing}</p>
                              </div>
                              <div className="text-right shrink-0">
                                <span className={`text-[9px] font-mono font-bold ${
                                  percentage >= 100 ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-800'
                                } px-1.5 py-0.5 rounded`}>
                                  {g.activeMembersCount} / {g.kuota || 20}
                                </span>
                                <div className="text-[8px] text-slate-400 mt-1 font-bold">{percentage}% Kuota</div>
                              </div>
                            </div>
                          );
                        })}
                        {activeGroupsForGender.length > 3 && (
                          <div 
                            onClick={() => {
                              setLembagaActiveTab('Rombel');
                              onChangeSubTab('lembaga');
                            }}
                            className="text-center py-1 text-[9px] font-bold text-slate-400 hover:text-slate-600 cursor-pointer flex items-center justify-center gap-1 hover:underline"
                          >
                            <span>Lihat {activeGroupsForGender.length - 3} Rombel Lainnya</span>
                            <ChevronRight className="w-3 h-3" />
                          </div>
                        )}
                      </div>
                    </div>

                  </div>

                </div>

              </div>
            );
          })()}

          {activeSubTab === 'lembaga' && (
            <LembagaKelasSub
              lembagasList={lembagasList}
              kelasList={kelasList}
              santriList={santriList}
              onAddLembaga={handleAddLembaga}
              onUpdateLembaga={handleUpdateLembaga}
              onDeleteLembaga={handleDeleteLembaga}
              onAddKelas={handleAddKelas}
              onUpdateKelas={handleUpdateKelas}
              onDeleteKelas={handleDeleteKelas}
              onUpdateSantriClass={handleUpdateSantriClass}
              genderFilter={genderFilter}
              canViewPutra={canViewPutra}
              canViewPutri={canViewPutri}
              canWritePutra={canWritePutra}
              canWritePutri={canWritePutri}
              initialTab={lembagaActiveTab}
              onTabChange={setLembagaActiveTab}
              
              // Rombel props
              categoriesList={categoriesList}
              groupsList={groupsList}
              assignmentsList={assignmentsList}
              onAddCategory={handleAddCategory}
              onUpdateCategory={handleUpdateCategory}
              onDeleteCategory={handleDeleteCategory}
              onAddGroup={handleAddGroup}
              onUpdateGroup={handleUpdateGroup}
              onDeleteGroup={handleDeleteGroup}
              onAddAssignment={handleAddAssignment}
              onRemoveAssignment={handleRemoveAssignment}
              onResetAllClasses={handleResetAllClasses}
            />
          )}

          {activeSubTab === 'akademik' && (
            <DataAkademikSub
              santriList={santriList}
              lembagasList={lembagasList}
              kelasList={kelasList}
              categoriesList={categoriesList}
              groupsList={groupsList}
              assignmentsList={assignmentsList}
              onUpdateSantri={onUpdateSantri}
              onUpdateSantriClassBatch={handleUpdateSantriClassBatch}
              onUpdateRombelBatch={handleUpdateRombelBatch}
              onAddAssignment={handleAddAssignment}
              onRemoveAssignment={handleRemoveAssignment}
              genderFilterProp={genderFilter}
              canViewPutra={canViewPutra}
              canViewPutri={canViewPutri}
              canWritePutra={canWritePutra}
              canWritePutri={canWritePutri}
            />
          )}
        </motion.div>
      </AnimatePresence>

    </div>
  );
}
