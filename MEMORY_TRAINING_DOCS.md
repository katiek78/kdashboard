# Memory Training System Documentation

## Overview

This memory training system consists of reusable components that can be used across different memory disciplines. The system follows a consistent flow: Settings → Memorization → Recall → Results.

## Components

### 1. TrainingCoordinator

The main orchestrator component that manages the training flow.

**Props:**

- `discipline` (string): The type of training ("numbers", "cards", "words", etc.)
- `title` (string): Display title for the training session

**Usage:**

```jsx
<TrainingCoordinator discipline="numbers" title="Number Sequences Training" />
```

### 2. TrainingSettings

Configurable settings component that adapts based on the discipline.

**Features:**

- Discipline-specific configuration options
- Common timing settings (memorization/recall time)
- Validation and default values

### 3. MemorizationPhase

Displays the data to be memorized with a countdown timer.

**Features:**

- Adaptive rendering based on discipline
- Countdown timer with visual urgency indicators
- Skip option for advanced users

### 4. RecallPhase

Input interface for users to recall the memorized data.

**Features:**

- Discipline-specific input fields
- Real-time scoring and results
- Detailed feedback with correct/incorrect comparisons

## Discipline Configuration

### Numbers

- **Grouping:** 1, 2, 3, or 4 digit groups
- **Amount:** 20, 40, 60, 80, or 100 numbers
- **Display:** Grid of grouped numbers
- **Input:** Text fields for each group

### Cards

- **Deck Size:** 13 (1 suit), 26 (half deck), 52 (full deck)
- **Show Suits:** Toggle for suit visibility
- **Display:** Card grid with values and suits
- **Input:** Separate fields for value and suit

### Words

- **Word Count:** 10, 15, 20, or 30 words
- **Word Type:** Random, nouns only, or concrete nouns
- **Display:** Numbered list of words
- **Input:** Text fields for each word position

## Adding a New Discipline

To add a new discipline (e.g., "names-faces"):

### 1. Update TrainingSettings.jsx

Add a new case in the `getSettingsConfig()` function:

```javascript
case "names-faces":
  return {
    title: "Names & Faces Training Settings",
    fields: [
      {
        key: "faceCount",
        label: "Number of Faces",
        type: "select",
        options: [
          { value: 5, label: "5 faces" },
          { value: 10, label: "10 faces" },
          { value: 15, label: "15 faces" }
        ]
      },
      {
        key: "showHints",
        label: "Show Name Hints",
        type: "checkbox"
      }
    ]
  };
```

### 2. Update TrainingCoordinator.jsx

Add data generation logic:

```javascript
const generateNamesFaces = (settings) => {
  const faceCount = settings.faceCount || 5;
  const names = ["John", "Sarah", "Mike", "Emma", "David"];
  const faces = []; // This would contain face image URLs or data

  return names.slice(0, faceCount).map((name, index) => ({
    name,
    faceUrl: `/faces/face${index + 1}.jpg`,
  }));
};
```

### 3. Update MemorizationPhase.jsx

Add rendering logic:

```javascript
const renderNamesFaces = () => {
  return (
    <div className={styles.namesFacesGrid}>
      {data.map((person, index) => (
        <div key={index} className={styles.personCard}>
          <img src={person.faceUrl} alt="Face" className={styles.faceImage} />
          <div className={styles.personName}>{person.name}</div>
        </div>
      ))}
    </div>
  );
};
```

### 4. Update RecallPhase.jsx

Add input fields:

```javascript
const renderNamesFacesInputs = () => {
  return (
    <div className={styles.inputGrid}>
      {originalData.map((_, index) => (
        <div key={index} className={styles.namesFaceInput}>
          <img
            src={originalData[index].faceUrl}
            alt="Face"
            className={styles.faceImage}
          />
          <input
            type="text"
            value={userInput[index] || ""}
            onChange={(e) => handleInputChange(index, e.target.value)}
            className={styles.input}
            placeholder="Enter name"
          />
        </div>
      ))}
    </div>
  );
};
```

### 5. Create the Page Component

```jsx
// src/app/memory-training/names-faces/page.js
"use client";
import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import TrainingCoordinator from "@/components/TrainingCoordinator";

export default function NamesFacesTrainingPage() {
  const loading = useAuthRedirect();

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="page">
      <main className="main">
        <div className="title">Names & Faces Training</div>
        <div className="pageContainer">
          <TrainingCoordinator
            discipline="names-faces"
            title="Names & Faces Training"
          />
        </div>
      </main>
    </div>
  );
}
```

## Future Enhancements

### 1. Data Persistence

- Save training history and statistics
- User preferences and settings
- Progress tracking over time

### 2. Advanced Features

- Adaptive difficulty based on performance
- Multiple training modes (speed, accuracy, endurance)
- Custom data sets (user-provided lists)

### 3. Analytics

- Performance metrics and charts
- Comparative analysis across disciplines
- Improvement suggestions

### 4. Gamification

- Achievement badges
- Leaderboards
- Daily challenges

## File Structure

```
src/
  components/
    TrainingCoordinator.jsx           # Main orchestrator
    TrainingCoordinator.module.css
    TrainingSettings.jsx              # Settings configuration
    TrainingSettings.module.css
    MemorizationPhase.jsx            # Memorization component
    MemorizationPhase.module.css
    RecallPhase.jsx                  # Recall component
    RecallPhase.module.css
  app/
    memory-training/
      numbers/page.js                # Numbers training page
      words/page.js                  # Words training page
      cards/page.js                  # Cards training page
```

This modular architecture makes it easy to add new disciplines while maintaining consistency across the training experience.
