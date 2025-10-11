import { useState, useEffect, useCallback } from "react";
import supabase from "../utils/supabaseClient";
import styles from "./PiMatrixView.module.css";

const ITEMS_PER_PAGE = 50;

export default function PiMatrixView() {
  const [currentPage, setCurrentPage] = useState(1);
  const [chunks, setChunks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

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

      // Get position numbers for this page
      const positions =
        chunksData?.map((chunk) => chunk.position.toString()) || [];

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
        chunksData?.map((chunk) => ({
          ...chunk,
          person: personMap[chunk.position.toString()],
        })) || [];

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

  const totalPages = Math.ceil(totalCount / ITEMS_PER_PAGE);

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      setCurrentPage(newPage);
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
        <h2>Pi Matrix - First 10,000 Digits</h2>
        <p>
          Each row shows a 5-digit chunk with its position number and associated
          person. Future columns will include test frequency and accuracy.
        </p>
        <div className={styles.pagination}>
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={styles.pageButton}
          >
            Previous
          </button>
          <span className={styles.pageInfo}>
            Page {currentPage} of {totalPages}(
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

              return (
                <tr key={chunk.position} className={styles.chunkRow}>
                  <td className={styles.indexCell}>
                    <div className={styles.positionNumber}>
                      {chunk.position}
                    </div>
                    <div className={styles.digitRange}>{digitRange}</div>
                  </td>
                  <td className={styles.personCell}>
                    {chunk.person ? (
                      <a
                        href={`/number-locations/${chunk.position}`}
                        className={styles.personLink}
                      >
                        {chunk.person}
                      </a>
                    ) : (
                      <a
                        href={`/number-locations/${chunk.position}`}
                        className={styles.numberLocationLink}
                      >
                        &lt;number location&gt;
                      </a>
                    )}
                  </td>
                  <td className={styles.digitsCell}>{formattedDigits}</td>
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
      </div>
    </div>
  );
}
