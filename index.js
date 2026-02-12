import { GoogleGenAI, Type } from "@google/genai";

// --- GLOBAL CONFIGURATION ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- APPLICATION STATE ---
let state = {
    role: null, // 'user' | 'guardian' | null
    isSOSActive: false,
    isLoading: false,
    currentLocation: [40.7484, -74.0010], 
    destination: [40.7580, -73.9855], 
    safetyScore: {
        total: 82,
        lighting: 85,
        safetyHistory: 90,
        crowdActivity: 75,
        description: "Standard tactical monitoring active."
    },
    threatZones: [],
    safeRoute: null,
    messages: [
        { role: 'model', text: "SafeRoute Sentinel online. Analyzing local lighting grids and witness density." }
    ]
};

// --- LEAFLET MAP REFS ---
let map = null;
let userMarker = null;
let routeLine = null;
let threatOverlays = [];

// --- UTILITIES ---
async function withRetry(fn, retries = 3, delay = 2000) {
    try {
        return await fn();
    } catch (error) {
        const msg = error?.message?.toLowerCase() || "";
        if ((msg.includes('429') || msg.includes('quota') || msg.includes('exhausted')) && retries > 0) {
            console.warn(`[AI] Quota hit. Backing off ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
            return withRetry(fn, retries - 1, delay * 2);
        }
        throw error;
    }
}

// --- AI SERVICES ---
async function fetchEnvironmentAnalysis() {
    state.isLoading = true;
    render();

    try {
        const response = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Analyze tactical safety for Chelsea, NY district. Focus on women's safety after dark. Provide 0-100 scores for: lighting, safetyHistory, crowdActivity. Return JSON.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        total: { type: Type.NUMBER },
                        lighting: { type: Type.NUMBER },
                        safetyHistory: { type: Type.NUMBER },
                        crowdActivity: { type: Type.NUMBER },
                        description: { type: Type.STRING }
                    },
                    required: ["total", "lighting", "safetyHistory", "crowdActivity", "description"]
                }
            }
        }));
        state.safetyScore = JSON.parse(response.text.trim());

        await new Promise(r => setTimeout(r, 1000));

        const routeRes = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Provide 5-7 walking GPS points for a safe route from Chelsea to Midtown NY. Return JSON array of [lat, lng].`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        points: { type: Type.ARRAY, items: { type: Type.ARRAY, items: { type: Type.NUMBER } } }
                    }
                }
            }
        }));
        state.safeRoute = JSON.parse(routeRes.text.trim()).points;

        await new Promise(r => setTimeout(r, 1000));

        const zonesRes = await withRetry(() => ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Identify 3 safety hotspots near Chelsea NY for tactical overlay. Return JSON array: {lat, lng, radius, intensity: "High" | "Medium"}.`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            lat: { type: Type.NUMBER },
                            lng: { type: Type.NUMBER },
                            radius: { type: Type.NUMBER },
                            intensity: { type: Type.STRING }
                        }
                    }
                }
            }
        }));
        state.threatZones = JSON.parse(zonesRes.text.trim());

    } catch (e) {
        console.error("AI Suite Interrupted:", e);
    } finally {
        state.isLoading = false;
        render();
        updateMap();
    }
}

async function handleChat(query) {
    if (!query.trim()) return;
    state.messages.push({ role: 'user', text: query });
    render();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `You are SafeRoute Tactical AI. Brief advice for: ${query}. Safety level: ${state.safetyScore.total}%.`,
        });
        state.messages.push({ role: 'model', text: response.text });
    } catch (e) {
        state.messages.push({ role: 'model', text: "Satellite link weak. Stick to high-density lighting zones." });
    }
    render();
}

// --- MAP ENGINE ---
function initMap() {
    const container = document.getElementById('map');
    if (!container || map) return;

    map = L.map('map', { zoomControl: false, attributionControl: false }).setView(state.currentLocation, 14);

    L.tileLayer('https://{s}.tile.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(map);
    updateMap();
}

function updateMap() {
    if (!map) return;

    if (userMarker) map.removeLayer(userMarker);
    if (routeLine) map.removeLayer(routeLine);
    threatOverlays.forEach(o => map.removeLayer(o));
    threatOverlays = [];

    const icon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div class="user-marker-pulse ${state.isSOSActive ? 'bg-red-600 shadow-[0_0_20px_#ef4444]' : ''}"></div>`,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
    });
    userMarker = L.marker(state.currentLocation, { icon }).addTo(map);

    if (state.safeRoute) {
        routeLine = L.polyline(state.safeRoute, {
            color: state.isSOSActive ? '#ef4444' : '#ff007f',
            weight: 6,
            opacity: 0.8
        }).addTo(map);
    }

    state.threatZones.forEach(z => {
        const color = z.intensity === 'High' ? '#ef4444' : '#f59e0b';
        const circle = L.circle([z.lat, z.lng], {
            radius: z.radius,
            color: color,
            fillColor: color,
            fillOpacity: 0.1,
            weight: 1
        }).addTo(map);
        threatOverlays.push(circle);
    });
}

