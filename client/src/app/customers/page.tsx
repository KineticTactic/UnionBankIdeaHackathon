"use client";

import { useState } from "react";
import { useCustomers } from "@/hooks/useCustomers";
import { CustomerTable } from "@/components/customers/CustomerTable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

export default function CustomersPage() {
    const [search, setSearch] = useState("");
    const [riskTier, setRiskTier] = useState<string>("all");
    const [segment, setSegment] = useState<string>("all");

    const filters = {
        search: search ? search : undefined,
        risk_tier: riskTier !== "all" ? riskTier : undefined,
        segment: segment !== "all" ? segment : undefined,
    };

    const { customers, isLoading } = useCustomers(filters);

    const clearFilters = () => {
        setSearch("");
        setRiskTier("all");
        setSegment("all");
    };

    return (
        <div className="flex flex-col gap-6 max-w-7xl">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
                <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                    <div className="relative w-full sm:max-w-xs">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Search name or ID..."
                            className="pl-9 h-10 w-full bg-white border-slate-200"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    <Select value={riskTier} onValueChange={setRiskTier}>
                        <SelectTrigger className="w-full sm:w-[160px] h-10 bg-white">
                            <SelectValue placeholder="Risk Tier" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Risk Tiers</SelectItem>
                            <SelectItem value="critical">Critical Risk</SelectItem>
                            <SelectItem value="high">High Risk</SelectItem>
                            <SelectItem value="medium">Medium Risk</SelectItem>
                            <SelectItem value="watch">Watch</SelectItem>
                            <SelectItem value="low">Low Risk</SelectItem>
                        </SelectContent>
                    </Select>

                    <Select value={segment} onValueChange={setSegment}>
                        <SelectTrigger className="w-full sm:w-[180px] h-10 bg-white">
                            <SelectValue placeholder="Segment" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Segments</SelectItem>
                            <SelectItem value="HNW">HNW</SelectItem>
                            <SelectItem value="Mass Affluent">Mass Affluent</SelectItem>
                            <SelectItem value="Mass Market">Mass Market</SelectItem>
                            <SelectItem value="Digital Native">Digital Native</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {(search || riskTier !== "all" || segment !== "all") && (
                    <Button
                        variant="ghost"
                        className="text-slate-500 hover:text-slate-800 h-10"
                        onClick={clearFilters}
                    >
                        <X className="w-4 h-4 mr-2" />
                        Clear Filters
                    </Button>
                )}
            </div>

            <CustomerTable customers={customers} isLoading={isLoading} />
        </div>
    );
}
