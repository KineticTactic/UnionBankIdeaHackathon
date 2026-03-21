"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe, AlertTriangle, Newspaper, TrendingDown } from "lucide-react";

interface MarketSignal {
    customer_id: string;
    city: string;
    segment: string;
    news_risk_flag: boolean;
    news_summary: string;
}

export function MarketSignalsCard({ signals }: { signals: MarketSignal[] }) {
    if (!signals || signals.length === 0) {
        return (
            <Card className="h-full shadow-sm border-slate-200">
                <CardHeader>
                    <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                        <Globe className="w-4 h-4 mr-2" /> Market & News Risk
                    </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center h-48 text-slate-400 italic text-sm">
                    No active market risk flags detected.
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="h-full shadow-sm border-slate-200">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center">
                    <Globe className="w-4 h-4 mr-2 text-blue-500" /> Market & News Risk
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    {signals.slice(0, 4).map((sig, idx) => (
                        <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="text-[10px] font-bold bg-white">{sig.city}</Badge>
                                    <Badge variant="secondary" className="text-[10px] font-medium">{sig.segment}</Badge>
                                </div>
                                <AlertTriangle className="w-3.5 h-3.5 text-orange-500" />
                            </div>
                            <div className="flex gap-2">
                                <Newspaper className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                <p className="text-xs text-slate-600 leading-normal line-clamp-2">
                                    {sig.news_summary}
                                </p>
                            </div>
                        </div>
                    ))}
                    {signals.length > 4 && (
                        <div className="text-center text-[10px] text-slate-400 font-medium">
                            + {signals.length - 4} more regional signals
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
