"use client";

import { useState, useEffect } from "react";
import supabase from "../utils/supabaseClient";
import { fetchCompImage } from "../utils/compImagesUtils";
import styles from "./PiTestContainer.module.css";

const TEST_MODES = {
  DIGITS_TO_CHUNK: "digits-to-chunk",
  CHUNK_TO_DIGITS: "chunk-to-digits",
};

export default function PiTestContainer() {
  const [testMode, setTestMode] = useState(TEST_MODES.DIGITS_TO_CHUNK);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [showDetailedBreakdown, setShowDetailedBreakdown] = useState(false);
  const [chunkBreakdown, setChunkBreakdown] = useState(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [allChunks, setAllChunks] = useState([]);

  // Range selection state
  const [rangeMode, setRangeMode] = useState("all"); // "all", "chunks", "digits"
  const [chunkRangeStart, setChunkRangeStart] = useState(1);
  const [chunkRangeEnd, setChunkRangeEnd] = useState(100);
  const [digitRangeStart, setDigitRangeStart] = useState(1);
  const [digitRangeEnd, setDigitRangeEnd] = useState(500);
  const [filteredChunks, setFilteredChunks] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Temporary input states for editing (to avoid validation on every keystroke)
  const [tempChunkStart, setTempChunkStart] = useState("1");
  const [tempChunkEnd, setTempChunkEnd] = useState("100");
  const [tempDigitStart, setTempDigitStart] = useState("1");
  const [tempDigitEnd, setTempDigitEnd] = useState("500");

  // Get detailed breakdown for a chunk (person + digit meanings)
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
    const chunksToUse = filteredChunks.length > 0 ? filteredChunks : allChunks;
    if (chunksToUse.length === 0) return;

    setLoading(true);
    setShowAnswer(false);
    setShowDetailedBreakdown(false);
    setChunkBreakdown(null);

    const randomChunk =
      chunksToUse[Math.floor(Math.random() * chunksToUse.length)];

    if (testMode === TEST_MODES.DIGITS_TO_CHUNK) {
      setCurrentQuestion({
        type: "digits-to-chunk",
        digits: randomChunk.digits,
        correctAnswer: randomChunk.position,
        question: `Which chunk do these digits belong to?`,
      });
    } else if (testMode === TEST_MODES.CHUNK_TO_DIGITS) {
      setCurrentQuestion({
        type: "chunk-to-digits",
        position: randomChunk.position,
        correctAnswer: randomChunk.digits,
        question: `What are the digits for chunk ${randomChunk.position}?`,
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
  }, [filteredChunks, allChunks, testMode]);

  const handleRevealAnswer = () => {
    setShowAnswer(true);
  };

  const handleMarkCorrect = () => {
    setScore((prev) => ({ correct: prev.correct + 1, total: prev.total + 1 }));
    generateQuestion();
  };

  const handleMarkIncorrect = () => {
    setScore((prev) => ({ correct: prev.correct, total: prev.total + 1 }));
    generateQuestion();
  };

  const handleNewQuestion = () => {
    generateQuestion();
  };

  const resetScore = () => {
    setScore({ correct: 0, total: 0 });
  };

  const changeTestMode = (newMode) => {
    setTestMode(newMode);
    setCurrentQuestion(null);
    setShowAnswer(false);
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
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={styles.settingsToggle}
          >
            ⚙️ {showSettings ? "Hide" : "Settings"}
          </button>
        </div>

        {/* Score display - always visible */}
        <div className={styles.scoreDisplay}>
          <span className={styles.scoreText}>
            Score: {score.correct}/{score.total}
            {score.total > 0 && (
              <span className={styles.percentage}>
                ({Math.round((score.correct / score.total) * 100)}%)
              </span>
            )}
          </span>
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

            {filteredChunks.length > 0 && rangeMode !== "all" && (
              <div className={styles.activeRange}>
                Active range: {filteredChunks.length} chunks
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
                        {currentQuestion.correctAnswer}
                      </div>
                      <div className={styles.answerDetail}>
                        (Digits {(currentQuestion.correctAnswer - 1) * 5 + 1}-
                        {currentQuestion.correctAnswer * 5} of π)
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
                        <span className={styles.personName}>
                          {chunkBreakdown.person || "<person>"}
                        </span>
                        {" • "}
                        <span className={styles.verbMeaning}>
                          {chunkBreakdown.breakdown.firstTwo.meaning}
                        </span>
                        {" • "}
                        <span className={styles.itemMeaning}>
                          {chunkBreakdown.breakdown.lastThree.meaning}
                        </span>
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
