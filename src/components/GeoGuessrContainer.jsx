import styles from "./GeoGuessrContainer.module.css";
import GeoPlaces from "./GeoPlaces";
import GeoTypes from "./GeoTypes";

export default function GeoGuessrContainer() {
  return (
    <div className={styles.geoContainer + " pageContainer"}>
      <GeoPlaces />
      <GeoTypes />
    </div>
  );
}
