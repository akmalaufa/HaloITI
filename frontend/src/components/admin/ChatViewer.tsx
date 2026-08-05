"use client";

import React, { useState, useEffect, useCallback } from "react";
import { User, Bot, Zap, Network, MessageSquare } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Virtuoso } from "react-virtuoso";

type Lead = {
  id_lead: string;
  nama_lengkap: string;
  email: string;
};

type ChatLog = {
  id: number;
  id_lead: string;
  user_query: string;
  bot_response: string;
  routed_to: string;
  response_time_ms: number;
  created_at: string;
};
function formatLatency(ms: number) {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(2)} detik`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

export default function ChatViewer({ initialLeads }: { initialLeads: Lead[] }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads);
  const [selectedLead, setSelectedLead] = useState<string>("");
  const [chats, setChats] = useState<ChatLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // States untuk Virtualization & Pagination
  const [offset, setOffset] = useState<number>(0);
  const [hasMoreHistory, setHasMoreHistory] = useState<boolean>(true);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);
  const [firstItemIndex, setFirstItemIndex] = useState<number>(10000);

  // Polling Real-Time untuk daftar Maba baru
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const res = await fetch('http://127.0.0.1:8000/api/admin/leads', {
          headers: { 'X-API-Key': process.env.NEXT_PUBLIC_X_API_KEY || "" }
        });
        if (res.ok) {
          const json = await res.json();
          setLeads(json.data || []);
        }
      } catch (error) {
        // Abaikan error polling agar tidak mengganggu console
      }
    };
    
    // Tarik data setiap 5 detik (5000ms)
    const intervalId = setInterval(fetchLeads, 5000);
    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!selectedLead) {
      setChats([]);
      return;
    }

    const fetchChats = async () => {
      setIsLoading(true);
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/admin/chat-logs/${selectedLead}?limit=20&offset=0`, {
          headers: {
            "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || ""
          }
        });
        if (!res.ok) throw new Error("Gagal mengambil riwayat chat");
        const json = await res.json();
        const data = json.data || [];
        setChats(data);
        
        // Reset state pagination untuk lead baru
        setOffset(20);
        setHasMoreHistory(data.length === 20);
        setFirstItemIndex(10000);
      } catch (error) {
        console.error(error);
        setChats([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchChats();
  }, [selectedLead]);

  // Polling Real-Time untuk Chat Baru (tanpa merusak riwayat scroll)
  useEffect(() => {
    if (!selectedLead) return;

    const pollNewChats = async () => {
      try {
        const res = await fetch(`http://127.0.0.1:8000/api/admin/chat-logs/${selectedLead}?limit=10&offset=0`, {
          headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" }
        });
        if (!res.ok) return;
        const json = await res.json();
        const latestData: ChatLog[] = json.data || [];

        setChats(prev => {
          if (latestData.length === 0) return prev;
          if (prev.length === 0) {
            // Jika sebelumnya kosong, maka yang terbaru juga mengisi offset
            setOffset(latestData.length);
            return latestData;
          }

          // Cari pesan-pesan yang ID-nya lebih besar dari pesan terakhir yang kita punya
          const lastPrevId = prev[prev.length - 1].id;
          const newMessages = latestData.filter(c => c.id > lastPrevId);
          
          if (newMessages.length > 0) {
            // Offset bertambah sebanyak pesan baru agar scroll up (fetchOlderHistory) tidak berantakan
            setOffset(current => current + newMessages.length);
            return [...prev, ...newMessages];
          }
          return prev;
        });
      } catch (error) {
        // Abaikan error jaringan sesaat
      }
    };

    const intervalId = setInterval(pollNewChats, 5000);
    return () => clearInterval(intervalId);
  }, [selectedLead]);

  const fetchOlderHistory = useCallback(async () => {
    if (!hasMoreHistory || isLoadingMore || !selectedLead) return;
    
    setIsLoadingMore(true);
    try {
      const res = await fetch(`http://127.0.0.1:8000/api/admin/chat-logs/${selectedLead}?limit=20&offset=${offset}`, {
        headers: { "X-API-Key": process.env.NEXT_PUBLIC_X_API_KEY || "" }
      });
      if (!res.ok) throw new Error("Gagal mengambil riwayat chat");
      
      const json = await res.json();
      const oldData = json.data || [];
      
      if (oldData.length > 0) {
        setChats(prev => [...oldData, ...prev]);
        setFirstItemIndex(prev => prev - oldData.length);
        setOffset(prev => prev + 20);
        setHasMoreHistory(oldData.length === 20);
      } else {
        setHasMoreHistory(false);
      }
    } catch (error) {
      console.error("Gagal menarik data lama:", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [hasMoreHistory, isLoadingMore, selectedLead, offset]);

  return (
    <div className="flex h-[75vh] flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#18181b] shadow-2xl">
      {/* Top Bar - Dropdown */}
      <div className="flex items-center gap-4 border-b border-white/10 bg-white/5 p-4">
        <label htmlFor="lead-select" className="text-sm font-medium text-gray-400">
          Pilih Maba:
        </label>
        <select
          id="lead-select"
          value={selectedLead}
          onChange={(e) => setSelectedLead(e.target.value)}
          className="flex-1 cursor-pointer rounded-lg border border-white/10 bg-[#0a0a0a] p-2.5 text-sm text-white focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand"
        >
          <option value="">-- Pilih Calon Mahasiswa --</option>
          {leads.map((lead) => (
            <option key={lead.id_lead} value={lead.id_lead}>
              {lead.nama_lengkap}
            </option>
          ))}
        </select>
      </div>

      {/* Chat Area */}
      <div className="flex-1 p-4 md:p-6 overflow-hidden relative">
        {!selectedLead ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-500">
            <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
            <p>Silakan pilih Maba dari dropdown di atas untuk melihat riwayat percakapan.</p>
          </div>
        ) : isLoading ? (
          <div className="flex h-full flex-col items-center justify-center text-brand">
            <div className="flex items-center space-x-3">
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce"></div>
            </div>
            <p className="mt-4 text-sm text-gray-400">Memuat riwayat chat...</p>
          </div>
        ) : chats.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-gray-500">
            <MessageSquare className="mb-4 h-12 w-12 opacity-20" />
            <p>Belum ada riwayat percakapan untuk Maba ini.</p>
          </div>
        ) : (
          <Virtuoso
            className="w-full h-full scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent pr-2"
            data={chats}
            firstItemIndex={firstItemIndex}
            initialTopMostItemIndex={chats.length > 0 ? chats.length - 1 : 0}
            followOutput="smooth"
            startReached={fetchOlderHistory}
            components={{
              Header: () => (
                isLoadingMore ? (
                  <div className="w-full flex justify-center py-6">
                    <div className="flex items-center space-x-3 text-brand">
                      <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2.5 h-2.5 bg-current rounded-full animate-bounce"></div>
                    </div>
                  </div>
                ) : null
              )
            }}
            itemContent={(index, chat) => (
              <div className="space-y-4 pb-8">
                
                {/* Bubble User (Maba) */}
                <div className="flex items-start justify-end gap-3">
                  <div className="flex flex-col items-end">
                    <div className="rounded-2xl rounded-tr-none bg-brand p-4 text-sm text-white shadow-md">
                      {chat.user_query.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")}
                    </div>
                    <span className="mt-1 text-xs text-gray-500">
                      {leads.find(l => l.id_lead === selectedLead)?.nama_lengkap || "Maba"} • {chat.created_at}
                    </span>
                  </div>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
                    <User className="h-4 w-4" />
                  </div>
                </div>

                {/* Bubble AI */}
                <div className="flex items-start gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-blue-400">
                    <Bot className="h-4 w-4" />
                  </div>
                  <div className="flex max-w-[85%] flex-col items-start">
                    <div className="rounded-2xl rounded-tl-none border border-white/10 bg-white/5 p-4 text-sm text-gray-200 shadow-md prose-invert">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          strong: ({node, ...props}) => <span className="font-bold text-white" {...props} />,
                          p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
                          table: ({node, ...props}) => (
                            <div className="w-full overflow-x-auto my-4 rounded-lg border border-zinc-800 shadow-lg scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                              <table className="w-full text-sm text-left border-collapse" {...props} />
                            </div>
                          ),
                          thead: ({node, ...props}) => <thead className="bg-zinc-800/80 text-zinc-200 uppercase text-xs tracking-wider" {...props} />,
                          tbody: ({node, children, ...props}) => {
                            const rows = React.Children.toArray(children).filter(React.isValidElement);
                            
                            const gridInfo = rows.map(tr => {
                              const tds = React.Children.toArray(React.isValidElement(tr) ? (tr as any).props.children : []).filter(React.isValidElement);
                              return tds.map(td => {
                                const tdChildren = React.Children.toArray(React.isValidElement(td) ? (td as any).props.children : []);
                                const isEmpty = tdChildren.length === 0 || 
                                                (tdChildren.length === 1 && typeof tdChildren[0] === 'string' && tdChildren[0].trim().replace(/[\u200B-\u200D\uFEFF]/g, '') === '');
                                return { td: td as React.ReactElement, isEmpty, rowSpan: 1, hide: false };
                              });
                            });

                            for (let c = 0; c < (gridInfo[0]?.length || 0); c++) {
                              let spanStartRow = -1;
                              for (let r = 0; r < gridInfo.length; r++) {
                                if (!gridInfo[r][c]) continue; 
                                if (!gridInfo[r][c].isEmpty) {
                                  spanStartRow = r;
                                } else if (spanStartRow !== -1) {
                                  gridInfo[spanStartRow][c].rowSpan += 1;
                                  gridInfo[r][c].hide = true;
                                }
                              }
                            }

                            const newRows = rows.map((tr, r) => {
                              const newTds = gridInfo[r].map((cell) => {
                                if (cell.hide) return null;
                                if (cell.rowSpan > 1) {
                                  return React.cloneElement(cell.td as React.ReactElement<any>, { 
                                    rowSpan: cell.rowSpan, 
                                    className: ((cell.td as any).props.className || "") + " align-middle border-r border-zinc-700/50 text-center",
                                    style: { ...((cell.td as any).props.style || {}), textAlign: 'center' }
                                  });
                                }
                                return cell.td;
                              }).filter(Boolean);
                              return React.cloneElement(tr as React.ReactElement, {}, newTds);
                            });

                            return <tbody className="bg-zinc-900/50 divide-y divide-zinc-800" {...props}>{newRows}</tbody>;
                          },
                          tr: ({node, ...props}) => <tr className="hover:bg-zinc-800/40 transition-colors duration-200" {...props} />,
                          th: ({node, ...props}) => <th className="px-4 py-3 font-semibold border-b border-r border-zinc-700 last:border-r-0 text-center min-w-25" {...props} style={{ ...(props.style || {}), textAlign: 'center' }} />,
                          td: ({node, ...props}) => <td className="px-4 py-3 text-zinc-300 border-r border-zinc-700/50 last:border-r-0 text-center" {...props} style={{ ...(props.style || {}), textAlign: 'center' }} />,
                          ul: ({node, ...props}) => <ul className="list-disc list-outside ml-5 mb-4 space-y-1" {...props} />,
                          ol: ({node, ...props}) => <ol className="list-decimal list-outside ml-5 mb-4 space-y-1" {...props} />,
                          li: ({node, ...props}) => <li className="pl-1" {...props} />,
                          a: ({node, ...props}) => <a className="text-brand hover:underline" target="_blank" rel="noopener noreferrer" {...props} />,
                          h1: ({node, ...props}) => <h1 className="text-xl font-bold text-white mt-5 mb-3" {...props} />,
                          h2: ({node, ...props}) => <h2 className="text-lg font-bold text-white mt-5 mb-3" {...props} />,
                          h3: ({node, ...props}) => <h3 className="text-base font-semibold text-white mt-4 mb-2" {...props} />,
                          h4: ({node, ...props}) => <h4 className="text-[15px] font-semibold text-white mt-4 mb-2" {...props} />,
                          blockquote: ({node, ...props}) => <blockquote className="border-l-2 border-brand/50 pl-3 italic text-gray-300 my-3 bg-white/5 py-1 pr-2 rounded-r" {...props} />,
                        }}
                      >
                        {chat.bot_response.replace(/^\[\d{4}-\d{2}-\d{2} \d{2}:\d{2} WIB\]\s*/, "")}
                      </ReactMarkdown>
                    </div>
                    
                    {/* Observability Metadata */}
                    <div className="mt-2 flex flex-wrap items-center gap-y-1.5 gap-x-3 rounded-lg bg-black/40 px-3 py-2 text-[10px] sm:text-xs text-gray-400 border border-white/5 w-fit max-w-full">
                      <span className="flex items-center gap-1 font-mono">
                        <Network className="h-3 w-3 shrink-0 text-emerald-400" />
                        <span className="wrap-break-word max-w-xs leading-tight">[{chat.routed_to}]</span>
                      </span>
                      <span className="flex items-center gap-1 font-mono shrink-0">
                        <Zap className="h-3 w-3 shrink-0 text-amber-400" />
                        {formatLatency(chat.response_time_ms)}
                      </span>
                      <span className="text-gray-600 hidden sm:inline">•</span>
                      <span className="shrink-0 w-full sm:w-auto mt-0.5 sm:mt-0 opacity-70">AI • {chat.created_at}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          />
        )}
      </div>
    </div>
  );
}
