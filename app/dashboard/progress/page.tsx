"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BookOpen,
  CheckCircle2,
  Clock,
  Trophy,
  TrendingUp,
} from "lucide-react";
import type { Profile, WeeklyContent, Pairing, Assignment } from "@/lib/types";

interface AssignmentProgressRecord {
  id: string;
  assignment_id: string;
  status: string;
  completed_at: string | null;
}

// Helper to read cookie on client
function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export default function ProgressPage() {
  const searchParams = useSearchParams();
  // Use URL param first, then fall back to cookie
  const urlPairingId = searchParams.get('pairing');
  const cookiePairingId = getCookie('selected-pairing-id');
  const selectedPairingId = urlPairingId || cookiePairingId;

  const [profile, setProfile] = useState<Profile | null>(null);
  const [pairing, setPairing] = useState<Pairing | null>(null);
  const [weeklyContent, setWeeklyContent] = useState<WeeklyContent[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentProgress, setAssignmentProgress] = useState<AssignmentProgressRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Get profile
      const { data: profileData } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profileData) setProfile(profileData);

      // Get pairing based on role
      let pairingData = null;
      if (profileData?.role === 'leader') {
        // Fetch ALL pairings for multi-learner support
        const { data: allPairings } = await supabase
          .from("pairings")
          .select("*")
          .eq("leader_id", user.id)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false });

        if (allPairings && allPairings.length > 0) {
          // Use selected pairing from URL or default to most recent
          pairingData = selectedPairingId
            ? allPairings.find(p => p.id === selectedPairingId) || allPairings[0]
            : allPairings[0];
        }
      } else {
        const { data } = await supabase
          .from("pairings")
          .select("*")
          .eq("learner_id", user.id)
          .in("status", ["active", "pending"])
          .order("created_at", { ascending: false })
          .limit(1)
          .single();
        pairingData = data;
      }

      if (pairingData) setPairing(pairingData);

      // Get weekly content
      const { data: contentData } = await supabase
        .from("weekly_content")
        .select("*")
        .order("week_number");

      if (contentData) setWeeklyContent(contentData);

      // Get all assignments
      const { data: assignmentsData } = await supabase
        .from("assignments")
        .select("*")
        .order("week_number")
        .order("order_index");

      if (assignmentsData) setAssignments(assignmentsData);

      // Get assignment progress for this pairing
      if (pairingData) {
        const { data: progressData } = await supabase
          .from("assignment_progress")
          .select("*")
          .eq("pairing_id", pairingData.id);

        if (progressData) setAssignmentProgress(progressData);
      }

      setLoading(false);
    }

    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPairingId, cookiePairingId]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  const currentWeek = pairing?.current_week || 1;

  // Get unlocked assignments (up to current week)
  const unlockedAssignments = assignments.filter(a => a.week_number <= currentWeek);
  const unlockedAssignmentIds = new Set(unlockedAssignments.map(a => a.id));
  const allAssignmentIds = new Set(assignments.map(a => a.id));

  // Calculate completed assignments - only count progress for assignments that exist
  const completedAssignments = assignmentProgress.filter(
    (p) => allAssignmentIds.has(p.assignment_id) && p.status === "completed"
  ).length;

  // Calculate completed for unlocked weeks only
  const completedUnlocked = assignmentProgress.filter(
    (p) => unlockedAssignmentIds.has(p.assignment_id) && p.status === "completed"
  ).length;

  // Calculate total assignments up to current week
  const totalAssignmentsUpToCurrentWeek = unlockedAssignments.length;

  // Calculate total assignments overall (for overall progress)
  const totalAssignmentsOverall = assignments.length;

  const overallProgress =
    totalAssignmentsOverall > 0
      ? Math.round((completedAssignments / totalAssignmentsOverall) * 100)
      : 0;

  // Calculate stats for each week
  const weeklyStats = weeklyContent.map((week) => {
    // Get assignments for this specific week
    const weekAssignments = assignments.filter(
      (a) => a.week_number === week.week_number
    );

    // Count completed assignments for this week
    const completed = weekAssignments.filter((a) =>
      assignmentProgress.some(
        (p) => p.assignment_id === a.id && p.status === "completed"
      )
    ).length;

    const total = weekAssignments.length;

    return {
      ...week,
      completed,
      total,
      progress: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  return (
    <div className="px-4 py-6 sm:px-6 space-y-6 max-w-7xl mx-auto">
      <div>
        <h1 className="font-serif text-xl sm:text-2xl font-bold text-foreground">
          Your Progress
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Track your journey through the 6-week discipleship program
        </p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Current Week</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Week {currentWeek}</div>
            <p className="text-xs text-muted-foreground">of 6 weeks total</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Overall Progress
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{overallProgress}%</div>
            <Progress value={overallProgress} className="mt-2 h-2" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Completed Tasks
            </CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedUnlocked}/{totalAssignmentsUpToCurrentWeek}
            </div>
            <p className="text-xs text-muted-foreground">assignments done</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Journey Status</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {currentWeek >= 6 && overallProgress === 100
                ? "Complete!"
                : "In Progress"}
            </div>
            <p className="text-xs text-muted-foreground">
              {Math.max(0, 6 - currentWeek)} weeks remaining
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Weekly Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {weeklyStats.map((week) => {
              const isCurrentWeek = week.week_number === currentWeek;
              const isPastWeek = week.week_number < currentWeek;
              const isFutureWeek = week.week_number > currentWeek;

              return (
                <div
                  key={week.id}
                  className={`rounded-lg border p-4 ${isCurrentWeek
                      ? "border-primary bg-primary/5"
                      : isFutureWeek
                        ? "border-muted bg-muted/30 opacity-60"
                        : "border-border"
                    }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-sm sm:text-base">
                          Week {week.week_number}: {week.title}
                        </h3>
                        {isCurrentWeek && (
                          <Badge variant="default">Current</Badge>
                        )}
                        {isPastWeek && week.progress === 100 && (
                          <Badge
                            variant="secondary"
                            className="bg-green-100 text-green-800"
                          >
                            Complete
                          </Badge>
                        )}
                        {isFutureWeek && (
                          <Badge variant="outline">Upcoming</Badge>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-muted-foreground line-clamp-1">
                        {week.scripture_reference}
                      </p>
                    </div>
                    <div className="text-left sm:text-right shrink-0">
                      <div className="text-base sm:text-lg font-semibold">
                        {week.completed}/{week.total}
                      </div>
                      <p className="text-xs text-muted-foreground">tasks</p>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Progress
                      value={isFutureWeek ? 0 : week.progress}
                      className="h-2"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
