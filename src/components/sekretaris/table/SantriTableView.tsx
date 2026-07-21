import React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowUp, 
  ArrowDown, 
  ArrowUpDown, 
  Eye, 
  Pencil, 
  MoreVertical, 
  CheckSquare, 
  Printer, 
  Trash2,
  Check,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { Santri } from '../../../types';
import { renderSantriAvatar } from '../../SekretarisHelper';
import { MembershipBadge } from '../components/HelperComponents';

interface SantriTableViewProps {
  paginatedSantri: Santri[];
  startIndex: number;
  isSelectionMode: boolean;
  selectedSantriIds: string[];
  setSelectedSantriIds: (ids: string[]) => void;
  visibleColumns: Record<string, boolean>;
  sortKey: string;
  sortDirection: 'asc' | 'desc';
  setSortKey: (key: string) => void;
  setSortDirection: (dir: 'asc' | 'desc') => void;
  setSelectedSantri: (s: Santri) => void;
  handleStartEditSantri: (s: Santri) => void;
  handlePrintClick: (s: Santri) => void;
  handleDeleteClick: (id: string, name: string) => void;
  activeDesktopDropdownId: string | null;
  setActiveDesktopDropdownId: (id: string | null) => void;
  activeSantriDropdownId: string | null;
  setActiveSantriDropdownId: (id: string | null) => void;
  setIsSelectionMode: (val: boolean) => void;
  canWritePutra: boolean;
  canWritePutri: boolean;
}

const isSantriDataComplete = (s: Santri): boolean => {
  const requiredFields: (keyof Santri)[] = [
    'nis', 'nama', 'nisn', 'nism', 'nik', 'noKk', 'tempatLahir', 'tanggalLahir',
    'gender', 'pendidikanTerakhir', 'namaAyah', 'nikAyah', 'pekerjaanAyah', 'pendidikanAyah',
    'namaIbu', 'nikIbu', 'pekerjaanIbu', 'pendidikanIbu', 'alamat', 'rt', 'rw', 'desa',
    'kecamatan', 'kabupaten', 'provinsi', 'noHp', 'statusKeanggotaan', 'statusEmis'
  ];
  
  for (const field of requiredFields) {
    const val = s[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return false;
    }
  }

  if (s.statusKeanggotaan === 'Aktif') {
    if (!s.statusDomisili || String(s.statusDomisili).trim() === '') {
      return false;
    }
  }

  return true;
};

const isMonitoringWajibComplete = (s: Santri): boolean => {
  const wajibFields: (keyof Santri)[] = [
    'nis', 'gender', 'nik', 'nisn', 'tempatLahir', 'tanggalLahir',
    'desa', 'kecamatan', 'kabupaten', 'provinsi', 'pendidikanTerakhir',
    'namaAyah', 'namaIbu', 'statusKeanggotaan', 'noHp', 'tanggalMasuk', 'statusEmis'
  ];
  
  for (const field of wajibFields) {
    const val = s[field];
    if (val === undefined || val === null || String(val).trim() === '') {
      return false;
    }
  }
  return true;
};

