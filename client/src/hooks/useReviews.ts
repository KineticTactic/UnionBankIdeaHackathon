"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import type { ReviewCase, ReviewStats, ReviewOfficer } from "@/types";

interface ReviewFilters {
    status?: string;
    type?: string;
    priority?: string;
    page?: number;
    limit?: number;
}

export function useReviews(filters: ReviewFilters = {}) {
    const [cases, setCases] = useState<ReviewCase[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.getReviews(filters as Record<string, string | number | undefined>);
            setCases(res.data);
            setTotal(res.total);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load reviews");
        } finally {
            setLoading(false);
        }
    }, [JSON.stringify(filters)]);

    useEffect(() => { fetch(); }, [fetch]);

    return { cases, total, loading, error, refetch: fetch };
}

export function useReviewDetail(id: string) {
    const [review, setReview] = useState<ReviewCase | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const res = await api.getReviewById(id);
            setReview(res.data);
        } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Failed to load review");
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { review, loading, error, refetch: fetch };
}

export function useReviewStats(options?: { skip?: boolean }) {
    const [stats, setStats] = useState<ReviewStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (options?.skip) { setLoading(false); return; }
        api.getReviewStats()
            .then((res) => setStats(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [options?.skip]);

    return { stats, loading };
}

export function useReviewOfficers() {
    const [officers, setOfficers] = useState<ReviewOfficer[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.getReviewOfficers()
            .then((res) => setOfficers(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    return { officers, loading };
}
