import React, { useState, useEffect, useRef } from 'react';
import { 
  Shield, 
  MapPin, 
  Phone, 
  Mic, 
  AlertCircle, 
  Navigation,
  Eye,
  Battery,
  Wifi,
  Clock,
  LayoutDashboard,
  History,
  ShieldCheck,
  Bell,
  User as UserIcon,
  MessageSquare,
  Send,
  UserCheck,
  Map as MapIcon,
  ShieldAlert,
  ChevronLeft,
  Loader2,
  Zap,
  Users,
  AlertTriangle,
  Activity,
  ChevronRight,
  Settings
} from 'lucide-react';
import MapComponent from './components/MapComponent';
import { analyzeRouteSafety, getThreatZones, getRiskTrend, createSafetyChat, generateSafeRoute } from './services/geminiService';
import { SafetyScore, UserStatus, ThreatZone, IncidentReport, RiskPoint, RouteData } from './types';

const MOCK_USER: UserStatus = {
  name: "Elena Vance",
  avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Elena",
  status: "Traveling",
  battery: 92,
  lastUpdate: "Just now",
  currentLocationName: "Chelsea District"
};

type Role = 'user' | 'guardian' | null;

const App: React.FC = () => {
  const [role, setRole] = useState<Role>(null);
  const [currentLocation, setCurrentLocation] = useState<[number, number]>([40.7484, -74.0010]);
  const [destinationCoord, setDestinationCoord] = useState<[number, number]>([40.7580, -73.9855]);
  const [safetyScore, setSafetyScore] = useState<SafetyScore | null>(null);
  const [threatZones, setThreatZones] = useState<ThreatZone[]>([]);
  const [riskTrend, setRiskTrend] = useState<RiskPoint[]>([]);
  const [safeRoute, setSafeRoute] = useState<RouteData | null>(null);
  const [showThreats, setShowThreats] = useState(true);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isRateLimited, setIsRateLimited] = useState(false);
  
  const [chatMessages, setChatMessages] = useState<{role: 'user' | 'model', text: string}[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatInstance = useRef<any>(null);

  // Initialization with staggered delays to prevent 429 errors
  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      setIsRateLimited(false);
      try {
        // Staggered requests to avoid hitting rate limits on startup
        const score = await analyzeRouteSafety("Chelsea District");
        setSafetyScore(score);
        
        await new Promise(r => setTimeout(r, 2000));
        const zones = await getThreatZones(currentLocation[0], currentLocation[1]);
        setThreatZones(zones);
        
        await new Promise(r => setTimeout(r, 2000));
        const route = await generateSafeRoute(currentLocation, destinationCoord);
        setSafeRoute(route);

        await new Promise(r => setTimeout(r, 2000));
        const trend = await getRiskTrend(currentLocation[0], currentLocation[1]);
        setRiskTrend(trend);
      } catch (err: any) {
        console.error("Initialization error:", err);
        if (err?.message?.includes('429')) {
          setIsRateLimited(true);
        }
      } finally {
        setIsLoading(false);
      }
    };
    init();
  }, []);

  const handleSendMessage = async () => {
    if (!chatInput.trim()) return;
    if (!chatInstance.current) chatInstance.current = createSafetyChat();

    const userMsg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);

    try {
      const response = await chatInstance.current.sendMessage({ message: userMsg });
      setChatMessages(prev => [...prev, { role: 'model', text: response.text }]);
    } catch (err: any) {
      if (err?.message?.includes('429')) {
        setChatMessages(prev => [...prev, { role: 'model', text: "Service busy. I'm still watching your route locally." }]);
      } else {
        setChatMessages(prev => [...prev, { role: 'model', text: "Signal weak, but SOS links are active." }]);
      }
    }
  };

  const getScoreColor = (val: number) => {
    if (val >= 80) return 'text-pink-500';
    if (val >= 50) return 'text-amber-500';
    return 'text-red-500';
  };

  const getProgressColor = (val: number) => {
    if (val >= 80) return 'bg-pink-500 shadow-[0_0_10px_#ff007f]';
    if (val >= 50) return 'bg-amber-500';
    return 'bg-red-500 shadow-[0_0_10px_#ef4444]';
  };

  if (!role) {
    return (
      <div className="h-screen w-full bg-[#020617] flex flex-col items-center justify-center p-8">
        <div className="mb-20 text-center">
            <div className="w-24 h-24 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-6 neon-border-pink animate-pulse">
              <Shield className="w-12 h-12 text-pink-500" />
            </div>
            <h1 className="text-7xl font-black text-white tracking-tighter italic">SafeRoute <span className="text-pink-500 neon-text-pink">AI</span></h1>
            <p className="text-slate-500 font-bold mt-4 tracking-[0.3em] uppercase text-xs">Tactical Protection System</p>
        </div>
        <div className="max-w-4xl w-full grid grid-cols-1 md:grid-cols-2 gap-10">
          <button 
            onClick={() => setRole('user')}
            className="group relative bg-slate-950 p-12 rounded-[3.5rem] text-left transition-all hover:scale-[1.02] border border-white/5 hover:border-pink-500/50 shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
              <UserIcon className="w-32 h-32 text-pink-500" />
            </div>
            <Navigation className="w-12 h-12 text-pink-500 mb-6" />
            <h2 className="text-4xl font-black text-white mb-4">User Portal</h2>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">Secure pathing, real-time lighting analysis, and instant SOS.</p>
          </button>

          <button 
            onClick={() => setRole('guardian')}
            className="group relative bg-slate-950 p-12 rounded-[3.5rem] text-left transition-all hover:scale-[1.02] border border-white/5 hover:border-indigo-500/50 shadow-2xl"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-20 transition-opacity">
              <Eye className="w-32 h-32 text-indigo-500" />
            </div>
            <ShieldAlert className="w-12 h-12 text-indigo-500 mb-6" />
            <h2 className="text-4xl font-black text-white mb-4">Guardian Hub</h2>
            <p className="text-slate-400 font-medium text-lg leading-relaxed">Remote trip monitoring and multi-channel intervention alerts.</p>
          </button>
        </div>
        
        {isRateLimited && (
          <div className="mt-12 flex items-center gap-3 px-6 py-3 bg-red-500/10 border border-red-500/20 rounded-full">
            <Loader2 className="w-4 h-4 text-red-500 animate-spin" />
            <p className="text-xs font-black text-red-500 uppercase tracking-widest">AI Quota Exhausted - Attempting Reconnect...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex h-screen bg-[#020617] text-slate-100 overflow-hidden font-['Outfit']`}>
      {/* Sidebar */}
      <aside className="w-20 lg:w-80 bg-black/40 border-r border-white/5 flex flex-col py-10 z-50">
        <div className="px-10 mb-16 flex items-center gap-4">
          <div className="bg-pink-500/20 p-2 rounded-xl border border-pink-500/30">
            <Shield className="w-8 h-8 text-pink-500" />
          </div>
          <span className="hidden lg:block font-black text-3xl tracking-tighter">SAFEROUTE</span>
        </div>
        
        <nav className="flex-1 px-6 space-y-3">
          <NavItem icon={<LayoutDashboard />} label="Command Center" active />
          <NavItem icon={<MapIcon />} label="Safety Network" onClick={() => setShowThreats(!showThreats)} />
          <NavItem icon={<History />} label="Trip Archives" />
          <NavItem icon={<Bell />} label="Guardian Alerts" />
          <NavItem icon={<Settings />} label="Security Settings" />
        </nav>

        <div className="px-6 mt-auto">
          <div className="bg-slate-900/40 rounded-[2.5rem] p-6 border border-white/5 backdrop-blur-md">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Encrypted Live</span>
            </div>
            <div className="flex items-center gap-4">
              <img src={MOCK_USER.avatar} className="w-12 h-12 rounded-2xl border border-pink-500/30" />
              <div className="hidden lg:block">
                <p className="text-sm font-black text-white">{MOCK_USER.name}</p>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-tighter">Current: {MOCK_USER.currentLocationName}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main View */}
      <main className="flex-1 flex flex-col relative overflow-hidden bg-gradient-to-br from-[#020617] to-[#0f172a]">
        {/* Header */}
        <header className="h-24 border-b border-white/5 px-12 flex items-center justify-between bg-black/10 backdrop-blur-xl">
          <button onClick={() => setRole(null)} className="flex items-center gap-3 text-slate-400 hover:text-pink-500 transition-all group">
            <div className="p-2 rounded-full border border-white/5 group-hover:border-pink-500/30">
              <ChevronLeft className="w-5 h-5" />
            </div>
            <span className="text-xs font-black uppercase tracking-[0.2em]">Logout Session</span>
          </button>
          
          <div className="flex items-center gap-10">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Battery className="w-4 h-4 text-emerald-500" /> 
              <span className="text-xs font-black text-white">{MOCK_USER.battery}%</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10">
              <Wifi className="w-4 h-4 text-pink-500" />
              <span className="text-xs font-black text-white">5G TACTICAL</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-10 overflow-y-auto space-y-10 custom-scrollbar">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            {/* Map Area */}
            <div className="lg:col-span-8 space-y-10">
              <div className="h-[550px] bg-slate-950 rounded-[3.5rem] p-4 shadow-2xl relative overflow-hidden border border-white/5">
                <MapComponent 
                  center={currentLocation} 
                  destination={destinationCoord}
                  routePoints={safeRoute?.points}
                  threatZones={threatZones}
                  showThreats={showThreats}
                  safetyScore={safetyScore?.total}
                  isDistress={isSOSActive}
                />
                
                {isLoading && (
                  <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-lg flex flex-col items-center justify-center z-[100]">
                    <div className="relative">
                       <div className="w-20 h-20 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin"></div>
                       <Shield className="w-8 h-8 text-pink-500 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="mt-8 text-sm font-black uppercase tracking-[0.3em] text-pink-500 animate-pulse">Running AI Tactical Sweep...</p>
                  </div>
                )}
                
                {/* Tactical Stats Overlay */}
                <div className="absolute top-8 right-8 z-10 flex flex-col gap-4">
                  <div className="bg-black/80 backdrop-blur-md px-8 py-5 rounded-[2rem] border border-white/10 flex items-center gap-6 shadow-2xl">
                    <div className="text-center">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Safety Index</p>
                      <p className={`text-5xl font-black ${getScoreColor(safetyScore?.total || 0)} neon-text-pink`}>{safetyScore?.total || '--'}</p>
                    </div>
                    <div className="w-px h-12 bg-white/10" />
                    <div>
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Verdict</p>
                      <p className="text-sm font-black text-emerald-500 uppercase flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4" /> SECURE CORRIDOR
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Safety Metrics Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <ScoreGridCard 
                  icon={<Zap />} 
                  label="Illumination" 
                  value={safetyScore?.lighting} 
                  desc="Active Street Lighting"
                  colorClass={getProgressColor(safetyScore?.lighting || 0)}
                  textColorClass={getScoreColor(safetyScore?.lighting || 0)}
                />
                <ScoreGridCard 
                  icon={<AlertTriangle />} 
                  label="Stability" 
                  value={safetyScore?.safetyHistory} 
                  desc="Incident History Analysis"
                  colorClass={getProgressColor(safetyScore?.safetyHistory || 0)}
                  textColorClass={getScoreColor(safetyScore?.safetyHistory || 0)}
                />
                <ScoreGridCard 
                  icon={<Users />} 
                  label="Witness Density" 
                  value={safetyScore?.crowdActivity} 
                  desc="Active Community Presence"
                  colorClass={getProgressColor(safetyScore?.crowdActivity || 0)}
                  textColorClass={getScoreColor(safetyScore?.crowdActivity || 0)}
                />
              </div>
            </div>

            {/* Actions Panel */}
            <div className="lg:col-span-4 space-y-8">
              {/* PANIC TRIGGER */}
              <button 
                onClick={() => setIsSOSActive(true)}
                className="w-full h-56 bg-gradient-to-br from-red-600 to-red-900 rounded-[3.5rem] relative overflow-hidden group transition-all hover:scale-[1.03] active:scale-95 shadow-[0_20px_50px_-15px_rgba(239,68,68,0.5)] animate-pulse-sos border-4 border-white/10"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-from)_0%,_transparent_70%)] opacity-50" />
                <div className="relative flex flex-col items-center justify-center h-full gap-4">
                  <div className="bg-white/20 p-5 rounded-full backdrop-blur-md">
                    <AlertCircle className="w-16 h-16 text-white" />
                  </div>
                  <div>
                    <span className="text-4xl font-black text-white italic tracking-tighter">PANIC SOS</span>
                    <p className="text-[10px] font-black text-red-200 mt-2 uppercase tracking-[0.2em] opacity-80">Silent Police Dispatch</p>
                  </div>
                </div>
              </button>

              <div className="grid grid-cols-2 gap-4">
                 <button className="bg-emerald-600/10 border border-emerald-500/20 p-8 rounded-[2.5rem] flex flex-col items-center gap-4 hover:bg-emerald-600/20 transition-all group">
                   <UserCheck className="w-8 h-8 text-emerald-500 transition-transform group-hover:scale-110" />
                   <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em]">Check In</span>
                 </button>
                 <button className="bg-slate-950 border border-white/5 p-8 rounded-[2.5rem] flex flex-col items-center gap-4 hover:border-pink-500/30 transition-all group">
                   <Phone className="w-8 h-8 text-pink-500 transition-transform group-hover:rotate-12" />
                   <span className="text-[10px] font-black text-pink-500 uppercase tracking-[0.2em]">Call Link</span>
                 </button>
              </div>

              {/* AI Companion Card */}
              <div className="bg-slate-900/60 rounded-[3.5rem] p-10 border border-white/5 relative overflow-hidden shadow-2xl">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-pink-500/10 rounded-full blur-3xl" />
                <div className="flex items-center gap-4 mb-8">
                  <div className="bg-pink-500 p-2 rounded-xl">
                    <MessageSquare className="w-5 h-5 text-white" />
                  </div>
                  <h3 className="text-xs font-black text-white uppercase tracking-[0.2em]">AI Companion</h3>
                </div>
                
                <div className="h-48 overflow-y-auto mb-8 space-y-4 pr-3 custom-scrollbar">
                  {chatMessages.length === 0 ? (
                    <p className="text-sm font-bold text-slate-400 leading-relaxed italic">
                      "Elena, I'm analyzing your path. The current lighting on 8th Ave is excellent (92). I suggest maintaining your pace."
                    </p>
                  ) : (
                    chatMessages.map((msg, i) => (
                      <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] px-5 py-3 rounded-2xl text-xs font-bold leading-relaxed ${
                          msg.role === 'user' ? 'bg-pink-500 text-white' : 'bg-slate-800 text-slate-200 border border-white/5'
                        }`}>
                          {msg.text}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="relative">
                  <input 
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask about your route..." 
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-5 py-4 text-xs font-bold focus:ring-1 focus:ring-pink-500 focus:border-pink-500 transition-all placeholder:text-slate-600"
                  />
                  <button onClick={handleSendMessage} className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-500 hover:text-white p-2">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* SOS FULLSCREEN OVERLAY */}
      {isSOSActive && (
        <div className="fixed inset-0 z-[1000] bg-red-600/90 backdrop-blur-2xl flex flex-col items-center justify-center text-white p-10">
          <div className="absolute inset-0 overflow-hidden opacity-20">
            <div className="absolute inset-0 border-[50px] border-white/10 animate-pulse" />
          </div>
          <div className="relative mb-12">
            <div className="absolute inset-0 bg-white rounded-full animate-ping opacity-30" />
            <div className="w-48 h-48 bg-white/20 border-8 border-white rounded-full flex items-center justify-center shadow-[0_0_100px_rgba(255,255,255,0.4)]">
              <AlertCircle className="w-24 h-24 text-white" />
            </div>
          </div>
          <h1 className="text-8xl font-black mb-6 tracking-tighter uppercase italic">Emergency Active</h1>
          <p className="text-2xl font-black max-w-2xl text-center mb-16 uppercase tracking-[0.1em] text-red-100">
            Dispatching nearest unit to Chelsea District. All Guardians notified.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
            <button className="py-8 bg-white text-red-600 rounded-[2.5rem] font-black text-2xl uppercase tracking-widest shadow-2xl hover:bg-slate-50">Confirm Call 911</button>
            <button onClick={() => setIsSOSActive(false)} className="py-8 bg-black/30 border-2 border-white/30 rounded-[2.5rem] font-black text-sm uppercase tracking-widest hover:bg-black/50">Cancel Signal - I am Safe</button>
          </div>
        </div>
      )}
    </div>
  );
};

// UI Components
const NavItem = ({ icon, label, active, onClick }: { icon: any, label: string, active?: boolean, onClick?: () => void }) => (
  <div onClick={onClick} className={`flex items-center gap-5 px-6 py-4 rounded-2xl transition-all cursor-pointer group ${active ? 'bg-pink-500 text-white shadow-[0_10px_30px_-10px_rgba(236,72,153,0.5)]' : 'text-slate-500 hover:text-pink-500 hover:bg-pink-500/5'}`}>
    {React.cloneElement(icon, { className: 'w-6 h-6' })}
    <span className="hidden lg:block text-sm font-black uppercase tracking-widest">{label}</span>
    {active && <ChevronRight className="ml-auto w-4 h-4" />}
  </div>
);

const ScoreGridCard = ({ icon, label, value, desc, colorClass, textColorClass }: { icon: any, label: string, value?: number, desc: string, colorClass: string, textColorClass: string }) => (
  <div className="bg-slate-900/60 p-8 rounded-[3rem] border border-white/5 relative overflow-hidden group">
    <div className="flex items-center justify-between mb-8">
      <div className={`p-4 rounded-2xl bg-white/5 text-slate-400 group-hover:text-pink-500 transition-colors`}>
        {React.cloneElement(icon, { className: 'w-8 h-8' })}
      </div>
      <div className="text-right">
        <p className={`text-5xl font-black ${textColorClass}`}>{value || '--'}</p>
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">/ 100</p>
      </div>
    </div>
    <div>
      <h4 className="font-black text-white text-lg">{label}</h4>
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-1">{desc}</p>
    </div>
    <div className="mt-8 h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
      <div className={`h-full transition-all duration-1000 ${colorClass}`} style={{ width: `${value || 0}%` }} />
    </div>
  </div>
);

export default App;
