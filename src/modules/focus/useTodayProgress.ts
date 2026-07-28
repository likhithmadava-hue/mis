import { useState, useEffect } from "preact/hooks";
import { BookOpen, ListChecks, ListTodo, Repeat } from "lucide-preact";
import {
  ArborDatabase,
  type DailyMetric,
  type Habit,
  type TopicItem,
  type UserConfig,
} from "../../core/db";

export interface RemainingItem {
  key: string;
  label: string;
  icon: typeof BookOpen;
  /** counts down to 0 */
  left: number;
  /** what `left` started from — together they give the bar */
  total: number;
  unit: string;
  /** the progress line under the bar */
  done: string;
}

/**
 * What's still outstanding today, for the timer's "Left Today" panel.
 *
 * Read-only on purpose: the Daily Log owns editing all of this. The timer just
 * shows you what you're still working toward while the clock runs.
 */
export function useTodayProgress(triggerUpdate: number) {
  const [today, setToday] = useState<DailyMetric>(
    ArborDatabase.getTodayMetric(),
  );
  const [user, setUser] = useState<UserConfig>(ArborDatabase.getUserConfig());
  const [topics, setTopics] = useState<TopicItem[]>(ArborDatabase.getTopics());
  const [habits, setHabits] = useState<Habit[]>(ArborDatabase.getHabits());
  const [habitsDone, setHabitsDone] = useState<string[]>(
    ArborDatabase.getHabitsDoneOn(),
  );

  useEffect(() => {
    setToday(ArborDatabase.getTodayMetric());
    setUser(ArborDatabase.getUserConfig());
    setTopics(ArborDatabase.getTopics());
    setHabits(ArborDatabase.getHabits());
    setHabitsDone(ArborDatabase.getHabitsDoneOn());
  }, [triggerUpdate]);

  const toRevise = topics.filter((t) => t.type === "revise");

  // study hours keep one decimal because a focus round adds fractions of an hour
  const remaining: RemainingItem[] = [
    {
      key: "study",
      label: "Hours of study",
      icon: BookOpen,
      left: Math.max(
        0,
        Math.round((user.target_study_hours - today.study_hours) * 10) / 10,
      ),
      total: user.target_study_hours,
      unit: "h",
      done: `${today.study_hours}h of ${user.target_study_hours}h done`,
    },
    {
      key: "dpps",
      label: "DPPs",
      icon: ListChecks,
      left: Math.max(0, today.dpps_got - today.dpps_complete),
      total: today.dpps_got,
      unit: "",
      done: `${today.dpps_complete} of ${today.dpps_got} finished`,
    },
    {
      key: "revise",
      label: "Topics to revise",
      icon: ListTodo,
      left: toRevise.filter((t) => !t.done).length,
      total: toRevise.length,
      unit: "",
      done: `${toRevise.filter((t) => t.done).length} revised`,
    },
    {
      key: "habits",
      label: "Habits",
      icon: Repeat,
      left: habits.filter((h) => !habitsDone.includes(h.id)).length,
      total: habits.length,
      unit: "",
      done: `${habitsDone.length} of ${habits.length} ticked`,
    },
  ];

  return { remaining, allClear: remaining.every((r) => r.left === 0) };
}
