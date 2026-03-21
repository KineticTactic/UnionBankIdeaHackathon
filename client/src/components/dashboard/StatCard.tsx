import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle: string;
    icon: ReactNode;
    accentColor?: string;
    valueClassName?: string;
}

export function StatCard({ title, value, subtitle, icon, valueClassName = "" }: StatCardProps) {
    return (
        <Card className="shadow-sm border-gray-200">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium text-slate-500">{title}</CardTitle>
                <div className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    {icon}
                </div>
            </CardHeader>
            <CardContent>
                <div className={`text-3xl font-bold text-slate-900 ${valueClassName}`}>{value}</div>
                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
            </CardContent>
        </Card>
    );
}
