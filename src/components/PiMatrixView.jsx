import { useState, useEffect, useCallback } from "react";
import supabase from "../utils/supabaseClient";
import { fetchCompImage } from "../utils/compImagesUtils";
import styles from "./PiMatrixView.module.css";

const ITEMS_PER_PAGE = 50;

export default function PiMatrixView() {
  const [currentPage, setCurrentPage] = useState(1);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [editingPosition, setEditingPosition] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [hoveredDigits, setHoveredDigits] = useState(null);
  const [digitMeaning, setDigitMeaning] = useState("");
  const [tooltipTimeout, setTooltipTimeout] = useState(null);
  const [jumpToPageValue, setJumpToPageValue] = useState("");
  const [duplicateDigits, setDuplicateDigits] = useState(new Set()); // Track duplicate digit sequences

  // Function to find all duplicate digit sequences
  const findDuplicateDigits = useCallback(async () => {
    try {
      const { data: allChunks, error } = await supabase
        .from("pi_matrix")
        .select("digits")
        .order("position");

      if (error) {
        console.error("Error fetching chunks for duplicate detection:", error);
        return;
      }

      // Count occurrences of each digit sequence
      const digitCounts = {};
      allChunks.forEach((chunk) => {
        digitCounts[chunk.digits] = (digitCounts[chunk.digits] || 0) + 1;
      });

      // Find sequences that appear more than once
      const duplicates = new Set();
      Object.entries(digitCounts).forEach(([digits, count]) => {
        if (count > 1) {
          duplicates.add(digits);
        }
      });

      setDuplicateDigits(duplicates);
      console.log("Found duplicate digit sequences:", Array.from(duplicates));
    } catch (error) {
      console.error("Error detecting duplicates:", error);
    }
  }, []);

  // Function to get meaning of 5 digits (first 2 + next 3)
  const getDigitMeaning = async (digits) => {
    if (digits.length !== 5) return "";

    try {
      const first2 = digits.substring(0, 2);
      const next3 = digits.substring(2, 5);

      // Fetch competition images for both parts
      const [comp2, comp3] = await Promise.all([
        fetchCompImage(first2),
        fetchCompImage(next3),
      ]);

      const meaning2 = comp2?.comp_image || first2;
      const meaning3 = comp3?.comp_image || next3;

      return `${meaning2} + ${meaning3}`;
    } catch (error) {
      console.error("Error fetching digit meaning:", error);
      return "";
    }
  };

  // Function to save person name to database
  const savePerson = async (position, personName) => {
    if (!personName.trim()) return;

    try {
      // Determine the correct lookup key (padded for 1-9, unpadded for 10+)
      const lookupKey =
        position >= 1 && position <= 9
          ? position.toString().padStart(2, "0")
          : position.toString();

      const { error } = await supabase.from("numberstrings").upsert(
        [
          {
            num_string: lookupKey,
            person: personName.trim(),
          },
        ],
        {
          onConflict: ["num_string"],
        }
      );

      if (error) {
        console.error("Error saving person:", error);
        return;
      }

      // Update local state to reflect the change
      setChunks((prev) =>
        prev.map((chunk) =>
          chunk.position === position
            ? { ...chunk, person: personName.trim() }
            : chunk
        )
      );

      setEditingPosition(null);
      setEditingValue("");
    } catch (error) {
      console.error("Unexpected error saving person:", error);
    }
  };

  const handleStartEdit = (position) => {
    setEditingPosition(position);
    setEditingValue("");
  };

  const handleSaveEdit = async () => {
    if (editingPosition !== null) {
      await savePerson(editingPosition, editingValue);
    }
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
    setEditingValue("");
  };

  const handleDigitsHover = async (digits, position) => {
    // Clear any existing timeout
    if (tooltipTimeout) {
      clearTimeout(tooltipTimeout);
      setTooltipTimeout(null);
    }

    setHoveredDigits(position);
    const meaning = await getDigitMeaning(digits);
    setDigitMeaning(meaning);
  };

  const handleDigitsLeave = () => {
    setHoveredDigits(null);
    setDigitMeaning("");
  };

  const handleDigitsTap = async (digits, position) => {
    // For mobile - show tooltip and auto-hide after 3 seconds
    await handleDigitsHover(digits, position);

    const timeout = setTimeout(() => {
      handleDigitsLeave();
    }, 3000);

    setTooltipTimeout(timeout);
  };

  // Fetch chunks for current page from database
  const fetchPageChunks = useCallback(async (page) => {
    setLoading(true);

    try {
      const startIndex = (page - 1) * ITEMS_PER_PAGE;

      // First, just fetch the pi chunks quickly
      const { data: chunksData, error: chunksError } = await supabase
        .from("pi_matrix")
        .select("position, digits")
        .order("position")
        .range(startIndex, startIndex + ITEMS_PER_PAGE - 1);

      if (chunksError) {
        console.error("Error fetching pi chunks:", chunksError);
        setLoading(false);
        return;
      }

      // Get total count on first load
      if (page === 1) {
        const { count, error: countError } = await supabase
          .from("pi_matrix")
          .select("*", { count: "exact", head: true });

        if (!countError) {
          setTotalCount(count);
        }
      }

      // Get position numbers for this page, using special rule for 1-9
      const positions =
        chunksData?.map((chunk) => {
          // For positions 1-9, look up using padded format (01, 02, etc.)
          if (chunk.position >= 1 && chunk.position <= 9) {
            return chunk.position.toString().padStart(2, "0");
          }
          // For positions 10+, use regular format
          return chunk.position.toString();
        }) || [];

      // Fetch all person data for these positions in one query
      console.log("Looking for positions:", positions);
      const { data: personData, error: personError } = await supabase
        .from("numberstrings")
        .select("num_string, person")
        .in("num_string", positions);

      console.log("Person data found:", personData);
      console.log("Person query error:", personError);

      // Create a map of position -> person
      const personMap = {};
      if (personData) {
        personData.forEach((item) => {
          personMap[item.num_string] = item.person;
        });
      }
      console.log("Person map:", personMap);

      // Add person data to chunks
      const chunksWithPersons =
        chunksData?.map((chunk) => {
          // Use the same lookup key as we used for the database query
          const lookupKey =
            chunk.position >= 1 && chunk.position <= 9
              ? chunk.position.toString().padStart(2, "0")
              : chunk.position.toString();

          return {
            ...chunk,
            person: personMap[lookupKey],
          };
        }) || [];

      setChunks(chunksWithPersons);
      setLoading(false);
    } catch (error) {
      console.error("Unexpected error fetching chunks:", error);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPageChunks(currentPage);
  }, [currentPage, fetchPageChunks]);

  // Load duplicates on component mount
  useEffect(() => {
    findDuplicateDigits();
  }, [findDuplicateDigits]);

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
    }
  };

  const handleJumpToPage = () => {
    const pageNum = parseInt(jumpToPageValue);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= totalPages) {
      setCurrentPage(pageNum);
      setJumpToPageValue(""); // Clear the input after successful jump
    }
  };

  const handleJumpInputKeyPress = (e) => {
    if (e.key === "Enter") {
      handleJumpToPage();
    }
  };

  if (loading) {
    return (
      <div className={styles.piContainer}>
        <div className={styles.loading}>Loading page {currentPage}...</div>
      </div>
    );
  }

  return (
    <div className={styles.piContainer + " pageContainer"}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <h2>Pi Matrix - First 10,000 Digits</h2>
          <a href="/pi/test" className={styles.testLink}>
            📝 Test Your Knowledge
          </a>
        </div>
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages} (
            {(currentPage - 1) * ITEMS_PER_PAGE + 1}-
            {Math.min(currentPage * ITEMS_PER_PAGE, totalCount)} of {totalCount}{" "}
            chunks)
          </span>
          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={styles.pageButton}
          >
            Next
          </button>
          <div className={styles.jumpToPage}>
            <input
              type="number"
              value={jumpToPageValue}
              onChange={(e) => setJumpToPageValue(e.target.value)}
              onKeyPress={handleJumpInputKeyPress}
              placeholder="Page #"
              min="1"
              max={totalPages}
              className={styles.jumpInput}
            />
            <button
              onClick={handleJumpToPage}
              className={styles.jumpButton}
              disabled={!jumpToPageValue || loading}
            >
              Go
            </button>
          </div>
        </div>
      </div>

      <div className={styles.tableContainer}>
        <table className={styles.chunksTable}>
          <thead>
            <tr>
              <th>Index</th>
              <th>Person</th>
              <th>Digits</th>
            </tr>
          </thead>
          <tbody>
            {chunks.map((chunk) => {
              const startDigit = (chunk.position - 1) * 5 + 1;
              const endDigit = chunk.position * 5;
              const digitRange = `(${startDigit}-${endDigit})`;
              const formattedDigits = chunk.digits.split("").join(" ");

              // Special rule: for positions 1-9, link to 01-09
              const linkPosition =
                chunk.position >= 1 && chunk.position <= 9
                  ? chunk.position.toString().padStart(2, "0")
                  : chunk.position.toString();

              // Check if this chunk has duplicate digits
              const isDuplicate = duplicateDigits.has(chunk.digits);

              return (
                <tr
                  key={chunk.position}
                  className={`${styles.chunkRow} ${
                    isDuplicate ? styles.duplicateRow : ""
                  }`}
                >
                  <td className={styles.indexCell}>
                    <div className={styles.positionNumber}>
                      {chunk.position}
                    </div>
                    <div className={styles.digitRange}>{digitRange}</div>
                  </td>
                  <td className={styles.personCell}>
                    {chunk.person ? (
                      <a
                        href={`/number-locations/${linkPosition}`}
                        className={styles.personLink}
                      >
                        {chunk.person}
                      </a>
                    ) : editingPosition === chunk.position ? (
                      <div className={styles.editingContainer}>
                        <input
                          type="text"
                          value={editingValue}
                          onChange={(e) => setEditingValue(e.target.value)}
                          onBlur={handleSaveEdit}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit();
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className={styles.personInput}
                          placeholder="Enter person name"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => handleStartEdit(chunk.position)}
                        className={styles.addPersonButton}
                      >
                        + Add person
                      </button>
                    )}
                  </td>
                  <td
                    className={styles.digitsCell}
                    onMouseEnter={() =>
                      handleDigitsHover(chunk.digits, chunk.position)
                    }
                    onMouseLeave={handleDigitsLeave}
                    onClick={() =>
                      handleDigitsTap(chunk.digits, chunk.position)
                    } // For mobile tap with auto-hide
                  >
                    <div className={styles.digitsContainer}>
                      {formattedDigits}
                      {hoveredDigits === chunk.position && digitMeaning && (
                        <div className={styles.digitTooltip}>
                          {digitMeaning}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className={styles.bottomPagination}>
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className={styles.pageButton}
        >
          Previous
        </button>
        <span className={styles.pageInfo}>
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className={styles.pageButton}
        >
          Next
        </button>
        <div className={styles.jumpToPage}>
          <input
            type="number"
            value={jumpToPageValue}
            onChange={(e) => setJumpToPageValue(e.target.value)}
            onKeyPress={handleJumpInputKeyPress}
            placeholder="Page #"
            min="1"
            max={totalPages}
            className={styles.jumpInput}
          />
          <button
            onClick={handleJumpToPage}
            className={styles.jumpButton}
            disabled={!jumpToPageValue || loading}
          >
            Go
          </button>
        </div>
      </div>
    </div>
  );
}