// --- UI RENDERING ---
function render() {
    const root = document.getElementById('root');
    if (!state.role) {
        root.innerHTML = `
        <div class="h-full w-full flex flex-col items-center justify-center p-8 bg-[#020617]">
            <div class="mb-20 text-center">
                <div class="w-24 h-24 bg-pink-500/10 rounded-full flex items-center justify-center mx-auto mb-10 neon-border-pink animate-pulse">
                    <i data-lucide="shield" class="w-12 h-12 text-pink-500"></i>
                </div>
                <h1 class="text-8xl font-black text-white tracking-tighter italic">SafeRoute <span class="text-pink-500 neon-text-pink">AI</span></h1>
                <p class="text-slate-500 font-bold mt-4 tracking-[0.5em] uppercase text-[10px]">Command and Protection Protocol</p>
            </div>
            <div class="max-w-5xl w-full grid grid-cols-1 md:grid-cols-2 gap-12">
                <button onclick="window.setRole('user')" class="group relative bg-slate-950 p-16 rounded-[4rem] text-left transition-all hover:scale-[1.02] border border-white/5 hover:border-pink-500/50 shadow-2xl">
                    <i data-lucide="navigation" class="w-16 h-16 text-pink-500 mb-10"></i>
                    <h2 class="text-5xl font-black text-white mb-6">User Portal</h2>
                    <p class="text-slate-400 text-xl leading-relaxed">Secure routing, active lighting analysis, and instant tactical SOS.</p>
                </button>
                <button onclick="window.setRole('guardian')" class="group relative bg-slate-950 p-16 rounded-[4rem] text-left transition-all hover:scale-[1.02] border border-white/5 hover:border-indigo-500/50 shadow-2xl">
                    <i data-lucide="eye" class="w-16 h-16 text-indigo-500 mb-10"></i>
                    <h2 class="text-5xl font-black text-white mb-6">Guardian Hub</h2>
                    <p class="text-slate-400 text-xl leading-relaxed">Remote trip monitoring, location sync, and prioritized alerts.</p>
                </button>
            </div>
        </div>
        `;
    } else {
        root.innerHTML = `
        <div class="flex h-full w-full overflow-hidden">
            <aside class="w-20 lg:w-80 bg-black border-r border-white/5 flex flex-col py-10 z-50">
                <div class="px-10 mb-20 flex items-center gap-4">
                    <div class="bg-pink-500/20 p-2 rounded-xl border border-pink-500/30">
                        <i data-lucide="shield" class="w-8 h-8 text-pink-500"></i>
                    </div>
                    <span class="hidden lg:block font-black text-3xl tracking-tighter">SAFEROUTE</span>
                </div>
                <nav class="flex-1 px-6 space-y-4">
                    <div class="flex items-center gap-6 px-6 py-5 rounded-3xl bg-pink-500 text-white shadow-xl cursor-pointer">
                        <i data-lucide="layout-dashboard" class="w-6 h-6"></i>
                        <span class="hidden lg:block font-black text-sm uppercase tracking-widest">Command Hub</span>
                    </div>
                    <div class="flex items-center gap-6 px-6 py-5 rounded-3xl text-slate-500 hover:text-white transition-all cursor-pointer">
                        <i data-lucide="map" class="w-6 h-6"></i>
                        <span class="hidden lg:block font-black text-sm uppercase tracking-widest">Network Map</span>
                    </div>
                    <div class="flex items-center gap-6 px-6 py-5 rounded-3xl text-slate-500 hover:text-white transition-all cursor-pointer">
                        <i data-lucide="bell" class="w-6 h-6"></i>
                        <span class="hidden lg:block font-black text-sm uppercase tracking-widest">Alert History</span>
                    </div>
                </nav>
                <div class="px-6 mt-auto">
                    <button onclick="window.setRole(null)" class="w-full flex items-center gap-6 px-6 py-5 rounded-3xl text-red-400 hover:bg-red-500/10 transition-all">
                        <i data-lucide="log-out" class="w-6 h-6"></i>
                        <span class="hidden lg:block font-black text-sm uppercase tracking-widest">Terminate</span>
                    </button>
                </div>
            </aside>

            <main class="flex-1 flex flex-col relative bg-gradient-to-br from-[#020617] to-[#010408]">
                <header class="h-24 border-b border-white/5 px-12 flex items-center justify-between glass-panel">
                    <div class="flex items-center gap-4">
                        <div class="w-4 h-4 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_15px_#10b981]"></div>
                        <span class="text-[11px] font-black uppercase tracking-[0.3em] text-emerald-500">Active Secure Link</span>
                    </div>
                    <div class="flex items-center gap-10">
                        <div class="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/10">
                            <i data-lucide="battery" class="w-5 h-5 text-emerald-500"></i>
                            <span class="text-sm font-black text-white">92%</span>
                        </div>
                        <div class="flex items-center gap-3 bg-white/5 px-5 py-2.5 rounded-full border border-white/10">
                            <i data-lucide="wifi" class="w-5 h-5 text-pink-500"></i>
                            <span class="text-sm font-black text-white">TACTICAL 5G</span>
                        </div>
                    </div>
                </header>

                <div class="flex-1 p-12 overflow-y-auto space-y-12 custom-scrollbar">
                    <div class="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div class="lg:col-span-8 space-y-12">
                            <div class="h-[550px] bg-black rounded-[4rem] border border-white/5 relative overflow-hidden shadow-2xl">
                                <div id="map" class="w-full h-full"></div>
                                ${state.isLoading ? `<div class="absolute inset-0 z-[2000] bg-black/70 backdrop-blur-xl flex flex-col items-center justify-center">
                                    <div class="w-20 h-20 border-4 border-pink-500/20 border-t-pink-500 rounded-full animate-spin mb-8"></div>
                                    <p class="text-sm font-black uppercase tracking-[0.5em] text-pink-500">Syncing AI Core...</p>
                                </div>` : ''}
                                <div class="absolute top-10 right-10 z-[1001]">
                                    <div class="bg-black/80 backdrop-blur-xl p-10 rounded-[3rem] border border-white/10 flex items-center gap-10 shadow-2xl">
                                        <div class="text-center">
                                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Safety Score</p>
                                            <p class="text-6xl font-black text-pink-500 neon-text-pink">${state.safetyScore.total}%</p>
                                        </div>
                                        <div class="w-px h-16 bg-white/10"></div>
                                        <div>
                                            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Verdict</p>
                                            <p class="text-lg font-black text-emerald-500 flex items-center gap-3">
                                                <i data-lucide="shield-check" class="w-6 h-6"></i> SECURE ZONE
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div class="grid grid-cols-1 md:grid-cols-3 gap-10">
                                ${renderMetric('Zap', 'Illumination', state.safetyScore.lighting, 'Street Lights Active')}
                                ${renderMetric('Alert-Triangle', 'Stability', state.safetyScore.safetyHistory, 'Historical Safety')}
                                ${renderMetric('Users', 'Witnesses', state.safetyScore.crowdActivity, 'Safe Presence')}
                            </div>
                        </div>

                        <div class="lg:col-span-4 space-y-10">
                            <button onclick="window.triggerSOS()" class="w-full h-64 rounded-[4rem] bg-gradient-to-br ${state.isSOSActive ? 'from-red-600 to-red-900 animate-pulse-sos' : 'from-red-950/40 to-black border-4 border-red-600/30'} transition-all active:scale-95 shadow-2xl flex flex-col items-center justify-center gap-6">
                                <i data-lucide="alert-circle" class="w-20 h-20 text-white"></i>
                                <div class="text-center">
                                    <span class="text-5xl font-black text-white italic tracking-tighter uppercase">Panic SOS</span>
                                    <p class="text-[11px] font-black text-red-300 mt-2 uppercase tracking-[0.3em]">${state.isSOSActive ? 'ALARM ACTIVE' : 'SILENT POLICE DISPATCH'}</p>
                                </div>
                            </button>

                            <div class="grid grid-cols-2 gap-8">
                                <div class="p-10 bg-slate-900/40 rounded-[3rem] border border-white/5 flex flex-col items-center gap-5 hover:bg-slate-900/60 transition-all cursor-pointer group">
                                    <i data-lucide="user-check" class="w-10 h-10 text-emerald-500 group-hover:scale-110"></i>
                                    <span class="text-[10px] font-black uppercase tracking-widest text-emerald-500">Check In</span>
                                </div>
                                <div class="p-10 bg-slate-900/40 rounded-[3rem] border border-white/5 flex flex-col items-center gap-5 hover:bg-slate-900/60 transition-all cursor-pointer group">
                                    <i data-lucide="phone" class="w-10 h-10 text-pink-500 group-hover:rotate-12"></i>
                                    <span class="text-[10px] font-black uppercase tracking-widest text-pink-500">Emergency Call</span>
                                </div>
                            </div>

                            <div class="bg-slate-900/80 rounded-[4rem] p-12 border border-white/5 flex flex-col h-[450px] shadow-2xl relative overflow-hidden">
                                <div class="flex items-center gap-5 mb-10">
                                    <div class="bg-pink-500 p-3 rounded-2xl"><i data-lucide="message-square" class="w-6 h-6 text-white"></i></div>
                                    <h3 class="text-[11px] font-black uppercase tracking-[0.3em] text-white">Tactical Chat</h3>
                                </div>
                                <div id="chat-history" class="flex-1 overflow-y-auto mb-8 space-y-6 pr-4 custom-scrollbar">
                                    ${state.messages.map(m => `
                                        <div class="flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}">
                                            <div class="max-w-[85%] px-6 py-4 rounded-3xl text-sm font-bold leading-relaxed ${m.role === 'user' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-200 border border-white/5'}">
                                                ${m.text}
                                            </div>
                                        </div>
                                    `).join('')}
                                </div>
                                <div class="relative">
                                    <input id="chat-query" onkeydown="if(event.key==='Enter') window.sendMessage()" placeholder="Inquire environment..." class="w-full bg-black/60 border border-white/10 rounded-[2rem] px-8 py-6 text-sm font-bold focus:outline-none focus:border-pink-500 text-white transition-all">
                                    <button onclick="window.sendMessage()" class="absolute right-5 top-1/2 -translate-y-1/2 text-pink-500 hover:text-white"><i data-lucide="send" class="w-6 h-6"></i></button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
        ${state.isSOSActive ? `<div class="fixed inset-0 z-[10000] bg-red-600/95 backdrop-blur-3xl flex flex-col items-center justify-center p-16 text-center text-white">
            <div class="w-64 h-64 bg-white/20 border-8 border-white rounded-full flex items-center justify-center animate-pulse shadow-[0_0_120px_rgba(255,255,255,0.5)] mb-12">
                <i data-lucide="alert-triangle" class="w-32 h-32"></i>
            </div>
            <h1 class="text-9xl font-black mb-8 italic uppercase tracking-tighter">Emergency Signal</h1>
            <p class="text-3xl font-black mb-20 uppercase tracking-[0.3em] text-red-100">Police Unit En Route to Chelsea Coordinate. Guardians Informed.</p>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-10 w-full max-w-4xl">
                <button class="py-12 bg-white text-red-600 rounded-[3.5rem] font-black text-4xl uppercase tracking-widest shadow-2xl hover:bg-slate-100 transition-all">Dial Police</button>
                <button onclick="window.triggerSOS()" class="py-12 bg-black/30 border-4 border-white/30 rounded-[3.5rem] font-black text-sm uppercase tracking-widest hover:bg-black/50 transition-all">Cancel Alert</button>
            </div>
        </div>` : ''}
        `;
    }

    setTimeout(() => {
        if (state.role) initMap();
        lucide.createIcons();
        const chatBox = document.getElementById('chat-history');
        if (chatBox) chatBox.scrollTop = chatBox.scrollHeight;
    }, 0);
}

