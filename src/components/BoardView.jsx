import React from "react";
import { useRouter } from "next/navigation";
import BoardTaskItem from "./BoardTaskItem";
import styles from "./BoardView.module.css";

const BoardView = ({ tasks = [], onTaskUpdate, onTaskComplete }) => {
  const router = useRouter();

  const playTask = (id) => {
    router.push(`/focus/${id}`);
  };

  const handleTaskComplete = (taskId) => {
    console.log("BoardView handling task completion:", taskId);
    if (onTaskComplete) {
      onTaskComplete(taskId);
    }
  };

  // Generate the next 10 days starting from today
  const generateDays = () => {
    const days = [];
    const today = new Date();

    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);

      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD format
      const dayName = date.toLocaleDateString("en-US", { weekday: "short" });
      const monthDay = date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      days.push({
        date: dateStr,
        dayName,
        monthDay,
        isToday: i === 0,
      });
    }

    return days;
  };

  // Distribute tasks to appropriate columns
  const distributeTasksToColumns = () => {
    const days = generateDays();
    const today = new Date().toISOString().slice(0, 10);
    const maxDate = days[days.length - 1].date; // Last day in our 10-day view

    console.log("Board View - Distributing tasks:", tasks.length, "tasks");
    console.log("Today:", today, "MaxDate:", maxDate);

    const tasksByColumn = {};
    const futureTasks = [];

    // Initialize empty arrays for each day
    days.forEach((day) => {
      tasksByColumn[day.date] = [];
    });

    tasks.forEach((task) => {
      // Handle repeating tasks
      if (task.repeat) {
        const rep = task.repeat.trim().toLowerCase();
        // ONLY pure daily tasks (d, daily) always show on today
        // Numbered day tasks (2d, 3d, etc.) should respect their next_due date
        if (rep === "d" || rep === "daily") {
          if (tasksByColumn[today]) {
            tasksByColumn[today].push(task);
          }
          return;
        }
      }

      // For non-daily repeating tasks and one-time tasks, use their next_due date
      if (task.next_due) {
        if (task.next_due <= today) {
          // Tasks due today or in the past go to today's column
          if (tasksByColumn[today]) {
            tasksByColumn[today].push(task);
          }
        } else if (task.next_due <= maxDate && tasksByColumn[task.next_due]) {
          // Tasks due within our 10-day view go to their specific day
          tasksByColumn[task.next_due].push(task);
        } else if (task.next_due > maxDate) {
          // Tasks due beyond our 10-day view go to Future
          futureTasks.push(task);
        }
      } else {
        // Tasks with no due date go to today
        if (tasksByColumn[today]) {
          tasksByColumn[today].push(task);
        }
      }
    });

    return { tasksByColumn, futureTasks, days };
  };

  const { tasksByColumn, futureTasks, days } = distributeTasksToColumns();

  return (
    <div className={styles.boardContainer}>
      <div className={styles.boardHeader}>
        <h2>Board View - Next 10 Days</h2>
      </div>

      <div className={styles.boardScrollContainer}>
        <div className={styles.board}>
          {/* Day columns */}
          {days.map((day) => {
            const dayTasks = tasksByColumn[day.date] || [];
            return (
              <div key={day.date} className={styles.dayColumn}>
                <div
                  className={`${styles.dayHeader} ${
                    day.isToday ? styles.today : ""
                  }`}
                >
                  <div className={styles.dayName}>{day.dayName}</div>
                  <div className={styles.monthDay}>{day.monthDay}</div>
                  {day.isToday && (
                    <div className={styles.todayLabel}>Today</div>
                  )}
                </div>

                <div className={styles.taskList}>
                  {dayTasks.length > 0 ? (
                    dayTasks.map((task) => (
                      <BoardTaskItem
                        key={task.id}
                        task={task}
                        onPlay={playTask}
                        onComplete={handleTaskComplete}
                      />
                    ))
                  ) : (
                    <div className={styles.emptyState}>No tasks scheduled</div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Future column */}
          <div className={styles.dayColumn}>
            <div className={`${styles.dayHeader} ${styles.futureHeader}`}>
              <div className={styles.dayName}>Future</div>
              <div className={styles.monthDay}>Later</div>
            </div>

            <div className={styles.taskList}>
              {futureTasks.length > 0 ? (
                futureTasks.map((task) => (
                  <BoardTaskItem
                    key={task.id}
                    task={task}
                    onPlay={playTask}
                    onComplete={handleTaskComplete}
                  />
                ))
              ) : (
                <div className={styles.emptyState}>No future tasks</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BoardView;
