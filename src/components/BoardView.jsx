import React from "react";
import styles from "./BoardView.module.css";

const BoardView = ({ tasks = [], onTaskUpdate }) => {
  // Generate the next 10 days starting from today
  const generateDays = () => {
    const days = [];
    const today = new Date();
    
    for (let i = 0; i < 10; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      
      const dateStr = date.toISOString().slice(0, 10); // YYYY-MM-DD format
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      const monthDay = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      days.push({
        date: dateStr,
        dayName,
        monthDay,
        isToday: i === 0
      });
    }
    
    return days;
  };

  const days = generateDays();

  return (
    <div className={styles.boardContainer}>
      <div className={styles.boardHeader}>
        <h2>Board View - Next 10 Days</h2>
      </div>
      
      <div className={styles.boardScrollContainer}>
        <div className={styles.board}>
          {days.map((day) => (
            <div key={day.date} className={styles.dayColumn}>
              <div className={`${styles.dayHeader} ${day.isToday ? styles.today : ''}`}>
                <div className={styles.dayName}>{day.dayName}</div>
                <div className={styles.monthDay}>{day.monthDay}</div>
                {day.isToday && <div className={styles.todayLabel}>Today</div>}
              </div>
              
              <div className={styles.taskList}>
                {/* Tasks will go here */}
                <div className={styles.emptyState}>
                  No tasks scheduled
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default BoardView;