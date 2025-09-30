"use client";
import React from "react";
import styles from "../../../components/NumberLocationGallery.module.css";
import { useParams } from "next/navigation";

const NumberLocationPage = () => {
  const params = useParams();
  const { number } = params;

  return (
    <div className={styles.galleryContainer + " pageContainer"}>
      <h1
        style={{
          fontSize: 64,
          color: "#004d4d",
          textAlign: "center",
          marginTop: 80,
        }}
      >
        {number}
      </h1>
    </div>
  );
};

export default NumberLocationPage;
