import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Wifi, QrCode, UserCheck, UserX, Clock, X, History, Maximize2, Minimize2, BarChart3, Calendar, Download, FileText, Activity, Users, LogIn, Lock, Unlock } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { refreshNotifications } from '@/services/api';
import api from "@/services/api";
import { 
  extractHydraMembers, 
  getFullName, 
  normalizeMemberStatus, 
  formatDate, 
  formatTime,
  isMemberAccessAuthorized,
  extractIdFromIri
} from "@/lib/madafit";
import type { User, AttendanceRecord } from "@/types/entities";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AccessControl() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [lastScan, setLastScan] = useState<AttendanceRecord | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    if (selectedMonth) {
      const [year, month] = selectedMonth.split("-").map(Number);
      setSelectedDate(`${year}-${String(month).padStart(2, '0')}-01`);
    }
  }, [selectedMonth]);

  const isAdmin = useMemo(() => {
    try {
      const user = JSON.parse(localStorage.getItem("madafit_user") || "{}");
      return user.roles?.includes("ROLE_ADMIN") || false;
    } catch {
      return false;
    }
  }, []);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [showLockButton, setShowLockButton] = useState(true);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [currentScanTime, setCurrentScanTime] = useState<string | null>(null);
  const lastScanTime = useRef<number>(0);

  useEffect(() => {
    const resetIdleTimer = () => {
      setShowLockButton(true);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(() => {
        setShowLockButton(false);
      }, 3000);
    };

    resetIdleTimer();

    window.addEventListener('mousemove', resetIdleTimer);
    window.addEventListener('mousedown', resetIdleTimer);
    window.addEventListener('touchstart', resetIdleTimer);
    window.addEventListener('keydown', resetIdleTimer);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      window.removeEventListener('mousemove', resetIdleTimer);
      window.removeEventListener('mousedown', resetIdleTimer);
      window.removeEventListener('touchstart', resetIdleTimer);
      window.removeEventListener('keydown', resetIdleTimer);
    };
  }, []);

  const queryClient = useQueryClient();

  const usersQuery = useQuery({
    queryKey: ["users"],
    queryFn: () => api.users.getAll({ itemsPerPage: 100 }),
  });

  const attendanceQuery = useQuery({
    queryKey: ["attendance"],
    queryFn: () => api.attendanceRecords.getAll({ itemsPerPage: 100 }),
    refetchInterval: 5000,
  });

  const checkInMutation = useMutation({
    mutationFn: (data: { user: string; memberId: string; memberName: string; rfidCard?: string; date: string; checkIn: string }) =>
      api.attendanceRecords.create(data as unknown as Record<string, unknown>),
    onSuccess: () => {
      toast.success("Passage enregistré !");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      refreshNotifications();
    },
    onError: (err: unknown) => {
      console.error("Erreur scan:", err);
      toast.error("Erreur lors de l'enregistrement.");
    },
  });

  const checkOutMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: { checkOut: string } }) =>
      api.attendanceRecords.update(id, data as any),
    onSuccess: () => {
      toast.success("Sortie enregistrée !");
      queryClient.invalidateQueries({ queryKey: ["attendance"] });
      refreshNotifications();
    },
    onError: (err: unknown) => {
      console.error("Erreur sortie:", err);
      toast.error("Erreur lors de la sortie.");
    },
  });

  const users = extractHydraMembers(usersQuery.data) as User[];
  const attendance = extractHydraMembers(attendanceQuery.data) as AttendanceRecord[];

  useEffect(() => {
    let scanner: Html5Qrcode | null = null;

    const startScanner = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const element = document.getElementById("qr-reader");
        if (!element) return;

        scanner = new Html5Qrcode("qr-reader");
        qrScannerRef.current = scanner;

        await scanner.start(
          { facingMode: "user" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (decodedText) => {
            if (decodedText.startsWith("MADAFIT:")) {
              const now = Date.now();
              if (now - lastScanTime.current < 5000) return;

              const memberId = decodedText.replace("MADAFIT:", "");
              const foundUser = users.find((u) => u.memberId === memberId);
              if (foundUser) {
                lastScanTime.current = now;
                const nowObj = new Date();
                const timeStr = nowObj.toTimeString().split(" ")[0];
                const dateStr = `${nowObj.getFullYear()}-${String(nowObj.getMonth() + 1).padStart(2, '0')}-${String(nowObj.getDate()).padStart(2, '0')}`;

                setSelectedUser(foundUser);
                setCurrentScanTime(timeStr);

                // Logique de Toggle: On ne regarde QUE le record le plus récent
                const userRecords = attendance
                  .filter((a) => extractIdFromIri(a.user) === foundUser.id)
                  .sort((a, b) => {
                    const timeA = `${a.date}T${a.checkIn || "00:00:00"}`;
                    const timeB = `${b.date}T${b.checkIn || "00:00:00"}`;
                    return timeB.localeCompare(timeA);
                  });
                
                // Le premier est maintenant contractuellement le plus récent
                const latestRecord = userRecords[0]; 

                let shouldCheckOut = false;
                if (latestRecord && !latestRecord.checkOut) {
                  // On vérifie quand même que le record n'est pas trop vieux (max 15h)
                  const recordDate = new Date(latestRecord.date);
                  const recordTime = latestRecord.checkIn || "00:00:00";
                  if (recordTime.includes(":")) {
                    const [h, m, s] = recordTime.split(":").map(Number);
                    recordDate.setHours(h || 0, m || 0, s || 0);
                  }
                  
                  const diffHours = (now - recordDate.getTime()) / (1000 * 60 * 60);
                  if (diffHours >= 0 && diffHours < 15) {
                    shouldCheckOut = true;
                  }
                }

                if (shouldCheckOut && latestRecord && latestRecord.id) {
                  checkOutMutation.mutate({
                    id: latestRecord.id,
                    data: { checkOut: timeStr },
                  });
                } else {
                  // On crée une NOUVELLE entrée si le dernier record est déjà fermé
                  // ou s'il n'y a pas de record du tout.
                  checkInMutation.mutate({
                    user: `/api/users/${foundUser.id}`,
                    memberId: foundUser.memberId || "",
                    memberName: getFullName(foundUser),
                    rfidCard: foundUser.rfidCard || "",
                    date: dateStr,
                    checkIn: timeStr,
                  });
                }
              }
            }
          },
          () => {}
        );
      } catch (err) {
        console.error("Erreur scanner QR:", err);
      }
    };

    if (users.length > 0) startScanner();

    return () => {
      if (scanner) {
        try {
          if (scanner.isScanning) scanner.stop().catch(() => {});
        } catch (e) {
          // silence
        }
        qrScannerRef.current = null;
      }
    };
  }, [users.length, isKioskMode]);

  const toggleFullScreen = () => {
    setIsKioskMode(!isKioskMode);
  };

  useEffect(() => {
    if (attendance.length > 0) setLastScan(attendance[0]);
  }, [attendance]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) =>
      `${getFullName(user)} ${user.rfidCard ?? ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  // Timer pour réinitialiser l'affichage après un scan
  useEffect(() => {
    if (selectedUser) {
      const timer = setTimeout(() => {
        setSelectedUser(null);
        setCurrentScanTime(null);
      }, 5000); // Réduit à 5 secondes pour une meilleure réactivité
      return () => clearTimeout(timer);
    }
  }, [selectedUser]);

  const displayUser = selectedUser; // On n'affiche plus le dernier scan par défaut

  const isAccessDenied = displayUser && !isMemberAccessAuthorized(displayUser as User);

  const getRecordAccessStatus = (record: AttendanceRecord): "authorized" | "denied" => {
    const matchedUser = users.find((u) => {
      const recordUser = record.user as string | User;
      const isIriMatch =
        typeof recordUser === "string"
          ? recordUser === `/api/users/${u.id}`
          : recordUser?.id === u.id;
      return isIriMatch || record.memberId === u.memberId;
    });
    if (!matchedUser) return "denied";
    return isMemberAccessAuthorized(matchedUser) ? "authorized" : "denied";
  };

  const getMemberRecords = (member: User) =>
    attendance.filter((record) => {
      const recordUser = record.user as string | User;
      const userIri = `/api/users/${member.id}`;
      const isUserMatch =
        typeof recordUser === "string"
          ? recordUser === userIri
          : recordUser?.id === member.id;
      return isUserMatch || record.memberId === member.memberId;
    });

  const historyDays = 5;
  const historyData = useMemo(() => {
    return Array.from({ length: historyDays }).map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayAttendance = attendance.filter(r => (typeof r.date === 'string' ? r.date.substring(0, 10) : '') === dateStr);
      const passages = dayAttendance.length;
      const uniques = new Set(dayAttendance.map(r => extractIdFromIri(r.user)).filter(Boolean)).size;
      return {
        dateStr,
        label: i === 0 ? "Auj." : i === 1 ? "Hier" : `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
        passages,
        uniques
      };
    }).reverse();
  }, [attendance]);

  const todayStr = useMemo(() => {
    const todayObj = new Date();
    return `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-${String(todayObj.getDate()).padStart(2, '0')}`;
  }, []);

  const todayAttendance = useMemo(() => attendance.filter((r) => {
    const rDate = typeof r.date === 'string' ? r.date.substring(0, 10) : '';
    return rDate === todayStr;
  }), [attendance, todayStr]);

  const membersInRoomToday = useMemo(() => {
    // 1. On regroupe par utilisateur pour ne garder que le passage le plus récent
    const latestRecordsByUser = new Map<number, AttendanceRecord>();
    
    attendance.forEach(r => {
      const userId = extractIdFromIri(r.user);
      if (!userId) return;
      
      // On garde le record avec l'ID le plus grand (le plus récent si l'API trie par ID)
      // Ou on compare les dates si possible. L'API renvoie généralement par date DESC.
      if (!latestRecordsByUser.has(userId)) {
        latestRecordsByUser.set(userId, r);
      }
    });

    // 2. On compte ceux dont le record le plus récent n'a pas de checkOut et est "frais"
    let count = 0;
    const now = new Date();
    
    latestRecordsByUser.forEach((r) => {
      if (r.checkOut) return;
      
      const recordDate = new Date(r.date);
      const recordTime = r.checkIn || "00:00:00";
      if (recordTime.includes(":")) {
         const [h, m, s] = recordTime.split(":").map(Number);
         recordDate.setHours(h || 0, m || 0, s || 0);
      }
      
      const diffHours = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60);
      if (diffHours >= 0 && diffHours < 15) { // Fenêtre réduite à 15h pour plus de précision
        count++;
      }
    });
    
    return count;
  }, [attendance]);

  const totalPassagesToday = todayAttendance.length;
  const todayUniqueMembers = Array.from(new Set(todayAttendance.map(r => extractIdFromIri(r.user)).filter(Boolean))).length;
  const yesterdayData = historyData[historyData.length - 2] || { passages: 0, uniques: 0 };

  // ── STATISTIQUES MENSUELLES (ADMIN UNIQUEMENT) ──────────────────────
  const dateRange = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { startDate, endDate };
  }, [selectedMonth]);

  const monthlyAttendanceQuery = useQuery({
    queryKey: ["attendance", "monthly-reports", dateRange.startDate, dateRange.endDate],
    queryFn: () => api.attendanceRecords.getAll({
      itemsPerPage: 10000,
      filters: {
        "date[after]": dateRange.startDate,
        "date[before]": dateRange.endDate,
      }
    }),
    enabled: showStatsModal && isAdmin,
  });

  const monthlyAttendance = useMemo(() => {
    return extractHydraMembers(monthlyAttendanceQuery.data) as AttendanceRecord[];
  }, [monthlyAttendanceQuery.data]);

  const totalPassages = monthlyAttendance.length;

  const uniqueMembers = useMemo(() => {
    return new Set(monthlyAttendance.map(r => extractIdFromIri(r.user)).filter(Boolean)).size;
  }, [monthlyAttendance]);

  const checkOutOmissions = useMemo(() => {
    return monthlyAttendance.filter(r => !r.checkOut).length;
  }, [monthlyAttendance]);

  const peakHour = useMemo(() => {
    const hours = monthlyAttendance.map(r => {
      if (!r.checkIn) return null;
      return r.checkIn.split(":")[0];
    }).filter(Boolean);
    if (hours.length === 0) return "N/A";
    const counts = hours.reduce((acc, h) => {
      acc[h] = (acc[h] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const peak = Object.entries(counts).reduce((a, b) => a[1] > b[1] ? a : b, ["", 0]);
    return peak[0] ? `${peak[0]}h` : "N/A";
  }, [monthlyAttendance]);

  const chartData = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const lastDay = new Date(year, month, 0).getDate();
    const data = [];
    for (let day = 1; day <= lastDay; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayRecords = monthlyAttendance.filter(r => (typeof r.date === 'string' ? r.date.substring(0, 10) : '') === dateStr);
      data.push({
        day: `${day}`,
        passages: dayRecords.length,
        uniques: new Set(dayRecords.map(r => extractIdFromIri(r.user)).filter(Boolean)).size,
      });
    }
    return data;
  }, [monthlyAttendance, selectedMonth]);

  const calendarDays = useMemo(() => {
    const [year, month] = selectedMonth.split("-").map(Number);
    const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7;
    const totalDays = new Date(year, month, 0).getDate();
    
    const days = [];
    for (let i = 0; i < firstDayIndex; i++) {
      days.push(null);
    }
    for (let day = 1; day <= totalDays; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        dateStr
      });
    }
    return days;
  }, [selectedMonth]);

  const selectedDateRecords = useMemo(() => {
    if (!selectedDate) return [];
    return monthlyAttendance.filter(r => (typeof r.date === 'string' ? r.date.substring(0, 10) : '') === selectedDate);
  }, [monthlyAttendance, selectedDate]);

  const selectedDatePassages = selectedDateRecords.length;

  const selectedDateInGym = useMemo(() => {
    return selectedDateRecords.filter(r => !r.checkOut).length;
  }, [selectedDateRecords]);

  const exportToCSV = () => {
    const filename = `madafit-passages-${selectedMonth}.csv`;
    let csv = "\uFEFF";
    csv += "Date;ID Membre;Nom Membre;RFID;Entree;Sortie\n";
    monthlyAttendance.forEach(r => {
      csv += `${formatDate(r.date)};${r.memberId || ""};${r.memberName || ""};${r.rfidCard || ""};${formatTime(r.checkIn)};${formatTime(r.checkOut) || "Present"}\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.setFont("helvetica", "bold");
    doc.setFontSize(20);
    doc.text(`Rapport des passages - MadaFit`, 14, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100);
    doc.text(`Periode : ${selectedMonth}`, 14, 26);
    doc.text(`Genere le : ${new Date().toLocaleDateString("fr-FR")}`, 14, 32);

    doc.rect(14, 38, 182, 22, "S");
    doc.setFont("helvetica", "bold");
    doc.text("TOTAL PASSAGES", 20, 44);
    doc.text("MEMBRES UNIQUES", 70, 44);
    doc.text("SORTIES OUBLIEES", 125, 44);
    doc.text("HEURE DE POINTE", 165, 44);

    doc.setFont("helvetica", "normal");
    doc.text(String(totalPassages), 20, 52);
    doc.text(String(uniqueMembers), 70, 52);
    doc.text(String(checkOutOmissions), 125, 52);
    doc.text(String(peakHour), 165, 52);

    const headers = [["Date", "ID", "Nom", "RFID", "Entree", "Sortie"]];
    const data = monthlyAttendance.map(r => [
      formatDate(r.date),
      r.memberId || "—",
      r.memberName || "—",
      r.rfidCard || "—",
      formatTime(r.checkIn),
      formatTime(r.checkOut) || "Present"
    ]);

    autoTable(doc, {
      startY: 68,
      head: headers,
      body: data,
      theme: "striped",
      headStyles: { fillColor: [220, 53, 69] },
      styles: { fontSize: 8 },
    });

    doc.save(`madafit-passages-${selectedMonth}.pdf`);
  };

  // ── CONTENU DU SCANNER (REUTILISABLE) ──────────────────────────────────
  const renderScannerContent = () => (
    <div 
      className={`flex flex-col md:flex-row h-full w-full bg-card overflow-hidden relative ${
        isKioskMode ? "" : "rounded-2xl border border-border/50 shadow-xl"
      }`}
    >
      {/* Bouton pour activer/quitter le plein écran */}
      <button
        onClick={toggleFullScreen}
        className="absolute top-4 right-4 z-[60] p-2.5 rounded-xl bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all shadow-lg"
        title={isKioskMode ? "Quitter le plein écran" : "Passer en plein écran"}
      >
        {isKioskMode ? <X size={18} /> : <Maximize2 size={18} />}
      </button>

      {/* Partie Gauche : Scanner QR */}
      <div className="relative bg-black w-full md:w-[45%] min-h-[250px] md:min-h-full flex items-center justify-center overflow-hidden border-b md:border-b-0 md:border-r border-border/50">
        <div
          id="qr-reader"
          className="absolute inset-0 w-full h-full object-cover opacity-80"
          style={{ border: "none" }}
        />
        <div className="absolute inset-0 z-10 pointer-events-none border border-primary/20">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 sm:w-56 sm:h-56 border-2 border-primary/40 rounded-2xl">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-primary/40 shadow-[0_0_15px_rgba(var(--primary-rgb),0.6)] animate-scan-line" />
          </div>
        </div>
        <div className="z-20 absolute top-3 left-3 flex items-center gap-2 bg-black/40 backdrop-blur-md px-2.5 py-1 rounded-lg border border-white/10">
          <div className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />
          <span className="text-[9px] text-white font-bold uppercase tracking-wider">SCANNER ACTIF</span>
        </div>
        <div className="absolute bottom-3 right-3 z-20">
          <QrCode size={20} className="text-primary/60" />
        </div>
      </div>

      {/* Partie Droite : Infos Membre */}
      <div
        className={`w-full md:w-[55%] p-5 md:p-7 flex flex-col justify-between bg-gradient-to-br from-card via-card to-muted/20 relative transition-all duration-300 ${
          isAccessDenied ? "access-denied-flash" : ""
        }`}
      >
        {isAccessDenied && (
          <div className="absolute inset-0 pointer-events-none z-0">
            <div className="absolute inset-0 border-2 border-red-500/50 animate-pulse" />
            <div className="absolute top-3 right-3 flex items-center gap-2 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30">
              <span className="flex h-1.5 w-1.5 rounded-full bg-red-700 animate-ping" />
              <span className="text-[9px] font-bold text-red-500 uppercase tracking-wider">
                Alerte Accès
              </span>
            </div>
          </div>
        )}

        <div className="relative z-10">
          {displayUser ? (
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                <div className="w-28 h-28 md:w-32 md:h-32 rounded-2xl bg-muted border-2 border-background shadow-xl overflow-hidden shrink-0 aspect-square">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${(displayUser as User).email}`}
                    alt="Avatar"
                    className="w-full h-full object-cover transform hover:scale-110 transition-transform duration-500"
                  />
                </div>
                <div className="flex-1 text-center sm:text-left space-y-1.5">
                  <h3 className="text-xl md:text-2xl font-black text-foreground tracking-tight leading-tight uppercase">
                    {getFullName(displayUser as User)}
                  </h3>
                  <p className="text-muted-foreground font-bold md:text-base">{(displayUser as User).memberId}</p>
                  <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                    <span className="badge-active px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
                      {normalizeMemberStatus((displayUser as User).status).toUpperCase()}
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-muted border border-border text-[10px] font-mono text-muted-foreground">
                      {(displayUser as User).rfidCard}
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-8">
                <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-sm group hover:bg-muted/50 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                      <Clock size={14} />
                    </div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">
                      {currentScanTime ? (attendance.find(a => !a.checkOut && extractIdFromIri(a.user) === displayUser?.id) ? "Heure de Sortie" : "Heure d'Entrée") : "Dernier passage"}
                    </p>
                  </div>
                  <p className="font-black text-foreground text-base pl-1">
                    {formatTime(currentScanTime || (lastScan?.checkOut || lastScan?.checkIn))}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-muted/30 border border-border/50 backdrop-blur-sm group hover:bg-muted/50 transition-all duration-300">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`p-1.5 rounded-lg ${
                      normalizeMemberStatus((displayUser as User).status) === "active"
                        ? "bg-green-500/10 text-green-500"
                        : "bg-red-500/10 text-red-500"
                    }`}>
                      <UserCheck size={14} />
                    </div>
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Status Membre</p>
                  </div>
                  <p
                    className={`font-black text-base pl-1 ${
                      normalizeMemberStatus((displayUser as User).status) === "active"
                        ? "text-green-500"
                        : "text-red-500"
                    }`}
                  >
                    {normalizeMemberStatus((displayUser as User).status).toUpperCase()}
                  </p>
                </div>
              </div>

              <div
                className={`relative py-6 px-8 rounded-3xl border overflow-hidden flex items-center justify-between mt-6 transition-all duration-500 ${
                  normalizeMemberStatus((displayUser as User).status) === "active"
                    ? "bg-green-500/5 border-green-500/20 shadow-[0_0_20px_rgba(34,197,94,0.05)]"
                    : "bg-red-500/10 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]"
                }`}
              >
                <div className="absolute top-0 left-0 w-1 h-full bg-current opacity-50" />
                <span
                  className={`font-black tracking-[0.3em] uppercase text-lg md:text-xl ${
                    normalizeMemberStatus((displayUser as User).status) === "active"
                      ? "text-green-500"
                      : "text-red-500"
                  }`}
                >
                  {normalizeMemberStatus((displayUser as User).status) === "active"
                    ? "Accès Autorisé"
                    : "Accès Refusé"}
                </span>
                <div
                  className={`h-4 w-4 rounded-full relative ${
                    normalizeMemberStatus((displayUser as User).status) === "active"
                      ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.6)]"
                      : "bg-red-500 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.8)]"
                  }`}
                >
                   {normalizeMemberStatus((displayUser as User).status) !== "active" && (
                     <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-75" />
                   )}
                </div>
              </div>
            </div>
          ) : (
            <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center space-y-8 animate-in fade-in duration-700">
              <div className="relative group">
                <div className="absolute -inset-4 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-all duration-500" />
                <Wifi size={56} className="text-primary/20 animate-pulse relative z-10" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-14 w-14 rounded-full border-2 border-primary/5 border-t-primary/40 animate-spin" />
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="font-black text-foreground text-lg uppercase tracking-[0.2em]">Système en attente</h4>
                <p className="text-muted-foreground text-xs font-medium max-w-[200px] mx-auto leading-relaxed">
                  Présentez un badge RFID ou un QR Code pour valider l'entrée
                </p>
              </div>
            </div>
          )}
        </div>

        {displayUser && (
           <div className="mt-6 flex justify-center sm:justify-start">
              <div className="p-2 bg-white rounded-xl border border-border shadow-sm">
                <QRCodeSVG
                  value={`MADAFIT:${(displayUser as User).memberId}`}
                  size={90}
                  className="w-16 h-16 md:w-20 md:h-20"
                />
              </div>
           </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <style>{`
        @keyframes alert-flash {
          0%, 100% { background-color: transparent; }
          50% { background-color: rgba(239, 68, 68, 0.10); }
        }
        .access-denied-flash {
          animation: alert-flash 0.8s ease-in-out infinite;
        }
        @keyframes scan-line {
          0% { top: 0; opacity: 0; }
          5% { opacity: 1; }
          95% { opacity: 1; }
          100% { top: 100%; opacity: 0; }
        }
        .animate-scan-line {
          animation: scan-line 3s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full space-y-6 px-2 sm:px-4 lg:px-0 max-w-[1600px] mx-auto pb-10">

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-3xl font-black text-foreground uppercase tracking-tight">
              Contrôle d'Accès RFID &amp; QR
            </h1>
            <p className="text-muted-foreground text-xs sm:text-sm font-medium">
              Monitoring en temps réel des passages
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            {isAdmin && (
              <button
                onClick={() => setShowStatsModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/95 transition-all shadow-md shadow-primary/20"
              >
                <BarChart3 size={14} />
                Rapports & Calendrier
              </button>
            )}
            <button
              onClick={() => setShowAllModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border text-xs font-bold text-foreground hover:bg-muted/20 transition-all"
            >
              <History size={14} className="text-primary" />
              Tout l'historique
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 w-fit">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-ping" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Live Monitoring</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-stretch">
          {/* Section Normale sur la page */}
          <div className="xl:col-span-3 min-h-[420px]">
             {!isKioskMode && renderScannerContent()}
          </div>

          {/* PORTAIL : Affichage en mode "Modale Plein Écran" */}
          {isKioskMode && createPortal(
            <div className="fixed inset-0 z-[999] bg-background flex items-center justify-center p-0 sm:p-10 overflow-hidden">
              <div className="absolute inset-0 bg-red-900 backdrop-blur-md" />
              <div className="relative w-full h-full sm:h-auto max-w-[1100px] max-h-none sm:max-h-[650px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-none sm:rounded-[40px] border border-white/10">
                {renderScannerContent()}
              </div>
            </div>,
            document.body
          )}

          {/* Stats column */}
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-4 md:hidden xl:grid">
            {/* Membres en salle */}
            <div
              className="p-6 rounded-3xl text-white shadow-xl shadow-primary/20 flex flex-col justify-between min-h-[160px] overflow-hidden relative"
              style={{ background: "var(--gradient-hero)" }}
            >
              <UserCheck className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
              <div className="relative z-10">
                <p className="text-[10px] sm:text-sm font-bold uppercase tracking-wider opacity-80">
                  Membres en salle
                </p>
                <h4 className="text-4xl sm:text-5xl font-black mt-2">
                  {membersInRoomToday}
                </h4>
              </div>
              <div className="relative z-10 mt-4 flex flex-col gap-1 text-xs font-medium opacity-90 border-t border-white/20 pt-3">
                 <div className="flex items-center justify-between">
                   <span>Visiteurs uniques (Auj.)</span>
                   <span className="font-bold">{todayUniqueMembers}</span>
                 </div>
                 <div className="flex items-center justify-between opacity-70 text-[10px]">
                   <span>Hier</span>
                   <span>{yesterdayData.uniques} uniques</span>
                 </div>
              </div>
            </div>

            {/* Total passages jour */}
            <div className="p-5 md:p-6 rounded-3xl bg-card border border-border shadow-lg flex flex-col justify-between min-h-[160px] overflow-hidden relative">
              <Clock className="absolute -right-4 -bottom-4 w-24 h-24 text-primary opacity-5" />
              <div className="relative z-10">
                <p className="text-[10px] sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                  Total passages jour
                </p>
                <div className="flex items-end gap-3 mt-2">
                  <h4 className="text-4xl sm:text-5xl font-black text-foreground">{totalPassagesToday}</h4>
                  <span className={`text-sm font-bold mb-1.5 ${
                    totalPassagesToday >= yesterdayData.passages 
                      ? 'text-green-500' 
                      : 'text-orange-500'
                  }`}>
                    {totalPassagesToday >= yesterdayData.passages ? '▲' : '▼'} {
                      Math.abs(totalPassagesToday - yesterdayData.passages)
                    }
                  </span>
                </div>
              </div>
              
              {/* Mini historique */}
              <div className="relative z-10 mt-4 flex items-end justify-between h-12 gap-1.5 border-t border-border/50 pt-3">
                 {historyData.map((day, i) => {
                    const maxPassages = Math.max(...historyData.map(d => d.passages), 1);
                    const height = `${(day.passages / maxPassages) * 100}%`;
                    return (
                      <div key={i} className="flex flex-col items-center justify-end flex-1 h-full group relative">
                        <div className="absolute -top-7 bg-foreground text-background text-[9px] font-bold px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20">
                          {day.passages}
                        </div>
                        <div 
                           className={`w-full max-w-[14px] rounded-t-sm transition-all ${i === historyData.length - 1 ? 'bg-primary' : 'bg-primary/20 group-hover:bg-primary/40'}`}
                           style={{ height: day.passages === 0 ? '4px' : height }}
                        />
                        <span className="text-[8px] font-medium text-muted-foreground mt-1 truncate w-full text-center">
                          {day.label}
                        </span>
                      </div>
                    )
                 })}
              </div>
            </div>
          </div>
        </div>

        {/* ── LISTE CARTES + HISTORIQUE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1.8fr] gap-6">

          {/* RFID card list */}
          <div className="rounded-3xl border bg-card p-6 flex flex-col h-[500px]">
            <div className="flex items-center gap-3 mb-4 shrink-0">
              <Wifi size={20} className="text-primary" />
              <h2 className="font-black uppercase text-sm tracking-tighter text-foreground">
                Gestion des Cartes
              </h2>
            </div>
            <div className="relative mb-4 shrink-0">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher une carte..."
                className="search-input w-full pl-10 pr-4 py-3 rounded-xl border border-border bg-background text-sm focus:ring-2 ring-primary/20 outline-none"
              />
            </div>
            <div className="overflow-y-auto space-y-2 flex-1 pr-2 custom-scrollbar">
              {filteredUsers.map((user) => {
                const status = normalizeMemberStatus(user.status);
                return (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUser(user)}
                    className={`w-full rounded-2xl border p-3 text-left transition-all hover:shadow-md flex items-center justify-between ${
                      selectedUser?.id === user.id
                        ? "border-primary bg-primary/5"
                        : "border-border bg-muted/5 hover:bg-muted/10"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="font-bold text-sm truncate uppercase text-foreground">
                        {getFullName(user)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-[10px] font-mono text-muted-foreground uppercase truncate">
                          {user.rfidCard || "Non assignée"}
                        </p>
                        <span
                          className={
                            status === "active"
                              ? "badge-active text-[9px]"
                              : status === "expired"
                              ? "badge-expired text-[9px]"
                              : "badge-suspended text-[9px]"
                          }
                        >
                          {status}
                        </span>
                      </div>
                    </div>
                    <div
                      className={`w-2 h-2 rounded-full shrink-0 ml-2 ${
                        status === "active" ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Historique inline */}
          <div className="rounded-3xl border bg-card overflow-hidden flex flex-col h-[500px] shadow-lg">
            <div className="px-6 py-4 border-b flex items-center justify-between bg-muted/30 shrink-0">
              <h3 className="font-black uppercase text-sm tracking-tighter text-foreground">
                Historique des passages
              </h3>
              <div className="flex items-center gap-3">
                {selectedUser && (
                  <>
                    <button
                      onClick={() => setShowMemberModal(true)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-[10px] font-bold text-primary hover:bg-primary/20 transition-all"
                    >
                      <History size={11} />
                      Historique de {getFullName(selectedUser).split(" ")[0]}
                    </button>
                    <button
                      onClick={() => setSelectedUser(null)}
                      className="text-[10px] font-bold uppercase text-muted-foreground hover:text-foreground transition-colors"
                    >
                      Voir tout
                    </button>
                  </>
                )}
              </div>
            </div>
            <div className="overflow-auto flex-1">
              <AttendanceTable
                records={
                  selectedUser
                    ? getMemberRecords(selectedUser)
                    : attendance
                }
                getRecordAccessStatus={getRecordAccessStatus}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── MODAL HISTORIQUE MEMBRE ── */}
      {showMemberModal && selectedUser && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full h-full sm:h-auto max-w-3xl rounded-none sm:rounded-3xl border bg-card shadow-2xl flex flex-col max-h-none sm:max-h-[85vh]" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="px-6 py-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-muted border border-primary/20 overflow-hidden shrink-0">
                  <img
                    src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedUser.email}`}
                    alt="Avatar"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="font-black text-foreground text-lg leading-tight">
                    {getFullName(selectedUser)}
                  </h2>
                  <p className="text-[10px] font-mono text-muted-foreground">
                    {selectedUser.memberId} · {getMemberRecords(selectedUser).length} passage(s)
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowMemberModal(false)}
                className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <AttendanceTable
                records={getMemberRecords(selectedUser)}
                getRecordAccessStatus={getRecordAccessStatus}
                emptyMessage={`Aucun passage enregistré pour ${getFullName(selectedUser)}.`}
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL HISTORIQUE GÉNÉRAL ── */}
      {showAllModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full h-full sm:h-auto max-w-4xl rounded-none sm:rounded-3xl border bg-card shadow-2xl flex flex-col max-h-none sm:max-h-[85vh]" style={{ borderColor: "hsl(var(--border))" }}>
            <div className="px-6 py-5 border-b flex items-center justify-between shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
              <div>
                <h2 className="font-black text-foreground text-lg uppercase tracking-tight">
                  Historique général des passages
                </h2>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">
                  {attendance.length} passage(s) au total
                </p>
              </div>
              <button
                onClick={() => setShowAllModal(false)}
                className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="overflow-auto flex-1">
              <AttendanceTable
                records={attendance}
                getRecordAccessStatus={getRecordAccessStatus}
                emptyMessage="Aucun passage enregistré pour le moment."
              />
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── MODAL STATISTIQUES EN TEMPS RÉEL (Admin Uniquement) ── */}
      {showStatsModal && createPortal(
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm overflow-hidden animate-in fade-in duration-300">
          <div className="w-full h-full sm:h-auto max-w-6xl rounded-none sm:rounded-3xl border bg-card shadow-2xl flex flex-col max-h-none sm:max-h-[95vh] overflow-hidden" style={{ borderColor: "hsl(var(--border))" }}>
            {/* Header */}
            <div className="px-6 py-4 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0" style={{ borderColor: "hsl(var(--border))" }}>
              <div>
                <h2 className="font-black text-foreground text-lg uppercase tracking-tight flex items-center gap-2">
                  <BarChart3 className="text-primary" size={20} />
                  Analyses & Calendrier de Fréquentation
                </h2>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Statistiques mensuelles et détails des passages par jour
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border bg-background text-xs">
                  <Calendar size={14} className="text-muted-foreground" />
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="bg-transparent border-none outline-none text-foreground font-bold"
                  />
                </div>
                <button
                  onClick={exportToCSV}
                  disabled={monthlyAttendance.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border hover:bg-muted/30 transition-all bg-background disabled:opacity-50"
                >
                  <Download size={14} /> CSV
                </button>
                <button
                  onClick={exportToPDF}
                  disabled={monthlyAttendance.length === 0}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/95 transition-all disabled:opacity-50"
                >
                  <FileText size={14} /> PDF
                </button>
                <button
                  onClick={() => setShowStatsModal(false)}
                  className="p-2 rounded-xl hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Split Layout */}
            <div className="overflow-hidden flex-1 flex flex-col lg:flex-row min-h-0">
              {monthlyAttendanceQuery.isLoading ? (
                <div className="w-full h-96 flex flex-col items-center justify-center text-muted-foreground italic">
                  <Activity className="animate-spin text-primary mb-2" size={32} />
                  Chargement des rapports de passages...
                </div>
              ) : (
                <>
                  {/* Left Column: Calendar */}
                  <div className="w-full lg:w-[45%] p-6 border-r flex flex-col overflow-y-auto custom-scrollbar" style={{ borderColor: "hsl(var(--border))" }}>
                    <div className="space-y-4">
                      <div>
                        <h3 className="font-bold text-xs uppercase tracking-wider text-foreground">
                          Calendrier mensuel ({selectedMonth})
                        </h3>
                        <p className="text-[10px] text-muted-foreground">
                          Sélectionnez un jour pour voir les détails des passages
                        </p>
                      </div>

                      <div className="grid grid-cols-7 gap-1 text-center font-bold text-[10px] text-muted-foreground uppercase py-1 border-b" style={{ borderColor: "hsl(var(--border))" }}>
                        <div>Lun</div>
                        <div>Mar</div>
                        <div>Mer</div>
                        <div>Jeu</div>
                        <div>Ven</div>
                        <div>Sam</div>
                        <div>Dim</div>
                      </div>

                      <div className="grid grid-cols-7 gap-2">
                        {calendarDays.map((cell, idx) => {
                          if (!cell) {
                            return <div key={`empty-${idx}`} className="h-12 w-full" />;
                          }

                          const dayPassages = monthlyAttendance.filter(r => (typeof r.date === 'string' ? r.date.substring(0, 10) : '') === cell.dateStr).length;

                          return (
                            <button
                              key={`day-${cell.day}`}
                              onClick={() => setSelectedDate(cell.dateStr)}
                              className={`h-12 w-full rounded-xl flex flex-col items-center justify-center border transition-all text-xs font-bold ${
                                selectedDate === cell.dateStr
                                  ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                                  : "border-border bg-card hover:bg-muted/10"
                              }`}
                            >
                              <span>{cell.day}</span>
                              {dayPassages > 0 && (
                                <span className={`text-[8px] mt-0.5 px-1 py-0.2 rounded-full font-black ${
                                  selectedDate === cell.dateStr ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                                }`}>
                                  {dayPassages}
                                </span>
                              )}
                            </button>
                          );
                        })}
                      </div>

                      <div className="p-4 rounded-2xl bg-muted/20 border border-border/50 space-y-2 mt-4 text-[10px] text-muted-foreground">
                        <p className="font-bold uppercase tracking-wider text-foreground mb-1 text-[9px]">Indicateurs du mois complet</p>
                        <div className="flex justify-between">
                          <span>Total passages :</span>
                          <span className="font-bold text-foreground">{totalPassages}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Membres uniques :</span>
                          <span className="font-bold text-foreground">{uniqueMembers}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Heure de pointe :</span>
                          <span className="font-bold text-foreground">{peakHour}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Diagram + Selected Day Details */}
                  <div className="w-full lg:w-[55%] p-6 flex flex-col min-h-0 bg-muted/5 overflow-y-auto custom-scrollbar">
                    <div className="space-y-6 flex-1 flex flex-col min-h-0">
                      
                      {/* Diagram */}
                      <div className="p-4 rounded-2xl border border-border/50 bg-card">
                        <h4 className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground mb-3">
                          Diagramme de fréquentation du mois
                        </h4>
                        <div className="h-[140px]">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--card))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "10px",
                                  fontSize: "10px"
                                }}
                              />
                              <Line type="monotone" dataKey="passages" stroke="hsl(var(--primary))" strokeWidth={1.5} name="Passages" dot={{ r: 1.5 }} />
                              <Line type="monotone" dataKey="uniques" stroke="hsl(var(--accent))" strokeWidth={1.5} name="Uniques" dot={{ r: 1.5 }} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Selected Day Details */}
                      {selectedDate ? (
                        <div className="flex-1 flex flex-col min-h-0 space-y-4">
                          <div className="border-t pt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2" style={{ borderColor: "hsl(var(--border))" }}>
                            <div>
                              <h3 className="font-black text-sm uppercase tracking-tight text-foreground">
                                Détails du {formatDate(selectedDate)}
                              </h3>
                              <p className="text-[10px] text-muted-foreground">
                                Synthèse de la journée sélectionnée
                              </p>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 rounded-2xl bg-card border border-border/50 flex flex-col">
                              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Total passages</span>
                              <span className="text-xl font-black text-foreground mt-1">{selectedDatePassages}</span>
                            </div>
                            <div className="p-4 rounded-2xl bg-card border border-border/50 flex flex-col">
                              <span className="text-[9px] text-muted-foreground uppercase font-bold tracking-wider">Membres en salle</span>
                              <span className="text-xl font-black text-primary mt-1">{selectedDateInGym}</span>
                            </div>
                          </div>

                          {/* List of Passages */}
                          <div className="flex-1 flex flex-col min-h-0 space-y-2">
                            <h4 className="font-bold text-[10px] uppercase tracking-wider text-muted-foreground">
                              Passages de la journée ({selectedDateRecords.length})
                            </h4>
                            <div className="overflow-x-auto border border-border/40 rounded-xl bg-card flex-1 min-h-[150px]">
                              <table className="w-full text-xs">
                                <thead>
                                  <tr className="text-left text-[9px] font-bold text-muted-foreground uppercase tracking-wider border-b bg-muted/20">
                                    <th className="p-3">Membre</th>
                                    <th className="p-3">Entrée</th>
                                    <th className="p-3">Sortie</th>
                                    <th className="p-3">RFID</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-border/40">
                                  {selectedDateRecords.map((record) => (
                                    <tr key={record.id} className="hover:bg-muted/10 transition-colors">
                                      <td className="p-3">
                                        <div className="font-bold text-foreground uppercase">{record.memberName || "Membre"}</div>
                                        {record.memberId && <div className="text-[9px] text-muted-foreground">{record.memberId}</div>}
                                      </td>
                                      <td className="p-3 font-bold text-primary">
                                        {formatTime(record.checkIn)}
                                      </td>
                                      <td className="p-3 text-muted-foreground">
                                        {formatTime(record.checkOut) || (
                                          <span className="px-2 py-0.5 rounded-full text-[9px] font-black uppercase bg-green-500/10 text-green-500 border border-green-500/20">
                                            En salle
                                          </span>
                                        )}
                                      </td>
                                      <td className="p-3 font-mono text-[10px]">
                                        {record.rfidCard || "—"}
                                      </td>
                                    </tr>
                                  ))}
                                  {selectedDateRecords.length === 0 && (
                                    <tr>
                                      <td colSpan={4} className="p-6 text-center text-muted-foreground italic">
                                        Aucun passage enregistré pour cette date.
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center text-muted-foreground italic text-xs">
                          Sélectionnez un jour dans le calendrier pour voir les détails
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
      {/* Overlay de verrouillage d'écran */}
      {isScreenLocked && (
        <div 
          className="fixed inset-0 z-[1500]" 
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toast.warning("L'écran est verrouillé", { id: "screen-locked" });
          }}
          onMouseDownCapture={(e) => {
            e.stopPropagation();
          }}
          onTouchStartCapture={(e) => {
            e.stopPropagation();
          }}
        />
      )}

      {/* Bouton de verrouillage/déverrouillage (Cadenas) */}
      <button
        onClick={() => {
          setIsScreenLocked(!isScreenLocked);
          if (!isScreenLocked) {
            toast.success("Écran verrouillé");
          } else {
            toast.success("Écran déverrouillé");
          }
        }}
        className={`fixed bottom-6 right-6 z-[2000] flex items-center justify-center w-14 h-14 rounded-full shadow-2xl transition-all duration-500 ${
          isScreenLocked 
            ? "bg-red-500 hover:bg-red-600 text-white shadow-[0_10px_30px_rgba(239,68,68,0.4)]" 
            : "bg-black/40 hover:bg-black/60 text-white/80 hover:text-white backdrop-blur-md border border-white/10"
        } ${!showLockButton ? "opacity-0 translate-y-10 pointer-events-none" : "opacity-100 translate-y-0"}`}
        title={isScreenLocked ? "Déverrouiller l'écran" : "Verrouiller l'écran"}
      >
        {isScreenLocked ? <Lock size={24} /> : <Unlock size={24} />}
      </button>
    </>
  );
}

// ── COMPOSANT TABLE RÉUTILISABLE ─────────────────────────────────────────────
function AttendanceTable({
  records,
  getRecordAccessStatus,
  emptyMessage = "Aucun passage enregistré pour le moment.",
}: {
  records: AttendanceRecord[];
  getRecordAccessStatus: (record: AttendanceRecord) => "authorized" | "denied";
  emptyMessage?: string;
}) {
  // On aplatit les records : une ligne par checkIn, une ligne par checkOut
  const events: any[] = [];
  records.forEach(r => {
    if (r.checkIn) {
      events.push({
        ...r,
        displayTime: r.checkIn,
        type: 'ENTRÉE',
        sortKey: `${r.date}T${r.checkIn}`
      });
    }
    if (r.checkOut) {
      events.push({
        ...r,
        displayTime: r.checkOut,
        type: 'SORTIE',
        sortKey: `${r.date}T${r.checkOut}`
      });
    }
  });

  // Tri par date/heure décroissante
  events.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="sticky top-0 bg-card border-b">
          <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
            <th className="p-5">Membre</th>
            <th className="p-5">ID Carte</th>
            <th className="p-5">Heure</th>
            <th className="p-5">Événement</th>
            <th className="p-5">Statut</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {events.length === 0 ? (
            <tr>
              <td colSpan={5} className="p-10 text-center text-muted-foreground italic">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            events.map((event, idx) => {
              const accessStatus = getRecordAccessStatus(event);
              return (
                <tr key={`${event.id}-${event.type}-${idx}`} className="hover:bg-muted/30 transition-colors">
                  <td className="p-5">
                    <div className="font-bold text-foreground uppercase">
                      {event.memberName || "Membre"}
                    </div>
                    {event.memberId && (
                      <div className="text-[10px] text-muted-foreground">{event.memberId}</div>
                    )}
                  </td>
                  <td className="p-5">
                    <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                      {event.rfidCard || "—"}
                    </span>
                  </td>
                  <td className="p-5">
                    <div className="text-[10px] font-bold opacity-50 uppercase">
                      {formatDate(event.date)}
                    </div>
                    <div className="text-base font-black text-primary">
                      {formatTime(event.displayTime)}
                    </div>
                  </td>
                  <td className="p-5">
                    <span
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                        event.type === 'SORTIE'
                          ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                          : "bg-green-500/10 text-green-500 border-green-500/20"
                      }`}
                    >
                      {event.type}
                    </span>
                  </td>
                  <td className="p-5">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                        accessStatus === "authorized"
                          ? "bg-green-500/10 text-green-500 border-green-500/20"
                          : "bg-red-500/10 text-red-500 border-red-500/20"
                      }`}
                    >
                      <span
                        className={`w-1.5 h-1.5 rounded-full ${
                          accessStatus === "authorized" ? "bg-green-500" : "bg-red-500"
                        }`}
                      />
                      {accessStatus === "authorized" ? "Autorisé" : "Refusé"}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}