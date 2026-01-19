"use client";

import { useEffect, useState } from "react";
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
import type { Profile, WeeklyContent, AssignmentProgress } from "@/lib/types";

export default function ProgressPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weeklyContent, setWeeklyContent] = useState<WeeklyContent[]>([]);
  const [assignmentProgress, setAssignmentProgress] = useState<
    AssignmentProgress[]
  >([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const [profileRes, contentRes, progressRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user.id).single(),
        supabase.from("weekly_content").select("*").order("week_number"),
        supabase.from("assignment_progress").select("*").eq("user_id", user.id),
      ]);

      if (profileRes.data) setProfile(profileRes.data);
      if (contentRes.data) setWeeklyContent(contentRes.data);
      if (progressRes.data) setAssignmentProgress(progressRes.data);

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
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

  const currentWeek = profile?.current_week || 1;
  const completedAssignments = assignmentProgress.filter(
    (p) => p.status === "completed"
  ).length;
  const totalAssignments = weeklyContent.reduce(
    (acc, week) => acc + (week.week_number <= currentWeek ? 3 : 0),
    0
  );
  const overallProgress =
    totalAssignments > 0
      ? Math.round((completedAssignments / totalAssignments) * 100)
      : 0;

  const weeklyStats = weeklyContent.map((week) => {
    const weekAssignments = assignmentProgress.filter(
      (p) => p.week_number === week.week_number
    );
    const completed = weekAssignments.filter(
      (p) => p.status === "completed"
    ).length;
    return {
      ...week,
      completed,
      total: 3,
      progress: Math.round((completed / 3) * 100),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold text-foreground">
          Your Progress
        </h1>
        <p className="text-muted-foreground">
          Track your journey through the 6-week discipleship program
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
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
              {completedAssignments}/{totalAssignments}
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
              {6 - currentWeek} weeks remaining
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
                  className={`rounded-lg border p-4 ${
                    isCurrentWeek
                      ? "border-primary bg-primary/5"
                      : isFutureWeek
                        ? "border-muted bg-muted/30 opacity-60"
                        : "border-border"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">
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
                      <p className="text-sm text-muted-foreground">
                        {week.scripture_reference}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-semibold">
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
