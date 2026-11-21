import React, {useEffect, useRef, useState} from 'react';
import {Bot, Check, Copy, Loader2, Send, Sparkles, X} from 'lucide-react';
import {
  ActiveRegion,
  DataMode,
  FloodZone,
  PublicWeatherAlert,
  RescueRouteInfo,
  StagingSite,
  UpstreamSurgeWarning,
} from '../types/flood';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

interface CommandCopilotProps {
  isOpen: boolean;
  activeRegion: ActiveRegion;
  dataMode: DataMode;
  zones: FloodZone[];
  suggestedZone: FloodZone | null;
  surgeWarnings: UpstreamSurgeWarning[];
  publicAlerts: PublicWeatherAlert[];
  selectedZone: FloodZone | null;
  stagingSites: StagingSite[];
  routeInfo: RescueRouteInfo | null;
  onClose: () => void;
}

const STARTER_PROMPTS = [
  'Which 3 neighborhoods in Nairobi East need sandbags first based on the 24-hour QPF forecast?',
  'If Mombasa Road floods near South C, what is our fastest backup route to evacuate Mukuru?',
  'Draft a Swahili and English SMS warning for community leaders in Mathare and Korogocho.',
];

export const CommandCopilot: React.FC<CommandCopilotProps> = ({
  isOpen,
  activeRegion,
  dataMode,
  zones,
  suggestedZone,
  surgeWarnings,
  publicAlerts,
  selectedZone,
  stagingSites,
  routeInfo,
  onClose,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      text: `SkyMap Response Command Copilot is live and connected to ${activeRegion.name} (${zones.length} monitored zones). Ask about sandbag priority, flooded corridor detours, or bilingual SMS alerts.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const listEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [messages, isLoading]);

  if (!isOpen) return null;

  const buildLiveTelemetryContext = () => ({
    region: activeRegion.name,
    dataMode,
    averageElevationMeters: activeRegion.averageElevationMeters,
    suggestedPriorityDispatchZone: suggestedZone
      ? {
          name: suggestedZone.name,
          corridor: suggestedZone.corridor,
          riskScore: suggestedZone.riskScore,
          riskLevel: suggestedZone.riskLevel,
          elevationMeters: suggestedZone.elevationMeters,
          currentQpfMm: suggestedZone.weather.currentQpfMm,
          forecast24hQpfMm: suggestedZone.weather.forecast24hQpfMm,
          probabilityPercent: suggestedZone.weather.probabilityPercent,
        }
      : null,
    currentlySelectedZone: selectedZone
      ? {
          name: selectedZone.name,
          corridor: selectedZone.corridor,
          coordinates: {lat: selectedZone.lat, lng: selectedZone.lng},
          elevationMeters: selectedZone.elevationMeters,
          riskScore: selectedZone.riskScore,
          riskLevel: selectedZone.riskLevel,
          currentQpfMm: selectedZone.weather.currentQpfMm,
          forecast24hQpfMm: selectedZone.weather.forecast24hQpfMm,
          stagingSites: stagingSites.map((s) => ({
            name: s.name,
            type: s.type,
            elevationMeters: s.elevationMeters,
            elevationAdvantageMeters: s.elevationAdvantageMeters,
            directDistanceKm: Number((s.distanceMetersDirect / 1000).toFixed(2)),
          })),
          activeRoute: routeInfo
            ? {
                fromStagingSite: routeInfo.stagingSiteName,
                distanceKm: Number((routeInfo.distanceMeters / 1000).toFixed(2)),
                etaMinutes: Math.max(1, Math.round(routeInfo.durationMillis / 60000)),
              }
            : null,
        }
      : null,
    upstreamSurgeWarnings: surgeWarnings.map((w) => ({
      upstreamZone: w.upstreamZoneName,
      upstreamElevM: w.upstreamElevationMeters,
      upstreamQpfMm: w.upstreamQpfMm,
      threatenedDownstream: w.threatenedDownstreamZones,
    })),
    publicAlerts: publicAlerts.map((a) => ({
      title: a.title,
      severity: a.severity,
      areaName: a.areaName,
      source: a.dataSource.name,
    })),
    monitoredZones: zones.map((z) => ({
      name: z.name,
      corridor: z.corridor,
      lat: Number(z.lat.toFixed(4)),
      lng: Number(z.lng.toFixed(4)),
      elevationMeters: z.elevationMeters,
      terrainVulnerability: z.terrainVulnerability,
      currentQpfMm: z.weather.currentQpfMm,
      forecast24hQpfMm: z.weather.forecast24hQpfMm,
      probabilityPercent: z.weather.probabilityPercent,
      precipitationType: z.weather.precipitationType,
      riskScore: z.riskScore,
      riskLevel: z.riskLevel,
    })),
  });

  const sendPrompt = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean || isLoading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: clean,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);
    setErrorText(null);

    try {
      const response = await fetch('/api/copilot', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({
          message: clean,
          history: messages
            .filter((m) => m.id !== 'welcome')
            .map((m) => ({role: m.role, text: m.text})),
          context: buildLiveTelemetryContext(),
        }),
      });

      const data = (await response.json()) as {reply?: string; error?: string};
      if (!response.ok || !data.reply) {
        throw new Error(data.error || `Request failed (${response.status})`);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: data.reply!,
        },
      ]);
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : 'Unable to reach Command Copilot.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyReply = async (id: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  return (
    <aside
      aria-label="Command Copilot Chat Sidebar"
      className="w-full lg:w-[340px] xl:w-[380px] shrink-0 bg-[#F8FBFF] border-t lg:border-t-0 lg:border-l border-sky-200 flex flex-col h-full min-h-0 z-20"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-white border-b border-sky-200 flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h2 className="font-display text-base font-bold text-slate-900 truncate">
              Command Copilot
            </h2>
            <p className="text-xs text-sky-700 truncate">
              Live state · {zones.length} zones synced
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close Command Copilot"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-sky-100 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Starter Prompt Chips */}
      <div className="px-3.5 py-2.5 bg-sky-50/90 border-b border-sky-200 space-y-1.5 shrink-0">
        <div className="text-xs font-semibold text-sky-900 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-sky-600" />
          <span>Quick Tactical Queries</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {STARTER_PROMPTS.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isLoading}
              onClick={() => void sendPrompt(prompt)}
              className="text-left text-xs text-slate-700 hover:text-sky-950 bg-white hover:bg-sky-100/80 border border-sky-200 rounded-lg px-2.5 py-1.5 transition-colors cursor-pointer disabled:opacity-50 line-clamp-2"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-sky-600 text-white'
                  : 'bg-white border border-sky-200 text-slate-800 shadow-2xs'
              }`}
            >
              {msg.text}
            </div>
            {msg.role === 'assistant' && msg.id !== 'welcome' && (
              <button
                type="button"
                onClick={() => void handleCopyReply(msg.id, msg.text)}
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:text-sky-900 cursor-pointer"
              >
                {copiedId === msg.id ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy brief</span>
                  </>
                )}
              </button>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-sky-800 bg-white border border-sky-200 rounded-xl px-3.5 py-2.5 w-fit">
            <Loader2 className="w-4 h-4 animate-spin text-sky-600" />
            <span>Analyzing live telemetry...</span>
          </div>
        )}

        {errorText && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-800">
            {errorText}
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Input Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void sendPrompt(input);
        }}
        className="p-3 bg-white border-t border-sky-200 shrink-0"
      >
        <div className="flex items-end gap-2">
          <textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void sendPrompt(input);
              }
            }}
            placeholder="Ask across all monitored zones..."
            className="flex-1 bg-sky-50/70 border border-sky-200 focus:border-sky-500 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none resize-none"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            aria-label="Send message to Command Copilot"
            className="p-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-colors cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