function renderMetric(icon, label, value, desc) {
    const isHigh = value >= 80;
    const color = isHigh ? 'bg-pink-500' : 'bg-amber-500';
    const text = isHigh ? 'text-pink-500' : 'text-amber-500';
    const glow = isHigh ? 'shadow-[0_0_20px_#ff007f]' : '';

    return `
    <div class="bg-slate-900/60 p-12 rounded-[3.5rem] border border-white/5 relative group overflow-hidden">
        <div class="flex items-center justify-between mb-12">
            <div class="p-5 bg-white/5 rounded-2xl text-slate-500 group-hover:text-pink-500 transition-all">
                <i data-lucide="${icon.toLowerCase()}" class="w-10 h-10"></i>
            </div>
            <div class="text-right">
                <p class="text-6xl font-black ${text}">${value}%</p>
                <p class="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Confidence</p>
            </div>
        </div>
        <div>
            <h4 class="font-black text-white text-2xl mb-2">${label}</h4>
            <p class="text-[10px] font-black text-slate-500 uppercase tracking-widest">${desc}</p>
        </div>
        <div class="mt-10 h-4 w-full bg-white/5 rounded-full overflow-hidden">
            <div class="score-bar h-full ${color} ${glow}" style="width: ${value}%"></div>
        </div>
    </div>
    `;
}

// --- GLOBAL ATTACHMENTS ---
window.setRole = (role) => {
    state.role = role;
    if (role === 'user') fetchEnvironmentAnalysis();
    render();
};

window.triggerSOS = () => {
    state.isSOSActive = !state.isSOSActive;
    render();
    if (map) updateMap();
};

window.sendMessage = () => {
    const input = document.getElementById('chat-query');
    if (input && input.value.trim()) {
        handleChat(input.value);
        input.value = '';
    }
};

// --- INITIAL START ---
render();