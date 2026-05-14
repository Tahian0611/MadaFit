import { QRCodeSVG } from "qrcode.react";
import { useMemo, useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Wifi, QrCode, UserCheck, UserX, Clock, X, History, Maximize2, Minimize2 } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { refreshNotifications } from '@/services/api';
import api from "@/services/api";
import { extractHydraMembers, getFullName, normalizeMemberStatus, formatDate } from "@/lib/madafit";
import type { User, AttendanceRecord } from "@/types/entities";

export default function AccessControl() {
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [search, setSearch] = useState("");
  const [lastScan, setLastScan] = useState<AttendanceRecord | null>(null);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [showAllModal, setShowAllModal] = useState(false);
  const qrScannerRef = useRef<Html5Qrcode | null>(null);
  const sectionRef = useRef<HTMLDivElement>(null);
  const [isFullScreen, setIsFullScreen] = useState(false);
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
        await new Promise((resolve) => setTimeout(resolve, 200));
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
                setSelectedUser(foundUser);

                const nowObj = new Date();
                const dateStr = nowObj.toISOString().split("T")[0];
                const timeStr = nowObj.toTimeString().split(" ")[0];

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

    const handleFsChange = () => {
      setIsFullScreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handleFsChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFsChange);
      if (scanner) {
        try {
          if (scanner.isScanning) scanner.stop().catch(() => {});
        } catch (e) {
          // silence
        }
        qrScannerRef.current = null;
      }
    };
  }, [users.length]);

  const toggleFullScreen = () => {
    if (!sectionRef.current) return;
    if (!document.fullscreenElement) {
      sectionRef.current.requestFullscreen().catch((err) => {
        toast.error(`Erreur: ${err.message}`);
      });
    } else {
      document.exitFullscreen();
    }
  };

  useEffect(() => {
    if (attendance.length > 0) setLastScan(attendance[0]);
  }, [attendance]);

  const filteredUsers = useMemo(() => {
    return users.filter((user) =>
      `${getFullName(user)} ${user.rfidCard ?? ""}`.toLowerCase().includes(search.toLowerCase())
    );
  }, [users, search]);

  const lastScanUser = useMemo(() => {
    if (!lastScan) return null;
    return users.find((u) => {
      const scanUser = lastScan.user as string | User;
      if (typeof scanUser === "string") return scanUser === `/api/users/${u.id}`;
      return scanUser?.id === u.id || lastScan.memberId === u.memberId;
    });
  }, [lastScan, users]);

  const displayUser = selectedUser || lastScanUser;

  const isAccessDenied =
    displayUser &&
    normalizeMemberStatus((displayUser as User).status) !== "active";

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
    return normalizeMemberStatus(matchedUser.status) === "active" ? "authorized" : "denied";
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

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">

          <div 
            ref={sectionRef}
            className={`xl:col-span-3 rounded-l-xl border bg-card overflow-hidden shadow-2xl flex flex-col md:flex-row min-h-[450px] md:min-h-[85vh] xl:min-h-[450px] relative ${
              isFullScreen ? "p-4 md:p-10 bg-background" : ""
            }`}
          >
            {/* Fullscreen toggle button */}
            <button
              onClick={toggleFullScreen}
              className="absolute top-4 right-4 z-[60] p-3 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 text-white hover:bg-black/60 transition-all shadow-xl"
              title={isFullScreen ? "Quitter le plein écran" : "Passer en plein écran"}
            >
              {isFullScreen ? <Minimize2 size={20} /> : <Maximize2 size={20} />}
            </button>

            <div className="relative bg-black w-full md:w-1/2 min-h-[300px] md:min-h-full flex items-center justify-center overflow-hidden">
              <div
                id="qr-reader"
                className="absolute inset-0 w-full h-full object-cover opacity-80"
                style={{ border: "none" }}
              />
              <div className="absolute inset-0 z-10 pointer-events-none border border-primary/30">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-64 sm:h-64 md:w-80 md:h-80 border-2 border-primary/50 rounded-2xl">
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-1 bg-primary/50 shadow-[0_0_20px_rgba(var(--primary-rgb),0.8)] animate-scan-line" />
                </div>
              </div>
              <div className="z-20 absolute top-4 left-4 flex items-center gap-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-lg border border-white/10">
                <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                <span className="text-[10px] text-white font-bold uppercase tracking-wider">SCANNER ACTIF</span>
              </div>
              <div className="absolute bottom-4 right-4 z-20">
                <QrCode size={24} className="text-primary/70" />
              </div>
            </div>

            <div
              className={`w-full md:w-1/2 p-6 sm:p-8 flex flex-col justify-between bg-gradient-to-br from-card to-muted/30 relative transition-all duration-300 ${
                isAccessDenied ? "access-denied-flash" : ""
              }`}
            >
              {isAccessDenied && (
                <div className="absolute inset-0 pointer-events-none z-0">
                  <div className="absolute inset-0 border-2 border-red-500/50 animate-pulse" />
                  <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/15 border border-red-500/30">
                    <span className="flex h-2 w-2 rounded-full bg-red-700 animate-ping" />
                    <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                      Alerte Accès
                    </span>
                  </div>
                </div>
              )}

              <div className="relative z-10">
                {displayUser ? (
                  <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row items-center gap-6">
                      <div className="w-24 h-24 md:w-32 md:h-32 rounded-2xl bg-muted border-2 border-primary/20 overflow-hidden shadow-xl shrink-0">
                        <img
                          src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${(displayUser as User).email}`}
                          alt="Avatar"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 text-center sm:text-left">
                        <h3 className="text-xl sm:text-2xl md:text-3xl font-black text-foreground leading-tight">
                          {getFullName(displayUser as User)}
                        </h3>
                        <p className="text-muted-foreground font-medium md:text-lg">{(displayUser as User).memberId}</p>
                        <div className="flex items-center justify-center sm:justify-start gap-2 mt-2">
                          <span className="badge-active px-3 py-1 rounded-full text-[10px] md:text-xs font-bold">
                            {normalizeMemberStatus((displayUser as User).status).toUpperCase()}
                          </span>
                          <span className="text-[10px] md:text-xs font-mono text-muted-foreground">
                            {(displayUser as User).rfidCard}
                          </span>
                        </div>
                        <div className="mt-4 p-2 bg-white rounded-xl inline-block border border-border shadow-sm">
                          <QRCodeSVG
                            value={`MADAFIT:${(displayUser as User).memberId}`}
                            size={120}
                            className="w-16 h-16 sm:w-20 sm:h-20 md:w-32 md:h-32"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="p-4 rounded-2xl bg-background border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Dernier scan</p>
                        <p className="font-bold text-foreground flex items-center gap-2 text-sm sm:text-base">
                          <Clock size={14} className="text-primary" />
                          {displayUser === lastScanUser
                            ? lastScan?.checkIn
                              ? lastScan.checkIn.substring(0, 5)
                              : "À l'instant"
                            : "Consultation"}
                        </p>
                      </div>
                      <div className="p-4 rounded-2xl bg-background border border-border">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase mb-1">Status Carte</p>
                        <p
                          className={`font-bold flex items-center gap-2 text-sm sm:text-base ${
                            normalizeMemberStatus((displayUser as User).status) === "active"
                              ? "text-green-500"
                              : "text-red-500"
                          }`}
                        >
                          {normalizeMemberStatus((displayUser as User).status) === "active" ? (
                            <UserCheck size={14} />
                          ) : (
                            <UserX size={14} />
                          )}
                          {normalizeMemberStatus((displayUser as User).status).toUpperCase()}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`py-6 px-8 rounded-2xl border flex items-center justify-between ${
                        normalizeMemberStatus((displayUser as User).status) === "active"
                          ? "bg-green-500/10 border-green-500/20"
                          : "bg-red-500/20 border-red-500/40 animate-pulse"
                      }`}
                    >
                      <span
                        className={`font-black tracking-[0.2em] uppercase text-sm sm:text-base ${
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
                        className={`h-4 w-4 rounded-full ${
                          normalizeMemberStatus((displayUser as User).status) === "active"
                            ? "bg-green-500 shadow-[0_0_15px_rgba(34,197,94,0.5)]"
                            : "bg-red-500 shadow-[0_0_20px_rgba(239,68,68,0.9)] animate-ping"
                        }`}
                      />
                    </div>
                  </div>
                               ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-10">
                    <div className="relative">
                      <Wifi size={48} className="text-primary/30 animate-pulse" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-12 w-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                      </div>
                    </div>
                    <p className="font-black text-muted-foreground uppercase tracking-widest text-xs animate-pulse">
                      En attente d'un membre...
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

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
                  {record.checkIn ? record.checkIn.substring(0, 5) : "--:--"}
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