export default function SantriTableView({
  paginatedSantri,
  startIndex,
  isSelectionMode,
  selectedSantriIds,
  setSelectedSantriIds,
  visibleColumns,
  sortKey,
  sortDirection,
  setSortKey,
  setSortDirection,
  setSelectedSantri,
  handleStartEditSantri,
  handlePrintClick,
  handleDeleteClick,
  activeDesktopDropdownId,
  setActiveDesktopDropdownId,
  activeSantriDropdownId,
  setActiveSantriDropdownId,
  setIsSelectionMode,
  canWritePutra,
  canWritePutri
}: SantriTableViewProps) {
  const [lastSelectedIndex, setLastSelectedIndex] = React.useState<number | null>(null);
  const [lastAction, setLastAction] = React.useState<'select' | 'deselect' | null>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);
  const [isScrolled, setIsScrolled] = React.useState(false);
  const [stickyTop, setStickyTop] = React.useState(148);
  const [floatingHeaderStyle, setFloatingHeaderStyle] = React.useState({ left: 0, width: 0 });

  const floatingHeaderRef = React.useRef<HTMLDivElement>(null);
  const floatingHeaderOuterRef = React.useRef<HTMLDivElement>(null);
  const isSyncingScroll = React.useRef(false);
  const scrollSourceRef = React.useRef<'main' | 'floating' | null>(null);
  const scrollTimeoutRef = React.useRef<number | null>(null);

  const updateScrollButtons = () => {
    const container = containerRef.current;
    if (container) {
      const { scrollLeft, scrollWidth, clientWidth } = container;
      // Only enable scroll buttons if the table is actually scrollable horizontally
      const hasHorizontalScroll = scrollWidth > clientWidth + 4;
      setCanScrollLeft(hasHorizontalScroll && scrollLeft > 2);
      setCanScrollRight(hasHorizontalScroll && scrollLeft + clientWidth < scrollWidth - 2);
    }
  };

  const scrollTable = (direction: 'left' | 'right') => {
    const container = containerRef.current;
    if (container) {
      scrollSourceRef.current = 'main';
      const scrollAmount = 300;
      const targetScroll = direction === 'left' 
        ? container.scrollLeft - scrollAmount 
        : container.scrollLeft + scrollAmount;
      
      container.scrollTo({
        left: targetScroll,
        behavior: 'smooth'
      });
    }
  };

  const handleTableScroll = () => {
    updateScrollButtons();
    const container = containerRef.current;
    if (!container) return;

    // Sync scroll to floating header using scrollSourceRef
    if (scrollSourceRef.current !== 'floating') {
      scrollSourceRef.current = 'main';
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollSourceRef.current = null;
      }, 150);

      if (floatingHeaderRef.current && floatingHeaderRef.current.scrollLeft !== container.scrollLeft) {
        floatingHeaderRef.current.scrollLeft = container.scrollLeft;
      }
    }

    // Calculate sticky threshold below the main header
    const mainHeader = document.querySelector('header');
    const mainHeaderHeight = mainHeader ? (mainHeader as HTMLElement).offsetHeight : 64;
    const computedStickyTop = mainHeaderHeight;

    setStickyTop(computedStickyTop);

    const containerRect = container.getBoundingClientRect();
    // Header floats when the container's top has reached the stickyTop threshold and remains inside the table bounds
    const isHeaderFloating = 
      containerRect.top <= computedStickyTop && 
      containerRect.bottom > (computedStickyTop + 48);
    setIsScrolled(isHeaderFloating);

    setFloatingHeaderStyle({
      left: containerRect.left,
      width: containerRect.width,
    });
  };

  // Recalculate horizontal scroll buttons and scroll stickiness on layout changes
  React.useEffect(() => {
    updateScrollButtons();
    const timer = setTimeout(() => {
      updateScrollButtons();
      handleTableScroll();
    }, 100);

    const handleResize = () => {
      updateScrollButtons();
      handleTableScroll();
    };

    const handleGlobalScroll = () => {
      handleTableScroll();
    };

    window.addEventListener('resize', handleResize, { passive: true });
    document.addEventListener('scroll', handleGlobalScroll, { capture: true, passive: true });

    // Use ResizeObserver for high-precision, instant scroll status updates
    let observer: ResizeObserver | null = null;
    const container = containerRef.current;
    if (container) {
      observer = new ResizeObserver(() => {
        updateScrollButtons();
      });
      observer.observe(container);
      const table = container.querySelector('table');
      if (table) {
        observer.observe(table);
      }
    }
    
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('scroll', handleGlobalScroll, { capture: true });
      if (observer) {
        observer.disconnect();
      }
    };
  }, [paginatedSantri, visibleColumns, isSelectionMode]);

  const [dragStart, setDragStart] = React.useState<{ pageX: number; pageY: number } | null>(null);
  const [dragBox, setDragBox] = React.useState<{ left: number; top: number; width: number; height: number } | null>(null);
  const mousePosRef = React.useRef<{ clientX: number; clientY: number } | null>(null);
  const initialSelectedIdsRef = React.useRef<string[]>([]);

  const lastSelectedIndexRef = React.useRef(lastSelectedIndex);
  const lastActionRef = React.useRef(lastAction);
  const paginatedSantriRef = React.useRef(paginatedSantri);
  const selectedSantriIdsRef = React.useRef(selectedSantriIds);
  const draggedRef = React.useRef<boolean>(false);
  const clickedIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    lastSelectedIndexRef.current = lastSelectedIndex;
  }, [lastSelectedIndex]);

  React.useEffect(() => {
    lastActionRef.current = lastAction;
  }, [lastAction]);

  React.useEffect(() => {
    paginatedSantriRef.current = paginatedSantri;
  }, [paginatedSantri]);

  React.useEffect(() => {
    selectedSantriIdsRef.current = selectedSantriIds;
  }, [selectedSantriIds]);

  const toggleSingleSelection = (id: string, shiftKey: boolean) => {
    const paginated = paginatedSantriRef.current;
    const lastIdx = lastSelectedIndexRef.current;
    const lastAct = lastActionRef.current;
    const prevSelected = selectedSantriIdsRef.current;

    const index = paginated.findIndex(x => x.id === id);
    if (index === -1) return;

    const s = paginated[index];
    const isSelected = prevSelected.includes(s.id);

    if (shiftKey && lastIdx !== null && lastAct !== null) {
      const start = Math.min(lastIdx, index);
      const end = Math.max(lastIdx, index);
      const rangeIds = paginated.slice(start, end + 1).map(x => x.id);

      if (lastAct === 'select') {
        const unionSet = new Set([...prevSelected, ...rangeIds]);
        setSelectedSantriIds(Array.from(unionSet));
      } else { // 'deselect'
        setSelectedSantriIds(prevSelected.filter(x => !rangeIds.includes(x)));
      }
    } else {
      if (isSelected) {
        setLastSelectedIndex(index);
        setLastAction('deselect');
        setSelectedSantriIds(prevSelected.filter(x => x !== s.id));
      } else {
        setLastSelectedIndex(index);
        setLastAction('select');
        setSelectedSantriIds([...prevSelected, s.id]);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isSelectionMode) return;
    if (e.button !== 0) return; // Left click only

    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('select') || 
      target.closest('a') ||
      target.closest('thead') || // Ignore clicks starting on the table header
      target.closest('.relative.inline-block') // Dropdown menu trigger
    ) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    initialSelectedIdsRef.current = selectedSantriIds;
    draggedRef.current = false;

    // Find closest row to determine clicked target
    const rowEl = target.closest('[data-drag-id]');
    clickedIdRef.current = rowEl?.getAttribute('data-drag-id') || null;

    setDragStart({ pageX: e.clientX + window.scrollX, pageY: e.clientY + window.scrollY });
    setDragBox(null);
    e.preventDefault();
  };

  React.useEffect(() => {
    if (!dragStart) {
      mousePosRef.current = null;
      return;
    }

    mousePosRef.current = { clientX: dragStart.pageX - window.scrollX, clientY: dragStart.pageY - window.scrollY };
    let animationFrameId: number;

    const updateSelection = () => {
      const container = containerRef.current;
      const mousePos = mousePosRef.current;
      if (!container || !mousePos) return;

      const containerRect = container.getBoundingClientRect();

      // Page-absolute box coordinates
      const currentPageX = mousePos.clientX + window.scrollX;
      const currentPageY = mousePos.clientY + window.scrollY;

      const dist = Math.sqrt(
        Math.pow(currentPageX - dragStart.pageX, 2) + 
        Math.pow(currentPageY - dragStart.pageY, 2)
      );

      if (dist <= 4 && !draggedRef.current) {
        setDragBox(null);
        return;
      }

      draggedRef.current = true;

      const pageLeft = Math.min(dragStart.pageX, currentPageX);
      const pageTop = Math.min(dragStart.pageY, currentPageY);
      const pageWidth = Math.abs(dragStart.pageX - currentPageX);
      const pageHeight = Math.abs(dragStart.pageY - currentPageY);
      const pageRight = pageLeft + pageWidth;
      const pageBottom = pageTop + pageHeight;

      // Convert page-absolute coordinates to container-relative coordinates for rendering the absolute dragBox
      const containerPageLeft = containerRect.left + window.scrollX;
      const containerPageTop = containerRect.top + window.scrollY;

      const left = pageLeft - containerPageLeft + container.scrollLeft;
      const top = pageTop - containerPageTop + container.scrollTop;

      setDragBox({ left, top, width: pageWidth, height: pageHeight });

      const itemElements = container.querySelectorAll('[data-drag-id]');
      const intersectedIds: string[] = [];

      itemElements.forEach((el) => {
        const elRect = el.getBoundingClientRect();
        const id = el.getAttribute('data-drag-id');
        if (!id) return;

        const elPageLeft = elRect.left + window.scrollX;
        const elPageRight = elRect.right + window.scrollX;
        const elPageTop = elRect.top + window.scrollY;
        const elPageBottom = elRect.bottom + window.scrollY;

        const isOverlapping = !(
          elPageRight < pageLeft ||
          elPageLeft > pageRight ||
          elPageBottom < pageTop ||
          elPageTop > pageBottom
        );

        if (isOverlapping) {
          intersectedIds.push(id);
        }
      });

      const unionSet = new Set([...initialSelectedIdsRef.current, ...intersectedIds]);
      setSelectedSantriIds(Array.from(unionSet));
    };

    const scrollAndLoop = () => {
      const mousePos = mousePosRef.current;
      if (!mousePos) return;

      const viewportHeight = window.innerHeight;
      const { clientY } = mousePos;
      const scrollThreshold = 60; // distance from top/bottom edge to start scrolling
      const maxScrollSpeed = 15; // max scroll increment in pixels

      let scrolled = false;

      if (clientY > viewportHeight - scrollThreshold) {
        const ratio = (clientY - (viewportHeight - scrollThreshold)) / scrollThreshold;
        const speed = Math.max(1, Math.min(maxScrollSpeed, ratio * maxScrollSpeed));
        window.scrollBy(0, speed);
        scrolled = true;
      } else if (clientY < scrollThreshold) {
        const ratio = (scrollThreshold - clientY) / scrollThreshold;
        const speed = Math.max(1, Math.min(maxScrollSpeed, ratio * maxScrollSpeed));
        window.scrollBy(0, -speed);
        scrolled = true;
      }

      updateSelection();
      animationFrameId = requestAnimationFrame(scrollAndLoop);
    };

    animationFrameId = requestAnimationFrame(scrollAndLoop);

    const handleMouseMove = (e: MouseEvent) => {
      mousePosRef.current = { clientX: e.clientX, clientY: e.clientY };
      updateSelection();
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (!draggedRef.current && clickedIdRef.current) {
        toggleSingleSelection(clickedIdRef.current, e.shiftKey);
      }
      setDragStart(null);
      setDragBox(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragStart, setSelectedSantriIds]);

  const handleRowClick = (e: React.MouseEvent, index: number, s: Santri) => {
    if (!isSelectionMode) return;

    const target = e.target as HTMLElement;
    if (
      target.closest('button') || 
      target.closest('input') || 
      target.closest('select') || 
      target.closest('a') ||
      target.closest('.relative.inline-block')
    ) {
      return;
    }
  };

  const scrolledHeaderClass = 'bg-slate-50 text-slate-400 border-b border-slate-100';

  const renderSortHeader = (key: string, label: string, isSticky: boolean = false, widthClass: string = '') => {
    const isSorted = sortKey === key;
    const stickyLeftClass = key === 'nama'
      ? (isSelectionMode ? 'sm:left-[112px] left-[112px]' : 'sm:left-[64px] left-[64px]')
      : '';
    return (
      <th 
        onClick={() => {
          if (sortKey === key) {
            setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
          } else {
            setSortKey(key);
            setSortDirection('asc');
          }
        }}
        className={`px-4 py-4 cursor-pointer transition-all select-none font-display text-xs font-bold uppercase tracking-wider sticky top-0 ${scrolledHeaderClass} ${
          isSticky 
            ? `${stickyLeftClass} z-30 sm:shadow-[2px_0_5px_rgba(0,0,0,0.05)] md:w-[272px] w-[200px] md:min-w-[272px] min-w-[200px] md:max-w-[272px] max-w-[200px] border-r` 
            : `hover:bg-slate-100/80 z-20 ${widthClass || 'w-44 min-w-[176px]'}`
          }`}
      >
        <div className="flex items-center gap-1.5 justify-start relative">
          <span className="text-slate-400">{label}</span>
          {isSorted ? (
            sortDirection === 'asc' ? (
              <ArrowUp className="h-3 w-3 text-emerald-700 font-bold shrink-0" />
            ) : (
              <ArrowDown className="h-3 w-3 text-emerald-700 font-bold shrink-0" />
            )
          ) : (
            <ArrowUpDown className="h-3 w-3 text-slate-300 hover:text-slate-500 shrink-0" />
          )}
        </div>

        {/* Scroll Left Button placed exactly in the middle of the right side of 'nama' header column */}
        {key === 'nama' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              scrollTable('left');
            }}
            disabled={!canScrollLeft}
            className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-[40] flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-md transition-all duration-200 ${
              canScrollLeft 
                ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:scale-105 active:scale-95 cursor-pointer opacity-100' 
                : 'border-slate-100 text-slate-300 opacity-40 cursor-not-allowed'
            }`}
            title="Gulir Kiri"
          >
            <ChevronLeft className="h-4 w-4 stroke-[2.5] -translate-x-[0.5px]" />
          </button>
        )}
      </th>
    );
  };

  const renderTableHeadContents = (headerClass: string) => (
    <tr>
      {isSelectionMode && (
        <th className={`px-3 py-4 text-center sticky top-0 left-0 z-35 border-r border-slate-100 w-12 min-w-[48px] transition-all duration-300 ${headerClass}`}>
          <div className="flex items-center justify-center">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              checked={paginatedSantri.length > 0 && paginatedSantri.every(s => selectedSantriIds.includes(s.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  const newIds = [...selectedSantriIds];
                  paginatedSantri.forEach(s => {
                     if (!newIds.includes(s.id)) {
                       newIds.push(s.id);
                     }
                  });
                  setSelectedSantriIds(newIds);
                } else {
                  const paginatedIds = paginatedSantri.map(s => s.id);
                  setSelectedSantriIds(selectedSantriIds.filter(id => !paginatedIds.includes(id)));
                }
              }}
            />
          </div>
        </th>
      )}
      {/* Nomor Column (Sticky Left) */}
      <th className={`px-2 py-4 sticky top-0 ${isSelectionMode ? 'sm:left-[48px] left-[48px]' : 'sm:left-0 left-0'} z-35 w-16 min-w-[64px] font-display text-xs font-bold uppercase tracking-wider border-r border-slate-100 text-center transition-all duration-300 ${headerClass}`}>
        No.
      </th>
      {/* Selalu Terlihat: Nama (berisi foto juga), NIS, NISN, NIK */}
      {renderSortHeader('nama', 'Nama Lengkap', true)}
      {renderSortHeader('nis', 'NIS', false, 'w-[95px] min-w-[95px]')}
      {renderSortHeader('nisn', 'NISN', false, 'w-[110px] min-w-[110px]')}
      {renderSortHeader('nik', 'NIK', false, 'w-[155px] min-w-[155px]')}
      
      {/* Toggable */}
      {visibleColumns.nism && renderSortHeader('nism', 'NISM', false, 'w-[110px] min-w-[110px]')}
      {visibleColumns.noKk && renderSortHeader('noKk', 'No. KK', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.tempatLahir && renderSortHeader('tempatLahir', 'Tempat Lahir', false, 'w-[125px] min-w-[125px]')}
      {visibleColumns.tanggalLahir && renderSortHeader('tanggalLahir', 'Tanggal Lahir', false, 'w-[115px] min-w-[115px]')}
      {visibleColumns.gender && renderSortHeader('gender', 'Gender', false, 'w-[90px] min-w-[90px]')}
      {visibleColumns.pendidikanTerakhir && renderSortHeader('pendidikanTerakhir', 'Pendidikan Terakhir', false, 'w-[160px] min-w-[160px]')}
      {visibleColumns.anakKe && renderSortHeader('anakKe', 'Anak Ke', false, 'w-[85px] min-w-[85px]')}
      {visibleColumns.dariBersaudara && renderSortHeader('dariBersaudara', 'Jumlah Saudara', false, 'w-[120px] min-w-[120px]')}
      {visibleColumns.namaAyah && renderSortHeader('namaAyah', 'Nama Ayah', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.nikAyah && renderSortHeader('nikAyah', 'NIK Ayah', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.pekerjaanAyah && renderSortHeader('pekerjaanAyah', 'Pekerjaan Ayah', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.pendidikanAyah && renderSortHeader('pendidikanAyah', 'Pendidikan Ayah', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.namaIbu && renderSortHeader('namaIbu', 'Nama Ibu', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.nikIbu && renderSortHeader('nikIbu', 'NIK Ibu', false, 'w-[155px] min-w-[155px]')}
      {visibleColumns.pekerjaanIbu && renderSortHeader('pekerjaanIbu', 'Pekerjaan Ibu', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.pendidikanIbu && renderSortHeader('pendidikanIbu', 'Pendidikan Ibu', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.alamat && renderSortHeader('alamat', 'Alamat', false, 'w-[180px] min-w-[180px]')}
      {visibleColumns.rt && renderSortHeader('rt', 'RT', false, 'w-[65px] min-w-[65px]')}
      {visibleColumns.rw && renderSortHeader('rw', 'RW', false, 'w-[65px] min-w-[65px]')}
      {visibleColumns.desa && renderSortHeader('desa', 'Desa / Kelurahan', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.kecamatan && renderSortHeader('kecamatan', 'Kecamatan', false, 'w-[140px] min-w-[140px]')}
      {visibleColumns.kabupaten && renderSortHeader('kabupaten', 'Kabupaten / Kota', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.provinsi && renderSortHeader('provinsi', 'Provinsi', false, 'w-[150px] min-w-[150px]')}
      {visibleColumns.jarakRumah && renderSortHeader('jarakRumah', 'Jarak (km)', false, 'w-[100px] min-w-[100px]')}
      {visibleColumns.noHp && renderSortHeader('noHp', 'No. HP Wali', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.statusDomisili && renderSortHeader('statusDomisili', 'Status Domisili', false, 'w-[130px] min-w-[130px]')}
      {visibleColumns.tanggalMasuk && renderSortHeader('tanggalMasuk', 'Tgl Masuk', false, 'w-[105px] min-w-[105px]')}
      {visibleColumns.tanggalKeluar && renderSortHeader('tanggalKeluar', 'Tgl Keluar', false, 'w-[105px] min-w-[105px]')}
      {visibleColumns.catatan && renderSortHeader('catatan', 'Catatan', false, 'w-[180px] min-w-[180px]')}
      
      {/* Selalu Terlihat: Status & Emis */}
      {renderSortHeader('statusKeanggotaan', 'Status', false, 'w-[105px] min-w-[105px]')}
      {renderSortHeader('statusEmis', 'Emis', false, 'w-[95px] min-w-[95px]')}
      
      <th className={`px-2 py-4 text-center font-display text-xs font-bold uppercase tracking-wider sticky top-0 right-0 z-35 shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l w-[96px] min-w-[96px] transition-all duration-300 ${isSelectionMode ? 'hidden md:table-cell' : 'table-cell'} ${headerClass}`}>Aksi</th>
    </tr>
  );

  const renderScrollButtons = (isFloating: boolean) => {
    return (
      <>
        {/* Scroll Right Button placed exactly in the middle of the right side/edge line of the header */}
        <button
          id={isFloating ? "table-scroll-right-btn-floating" : "table-scroll-right-btn"}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            scrollTable('right');
          }}
          disabled={!canScrollRight}
          className={`absolute right-0 ${
            isFloating ? 'top-1/2 -translate-y-1/2' : 'top-[26px] -translate-y-1/2'
          } translate-x-1/2 z-[48] flex h-8 w-8 items-center justify-center rounded-full border bg-white shadow-md transition-all duration-200 ${
            canScrollRight 
              ? 'border-slate-200 text-slate-600 hover:bg-slate-50 hover:scale-105 active:scale-95 cursor-pointer opacity-100' 
              : 'border-slate-100 text-slate-300 opacity-40 cursor-not-allowed'
          }`}
          title="Gulir Kanan"
        >
          <ChevronRight className="h-4 w-4 stroke-[2.5] translate-x-[0.5px]" />
        </button>
      </>
    );
  };

  return (
    <div className="relative group/table">
      {/* Scroll Navigation Buttons for Main Table Header */}
      {renderScrollButtons(false)}

      <div 
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onScroll={handleTableScroll}
        className="relative overflow-x-auto overflow-y-visible rounded-2xl border border-slate-100 bg-white shadow-sm scrollbar-thin select-none"
      >
      {dragBox && (
        <div
          className="absolute border border-[#00b0f0] bg-[#00b0f0]/15 pointer-events-none z-[15] rounded"
          style={{
            left: dragBox.left,
            top: dragBox.top,
            width: dragBox.width,
            height: dragBox.height,
          }}
        />
      )}
      <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm text-slate-600 table-sticky-leakproof">
        <thead className="text-xs font-semibold uppercase tracking-wider sticky top-0 z-35">
          {renderTableHeadContents(scrolledHeaderClass)}
        </thead>
        <tbody className="divide-y divide-slate-100">
          {paginatedSantri.map((s, idx) => {
            const isLastFew = paginatedSantri.length > 3 && idx >= paginatedSantri.length - 2;
            const isSelected = selectedSantriIds.includes(s.id);
            const canWriteForSantri = s.gender === 'Putra' ? canWritePutra : canWritePutri;
            return (
              <tr 
                key={`${s.id}-${idx}`} 
                data-drag-id={s.id}
                onClick={(e) => handleRowClick(e, idx, s)}
                className={`transition-colors group ${
                  isSelectionMode ? 'cursor-pointer font-semibold' : ''
                } ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50/60 hover:bg-emerald-100/60'
                    : 'hover:bg-slate-50/50'
                }`}
              >
                 {isSelectionMode && (
                  <td 
                    className={`px-3 py-4 text-center sticky left-0 transition-colors z-10 border-r border-slate-100 w-12 min-w-[48px] max-w-[48px] ${
                      isSelected ? 'bg-emerald-50' : 'bg-white group-hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center justify-center">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer pointer-events-none"
                        checked={isSelected}
                        readOnly
                      />
                    </div>
                  </td>
                )}
                {/* Nomor Column (Sticky Left) */}
                <td className={`px-2 py-4 static sm:sticky ${isSelectionMode ? 'sm:left-[48px] left-[48px]' : 'sm:left-0 left-0'} transition-colors z-10 border-r border-slate-100 w-16 min-w-[64px] max-w-[64px] text-center font-mono text-xs font-semibold ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'bg-white text-slate-500 group-hover:bg-slate-50'
                }`}>
                  <div className="flex items-center justify-center gap-2">
                    {isMonitoringWajibComplete(s) ? (
                      <div 
                        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 shrink-0 shadow-xs"
                        title="Semua Data Wajib Monitoring Lengkap"
                      >
                        <Check className="h-2.5 w-2.5 stroke-[3.5]" />
                      </div>
                    ) : (
                      <div 
                        className="inline-flex h-4.5 w-4.5 items-center justify-center rounded-full bg-rose-50 text-rose-600 border border-rose-200 shrink-0 shadow-xs"
                        title="Ada Data Wajib Monitoring Belum Lengkap"
                      >
                        <X className="h-2.5 w-2.5 stroke-[3.5]" />
                      </div>
                    )}
                    <span>{startIndex + idx + 1}</span>
                  </div>
                </td>
                {/* Name sticky column (Nama Lengkap) - Sticky on Desktop only */}
                <td className={`px-4 py-4 font-medium static sm:sticky ${isSelectionMode ? 'sm:left-[112px] left-[112px]' : 'sm:left-[64px] left-[64px]'} transition-colors z-10 sm:shadow-[2px_0_5px_rgba(0,0,0,0.02)] border-r border-slate-100 md:w-[272px] w-[200px] md:min-w-[272px] min-w-[200px] md:max-w-[272px] max-w-[200px] ${
                  isSelectionMode && isSelected
                    ? 'bg-emerald-50 text-slate-900'
                    : 'bg-white text-slate-900 group-hover:bg-slate-50'
                }`}>
                  <div className="flex items-center gap-3">
                    {renderSantriAvatar(s, "h-9 w-9 shrink-0 rounded-full border border-slate-100 shadow-xs")}
                    <p className="font-display text-sm font-bold text-slate-900 leading-tight whitespace-normal break-words md:max-w-[212px] max-w-[180px]">
                      {s.nama}
                    </p>
                  </div>
                </td>
                
                {/* NIS */}
                <td className="px-3 py-4 whitespace-nowrap font-mono text-xs font-semibold text-slate-700 w-[95px] min-w-[95px]">
                  {s.nis}
                </td>

                {/* Selalu Terlihat: NISN & NIK */}
                <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[110px] min-w-[110px]">
                  {s.nisn || '-'}
                </td>
                <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[155px] min-w-[155px]">
                  {s.nik || '-'}
                </td>

                {/* Toggable */}
                {visibleColumns.nism && (
                  <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[110px] min-w-[110px]">
                    {s.nism || '-'}
                  </td>
                )}
                {visibleColumns.noKk && (
                  <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[155px] min-w-[155px]">
                    {s.noKk || '-'}
                  </td>
                )}
                {visibleColumns.tempatLahir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs font-medium text-slate-700 font-display w-[125px] min-w-[125px]">
                    {s.tempatLahir || '-'}
                  </td>
                )}
                {visibleColumns.tanggalLahir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 font-mono w-[115px] min-w-[115px]">
                    {s.tanggalLahir || '-'}
                  </td>
                )}

                {/* Toggable */}
                {visibleColumns.gender && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs w-[90px] min-w-[90px]">
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      s.gender === 'Putra' 
                        ? 'bg-blue-50 text-blue-700' 
                        : 'bg-pink-50 text-pink-700'
                    }`}>
                      {s.gender}
                    </span>
                  </td>
                )}
                {visibleColumns.pendidikanTerakhir && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[160px] min-w-[160px]">
                    {s.pendidikanTerakhir || 'SD/MI'}
                  </td>
                )}
                {visibleColumns.anakKe && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 font-mono w-[85px] min-w-[85px]">
                    {s.anakKe !== undefined ? s.anakKe : '-'}
                  </td>
                )}
                {visibleColumns.dariBersaudara && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 font-mono w-[120px] min-w-[120px]">
                    {s.dariBersaudara !== undefined ? s.dariBersaudara : '-'}
                  </td>
                )}
                {visibleColumns.namaAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[150px] truncate w-[150px] min-w-[150px]" title={s.namaAyah}>
                    {s.namaAyah || '-'}
                  </td>
                )}
                {visibleColumns.nikAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 font-mono w-[155px] min-w-[155px]">
                    {s.nikAyah || '-'}
                  </td>
                )}
                {visibleColumns.pekerjaanAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[140px] truncate w-[140px] min-w-[140px]" title={s.pekerjaanAyah}>
                    {s.pekerjaanAyah || '-'}
                  </td>
                )}
                {visibleColumns.pendidikanAyah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[130px] min-w-[130px]">
                    {s.pendidikanAyah || '-'}
                  </td>
                )}
                {visibleColumns.namaIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[150px] truncate w-[150px] min-w-[150px]" title={s.namaIbu}>
                    {s.namaIbu || '-'}
                  </td>
                )}
                {visibleColumns.nikIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 font-mono w-[155px] min-w-[155px]">
                    {s.nikIbu || '-'}
                  </td>
                )}
                {visibleColumns.pekerjaanIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 max-w-[140px] truncate w-[140px] min-w-[140px]" title={s.pekerjaanIbu}>
                    {s.pekerjaanIbu || '-'}
                  </td>
                )}
                {visibleColumns.pendidikanIbu && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-700 w-[130px] min-w-[130px]">
                    {s.pendidikanIbu || '-'}
                  </td>
                )}
                 {visibleColumns.alamat && (
                  <td className="px-3 py-4 text-xs text-slate-600 max-w-[180px] truncate w-[180px] min-w-[180px]" title={s.alamat}>
                    {s.alamat || '-'}
                  </td>
                )}
                 {visibleColumns.rt && (
                  <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[65px] min-w-[65px]">
                    {s.rt && String(s.rt).trim() !== '0' && String(s.rt).trim() !== '00' && String(s.rt).trim() !== '000' ? s.rt : '-'}
                  </td>
                )}
                {visibleColumns.rw && (
                  <td className="px-3 py-4 whitespace-nowrap font-mono text-xs text-slate-500 w-[65px] min-w-[65px]">
                    {s.rw && String(s.rw).trim() !== '0' && String(s.rw).trim() !== '00' && String(s.rw).trim() !== '000' ? s.rw : '-'}
                  </td>
                )}

                {/* Toggable */}
                {visibleColumns.desa && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[140px] min-w-[140px]">
                    {s.desa || '-'}
                  </td>
                )}
                {visibleColumns.kecamatan && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[140px] min-w-[140px]">
                    {s.kecamatan || '-'}
                  </td>
                )}
                {visibleColumns.kabupaten && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[150px] min-w-[150px]">
                    {s.kabupaten || s.asal || '-'}
                  </td>
                )}
                {visibleColumns.provinsi && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 w-[150px] min-w-[150px]">
                    {s.provinsi || '-'}
                  </td>
                )}
                {visibleColumns.jarakRumah && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 font-mono w-[100px] min-w-[100px]">
                    {s.jarakRumah && s.jarakRumah !== 0 ? `${s.jarakRumah} km` : '-'}
                  </td>
                )}
                {visibleColumns.noHp && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-600 font-mono w-[130px] min-w-[130px]">
                    {s.noHp || '-'}
                  </td>
                )}
                {visibleColumns.statusDomisili && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs w-[130px] min-w-[130px]">
                    {s.statusKeanggotaan === 'Aktif' ? (
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        s.statusDomisili === 'Kampung' 
                          ? 'bg-amber-50 text-amber-700' 
                          : 'bg-emerald-50 text-emerald-700'
                      }`}>
                        {s.statusDomisili || 'Muqim'}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-mono">-</span>
                    )}
                  </td>
                )}
                {visibleColumns.tanggalMasuk && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 font-mono w-[105px] min-w-[105px]">
                    {s.tanggalMasuk}
                  </td>
                )}
                {visibleColumns.tanggalKeluar && (
                  <td className="px-3 py-4 whitespace-nowrap text-xs text-slate-500 font-mono w-[105px] min-w-[105px]">
                    {s.tanggalKeluar || '-'}
                  </td>
                )}
                {visibleColumns.catatan && (
                  <td className="px-3 py-4 text-xs text-slate-500 max-w-[180px] truncate w-[180px] min-w-[180px]" title={s.catatan}>
                    {s.catatan || '-'}
                  </td>
                )}

                {/* Selalu Terlihat: Status Keanggotaan & Status Emis */}
                <td className="px-3 py-4 text-center whitespace-nowrap text-xs w-[105px] min-w-[105px]">
                  <MembershipBadge 
                    status={s.statusKeanggotaan || 'Aktif'} 
                  />
                </td>
                <td className="px-3 py-4 whitespace-nowrap text-xs w-[95px] min-w-[95px]">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold border ${
                    (s.statusEmis || 'Belum').toLowerCase() === 'terdaftar'
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {s.statusEmis || 'Belum'}
                  </span>
                </td>

                {/* Aksi (Sticky Right) */}
                <td 
                  onClick={(e) => {
                    if (isSelectionMode) {
                      e.stopPropagation();
                    }
                  }}
                  className={`px-2 py-4 text-center whitespace-nowrap sticky right-0 transition-colors shadow-[-2px_0_5px_rgba(0,0,0,0.05)] border-l border-slate-100 w-[96px] min-w-[96px] ${
                    isSelectionMode
                      ? 'bg-slate-50 text-slate-400 hidden md:table-cell'
                      : 'bg-white group-hover:bg-slate-50 table-cell'
                  } ${activeSantriDropdownId === `tbl-${s.id}` || activeDesktopDropdownId === s.id ? 'z-[100]' : 'z-20'}`}
                >
                  <div className="flex items-center justify-center gap-2">
                    {/* Biodata Button (Selalu Terlihat) */}
                    <button
                      type="button"
                      disabled={isSelectionMode}
                      onClick={() => setSelectedSantri(s)}
                      className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                        isSelectionMode
                          ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                          : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 cursor-pointer active:scale-95'
                      }`}
                      title="Lihat Biodata Lengkap"
                    >
                      <Eye className="h-4 w-4" />
                    </button>

                    {/* Tombol Titik Tiga (Dropdown Aksi Lainnya) */}
                    <div className="relative inline-block text-left">
                      <button
                        type="button"
                        disabled={isSelectionMode}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveDesktopDropdownId(activeDesktopDropdownId === s.id ? null : s.id);
                        }}
                        className={`inline-flex h-8 w-8 items-center justify-center rounded-lg transition-all ${
                          isSelectionMode
                            ? 'bg-slate-100 text-slate-300 cursor-not-allowed border border-slate-200'
                            : activeDesktopDropdownId === s.id
                              ? 'bg-slate-100 text-slate-700 border border-slate-200'
                              : 'bg-slate-50 text-slate-600 hover:bg-slate-100 cursor-pointer active:scale-95'
                        }`}
                        title="Aksi Lainnya"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </button>

                      <AnimatePresence>
                        {activeDesktopDropdownId === s.id && (
                          <>
                            {/* Backdrop overlay to close when clicking outside */}
                            <div 
                              className="fixed inset-0 z-40 bg-transparent"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveDesktopDropdownId(null);
                              }}
                            />
                            <motion.div
                              initial={{ opacity: 0, scale: 0.95, y: -4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -4 }}
                              transition={{ duration: 0.1 }}
                              className={`absolute right-0 mt-1 w-36 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl z-50 text-slate-700 text-left font-sans ${
                                isLastFew ? 'bottom-full mb-1' : 'top-full'
                              }`}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div className="space-y-0.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDesktopDropdownId(null);
                                    setIsSelectionMode(true);
                                    setLastSelectedIndex(idx);
                                    setLastAction('select');
                                    if (!selectedSantriIds.includes(s.id)) {
                                      setSelectedSantriIds([...selectedSantriIds, s.id]);
                                    }
                                  }}
                                  className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-emerald-55 hover:text-emerald-800 transition-colors cursor-pointer"
                                >
                                  <span>Pilih</span>
                                </button>

                                {/* Edit Button */}
                                {canWriteForSantri && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setActiveDesktopDropdownId(null);
                                      handleStartEditSantri(s);
                                    }}
                                    className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-amber-50 hover:text-amber-700 transition-colors cursor-pointer"
                                  >
                                    <span>Ubah Data</span>
                                  </button>
                                )}

                                {/* Print Button */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveDesktopDropdownId(null);
                                    handlePrintClick(s);
                                  }}
                                  className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-slate-700 hover:bg-blue-50 hover:text-blue-700 transition-colors cursor-pointer"
                                >
                                  <span>Cetak Data</span>
                                </button>

                                {/* Delete Button */}
                                {canWriteForSantri && (
                                  <>
                                    <div className="my-1 border-t border-slate-100" />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveDesktopDropdownId(null);
                                        handleDeleteClick(s.id, s.nama);
                                      }}
                                      className="flex w-full items-center px-2.5 py-2 rounded-lg text-left text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                                    >
                                      <span>Hapus Data</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>

      {/* Viewport-sticky floating header (rendered via Portal to avoid being trapped by parent transform layout) */}
      {typeof document !== 'undefined' && createPortal(
        <div
          ref={floatingHeaderOuterRef}
          className="fixed z-[45] bg-slate-50 border border-slate-100 shadow-md rounded-t-2xl overflow-visible"
          style={{
            top: `${stickyTop}px`,
            left: `${floatingHeaderStyle.left}px`,
            width: `${floatingHeaderStyle.width}px`,
            display: isScrolled ? 'block' : 'none',
          }}
        >
          <div
            ref={floatingHeaderRef}
            onScroll={(e) => {
              const floating = e.currentTarget;
              if (scrollSourceRef.current !== 'main') {
                scrollSourceRef.current = 'floating';
                if (scrollTimeoutRef.current) {
                  window.clearTimeout(scrollTimeoutRef.current);
                }
                scrollTimeoutRef.current = window.setTimeout(() => {
                  scrollSourceRef.current = null;
                }, 150);

                if (containerRef.current && containerRef.current.scrollLeft !== floating.scrollLeft) {
                  containerRef.current.scrollLeft = floating.scrollLeft;
                }
              }
            }}
            className="overflow-x-auto [&::-webkit-scrollbar]:hidden"
          >
            <table className="w-max min-w-full border-separate border-spacing-0 text-left text-sm text-slate-600">
              <thead className="text-xs font-semibold uppercase tracking-wider text-slate-400 bg-slate-50">
                {renderTableHeadContents('bg-slate-50 text-slate-400 border-b border-slate-100')}
              </thead>
            </table>
          </div>
          {/* Scroll Navigation Buttons inside Floating Header */}
          {renderScrollButtons(true)}
        </div>,
        document.body
      )}
    </div>
  );
}
