"use client";

import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";
import { fetchCompImage } from "../utils/compImagesUtils";
import styles from "./PiTestContainer.module.css";

const TEST_MODES = {
  DIGITS_TO_CHUNK: "digits-to-chunk",
  CHUNK_TO_DIGITS: "chunk-to-digits",
};

const TRAINING_MODES = {
  FINITE: "finite",
  INFINITE: "infinite",
};

export default function PiTestContainer() {
  const [testMode, setTestMode] = useState(TEST_MODES.DIGITS_TO_CHUNK);
  const [trainingMode, setTrainingMode] = useState(TRAINING_MODES.INFINITE);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [chunkBreakdown, setChunkBreakdown] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [allChunks, setAllChunks] = useState([]);

  // Training mode specific state
  const [finiteStack, setFiniteStack] = useState([]); // Items to learn in finite mode
  const [masteredItems, setMasteredItems] = useState(new Set()); // Items mastered in finite mode
  const [itemCorrectCounts, setItemCorrectCounts] = useState(new Map()); // Track consecutive correct answers
  const [priorityQueue, setPriorityQueue] = useState([]); // Wrong items for both modes
  const [itemCounter, setItemCounter] = useState(0); // Count of items shown for priority queue timing
  const [sessionStats, setSessionStats] = useState({
    attempted: new Set(),
    mastered: 0,
    remaining: 0,
  });
  const [lastShownChunk, setLastShownChunk] = useState(null); // Track last shown to prevent immediate repeats

  // Range selection state
  const [rangeMode, setRangeMode] = useState("all"); // "all", "chunks", "digits"
  const [chunkRangeStart, setChunkRangeStart] = useState(1);
  const [chunkRangeEnd, setChunkRangeEnd] = useState(100);
  const [digitRangeStart, setDigitRangeStart] = useState(1);
  const [digitRangeEnd, setDigitRangeEnd] = useState(500);
  const [filteredChunks, setFilteredChunks] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [sessionRestored, setSessionRestored] = useState(false);
  const [isRestoringSession, setIsRestoringSession] = useState(false);

  // Temporary input states for editing (to avoid validation on every keystroke)
  const [tempChunkStart, setTempChunkStart] = useState("1");
  const [tempChunkEnd, setTempChunkEnd] = useState("100");
  const [tempDigitStart, setTempDigitStart] = useState("1");
  const [tempDigitEnd, setTempDigitEnd] = useState("500");

  // Session persistence functions
  const saveSessionToLocalStorage = () => {
    const sessionData = {
      testMode,
      trainingMode,
      score,
      finiteStack,
      masteredItems: Array.from(masteredItems),
      itemCorrectCounts: Array.from(itemCorrectCounts.entries()),
      priorityQueue,
      itemCounter,
      sessionStats: {
        ...sessionStats,
        attempted: Array.from(sessionStats.attempted),
      },
      lastShownChunk,
      rangeMode,
      chunkRangeStart,
      chunkRangeEnd,
      digitRangeStart,
      digitRangeEnd,
      timestamp: Date.now(),
    };
    localStorage.setItem("piTestSession", JSON.stringify(sessionData));
  };

  const loadSessionFromLocalStorage = () => {
    try {
      const saved = localStorage.getItem("piTestSession");
      if (saved) {
        const sessionData = JSON.parse(saved);

        // Check if session is less than 24 hours old
        const hoursSinceLastSession =
          (Date.now() - sessionData.timestamp) / (1000 * 60 * 60);
        if (hoursSinceLastSession < 24) {
          return {
            ...sessionData,
            masteredItems: new Set(sessionData.masteredItems),
            itemCorrectCounts: new Map(sessionData.itemCorrectCounts),
            sessionStats: {
              ...sessionData.sessionStats,
              attempted: new Set(sessionData.sessionStats.attempted),
            },
          };
        }
      }
    } catch (error) {
      console.error("Error loading session from localStorage:", error);
    }
    return null;
  };

  const clearSession = () => {
    localStorage.removeItem("piTestSession");
  };

  // Get detailed breakdown for a chunk (person + digit meanings)
  // Priority queue management for wrong answers
  const addToPriorityQueue = (chunkId, priority = 1) => {
    const itemIntervals = [4, 8, 12]; // Show after 4, 8, 12 items
    const itemsToWait = itemIntervals[priority - 1] || 4;
    const showAfterItemCount = itemCounter + itemsToWait;

    setPriorityQueue((prev) => {
      const existing = prev.find((item) => item.chunkId === chunkId);
      if (existing) {
        // Update existing item with new item count
        return prev.map((item) =>
          item.chunkId === chunkId
            ? {
                ...item,
                showAfterItemCount: showAfterItemCount,
                priority: Math.min(priority, 3),
              }
            : item
        );
      } else {
        // Add new item to queue
        return [
          ...prev,
          {
            chunkId,
            showAfterItemCount: showAfterItemCount,
            priority,
            attempts: 0,
          },
        ];
      }
    });
  };

  // Get next question from priority queue if available
  const getFromPriorityQueue = () => {
    const availableItems = priorityQueue.filter(
      (item) => item.showAfterItemCount <= itemCounter
    );

    if (availableItems.length > 0) {
      // Remove the item from queue and return it
      const item = availableItems[0];
      setPriorityQueue((prev) =>
        prev.filter((q) => q.chunkId !== item.chunkId)
      );
      return item.chunkId;
    }

    return null;
  };

  // Initialize finite mode stack
  const initializeFiniteMode = (forceReset = false) => {
    // Don't reset if we're restoring a session or if there's existing progress (unless forced)
    if (
      !forceReset &&
      (isRestoringSession ||
        sessionStats.mastered > 0 ||
        priorityQueue.length > 0)
    ) {
      return;
    }

    const chunksToUse = filteredChunks.length > 0 ? filteredChunks : allChunks;
    setFiniteStack([...chunksToUse]);
    setMasteredItems(new Set());
    setItemCorrectCounts(new Map());
    setPriorityQueue([]);
    setItemCounter(0);
    setSessionStats({
      attempted: new Set(),
      mastered: 0,
      remaining: chunksToUse.length,
    });
  };

  // Handle correct answer in finite mode
  const handleFiniteCorrect = (chunkId) => {
    // Check if this item has ever been answered incorrectly
    const hasBeenWrong = itemCorrectCounts.has(chunkId);

    if (!hasBeenWrong) {
      // First time seeing this item and got it right - remove it permanently
      console.log(`Chunk ${chunkId} got RIGHT on first attempt - MASTERED!`);
      setMasteredItems((prev) => new Set(prev.add(chunkId)));
      setFiniteStack((prev) =>
        prev.filter((chunk) => chunk.position !== chunkId)
      );
      setSessionStats((prev) => ({
        ...prev,
        mastered: prev.mastered + 1,
        remaining: prev.remaining - 1,
      }));
    } else {
      // This item has been wrong before, so we need consecutive correct answers
      const currentCount = itemCorrectCounts.get(chunkId) || 0;
      const newCount = currentCount + 1;

      console.log(
        `Chunk ${chunkId} (previously wrong): ${currentCount} → ${newCount} consecutive correct`
      );

      setItemCorrectCounts((prev) => new Map(prev.set(chunkId, newCount)));

      if (newCount >= 3) {
        console.log(`Chunk ${chunkId} MASTERED after 3 consecutive correct!`);
        // Item mastered - remove from all queues
        setMasteredItems((prev) => new Set(prev.add(chunkId)));
        setFiniteStack((prev) =>
          prev.filter((chunk) => chunk.position !== chunkId)
        );
        setPriorityQueue((prev) =>
          prev.filter((item) => item.chunkId !== chunkId)
        );
        setSessionStats((prev) => ({
          ...prev,
          mastered: prev.mastered + 1,
          remaining: prev.remaining - 1,
        }));
      }
    }
  };

  // Handle wrong answer in finite mode
  const handleFiniteWrong = (chunkId) => {
    // Reset consecutive correct count
    setItemCorrectCounts((prev) => new Map(prev.set(chunkId, 0)));

    // Check if item is already in priority queue
    const existingItem = priorityQueue.find((item) => item.chunkId === chunkId);
    if (existingItem) {
      // Item already in review - just reset its intervals with updated priority
      const newPriority = Math.min(existingItem.priority + 1, 3);
      addToPriorityQueue(chunkId, newPriority);
    } else {
      // New item to add to review queue
      addToPriorityQueue(chunkId, 1);
    }
  };

  const getChunkBreakdown = async (chunkNumber) => {
    try {
      // Get the chunk data
      const { data: chunkData, error: chunkError } = await supabase
        .from("pi_matrix")
        .select("digits")
        .eq("position", chunkNumber)
        .single();

      if (chunkError) throw chunkError;

      const digits = chunkData.digits;

      // Get person data using same logic as PiMatrixView
      const lookupKey =
        chunkNumber < 10
          ? chunkNumber.toString().padStart(2, "0")
          : chunkNumber.toString();

      const { data: personData, error: personError } = await supabase
        .from("numberstrings")
        .select("person")
        .eq("num_string", lookupKey)
        .single();

      const person = personData?.person || null;

      // Split into 2+3 digits for meanings
      const firstTwo = digits.substring(0, 2);
      const lastThree = digits.substring(2, 5);

      // Get competition image meanings
      const firstTwoMeaning = await fetchCompImage(firstTwo);
      const lastThreeMeaning = await fetchCompImage(lastThree);

      return {
        chunkNumber,
        digits,
        person,
        breakdown: {
          firstTwo: {
            digits: firstTwo,
            meaning: firstTwoMeaning?.comp_image || "No meaning found",
          },
          lastThree: {
            digits: lastThree,
            meaning: lastThreeMeaning?.comp_image || "No meaning found",
          },
        },
      };
    } catch (error) {
      console.error("Error getting chunk breakdown:", error);
      return null;
    }
  };

  // Check if we're on mobile and set default settings visibility
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      // Set initial state based on screen size
      if (mobile) {
        setShowSettings(false); // Hide settings on mobile by default
      } else {
        setShowSettings(true); // Show settings on desktop by default
      }
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Load saved session on component mount
  useEffect(() => {
    const savedSession = loadSessionFromLocalStorage();
    if (savedSession) {
      setIsRestoringSession(true);
      setTestMode(savedSession.testMode);
      setTrainingMode(savedSession.trainingMode);
      setScore(savedSession.score);
      setFiniteStack(savedSession.finiteStack);
      setMasteredItems(savedSession.masteredItems);
      setItemCorrectCounts(savedSession.itemCorrectCounts);
      setPriorityQueue(savedSession.priorityQueue);
      setItemCounter(savedSession.itemCounter);
      setSessionStats(savedSession.sessionStats);
      setLastShownChunk(savedSession.lastShownChunk);
      setRangeMode(savedSession.rangeMode);
      setChunkRangeStart(savedSession.chunkRangeStart);
      setChunkRangeEnd(savedSession.chunkRangeEnd);
      setDigitRangeStart(savedSession.digitRangeStart);
      setDigitRangeEnd(savedSession.digitRangeEnd);
      setSessionRestored(true);

      // Clear the restoring flag after a brief delay
      setTimeout(() => setIsRestoringSession(false), 100);

      // Hide the restored message after 3 seconds
      setTimeout(() => setSessionRestored(false), 3000);
    }
  }, []);

  // Update temp states when actual values change (e.g., from presets)
  useEffect(() => {
    setTempChunkStart(chunkRangeStart.toString());
    setTempChunkEnd(chunkRangeEnd.toString());
    setTempDigitStart(digitRangeStart.toString());
    setTempDigitEnd(digitRangeEnd.toString());
  }, [chunkRangeStart, chunkRangeEnd, digitRangeStart, digitRangeEnd]);

  // Input validation helpers
  const handleChunkStartBlur = () => {
    const value = Math.max(1, parseInt(tempChunkStart) || 1);
    setChunkRangeStart(value);
    setTempChunkStart(value.toString());
  };

  const handleChunkEndBlur = () => {
    const value = Math.min(2000, parseInt(tempChunkEnd) || 100);
    setChunkRangeEnd(value);
    setTempChunkEnd(value.toString());
  };

  const handleDigitStartBlur = () => {
    const value = Math.max(1, parseInt(tempDigitStart) || 1);
    setDigitRangeStart(value);
    setTempDigitStart(value.toString());
  };

  const handleDigitEndBlur = () => {
    const value = Math.min(10000, parseInt(tempDigitEnd) || 500);
    setDigitRangeEnd(value);
    setTempDigitEnd(value.toString());
  };

  // Load all chunks on component mount
  useEffect(() => {
    const loadAllChunks = async () => {
      const { data, error } = await supabase
        .from("pi_matrix")
        .select("position, digits")
        .order("position");

      if (error) {
        console.error("Error loading pi chunks:", error);
      } else {
        setAllChunks(data || []);
      }
    };

    loadAllChunks();
  }, []);

  // Filter chunks based on selected range
  useEffect(() => {
    if (allChunks.length === 0) return;

    let filtered = [...allChunks];

    if (rangeMode === "chunks") {
      filtered = allChunks.filter(
        (chunk) =>
          chunk.position >= chunkRangeStart && chunk.position <= chunkRangeEnd
      );
    } else if (rangeMode === "digits") {
      // Convert digit range to chunk range
      const startChunk = Math.ceil(digitRangeStart / 5);
      const endChunk = Math.ceil(digitRangeEnd / 5);
      filtered = allChunks.filter(
        (chunk) => chunk.position >= startChunk && chunk.position <= endChunk
      );
    }

    setFilteredChunks(filtered);

    // Reset current question when range changes
    if (currentQuestion) {
      setCurrentQuestion(null);
      setShowAnswer(false);
    }
  }, [
    allChunks,
    rangeMode,
    chunkRangeStart,
    chunkRangeEnd,
    digitRangeStart,
    digitRangeEnd,
  ]);

  // Initialize finite mode when chunks change (but not during session restore)
  useEffect(() => {
    if (
      !isRestoringSession &&
      trainingMode === TRAINING_MODES.FINITE &&
      (filteredChunks.length > 0 || allChunks.length > 0)
    ) {
      initializeFiniteMode();
    }
  }, [filteredChunks, allChunks, trainingMode, isRestoringSession]);

  // Auto-save session when important state changes
  useEffect(() => {
    // Only save if we have some actual session data and we're not currently restoring
    if (
      !isRestoringSession &&
      (score.total > 0 || sessionStats.mastered > 0 || priorityQueue.length > 0)
    ) {
      saveSessionToLocalStorage();
    }
  }, [
    testMode,
    trainingMode,
    score,
    finiteStack,
    masteredItems,
    itemCorrectCounts,
    priorityQueue,
    itemCounter,
    sessionStats,
    lastShownChunk,
    rangeMode,
    chunkRangeStart,
    chunkRangeEnd,
    digitRangeStart,
    digitRangeEnd,
  ]);

  // Generate a new question based on the current test mode
  const handleShowBreakdown = async () => {
    if (!currentQuestion) return;

    let chunkNumber;
    if (currentQuestion.type === "digits-to-chunk") {
      chunkNumber = currentQuestion.correctAnswer;
    } else {
      chunkNumber = currentQuestion.position;
    }

    const breakdown = await getChunkBreakdown(chunkNumber);
    setChunkBreakdown(breakdown);
    setShowDetailedBreakdown(true);
  };

  const generateQuestion = () => {
    setLoading(true);
    setShowAnswer(false);
    setShowDetailedBreakdown(false);
    setChunkBreakdown(null);

    // Increment item counter for priority queue timing
    setItemCounter((prev) => prev + 1);

    let selectedChunk = null;

    if (trainingMode === TRAINING_MODES.FINITE) {
      // Finite mode: prioritize wrong answers, then items from stack
      const priorityChunkId = getFromPriorityQueue();

      if (priorityChunkId) {
        // Get chunk from priority queue
        const chunksToUse =
          filteredChunks.length > 0 ? filteredChunks : allChunks;
        selectedChunk = chunksToUse.find(
          (chunk) => chunk.position === priorityChunkId
        );
      } else if (finiteStack.length > 0) {
        // Get next item from finite stack
        const availableStack = finiteStack.filter(
          (chunk) => !masteredItems.has(chunk.position)
        );

        if (availableStack.length > 0) {
          // Prevent immediate repeats unless it's the only item left
          let candidateStack = availableStack;
          if (availableStack.length > 1 && lastShownChunk) {
            candidateStack = availableStack.filter(
              (chunk) => chunk.position !== lastShownChunk
            );
            // If filtering leaves us with no options, use the full stack
            if (candidateStack.length === 0) {
              candidateStack = availableStack;
            }
          }

          selectedChunk =
            candidateStack[Math.floor(Math.random() * candidateStack.length)];
        }
      }

      // Check if finite mode is complete
      if (!selectedChunk) {
        alert(
          `Congratulations! You've mastered all ${sessionStats.mastered} items in this range!`
        );
        setLoading(false);
        return;
      }
    } else {
      // Infinite mode: prioritize wrong answers, then random selection
      const priorityChunkId = getFromPriorityQueue();

      if (priorityChunkId) {
        const chunksToUse =
          filteredChunks.length > 0 ? filteredChunks : allChunks;
        selectedChunk = chunksToUse.find(
          (chunk) => chunk.position === priorityChunkId
        );
      } else {
        // Random selection from all available chunks
        const chunksToUse =
          filteredChunks.length > 0 ? filteredChunks : allChunks;
        if (chunksToUse.length > 0) {
          // Prevent immediate repeats unless it's the only chunk available
          let candidateChunks = chunksToUse;
          if (chunksToUse.length > 1 && lastShownChunk) {
            candidateChunks = chunksToUse.filter(
              (chunk) => chunk.position !== lastShownChunk
            );
            // If filtering leaves us with no options, use the full list
            if (candidateChunks.length === 0) {
              candidateChunks = chunksToUse;
            }
          }

          selectedChunk =
            candidateChunks[Math.floor(Math.random() * candidateChunks.length)];
        }
      }
    }

    if (!selectedChunk) {
      setLoading(false);
      return;
    }

    // Track the last shown chunk to prevent immediate repeats
    setLastShownChunk(selectedChunk.position);

    // Track attempted items in finite mode
    if (trainingMode === TRAINING_MODES.FINITE) {
      setSessionStats((prev) => ({
        ...prev,
        attempted: new Set(prev.attempted.add(selectedChunk.position)),
      }));
    }

    if (testMode === TEST_MODES.DIGITS_TO_CHUNK) {
      // Find ALL chunks with these digits that are in the current range
      const chunksToUse =
        filteredChunks.length > 0 ? filteredChunks : allChunks;
      const allMatchingChunks = chunksToUse.filter(
        (chunk) => chunk.digits === selectedChunk.digits
      );

      setCurrentQuestion({
        type: "digits-to-chunk",
        digits: selectedChunk.digits,
        correctAnswer: selectedChunk.position, // Primary answer for display
        allCorrectAnswers: allMatchingChunks.map((chunk) => chunk.position), // All valid answers
        question:
          allMatchingChunks.length > 1
            ? `Which chunk do these digits belong to? (Multiple chunks have these digits)`
            : `Which chunk do these digits belong to?`,
        chunkId: selectedChunk.position,
      });
    } else if (testMode === TEST_MODES.CHUNK_TO_DIGITS) {
      setCurrentQuestion({
        type: "chunk-to-digits",
        position: selectedChunk.position,
        correctAnswer: selectedChunk.digits,
        question: `What are the digits for chunk ${selectedChunk.position}?`,
        chunkId: selectedChunk.position,
      });
    }

    setLoading(false);
  };

  // Start the first question
  useEffect(() => {
    const chunksToUse = filteredChunks.length > 0 ? filteredChunks : allChunks;
    if (chunksToUse.length > 0 && !currentQuestion) {
      generateQuestion();
    }
  }, [filteredChunks, allChunks, testMode, trainingMode]);

  const handleRevealAnswer = () => {
    setShowAnswer(true);
  };

  const handleMarkCorrect = () => {
    setScore((prev) => ({ correct: prev.correct + 1, total: prev.total + 1 }));

    if (currentQuestion && currentQuestion.chunkId) {
      if (trainingMode === TRAINING_MODES.FINITE) {
        handleFiniteCorrect(currentQuestion.chunkId);
      }
      // For infinite mode, correct answers just remove from priority queue if present
      setPriorityQueue((prev) =>
        prev.filter((item) => item.chunkId !== currentQuestion.chunkId)
      );
    }

    generateQuestion();
  };

  const handleMarkIncorrect = () => {
    setScore((prev) => ({ correct: prev.correct, total: prev.total + 1 }));

    if (currentQuestion && currentQuestion.chunkId) {
      if (trainingMode === TRAINING_MODES.FINITE) {
        handleFiniteWrong(currentQuestion.chunkId);
      } else {
        // Infinite mode: add to priority queue with escalating priority
        const existingItem = priorityQueue.find(
          (item) => item.chunkId === currentQuestion.chunkId
        );
        const newPriority = existingItem
          ? Math.min(existingItem.priority + 1, 3)
          : 1;
        addToPriorityQueue(currentQuestion.chunkId, newPriority);
      }
    }

    generateQuestion();
  };

  const handleNewQuestion = () => {
    generateQuestion();
  };

  const resetScore = () => {
    setScore({ correct: 0, total: 0 });
    setPriorityQueue([]);
    setItemCounter(0);

    if (trainingMode === TRAINING_MODES.FINITE) {
      initializeFiniteMode(true); // Force reset when user clicks reset
    }

    // Clear saved session when resetting
    clearSession();
  };

  const changeTestMode = (newMode) => {
    setTestMode(newMode);
    setCurrentQuestion(null);
    setShowAnswer(false);
  };

  const changeTrainingMode = (newMode) => {
    const wasActualChange = newMode !== trainingMode;
    setTrainingMode(newMode);
    setCurrentQuestion(null);
    setShowAnswer(false);

    // Only reset score if this is a real user change, not session restoration
    if (wasActualChange && !isRestoringSession) {
      resetScore();
    }

    if (newMode === TRAINING_MODES.FINITE) {
      initializeFiniteMode(wasActualChange && !isRestoringSession); // Only force reset if it's a real user change
    }
  };

  if (loading) {
    return (
      <div className={styles.container + " pageContainer"}>
        <div className={styles.loading}>Loading test...</div>
      </div>
    );
  }

  return (
    <div className={styles.container + " pageContainer"}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h1>Pi Test</h1>
          {sessionRestored && (
            <span className={styles.sessionRestored}>↻ Session restored</span>
          )}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={styles.settingsToggle}
          >
            ⚙️ {showSettings ? "Hide" : "Settings"}
          </button>
        </div>

        {/* Score/Progress display - always visible */}
        <div className={styles.scoreDisplay}>
          {trainingMode === TRAINING_MODES.INFINITE ? (
            // Infinite mode: Show score
            <span className={styles.scoreText}>
              Score: {score.correct}/{score.total}
              {score.total > 0 && (
                <span className={styles.percentage}>
                  ({Math.round((score.correct / score.total) * 100)}%)
                </span>
              )}
            </span>
          ) : (
            // Finite mode: Show progress
            <span className={styles.scoreText}>
              Progress: {sessionStats.mastered}/
              {sessionStats.mastered + sessionStats.remaining} mastered
              {priorityQueue.length > 0 && (
                <span className={styles.percentage}>
                  • {priorityQueue.length} in review
                </span>
              )}
            </span>
          )}

          {/* Range info for infinite mode */}
          {trainingMode === TRAINING_MODES.INFINITE &&
            filteredChunks.length > 0 &&
            rangeMode !== "all" && (
              <span className={styles.trainingInfo}>
                {filteredChunks.length} chunks
              </span>
            )}

          <button onClick={resetScore} className={styles.resetButton}>
            Reset
          </button>
        </div>

        <div
          className={`${styles.settingsSection} ${
            showSettings ? styles.settingsVisible : styles.settingsHidden
          }`}
        >
          <div className={styles.controls}>
            <div className={styles.modeSelector}>
              <label>Test Mode:</label>
              <select
                value={testMode}
                onChange={(e) => changeTestMode(e.target.value)}
                className={styles.modeSelect}
              >
                <option value={TEST_MODES.DIGITS_TO_CHUNK}>
                  Digits → Chunk
                </option>
                <option value={TEST_MODES.CHUNK_TO_DIGITS}>
                  Chunk → Digits
                </option>
              </select>
            </div>

            <div className={styles.modeSelector}>
              <label>Training Mode:</label>
              <select
                value={trainingMode}
                onChange={(e) => changeTrainingMode(e.target.value)}
                className={styles.modeSelect}
              >
                <option value={TRAINING_MODES.INFINITE}>
                  Infinite (Random Loop)
                </option>
                <option value={TRAINING_MODES.FINITE}>
                  Finite (Master Each Item)
                </option>
              </select>
            </div>
          </div>

          <div className={styles.rangeControls}>
            <div className={styles.rangeSelector}>
              <label>Range:</label>
              <select
                value={rangeMode}
                onChange={(e) => setRangeMode(e.target.value)}
                className={styles.rangeSelect}
              >
                <option value="all">All Chunks (1-2000)</option>
                <option value="chunks">Chunk Range</option>
                <option value="digits">Digit Range</option>
              </select>
            </div>

            {rangeMode === "chunks" && (
              <div className={styles.rangeInputs}>
                <div className={styles.rangeInput}>
                  <label>From Chunk:</label>
                  <input
                    type="number"
                    value={tempChunkStart}
                    onChange={(e) => setTempChunkStart(e.target.value)}
                    onBlur={handleChunkStartBlur}
                    min="1"
                    max="2000"
                    className={styles.numberInput}
                  />
                </div>
                <div className={styles.rangeInput}>
                  <label>To Chunk:</label>
                  <input
                    type="number"
                    value={tempChunkEnd}
                    onChange={(e) => setTempChunkEnd(e.target.value)}
                    onBlur={handleChunkEndBlur}
                    min="1"
                    max="2000"
                    className={styles.numberInput}
                  />
                </div>
                <div className={styles.rangeInfo}>
                  ({Math.max(0, chunkRangeEnd - chunkRangeStart + 1)} chunks)
                </div>
              </div>
            )}

            {rangeMode === "digits" && (
              <div className={styles.rangeInputs}>
                <div className={styles.rangeInput}>
                  <label>From Digit:</label>
                  <input
                    type="number"
                    value={tempDigitStart}
                    onChange={(e) => setTempDigitStart(e.target.value)}
                    onBlur={handleDigitStartBlur}
                    min="1"
                    max="10000"
                    className={styles.numberInput}
                  />
                </div>
                <div className={styles.rangeInput}>
                  <label>To Digit:</label>
                  <input
                    type="number"
                    value={tempDigitEnd}
                    onChange={(e) => setTempDigitEnd(e.target.value)}
                    onBlur={handleDigitEndBlur}
                    min="1"
                    max="10000"
                    className={styles.numberInput}
                  />
                </div>
                <div className={styles.rangeInfo}>
                  (Chunks {Math.ceil(digitRangeStart / 5)}-
                  {Math.ceil(digitRangeEnd / 5)},{" "}
                  {Math.ceil((digitRangeEnd - digitRangeStart + 1) / 5)} chunks)
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {currentQuestion && (
        <div className={styles.questionContainer}>
          <div className={styles.questionHeader}>
            <h2>{currentQuestion.question}</h2>
          </div>

          <div className={styles.questionContent}>
            {currentQuestion.type === "digits-to-chunk" && (
              <div className={styles.digitsDisplay}>
                <div className={styles.digitsLabel}>Digits:</div>
                <div className={styles.digitsValue}>
                  {currentQuestion.digits.split("").join(" ")}
                </div>
                {currentQuestion.allCorrectAnswers &&
                  currentQuestion.allCorrectAnswers.length > 1 && (
                    <div className={styles.duplicateNote}>
                      ⚠️ These digits appear in{" "}
                      {currentQuestion.allCorrectAnswers.length} different
                      chunks
                    </div>
                  )}
              </div>
            )}

            {currentQuestion.type === "chunk-to-digits" && (
              <div className={styles.chunkDisplay}>
                <div className={styles.chunkLabel}>Chunk Position:</div>
                <div className={styles.chunkValue}>
                  {currentQuestion.position}
                </div>
                <div className={styles.chunkRange}>
                  (Digits {(currentQuestion.position - 1) * 5 + 1}-
                  {currentQuestion.position * 5} of π)
                </div>
              </div>
            )}
          </div>

          <div className={styles.answerSection}>
            {!showAnswer ? (
              <button
                onClick={handleRevealAnswer}
                className={styles.revealButton}
              >
                Reveal Answer
              </button>
            ) : (
              <div className={styles.answerRevealed}>
                <div className={styles.answerLabel}>Answer:</div>
                <div className={styles.answerValue}>
                  {currentQuestion.type === "digits-to-chunk" && (
                    <>
                      <div className={styles.answerMain}>
                        {currentQuestion.allCorrectAnswers &&
                        currentQuestion.allCorrectAnswers.length > 1 ? (
                          <div>
                            <div>
                              Chunks:{" "}
                              {currentQuestion.allCorrectAnswers.join(", ")}
                            </div>
                            <div className={styles.duplicateNote}>
                              (These digits appear in multiple chunks)
                            </div>
                          </div>
                        ) : (
                          currentQuestion.correctAnswer
                        )}
                      </div>
                      <div className={styles.answerDetail}>
                        {currentQuestion.allCorrectAnswers &&
                        currentQuestion.allCorrectAnswers.length > 1
                          ? `Multiple occurrences of digits ${currentQuestion.digits}`
                          : `(Digits ${
                              (currentQuestion.correctAnswer - 1) * 5 + 1
                            }-${currentQuestion.correctAnswer * 5} of π)`}
                      </div>
                    </>
                  )}
                  {currentQuestion.type === "chunk-to-digits" && (
                    <div className={styles.answerMain}>
                      {currentQuestion.correctAnswer.split("").join(" ")}
                    </div>
                  )}
                </div>

                {/* Button to show detailed breakdown */}
                {!showDetailedBreakdown ? (
                  <button
                    onClick={handleShowBreakdown}
                    className={styles.breakdownButton}
                  >
                    Show Details
                  </button>
                ) : (
                  chunkBreakdown && (
                    <div className={styles.detailedBreakdown}>
                      <button
                        onClick={() => setShowDetailedBreakdown(false)}
                        className={styles.hideBreakdownButton}
                      >
                        ✕
                      </button>
                      <div className={styles.breakdownSentence}>
                        <a
                          href={`/number-locations/${chunkBreakdown.chunkNumber}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.personName}
                        >
                          {chunkBreakdown.person || "<person>"}
                        </a>
                        {" • "}
                        <a
                          href={`/number-locations/${chunkBreakdown.breakdown.firstTwo.digits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.verbMeaning}
                        >
                          {chunkBreakdown.breakdown.firstTwo.meaning}
                        </a>
                        {" • "}
                        <a
                          href={`/number-locations/${chunkBreakdown.breakdown.lastThree.digits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={styles.itemMeaning}
                        >
                          {chunkBreakdown.breakdown.lastThree.meaning}
                        </a>
                      </div>
                    </div>
                  )
                )}

                <div className={styles.responseButtons}>
                  <button
                    onClick={handleMarkCorrect}
                    className={styles.correctButton}
                  >
                    ✓ I got it right
                  </button>
                  <button
                    onClick={handleMarkIncorrect}
                    className={styles.incorrectButton}
                  >
                    ✗ I got it wrong
                  </button>
                  <button
                    onClick={handleNewQuestion}
                    className={styles.skipButton}
                  >
                    Skip / New Question
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
