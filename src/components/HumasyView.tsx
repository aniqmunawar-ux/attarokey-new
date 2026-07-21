import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { HumasAgenda, Santri, Kompleks, Kamar } from '../types';
import KamarSub from './humas/KamarSub';
import DataKamarSantriSub from './humas/DataKamarSantriSub';
import { fetchTableData, insertTableRow, updateTableRow, deleteTableRow } from '../lib/api';
import { DEFAULT_ROLES } from '../lib/permissions';

interface HumasyViewProps {
  humasList: HumasAgenda[];
  santriList: Santri[];
  onUpdateSantri: (updatedSantri: Santri) => void;
  setSantriList: React.Dispatch<React.SetStateAction<Santri[]>>;
  activeSubTab: string;
  onChangeSubTab: (tab: string) => void;
  isSelectionMode?: boolean;
  setIsSelectionMode?: (val: boolean) => void;
}

// Initial complexes matching existing student rooms
export const INITIAL_KOMPLEKS: Kompleks[] = [];

export const INITIAL_KAMAR: Kamar[] = [];

export default function HumasyView({ 
  santriList,
  onUpdateSantri,
  setSantriList,
  activeSubTab,
  onChangeSubTab,
  isSelectionMode,
  setIsSelectionMode
}: HumasyViewProps) {

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
        canViewPutra = !!roleObj.permissions['humasy_putra.view'];
        canViewPutri = !!roleObj.permissions['humasy_putri.view'];
        canWritePutra = !!roleObj.permissions['humasy_putra.write'];
        canWritePutri = !!roleObj.permissions['humasy_putri.write'];
      } else {
        canViewPutra = false;
        canViewPutri = false;
        canWritePutra = false;
        canWritePutri = false;
      }
    }
  } catch (e) {
    console.error('Error parsing permissions in HumasyView:', e);
  }

  // --- PERSISTENT STATE FOR KAMAR & KOMPLEKS ---
  const [kompleksList, setKompleksList] = useState<Kompleks[]>(() => {
    const local = localStorage.getItem('smartsantri_kompleks');
    return local ? JSON.parse(local) : INITIAL_KOMPLEKS;
  });

  const [kamarList, setKamarList] = useState<Kamar[]>(() => {
    const local = localStorage.getItem('smartsantri_kamar');
    return local ? JSON.parse(local) : INITIAL_KAMAR;
  });

  // Fetch from Supabase / Local fallback on mount with automatic background polling and de-duplication
  useEffect(() => {
    const loadHumasData = () => {
      fetchTableData<Kompleks>('kompleks', 'smartsantri_kompleks', INITIAL_KOMPLEKS)
        .then(data => {
          const unique = data.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
          setKompleksList(unique);
        });
      fetchTableData<Kamar>('kamar', 'smartsantri_kamar', INITIAL_KAMAR)
        .then(data => {
          const unique = data.filter((item, idx, arr) => arr.findIndex(x => x.id === item.id) === idx);
          setKamarList(unique);
        });
    };

    loadHumasData();

    // Poll residential complexes and rooms every 10 seconds
    const interval = setInterval(loadHumasData, 10000);

    return () => clearInterval(interval);
  }, []);

  // Save to localStorage as a local cache mirror
  useEffect(() => {
    localStorage.setItem('smartsantri_kompleks', JSON.stringify(kompleksList));
  }, [kompleksList]);

  useEffect(() => {
    localStorage.setItem('smartsantri_kamar', JSON.stringify(kamarList));
  }, [kamarList]);

  // --- HANDLERS FOR KOMPLEKS ---
  const handleAddKompleks = async (newKom: Kompleks) => {
    const saved = await insertTableRow('kompleks', 'smartsantri_kompleks', newKom);
    setKompleksList(prev => {
      if (prev.some(k => k.id === saved.id)) return prev;
      return [...prev, saved];
    });
  };

  const handleUpdateKompleks = async (upKom: Kompleks) => {
    setKompleksList(prev => prev.map(k => k.id === upKom.id ? upKom : k));
    await updateTableRow('kompleks', 'smartsantri_kompleks', upKom.id, upKom);
  };

  const handleDeleteKompleks = async (id: string) => {
    const roomsToDelete = kamarList.filter(r => r.kompleksId === id);
    const roomNamesToDelete = roomsToDelete.map(r => r.nama.toLowerCase());

    // Clean up students residing in these rooms
    const studentsToUpdate = santriList.filter(s => 
      s.kamar && roomNamesToDelete.includes(s.kamar.toLowerCase())
    );
    for (const s of studentsToUpdate) {
      onUpdateSantri({
        ...s,
        kamar: "",
        nomorLemari: ""
      });
    }

    // Delete matching rooms in local state and database
    setKamarList(prev => prev.filter(r => r.kompleksId !== id));
    for (const r of roomsToDelete) {
      try {
        await deleteTableRow('kamar', 'smartsantri_kamar', r.id);
      } catch (err) {
        console.error(`Error deleting room ${r.id} on complex delete:`, err);
      }
    }

    setKompleksList(prev => prev.filter(k => k.id !== id));
    await deleteTableRow('kompleks', 'smartsantri_kompleks', id);
  };

  // --- HANDLERS FOR KAMAR ---
  const handleAddKamar = async (newKam: Kamar) => {
    const saved = await insertTableRow('kamar', 'smartsantri_kamar', newKam);
    setKamarList(prev => {
      if (prev.some(r => r.id === saved.id)) return prev;
      return [...prev, saved];
    });
  };

  const handleUpdateKamar = async (upKam: Kamar) => {
    setKamarList(prev => prev.map(r => r.id === upKam.id ? upKam : r));
    await updateTableRow('kamar', 'smartsantri_kamar', upKam.id, upKam);
  };

  const handleDeleteKamar = async (id: string) => {
    const targetRoom = kamarList.find(r => r.id === id);
    if (targetRoom) {
      const roomName = targetRoom.nama.toLowerCase();
      // Unassign students residing in this room
      const studentsToUpdate = santriList.filter(s => 
        s.kamar && s.kamar.toLowerCase() === roomName
      );
      for (const s of studentsToUpdate) {
        onUpdateSantri({
          ...s,
          kamar: "",
          nomorLemari: ""
        });
      }
    }

    setKamarList(prev => prev.filter(r => r.id !== id));
    await deleteTableRow('kamar', 'smartsantri_kamar', id);
  };

  // --- STUDENT ROOM ASSIGNMENT HANDLER ---
  const handleUpdateSantriRoom = (santriId: string, roomText: string, nomorLemari?: string) => {
    const target = santriList.find(s => s.id === santriId);
    if (target) {
      const roomChanged = (target.kamar || '').toLowerCase() !== (roomText || '').toLowerCase();
      const finalNomorLemari = nomorLemari !== undefined 
        ? nomorLemari 
        : (roomChanged ? '' : (target.nomorLemari || ''));
      onUpdateSantri({
        ...target,
        kamar: roomText,
        nomorLemari: finalNomorLemari
      });
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Conditionally Render Subtabs */}
      <AnimatePresence mode="wait">
        {activeSubTab === 'datakamar' ? (
          <motion.div
            key="datakamar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="min-h-[400px]"
          >
            <DataKamarSantriSub
              santriList={santriList}
              kompleksList={kompleksList}
              kamarList={kamarList}
              onUpdateSantriRoom={handleUpdateSantriRoom}
              isSelectionMode={isSelectionMode}
              setIsSelectionMode={setIsSelectionMode}
              canViewPutra={canViewPutra}
              canViewPutri={canViewPutri}
              canWritePutra={canWritePutra}
              canWritePutri={canWritePutri}
            />
          </motion.div>
        ) : (
          <motion.div
            key="kamar"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="min-h-[400px]"
          >
            <KamarSub
              kompleksList={kompleksList}
              kamarList={kamarList}
              santriList={santriList}
              onAddKompleks={handleAddKompleks}
              onUpdateKompleks={handleUpdateKompleks}
              onDeleteKompleks={handleDeleteKompleks}
              onAddKamar={handleAddKamar}
              onUpdateKamar={handleUpdateKamar}
              onDeleteKamar={handleDeleteKamar}
              onUpdateSantriRoom={handleUpdateSantriRoom}
              canViewPutra={canViewPutra}
              canViewPutri={canViewPutri}
              canWritePutra={canWritePutra}
              canWritePutri={canWritePutri}
            />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
