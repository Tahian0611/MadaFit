import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Wifi, QrCode, UserCheck, UserX, Clock, X, History, Maximize2, Minimize2 } from "lucide-react";
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
  isMemberAccessAuthorized 
} from "@/lib/madafit";
import type { User, AttendanceRecord } from "@/types/entities";

export default function AccessControl() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [lastScan, setLastScan] = useState<AttendanceRecord | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const [isKioskMode, setIsKioskMode] = useState(false);
  const [currentScanTime, setCurrentScanTime] = useState<string | null>(null);
  const lastScanTime = useRef<number>(0);

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
                const dateStr = nowObj.toISOString().split("T")[0];

                setSelectedUser(foundUser);
                setCurrentScanTime(timeStr);

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
      }, 10000); // 10 secondes d'affichage
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
                    <p className="text-[9px] font-black text-muted-foreground uppercase tracking-[0.1em]">Dernier passage</p>
                  </div>
                  <p className="font-black text-foreground text-base pl-1">
                    {formatTime(currentScanTime || lastScan?.checkIn)}
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
            <div className="fixed inset-0 z-[999] bg-background flex items-center justify-center p-4 sm:p-10 overflow-hidden">
              <div className="absolute inset-0 bg-red-900 backdrop-blur-md" />
              <div className="relative w-full h-full max-w-[1100px] max-h-[650px] overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.8)] rounded-3xl sm:rounded-[40px] border border-white/10">
                {renderScannerContent()}
                
                {/* Bouton de fermeture flottant discret mais accessible */}
                <button 
                  onClick={toggleFullScreen}
                  className="absolute bottom-6 right-6 z-[1000] flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-red-500/90 hover:bg-red-600 text-white font-black shadow-[0_15px_30px_rgba(239,68,68,0.3)] transition-all active:scale-95 border border-white/20 backdrop-blur-md group"
                >
                  <X size={20} className="group-hover:rotate-90 transition-transform duration-300" />
                  <span className="text-xs tracking-[0.1em] uppercase">Quitter le Scan</span>
                </button>
              </div>
            </div>,
            document.body
          )}

          {/* Stats column */}
          <div className="grid grid-cols-2 xl:grid-cols-1 gap-4 md:hidden xl:grid">
            <div
              className="p-6 rounded-3xl text-white shadow-xl shadow-primary/20 flex flex-col justify-between min-h-[140px] overflow-hidden relative"
              style={{ background: "var(--gradient-hero)" }}
            >
              <UserCheck className="absolute -right-4 -bottom-4 w-24 h-24 opacity-10" />
              <p className="text-[10px] sm:text-sm font-bold uppercase tracking-wider opacity-80">
                Membres en salle
              </p>
              <h4 className="text-4xl sm:text-5xl font-black">
                {attendance.filter((r) => !r.checkOut).length}
              </h4>
            </div>
            <div className="p-6 rounded-3xl bg-card border border-border shadow-lg flex flex-col justify-between min-h-[140px] overflow-hidden relative">
              <Clock className="absolute -right-4 -bottom-4 w-24 h-24 text-primary opacity-5" />
              <p className="text-[10px] sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">
                Total passages jour
              </p>
              <h4 className="text-4xl sm:text-5xl font-black text-foreground">{attendance.length}</h4>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-3xl rounded-3xl border bg-card shadow-2xl flex flex-col max-h-[85vh]" style={{ borderColor: "hsl(var(--border))" }}>
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
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-4xl rounded-3xl border bg-card shadow-2xl flex flex-col max-h-[85vh]" style={{ borderColor: "hsl(var(--border))" }}>
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
  return (
    <table className="w-full min-w-[560px] text-sm">
      <thead className="sticky top-0 bg-card border-b">
        <tr className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
          <th className="p-5">Membre</th>
          <th className="p-5">ID Carte</th>
          <th className="p-5">Heure</th>
          <th className="p-5">Type</th>
          <th className="p-5">Statut</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border/40">
        {records.map((record) => {
          const accessStatus = getRecordAccessStatus(record);
          return (
            <tr key={record.id} className="hover:bg-muted/30 transition-colors">
              <td className="p-5">
                <div className="font-bold text-foreground uppercase">
                  {record.memberName || "Membre"}
                </div>
                {record.memberId && (
                  <div className="text-[10px] text-muted-foreground">{record.memberId}</div>
                )}
              </td>
              <td className="p-5">
                <span className="font-mono text-xs bg-muted px-2 py-1 rounded-md">
                  {record.rfidCard || "—"}
                </span>
              </td>
              <td className="p-5">
                <div className="text-[10px] font-bold opacity-50 uppercase">
                  {formatDate(record.date)}
                </div>
                <div className="text-base font-black text-primary">
                  {formatTime(record.checkIn)}
                </div>
              </td>
              <td className="p-5">
                <span
                  className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${
                    record.checkOut
                      ? "bg-orange-500/10 text-orange-500 border-orange-500/20"
                      : "bg-green-500/10 text-green-500 border-green-500/20"
                  }`}
                >
                  {record.checkOut ? "Sortie" : "Présent"}
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
        })}
        {records.length === 0 && (
          <tr>
            <td colSpan={5} className="p-10 text-center text-muted-foreground italic">
              {emptyMessage}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}